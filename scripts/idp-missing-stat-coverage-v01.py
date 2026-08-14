#!/usr/bin/env python3
import json,hashlib,sys,math
from pathlib import Path
import numpy as np,pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression,PoissonRegressor,Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler,OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.metrics import brier_score_loss,mean_absolute_error,mean_squared_error
from scipy.stats import spearmanr
CACHE=Path(sys.argv[1]);OUT=Path(sys.argv[2]);SNAP='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188';POS=['DL','LB','DB'];DEV=range(2020,2025)
def rmse(a,p):return float(mean_squared_error(a,p)**.5)
def rho(a,p):
 r=spearmanr(a,p).statistic if len(np.unique(p))>1 else np.nan
 return None if np.isnan(r) else float(r)
def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text());assert m['snapshot_sha256']==SNAP
 ds=[]
 for y in range(2015,2026):
  d=pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False);ds.append(d[(d.season_type=='REG')&d.position_group.isin(POS)])
 return pd.concat(ds,ignore_index=True),m
def annualize(w):
 need=['def_sacks','def_sack_yards','def_interceptions','def_interception_yards','def_pass_defended','def_punt_blocks','def_pat_blocks','def_fg_blocks','fumble_recovery_tds','fumble_recovery_opp','fumble_recovery_yards_opp','special_teams_tds','def_tackles_solo']
 for c in need:w[c]=pd.to_numeric(w[c],errors='coerce').fillna(0)
 w=w.copy();w['sack2']=(w.def_sacks>=2).astype(int);w['pd3']=(w.def_pass_defended>=3).astype(int);w['blk']=w.def_punt_blocks+w.def_pat_blocks+w.def_fg_blocks
 a=w.groupby(['player_id','season','position_group'],as_index=False).agg(games=('week','nunique'),sacks=('def_sacks','sum'),sack_yards=('def_sack_yards','sum'),ints=('def_interceptions','sum'),int_yards=('def_interception_yards','sum'),pd=('def_pass_defended','sum'),sack2=('sack2','sum'),pd3=('pd3','sum'),blk=('blk','sum'),fum_rec_td=('fumble_recovery_tds','sum'),fum_rec=('fumble_recovery_opp','sum'),fum_ret_yards=('fumble_recovery_yards_opp','sum'),st_td=('special_teams_tds','sum'),tackles=('def_tackles_solo','sum'))
 a=a.sort_values(['player_id','season'])
 for c in ['games','sacks','sack_yards','ints','int_yards','pd','sack2','pd3','blk','fum_rec_td','fum_rec','fum_ret_yards','st_td','tackles']:
  a[c+'_l1']=a.groupby('player_id')[c].shift(1)
 return a
def continuous(a,target,count):
 rows=[]
 for pos in POS:
  d=a[(a.position_group==pos)&a[target+'_l1'].notna()]
  for y in DEV:
   tr=d[d.season<y];te=d[d.season==y]
   if len(te)<10:continue
   rate=tr[target].sum()/max(tr[count].sum(),1e-9);cr=te[count+'_l1'].fillna(0).to_numpy()*rate
   feats=[count+'_l1',target+'_l1','games_l1','tackles_l1'];m=Pipeline([('imp',SimpleImputer(strategy='median')),('sc',StandardScaler()),('r',Ridge(alpha=10))]);m.fit(tr[feats],tr[target]);rp=np.maximum(0,m.predict(te[feats]))
   for name,p in [('zero',np.zeros(len(te))),('prior',te[target+'_l1'].fillna(0).to_numpy()),('count_rate',cr),('ridge',rp)]:rows.append({'position':pos,'season':y,'model':name,'n':len(te),'mae':float(mean_absolute_error(te[target],p)),'rmse':rmse(te[target],p),'spearman':rho(te[target],p),'bias':float(np.mean(p-te[target]))})
 return rows
