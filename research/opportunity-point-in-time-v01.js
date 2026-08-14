'use strict';

const crypto = require('node:crypto');

const SCHEMA_VERSION = 'lv-opportunity-snapshot-v1';
const STATUS = Object.freeze({
  ACTIVE: 'ACTIVE', RESERVE: 'RESERVE', IR: 'IR', PUP: 'PUP', NFI: 'NFI', SUSPENDED: 'SUSPENDED', UNKNOWN: 'UNKNOWN'
});
const ROLE_FAMILIES = Object.freeze({
  QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', OL: 'OL', DL: 'DL', LB: 'LB', DB: 'DB', ST: 'ST', OTHER: 'OTHER'
});

function assert(condition, message) { if (!condition) throw new Error(message); }
function iso(value, field) { const d = new Date(value); assert(value && !Number.isNaN(d.getTime()), `${field} must be a valid timestamp`); return d.toISOString(); }
function stableHash(value) { return crypto.createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex'); }
function normalizeTeam(team) { assert(typeof team === 'string' && team.trim(), 'team is required'); return team.trim().toUpperCase(); }
function normalizeRoleFamily(position) {
  const p = String(position || '').toUpperCase();
  if (['QB'].includes(p)) return ROLE_FAMILIES.QB;
  if (['RB','FB','HB'].includes(p)) return ROLE_FAMILIES.RB;
  if (['WR'].includes(p)) return ROLE_FAMILIES.WR;
  if (['TE'].includes(p)) return ROLE_FAMILIES.TE;
  if (['C','G','OG','OT','T','OL'].includes(p)) return ROLE_FAMILIES.OL;
  if (['DE','DT','NT','DL','EDGE'].includes(p)) return ROLE_FAMILIES.DL;
  if (['LB','ILB','OLB'].includes(p)) return ROLE_FAMILIES.LB;
  if (['CB','DB','S','FS','SS'].includes(p)) return ROLE_FAMILIES.DB;
  if (['K','P','LS','KR','PR'].includes(p)) return ROLE_FAMILIES.ST;
  return ROLE_FAMILIES.OTHER;
}
function normalizeRosterStatus(value) {
  const s = String(value || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (!s) return STATUS.UNKNOWN;
  if (s.includes('PUP') || s.includes('PHYSICALLY_UNABLE_TO_PERFORM')) return STATUS.PUP;
  if (s === 'IR' || s.includes('INJURED_RESERVE')) return STATUS.IR;
  if (s.includes('NFI')) return STATUS.NFI;
  if (s.includes('SUSP')) return STATUS.SUSPENDED;
  if (s.includes('RESERVE')) return STATUS.RESERVE;
  if (['ACT','ACTIVE','A'].includes(s)) return STATUS.ACTIVE;
  return STATUS.UNKNOWN;
}
function validateIdentity(identity) {
  assert(identity && typeof identity === 'object', 'identity is required');
  assert(identity.provider_player_id, 'provider_player_id is required');
  const confidence = Number(identity.mapping_confidence);
  assert(Number.isFinite(confidence) && confidence >= 0 && confidence <= 1, 'mapping_confidence must be 0..1');
  if (!identity.gsis_id) assert(confidence < 1, 'unmapped identity cannot have mapping_confidence=1');
  return {
    provider_player_id: String(identity.provider_player_id), gsis_id: identity.gsis_id ? String(identity.gsis_id) : null,
    sportradar_id: identity.sportradar_id ? String(identity.sportradar_id) : null, sleeper_id: identity.sleeper_id ? String(identity.sleeper_id) : null,
    mapping_method: identity.mapping_method || 'provider_only', mapping_confidence: confidence
  };
}
function canonicalSnapshotRow(input) {
  assert(input && typeof input === 'object', 'snapshot row is required');
  assert(input.provider, 'provider is required'); assert(input.provider_snapshot_id, 'provider_snapshot_id is required');
  assert(Number.isInteger(Number(input.season)), 'season must be integer-like');
  const depthRank = input.depth_rank == null ? null : Number(input.depth_rank);
  if (depthRank != null) assert(Number.isInteger(depthRank) && depthRank >= 1, 'depth_rank must be positive integer or null');
  const row = {
    schema_version: SCHEMA_VERSION, provider: String(input.provider), provider_snapshot_id: String(input.provider_snapshot_id),
    acquired_at: iso(input.acquired_at || input.data_as_of, 'acquired_at'), data_as_of: iso(input.data_as_of, 'data_as_of'),
    season: Number(input.season), season_type: String(input.season_type || 'PRE').toUpperCase(), snapshot_scope: input.snapshot_scope || 'TEAM',
    week_or_cutoff: input.week_or_cutoff == null ? null : String(input.week_or_cutoff), team: normalizeTeam(input.team), identity: validateIdentity(input.identity),
    player_name: input.player_name ? String(input.player_name) : null, position: input.position ? String(input.position).toUpperCase() : null,
    role_family: input.role_family || normalizeRoleFamily(input.position), provider_depth_position: input.provider_depth_position ? String(input.provider_depth_position) : null,
    depth_rank: depthRank, starter: depthRank == null ? null : depthRank === 1, roster_status: normalizeRosterStatus(input.roster_status),
    injury_status: input.injury_status ? String(input.injury_status).toUpperCase() : null, transaction_context: input.transaction_context || null,
    source_quality: input.source_quality || 'UNASSESSED', provenance: input.provenance || null
  };
  assert(row.provenance && row.provenance.source_uri, 'provenance.source_uri is required');
  assert(row.provenance.license_basis, 'provenance.license_basis is required');
  return row;
}
function validateSnapshotSet(rows, options = {}) {
  assert(Array.isArray(rows) && rows.length, 'snapshot set must be non-empty');
  const canonical = rows.map(canonicalSnapshotRow);
  const snapshotIds = new Set(canonical.map(r => r.provider_snapshot_id)); const asOf = new Set(canonical.map(r => r.data_as_of)); const seasons = new Set(canonical.map(r => r.season));
  assert(snapshotIds.size === 1 || options.allow_multi_snapshot, 'snapshot set mixes provider_snapshot_id values');
  assert(asOf.size === 1 || options.allow_multi_asof, 'snapshot set mixes data_as_of values'); assert(seasons.size === 1 || options.allow_multi_season, 'snapshot set mixes seasons');
  const keys = new Set();
  for (const row of canonical) {
    const key = `${row.provider_snapshot_id}|${row.team}|${row.identity.provider_player_id}|${row.provider_depth_position || row.position || ''}`;
    assert(!keys.has(key), `duplicate canonical snapshot row: ${key}`); keys.add(key);
  }
  return canonical;
}
function choosePreseasonCutoff(snapshots, teamKickoffs, policy = 'TEAM_LAST_BEFORE_KICKOFF') {
  assert(policy === 'TEAM_LAST_BEFORE_KICKOFF', 'only leakage-safe TEAM_LAST_BEFORE_KICKOFF is implemented');
  const rows = validateSnapshotSet(snapshots, { allow_multi_snapshot: true, allow_multi_asof: true }); const byTeam = new Map();
  for (const row of rows) {
    const kickoff = teamKickoffs[row.team]; assert(kickoff, `missing first regular-season kickoff for ${row.team}`); const kickoffIso = iso(kickoff, `kickoff ${row.team}`);
    if (row.data_as_of >= kickoffIso) continue; const current = byTeam.get(row.team); if (!current || row.data_as_of > current.data_as_of) byTeam.set(row.team, row);
  }
  const selectedSnapshotIds = new Map(); for (const row of rows) { const selected = byTeam.get(row.team); if (selected) selectedSnapshotIds.set(row.team, selected.provider_snapshot_id); }
  const selected = rows.filter(r => selectedSnapshotIds.get(r.team) === r.provider_snapshot_id);
  const missing = Object.keys(teamKickoffs).filter(team => !selectedSnapshotIds.has(normalizeTeam(team)));
  return { policy, rows: selected, missing_teams: missing.sort(), selected_snapshot_ids: Object.fromEntries([...selectedSnapshotIds].sort()) };
}
function indexByPlayer(rows) { const map = new Map(); for (const row of rows) { const key = row.identity.gsis_id || `provider:${row.provider}:${row.identity.provider_player_id}`; map.set(key, row); } return map; }
function deriveDepthTransitions(previousRows, currentRows) {
  const prev = indexByPlayer(previousRows.map(canonicalSnapshotRow)); const curr = indexByPlayer(currentRows.map(canonicalSnapshotRow)); const keys = new Set([...prev.keys(), ...curr.keys()]); const out = [];
  for (const key of [...keys].sort()) {
    const a = prev.get(key) || null, b = curr.get(key) || null; const fromRank = a?.depth_rank ?? null, toRank = b?.depth_rank ?? null; const fromStarter = a?.starter ?? false, toStarter = b?.starter ?? false;
    let transition = 'STABLE_OR_UNORDERED';
    if (a && !b) transition = 'LEFT_CURRENT_ROSTER'; else if (!a && b) transition = 'NEW_TO_CURRENT_ROSTER'; else if (!fromStarter && toStarter) transition = 'BACKUP_TO_STARTER';
    else if (fromStarter && !toStarter) transition = 'STARTER_TO_BACKUP'; else if (fromRank != null && toRank != null && fromRank !== toRank) transition = toRank < fromRank ? 'DEPTH_PROMOTION' : 'DEPTH_DEMOTION';
    out.push({ player_key: key, team_from: a?.team ?? null, team_to: b?.team ?? null, team_changed: Boolean(a && b && a.team !== b.team), from_depth_rank: fromRank, to_depth_rank: toRank, transition });
  }
  return out;
}
function deriveVacatedOpportunity(priorUsageRows, currentRosterRows) {
  assert(Array.isArray(priorUsageRows), 'priorUsageRows must be an array'); const current = indexByPlayer(currentRosterRows.map(canonicalSnapshotRow)); const totals = new Map(), vacated = new Map();
  for (const u of priorUsageRows) {
    const team = normalizeTeam(u.team); const key = u.gsis_id ? String(u.gsis_id) : `provider:${u.provider}:${u.provider_player_id}`;
    const metrics = { carries: Number(u.carries || 0), targets: Number(u.targets || 0), pass_attempts: Number(u.pass_attempts || 0) };
    if (!totals.has(team)) totals.set(team, { carries: 0, targets: 0, pass_attempts: 0 }); if (!vacated.has(team)) vacated.set(team, { carries: 0, targets: 0, pass_attempts: 0 });
    for (const m of Object.keys(metrics)) totals.get(team)[m] += metrics[m]; const currentRow = current.get(key); const remainsOnSameTeam = currentRow && currentRow.team === team;
    if (!remainsOnSameTeam) for (const m of Object.keys(metrics)) vacated.get(team)[m] += metrics[m];
  }
  const out = {};
  for (const [team, total] of [...totals.entries()].sort()) {
    const v = vacated.get(team); out[team] = {};
    for (const m of Object.keys(total)) { out[team][`prior_${m}`] = total[m]; out[team][`vacated_${m}`] = v[m]; out[team][`vacated_${m}_share`] = total[m] > 0 ? v[m] / total[m] : 0; }
  }
  return out;
}
function roleStabilityFeatures(snapshotHistory) {
  const rows = snapshotHistory.map(canonicalSnapshotRow).sort((a,b) => a.data_as_of.localeCompare(b.data_as_of)); const grouped = new Map();
  for (const row of rows) { const key = row.identity.gsis_id || `provider:${row.provider}:${row.identity.provider_player_id}`; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(row); }
  const out = [];
  for (const [player_key, history] of [...grouped.entries()].sort()) {
    let rankChanges = 0, starterChanges = 0; for (let i = 1; i < history.length; i++) { if (history[i-1].depth_rank !== history[i].depth_rank) rankChanges++; if (history[i-1].starter !== history[i].starter) starterChanges++; }
    const ordered = history.filter(r => r.depth_rank != null), ranks = ordered.map(r => r.depth_rank);
    out.push({ player_key, observations: history.length, ordered_observations: ordered.length, final_depth_rank: history.at(-1).depth_rank, final_starter: history.at(-1).starter,
      rank_changes: rankChanges, starter_state_changes: starterChanges, starter_share_of_snapshots: history.length ? history.filter(r => r.starter).length / history.length : null,
      depth_rank_range: ranks.length ? Math.max(...ranks) - Math.min(...ranks) : null });
  }
  return out;
}
function cohortForPlayer({ years_exp_at_cutoff, prior_opportunity, transition, team_changed }) {
  const year = Number(years_exp_at_cutoff) + 1; return { nfl_year: Number.isFinite(year) ? year : null, second_year: year === 2, third_year: year === 3,
    limited_history: Number(prior_opportunity || 0) <= 0, backup_to_starter: transition === 'BACKUP_TO_STARTER', team_changed: Boolean(team_changed) };
}
function buildOpportunityRecord({ snapshot, prior_usage = {}, transition = null, vacated_team = {}, role_stability = {}, years_exp_at_cutoff = null }) {
  const row = canonicalSnapshotRow(snapshot); const priorOpportunity = row.role_family === 'QB' ? Number(prior_usage.pass_attempts || 0) : row.role_family === 'RB' ? Number(prior_usage.carries || 0) + Number(prior_usage.targets || 0) : Number(prior_usage.targets || 0);
  return { season: row.season, player_key: row.identity.gsis_id || `provider:${row.provider}:${row.identity.provider_player_id}`, team: row.team, role_family: row.role_family,
    depth_rank: row.depth_rank, starter: row.starter, roster_status: row.roster_status, injury_status: row.injury_status, prior_opportunity: priorOpportunity,
    transition: transition?.transition || null, team_changed: Boolean(transition?.team_changed), vacated_opportunity: vacated_team, role_stability,
    cohort: cohortForPlayer({ years_exp_at_cutoff, prior_opportunity: priorOpportunity, transition: transition?.transition, team_changed: transition?.team_changed }),
    uncertainty_inputs: { identity_confidence: row.identity.mapping_confidence, source_quality: row.source_quality, ordered_depth_available: row.depth_rank != null,
      snapshot_observations: role_stability.observations ?? null, depth_rank_range: role_stability.depth_rank_range ?? null, roster_status_known: row.roster_status !== STATUS.UNKNOWN } };
}
function uncertaintyScore(inputs) {
  let score = 0; score += (1 - Number(inputs.identity_confidence ?? 0)) * 0.35; if (!inputs.ordered_depth_available) score += 0.25; if (!inputs.roster_status_known) score += 0.1;
  if ((inputs.snapshot_observations ?? 0) < 2) score += 0.15; if ((inputs.depth_rank_range ?? 0) >= 2) score += 0.15; return Math.max(0, Math.min(1, score));
}
function buildChronologicalFolds(records, { selection_end_season = 2024, minimum_train_seasons = 3 } = {}) {
  assert(Array.isArray(records), 'records must be array'); const seasons = [...new Set(records.map(r => Number(r.season)))].filter(Number.isFinite).sort((a,b) => a-b); const folds = [];
  for (const validationSeason of seasons) { if (validationSeason > selection_end_season) continue; const trainSeasons = seasons.filter(s => s < validationSeason); if (trainSeasons.length < minimum_train_seasons) continue;
    folds.push({ validation_season: validationSeason, train_seasons: trainSeasons, train: records.filter(r => trainSeasons.includes(Number(r.season))), validation: records.filter(r => Number(r.season) === validationSeason) }); }
  return folds;
}
function prospectiveManifest(rows, metadata = {}) {
  const canonical = validateSnapshotSet(rows, { allow_multi_snapshot: true, allow_multi_asof: true, allow_multi_season: true });
  const sorted = [...canonical].sort((a,b) => `${a.data_as_of}|${a.team}|${a.identity.provider_player_id}`.localeCompare(`${b.data_as_of}|${b.team}|${b.identity.provider_player_id}`));
  return { schema_version: SCHEMA_VERSION, created_at: new Date().toISOString(), snapshot_count: new Set(sorted.map(r => r.provider_snapshot_id)).size, row_count: sorted.length,
    seasons: [...new Set(sorted.map(r => r.season))].sort(), providers: [...new Set(sorted.map(r => r.provider))].sort(), raw_rows_sha256: stableHash(sorted), metadata };
}
function sportradarAdapter(payload, meta) {
  assert(meta && meta.data_as_of && meta.snapshot_id && meta.season, 'Sportradar meta needs data_as_of, snapshot_id, season'); const teams = payload?.teams || payload?.league?.teams || []; const rows = [];
  for (const team of teams) { const positions = team.positions || team.depth_chart || []; for (const pos of positions) { const players = pos.players || pos.depth || []; for (const player of players) {
    rows.push(canonicalSnapshotRow({ provider: 'SPORTRADAR', provider_snapshot_id: meta.snapshot_id, acquired_at: meta.acquired_at || meta.data_as_of, data_as_of: meta.data_as_of,
      season: meta.season, season_type: meta.season_type || 'PRE', week_or_cutoff: meta.week, team: team.alias || team.market || team.id,
      identity: { provider_player_id: player.id || player.player_id, gsis_id: player.gsis_id || null, sportradar_id: player.sr_id || player.id || null,
        mapping_method: player.gsis_id ? 'provider_cross_id' : 'provider_only', mapping_confidence: player.gsis_id ? 1 : 0.5 },
      player_name: player.name || player.full_name, position: player.position || pos.name || pos.position, provider_depth_position: pos.name || pos.position || null,
      depth_rank: player.depth ?? player.depth_rank ?? null, roster_status: player.status || team.status || 'UNKNOWN', injury_status: player.injury_status || null,
      source_quality: meta.source_quality || 'VENDOR_SAMPLE_UNVERIFIED', provenance: { source_uri: meta.source_uri || 'sportradar-sample', license_basis: meta.license_basis || 'SAMPLE_EVALUATION_ONLY' } }));
  } } }
  return rows;
}
function nflverse2025Adapter(rows, meta) {
  return rows.map((r, i) => canonicalSnapshotRow({ provider: 'NFLVERSE_2025_PLUS', provider_snapshot_id: meta.snapshot_id || `${r.dt}:${r.team}`, acquired_at: meta.acquired_at || r.dt,
    data_as_of: r.dt, season: meta.season || new Date(r.dt).getUTCFullYear(), season_type: meta.season_type || 'PRE', week_or_cutoff: meta.week || null, team: r.team,
    identity: { provider_player_id: r.espn_id || r.gsis_id || `${r.player_name}:${i}`, gsis_id: r.gsis_id || null, mapping_method: r.gsis_id ? 'native_gsis' : 'provider_only', mapping_confidence: r.gsis_id ? 1 : 0.4 },
    player_name: r.player_name, position: r.pos_grp || r.pos_slot, provider_depth_position: r.pos_slot || r.pos_grp, depth_rank: r.pos_rank, roster_status: r.status || 'UNKNOWN',
    source_quality: meta.source_quality || 'RESEARCH_MECHANICS_ONLY', provenance: { source_uri: meta.source_uri || 'nflverse-data', license_basis: meta.license_basis || 'CC-BY-4.0_RESEARCH_PROVENANCE_REVIEW' } }));
}

module.exports = { SCHEMA_VERSION, STATUS, canonicalSnapshotRow, validateSnapshotSet, choosePreseasonCutoff, deriveDepthTransitions, deriveVacatedOpportunity,
  roleStabilityFeatures, cohortForPlayer, buildOpportunityRecord, uncertaintyScore, buildChronologicalFolds, prospectiveManifest, sportradarAdapter, nflverse2025Adapter,
  normalizeRoleFamily, normalizeRosterStatus };
