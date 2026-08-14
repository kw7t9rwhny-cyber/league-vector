#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY.
# Focused v0.3 candidate/holdout evaluation with entrant-aware replacement forecasting.
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
    'replacement_forecast_mode': 'historical_replenished_ratio',
}
CONFIGS = list(mod.CONFIGS.keys())
_REPL_CACHE = {}

def sp(a,b):
    return mod.sp(a,b)

def actual_levels(a, cn, cfg, season, flex_mode):
    key=(cn,int(season),flex_mode)
    if key not in _REPL_CACHE:
        _REPL_CACHE[key]=mod.actual_replacement_by_target(a,cfg,int(season),flex_mode)
    return _REPL_CACHE[key]

def replacement_ratio_history(a,cn,cfg,valuation_year,h,flex_mode,pos):
    if h == 1:
        return 1.0, None
    seasons=sorted(int(x) for x in a.season.unique())
    ratios=[]
    pairs=[]
    for base in seasons:
        if base+1 >= valuation_year or base+h >= valuation_year:
            continue
        if base+h not in seasons or base+1 not in seasons:
            continue
        r1=float(actual_levels(a,cn,cfg,base+1,flex_mode).get(pos,0.0))
        rh=float(actual_levels(a,cn,cfg,base+h,flex_mode).get(pos,0.0))
        if r1 > 0 and np.isfinite(r1) and np.isfinite(rh):
            ratios.append(rh/r1)
            pairs.append({'base_season':base,'anchor_season':base+1,'target_season':base+h,
                          'anchor_replacement':r1,'target_replacement':rh,'ratio':rh/r1})
    if len(ratios) < 2:
        return None, pairs
    return float(np.median(ratios)), pairs

def prepared_horizon(p,y,h,cfg,prediction_mode):
    dh=p[(p.valuation_season.eq(y))&p.h.eq(h)].copy()
    if dh.empty:return dh
    if prediction_mode=='direct':
        dh['pred_fantasy']=dh.direct_fantasy
        dh['pred_receptions']=dh.direct_receptions
    else:
        dh['pred_fantasy']=dh.expected_conditional_fantasy
        dh['pred_receptions']=dh.expected_conditional_receptions
    dh['pred_scored']=mod.scoring(dh,cfg,'pred')
    dh['actual_scored']=mod.scoring(dh,cfg,'actual')
    return dh

def candidate_custom(a,p,cn,overrides=None):
    cfg=mod.CONFIGS[cn]
    s=dict(CANDIDATE)
    if overrides:s.update(overrides)
    H=int(s['horizon']); disc=mod.DISCOUNTS[s['discount']]
    max_observed=int(a.season.max())
    pp=p[p.valuation_season.le(max_observed-H)].copy()
    rows=[]
    for y in sorted(int(x) for x in pp.valuation_season.unique()):
        d1=prepared_horizon(pp,y,1,cfg,s['prediction_mode'])
        if d1.empty:continue
        rcfg=mod.NEUTRAL if s['replacement_mode']=='neutral' else cfg
        base_levels=mod.predicted_replacement(d1,rcfg,'pred_scored',s['flex_mode'])
        accum={}
        identifiable=True
        for h in range(1,H+1):
            dh=prepared_horizon(pp,y,h,cfg,s['prediction_mode'])
            if dh.empty:
                identifiable=False; break
            current_levels=mod.predicted_replacement(dh,rcfg,'pred_scored',s['flex_mode'])
            ratio_meta={}
            if s['replacement_forecast_mode']=='cohort_decay':
                pred_levels=current_levels
            elif s['replacement_forecast_mode']=='historical_replenished_ratio':
                pred_levels={}
                for pos in mod.POS:
                    ratio,pairs=replacement_ratio_history(a,cn,rcfg,y,h,s['flex_mode'],pos)
                    if ratio is None:
                        identifiable=False
                        break
                    pred_levels[pos]=float(base_levels.get(pos,0.0))*ratio
                    ratio_meta[pos]={'ratio':ratio,'history_n':0 if pairs is None else len(pairs)}
                if not identifiable:break
            else:
                raise ValueError(s['replacement_forecast_mode'])
            actual_levels_h=actual_levels(a,cn,cfg,y+h,s['flex_mode'])
            w=disc**(h-1)
            for _,r in dh.iterrows():
                k=(r.player_id,r.pos,r.age,r.experience)
                if k not in accum:
                    accum[k]={'pred':0.0,'actual':0.0,'y1':0.0,'current':float(r.current),'components':[]}
                ps=max(0.0,float(r.pred_scored)-float(pred_levels.get(r.pos,0.0)))
                av=max(0.0,float(r.actual_scored)-float(actual_levels_h.get(r.pos,0.0)))
                accum[k]['pred']+=w*ps
                accum[k]['actual']+=w*av
                if h==1:accum[k]['y1']=ps
                meta=ratio_meta.get(r.pos,{})
                accum[k]['components'].append({
                    'h':h,'weight':w,'pred_points':float(r.pred_scored),
                    'pred_replacement':float(pred_levels.get(r.pos,0.0)),
                    'cohort_decay_replacement':float(current_levels.get(r.pos,0.0)),
                    'replacement_ratio':meta.get('ratio'),
                    'replacement_ratio_history_n':meta.get('history_n'),
                    'pred_surplus':ps,'survival':float(r.survival),
                    'actual_points':float(r.actual_scored),
                    'actual_replacement':float(actual_levels_h.get(r.pos,0.0)),
                    'actual_surplus':av,
                })
        if not identifiable:
            continue
        for k,v in accum.items():
            rows.append({'valuation_season':y,'player_id':k[0],'pos':k[1],
                         'age':k[2],'experience':k[3],**v})
    return pd.DataFrame(rows)

