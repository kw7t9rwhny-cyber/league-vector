#!/usr/bin/env python3
import hashlib,json,math,sys
from pathlib import Path
import numpy as np,pandas as pd
from scipy.stats import spearmanr
from sklearn.cluster import KMeans
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge,LogisticRegression
from sklearn.metrics import brier_score_loss,roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder,StandardScaler

CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-te-specialization-v01')
V04=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/projection-v04-canonical/run-a/candidate-player-seasons.json')
OUT=Path(sys.argv[3] if len(sys.argv)>3 else 'data/reports/projection-te-specialization-v01/result.json')
SNAP='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'
V04_SHA='9e329e7901ecb8e925d5f5aae695dadc30195b33e67f3943177dc13087b45ab0'
DEV=list(range(2020,2025));RETRO=2025
REQ=['targets','receptions','receiving_yards','receiving_tds']
BASE=['fantasy_prev','fantasy_pg','targets','targets_pg','receptions','receiving_yards','receiving_tds','games','missed_games','prior_rank']
ROLE=BASE+['late_targets_pg','late_target_growth','yards_per_target','catch_rate','age','experience']
MULTI=ROLE+['fantasy_two_seasons_ago']
ROLE_DRAFT=ROLE+['draft_pick']

def finite(v):return None if v is None or not math.isfinite(float(v)) else float(v)
def core_metrics(a,p):
 a=np.asarray(a,float);p=np.asarray(p,float)
 r=spearmanr(a,p).statistic if len(a)>2 and len(np.unique(p))>1 else np.nan
 return {'mae':float(np.mean(np.abs(a-p))),'rmse':float(np.sqrt(np.mean((a-p)**2))),'spearman':None if np.isnan(r) else float(r)}
def top(a,p,n):
 n=min(n,len(a));return None if n==0 else float(len(set(np.argsort(-np.asarray(a))[:n])&set(np.argsort(-np.asarray(p))[:n]))/n)
def pair(a,p):
 a=np.asarray(a,float);p=np.asarray(p,float);ok=tot=0
 for i in range(len(a)):
  for j in range(i+1,len(a)):
   if a[i]==a[j]:continue
   tot+=1;ok+=int((a[i]-a[j])*(p[i]-p[j])>0)
 return None if not tot else float(ok/tot)
def rankmet(a,p):
 a=np.asarray(a,float);p=np.asarray(p,float);d=core_metrics(a,p);idx=np.argsort(-a)[:min(24,len(a))]
 d.update(top12_overlap=top(a,p,12),top24_overlap=top(a,p,24),pairwise_accuracy=pair(a,p),fantasy_relevant_mae=float(np.mean(np.abs(a[idx]-p[idx]))),fantasy_relevant_rmse=float(np.sqrt(np.mean((a[idx]-p[idx])**2))))
 return d
def ridge(alpha=10):return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('ridge',Ridge(alpha=alpha))])
def logistic():return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('logit',LogisticRegression(C=.1,max_iter=2000,random_state=17))])
def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text())
 if m['snapshot_sha256']!=SNAP:raise RuntimeError('frozen snapshot drift')
 if hashlib.sha256(V04.read_bytes()).hexdigest()!=V04_SHA:raise RuntimeError('v0.4 comparator drift')
 w=pd.concat([pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False).query("season_type == 'REG'") for y in range(2015,2026)],ignore_index=True)
 p=pd.read_csv(CACHE/'players.csv',low_memory=False);v=json.loads(V04.read_text())
 v=pd.DataFrame([{'player_id':x['id'],'target_year':int(x['y']),'position_group':x['pos'],'v04_pred':float(x['pred']),'actual':float(x['act'])} for x in v])
 return w,p,v,m
