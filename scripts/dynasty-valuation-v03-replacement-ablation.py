#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY.
# Compare entrant-aware future replacement forecasting strategies using only information
# strictly available before each valuation season.
import importlib.util, json, sys
from pathlib import Path
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
p=HERE/'dynasty-valuation-v03-candidate.py'
spec=importlib.util.spec_from_file_location('focused',p)
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
mod=f.mod
CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-dynasty-v03')
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v03/replacement-ablation.json')
mod.CACHE=CACHE

METHODS=['cohort_decay','ratio_anchor','expanding_historical_median','trailing3_historical_median','latest_historical_level']

def historical_level(a,cn,cfg,y,pos,flex_mode,method):
    seasons=sorted(int(s) for s in a.season.unique() if int(s)<y)
    vals=[]
    for s in seasons:
        v=float(f.actual_levels(a,cn,cfg,s,flex_mode).get(pos,0.0))
        if v>0 and np.isfinite(v):vals.append((s,v))
    if method=='latest_historical_level':
        return (vals[-1][1],len(vals)) if vals else (None,0)
    if method=='trailing3_historical_median':
        q=[v for _,v in vals[-3:]]
        return (float(np.median(q)),len(q)) if len(q)>=2 else (None,len(q))
    q=[v for _,v in vals]
    return (float(np.median(q)),len(q)) if len(q)>=3 else (None,len(q))

def candidate(a,pred,cn,method,horizon=3,discount='moderate',prediction_mode='conditional_survival',replacement_mode='league',flex_mode='fixed'):
    cfg=mod.CONFIGS[cn]; rcfg=mod.NEUTRAL if replacement_mode=='neutral' else cfg
    max_obs=int(a.season.max()); pp=pred[pred.valuation_season.le(max_obs-horizon)].copy()
    disc=mod.DISCOUNTS[discount]; rows=[]
    for y in sorted(int(x) for x in pp.valuation_season.unique()):
        d1=f.prepared_horizon(pp,y,1,cfg,prediction_mode)
        if d1.empty:continue
        y1_cohort=mod.predicted_replacement(d1,rcfg,'pred_scored',flex_mode)
        accum={}; ok=True
        for h in range(1,horizon+1):
            dh=f.prepared_horizon(pp,y,h,cfg,prediction_mode)
            if dh.empty:ok=False;break
            cohort=mod.predicted_replacement(dh,rcfg,'pred_scored',flex_mode)
            levels={}; meta={}
            for pos in mod.POS:
                if method=='cohort_decay':
                    levels[pos]=float(cohort.get(pos,0.0)); meta[pos]={'history_n':0}
                elif method=='ratio_anchor':
                    ratio,pairs=f.replacement_ratio_history(a,cn,rcfg,y,h,flex_mode,pos)
                    if ratio is None:ok=False;break
                    levels[pos]=float(y1_cohort.get(pos,0.0))*ratio
                    meta[pos]={'history_n':len(pairs or []),'ratio':ratio}
                else:
                    lvl,n=historical_level(a,cn,rcfg,y,pos,flex_mode,method)
                    if lvl is None:ok=False;break
                    levels[pos]=lvl;meta[pos]={'history_n':n}
            if not ok:break
            actual=f.actual_levels(a,cn,cfg,y+h,flex_mode); w=disc**(h-1)
            for _,r in dh.iterrows():
                k=(r.player_id,r.pos,r.age,r.experience)
                if k not in accum:accum[k]={'pred':0.,'actual':0.,'y1':0.,'current':float(r.current),'components':[]}
                ps=max(0.,float(r.pred_scored)-levels[r.pos]); av=max(0.,float(r.actual_scored)-float(actual.get(r.pos,0.)))
                accum[k]['pred']+=w*ps;accum[k]['actual']+=w*av
                if h==1:accum[k]['y1']=ps
                accum[k]['components'].append({'h':h,'weight':w,'pred_points':float(r.pred_scored),'pred_replacement':levels[r.pos],
                    'cohort_decay_replacement':float(cohort.get(r.pos,0.)),'actual_replacement':float(actual.get(r.pos,0.)),
                    'history_n':meta[r.pos].get('history_n'),'ratio':meta[r.pos].get('ratio'),'pred_surplus':ps,'actual_surplus':av})
        if not ok:continue
        for k,v in accum.items():rows.append({'valuation_season':y,'player_id':k[0],'pos':k[1],'age':k[2],'experience':k[3],**v})
    return pd.DataFrame(rows)

def metrics(z):
    if z.empty:return []
    out=[]
    for y,g in z.groupby('valuation_season'):
        out.append({'valuation_season':int(y),'n':int(len(g)),'spearman':mod.sp(g.actual,g.pred),'y1':mod.sp(g.actual,g.y1),'current':mod.sp(g.actual,g.current)})
    return out

def replacement_error(a,pred,cn,method):
    cfg=mod.CONFIGS[cn]; out=[]
    for y in [2020,2021,2022]:
        d1=f.prepared_horizon(pred,y,1,cfg,'conditional_survival')
        if d1.empty:continue
        y1=mod.predicted_replacement(d1,cfg,'pred_scored','fixed')
        for h in [1,2,3]:
            dh=f.prepared_horizon(pred,y,h,cfg,'conditional_survival')
            if dh.empty:continue
            cohort=mod.predicted_replacement(dh,cfg,'pred_scored','fixed');actual=f.actual_levels(a,cn,cfg,y+h,'fixed')
            for pos in mod.POS:
                if method=='cohort_decay': lvl=float(cohort.get(pos,0.));n=0
                elif method=='ratio_anchor':
                    ratio,pairs=f.replacement_ratio_history(a,cn,cfg,y,h,'fixed',pos);lvl=None if ratio is None else float(y1.get(pos,0.))*ratio;n=len(pairs or [])
                else:
                    lvl,n=historical_level(a,cn,cfg,y,pos,'fixed',method)
                if lvl is not None:out.append({'valuation_season':y,'h':h,'position':pos,'predicted':lvl,'actual':float(actual.get(pos,0.)),'error':lvl-float(actual.get(pos,0.)),'history_n':n})
    return out

def main():
    w,players,manifest=mod.load();a=mod.aggregate(w,players);pred=mod.build_predictions(a)
    result={'version':'dynasty-v03-replacement-ablation-v1','snapshot_sha256':manifest['snapshot_sha256'],'methods':{},
            'selection_rule':'prefer leakage-safe method with materially lower replacement MAE/bias while preserving latest 2022 football-utility rank signal; do not select by consensus rankings',
            'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False}}
    for method in METHODS:
        result['methods'][method]={}
        for cn in mod.CONFIGS:
            z=candidate(a,pred,cn,method)
            result['methods'][method][cn]={'metrics':metrics(z),'replacement_error':replacement_error(a,pred,cn,method)}
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,indent=2,sort_keys=True))
if __name__=='__main__':main()