def per_year_metrics(z):
    out=[]
    if z.empty:return out
    for y,g in z.groupby('valuation_season'):
        out.append({'valuation_season':int(y),'n':int(len(g)),
                    'candidate_vs_realized':sp(g.actual,g.pred),
                    'y1_vs_realized':sp(g.actual,g.y1),
                    'current_points_vs_realized':sp(g.actual,g.current)})
    return out

def by_position(z):
    out=[]
    if z.empty:return out
    for pos,gp in z.groupby('pos'):
        for y,g in gp.groupby('valuation_season'):
            out.append({'position':pos,'valuation_season':int(y),'n':int(len(g)),
                        'candidate_vs_realized':sp(g.actual,g.pred),
                        'y1_vs_realized':sp(g.actual,g.y1),
                        'current_points_vs_realized':sp(g.actual,g.current)})
    return out

def common_h4(a,p,cn):
    z3=candidate_custom(a,p,cn,{'horizon':3})
    z4=candidate_custom(a,p,cn,{'horizon':4})
    out={'config':cn,'overall':[],'by_position':[],
         'note':'H4 replenishment requires >=2 pre-valuation ratio observations; earliest eligible year may be excluded.'}
    if z4.empty:return out
    target=z4[['valuation_season','player_id','pos','actual']].rename(columns={'actual':'target_actual'})
    for h,z in [(3,z3),(4,z4)]:
        m=z.merge(target,on=['valuation_season','player_id','pos'],how='inner')
        for y,g in m.groupby('valuation_season'):
            out['overall'].append({'predictor_horizon':h,'valuation_season':int(y),'n':int(len(g)),
                                   'spearman_vs_same_h4_target':sp(g.target_actual,g.pred)})
        for (pos,y),g in m.groupby(['pos','valuation_season']):
            out['by_position'].append({'predictor_horizon':h,'position':pos,'valuation_season':int(y),
                                      'n':int(len(g)),'spearman_vs_same_h4_target':sp(g.target_actual,g.pred)})
    return out

def ablation_holdout(a,p,cn,year=2022):
    variants={
      'candidate_replenished':{},
      'cohort_decay_replacement':{'replacement_forecast_mode':'cohort_decay'},
      'neutral_replacement_replenished':{'replacement_mode':'neutral'},
      'endogenous_flex_replenished':{'flex_mode':'endogenous'},
      'direct_unconditional_replenished':{'prediction_mode':'direct'},
      'mild_discount_replenished':{'discount':'mild'},
      'no_discount_replenished':{'discount':'none'},
    }
    out=[]
    for name,ov in variants.items():
        z=candidate_custom(a,p,cn,ov)
        z=z[z.valuation_season.eq(year)] if not z.empty else z
        if z.empty:continue
        out.append({'variant':name,'valuation_season':year,'n':int(len(z)),
                    'spearman':sp(z.actual,z.pred),
                    'vs_y1':sp(z.actual,z.y1),
                    'vs_current':sp(z.actual,z.current)})
    return out

def h5_identifiability():
    rows=[]
    for y in mod.EVAL_YEARS:
        for pos in mod.POS:
            latest_training_base=y-6
            possible=max(0,latest_training_base-2015+1)
            ratio_possible=max(0,(y-6)-2015+1)
            rows.append({'valuation_season':y,'position':pos,
                         'latest_allowed_training_base_season':latest_training_base,
                         'possible_model_training_base_seasons':possible,
                         'possible_replacement_ratio_bases':ratio_possible,
                         'eligible_for_frozen_h5':possible>=2 and ratio_possible>=2})
    return rows