def build(w,p,v):
 if 'player_id' not in w:raise RuntimeError('player identity field unavailable')
 for c in REQ:
  if c not in w:raise RuntimeError(f'unavailable required field {c}')
 te=w[w.position_group.eq('TE')].copy()
 if te.empty or te.player_id.isna().any():raise RuntimeError('missing TE identity')
 for c in REQ:
  q=pd.to_numeric(te[c],errors='coerce')
  if q.isna().any():raise RuntimeError(f'missing/non-numeric TE field {c}')
  te[c]=q
 te['fantasy']=te.receptions+te.receiving_yards*.1+te.receiving_tds*6
 s=te.groupby(['player_id','season'],as_index=False).agg(games=('week','nunique'),fantasy_prev=('fantasy','sum'),targets=('targets','sum'),receptions=('receptions','sum'),receiving_yards=('receiving_yards','sum'),receiving_tds=('receiving_tds','sum'))
 if s.duplicated(['player_id','season']).any():raise RuntimeError('duplicate player-season identity')
 s['targets_pg']=s.targets/s.games.clip(lower=1);s['fantasy_pg']=s.fantasy_prev/s.games.clip(lower=1);s['yards_per_target']=s.receiving_yards/s.targets.replace(0,np.nan);s['catch_rate']=s.receptions/s.targets.replace(0,np.nan);s['missed_games']=s.apply(lambda x:(16 if int(x.season)<=2020 else 17)-int(x.games),axis=1)
 late=[]
 for (pid,season),g in te.groupby(['player_id','season']):
  g=g.sort_values('week');tail=g.tail(4);prior=g.iloc[:-4];late_pg=float(tail.targets.mean());early=float(prior.targets.mean()) if len(prior) else late_pg;late.append((pid,season,late_pg,late_pg-early))
 s=s.merge(pd.DataFrame(late,columns=['player_id','season','late_targets_pg','late_target_growth']),on=['player_id','season'],validate='one_to_one');s['prior_rank']=s.groupby('season').fantasy_prev.rank(method='average',ascending=False)
 prior2=s[['player_id','season','fantasy_prev']].copy();prior2['season']+=1;prior2=prior2.rename(columns={'fantasy_prev':'fantasy_two_seasons_ago'});s=s.merge(prior2,on=['player_id','season'],how='left',validate='one_to_one')
 need=['gsis_id','birth_date','rookie_season','draft_year','draft_round','draft_pick']
 if any(c not in p for c in need):raise RuntimeError('required metadata column unavailable')
 meta=p[need].copy()
 if meta.gsis_id.dropna().duplicated().any():raise RuntimeError('duplicate metadata identity')
 meta.birth_date=pd.to_datetime(meta.birth_date,errors='coerce')
 for c in ['rookie_season','draft_year','draft_round','draft_pick']:meta[c]=pd.to_numeric(meta[c],errors='coerce')
 present=meta[['draft_year','draft_round','draft_pick']].notna().sum(axis=1);meta['draft_state']=np.select([present.eq(3),present.eq(0)],['COMPLETE','UNAVAILABLE'],default='INCONSISTENT_PARTIAL')
 c=meta.draft_state.eq('COMPLETE');bad=c&((meta.draft_round<1)|(meta.draft_round>7)|(meta.draft_pick<1)|(meta.draft_pick>300)|(meta.draft_year%1!=0)|(meta.draft_round%1!=0)|(meta.draft_pick%1!=0));mismatch=c&meta.rookie_season.notna()&meta.draft_year.ne(meta.rookie_season);meta.loc[bad,'draft_state']='INCONSISTENT_VALUE';meta.loc[mismatch,'draft_state']='INCONSISTENT_DRAFT_YEAR'
 s=s.merge(meta,left_on='player_id',right_on='gsis_id',how='left',validate='many_to_one',indicator=True)
 if (s._merge!='both').any():raise RuntimeError('unresolved source identity')
 s=s.drop(columns='_merge');s['age']=s.season-s.birth_date.dt.year;s['experience']=np.where(s.rookie_season.notna(),s.season-s.rookie_season,np.nan)
 x=s.copy();x['target_year']=x.season+1;x=x.merge(v[v.position_group.eq('TE')][['player_id','target_year','v04_pred','actual']],on=['player_id','target_year'],validate='one_to_one')
 audit={'te_player_seasons':int(len(s)),'paired_v04_rows':int(len(x)),'duplicate_player_seasons':0,'unresolved_player_identity':0,'team_pass_volume_available':False,'target_share_available':False,'red_zone_usage_available':False,'snap_role_available':False,'starter_status_inferred':False,'draft_complete_rows':int((x.draft_state=='COMPLETE').sum()),'draft_unavailable_rows':int((x.draft_state=='UNAVAILABLE').sum()),'draft_inconsistent_rows':int(x.draft_state.str.startswith('INCONSISTENT').sum()),'two_season_history_available_rows':int(x.fantasy_two_seasons_ago.notna().sum())}
 return x,audit
