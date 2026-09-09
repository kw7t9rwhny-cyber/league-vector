(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorRankingSnapshotV1 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "lv-ranking-snapshot/v1";
  const FORMATS = Object.freeze(["dynasty-1qb", "dynasty-superflex"]);
  const POSITIONS = ["QB", "RB", "WR", "TE"];
  const REASONS = ["insufficient_history", "rookie_method_unavailable", "identity_unresolved", "source_unavailable", "unsupported_position", "required_input_missing", "method_unavailable", "outside_eligible_universe"];
  const GAPS = ["missing_age", "missing_team", "missing_change_condition", "optional_input_missing", "nonblocking_disagreement"];
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const ASSUMPTIONS = freeze(Object.fromEntries(FORMATS.map(format => [format, {
    id: `lv-pilot-${format}/v1`, league_size: 12,
    lineup: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 2, SUPERFLEX: format === FORMATS[1] ? 1 : 0 },
    scoring: { reception: 1, rushing_yard: 0.1, receiving_yard: 0.1, rushing_td: 6, receiving_td: 6, passing_yard: 0.04, passing_td: 4, interception: -2, lost_fumble: -2, two_point_conversion: 2 },
    horizon: "Multi-season dynasty player preference as of the data cutoff",
    limitations: "Reference lineup; neutral roster needs; no TE premium, bonuses, custom scoring or trade-price interpretation."
  }])));

  function fail(message) { const e = new Error(message); e.code = "invalid_snapshot"; throw e; }
  function check(condition, message) { if (!condition) fail(message); }
  function exact(value, keys, label) {
    check(value !== null && typeof value === "object" && !Array.isArray(value), `${label}: object required`);
    check(Object.keys(value).sort().join("|") === [...keys].sort().join("|"), `${label}: missing or unknown field`);
  }
  function text(value, label, max = 240) {
    check(typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value), `${label}: invalid text`);
  }
  function token(value, label) { text(value, label, 128); check(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value), `${label}: invalid identifier`); }
  function one(value, choices, label) { check(choices.includes(value), `${label}: unsupported state`); }
  function integer(value, label, min = 0) { check(Number.isSafeInteger(value) && value >= min && !Object.is(value, -0), `${label}: invalid integer`); }
  function list(value, label, max = 10000, min = 0) { check(Array.isArray(value) && value.length >= min && value.length <= max, `${label}: invalid list`); }
  function unique(values, label) { check(new Set(values).size === values.length, `${label}: duplicate identity`); }
  function strings(value, label, max = 10000, min = 0) { list(value, label, max, min); value.forEach(v => text(v, label)); unique(value, label); }
  function timestamp(value, label) {
    check(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), `${label}: canonical UTC timestamp required`);
    const n = Date.parse(value);
    check(Number.isFinite(n) && new Date(n).toISOString() === value, `${label}: invalid timestamp`);
    return n;
  }
  function digestText(value, label) { check(typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value), `${label}: invalid SHA-256`); }
  function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function lexical(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
    return value;
  }
  function canonical(value) { return JSON.stringify(stable(value)); }

  // Reject non-JSON state before reading any fields or invoking getters/toJSON.
  function jsonData(value, ancestors = new Set(), depth = 0) {
    check(depth < 64, "JSON nesting limit");
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "string") {
      for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff) { const next = value.charCodeAt(++i); check(next >= 0xdc00 && next <= 0xdfff, "unpaired surrogate"); }
        else check(c < 0xdc00 || c > 0xdfff, "unpaired surrogate");
      }
      return;
    }
    if (typeof value === "number") { check(Number.isFinite(value) && !Object.is(value, -0), "noncanonical number"); return; }
    check(typeof value === "object" && !ancestors.has(value), "non-JSON value or cycle");
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, "non-JSON prototype");
    const keys = Reflect.ownKeys(value);
    check(keys.every(k => typeof k === "string"), "symbol key");
    if (array) check(keys.length === value.length + 1 && keys.includes("length"), "sparse or decorated array");
    ancestors.add(value);
    for (const key of keys) {
      if (array && key === "length") continue;
      check(!["__proto__", "constructor", "prototype"].includes(key), "unsafe key");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      check(descriptor.enumerable && Object.hasOwn(descriptor, "value"), "accessor or hidden field");
      jsonData(key, ancestors, depth + 1);
      jsonData(descriptor.value, ancestors, depth + 1);
    }
    ancestors.delete(value);
  }

  function validateMethod(method) {
    exact(method, ["id", "version", "summary", "components", "limitations"], "method");
    token(method.id, "method id"); token(method.version, "method version"); text(method.summary, "method summary", 500);
    list(method.components, "components", 12, 1); unique(method.components.map(c => c.id), "component");
    method.components.forEach(c => {
      exact(c, ["id", "version", "label", "required_fields"], "component");
      token(c.id, "component id"); token(c.version, "component version"); text(c.label, "component label", 60);
      strings(c.required_fields, "required_fields", 32, 1); c.required_fields.forEach(f => token(f, "input field"));
    });
    list(method.limitations, "method limitations", 12, 1); unique(method.limitations.map(l => l.id), "limitation");
    method.limitations.forEach(l => {
      exact(l, ["id", "text", "reviewed"], "limitation"); token(l.id, "limitation id"); text(l.text, "limitation text", 300); check(l.reviewed === true, "unreviewed limitation");
    });
  }
  function validateUniverse(universe) {
    exact(universe, ["id", "definition", "supported_positions", "eligible_player_ids", "coverage_count", "exclusions"], "universe");
    token(universe.id, "universe id"); text(universe.definition, "universe definition", 500);
    strings(universe.supported_positions, "positions", 4, 4);
    check([...universe.supported_positions].sort().join() === [...POSITIONS].sort().join(), "unsupported positions");
    strings(universe.eligible_player_ids, "eligible player IDs"); universe.eligible_player_ids.forEach(id => token(id, "eligible ID"));
    integer(universe.coverage_count, "coverage count"); check(universe.coverage_count === universe.eligible_player_ids.length, "coverage count mismatch");
    strings(universe.exclusions, "exclusions", 32);
  }
  function rankedOrder(entries) {
    return [...entries].sort((a, b) => (a.rank === null) - (b.rank === null) || (a.rank || 0) - (b.rank || 0) || lexical(a.player_id, b.player_id));
  }
  function validateRanks(entries, universe) {
    unique(entries.map(e => e.player_id), "player");
    const ranked = rankedOrder(entries.filter(e => e.ranking_status === "RANKED"));
    check(canonical(ranked.map(e => e.player_id).sort()) === canonical([...universe.eligible_player_ids].sort()), "eligible universe mismatch");
    ranked.forEach((e, index) => {
      integer(e.rank, "rank", 1);
      check(e.rank === index + 1 || (index > 0 && e.rank === ranked[index - 1].rank), "broken competition rank sequence");
    });
  }
  function validateValue(value) {
    exact(value, ["state", "value"], "fact value"); one(value.state, ["KNOWN", "MISSING", "UNKNOWN", "UNSUPPORTED"], "fact value state");
    if (value.state !== "KNOWN") check(value.value === null, "absent fact must be null, never zero");
    else {
      check(["number", "boolean", "string"].includes(typeof value.value), "known fact needs a value");
      if (typeof value.value === "string") text(value.value, "observed value", 80);
    }
  }
  function validatePrevious(previous, current) {
    if (previous === null) return;
    exact(previous, ["run_id", "artifact_id", "published_at", "data_cutoff", "method", "formats"], "previous run");
    token(previous.run_id, "previous run id"); check(previous.run_id !== current.run_id, "duplicate run identity"); digestText(previous.artifact_id, "previous artifact");
    check(timestamp(previous.published_at, "prior publication") < timestamp(current.generated_at, "generation"), "prior publication must precede generation");
    check(timestamp(previous.data_cutoff, "prior cutoff") <= timestamp(current.data_cutoff, "cutoff"), "prior cutoff after current");
    check(previous.data_cutoff <= previous.published_at, "prior cutoff after publication"); validateMethod(previous.method);
    exact(previous.formats, FORMATS, "previous formats");
    for (const format of FORMATS) {
      const board = previous.formats[format];
      exact(board, ["assumptions_id", "universe", "entries"], "previous board"); token(board.assumptions_id, "prior assumptions"); validateUniverse(board.universe);
      list(board.entries, "prior entries");
      board.entries.forEach(e => {
        exact(e, ["player_id", "rank", "ranking_status", "facts"], "prior entry"); token(e.player_id, "prior player");
        one(e.ranking_status, ["RANKED", "NOT_RANKED"], "prior rank state");
        if (e.ranking_status === "RANKED") integer(e.rank, "prior rank", 1); else check(e.rank === null, "prior unsupported rank");
        list(e.facts, "prior facts", 64); unique(e.facts.map(f => f.field), "prior fact field");
        e.facts.forEach(f => { exact(f, ["field", "value"], "prior fact"); token(f.field, "prior field"); validateValue(f.value); });
        if (e.ranking_status === "RANKED") for (const field of new Set(previous.method.components.flatMap(c => c.required_fields))) {
          check(e.facts.some(f => f.field === field && f.value.state === "KNOWN"), "prior ranked input missing");
        }
      });
      validateRanks(board.entries, board.universe);
    }
  }
  function normalUniverse(u) { return { ...u, supported_positions: [...u.supported_positions].sort(), eligible_player_ids: [...u.eligible_player_ids].sort(), exclusions: [...u.exclusions].sort() }; }
  function normalMethod(m) { return { ...m, components: m.components.map(c => ({ ...c, required_fields: [...c.required_fields].sort() })), limitations: [...m.limitations].sort((a, b) => lexical(a.id, b.id)) }; }
  function historyFor(snapshot, format, entry) {
    const empty = { previous_rank: null, changed_fact_refs: [] };
    if (entry.ranking_status === "NOT_RANKED") return { state: "NOT_RANKED", ...empty };
    const prev = snapshot.previous_run;
    if (!prev) return { state: "FIRST_RUN", ...empty };
    const before = prev.formats[format], board = snapshot.formats[format];
    if (canonical(normalMethod(prev.method)) !== canonical(normalMethod(snapshot.method)) || before.assumptions_id !== board.assumptions_id) return { state: "NOT_COMPARABLE", ...empty };
    const old = before.entries.find(e => e.player_id === entry.player_id);
    if (!old || old.ranking_status !== "RANKED") return { state: "NEW_PLAYER", ...empty };
    if (canonical(normalUniverse(before.universe)) !== canonical(normalUniverse(board.universe))) return { state: "NOT_COMPARABLE", ...empty };
    const changed = entry.facts.filter(f => {
      const oldFact = old.facts.find(p => p.field === f.field);
      return !oldFact || canonical(oldFact.value) !== canonical(f.value);
    }).map(f => f.id).sort();
    return { state: "COMPARABLE", previous_rank: old.rank, changed_fact_refs: changed };
  }
  function sourceEligible(source, snapshot) {
    return snapshot.data_kind === "SYNTHETIC" ? source.delivery_state === "SYNTHETIC_ONLY" : source.delivery_state === "ELIGIBLE";
  }
  function validateEntry(entry, snapshot, format, sources) {
    exact(entry, ["player_id", "name", "aliases", "identity_state", "position", "team", "team_state", "status", "age", "identity_evidence_refs", "ranking_status", "rank", "evidence_state", "unsupported_reason", "evidence_gaps", "facts", "drivers", "primary_reason", "limitations", "change_conditions", "history"], "entry");
    token(entry.player_id, "player id"); check(entry.player_id.startsWith("lv:"), "LV player id required"); text(entry.name, "player name", 100); strings(entry.aliases, "aliases", 16);
    if (snapshot.data_kind === "SYNTHETIC") check(entry.player_id.startsWith("lv:synthetic:") && entry.name.startsWith("Synthetic "), "synthetic identity label required");
    one(entry.identity_state, ["VERIFIED", "UNRESOLVED"], "identity state"); one(entry.position, [...POSITIONS, "OTHER", "UNKNOWN"], "position");
    one(entry.team_state, ["KNOWN", "UNKNOWN", "FREE_AGENT"], "team state");
    if (entry.team_state === "KNOWN") text(entry.team, "team", 60); else check(entry.team === null, "absent team must be null");
    one(entry.status, ["ACTIVE", "RESERVE", "UNKNOWN", "RETIRED"], "player status");
    if (entry.age !== null) {
      exact(entry.age, ["years", "as_of"], "age"); check(typeof entry.age.years === "number" && entry.age.years > 0 && entry.age.years <= 60, "invalid age");
      check(timestamp(entry.age.as_of, "age as of") <= timestamp(snapshot.data_cutoff, "cutoff"), "age after cutoff");
    }
    strings(entry.identity_evidence_refs, "identity evidence", 12, 1);
    entry.identity_evidence_refs.forEach(id => check(sources.has(id), "missing identity source"));
    one(entry.ranking_status, ["RANKED", "NOT_RANKED"], "ranking status"); one(entry.evidence_state, ["DOCUMENTED", "LIMITED", "UNAVAILABLE"], "evidence state");
    strings(entry.evidence_gaps, "evidence gaps", GAPS.length); entry.evidence_gaps.forEach(g => one(g, GAPS, "evidence gap"));
    list(entry.facts, "facts", 64); unique(entry.facts.map(f => f.id), "fact"); unique(entry.facts.map(f => f.field), "fact field");
    const facts = new Map();
    entry.facts.forEach(f => {
      exact(f, ["id", "run_id", "format", "player_id", "field", "value", "unit", "period", "as_of", "source_id"], "fact");
      token(f.id, "fact id"); token(f.field, "fact field");
      check(f.run_id === snapshot.run_id && f.format === format && f.player_id === entry.player_id, "cross-run/format/player evidence");
      validateValue(f.value); if (f.unit !== null) text(f.unit, "unit", 40); text(f.period, "period", 80);
      const source = sources.get(f.source_id); check(source, "missing fact source");
      check(timestamp(f.as_of, "fact as of") <= timestamp(source.data_cutoff, "source cutoff"), "fact after source cutoff");
      facts.set(f.id, f);
    });
    const components = new Map(snapshot.method.components.map(c => [c.id, c]));
    list(entry.drivers, "drivers", 9); unique(entry.drivers.map(d => d.id), "driver");
    entry.drivers.forEach(d => {
      exact(d, ["id", "component_id", "direction", "use", "fact_refs"], "driver"); token(d.id, "driver id"); check(components.has(d.component_id), "unknown method component");
      one(d.direction, ["supports", "hurts", "neutral", "unknown"], "driver direction"); one(d.use, ["ranking", "context"], "driver use"); strings(d.fact_refs, "driver facts", 3, 1);
      d.fact_refs.forEach(id => {
        const f = facts.get(id); check(f, "unresolved driver fact");
        if (d.use === "ranking") check(f.value.state === "KNOWN" && components.get(d.component_id).required_fields.includes(f.field) && sourceEligible(sources.get(f.source_id), snapshot), "ineligible ranking driver");
      });
    });
    ["supports", "hurts"].forEach(direction => check(entry.drivers.filter(d => d.direction === direction).length <= 3, "too many driver factors"));
    strings(entry.limitations, "entry limitations", 3);
    entry.limitations.forEach(id => check(snapshot.method.limitations.some(l => l.id === id), "unresolved limitation"));
    list(entry.change_conditions, "change conditions", 2); unique(entry.change_conditions.map(c => `${c.fact_id}/${c.direction}`), "condition");
    entry.change_conditions.forEach(c => {
      exact(c, ["fact_id", "direction", "basis_driver_id", "kind", "reviewed"], "condition");
      const f = facts.get(c.fact_id), d = entry.drivers.find(driver => driver.id === c.basis_driver_id);
      check(f && d && d.fact_refs.includes(f.id), "condition basis missing");
      one(c.direction, ["increase", "decrease", "becomes_known"], "condition direction"); one(c.kind, ["METHOD", "EDITORIAL"], "condition kind"); check(c.reviewed === true, "unreviewed condition");
      if (c.kind === "METHOD") check(d.use === "ranking", "method condition requires ranking basis");
      if (c.direction !== "becomes_known") check(f.value.state === "KNOWN" && typeof f.value.value === "number", "numeric condition needs known observation");
      else check(f.value.state !== "KNOWN", "becomes_known requires missing observation");
    });
    if (entry.ranking_status === "NOT_RANKED") {
      check(entry.rank === null && entry.primary_reason === null && entry.evidence_state === "UNAVAILABLE" && entry.drivers.length === 0 && entry.change_conditions.length === 0, "unsupported/rank contradiction");
      one(entry.unsupported_reason, REASONS, "unsupported reason");
      if (entry.identity_state === "UNRESOLVED") check(entry.unsupported_reason === "identity_unresolved", "unresolved identity reason required");
      if (entry.unsupported_reason === "identity_unresolved") check(entry.identity_state === "UNRESOLVED", "identity reason contradiction");
      if (entry.unsupported_reason === "unsupported_position") check(!POSITIONS.includes(entry.position), "position reason contradiction");
    } else {
      integer(entry.rank, "rank", 1); check(entry.unsupported_reason === null && entry.identity_state === "VERIFIED" && POSITIONS.includes(entry.position), "ranked identity/state missing");
      check(entry.status !== "RETIRED", "retired player not eligible");
      check(entry.identity_evidence_refs.every(id => sourceEligible(sources.get(id), snapshot)), "ineligible identity source");
      for (const field of new Set(snapshot.method.components.flatMap(c => c.required_fields))) {
        const f = entry.facts.find(fact => fact.field === field);
        check(f && f.value.state === "KNOWN" && sourceEligible(sources.get(f.source_id), snapshot), "required ranking input missing/ineligible");
      }
      exact(entry.primary_reason, ["template_id", "driver_id"], "primary reason"); check(entry.primary_reason.template_id === "observed-support/v1", "unknown reason template");
      const primary = entry.drivers.find(d => d.id === entry.primary_reason.driver_id);
      check(primary && primary.direction === "supports" && primary.use === "ranking", "primary reason needs supporting ranking driver");
      check(entry.limitations.length >= 1, "required method limitation missing");
      const requiredGaps = [];
      if (entry.age === null) requiredGaps.push("missing_age");
      if (entry.team_state === "UNKNOWN") requiredGaps.push("missing_team");
      if (entry.change_conditions.length === 0) requiredGaps.push("missing_change_condition");
      if (entry.facts.some(f => f.value.state !== "KNOWN")) requiredGaps.push("optional_input_missing");
      check(requiredGaps.every(g => entry.evidence_gaps.includes(g)), "missing evidence gap disclosure");
      check(entry.evidence_gaps.every(g => g === "nonblocking_disagreement" || requiredGaps.includes(g)), "contradictory evidence gap");
      check(entry.evidence_state === (entry.evidence_gaps.length ? "LIMITED" : "DOCUMENTED"), "evidence completeness contradiction");
      check(entry.facts.every(f => sourceEligible(sources.get(f.source_id), snapshot)), "ineligible displayed evidence");
      check(renderReasonUnchecked(snapshot, entry).length <= 180, "primary reason exceeds 180 characters");
    }
    exact(entry.history, ["state", "previous_rank", "changed_fact_refs"], "history"); strings(entry.history.changed_fact_refs, "changed facts", 64);
    check(canonical({ ...entry.history, changed_fact_refs: [...entry.history.changed_fact_refs].sort() }) === canonical(historyFor(snapshot, format, entry)), "contradictory prior-run history");
  }

  function validateSnapshotData(snapshot) {
    jsonData(snapshot);
    exact(snapshot, ["schema_version", "run_id", "data_kind", "generated_at", "published_at", "data_cutoff", "valid_until", "publication", "method", "sources", "formats", "previous_run"], "snapshot");
    check(snapshot.schema_version === VERSION, "unsupported schema version"); token(snapshot.run_id, "run id"); one(snapshot.data_kind, ["SYNTHETIC", "REAL"], "data kind");
    const generated = timestamp(snapshot.generated_at, "generated_at"), cutoff = timestamp(snapshot.data_cutoff, "data_cutoff"), expiry = timestamp(snapshot.valid_until, "valid_until");
    check(cutoff <= generated && generated < expiry, "invalid snapshot time order");
    exact(snapshot.publication, ["state", "rights_state", "reference"], "publication");
    one(snapshot.publication.state, ["STAGED", "PUBLISHED", "WITHDRAWN"], "publication state"); one(snapshot.publication.rights_state, ["SYNTHETIC_ONLY", "UNRESOLVED", "CLEARED", "REVOKED"], "rights state"); text(snapshot.publication.reference, "publication reference", 500);
    if (snapshot.publication.state === "STAGED") check(snapshot.published_at === null, "staged publication timestamp must be null");
    else check(timestamp(snapshot.published_at, "published_at") >= generated && timestamp(snapshot.published_at, "published_at") < expiry, "invalid publication time");
    if (snapshot.data_kind === "SYNTHETIC") check(snapshot.publication.rights_state === "SYNTHETIC_ONLY", "synthetic rights required");
    else {
      check(snapshot.publication.rights_state !== "SYNTHETIC_ONLY", "real/synthetic rights contradiction");
      if (snapshot.publication.state === "PUBLISHED") check(snapshot.publication.rights_state === "CLEARED", "publication rights closed");
      if (snapshot.publication.rights_state === "REVOKED") check(snapshot.publication.state === "WITHDRAWN", "revoked publication must be withdrawn");
    }
    validateMethod(snapshot.method);
    list(snapshot.sources, "sources", 64, 1); unique(snapshot.sources.map(s => s.source_id), "source");
    const sources = new Map();
    snapshot.sources.forEach(s => {
      exact(s, ["source_id", "manifest_ref", "content_hash", "observed_at", "data_cutoff", "valid_until", "delivery_state", "eligibility_ref", "attribution"], "source");
      token(s.source_id, "source id"); text(s.manifest_ref, "manifest reference", 500); digestText(s.content_hash, "source content hash"); text(s.eligibility_ref, "eligibility reference", 500); text(s.attribution, "attribution", 500);
      const observed = timestamp(s.observed_at, "source observation"), sourceCutoff = timestamp(s.data_cutoff, "source cutoff"), sourceExpiry = timestamp(s.valid_until, "source validity");
      check(sourceCutoff <= cutoff && sourceCutoff <= observed && observed <= generated && sourceExpiry >= expiry, "source timestamp/cutoff/expiry contradiction");
      one(s.delivery_state, ["SYNTHETIC_ONLY", "ELIGIBLE", "BLOCKED", "REVOKED"], "source delivery");
      if (snapshot.data_kind === "SYNTHETIC") check(s.delivery_state === "SYNTHETIC_ONLY", "synthetic source required");
      else check(s.delivery_state !== "SYNTHETIC_ONLY", "real data synthetic source");
      if (snapshot.publication.state === "PUBLISHED") check(sourceEligible(s, snapshot), "ineligible published source");
      sources.set(s.source_id, s);
    });
    validatePrevious(snapshot.previous_run, snapshot); exact(snapshot.formats, FORMATS, "formats");
    for (const format of FORMATS) {
      const board = snapshot.formats[format]; exact(board, ["assumptions_id", "universe", "entries"], "board");
      check(board.assumptions_id === ASSUMPTIONS[format].id, "unsupported format assumptions"); validateUniverse(board.universe); list(board.entries, "entries");
      board.entries.forEach(e => validateEntry(e, snapshot, format, sources)); validateRanks(board.entries, board.universe);
    }
    const allEntries = FORMATS.flatMap(format => snapshot.formats[format].entries);
    unique(allEntries.flatMap(e => e.facts.map(f => f.id)), "run fact");
    unique(allEntries.flatMap(e => e.drivers.map(d => d.id)), "run driver");
    const first = new Map(snapshot.formats[FORMATS[0]].entries.map(e => [e.player_id, e]));
    const identityKeys = ["player_id", "name", "aliases", "identity_state", "position", "team", "team_state", "status", "age", "identity_evidence_refs"];
    snapshot.formats[FORMATS[1]].entries.forEach(e => {
      const other = first.get(e.player_id);
      if (other) for (const key of identityKeys) {
        const a = Array.isArray(e[key]) ? [...e[key]].sort() : e[key], b = Array.isArray(other[key]) ? [...other[key]].sort() : other[key];
        check(canonical(a) === canonical(b), "conflicting player identity across formats");
      }
    });
    return true;
  }

  function validateSnapshot(snapshot) {
    try { return validateSnapshotData(snapshot); }
    catch (error) {
      if (error.code === "invalid_snapshot") throw error;
      fail("malformed snapshot structure");
    }
  }

  function normalPrior(previous) {
    if (previous === null) return null;
    const p = copy(previous); p.method = normalMethod(p.method);
    for (const format of FORMATS) {
      const b = p.formats[format]; b.universe = normalUniverse(b.universe);
      b.entries.sort((a, b) => lexical(a.player_id, b.player_id)); b.entries.forEach(e => e.facts.sort((a, b) => lexical(a.field, b.field)));
    }
    return p;
  }
  function canonicalizeSnapshot(snapshot) {
    validateSnapshot(snapshot);
    const s = copy(snapshot); s.method = normalMethod(s.method); s.sources.sort((a, b) => lexical(a.source_id, b.source_id)); s.previous_run = normalPrior(s.previous_run);
    const componentOrder = new Map(s.method.components.map((c, i) => [c.id, i]));
    for (const format of FORMATS) {
      const b = s.formats[format]; b.universe = normalUniverse(b.universe); b.entries = rankedOrder(b.entries);
      b.entries.forEach(e => {
        ["aliases", "identity_evidence_refs", "evidence_gaps", "limitations"].forEach(k => e[k].sort());
        e.facts.sort((a, b) => lexical(a.id, b.id)); e.drivers.sort((a, b) => componentOrder.get(a.component_id) - componentOrder.get(b.component_id) || lexical(a.id, b.id));
        e.drivers.forEach(d => d.fact_refs.sort()); e.change_conditions.sort((a, b) => lexical(`${a.fact_id}/${a.direction}`, `${b.fact_id}/${b.direction}`)); e.history.changed_fact_refs.sort();
      });
    }
    return canonical(s);
  }
  function parseCanonicalSnapshot(bytes) {
    check(typeof bytes === "string", "canonical UTF-8 text required");
    let snapshot;
    try { snapshot = JSON.parse(bytes); } catch { fail("malformed canonical JSON"); }
    check(canonicalizeSnapshot(snapshot) === bytes, "noncanonical serialization");
    return freeze(snapshot);
  }
  async function snapshotArtifactId(snapshot) {
    const bytes = new TextEncoder().encode(canonicalizeSnapshot(snapshot));
    check(globalThis.crypto && globalThis.crypto.subtle, "SHA-256 runtime unavailable");
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return `sha256:${Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("")}`;
  }
  async function createPreviousRun(snapshot) {
    validateSnapshot(snapshot); check(snapshot.publication.state === "PUBLISHED", "previous run must be published");
    // Freeze the bytes before awaiting hashing so caller mutation cannot alter the summary.
    const s = parseCanonicalSnapshot(canonicalizeSnapshot(snapshot));
    const prior = { run_id: s.run_id, artifact_id: await snapshotArtifactId(s), published_at: s.published_at, data_cutoff: s.data_cutoff, method: copy(s.method), formats: {} };
    for (const format of FORMATS) {
      const b = s.formats[format];
      prior.formats[format] = { assumptions_id: b.assumptions_id, universe: copy(b.universe), entries: b.entries.map(e => ({ player_id: e.player_id, rank: e.rank, ranking_status: e.ranking_status, facts: e.facts.map(f => ({ field: f.field, value: copy(f.value) })) })) };
    }
    return freeze(normalPrior(prior));
  }
  async function validateSnapshotCatalog(snapshots) {
    list(snapshots, "snapshot catalog"); const frozen = snapshots.map(s => parseCanonicalSnapshot(canonicalizeSnapshot(s)));
    unique(frozen.map(s => s.run_id), "run");
    const byId = new Map(frozen.map(s => [s.run_id, s]));
    const published = frozen.filter(s => s.publication.state === "PUBLISHED").sort((a, b) => lexical(a.published_at, b.published_at));
    unique(published.map(s => s.published_at), "publication time");
    for (const s of frozen) {
      const earlier = published.filter(p => p.published_at < (s.published_at || s.generated_at) && p.run_id !== s.run_id).at(-1);
      check((earlier ? earlier.run_id : null) === (s.previous_run ? s.previous_run.run_id : null), "not immediately previous published run");
      if (s.previous_run) {
        const prior = byId.get(s.previous_run.run_id); check(prior, "prior artifact missing from catalog");
        check(canonical(normalPrior(s.previous_run)) === canonical(await createPreviousRun(prior)), "prior artifact/summary mismatch");
      }
    }
    return true;
  }
  function renderReasonUnchecked(snapshot, entry) {
    const d = entry.drivers.find(d => d.id === entry.primary_reason.driver_id), c = snapshot.method.components.find(c => c.id === d.component_id), f = entry.facts.find(f => f.id === [...d.fact_refs].sort()[0]);
    return `${c.label}: ${String(f.value.value)}${f.unit ? ` ${f.unit}` : ""} (${f.period}) supports the rank.`;
  }
  function renderPrimaryReason(snapshot, selection) {
    const entry = selectPlayer(snapshot, selection); return entry && entry.ranking_status === "RANKED" ? renderReasonUnchecked(snapshot, entry) : null;
  }
  function getRunState(snapshot, now) {
    validateSnapshot(snapshot); const time = timestamp(now, "decision time");
    if (snapshot.publication.state === "WITHDRAWN" || snapshot.publication.rights_state === "REVOKED") return "UNAVAILABLE";
    if (snapshot.data_kind === "REAL" && snapshot.publication.state !== "PUBLISHED") return "UNAVAILABLE";
    const anchor = snapshot.published_at || snapshot.generated_at;
    if (time < timestamp(anchor, "run start")) return "UNAVAILABLE";
    if (time >= Math.min(timestamp(snapshot.valid_until, "expiry"), timestamp(anchor, "run start") + WEEK)) return "OUTDATED";
    return snapshot.data_kind === "SYNTHETIC" ? "SYNTHETIC" : "AVAILABLE";
  }
  function selectedBoard(snapshot, selection) {
    validateSnapshot(snapshot); check(selection && selection.run_id === snapshot.run_id, "requested run unavailable"); one(selection.format, FORMATS, "requested format");
    check(snapshot.publication.state !== "WITHDRAWN" && !(snapshot.data_kind === "REAL" && snapshot.publication.state !== "PUBLISHED"), "run unavailable for display");
    return parseCanonicalSnapshot(canonicalizeSnapshot(snapshot)).formats[selection.format];
  }
  function selectPlayer(snapshot, selection) {
    const board = selectedBoard(snapshot, selection); token(selection.player_id, "requested player");
    const e = board.entries.find(e => e.player_id === selection.player_id); return e ? freeze(copy(e)) : null;
  }
  function nearbyAlternatives(snapshot, selection) {
    const board = selectedBoard(snapshot, selection), entry = selectPlayer(snapshot, selection);
    if (!entry || entry.ranking_status !== "RANKED") return Object.freeze([]);
    const entries = rankedOrder(board.entries.filter(e => e.ranking_status === "RANKED" && e.position === entry.position)), index = entries.findIndex(e => e.player_id === entry.player_id);
    const neighbors = [entries[index - 1], entries[index + 1]].filter(Boolean);
    if (neighbors.length < 2) {
      const edge = index === 0 ? entries[2] : entries[index - 2]; if (edge) neighbors.push(edge);
    }
    return freeze(copy(rankedOrder(neighbors)));
  }
  function comparePlayers(snapshot, selection) {
    try {
      selectedBoard(snapshot, selection); list(selection.player_ids, "comparison players", 2, 2); unique(selection.player_ids, "comparison player");
      const state = getRunState(snapshot, selection.now);
      if (["UNAVAILABLE", "OUTDATED"].includes(state)) return freeze({ state: "UNAVAILABLE", reason: state === "OUTDATED" ? "outdated_run" : "unavailable_run", players: [] });
      const players = selection.player_ids.map(player_id => selectPlayer(snapshot, { ...selection, player_id }));
      if (players.some(e => !e || e.ranking_status !== "RANKED")) return freeze({ state: "UNAVAILABLE", reason: "missing_or_not_ranked_player", players: [] });
      return freeze({ state: "NO_CLEAR_PREFERENCE", reason: players[0].rank === players[1].rank ? "exact_tie" : "no_pairwise_rule", players,
        assumptions: ASSUMPTIONS[selection.format], evidence_state: players.some(e => e.evidence_state === "LIMITED") ? "LIMITED" : "DOCUMENTED",
        limitations: players.map(e => e.limitations), change_conditions: players.map(e => e.change_conditions),
        disclosure: "The order alone does not establish a supported preference between these players. Ranks do not measure the size of the advantage." });
    } catch (error) {
      if (error.code !== "invalid_snapshot") throw error;
      return freeze({ state: "UNAVAILABLE", reason: "invalid_snapshot_or_selection", players: [] });
    }
  }
  return Object.freeze({ VERSION, FORMATS, ASSUMPTIONS, validateSnapshot, canonicalizeSnapshot, parseCanonicalSnapshot, snapshotArtifactId, createPreviousRun, validateSnapshotCatalog, renderPrimaryReason, getRunState, selectPlayer, nearbyAlternatives, comparePlayers });
});