def replacement_diagnostics(a,p):
    out=[]
    for cn in ['1qb_standard','superflex','two_te_premium','deep_flex']:
        cfg=mod.CONFIGS[cn]
        for y in [2020,2021,2022]:
            d1=prepared_horizon(p,y,1,cfg,'conditional_survival')
            if d1.empty:continue
            base=mod.predicted_replacement(d1,cfg,'pred_scored','fixed')
            for h in [1,2,3]:
                dh=prepared_horizon(p,y,h,cfg,'conditional_survival')
                if dh.empty:continue
                cohort=mod.predicted_replacement(dh,cfg,'pred_scored','fixed')
                actual=actual_levels(a,cn,cfg,y+h,'fixed')
                for pos in mod.POS:
                    ratio,pairs=replacement_ratio_history(a,cn,cfg,y,h,'fixed',pos)
                    replenished=None if ratio is None else float(base.get(pos,0.0))*ratio
                    out.append({'config':cn,'valuation_season':y,'h':h,'position':pos,
                                'y1_anchor_predicted_replacement':float(base.get(pos,0.0)),
                                'cohort_decay_predicted_replacement':float(cohort.get(pos,0.0)),
                                'historical_replenished_predicted_replacement':replenished,
                                'realized_target_replacement':float(actual.get(pos,0.0)),
                                'ratio_history_n':0 if pairs is None else len(pairs)})
    return out

def league_effects_2022(a,p):
    out=[]
    for cn in CONFIGS:
        z=candidate_custom(a,p,cn)
        z=z[z.valuation_season.eq(2022)] if not z.empty else z
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
        z=candidate_custom(a,p,cn)
        z=z[z.valuation_season.eq(2022)] if not z.empty else z
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

def te_behavior_2022(a,p):
    out=[]
    formats=['1qb_standard','te_premium_05','te_premium_10','two_te','two_te_premium']
    base=None
    for cn in formats:
        z=candidate_custom(a,p,cn)
        z=z[(z.valuation_season.eq(2022))&(z.pos.eq('TE'))] if not z.empty else z
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

def reference_2022(a,p):
    out=[]
    for cn in ['1qb_standard','superflex','two_te_premium']:
        z=candidate_custom(a,p,cn)
        z=z[z.valuation_season.eq(2022)].copy() if not z.empty else z
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
            return {'player_id':r.player_id,'position':r.pos,
                    'age':None if pd.isna(r.age) else float(r.age),
                    'experience':None if pd.isna(r.experience) else float(r.experience),
                    'current_points':float(r.current),'candidate_raw_surplus':float(r.pred),
                    'realized_three_year_surplus':float(r.actual),
                    'diagnostic_display_index':float(r.display_index),
                    'current_points_rank':float(r.current_rank),'candidate_rank':float(r.candidate_rank),
                    'rank_delta':float(r.rank_delta),'components':r.components}
        out.append({'config':cn,'valuation_season':2022,
                    'representative':[clean(pd.Series(r)) for r in rep],
                    'largest_current_points_to_candidate_movers':[clean(r) for _,r in movers.iterrows()]})
    return out

def main():
    w,players,manifest=mod.load()
    a=mod.aggregate(w,players)
    p=mod.build_predictions(a)
    result={
      'version':'dynasty-valuation-v03-focused-candidate-v2-replenished',
      'input_snapshot_sha256':manifest['snapshot_sha256'],
      'candidate_formula':{
        **CANDIDATE,
        'raw':'sum_t discount^(t-1) * max(0, P(relevant_t) * E(points_t | relevant_t) - forecast_league_replacement_t)',
        'replacement_forecast':'Y+1 leakage-safe predicted replacement anchored forward by median historical entrant-aware replacement ratios using only seasons strictly before valuation year',
        'te_premium':'actual league TE reception premium * projected TE receptions before replacement',
        'age_adjustment':'none outside future production/survival features','market_anchor_weight':0.0},
      'h5_identifiability':h5_identifiability(),
      'per_config':{},'common_h4':[],'holdout_2022_ablations':{},
      'replacement_diagnostics':replacement_diagnostics(a,p),
      'league_effects_2022':league_effects_2022(a,p),
      'age_cohorts_2022':age_cohort_2022(a,p),
      'te_behavior_2022':te_behavior_2022(a,p),
      'reference_tables_2022':reference_2022(a,p),
      'market_anchor':{'executed':False,'candidate_weight':0.0,'necessary_for_formula':False,
        'conclusion':'The football-derived candidate is mathematically self-contained without a market baseline. Incremental predictive/stability value of a market prior remains untestable without leakage-safe historical point-in-time market snapshots; therefore market is excluded rather than assumed necessary.'},
      'value_scale':{'canonical':'raw discounted surplus points',
        'diagnostic_display':'10000 * player_raw_surplus / max_raw_surplus_in_same_league_snapshot',
        'production_scale_frozen':False,
        'reason':'display mapping is presentation only and must not drive candidate selection; max normalization is diagnostic because it is sensitive to the top player'},
      'rookie_contract':mod.rookie_contract(),
      'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False,'ready_for_qa':False}}
    for cn in CONFIGS:
        z=candidate_custom(a,p,cn)
        result['per_config'][cn]={'all_observed_years':per_year_metrics(z),'by_position':by_position(z)}
        result['common_h4'].append(common_h4(a,p,cn))
        result['holdout_2022_ablations'][cn]=ablation_holdout(a,p,cn,2022)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
    print(json.dumps(result,indent=2,sort_keys=True))

if __name__=='__main__':
    main()
