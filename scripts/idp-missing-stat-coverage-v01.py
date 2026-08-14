#!/usr/bin/env python3
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, PoissonRegressor, Ridge
from sklearn.metrics import brier_score_loss, mean_absolute_error, mean_squared_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

SNAP = 'd261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'
POS = ['DL', 'LB', 'DB']
DEV = range(2020, 2025)
CANONICAL_FLOAT_DECIMALS = 8
REQ = [
    'def_sacks', 'def_sack_yards', 'def_interceptions', 'def_interception_yards',
    'def_pass_defended', 'def_punt_blocks', 'def_pat_blocks', 'def_fg_blocks',
    'fumble_recovery_tds', 'fumble_recovery_opp', 'fumble_recovery_yards_opp',
    'special_teams_tds', 'def_tackles_solo', 'def_tackles_with_assist',
    'def_tackle_assists', 'def_tackles_for_loss', 'def_qb_hits',
    'def_fumbles_forced', 'def_tds', 'def_safeties'
]


def rmse(actual, predicted):
    return float(mean_squared_error(actual, predicted) ** 0.5)


def rho(actual, predicted):
    value = spearmanr(actual, predicted).statistic if len(np.unique(predicted)) > 1 else np.nan
    return None if np.isnan(value) else float(value)


def audit_numeric_series(series, column, season):
    numeric = pd.to_numeric(series, errors='coerce')
    bad = int(numeric.isna().sum())
    audit = {
        'rows': int(len(numeric)),
        'missing_or_non_numeric': bad,
        'zero': int((numeric == 0).sum()),
        'positive': int((numeric > 0).sum()),
    }
    if bad:
        raise RuntimeError(
            f'unavailable source states for {column} in {season}: {bad}; research refuses zero-fill'
        )
    return numeric, audit


def load(cache):
    manifest = json.loads((cache / 'snapshot-manifest.json').read_text(encoding='utf-8'))
    assert manifest['snapshot_sha256'] == SNAP
    datasets = []
    audit = {}
    for season in range(2015, 2026):
        data = pd.read_csv(cache / f'stats_player_week_{season}.csv', low_memory=False)
        data = data[(data.season_type == 'REG') & data.position_group.isin(POS)].copy()
        audit[str(season)] = {}
        for column in REQ:
            if column not in data.columns:
                raise RuntimeError(f'missing required source column {column} in {season}')
            numeric, column_audit = audit_numeric_series(data[column], column, season)
            audit[str(season)][column] = column_audit
            data[column] = numeric
        datasets.append(data)
    return pd.concat(datasets, ignore_index=True), manifest, audit


def annualize(weekly):
    weekly = weekly.copy()
    weekly['sack2'] = (weekly.def_sacks >= 2).astype(int)
    weekly['pd3'] = (weekly.def_pass_defended >= 3).astype(int)
    weekly['blk'] = weekly.def_punt_blocks + weekly.def_pat_blocks + weekly.def_fg_blocks
    weekly['supported_score'] = (
        1.25 * weekly.def_tackles_with_assist
        + 1.75 * weekly.def_tackles_solo
        + 0.75 * weekly.def_tackle_assists
        + 3 * weekly.def_tackles_for_loss
        + 5 * weekly.def_sacks
        + 0.5 * weekly.def_qb_hits
        + 6 * weekly.def_interceptions
        + 3 * weekly.def_pass_defended
        + 4 * weekly.def_fumbles_forced
        + 2 * weekly.fumble_recovery_opp
        + 6 * weekly.def_tds
        + 6 * weekly.def_safeties
    )
    weekly['missing8_score'] = (
        2 * weekly.sack2
        + 6 * weekly.fumble_recovery_tds
        + 3 * weekly.blk
        + 0.1 * weekly.fumble_recovery_yards_opp
        + 0.1 * weekly.def_interception_yards
        + 2 * weekly.pd3
        + 0.1 * weekly.def_sack_yards
        + 6 * weekly.special_teams_tds
    )
    annual = weekly.groupby(
        ['player_id', 'season', 'position_group'], as_index=False, sort=True
    ).agg(
        games=('week', 'nunique'), sacks=('def_sacks', 'sum'),
        sack_yards=('def_sack_yards', 'sum'), ints=('def_interceptions', 'sum'),
        int_yards=('def_interception_yards', 'sum'), pd=('def_pass_defended', 'sum'),
        sack2=('sack2', 'sum'), pd3=('pd3', 'sum'), blk=('blk', 'sum'),
        fum_rec_td=('fumble_recovery_tds', 'sum'), fum_rec=('fumble_recovery_opp', 'sum'),
        fum_ret_yards=('fumble_recovery_yards_opp', 'sum'), st_td=('special_teams_tds', 'sum'),
        tackles=('def_tackles_solo', 'sum'), supported_score=('supported_score', 'sum'),
        missing8_score=('missing8_score', 'sum')
    )
    annual = annual.sort_values(['player_id', 'season', 'position_group'], kind='mergesort').reset_index(drop=True)
    for column in [
        'games', 'sacks', 'sack_yards', 'ints', 'int_yards', 'pd', 'sack2', 'pd3', 'blk',
        'fum_rec_td', 'fum_rec', 'fum_ret_yards', 'st_td', 'tackles'
    ]:
        annual[column + '_l1'] = annual.groupby('player_id', sort=True)[column].shift(1)
    return annual


