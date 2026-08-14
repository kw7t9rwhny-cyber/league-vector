#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY.
# Evaluate effective horizon after replacement calibration is fixed.
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
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v03/horizon-ablation.json')
mod.CACHE=CACHE
METHOD='expanding_historical_median'

def metric(z,target):
    m=z.merge(target,on=['valuation_season','player_id','pos'],how='inner')
    overall=[];bypos=[]
    for y,g in m.groupby('valuation_season'):
        overall.append({'valuation_season':int(y),'n':int(len(g)),'spearman':mod.sp(g.target_actual,g.pred)})
    for (pos,y),g in m.groupby(['pos','valuation_season']):
        bypos.append({'position':pos,'valuation_season':int(y),'n':int(len(g)),'spearman':mod.sp(g.target_actual,g.pred)})
    return overall,bypos

def common_h4(a,pred,cn):
    zs={h:r.candidate(a,pred,cn,METHOD,horizon=h) for h in [2,3,4]}
    if zs[4].empty:return {'config':cn,'overall':[],'by_position':[]}
    target=zs[4][['valuation_season','player_id','pos','actual']].rename(columns={'actual':'target_actual'})
    out={'config':cn,'overall':[],'by_position':[]}
    for h,z in zs.items():
        ov,bp=metric(z,target)
        for x in ov:out['overall'].append({'predictor_horizon':h,**x})
        for x in bp:out['by_position'].append({'predictor_horizon':h,**x})
    return out

def own_target(a,pred,cn):
    out=[]
    for h in [2,3,4]:
        z=r.candidate(a,pred,cn,METHOD,horizon=h)
        for y,g in z.groupby('valuation_season'):
            out.append({'horizon':h,'valuation_season':int(y),'n':int(len(g)),
                        'candidate':mod.sp(g.actual,g.pred),'y1':mod.sp(g.actual,g.y1),'current':mod.sp(g.actual,g.current)})
    return out

def position_horizon_summary(common):
    rows=[]
    df=pd.DataFrame(common['by_position'])
    if df.empty:return rows
    for (pos,y),g in df.groupby(['position','valuation_season']):
        m={int(x.predictor_horizon):float(x.spearman) for _,x in g.iterrows() if pd.notna(x.spearman)}
        if not m:continue
        best=max(m,key=m.get)
        rows.append({'position':pos,'valuation_season':int(y),'h2':m.get(2),'h3':m.get(3),'h4':m.get(4),'best_horizon':best,
                     'h3_minus_h2':None if 2 not in m or 3 not in m else m[3]-m[2],
                     'h4_minus_h3':None if 3 not in m or 4 not in m else m[4]-m[3]})
    return rows

def main():
    w,players,manifest=mod.load();a=mod.aggregate(w,players);pred=mod.build_predictions(a)
    result={'version':'dynasty-v03-calibrated-horizon-v1','snapshot_sha256':manifest['snapshot_sha256'],
            'replacement_forecast':METHOD,'common_target':'realized four-year discounted league-specific surplus',
            'configs':{},'h5':{'eligible':False,'reason':'2015-2025 history lacks adequate leakage-safe pre-2020 Y+5 training cohorts; H5 remains unidentifiable rather than scored'},
            'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False}}
    for cn in mod.CONFIGS:
        c=common_h4(a,pred,cn)
        result['configs'][cn]={'common_h4':c,'position_horizon_summary':position_horizon_summary(c),'own_target':own_target(a,pred,cn)}
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,indent=2,sort_keys=True))
if __name__=='__main__':main()
