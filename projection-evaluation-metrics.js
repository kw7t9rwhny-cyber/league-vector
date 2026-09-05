'use strict';

const B = require('./projection-benchmark-v08.js');
const BASELINE = 'weighted_603010';
const key = row => JSON.stringify([row.target_season, row.position, row.target, row.gsis_id]);
function unique(rows) {
  const seen = new Set();
  for (const row of rows) {
    if (!row.gsis_id || !row.position || !row.target || !Number.isInteger(row.target_season) || !row.model) throw new Error('Prediction identity/period required');
    const id = `${key(row)}|${row.model}`;
    if (seen.has(id)) throw new Error(`Duplicate prediction: ${id}`);
    seen.add(id);
    if (!Number.isFinite(row.prediction) || !Number.isFinite(row.actual)) throw new Error('Metrics require finite observed outcomes and predictions');
  }
}
function errors(rows) {
  const {spearman, ...stats} = B.metrics(rows);
  return stats;
}
function compare(predictions, folds) {
  unique(predictions);
  if (predictions.some(r => !folds.includes(r.target_season))) throw new Error('Selection received a row outside its declared selection window');
  const groups = new Map();
  for (const row of predictions) {
    const id = `${row.position}|${row.target}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).flatMap(([id, rows]) => {
    const models = [...new Set(rows.map(r => r.model))].sort();
    if (!models.includes(BASELINE)) return [];
    const byModel = new Map(models.map(m => [m, new Map(rows.filter(r => r.model === m).map(r => [key(r), r]))]));
    const keys = [...byModel.get(BASELINE).keys()].filter(k => models.every(m => byModel.get(m).has(k))).sort();
    for (const k of keys) if (new Set(models.map(m => byModel.get(m).get(k).actual)).size !== 1) throw new Error('Candidate outcomes differ');
    const paired = m => keys.map(k => byModel.get(m).get(k));
    const baseline = errors(paired(BASELINE));
    let selected = {model: BASELINE, ...baseline, improvement_pct: 0, fold_wins: 0};
    const candidates = models.map(model => {
      const matched = paired(model), stats = errors(matched);
      const wins = folds.filter(f => {
        const a = errors(matched.filter(r => r.target_season === f));
        const b = errors(paired(BASELINE).filter(r => r.target_season === f));
        return a.mae !== null && b.mae !== null && a.mae < b.mae;
      }).length;
      const improvement = baseline.mae > 0 ? 100 * (baseline.mae - stats.mae) / baseline.mae : null;
      if (improvement >= 2 && wins >= Math.ceil(folds.length / 2) && stats.mae < selected.mae) selected = {model, ...stats, improvement_pct: improvement, fold_wins: wins};
      return {model, ...stats, available_n: byModel.get(model).size, unmatched_n: byModel.get(model).size - keys.length, fold_wins: wins};
    });
    const age = candidates.find(c => c.model === 'ridge_age_v03'), noage = candidates.find(c => c.model === 'ridge_noage_v03');
    const [position, target] = id.split('|');
    return [{position, target, evidence_role: 'selection_only', selection_periods: [...folds].sort(), paired_keys: keys,
      baseline, selected, candidates, age_ablation: {with_age_mae: age?.mae ?? null, without_age_mae: noage?.mae ?? null,
        age_delta_mae: age?.mae != null && noage?.mae != null ? age.mae - noage.mae : null,
        preferred: age?.mae != null && noage?.mae != null ? (age.mae < noage.mae ? 'with_age' : 'without_age') : 'insufficient_evidence'},
      experimental: true, production_eligible: false}];
  });
}
function quantile(values, q) {
  const a = [...values].sort((x, y) => x - y);
  const i = (a.length - 1) * q, low = Math.floor(i), high = Math.ceil(i);
  return a.length ? a[low] + (a[high] - a[low]) * (i - low) : null;
}
function uncertainty(predictions, selection) {
  unique(predictions);
  return selection.flatMap(s => {
    const rows = predictions.filter(r => r.position === s.position && r.target === s.target && r.model === s.selected.model);
    const abs = rows.map(r => Math.abs(r.prediction - r.actual));
    if (abs.length < 10) return [];
    const radii = {p50: quantile(abs, .5), p80: quantile(abs, .8), p90: quantile(abs, .9)};
    return [{position: s.position, target: s.target, model: s.selected.model, n: abs.length, ...radii,
      evidence_role: 'residual_construction_only', construction_periods: [...new Set(rows.map(r => r.target_season))].sort(),
      construction_keys: rows.map(key).sort(), future_coverage_validated: false,
      construction_coverage: Object.fromEntries(Object.entries(radii).map(([name, radius]) => [name, abs.filter(v => v <= radius).length / abs.length]))}];
  });
}
function rankReport(rows) {
  const groups = new Map(), seen = new Set();
  for (const row of rows) {
    if (!Number.isInteger(row.target_season)) throw new Error('Ranking requires target season');
    if (typeof row.forecast_cutoff !== 'string' || !Number.isFinite(Date.parse(row.forecast_cutoff)) || !row.format || !row.universe_id || !row.position) throw new Error('Ranking requires forecast cutoff, format, universe and position');
    const unit = JSON.stringify([row.forecast_cutoff, row.target_season, row.format, row.universe_id, row.position]);
    const id = `${unit}|${row.gsis_id}`;
    if (!row.gsis_id || seen.has(id)) throw new Error('Duplicate player-season in ranking unit');
    seen.add(id);
    if (!Number.isFinite(row.predicted_points) || !Number.isFinite(row.actual_points)) throw new Error('Ranking requires finite scored rows');
    if (!groups.has(unit)) groups.set(unit, []);
    groups.get(unit).push(row);
  }
  const limits = {QB: [12, 24], RB: [12, 24, 36], WR: [12, 24, 36, 48], TE: [12, 24], DL: [12, 24], LB: [12, 24], DB: [12, 24]};
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([unit, group]) => {
    const [forecast_cutoff, target_season, format, universe_id, position] = JSON.parse(unit);
    const sort = field => [...group].sort((a, b) => b[field] - a[field] || a.gsis_id.localeCompare(b.gsis_id));
    const actual = sort('actual_points'), predicted = sort('predicted_points');
    let paired = 0, reversed = 0, tied = 0;
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const a = Math.sign(group[i].actual_points - group[j].actual_points), p = Math.sign(group[i].predicted_points - group[j].predicted_points);
      if (!a || !p) tied++; else { paired++; if (a !== p) reversed++; }
    }
    return {forecast_cutoff, target_season, format, universe_id, position, n: group.length,
      spearman: B.metrics(group.map(r => ({actual: r.actual_points, prediction: r.predicted_points}))).spearman,
      pairwise: {comparable: paired, reversed, tied, error_rate: paired ? reversed / paired : null},
      tie_policy: 'average ranks for Spearman; canonical ID breaks top-N boundary ties; tied pairs separate',
      top_n: (limits[position] || []).map(requested => {
        const n = Math.min(requested, group.length), ids = new Set(actual.slice(0, n).map(r => r.gsis_id));
        const hits = predicted.slice(0, n).filter(r => ids.has(r.gsis_id)).length;
        return {requested_n: requested, effective_n: n, overlap: hits, precision: n ? hits / n : null};
      })};
  });
}
module.exports = {BASELINE, key, compare, uncertainty, rankReport, errors};
