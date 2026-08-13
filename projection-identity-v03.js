(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorProjectionIdentity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "lv-projection-identity-v0.3.1";

  function clean(value) {
    return value == null ? "" : String(value).trim();
  }

  function canonicalLeagueVectorId(value, gsisId = null) {
    let id = clean(value);
    const gsis = clean(gsisId);
    while (id.startsWith("lv:lv:")) id = id.slice(3);
    if (!id && gsis) return `lv:gsis:${gsis}`;
    if (id.startsWith("gsis:")) return `lv:${id}`;
    if (gsis && id === gsis) return `lv:gsis:${gsis}`;
    return id || null;
  }

  function stableKey(record = {}) {
    const gsis = clean(record.gsis_id);
    if (gsis) return `gsis:${gsis}`;
    const lv = canonicalLeagueVectorId(record.league_vector_player_id, record.gsis_id);
    if (lv) return `lv:${lv}`;
    return null;
  }

  function canonicalizeRecord(record = {}) {
    return {
      ...record,
      sleeper_id: clean(record.sleeper_id),
      sleeper_aliases: [...new Set((record.sleeper_aliases || []).map(clean).filter(Boolean))],
      gsis_id: clean(record.gsis_id) || null,
      league_vector_player_id: canonicalLeagueVectorId(record.league_vector_player_id, record.gsis_id),
    };
  }

  function choosePrimary(records = []) {
    if (!records.length) return null;
    const scored = records.map((record) => {
      const active = record?.sleeper_player?.active === true ? 1 : 0;
      const hasTeam = clean(record?.sleeper_player?.team) ? 1 : 0;
      const exactGsis = record?.mapping?.method === "exact_gsis" ? 3 : 0;
      const exactSleeper = record?.mapping?.method === "exact_sleeper" ? 2 : 0;
      const verifiedFallback = record?.mapping?.method === "name_position_team" ? 1 : 0;
      return { record, score: exactGsis + exactSleeper + verifiedFallback + active + hasTeam };
    }).sort((a, b) => b.score - a.score || clean(a.record.sleeper_id).localeCompare(clean(b.record.sleeper_id), undefined, { numeric: true }));
    return scored[0].record;
  }

  function groupMappedCandidates(candidates = []) {
    const groups = new Map();
    const unresolved = [];
    for (const candidate of candidates) {
      const normalized = canonicalizeRecord(candidate);
      const key = stableKey(normalized);
      if (!key) {
        unresolved.push({ ...normalized, reason: "missing_stable_identity" });
        continue;
      }
      const rows = groups.get(key) || [];
      rows.push(normalized);
      groups.set(key, rows);
    }
    return { groups, unresolved };
  }

  function resolveAliases(candidates = []) {
    const { groups, unresolved } = groupMappedCandidates(candidates);
    const canonical = [];
    const aliasMap = {};
    const duplicateReport = [];

    for (const [key, rows] of groups) {
      const gsisIds = new Set(rows.map((row) => clean(row.gsis_id)).filter(Boolean));
      const lvIds = new Set(rows.map((row) => canonicalLeagueVectorId(row.league_vector_player_id, row.gsis_id)).filter(Boolean));
      if (gsisIds.size > 1 || lvIds.size > 1) {
        duplicateReport.push({
          stable_key: key,
          status: "unresolved_conflict",
          sleeper_ids: rows.map((row) => clean(row.sleeper_id)),
          gsis_ids: [...gsisIds],
          league_vector_player_ids: [...lvIds],
        });
        unresolved.push(...rows.map((row) => ({ ...row, reason: "conflicting_stable_ids" })));
        continue;
      }
      const primary = choosePrimary(rows);
      const aliases = rows.map((row) => clean(row.sleeper_id)).filter((id) => id && id !== clean(primary.sleeper_id));
      const normalizedPrimary = canonicalizeRecord({ ...primary, sleeper_aliases: aliases });
      canonical.push(normalizedPrimary);
      for (const alias of aliases) aliasMap[alias] = clean(primary.sleeper_id);
      if (rows.length > 1) {
        duplicateReport.push({
          stable_key: key,
          status: "resolved_aliases",
          canonical_sleeper_id: clean(primary.sleeper_id),
          sleeper_aliases: aliases,
          gsis_id: normalizedPrimary.gsis_id,
          league_vector_player_id: normalizedPrimary.league_vector_player_id,
          methods: Object.fromEntries(rows.map((row) => [clean(row.sleeper_id), row.mapping?.method || null])),
        });
      }
    }

    return { canonical, aliasMap, unresolved, duplicateReport };
  }

  function uniquenessAudit(records = []) {
    const seen = { sleeper: new Map(), gsis: new Map(), lv: new Map() };
    const duplicates = [];
    for (const source of records) {
      const record = canonicalizeRecord(source);
      const entries = [
        ["sleeper", record.sleeper_id],
        ["gsis", record.gsis_id],
        ["lv", record.league_vector_player_id],
      ];
      for (const [type, value] of entries) {
        if (!value) continue;
        if (seen[type].has(value)) duplicates.push({ type, value, first_sleeper_id: seen[type].get(value), sleeper_id: record.sleeper_id });
        else seen[type].set(value, record.sleeper_id);
      }
    }
    return { valid: duplicates.length === 0, duplicates };
  }

  function assertUnique(records = []) {
    const audit = uniquenessAudit(records);
    if (!audit.valid) {
      const sample = audit.duplicates.slice(0, 5).map((row) => `${row.type}:${row.value}`).join(", ");
      throw new Error(`Projection artifact uniqueness failed: ${sample}`);
    }
    return audit;
  }

  return {
    VERSION,
    canonicalLeagueVectorId,
    stableKey,
    canonicalizeRecord,
    choosePrimary,
    groupMappedCandidates,
    resolveAliases,
    uniquenessAudit,
    assertUnique,
  };
});