def continuous(annual, target, count):
    rows = []
    for position in POS:
        data = annual[(annual.position_group == position) & annual[target + '_l1'].notna()]
        for season in DEV:
            train = data[data.season < season]
            test = data[data.season == season]
            if len(test) < 10:
                continue
            rate = train[target].sum() / max(train[count].sum(), 1e-9)
            count_rate = test[count + '_l1'].to_numpy() * rate
            features = [count + '_l1', target + '_l1', 'games_l1', 'tackles_l1']
            model = Pipeline([
                ('imp', SimpleImputer(strategy='median')),
                ('sc', StandardScaler()),
                ('r', Ridge(alpha=10)),
            ])
            model.fit(train[features], train[target])
            ridge_prediction = np.maximum(0, model.predict(test[features]))
            for name, prediction in [
                ('zero', np.zeros(len(test))),
                ('prior', test[target + '_l1'].to_numpy()),
                ('count_rate', count_rate),
                ('ridge', ridge_prediction),
            ]:
                rows.append({
                    'position': position, 'season': season, 'model': name, 'n': len(test),
                    'mae': float(mean_absolute_error(test[target], prediction)),
                    'rmse': rmse(test[target], prediction),
                    'spearman': rho(test[target], prediction),
                    'bias': float(np.mean(prediction - test[target])),
                })
    return rows


def threshold(annual, target, primary, threshold_value):
    rows = []
    data = annual[annual[target + '_l1'].notna()].copy()
    numeric_features = [primary + '_l1', target + '_l1', 'games_l1']
    for season in DEV:
        train = data[data.season < season]
        test = data[data.season == season]
        pre = ColumnTransformer([
            ('n', Pipeline([
                ('i', SimpleImputer(strategy='median')),
                ('s', StandardScaler()),
            ]), numeric_features),
            ('p', OneHotEncoder(handle_unknown='ignore'), ['position_group']),
        ])
        logistic = Pipeline([('pre', pre), ('m', LogisticRegression(C=0.1, max_iter=1000))])
        logistic.fit(train[numeric_features + ['position_group']], (train[target] > 0).astype(int))
        probability = logistic.predict_proba(test[numeric_features + ['position_group']])[:, 1]
        constant = np.array([
            (train[train.position_group == position][target] > 0).mean()
            for position in test.position_group
        ])
        poisson = Pipeline([('pre', pre), ('m', PoissonRegressor(alpha=1, max_iter=1000))])
        poisson.fit(train[numeric_features + ['position_group']], train[target])
        expected_count = np.maximum(0, poisson.predict(test[numeric_features + ['position_group']]))
        naive = (test[primary + '_l1'] >= threshold_value).astype(float).to_numpy()
        zero = np.zeros(len(test))
        rows.append({
            'season': season,
            'n': len(test),
            'event_rate': float((test[target] > 0).mean()),
            'mean_event_count': float(test[target].mean()),
            'brier_position_rate': float(brier_score_loss((test[target] > 0).astype(int), constant)),
            'brier_logistic': float(brier_score_loss((test[target] > 0).astype(int), probability)),
            'count_mae_zero': float(mean_absolute_error(test[target], zero)),
            'count_mae_expected': float(mean_absolute_error(test[target], expected_count)),
            'count_mae_naive_threshold': float(mean_absolute_error(test[target], naive)),
        })
    return rows


