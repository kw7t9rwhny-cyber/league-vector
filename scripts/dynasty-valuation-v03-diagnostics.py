#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY. Diagnostic outputs for calibrated replacement candidate.
import importlib.util,json,sys
from pathlib import Path
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
p=HERE/'dynasty-valuation-v03-replacement-ablation.py'
spec=importlib.util.spec_from_file_location('rep',p)
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
mod=r.mod
CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-dynasty-v03')
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v03/diagnostics.json')
mod.CACHE=CACHE
METHOD='expanding_historical_median'

def cand(a,pred,cn,discount='moderate'):
    return r.candidate(a,pred,cn,METHOD,horizon=3,discount=discount,prediction_mode='conditional_survival',replacement_mode='league',flex_mode='fixed')

def refs(z,cn):
    z=z[z.valuation_season.eq(2022)].copy()
    if z.empty:return {'config':cn,'rows':[]}
    z['y1_projection']=z.components.apply(lambda x:x[0]['pred_points'] if x else None)
    z['current_rank']=z.current.rank(ascending=False,method='min');z['candidate_rank']=z.pred.rank(ascending=False,method='min')
    z['rank_delta']=z.current_rank-z.candidate_rank
    top=max(float(z.pred.max()),1e-9);z['diagnostic_display_index']=10000*z.pred/top
    chosen=[]
    for pos in mod.POS:
        gp=z[z.pos.eq(pos)].sort_values('pred',ascending=False)
        if gp.empty:continue
        idxs=sorted(set([0,min(2,len(gp)-1),max(0,len(gp)//2),len(gp)-1]))
        chosen.extend(gp.iloc[idxs].index.tolist())
    movers=z.reindex(z.rank_delta.abs().sort_values(ascending=False).index).head(20).index.tolist()
    idxs=list(dict.fromkeys(chosen+movers))
    rows=[]
    for _,x in z.loc[idxs].iterrows():
        rows.append({'player_id':x.player_id,'position':x.pos,'age':None if pd.isna(x.age) else float(x.age),'experience':None if pd.isna(x.experience) else float(x.experience),
                     'current_points':float(x.current),'y1_projection':float(x.y1_projection),'candidate_raw_surplus':float(x.pred),'realized_3y_surplus':float(x.actual),
                     'current_points_rank':float(x.current_rank),'candidate_rank':float(x.candidate_rank),'rank_delta':float(x.rank_delta),
                     'diagnostic_display_index':float(x.diagnostic_display_index),'components':x.components})
    return {'config':cn,'valuation_season':2022,'rows':rows}

def te_formats(a,pred):
    names=['1qb_standard','te_premium_05','te_premium_10','two_te','two_te_premium'];out=[];base=None
    for cn in names:
        z=cand(a,pred,cn);z=z[(z.valuation_season.eq(2022))&(z.pos.eq('TE'))].copy()
        if z.empty:continue
        if base is None:base=z[['player_id','pred']].rename(columns={'pred':'base'})
        m=z.merge(base,on='player_id',how='left')
        out.append({'config':cn,'n':int(len(m)),'median_surplus':float(m.pred.median()),'p90_surplus':float(m.pred.quantile(.9)),'max_surplus':float(m.pred.max()),
                    'median_change_vs_standard':float((m.pred-m.base).median()),'p90_change_vs_standard':float((m.pred-m.base).quantile(.9))})
    return out

def qb_formats(a,pred):
    out=[]
    for cn in ['1qb_standard','superflex','two_qb_like']:
        z=cand(a,pred,cn);z=z[(z.valuation_season.eq(2022))&(z.pos.eq('QB'))]
        out.append({'config':cn,'n':int(len(z)),'median_surplus':float(z.pred.median()),'p90_surplus':float(z.pred.quantile(.9)),'max_surplus':float(z.pred.max()),
                    'median_y1_projection':float(z.components.apply(lambda x:x[0]['pred_points']).median())})
    return out

def youth_matched(a,pred):
    z=cand(a,pred,'1qb_standard');z=z[z.valuation_season.eq(2022)].copy();out=[]
    z['y1_projection']=z.components.apply(lambda x:x[0]['pred_points'] if x else np.nan)
    agecuts={'QB':(26,32),'RB':(24,27),'WR':(24,29),'TE':(25,30)}
    for pos,(youngmax,oldmin) in agecuts.items():
        gp=z[z.pos.eq(pos)&z.y1_projection.notna()].copy()
        if len(gp)<20:continue
        gp['proj_bin']=pd.qcut(gp.y1_projection.rank(method='first'),q=5,labels=False)
        for b,g in gp.groupby('proj_bin'):
            young=g[g.age.le(youngmax)];old=g[g.age.ge(oldmin)]
            if len(young)<3 or len(old)<3:continue
            out.append({'position':pos,'projection_quintile':int(b),'young_n':int(len(young)),'old_n':int(len(old)),
                        'young_median_age':float(young.age.median()),'old_median_age':float(old.age.median()),
                        'young_median_y1_projection':float(young.y1_projection.median()),'old_median_y1_projection':float(old.y1_projection.median()),
                        'young_median_candidate_surplus':float(young.pred.median()),'old_median_candidate_surplus':float(old.pred.median()),
                        'young_minus_old_surplus':float(young.pred.median()-old.pred.median()),
                        'young_median_realized_surplus':float(young.actual.median()),'old_median_realized_surplus':float(old.actual.median())})
    return out

def discount_sensitivity(a,pred):
    out=[]
    for cn in mod.CONFIGS:
        zs={d:cand(a,pred,cn,d) for d in ['moderate','mild','none']}
        base=zs['moderate'];base=base[base.valuation_season.eq(2022)][['player_id','pos','pred']].rename(columns={'pred':'base'})
        for d,z in zs.items():
            z=z[z.valuation_season.eq(2022)].merge(base,on=['player_id','pos'])
            out.append({'config':cn,'discount':d,'n':int(len(z)),'spearman_vs_realized':mod.sp(z.actual,z.pred),'rank_correlation_vs_moderate':mod.sp(z.base,z.pred),
                        'median_value_ratio_vs_moderate':float((z.pred/z.base.replace(0,np.nan)).median())})
    return out

def main():
    w,players,manifest=mod.load();a=mod.aggregate(w,players);pred=mod.build_predictions(a)
    result={'version':'dynasty-v03-calibrated-diagnostics-v1','snapshot_sha256':manifest['snapshot_sha256'],'replacement_forecast':METHOD,
            'reference_tables':[refs(cand(a,pred,cn),cn) for cn in ['1qb_standard','superflex','two_te_premium','deep_flex','shallow']],
            'te_formats':te_formats(a,pred),'qb_formats':qb_formats(a,pred),'youth_matched_projection_bins':youth_matched(a,pred),'discount_sensitivity':discount_sensitivity(a,pred),
            'production_dv_comparison':{'available':False,'reason':'Leakage-safe historical point-in-time external market baselines needed by the production Dynasty Value formula are not present; current market values cannot be backfilled into 2022.'},
            'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False}}
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,indent=2,sort_keys=True))
if __name__=='__main__':main()
