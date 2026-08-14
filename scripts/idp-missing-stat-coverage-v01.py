#!/usr/bin/env python3
import json,hashlib,sys
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
REQ=['def_sacks','def_sack_yards','def_interceptions','def_interception_yards','def_pass_defended','def_punt_blocks','def_pat_blocks','def_fg_blocks','fumble_recovery_tds','fumble_recovery_opp','fumble_recovery_yards_opp','special_teams_tds','def_tackles_solo','def_tackles_with_assist','def_tackle_assists','def_tackles_for_loss','def_qb_hits','def_fumbles_forced','def_tds','def_safeties']
WEIGHTS={'bonus_sack_2p':2.0,'fum_rec_td':6.0,'idp_blk_kick':3.0,'idp_fum_ret_yd':0.1,'idp_int_ret_yd':0.1,'idp_pass_def_3p':2.0,'idp_sack_yd':0.1,'st_td':6.0}
def rmse(a,p):return float(mean_squared_error(a,p)**.5)
def rho(a,p):
 r=spearmanr(a,p).statistic if len(np.unique(p))>1 else np.nan
 return None if np.isnan(r) else float(r)
def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text());assert m['snapshot_sha256']==SNAP
 ds=[];audit={}
 for y in range(2015,2026):
  d=pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False);d=d[(d.season_type=='REG')&d.position_group.isin(POS)].copy()
  audit[str(y)]={}
  for c in REQ:
   if c not in d.columns: raise RuntimeError(f'missing required source column {c} in {y}')
   x=pd.to_numeric(d[c],errors='coerce');bad=int(x.isna().sum());audit[str(y)][c]={'rows':int(len(d)),'missing_or_non_numeric':bad,'zero':int((x==0).sum()),'positive':int((x>0).sum())}
   if bad: raise RuntimeError(f'unavailable source states for {c} in {y}: {bad}; research refuses zero-fill')
   d[c]=x
  ds.append(d)
 return pd.concat(ds,ignore_index=True),m,audit
def annualize(w):
 w=w.copy();w['sack2']=(w.def_sacks>=2).astype(int);w['pd3']=(w.def_pass_defended>=3).astype(int);w['blk']=w.def_punt_blocks+w.def_pat_blocks+w.def_fg_blocks
 w['supported_score']=1.25*w.def_tackles_with_assist+1.75*w.def_tackles_solo+.75*w.def_tackle_assists+3*w.def_tackles_for_loss+5*w.def_sacks+.5*w.def_qb_hits+6*w.def_interceptions+3*w.def_pass_defended+4*w.def_fumbles_forced+2*w.fumble_recovery_opp+6*w.def_tds+6*w.def_safeties
 w['missing8_score']=2*w.sack2+6*w.fumble_recovery_tds+3*w.blk+.1*w.fumble_recovery_yards_opp+.1*w.def_interception_yards+2*w.pd3+.1*w.def_sack_yards+6*w.special_teams_tds
 a=w.groupby(['player_id','season','position_group'],as_index=False).agg(games=('week','nunique'),sacks=('def_sacks','sum'),sack_yards=('def_sack_yards','sum'),ints=('def_interceptions','sum'),int_yards=('def_interception_yards','sum'),pd=('def_pass_defended','sum'),sack2=('sack2','sum'),pd3=('pd3','sum'),blk=('blk','sum'),fum_rec_td=('fumble_recovery_tds','sum'),fum_rec=('fumble_recovery_opp','sum'),fum_ret_yards=('fumble_recovery_yards_opp','sum'),st_td=('special_teams_tds','sum'),tackles=('def_tackles_solo','sum'),supported_score=('supported_score','sum'),missing8_score=('missing8_score','sum'))
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
   rate=tr[target].sum()/max(tr[count].sum(),1e-9);cr=te[count+'_l1'].to_numpy()*rate
   feats=[count+'_l1',target+'_l1','games_l1','tackles_l1'];m=Pipeline([('imp',SimpleImputer(strategy='median')),('sc',StandardScaler()),('r',Ridge(alpha=10))]);m.fit(tr[feats],tr[target]);rp=np.maximum(0,m.predict(te[feats]))
   for name,p in [('zero',np.zeros(len(te))),('prior',te[target+'_l1'].to_numpy()),('count_rate',cr),('ridge',rp)]:rows.append({'position':pos,'season':y,'model':name,'n':len(te),'mae':float(mean_absolute_error(te[target],p)),'rmse':rmse(te[target],p),'spearman':rho(te[target],p),'bias':float(np.mean(p-te[target]))})
 return rows