def sparse(annual, target):
    rows = []
    for position in POS:
        data = annual[(annual.position_group == position) & annual[target + '_l1'].notna()]
        for season in DEV:
            train = data[data.season < season]
            test = data[data.season == season]
            if len(test) < 10:
                continue
            actual = (test[target] > 0).astype(int)
            base = (train[target] > 0).mean()
            probability = np.repeat(base, len(test))
            prior_event = (test[target + '_l1'] > 0).astype(float).to_numpy()
            rows.append({
                'position': position, 'season': season, 'n': len(test),
                'event_rate': float(actual.mean()),
                'brier_position_rate': float(brier_score_loss(actual, probability)),
                'brier_prior_event': float(brier_score_loss(actual, prior_event)),
                'prior_event_positive_rate': float(prior_event.mean()),
            })
    return rows


def population(annual):
    result = {}
    for position in POS:
        data = annual[(annual.position_group == position) & (annual.season <= 2024)]
        result[position] = {
            'player_seasons': int(len(data)),
            'sack2_positive_rate': float((data.sack2 > 0).mean()),
            'pd3_positive_rate': float((data.pd3 > 0).mean()),
            'blocked_kick_positive_rate': float((data.blk > 0).mean()),
            'fum_rec_td_positive_rate': float((data.fum_rec_td > 0).mean()),
            'st_td_positive_rate': float((data.st_td > 0).mean()),
            'mean_sack_yards': float(data.sack_yards.mean()),
            'mean_int_return_yards': float(data.int_yards.mean()),
            'mean_fum_return_yards': float(data.fum_ret_yards.mean()),
        }
    return result


def rate_stability(annual):
    result = {}
    for name, numerator, denominator in [
        ('sack_yards_per_sack', 'sack_yards', 'sacks'),
        ('int_return_yards_per_int', 'int_yards', 'ints'),
        ('fum_return_yards_per_recovery', 'fum_ret_yards', 'fum_rec'),
    ]:
        rows = []
        for season in range(2015, 2025):
            for position in POS:
                data = annual[(annual.season == season) & (annual.position_group == position)]
                denominator_value = float(data[denominator].sum())
                rows.append({
                    'season': season,
                    'position': position,
                    'events': denominator_value,
                    'rate': None if denominator_value <= 0 else float(data[numerator].sum() / denominator_value),
                })
        result[name] = rows
    return result


def scoring_impact(annual):
    rows = []
    mapping = {
        'bonus_sack_2p': ('sack2', 2.0), 'fum_rec_td': ('fum_rec_td', 6.0),
        'idp_blk_kick': ('blk', 3.0), 'idp_fum_ret_yd': ('fum_ret_yards', 0.1),
        'idp_int_ret_yd': ('int_yards', 0.1), 'idp_pass_def_3p': ('pd3', 2.0),
        'idp_sack_yd': ('sack_yards', 0.1), 'st_td': ('st_td', 6.0),
    }
    development = annual[annual.season <= 2024]
    for position in POS:
        position_rows = development[development.position_group == position]
        for key, (column, weight) in mapping.items():
            rows.append({
                'position': position, 'category': key, 'n': int(len(position_rows)),
                'avg_fantasy_points': float((position_rows[column] * weight).mean()),
                'positive_player_season_rate': float((position_rows[column] > 0).mean()),
            })
    rank = []
    for season in range(2015, 2025):
        for position in POS:
            data = development[(development.season == season) & (development.position_group == position)]
            full = data.supported_score + data.missing8_score
            correlation = rho(full, data.supported_score)
            top_n = min(24, len(data))
            base = set(data.nlargest(top_n, 'supported_score').player_id)
            observed = set(data.assign(full_score=full).nlargest(top_n, 'full_score').player_id)
            rank.append({
                'season': season, 'position': position,
                'spearman_supported_vs_observed8': correlation,
                'top24_overlap': int(len(base & observed)), 'top_n': int(top_n),
            })
    return {'category_contribution': rows, 'rank_impact_observed_8_of_10': rank}


