#!/usr/bin/env python3
import importlib.util,json,math,sys,hashlib
from pathlib import Path
import numpy as np,pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression,Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score,brier_score_loss
base=Path(__file__).with_name('projection-young-role-growth-v01.py');spec=importlib.util.spec_from_file_location('young',base);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
CACHE=Path(sys.argv[1]);CONTROL=Path(sys.argv[2]);OUT=Path(sys.argv[3]);m.CACHE=CACHE;m.CONTROL=CONTROL
def control_frame(a):
 raw=m.pd.DataFrame(m.json.loads(m.CONTROL.read_text())).rename(columns={'id':'player_id','pos':'position_group','y':'season','pred':'control_pred','act':'actual','hc':'history_count'}).drop(columns=['age','experience'],errors='ignore')
 cols=['player_id','season','position_group','experience','age','log_pick','drafted']+[c for c in a.columns if c.endswith('_l1') or c.endswith('_l2')]
 return raw.merge(a[cols],on=['player_id','season','position_group'],how='left')
def pipe_logit():return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('m',LogisticRegression(C=.1,max_iter=1000))])
def pipe_ridge():return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('m',Ridge(alpha=10))])
def run():
 w,p,manifest=m.load();a=m.aggregate(w,p);d=control_frame(a);target=a[['player_id','season','position_group','opp']].rename(columns={'opp':'actual_opp'});d=d.merge(target,on=['player_id','season','position_group'],how='left')
 rows=[];trans=[]
 hist=['opp_l1','opp_pg_l1','games_l1','fantasy_pg_l1'];rich=hist+['late_opp_growth_l1','target_share_l1','eff_fp_per_opp_l1','log_pick','drafted','age','experience'];prod=['control_pred','opp_l1','opp_pg_l1','games_l1','late_opp_growth_l1','log_pick','drafted','age','experience']
 for pos in m.POS:
  q=d[(d.position_group==pos)&d.experience.isin(m.EXPS)].copy();q['role']=(q.actual_opp>=m.ROLE_THR[pos]).astype(int);q['prior_role']=(q.opp_l1>=m.ROLE_THR[pos]).astype(int)
  for y in m.DEV:
   tr=q[q.season<y];te=q[q.season==y]
   if len(tr)<50 or len(te)<8 or tr.role.nunique()<2:continue
   # transition diagnostics by experience and prior/target role
   for exp in m.EXPS:
    e=te[te.experience==exp]
    for pr in [0,1]:
     for nr in [0,1]:
      z=e[(e.prior_role==pr)&(e.role==nr)]
      if len(z):trans.append({'position':pos,'experience':exp,'season':y,'prior_role':pr,'next_role':nr,'n':len(z),'control_bias':float((z.control_pred-z.actual).mean()),'control_mae':m.mae(z.actual,z.control_pred),'actual_mean':float(z.actual.mean()),'control_mean':float(z.control_pred.mean())})
   for role_name,rf in [('historical',hist),('rich',rich)]:
    clf=pipe_logit();clf.fit(tr[rf],tr.role);prob=clf.predict_proba(te[rf])[:,1]
    high=tr[tr.role==1];low=tr[tr.role==0]
    if len(high)<20 or len(low)<20:continue
    hi=pipe_ridge();lo=pipe_ridge();hi.fit(high[prod],high.actual);lo.fit(low[prod],low.actual);pred=prob*hi.predict(te[prod])+(1-prob)*lo.predict(te[prod])
    for exp in m.EXPS:
     mask=te.experience.eq(exp).to_numpy();z=te[mask]
     if len(z)<5:continue
     pp=pred[mask];rows.append({'position':pos,'experience':exp,'season':y,'model':f'two_stage_{role_name}','n':len(z),'mae':m.mae(z.actual,pp),'rmse':m.rmse(z.actual,pp),'spearman':m.sp(z.actual,pp),'rank_overlap':m.rank_overlap(z.actual,pp),'control_mae':m.mae(z.actual,z.control_pred),'control_rmse':m.rmse(z.actual,z.control_pred),'control_spearman':m.sp(z.actual,z.control_pred),'control_rank_overlap':m.rank_overlap(z.actual,z.control_pred),'mae_gain_pct':100*(m.mae(z.actual,z.control_pred)-m.mae(z.actual,pp))/m.mae(z.actual,z.control_pred)})
 out={'version':'young-two-stage-v01','input_snapshot_sha256':manifest['snapshot_sha256'],'selection_evidence_seasons':m.DEV,'retrospective_observed_season':2025,'fold_results':rows,'transition_diagnostics':trans,'flags':{'experimental':True,'production_projection_eligible':False,'dynasty_value_eligible':False}}
 OUT.parent.mkdir(parents=True,exist_ok=True);txt=json.dumps(out,indent=2,sort_keys=True)+'\n';OUT.write_text(txt);print(hashlib.sha256(txt.encode()).hexdigest())
run()