def threshold(a,target,primary,threshold_value):
 rows=[];d=a[a[target+'_l1'].notna()].copy();nums=[primary+'_l1',target+'_l1','games_l1']
 for y in DEV:
  tr=d[d.season<y];te=d[d.season==y]
  pre=ColumnTransformer([('n',Pipeline([('i',SimpleImputer(strategy='median')),('s',StandardScaler())]),nums),('p',OneHotEncoder(handle_unknown='ignore'),['position_group'])])
  lg=Pipeline([('pre',pre),('m',LogisticRegression(C=.1,max_iter=1000))]);lg.fit(tr[nums+['position_group']],(tr[target]>0).astype(int));prob=lg.predict_proba(te[nums+['position_group']])[:,1]
  const=np.array([(tr[tr.position_group==p][target]>0).mean() for p in te.position_group])
  pp=Pipeline([('pre',pre),('m',PoissonRegressor(alpha=1,max_iter=1000))]);pp.fit(tr[nums+['position_group']],tr[target]);cnt=np.maximum(0,pp.predict(te[nums+['position_group']]))
  naive=(te[primary+'_l1']>=threshold_value).astype(float).to_numpy();zero=np.zeros(len(te))
  rows.append({'season':y,'n':len(te),'event_rate':float((te[target]>0).mean()),'mean_event_count':float(te[target].mean()),'brier_position_rate':float(brier_score_loss((te[target]>0).astype(int),const)),'brier_logistic':float(brier_score_loss((te[target]>0).astype(int),prob)),'count_mae_zero':float(mean_absolute_error(te[target],zero)),'count_mae_expected':float(mean_absolute_error(te[target],cnt)),'count_mae_naive_threshold':float(mean_absolute_error(te[target],naive))})
 return rows
def sparse(a,target):
 rows=[]
 for pos in POS:
  d=a[(a.position_group==pos)&a[target+'_l1'].notna()]
  for y in DEV:
   tr=d[d.season<y];te=d[d.season==y]
   if len(te)<10:continue
   actual=(te[target]>0).astype(int);base=(tr[target]>0).mean();p=np.repeat(base,len(te));prev=(te[target+'_l1']>0).astype(float).to_numpy();
   rows.append({'position':pos,'season':y,'n':len(te),'event_rate':float(actual.mean()),'brier_position_rate':float(brier_score_loss(actual,p)),'brier_prior_event':float(brier_score_loss(actual,prev)),'prior_event_positive_rate':float(prev.mean())})
 return rows
def population(a):
 out={}
 for pos in POS:
  q=a[(a.position_group==pos)&(a.season<=2024)]
  out[pos]={'player_seasons':int(len(q)),'sack2_positive_rate':float((q.sack2>0).mean()),'pd3_positive_rate':float((q.pd3>0).mean()),'blocked_kick_positive_rate':float((q.blk>0).mean()),'fum_rec_td_positive_rate':float((q.fum_rec_td>0).mean()),'st_td_positive_rate':float((q.st_td>0).mean()),'mean_sack_yards':float(q.sack_yards.mean()),'mean_int_return_yards':float(q.int_yards.mean()),'mean_fum_return_yards':float(q.fum_ret_yards.mean())}
 return out
