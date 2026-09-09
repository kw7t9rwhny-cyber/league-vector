'use strict';

// Two phases: freeze uses development outcomes only; assess receives final
// outcomes after the exact delivered predictions have been retained.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const P = require('./projection-v03.js');
const Complete = require('./projection-v03-complete.js');
const M = require('./projection-evaluation-metrics.js');
const VERSION = 'lv-projection-evaluation/1';
const playerKey = M.playerKey;
const CANDIDATES = ['weighted_603010', 'ridge_noage_v03', 'ridge_age_v03', 'shrink_v03'];
const PROHIBITED = ['calibrated_probability', 'universal_accuracy', 'guaranteed_future_performance', 'best_model', 'dynasty_accuracy'];
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  throw new Error('Evidence must contain only finite JSON values');
}
const hash = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
const round = n => Math.round(n * 10) / 10;
function requireThat(condition, message) { if (!condition) throw new Error(message); }
function time(value) {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)), `Explicit UTC timestamp required: ${value}`);
  requireThat(new Date(value).toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z')), 'Invalid UTC calendar date');
  return Date.parse(value);
}
function unique(rows, key, label) {
  const seen = new Set();
  for (const row of rows) { const id = key(row); requireThat(!seen.has(id), `Duplicate ${label}: ${id}`); seen.add(id); }
}
function sourceManifest(sources) {
  requireThat(Array.isArray(sources) && sources.length > 0, 'Exact source manifest required');
  unique(sources, s => s.id, 'source');
  return sources.map(s => {
    requireThat(typeof s.id === 'string' && s.id.length > 0 && s.sha256 === hash(s.payload), 'Source payload hash mismatch');
    requireThat(typeof s.description === 'string' && s.description.length > 0, 'Source description required');
    return {id: s.id, description: s.description, sha256: s.sha256, encoding: 'canonical-json', bytes: Buffer.byteLength(canonical(s.payload))};
  }).sort((a, b) => a.id.localeCompare(b.id));
}
function sourceRecords(sources) {
  return new Map(sources.map(s => {
    requireThat(Array.isArray(s.payload.records), 'Source payload must retain exact normalized records');
    return [s.id, new Set(s.payload.records.map(hash))];
  }));
}
function bind(record, records) {
  requireThat(records.get(record.source_id)?.has(hash(record)), 'Input record not bound to exact source payload');
}
function codeIdentity() {
  const files = ['projection-evaluation.js', 'projection-evaluation-metrics.js', 'projection-v03.js', 'projection-v03-complete.js', 'projection-benchmark-v08.js', 'projection-observations.js', 'ridge-v02.js', 'football-data-v08.js', 'scripts/ingest-historical-data.js'];
  return Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')]));
}
function universeId(origin) {
  return hash({forecast_cutoff: origin.forecast_cutoff, target_season: origin.target_season, target_start: origin.target_start,
    target_end: origin.target_end, format: origin.format, scoring: origin.scoring, eligibility_rule: origin.eligibility_rule,
    members: [...origin.universe.members].sort((a, b) => playerKey(a).localeCompare(playerKey(b))),
    exclusions: [...origin.universe.exclusions].sort((a, b) => playerKey(a).localeCompare(playerKey(b)))});
}
function validateOrigin(o, sources) {
  requireThat(typeof o.id === 'string' && o.id && Number.isInteger(o.target_season), 'Origin identity required');
  requireThat(o.horizon_seasons === 1, 'Existing control models support one-season production only; multi-season ranking model not implemented');
  requireThat(time(o.forecast_cutoff) < time(o.target_start) && time(o.target_start) < time(o.target_end), 'Forecast must precede target window');
  requireThat(Number(o.target_start.slice(0, 4)) === o.target_season, 'Target season and window disagree');
  requireThat(time(o.target_end) - time(o.target_start) <= 366 * 86400000, 'Multi-season windows are unsupported by the retained one-season models');
  requireThat(typeof o.format === 'string' && o.format && typeof o.eligibility_rule === 'string' && o.eligibility_rule, 'Format and eligibility rules required');
  requireThat(o.scoring && Object.keys(o.scoring).length > 0, 'Exact scoring required');
  for (const [position, rules] of Object.entries(o.scoring)) {
    requireThat(P.POSITIONS.includes(position) && Object.keys(rules).length > 0, 'Position/scoring unsupported');
    requireThat(Object.values(rules).every(Number.isFinite), 'Scoring weights must be finite numbers');
    // Unsupported active components cause explicit abstention, not zero.
  }
  const u = o.universe;
  requireThat(u && Array.isArray(u.members) && Array.isArray(u.exclusions), 'Frozen eligible population and exclusions required');
  requireThat(sources.has(u.source_id) && time(u.available_at) <= time(o.forecast_cutoff), 'Universe source must exist by prediction cutoff');
  unique([...u.members, ...u.exclusions], playerKey, 'universe identity');
  unique([...u.members, ...u.exclusions].filter(m => m.gsis_id), m => m.gsis_id, 'universe external alias');
  for (const m of u.members) {
    requireThat(typeof playerKey(m) === 'string' && playerKey(m) && P.POSITIONS.includes(m.position), 'Canonical identity/position required');
    requireThat(Array.isArray(m.cohorts) && m.cohorts.length > 0 && m.cohorts.every(c => typeof c === 'string' && c), 'Explicit cohort flags required');
    requireThat(m.source_id && sources.has(m.source_id) && time(m.available_at) <= time(o.forecast_cutoff), 'Future membership/position/role feature');
  }
  for (const m of u.exclusions) requireThat(playerKey(m) && m.reason && sources.has(m.source_id) && time(m.available_at) <= time(o.forecast_cutoff), 'Exclusion reason and as-of source required');
  requireThat(u.id === universeId(o), 'Changed universe: content identity mismatch');
}
function quantities(cells, counts, sources) {
  const values = {};
  for (const [field, cell] of Object.entries(cells || {})) {
    requireThat(cell && ['value', 'null', 'missing', 'unavailable', 'unsupported', 'not_applicable', 'source_error'].includes(cell.state), 'Typed field state required');
    if (cell.state === 'value') {
      requireThat(Number.isFinite(cell.value), 'Observed quantity must be a finite number');
      if (cell.zero_basis) requireThat(cell.value === 0 && cell.zero_basis.rule && cell.zero_basis.field === field && sources.has(cell.zero_basis.source_id) && cell.zero_basis.coverage === 'complete', 'Structural zero needs field/source/complete-coverage evidence');
      values[field] = cell.value;
    } else {
      requireThat(cell.value === null, 'Missing quantity cannot carry a numeric value');
      values[field] = null;
    }
    const state = cell.state === 'value' ? (cell.value === 0 ? (cell.zero_basis ? 'structural_zero' : 'observed_zero') : 'observed_value') : cell.state;
    counts[field] ||= {};
    counts[field][state] = (counts[field][state] || 0) + 1;
  }
  return values;
}
function seasonRows(input, sources, missingness, records) {
  unique(input.season_rows, r => `${playerKey(r)}|${r.season}`, 'player-season');
  unique(input.season_rows.filter(r => r.gsis_id), r => `${r.gsis_id}|${r.season}`, 'historical external alias');
  return input.season_rows.map(r => {
    bind(r, records);
    requireThat(sources.has(r.source_id) && typeof playerKey(r) === 'string' && playerKey(r) && P.POSITIONS.includes(r.position) && Number.isInteger(r.season), 'Invalid historical row identity/source');
    requireThat(time(r.forecast_cutoff) < time(r.target_start) && time(r.target_start) < time(r.target_end), 'Historical target window invalid');
    requireThat(Number(r.target_start.slice(0, 4)) === r.season, 'Historical season and target window disagree');
    requireThat(time(r.target_end) - time(r.target_start) <= 366 * 86400000, 'Multi-season training targets require a separately implemented horizon model');
    requireThat(time(r.label_available_at) > time(r.target_end) && time(r.feature_available_at) >= time(r.label_available_at), 'Historical label not fully matured before availability');
    requireThat(Number.isInteger(r.games) && r.games >= 0 && r.participation_verified === true, 'Independent participation coverage required; row presence is not games played');
    const totals = quantities(r.stats, missingness, sources);
    if (r.games === 0) requireThat(Object.values(totals).every(v => v === null || v === 0), 'Zero games conflicts with observed production');
    return {...r, totals, per_game: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Number.isFinite(v) && r.games > 0 ? v / r.games : null])), timing: {feature_available_at: r.feature_available_at}};
  });
}
function eligibleHistory(rows, origin) {
  const included = [], exclusions = [];
  for (const r of rows) {
    let reason = null;
    if (r.season >= origin.target_season) reason = 'target_or_future_season';
    else if (time(r.target_end) >= time(origin.forecast_cutoff) || time(r.label_available_at) >= time(origin.forecast_cutoff)) reason = 'unmatured_or_unavailable_label';
    else if (time(r.feature_available_at) > time(origin.forecast_cutoff)) reason = 'future_feature_vintage';
    if (reason) exclusions.push({player_id: playerKey(r), gsis_id: r.gsis_id ?? null, season: r.season, reason}); else included.push(r);
  }
  return {included, exclusions};
}
function predict(origin, rows, birth, selection = null) {
  const history = eligibleHistory(rows, origin), models = new Map(), ledger = [];
  // The legacy learner's index field is internal here; saved evidence retains
  // the canonical player key separately from an optional external GSIS alias.
  const modelRows = history.included.map(r => ({...r, gsis_id: playerKey(r)}));
  const births = Object.fromEntries(Object.entries(birth).map(([id, b]) => [id, {...b, forecast_cutoff: origin.forecast_cutoff}]));
  for (const member of [...origin.universe.members].sort((a, b) => playerKey(a).localeCompare(playerKey(b)))) {
    const h = P.history(P.index(modelRows), playerKey(member), origin.target_season);
    const candidates = selection ? ['selected'] : CANDIDATES;
    for (const candidate of candidates) {
      const raw = {}, used = {}, reasons = {};
      for (const target of Complete.TARGETS[member.position]) {
        const modelName = selection ? selection.find(s => s.position === member.position && s.target === target)?.selected.model || M.BASELINE : candidate;
        if (modelName === 'shrink_v03' && !P.RARE.has(target)) continue;
        const key = `${member.position}|${target}|${modelName}`;
        if (!models.has(key)) models.set(key, Complete.finalModel(modelRows, member.position, target, births, {selected: {model: modelName}}, origin.target_season));
        const value = models.get(key).buildFor(playerKey(member));
        used[target] = modelName;
        if (Number.isFinite(value)) raw[target] = value;
        else reasons[target] = !h.length ? (member.cohorts.includes('rookie') ? 'rookie_model_not_implemented' : 'insufficient_history') : 'missing_required_history_or_fit';
      }
      const clean = P.sanitizeLine(raw, member.position);
      const stats = Object.fromEntries(Object.entries(clean.stats).map(([k, v]) => [k, round(v)]));
      const missing = Object.entries(origin.scoring[member.position] || {}).filter(([k, w]) => w !== 0 && !Number.isFinite(stats[k])).map(([k]) => k);
      ledger.push({player_id: playerKey(member), gsis_id: member.gsis_id ?? null, position: member.position, cohorts: member.cohorts, model: candidate, models: used,
        projected_stats: stats, missing_inputs: missing, abstention_reasons: reasons, history_seasons: h.map(r => r.season),
        confidence: P.confidence(h.length, missing, true), corrections: clean.corrections, intervals: {}});
    }
  }
  return {rows: ledger, training_cutoff: origin.forecast_cutoff, history_exclusions: history.exclusions,
    model_fits: Object.fromEntries([...models].sort(([a], [b]) => a.localeCompare(b)).map(([key, model]) => [key, {...model.fit, training_examples: model.fit.training_examples.map(({gsis_id, ...example}) => ({player_id: gsis_id, ...example}))}])),
    admitted_training_rows: history.included.map(r => ({player_id: playerKey(r), gsis_id: r.gsis_id ?? null, season: r.season, forecast_cutoff: r.forecast_cutoff, target_end: r.target_end, label_available_at: r.label_available_at, feature_available_at: r.feature_available_at}))};
}
function attachOutcomes(origin, forecasts, outcomes, evaluationCutoff, sources, records) {
  requireThat(time(evaluationCutoff) > time(origin.target_end), 'Evaluation cutoff must follow complete target window');
  unique(outcomes, playerKey, 'outcome player-season');
  const members = new Set(origin.universe.members.map(playerKey));
  const values = new Map(), missingness = {};
  for (const outcome of outcomes) {
    bind(outcome, records);
    requireThat(members.has(playerKey(outcome)), 'Outcome outside frozen eligible universe');
    requireThat(outcome.target_season === origin.target_season && outcome.universe_id === origin.universe.id, 'Outcome period/universe mismatch');
    requireThat(sources.has(outcome.source_id), 'Outcome source missing');
    requireThat(time(outcome.available_at) > time(origin.target_end) && time(outcome.available_at) <= time(evaluationCutoff), 'Outcome availability outside evaluation cutoff');
    values.set(playerKey(outcome), quantities(outcome.stats, missingness, sources));
  }
  const ledger = forecasts.map(f => ({...f, actual: values.get(playerKey(f)) || {}, outcome_status: values.has(playerKey(f)) ? 'supplied' : 'absent_from_outcome_data'}));
  return {ledger, missingness};
}
function predictionRows(origin, ledger, selected = false) {
  return ledger.flatMap(f => Object.entries(f.projected_stats).filter(([target]) => Number.isFinite(f.actual[target])).map(([target, prediction]) => ({player_id: playerKey(f), gsis_id: f.gsis_id, position: f.position, target, target_season: origin.target_season, model: selected ? f.models[target] : f.model, prediction, actual: f.actual[target]})));
}
function score(stats, rules) {
  const active = Object.entries(rules || {}).filter(([, w]) => w !== 0);
  if (!active.length || active.some(([k]) => !Number.isFinite(stats[k]))) return null;
  return active.reduce((sum, [k, w]) => sum + stats[k] * w, 0);
}
function summarize(origin, ledger) {
  const rows = ledger.map(f => {
    const prediction = score(f.projected_stats, origin.scoring[f.position]), actual = score(f.actual, origin.scoring[f.position]);
    return {...f, predicted_points: prediction, actual_points: actual, evaluation_exclusion: prediction === null ? 'forecast_abstention' : actual === null ? 'unknown_outcome' : null};
  });
  const evaluated = rows.filter(r => !r.evaluation_exclusion);
  const counts = group => ({eligible: group.length, forecastable: group.filter(r => r.predicted_points !== null).length,
    observed_outcomes: group.filter(r => r.actual_points !== null).length, evaluated: group.filter(r => !r.evaluation_exclusion).length,
    abstentions: group.filter(r => r.predicted_points === null).length, unknown_outcomes: group.filter(r => r.actual_points === null).length,
    absent_from_outcome_data: group.filter(r => r.outcome_status === 'absent_from_outcome_data').length});
  const cohorts = [...new Set(rows.flatMap(r => r.cohorts))].sort();
  return {status: !rows.length ? 'empty_population' : !evaluated.length ? 'no_evaluable_outcomes' : 'scored',
    population: counts(rows), cohorts: Object.fromEntries(cohorts.map(c => [c, counts(rows.filter(r => r.cohorts.includes(c)))])),
    metrics: {...M.errors(evaluated.map(r => ({prediction: r.predicted_points, actual: r.actual_points}))), weighting: 'one observed player in this forecast unit', conditional_on: 'finite forecast and observed outcome'},
    rankings: M.rankReport(evaluated.map(r => ({...r, target_season: origin.target_season, forecast_cutoff: origin.forecast_cutoff, format: origin.format, universe_id: origin.universe.id}))),
    exclusions: rows.filter(r => r.evaluation_exclusion).map(r => ({player_id: playerKey(r), gsis_id: r.gsis_id, reason: r.evaluation_exclusion, unknown_outcome: r.actual_points === null, missing_inputs: r.missing_inputs})), ledger: rows};
}
function assertClaims(claims = []) {
  requireThat(Array.isArray(claims) && claims.every(c => ['historical_error_exact_set', 'observed_coverage_exact_set', 'ordinal_performance_exact_unit'].includes(c)), 'Unsupported claim; heuristic confidence is not calibrated probability');
}
function freeze(input) {
  canonical(input);
  requireThat(input.version === VERSION, 'Unsupported evaluation contract');
  assertClaims(input.requested_claims || []);
  const manifest = sourceManifest(input.sources), sources = new Set(manifest.map(s => s.id)), missingness = {}, records = sourceRecords(input.sources);
  const rows = seasonRows(input, sources, missingness, records);
  const origins = input.origins;
  requireThat(Array.isArray(origins) && origins.length >= 3, 'Selection, calibration and final origins required');
  unique(origins, o => o.id, 'origin');
  unique(origins, o => o.target_season, 'period: stages cannot reuse a season');
  origins.forEach(o => {
    validateOrigin(o, sources);
    bind(o.universe, records);
    [...o.universe.members, ...o.universe.exclusions].forEach(m => bind(m, records));
  });
  requireThat(origins.every(o => ['selection', 'calibration', 'final'].includes(o.stage)), 'Invalid stage');
  const select = origins.filter(o => o.stage === 'selection'), calibration = origins.filter(o => o.stage === 'calibration'), finals = origins.filter(o => o.stage === 'final');
  requireThat(select.length > 0 && calibration.length > 0 && finals.length === 1, 'Need earlier selection, separate calibration, one final origin');
  const final = finals[0];
  requireThat(rows.every(r => r.season < final.target_season && time(r.target_end) < time(final.forecast_cutoff)), 'Final/future labels cannot enter construction input');
  requireThat(time(final.forecast_cutoff) <= time(input.frozen_at) && time(input.frozen_at) < time(final.target_start), 'Forecast artifact must be frozen before target begins');
  requireThat(!Object.hasOwn(final, 'outcomes') && !Object.hasOwn(final, 'evaluation_cutoff'), 'Final outcomes cannot enter forecast construction');
  requireThat(Array.isArray(input.consumed_periods) && !input.consumed_periods.includes(final.target_season), 'Previously inspected period cannot be untouched');
  requireThat(input.data_kind === 'synthetic' || (input.data_kind === 'real' && final.target_season > 2025), 'Known historical development periods cannot be relabeled untouched');
  for (const stage of [select, calibration]) for (const o of stage) requireThat(o.outcomes && time(o.evaluation_cutoff) > time(o.target_end), 'Development outcomes/cutoff required');
  for (const s of select) for (const c of calibration) requireThat(time(s.evaluation_cutoff) < time(c.forecast_cutoff), 'Selection evidence must mature before calibration');
  for (const c of calibration) requireThat(time(c.evaluation_cutoff) < time(final.forecast_cutoff), 'Calibration evidence must mature before final forecast');
  // The scoring/eligibility policy is fixed. Membership may change across years,
  // but each period has its own hash and all candidates use that same ledger.
  const policy = o => hash({format: o.format, scoring: o.scoring, eligibility_rule: o.eligibility_rule});
  requireThat(origins.every(o => policy(o) === policy(final)), 'Changed evaluation policy/format/scoring');
  const birth = input.birth || {};
  for (const b of Object.values(birth)) {
    bind(b, records);
    requireThat(b && typeof b.value === 'string' && Number.isFinite(Date.parse(b.value)) && sources.has(b.source_id) && time(b.available_at) <= time(final.forecast_cutoff), 'Future or unversioned birth feature');
  }
  const development = [], selectionRows = [];
  for (const o of [...select].sort((a, b) => a.target_season - b.target_season)) {
    const predictions = predict(o, rows, birth), joined = attachOutcomes(o, predictions.rows, o.outcomes, o.evaluation_cutoff, sources, records);
    selectionRows.push(...predictionRows(o, joined.ledger));
    development.push({origin: o.id, stage: 'selection', training: predictions, missingness: joined.missingness, candidate_ledger: joined.ledger});
  }
  const selection = M.compare(selectionRows, select.map(o => o.target_season));
  const calibrationRows = [];
  for (const o of [...calibration].sort((a, b) => a.target_season - b.target_season)) {
    const predictions = predict(o, rows, birth, selection), joined = attachOutcomes(o, predictions.rows, o.outcomes, o.evaluation_cutoff, sources, records);
    calibrationRows.push(...predictionRows(o, joined.ledger, true));
    development.push({origin: o.id, stage: 'calibration', training: predictions, missingness: joined.missingness, result: summarize(o, joined.ledger)});
  }
  const bands = M.uncertainty(calibrationRows, selection), finalPredictions = predict(final, rows, birth, selection);
  for (const row of finalPredictions.rows) for (const band of bands.filter(b => b.position === row.position)) {
    const value = row.projected_stats[band.target];
    if (Number.isFinite(value)) row.intervals[band.target] = {p80_low: round(Math.max(0, value - band.p80)), p80_high: round(value + band.p80),
      p90_low: round(Math.max(0, value - band.p90)), p90_high: round(value + band.p90), type: 'historical_residual_band', calibrated_probability: false};
  }
  const artifact = {version: VERSION, data_kind: input.data_kind, frozen_at: input.frozen_at, input_sha256: hash(input), source_manifest: manifest,
    code_identity: codeIdentity(), model_candidates: CANDIDATES, input_missingness: missingness, origins, selection, uncertainty_construction: bands,
    limitations: ['Existing one-season controls only; no dynasty model or full-scoring forecast is implemented.',
      'Observed final metrics condition on observed outcomes and finite predictions; all other eligible rows remain in population counts.',
      'Legacy sanitation includes nonnegative clipping; saved endpoints and forecasts include this behavior. Signed source measurements are preserved.',
      'Ridge missing predictors use training-column means; missing targets are never imputed.',
      'No real data accuracy, externally calibrated probability, data rights, or publication approval follows from a synthetic fixture.'],
    development, final_forecast: {origin: final, ...finalPredictions}, final_untouched_evaluation: {status: 'awaiting_separate_outcomes', result: null},
    claims: {allowed_after_assessment: ['historical_error_exact_set', 'observed_coverage_exact_set', 'ordinal_performance_exact_unit'], prohibited: PROHIBITED,
      heuristic_confidence: true, synthetic_is_accuracy_evidence: false, prediction_provenance: 'Caller must independently retain and timestamp this hash before outcomes; hash alone is not historical publication proof.'}};
  return {...artifact, artifact_sha256: hash(artifact)};
}
function verifyFrozen(frozen) {
  const {artifact_sha256, ...payload} = frozen;
  requireThat(artifact_sha256 === hash(payload), 'Frozen forecast hash mismatch');
  requireThat(frozen.version === VERSION, 'Unsupported frozen evaluation');
  requireThat(frozen.final_forecast.origin.universe.id === universeId(frozen.final_forecast.origin), 'Changed frozen universe');
}
function assess(frozen, assessment) {
  verifyFrozen(frozen);
  assertClaims(assessment.requested_claims || []);
  const manifest = sourceManifest(assessment.sources), sources = new Set(manifest.map(s => s.id)), records = sourceRecords(assessment.sources);
  requireThat(assessment.forecast_sha256 === frozen.artifact_sha256, 'Assessment must bind exact saved forecast');
  const origin = frozen.final_forecast.origin;
  requireThat(assessment.universe_id === origin.universe.id, 'Changed assessment universe');
  const joined = attachOutcomes(origin, frozen.final_forecast.rows, assessment.outcomes, assessment.evaluation_cutoff, sources, records);
  const result = summarize(origin, joined.ledger), intervalGroups = new Map();
  for (const row of joined.ledger) for (const [target, band] of Object.entries(row.intervals)) {
    const id = `${row.position}|${target}`;
    if (!intervalGroups.has(id)) intervalGroups.set(id, []);
    intervalGroups.get(id).push({actual: row.actual[target], band, cohorts: row.cohorts});
  }
  const coverage = [...intervalGroups].sort(([a], [b]) => a.localeCompare(b)).map(([id, rows]) => {
    const [position, target] = id.split('|'), observed = rows.filter(r => Number.isFinite(r.actual));
    const members = origin.universe.members.filter(m => m.position === position);
    return {position, target, eligible_n: members.length, interval_abstentions: members.length - rows.length,
      forecast_n: rows.length, unknown_outcomes: rows.length - observed.length, n: observed.length,
      cohorts: Object.fromEntries([...new Set(members.flatMap(m => m.cohorts))].sort().map(cohort => {
        const forecasts = rows.filter(r => r.cohorts.includes(cohort)), scored = forecasts.filter(r => Number.isFinite(r.actual));
        return [cohort, {eligible: members.filter(m => m.cohorts.includes(cohort)).length, forecast_n: forecasts.length, n: scored.length,
          p80_hits: scored.filter(r => r.actual >= r.band.p80_low && r.actual <= r.band.p80_high).length,
          p90_hits: scored.filter(r => r.actual >= r.band.p90_low && r.actual <= r.band.p90_high).length}];
      })),
      levels: Object.fromEntries(['p80', 'p90'].map(level => {
        const hits = observed.filter(r => r.actual >= r.band[`${level}_low`] && r.actual <= r.band[`${level}_high`]).length;
        return [level, {hits, n: observed.length, observed_coverage: observed.length ? hits / observed.length : null,
          mean_width: observed.length ? observed.reduce((sum, r) => sum + r.band[`${level}_high`] - r.band[`${level}_low`], 0) / observed.length : null}];
      })), calibrated_probability: false, uncertainty_note: 'One temporal origin; dependent player/stat samples. No externally calibrated probability claim.'};
  });
  const out = {version: VERSION, forecast_sha256: frozen.artifact_sha256, assessment_code_identity: codeIdentity(), source_manifest: manifest, assessment_sha256: hash(assessment),
    evaluation_cutoff: assessment.evaluation_cutoff, training_cutoff: origin.forecast_cutoff, universe_id: origin.universe.id,
    evidence_role: frozen.data_kind === 'synthetic' ? 'synthetic_disjoint_final_test' : 'later_outcomes_for_frozen_forecast_requires_independent_timestamp_verification',
    final_untouched_evaluation: result, uncertainty_evaluation: coverage, outcome_missingness: joined.missingness, claims: frozen.claims};
  return {...out, artifact_sha256: hash(out)};
}
module.exports = {VERSION, CANDIDATES, canonical, hash, universeId, freeze, assess, verifyFrozen, assertClaims};
