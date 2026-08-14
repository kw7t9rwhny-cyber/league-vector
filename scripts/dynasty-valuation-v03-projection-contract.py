#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY. Red-team direct unconditional vs survival×conditional future production.
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
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v03/projection-contract.json')
mod.CACHE=CACHE
METHOD='expanding_historical_median'

def summarize(z,mode,cn):
    out=[]
    for y,g in z.groupby('valuation_season'):
        points=[]
        for comps in g.components:
            points.extend([float(c['pred_points']) for c in comps])
        out.append({'config':cn,'mode':mode,'valuation_season':int(y),'n':int(len(g)),
                    'spearman':mod.sp(g.actual,g.pred),'y1_spearman':mod.sp(g.actual,g.y1),'current_spearman':mod.sp(g.actual,g.current),
                    'max_raw_surplus':float(g.pred.max()),'p99_raw_surplus':float(g.pred.quantile(.99)),
                    'max_future_point_estimate':float(max(points)) if points else None,
                    'p99_future_point_estimate':float(np.quantile(points,.99)) if points else None})
    return out

def bypos(z,mode,cn):
    out=[]
    for (pos,y),g in z.groupby(['pos','valuation_season']):
        pts=[]
        for comps in g.components:pts.extend([float(c['pred_points']) for c in comps])
        out.append({'config':cn,'mode':mode,'position':pos,'valuation_season':int(y),'n':int(len(g)),
                    'spearman':mod.sp(g.actual,g.pred),'max_raw_surplus':float(g.pred.max()),'max_future_point_estimate':float(max(pts)) if pts else None})
    return out

def top_outliers(z,mode,cn):
    z=z[z.valuation_season.eq(2022)].copy()
    if z.empty:return []
    z=z.sort_values('pred',ascending=False).head(30)
    return [{'config':cn,'mode':mode,'player_id':x.player_id,'position':x.pos,'age':None if pd.isna(x.age) else float(x.age),
             'current_points':float(x.current),'candidate_raw_surplus':float(x.pred),'realized_surplus':float(x.actual),'components':x.components} for _,x in z.iterrows()]

def main():
    w,players,manifest=mod.load();a=mod.aggregate(w,players);pred=mod.build_predictions(a)
    result={'version':'dynasty-v03-projection-contract-redteam-v1','snapshot_sha256':manifest['snapshot_sha256'],'replacement_forecast':METHOD,
            'modes':{},'safety_rule':'A projection contract with grossly implausible multi-season point extrapolations is ineligible regardless of aggregate rank correlation.',
            'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False}}
    for mode in ['direct','conditional_survival']:
        result['modes'][mode]={'summary':[],'by_position':[],'top_2022':[]}
        for cn in mod.CONFIGS:
            z=r.candidate(a,pred,cn,METHOD,horizon=3,discount='moderate',prediction_mode=mode,replacement_mode='league',flex_mode='fixed')
            result['modes'][mode]['summary']+=summarize(z,mode,cn)
            result['modes'][mode]['by_position']+=bypos(z,mode,cn)
            result['modes'][mode]['top_2022']+=top_outliers(z,mode,cn)
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,indent=2,sort_keys=True))
if __name__=='__main__':main()