def canonicalize(value):
    if isinstance(value, dict):
        return {key: canonicalize(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [canonicalize(item) for item in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        number = float(value)
        if not math.isfinite(number):
            raise RuntimeError('canonical research result contains non-finite numeric output')
        rounded = float(f'{number:.{CANONICAL_FLOAT_DECIMALS}f}')
        return 0.0 if rounded == 0 else rounded
    return value


def build_result(cache):
    weekly, manifest, audit = load(cache)
    annual = annualize(weekly)
    return {
        'version': 'idp-missing-stat-coverage-v0.1.2-canonical',
        'canonicalization': {
            'contract': 'finite floats rounded to fixed decimal precision; negative zero normalized; JSON keys sorted; UTF-8; LF; one terminal newline',
            'float_decimal_places': CANONICAL_FLOAT_DECIMALS,
            'ephemeral_workflow_metadata_included': False,
        },
        'input_snapshot_sha256': manifest['snapshot_sha256'],
        'development_seasons': list(DEV),
        'retrospective_observed': 2025,
        'source_state_contract': {
            'true_numeric_zero_preserved': True,
            'missing_or_non_numeric_fails_closed': True,
            'unavailable_coerced_to_zero': False,
        },
        'source_state_audit': audit,
        'availability': {
            'bonus_sack_2p': 'weekly event count where def_sacks>=2',
            'fum_rec_td': 'fumble_recovery_tds',
            'idp_blk_kick': 'def_punt_blocks+def_pat_blocks+def_fg_blocks',
            'idp_fum_ret_yd': 'fumble_recovery_yards_opp',
            'idp_int_ret_yd': 'def_interception_yards',
            'idp_pass_def_3p': 'weekly event count where def_pass_defended>=3',
            'idp_sack_yd': 'def_sack_yards',
            'st_ff': None,
            'st_fum_rec': None,
            'st_td': 'special_teams_tds',
        },
        'population': population(annual),
        'rate_stability': rate_stability(annual),
        'threshold_models': {
            'bonus_sack_2p': threshold(annual, 'sack2', 'sacks', 2),
            'idp_pass_def_3p': threshold(annual, 'pd3', 'pd', 3),
        },
        'continuous_models': {
            'idp_sack_yd': continuous(annual, 'sack_yards', 'sacks'),
            'idp_int_ret_yd': continuous(annual, 'int_yards', 'ints'),
            'idp_fum_ret_yd': continuous(annual, 'fum_ret_yards', 'fum_rec'),
        },
        'sparse_events': {
            'fum_rec_td': sparse(annual, 'fum_rec_td'),
            'idp_blk_kick': sparse(annual, 'blk'),
            'st_td': sparse(annual, 'st_td'),
        },
        'scoring_impact': scoring_impact(annual),
        'flags': {
            'experimental': True,
            'production_projection_eligible': False,
            'idp_dynasty_value_available': False,
            'dynasty_value': None,
        },
    }


def serialize_canonical(result):
    canonical = canonicalize(result)
    return json.dumps(canonical, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False) + '\n'


def self_test_source_states():
    numeric, audit = audit_numeric_series(pd.Series([0, 1.5, 0.0]), 'x', 9999)
    assert list(numeric) == [0.0, 1.5, 0.0]
    assert audit == {'rows': 3, 'missing_or_non_numeric': 0, 'zero': 2, 'positive': 1}
    for bad in [pd.Series([0, None]), pd.Series([0, 'unavailable']), pd.Series([0, float('nan')])]:
        try:
            audit_numeric_series(bad, 'x', 9999)
        except RuntimeError:
            pass
        else:
            raise AssertionError('unavailable source state did not fail closed')
    sample = {'b': -0.0, 'a': 1.123456789123, 'nested': [2.000000004, 0.0]}
    text_a = serialize_canonical(sample)
    text_b = serialize_canonical(sample)
    assert text_a == text_b
    assert '"a": 1.12345679' in text_a
    assert '"b": 0.0' in text_a
    print('SOURCE_STATE_AND_CANONICALIZATION_SELF_TEST_PASS')


def main(argv):
    if argv == ['--self-test']:
        self_test_source_states()
        return
    if len(argv) != 2:
        raise SystemExit('usage: idp-missing-stat-coverage-v01.py <cache-dir> <output-json> | --self-test')
    cache = Path(argv[0])
    output = Path(argv[1])
    text = serialize_canonical(build_result(cache))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(text, encoding='utf-8', newline='\n')
    print(hashlib.sha256(text.encode('utf-8')).hexdigest())


if __name__ == '__main__':
    main(sys.argv[1:])