def threshold(a,target,primary,threshold):
 rows=[];d=a[a[target+'_l1'].notna()].copy();nums=[primary+'_l1',target+'_l1','games_l1']
 for y in DEV:
  tr=d[d.season<y];te=d[d.season==y]
  pre=ColumnTransformer([('n',Pipeline([('i',SimpleImputer(strategy='median')),('s',StandardScaler())]),nums),('p',OneHotEncoder(handle_unknown='ignore'),['position_group'])])
  lg=Pipeline([('pre',pre),('m',LogisticRegression(C=.1,max_iter=1000))]);lg.fit(tr[nums+['position_group']],(tr[target]>0).astype(int));prob=lg.predict_proba(te[nums+['position_group']])[:,1]
  const=np.array([(tr[tr.position_group==p][target]>0).mean() for p in te.position_group])
  pp=Pipeline([('pre',pre),('m',PoissonRegressor(alpha=1,max_iter=1000))]);pp.fit(tr[nums+['position_group']],tr[target]);cnt=np.maximum(0,pp.predict(te[nums+['position_group']]))
  naive=(te[primary+'_l1'].fillna(0)>=threshold).astype(float).to_numpy()
  rows.append({'season':y,'n':len(te),'event_rate':float((te[target]>0).mean()),'brier_position_rate':float(brier_score_loss((te[target]>0).astype(int),const)),'brier_logistic':float(brier_score_loss((te[target]>0).astype(int),prob)),'count_mae_expected':float(mean_absolute_error(te[target],cnt)),'count_mae_naive_threshold':float(mean_absolute_error(te[target],naive))})
 return rows
def sparse(a,target):
 rows=[]
 for pos in POS:
  d=a[(a.position_group==pos)&a[target+'_l1'].notna()]
  for y in DEV:
   tr=d[d.season<y];te=d[d.season==y]
   if len(te)<10:continue
   actual=(te[target]>0).astype(int);p=np.repeat((tr[target]>0).mean(),len(te));rows.append({'position':pos,'season':y,'n':len(te),'event_rate':float(actual.mean()),'brier_position_rate':float(brier_score_loss(actual,p))})
 return rows
def summary(a):
 out={}
 for pos in POS:
  q=a[(a.position_group==pos)&(a.season<=2024)]
  out[pos]={'player_seasons':int(len(q)),'sack2_positive_rate':float((q.sack2>0).mean()),'pd3_positive_rate':float((q.pd3>0).mean()),'blocked_kick_positive_rate':float((q.blk>0).mean()),'fum_rec_td_positive_rate':float((q.fum_rec_td>0).mean()),'st_td_positive_rate':float((q.st_td>0).mean()),'mean_sack_yards':float(q.sack_yards.mean()),'mean_int_return_yards':float(q.int_yards.mean()),'mean_fum_return_yards':float(q.fum_ret_yards.mean())}
 return out
def main():
 w,m=load();a=annualize(w);res={'version':'idp-missing-stat-coverage-v0.1','input_snapshot_sha256':m['snapshot_sha256'],'development_seasons':list(DEV),'retrospective_observed':2025,'availability':{'bonus_sack_2p':'derived event from weekly def_sacks>=2','fum_rec_td':'fumble_recovery_tds','idp_blk_kick':'def_punt_blocks+def_pat_blocks+def_fg_blocks','idp_fum_ret_yd':'fumble_recovery_yards_opp','idp_int_ret_yd':'def_interception_yards','idp_pass_def_3p':'derived event from weekly def_pass_defended>=3','idp_sack_yd':'def_sack_yards','st_ff':None,'st_fum_rec':None,'st_td':'special_teams_tds'},'population':summary(a),'threshold_models':{'bonus_sack_2p':threshold(a,'sack2','sacks',2),'idp_pass_def_3p':threshold(a,'pd3','pd',3)},'continuous_models':{'idp_sack_yd':continuous(a,'sack_yards','sacks'),'idp_int_ret_yd':continuous(a,'int_yards','ints'),'idp_fum_ret_yd':continuous(a,'fum_ret_yards','fum_rec')},'sparse_events':{'fum_rec_td':sparse(a,'fum_rec_td'),'idp_blk_kick':sparse(a,'blk'),'st_td':sparse(a,'st_td')},'flags':{'experimental':True,'production_projection_eligible':False,'idp_dynasty_value_available':False,'dynasty_value':None}}
 OUT.parent.mkdir(parents=True,exist_ok=True);txt=json.dumps(res,indent=2,sort_keys=True)+'\n';OUT.write_text(txt);print(hashlib.sha256(txt.encode()).hexdigest())
if __name__=='__main__':main()