def rate_stability(a):
 out={}
 for name,num,den in [('sack_yards_per_sack','sack_yards','sacks'),('int_return_yards_per_int','int_yards','ints'),('fum_return_yards_per_recovery','fum_ret_yards','fum_rec')]:
  rows=[]
  for y in range(2015,2025):
   for pos in POS:
    q=a[(a.season==y)&(a.position_group==pos)];denom=float(q[den].sum());rows.append({'season':y,'position':pos,'events':denom,'rate':None if denom<=0 else float(q[num].sum()/denom)})
  out[name]=rows
 return out
def scoring_impact(a):
 rows=[];mapping={'bonus_sack_2p':('sack2',2.0),'fum_rec_td':('fum_rec_td',6.0),'idp_blk_kick':('blk',3.0),'idp_fum_ret_yd':('fum_ret_yards',.1),'idp_int_ret_yd':('int_yards',.1),'idp_pass_def_3p':('pd3',2.0),'idp_sack_yd':('sack_yards',.1),'st_td':('st_td',6.0)}
 q=a[a.season<=2024]
 for pos in POS:
  p=q[q.position_group==pos]
  for key,(col,wgt) in mapping.items():rows.append({'position':pos,'category':key,'n':int(len(p)),'avg_fantasy_points':float((p[col]*wgt).mean()),'positive_player_season_rate':float((p[col]>0).mean())})
 rank=[]
 for y in range(2015,2025):
  for pos in POS:
   p=q[(q.season==y)&(q.position_group==pos)];full=p.supported_score+p.missing8_score;r=rho(full,p.supported_score);n=min(24,len(p));base=set(p.nlargest(n,'supported_score').player_id);top=set(p.assign(full_score=full).nlargest(n,'full_score').player_id);rank.append({'season':y,'position':pos,'spearman_supported_vs_observed8':r,'top24_overlap':int(len(base&top)),'top_n':int(n)})
 return {'category_contribution':rows,'rank_impact_observed_8_of_10':rank}
def main():
 w,m,audit=load();a=annualize(w);res={'version':'idp-missing-stat-coverage-v0.1.1','input_snapshot_sha256':m['snapshot_sha256'],'development_seasons':list(DEV),'retrospective_observed':2025,'source_state_audit':audit,'availability':{'bonus_sack_2p':'weekly event count where def_sacks>=2','fum_rec_td':'fumble_recovery_tds','idp_blk_kick':'def_punt_blocks+def_pat_blocks+def_fg_blocks','idp_fum_ret_yd':'fumble_recovery_yards_opp','idp_int_ret_yd':'def_interception_yards','idp_pass_def_3p':'weekly event count where def_pass_defended>=3','idp_sack_yd':'def_sack_yards','st_ff':None,'st_fum_rec':None,'st_td':'special_teams_tds'},'population':population(a),'rate_stability':rate_stability(a),'threshold_models':{'bonus_sack_2p':threshold(a,'sack2','sacks',2),'idp_pass_def_3p':threshold(a,'pd3','pd',3)},'continuous_models':{'idp_sack_yd':continuous(a,'sack_yards','sacks'),'idp_int_ret_yd':continuous(a,'int_yards','ints'),'idp_fum_ret_yd':continuous(a,'fum_ret_yards','fum_rec')},'sparse_events':{'fum_rec_td':sparse(a,'fum_rec_td'),'idp_blk_kick':sparse(a,'blk'),'st_td':sparse(a,'st_td')},'scoring_impact':scoring_impact(a),'flags':{'experimental':True,'production_projection_eligible':False,'idp_dynasty_value_available':False,'dynasty_value':None}}
 OUT.parent.mkdir(parents=True,exist_ok=True);txt=json.dumps(res,indent=2,sort_keys=True)+'\n';OUT.write_text(txt);print(hashlib.sha256(txt.encode()).hexdigest())
if __name__=='__main__':main()