def archetype(tr,te):
 cols=['targets_pg','receiving_tds','yards_per_target','catch_rate','late_target_growth'];imp=SimpleImputer(strategy='median');sc=StandardScaler();A=sc.fit_transform(imp.fit_transform(tr[cols]));B=sc.transform(imp.transform(te[cols]));k=min(5,max(2,len(tr)//35));m=KMeans(n_clusters=k,random_state=17,n_init=20).fit(A);return m.labels_,m.predict(B),k
def predict(tr,te,features,arch=False,alpha=10):
 if not arch:
  m=ridge(alpha);m.fit(tr[features],tr.actual);return m.predict(te[features]),None
 a,b,k=archetype(tr,te);tr=tr.copy();te=te.copy();tr['arch']=a.astype(str);te['arch']=b.astype(str);pre=ColumnTransformer([('n',Pipeline([('i',SimpleImputer(strategy='median')),('s',StandardScaler())]),features),('c',OneHotEncoder(handle_unknown='ignore'),['arch'])]);m=Pipeline([('p',pre),('r',Ridge(alpha=alpha))]);m.fit(tr[features+['arch']],tr.actual);return m.predict(te[features+['arch']]),k
def evaluate(x):
 rows=[]
 for y in DEV:
  tr=x[x.target_year<y];te=x[x.target_year.eq(y)]
  if len(tr)<45 or len(te)<8:continue
  rows.append({'season':y,'model':'validated_v04','n':int(len(te)),**rankmet(te.actual,te.v04_pred)})
  for name,f,a,al in [('ridge_generic',BASE,False,10),('ridge_role',ROLE,False,10),('ridge_role_light',ROLE,False,30),('ridge_role_multiyear',MULTI,False,10),('empirical_archetype',ROLE,True,20)]:
   pr,_=predict(tr,te,f,a,al);rows.append({'season':y,'model':name,'n':int(len(te)),**rankmet(te.actual,pr)})
 return pd.DataFrame(rows)
def summarize(df):
 b=df[df.model.eq('validated_v04')];out={}
 for n in [x for x in df.model.unique() if x!='validated_v04']:
  g=df[df.model.eq(n)].merge(b,on='season',suffixes=('','_base'));g['gain']=100*(g.mae_base-g.mae)/g.mae_base;g['rel_gain']=100*(g.fantasy_relevant_mae_base-g.fantasy_relevant_mae)/g.fantasy_relevant_mae_base;g['d12']=g.top12_overlap-g.top12_overlap_base;g['d24']=g.top24_overlap-g.top24_overlap_base
  out[n]={'folds':int(len(g)),'wins':int((g.gain>0).sum()),'mean_mae_gain_pct':float(g.gain.mean()),'worst_mae_gain_pct':float(g.gain.min()),'mean_fantasy_relevant_mae_gain_pct':float(g.rel_gain.mean()),'worst_fantasy_relevant_mae_gain_pct':float(g.rel_gain.min()),'mean_spearman_delta':finite((g.spearman-g.spearman_base).mean()),'mean_top12_delta':finite(g.d12.mean()),'mean_top24_delta':finite(g.d24.mean()),'mean_pairwise_delta':finite((g.pairwise_accuracy-g.pairwise_accuracy_base).mean()),'folds_detail':g[['season','n','mae','mae_base','gain','rmse','rmse_base','spearman','spearman_base','top12_overlap','top12_overlap_base','top24_overlap','top24_overlap_base','pairwise_accuracy','pairwise_accuracy_base','fantasy_relevant_mae','fantasy_relevant_mae_base','rel_gain']].to_dict('records')}
 return out
def matched_draft(x):
 folds=[]
 for y in DEV:
  tr=x[(x.target_year<y)&x.draft_state.eq('COMPLETE')];te=x[(x.target_year==y)&x.draft_state.eq('COMPLETE')]
  if len(tr)<45 or len(te)<8:continue
  pr,_=predict(tr,te,ROLE_DRAFT);c=rankmet(te.actual,pr);b=rankmet(te.actual,te.v04_pred);folds.append({'season':y,'train_n':int(len(tr)),'n':int(len(te)),'candidate':c,'validated_v04_same_cohort':b,'mae_gain_pct':float(100*(b['mae']-c['mae'])/b['mae'])})
 return {'scope':'COMPLETE internally consistent draft metadata only; v0.4 comparator evaluated on exact same rows','candidate_promotion_eligible':False,'folds':folds,'mean_mae_gain_pct':float(np.mean([f['mae_gain_pct'] for f in folds])) if folds else None}
def prob_diag(tr,te,eligible,outcome,label):
 trq=tr[eligible(tr)].copy();teq=te[eligible(te)].copy()
 if len(trq)<20 or len(teq)<3:return {'status':'insufficient','train_n':int(len(trq)),'n':int(len(teq))}
 yt=outcome(trq).astype(int);ye=outcome(teq).astype(int)
 if yt.nunique()<2:return {'status':'insufficient_training_classes','train_n':int(len(trq)),'n':int(len(teq))}
 m=logistic();m.fit(trq[ROLE],yt);p=m.predict_proba(teq[ROLE])[:,1];pred=p>=.5
 return {'status':'diagnostic_only','train_n':int(len(trq)),'n':int(len(teq)),'positive_n':int(ye.sum()),f'{label}_auc':None if ye.nunique()<2 else float(roc_auc_score(ye,p)),f'{label}_brier':float(brier_score_loss(ye,p)),f'{label}_identification_rate':float(((pred)&(ye==1)).sum()/max(1,int((ye==1).sum()))),f'{label}_false_positive_rate':float(((pred)&(ye==0)).sum()/max(1,int(pred.sum()))),f'{label}_miss_rate':float(((~pred)&(ye==1)).sum()/max(1,int((ye==1).sum())))}
def uncertainty(x):
 folds=[]
 for y in DEV:
  tr=x[x.target_year<y].copy();te=x[x.target_year.eq(y)].copy()
  if len(tr)<50 or len(te)<8:continue
  for d in [tr,te]:d['actual_rank']=d.groupby('target_year').actual.rank(method='average',ascending=False)
  tr['relevant']=(tr.actual_rank<=24).astype(int);te['relevant']=(te.actual_rank<=24).astype(int);m=logistic();m.fit(tr[ROLE],tr.relevant);p=m.predict_proba(te[ROLE])[:,1]
  role={'n':int(len(te)),'role_survival_auc':None if te.relevant.nunique()<2 else float(roc_auc_score(te.relevant,p)),'role_survival_brier':float(brier_score_loss(te.relevant,p))}
  breakout=prob_diag(tr,te,lambda d:d.prior_rank>24,lambda d:d.actual_rank<=12,'breakout_probability')
  collapse=prob_diag(tr,te,lambda d:d.prior_rank<=12,lambda d:d.actual_rank>24,'collapse_probability')
  folds.append({'season':y,'role_survival_probability':role,'breakout_probability':breakout,'collapse_probability':collapse})
 return folds
def intervals(x):
 folds=[]
 for y in DEV:
  cal_y=y-1;tr=x[x.target_year<cal_y];cal=x[x.target_year.eq(cal_y)];te=x[x.target_year.eq(y)]
  if len(tr)<45 or len(cal)<8 or len(te)<8:continue
  cp,_=predict(tr,cal,ROLE);q=float(np.quantile(np.abs(cal.actual.to_numpy()-cp),.8,method='higher'));tp,_=predict(pd.concat([tr,cal]),te,ROLE);lo=tp-q;hi=tp+q;coverage=float(np.mean((te.actual.to_numpy()>=lo)&(te.actual.to_numpy()<=hi)))
  folds.append({'season':y,'train_through':cal_y-1,'calibration_season':cal_y,'n':int(len(te)),'nominal_coverage':0.8,'observed_coverage':coverage,'mean_interval_width':float(2*q),'absolute_residual_quantile':q})
 return {'method':'chronology-safe one-season split conformal absolute residual diagnostic; not used to alter points','folds':folds}
def early(x):
 out={}
 for e,label in [(0,'year1_to_year2'),(1,'year2_to_year3'),(2,'year3_to_year4')]:
  fs=[]
  for y in DEV:
   tr=x[x.target_year<y];te=x[(x.target_year==y)&(x.experience==e)]
   if len(tr)>=45 and len(te)>=3:
    pr,_=predict(tr,te,ROLE);c=rankmet(te.actual,pr);b=rankmet(te.actual,te.v04_pred);fs.append({'season':y,'n':int(len(te)),'candidate_mae':c['mae'],'v04_mae':b['mae'],'mae_gain_pct':100*(b['mae']-c['mae'])/b['mae'],'candidate_spearman':c['spearman'],'v04_spearman':b['spearman']})
  out[label]={'n':int(sum(f['n'] for f in fs)),'folds':fs,'mean_mae_gain_pct':float(np.mean([f['mae_gain_pct'] for f in fs])) if fs else None}
 return out
def failures(x):
 out=[]
 for y in DEV:
  tr=x[x.target_year<y];te=x[x.target_year.eq(y)].copy()
  if len(tr)<45 or len(te)<8:continue
  pr,_=predict(tr,te,ROLE);te['candidate_pred']=pr;te['candidate_abs_error']=np.abs(te.actual-pr);te['v04_abs_error']=np.abs(te.actual-te.v04_pred);te['error_delta_vs_v04']=te.candidate_abs_error-te.v04_abs_error
  for _,r in te.sort_values(['error_delta_vs_v04','player_id'],ascending=[False,True]).head(5).iterrows():out.append({'season':y,'player_id':str(r.player_id),'actual':float(r.actual),'candidate_pred':float(r.candidate_pred),'v04_pred':float(r.v04_pred),'candidate_abs_error':float(r.candidate_abs_error),'v04_abs_error':float(r.v04_abs_error),'error_delta_vs_v04':float(r.error_delta_vs_v04)})
 return out
def main():
 w,p,v,m=load();x,a=build(w,p,v);s=summarize(evaluate(x));cand=[]
 for n,z in s.items():
  ok=z['folds']>=3 and z['wins']>z['folds']/2 and (z['mean_mae_gain_pct']>=3 or (z['mean_spearman_delta'] if z['mean_spearman_delta'] is not None else -9)>=.04) and z['worst_mae_gain_pct']>=-12 and z['mean_fantasy_relevant_mae_gain_pct']>=-5 and (z['mean_top12_delta'] if z['mean_top12_delta'] is not None else -9)>=-.08 and (z['mean_top24_delta'] if z['mean_top24_delta'] is not None else -9)>=-.08
  z['candidate_gate_pass']=bool(ok)
  if ok:cand.append(n)
 selected=max(cand,key=lambda n:(s[n]['mean_mae_gain_pct'],s[n]['mean_spearman_delta'] if s[n]['mean_spearman_delta'] is not None else -9)) if cand else None;decision='READY FOR QA — HIGH RISK' if selected else 'MORE TE RESEARCH REQUIRED'
 te=x[x.target_year.eq(RETRO)];tr=x[x.target_year<RETRO];pr,_=predict(tr,te,ROLE)
 r={'version':'te-specialization-ranking-research-v0.1','input_snapshot_sha256':m['snapshot_sha256'],'validated_v04_player_seasons_sha256':V04_SHA,'development_target_seasons':DEV,'retrospective_observed':RETRO,'control':'validated Projection v0.4 immutable','identity_and_data_audit':a,'features':{'tested_role_features':ROLE,'multi_year_feature':MULTI[-1],'team_pass_volume_and_target_share':'unavailable in frozen weekly schema; not inferred','red_zone_usage_proxy_used':False,'snap_or_starter_proxy_used':False,'draft_capital':'matched-cohort diagnostic only on COMPLETE consistent rows','true_zero_preserved':True,'missing_unavailable_not_zero_filled':True},'models':s,'draft_capital_diagnostic':matched_draft(x),'selected_candidate':selected,'candidate_gate':{'rule':'>=3 full-cohort folds; majority MAE wins; >=3% mean MAE gain OR >=0.04 Spearman gain; worst MAE fold >=-12%; mean fantasy-relevant MAE gain >=-5%; mean top12/top24 delta >=-0.08'},'early_career':early(x),'uncertainty':{'probability_diagnostics':uncertainty(x),'prediction_intervals':intervals(x),'all_uncertainty_is_metadata_only':True},'archetypes':{'method':'per-fold KMeans on empirical TE receiving-role features; no subjective labels','promotion_justified':bool(s.get('empirical_archetype',{}).get('candidate_gate_pass',False))},'failure_cases':failures(x),'retrospective_2025':{'n':int(len(te)),'status':'retrospective_observed_not_used_for_selection','candidate_role_model':rankmet(te.actual,pr),'validated_v04':rankmet(te.actual,te.v04_pred)},'flags':{'experimental':True,'production_projection_eligible':False,'dynasty_value_eligible':False,'production_modified':False,'core_modified':False,'ui_modified':False,'idp_modified':False},'decision':decision}
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(r,sort_keys=True,indent=2,allow_nan=False)+'\n');print(decision)
if __name__=='__main__':main()
