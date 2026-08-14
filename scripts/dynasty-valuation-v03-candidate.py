#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY.
# Focused v0.3 candidate/holdout evaluation.
# experimental=true; production_dynasty_value_eligible=false; idp_numeric_eligible=false
import importlib.util, json, sys
from pathlib import Path
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
runner_path = HERE / 'dynasty-valuation-v03-runner.py'
spec = importlib.util.spec_from_file_location('dv03runner', runner_path)
run = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run)
mod = run.mod

CACHE = Path(sys.argv[1] if len(sys.argv) > 1 else '.cache/lv-dynasty-v03')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'data/reports/dynasty-v03/candidate.json')
mod.CACHE = CACHE

CANDIDATE = {
    'horizon': 3,
    'discount': 'moderate',
    'prediction_mode': 'conditional_survival',
    'replacement_mode': 'league',
    'flex_mode': 'fixed',
}
CONFIGS = list(mod.CONFIGS.keys())

def sp(a,b):
    return mod.sp(a,b)

def candidate(a,p,cn,overrides=None):
    cfg=mod.CONFIGS[cn]
    s=dict(CANDIDATE)
    if overrides:s.update(overrides)
    return mod.candidate_for_spec(a,p,cn,cfg,s['horizon'],s['discount'],s['prediction_mode'],s['replacement_mode'],s['flex_mode'])

def per_year_metrics(z):
    out=[]
    for y,g in z.groupby('valuation_season'):
        out.append({
            'valuation_season':int(y),'n':int(len(g)),
            'candidate_vs_realized':sp(g.actual,g.pred),
            'y1_vs_realized':sp(g.actual,g.y1),
            'current_points_vs_realized':sp(g.actual,g.current),
        })
    return out

def by_position(z):
    out=[]
    for pos,gp in z.groupby('pos'):
        for y,g in gp.groupby('valuation_season'):
            out.append({'position':pos,'valuation_season':int(y),'n':int(len(g)),
                        'candidate_vs_realized':sp(g.actual,g.pred),
                        'y1_vs_realized':sp(g.actual,g.y1),
                        'current_points_vs_realized':sp(g.actual,g.current)})
    return out

def common_h4(a,p,cn):
    """Compare H3 vs H4 against same H4 realized target, candidate settings."""
    cfg=mod.CONFIGS[cn]
    common=p[p.valuation_season.le(int(a.season.max())-4)].copy()
    zs={}
    for h in [3,4]:
        zs[h]=mod.candidate_for_spec(a,common,cn,cfg,h,'moderate','conditional_survival','league','fixed')
    target=zs[4][['valuation_season','player_id','pos','actual']].rename(columns={'actual':'target_actual'})
    out={'config':cn,'overall':[],'by_position':[]}
    for h,z in zs.items():
        m=z.merge(target,on=['valuation_season','player_id','pos'],how='inner')
        for y,g in m.groupby('valuation_season'):
            out['overall'].append({'predictor_horizon':h,'valuation_season':int(y),'n':int(len(g)),
                                   'spearman_vs_same_h4_target':sp(g.target_actual,g.pred)})
        for (pos,y),g in m.groupby(['pos','valuation_season']):
            out['by_position'].append({'predictor_horizon':h,'position':pos,'valuation_season':int(y),
                                      'n':int(len(g)),'spearman_vs_same_h4_target':sp(g.target_actual,g.pred)})
    return out

def ablation_holdout(a,p,cn,year=2022):
    """H3 fully observed latest chronological holdout; one dimension changed at a time."""
    variants={
      'candidate':{},
      'neutral_replacement':{'replacement_mode':'neutral'},
      'endogenous_flex':{'flex_mode':'endogenous'},
      'direct_unconditional':{'prediction_mode':'direct'},
      'mild_discount':{'discount':'mild'},
      'no_discount':{'discount':'none'},
    }
    out=[]
    for name,ov in variants.items():
        z=candidate(a,p,cn,ov)
        z=z[z.valuation_season.eq(year)]
        if z.empty:continue
        out.append({'variant':name,'valuation_season':year,'n':int(len(z)),
                    'spearman':sp(z.actual,z.pred),
                    'vs_y1':sp(z.actual,z.y1),
                    'vs_current':sp(z.actual,z.current)})
    return out

def h5_identifiability(p):
    rows=[]
    for y in mod.EVAL_YEARS:
        for pos in mod.POS:
            latest_training_base=y-6
            available=max(0, latest_training_base-2015+1)
            rows.append({'valuation_season':y,'position':pos,
                         'latest_allowed_training_base_season':latest_training_base,
                         'possible_calendar_training_base_seasons':available,
                         'identifiable':available>0})
    return rows

def league_effects_2022(a,p):
    out=[]
    for cn in CONFIGS:
        z=candidate(a,p,cn)
        z=z[z.valuation_season.eq(2022)].copy()
        if z.empty:continue
        for pos,g in z.groupby('pos'):
            out.append({'config':cn,'position':pos,'n':int(len(g)),
                        'median_raw_surplus':float(g.pred.median()),
                        'p90_raw_surplus':float(g.pred.quantile(.9)),
                        'max_raw_surplus':float(g.pred.max())})
    return out

