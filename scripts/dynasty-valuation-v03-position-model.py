#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY. Position-specific multi-year feature contract; no arbitrary output caps.
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
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v03/position-model.json')
mod.CACHE=CACHE

FEATURES={
 'QB':['fantasy','games','attempts','carries','fantasy_l1','games_l1','attempts_l1','carries_l1','age','experience'],
 'RB':['fantasy','games','carries','targets','receptions','fantasy_l1','games_l1','carries_l1','targets_l1','receptions_l1','age','experience'],
 'WR':['fantasy','games','targets','receptions','fantasy_l1','games_l1','targets_l1','receptions_l1','age','experience'],
 'TE':['fantasy','games','targets','receptions','fantasy_l1','games_l1','targets_l1','receptions_l1','age','experience'],
}

def build_predictions(a):
 rows=[]
 for y in mod.EVAL_YEARS:
  for pos in mod.POS:
   feats=FEATURES[pos];base=a[(a.season==y)&(a.position_group==pos)].copy()
   if base.empty:continue
   for h in range(1,6):
    tf=f'y{h}_fantasy';trc=f'y{h}_receptions'
    tr=a[(a.position_group==pos)&((a.season+h)<y)].copy()
    if len(tr)<60:continue
    tr['rel']=(tr[tf]>=mod.RELEVANCE[pos]).astype(int)
    direct_f=mod.ridge();direct_f.fit(tr[feats],tr[tf])
    direct_r=mod.ridge();direct_r.fit(tr[feats],tr[trc])
    surv=mod.logit();surv.fit(tr[feats],tr.rel)
    reltr=tr[tr.rel.eq(1)].copy()
    if len(reltr)<40:continue
    cond_f=mod.ridge();cond_f.fit(reltr[feats],reltr[tf])
    cond_r=mod.ridge();cond_r.fit(reltr[feats],reltr[trc])
    pdirect=np.maximum(0,direct_f.predict(base[feats]));rdirect=np.maximum(0,direct_r.predict(base[feats]))
    psurv=surv.predict_proba(base[feats])[:,1]
    pcond=np.maximum(0,cond_f.predict(base[feats]));rcond=np.maximum(0,cond_r.predict(base[feats]))
    for i,(_,x) in enumerate(base.iterrows()):
     rows.append({'player_id':x.player_id,'valuation_season':y,'target_season':y+h,'pos':pos,'age':None if pd.isna(x.age) else float(x.age),'experience':None if pd.isna(x.experience) else float(x.experience),'current':float(x.fantasy),'current_receptions':float(x.receptions),'h':h,
      'direct_fantasy':float(pdirect[i]),'direct_receptions':float(rdirect[i]),'survival':float(psurv[i]),'conditional_fantasy':float(pcond[i]),'conditional_receptions':float(rcond[i]),
      'expected_conditional_fantasy':float(psurv[i]*pcond[i]),'expected_conditional_receptions':float(psurv[i]*rcond[i]),'actual_fantasy':float(x[tf]),'actual_receptions':float(x[trc])})
 return pd.DataFrame(rows)

def summary(a,pred,mode,cn):
 z=r.candidate(a,pred,cn,'expanding_historical_median',horizon=3,discount='moderate',prediction_mode=mode,replacement_mode='league',flex_mode='fixed')
 rows=[];posrows=[];tops=[]
 for y,g in z.groupby('valuation_season'):
  pts=[float(c['pred_points']) for comps in g.components for c in comps]
  rows.append({'valuation_season':int(y),'n':int(len(g)),'spearman':mod.sp(g.actual,g.pred),'y1':mod.sp(g.actual,g.y1),'current':mod.sp(g.actual,g.current),
               'max_raw_surplus':float(g.pred.max()),'max_future_point_estimate':float(max(pts)),'p99_future_point_estimate':float(np.quantile(pts,.99))})
 for (pos,y),g in z.groupby(['pos','valuation_season']):
  pts=[float(c['pred_points']) for comps in g.components for c in comps]
  posrows.append({'position':pos,'valuation_season':int(y),'n':int(len(g)),'spearman':mod.sp(g.actual,g.pred),'max_raw_surplus':float(g.pred.max()),'max_future_point_estimate':float(max(pts))})
 g=z[z.valuation_season.eq(2022)].sort_values('pred',ascending=False).head(25)
 for _,x in g.iterrows():tops.append({'player_id':x.player_id,'position':x.pos,'age':x.age,'current':float(x.current),'pred':float(x.pred),'actual':float(x.actual),'components':x.components})
 return {'summary':rows,'by_position':posrows,'top_2022':tops}

def observed_maxima(a):
 return [{'position':pos,'max_observed_points':float(g.fantasy.max()),'p99_observed_points':float(g.fantasy.quantile(.99)),'n':int(len(g))} for pos,g in a.groupby('position_group') if pos in mod.POS]

def main():
 w,players,manifest=mod.load();a=mod.aggregate(w,players);pred=build_predictions(a)
 result={'version':'dynasty-v03-position-specific-projection-v1','snapshot_sha256':manifest['snapshot_sha256'],'features':FEATURES,'observed_position_season_maxima':observed_maxima(a),
         'modes':{},'rule':'No output cap. Position-specific features must remove gross cross-role extrapolation while preserving chronological football-utility signal.',
         'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False}}
 for mode in ['direct','conditional_survival']:
  result['modes'][mode]={cn:summary(a,pred,mode,cn) for cn in mod.CONFIGS}
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,indent=2,sort_keys=True))
if __name__=='__main__':main()