def age_cohort_2022(a,p):
    rows=[]
    for cn in ['1qb_standard','superflex','two_te','two_te_premium']:
        z=candidate(a,p,cn)
        z=z[z.valuation_season.eq(2022)].copy()
        if z.empty:continue
        bins=[-1,22,24,26,29,33,100]
        labels=['<=22','23-24','25-26','27-29','30-33','34+']
        z['age_band']=pd.cut(z.age,bins=bins,labels=labels)
        for (pos,band),g in z.groupby(['pos','age_band'],observed=True):
            rows.append({'config':cn,'position':pos,'age_band':str(band),'n':int(len(g)),
                         'median_current_points':float(g.current.median()),
                         'median_candidate_surplus':float(g.pred.median()),
                         'median_realized_surplus':float(g.actual.median()),
                         'surplus_spearman':sp(g.actual,g.pred)})
    return rows

def reference_2022(a,p):
    out=[]
    for cn in ['1qb_standard','superflex','two_te_premium']:
        z=candidate(a,p,cn)
        z=z[z.valuation_season.eq(2022)].copy()
        if z.empty:continue
        top=max(float(z.pred.max()),1e-9)
        z['display_index']=10000*z.pred/top
        z['current_rank']=z.current.rank(ascending=False,method='min')
        z['candidate_rank']=z.pred.rank(ascending=False,method='min')
        z['rank_delta']=z.current_rank-z.candidate_rank
        rep=[]
        for pos in mod.POS:
            gp=z[z.pos.eq(pos)].sort_values('pred',ascending=False)
            if gp.empty:continue
            idxs=sorted(set([0,min(2,len(gp)-1),max(0,len(gp)//2),len(gp)-1]))
            rep.extend(gp.iloc[idxs].to_dict('records'))
        movers=z.reindex(z.rank_delta.abs().sort_values(ascending=False).index).head(20)
        def clean(r):
            return {
              'player_id':r.player_id,'position':r.pos,
              'age':None if pd.isna(r.age) else float(r.age),
              'experience':None if pd.isna(r.experience) else float(r.experience),
              'current_points':float(r.current),
              'candidate_raw_surplus':float(r.pred),
              'realized_three_year_surplus':float(r.actual),
              'diagnostic_display_index':float(r.display_index),
              'current_points_rank':float(r.current_rank),
              'candidate_rank':float(r.candidate_rank),
              'rank_delta':float(r.rank_delta),
              'components':r.components,
            }
        out.append({'config':cn,'valuation_season':2022,
                    'representative':[clean(pd.Series(r)) for r in rep],
                    'largest_current_points_to_candidate_movers':[clean(r) for _,r in movers.iterrows()]})
    return out

def te_behavior_2022(a,p):
    out=[]
    formats=['1qb_standard','te_premium_05','te_premium_10','two_te','two_te_premium']
    base=None
    for cn in formats:
        z=candidate(a,p,cn)
        z=z[(z.valuation_season.eq(2022))&(z.pos.eq('TE'))].copy()
        if z.empty:continue
        z=z[['player_id','age','current','pred','actual']]
        if base is None:
            base=z.rename(columns={'pred':'base_pred'})[['player_id','base_pred']]
        m=z.merge(base,on='player_id',how='left')
        out.append({'config':cn,'n':int(len(m)),
                    'median_te_surplus':float(m.pred.median()),
                    'p90_te_surplus':float(m.pred.quantile(.9)),
                    'median_change_vs_standard':float((m.pred-m.base_pred).median()),
                    'p90_change_vs_standard':float((m.pred-m.base_pred).quantile(.9)),
                    'max_change_vs_standard':float((m.pred-m.base_pred).max())})
    return out

def main():
    w,players,manifest=mod.load()
    a=mod.aggregate(w,players)
    p=mod.build_predictions(a)
    result={
      'version':'dynasty-valuation-v03-focused-candidate-v1',
      'input_snapshot_sha256':manifest['snapshot_sha256'],
      'candidate_formula':{
        **CANDIDATE,
        'raw':'sum_t discount^(t-1) * max(0, P(relevant_t) * E(points_t | relevant_t) - league_replacement_t)',
        'te_premium':'add actual league TE reception premium * projected TE receptions before replacement',
        'age_adjustment':'none outside future production/survival features',
        'market_anchor_weight':0.0,
      },
      'candidate_selection_basis':'corrected v0.3 exact-calendar ablations; no consensus-rank optimization',
      'h5_identifiability':h5_identifiability(p),
      'per_config':{},
      'common_h4':[],
      'holdout_2022_ablations':{},
      'league_effects_2022':league_effects_2022(a,p),
      'age_cohorts_2022':age_cohort_2022(a,p),
      'te_behavior_2022':te_behavior_2022(a,p),
      'reference_tables_2022':reference_2022(a,p),
      'market_anchor':{
        'executed':False,'candidate_weight':0.0,
        'conclusion':'not necessary to compute a pure football-derived score; incremental predictive/stability value cannot be tested without leakage-safe point-in-time historical market snapshots',
      },
      'value_scale':{
        'canonical':'raw discounted surplus points',
        'diagnostic_display':'10000 * player_raw_surplus / max_raw_surplus_in_same_league_snapshot',
        'production_scale_frozen':False,
        'reason':'display mapping is monotonic presentation and must not drive formula selection; max-normalization is diagnostic only because it is top-player-sensitive',
      },
      'rookie_contract':mod.rookie_contract(),
      'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False,'ready_for_qa':False},
    }
    for cn in CONFIGS:
        z=candidate(a,p,cn)
        result['per_config'][cn]={'all_observed_years':per_year_metrics(z),'by_position':by_position(z)}
        result['common_h4'].append(common_h4(a,p,cn))
        result['holdout_2022_ablations'][cn]=ablation_holdout(a,p,cn,2022)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
    print(json.dumps(result,indent=2,sort_keys=True))

if __name__=='__main__':
    main()
