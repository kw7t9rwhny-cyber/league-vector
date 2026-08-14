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
DEV=list(range(2020,2025)); RETRO=2025
REQ=['targets','receptions','receiving_yards','receiving_tds']
BASE=['fantasy_prev','fantasy_pg','targets','targets_pg','receptions','receiving_yards','receiving_tds','games','missed_games','prior_rank']
ROLE=BASE+['target_share','late_targets_pg','late_target_growth','yards_per_target','catch_rate','team_pass_targets','age','experience','draft_pick']


def finite(v):
 return None if v is None or not math.isfinite(float(v)) else float(v)

def metrics(a,p):
 a=np.asarray(a,float);p=np.asarray(p,float)
 rho=spearmanr(a,p).statistic if len(a)>2 and len(np.unique(p))>1 else np.nan
 return {'mae':float(np.mean(np.abs(a-p))),'rmse':float(np.sqrt(np.mean((a-p)**2))),'spearman':None if np.isnan(rho) else float(rho)}

def top_overlap(a,p,n):
 if len(a)==0:return None
 n=min(n,len(a));ai=set(np.argsort(-np.asarray(a))[:n]);pi=set(np.argsort(-np.asarray(p))[:n])
 return float(len(ai&pi)/n)

def pairwise(a,p):
 a=np.asarray(a,float);p=np.asarray(p,float);ok=tot=0
 for i in range(len(a)):
  for j in range(i+1,len(a)):
   if a[i]==a[j]:continue
   tot+=1;ok+=int((a[i]-a[j])*(p[i]-p[j])>0)
 return None if not tot else float(ok/tot)

def rank_metrics(a,p):
 d=metrics(a,p);d.update({'top12_overlap':top_overlap(a,p,12),'top24_overlap':top_overlap(a,p,24),'pairwise_accuracy':pairwise(a,p)})
 return d

def ridge(alpha=10):
 return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('ridge',Ridge(alpha=alpha))])

def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text())
 if m['snapshot_sha256']!=SNAP:raise RuntimeError('frozen snapshot drift')
 if hashlib.sha256(V04.read_bytes()).hexdigest()!=V04_SHA:raise RuntimeError('v0.4 comparator drift')
 fs=[]
 for y in range(2015,2026):
  d=pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False)
  fs.append(d[d.season_type.eq('REG')].copy())
 w=pd.concat(fs,ignore_index=True)
 p=pd.read_csv(CACHE/'players.csv',low_memory=False)
 v=json.loads(V04.read_text())
 v=pd.DataFrame([{'player_id':x['id'],'target_year':int(x['y']),'position_group':x['pos'],'v04_pred':float(x['pred']),'actual':float(x['act']),'history_count':int(x['hc'])} for x in v])
 return w,p,v,m

def build(w,p,v):
 for c in REQ:
  if c not in w:raise RuntimeError(f'unavailable required target field: {c}')
 for c in REQ:
  q=pd.to_numeric(w[c],errors='coerce')
  if q.isna().any() and w[c].notna().any():raise RuntimeError(f'non-numeric required field: {c}')
  w[c]=q
 if 'player_id' not in w or w.player_id.isna().any():raise RuntimeError('missing player identity')
 te=w[w.position_group.eq('TE')].copy()
 if te.empty:raise RuntimeError('no TE rows')
 if 'recent_team' not in te:raise RuntimeError('team field unavailable for target share')
 te['fantasy']=te.receptions+te.receiving_yards*.1+te.receiving_tds*6
 # player-season summaries
 s=te.groupby(['player_id','season'],as_index=False).agg(games=('week','nunique'),fantasy_prev=('fantasy','sum'),targets=('targets','sum'),receptions=('receptions','sum'),receiving_yards=('receiving_yards','sum'),receiving_tds=('receiving_tds','sum'))
 if s.duplicated(['player_id','season']).any():raise RuntimeError('duplicate player-season identity')
 # team pass-volume proxy: total team targets in weekly source, only where team is known
 team=w[w.recent_team.notna()].groupby(['recent_team','season'],as_index=False).targets.sum().rename(columns={'targets':'team_pass_targets'}) if 'targets' in w else None
 team_te=te.groupby(['player_id','season']).recent_team.agg(lambda x:x.dropna().mode().iloc[0] if not x.dropna().empty else np.nan).reset_index()
 s=s.merge(team_te,on=['player_id','season'],validate='one_to_one')
 s=s.merge(team,on=['recent_team','season'],how='left',validate='many_to_one')
 if s.team_pass_targets.isna().any():raise RuntimeError('unavailable team target volume for TE target share')
 s['target_share']=s.targets/s.team_pass_targets.replace(0,np.nan)
 s['targets_pg']=s.targets/s.games.clip(lower=1);s['fantasy_pg']=s.fantasy_prev/s.games.clip(lower=1)
 s['yards_per_target']=s.receiving_yards/s.targets.replace(0,np.nan);s['catch_rate']=s.receptions/s.targets.replace(0,np.nan)
 s['missed_games']=s.apply(lambda x:(16 if int(x.season)<=2020 else 17)-int(x.games),axis=1)
 # late-season target growth from last four observed regular-season weeks
 late=[]
 for (pid,season),g in te.groupby(['player_id','season']):
  g=g.sort_values('week');tail=g.tail(4);prior=g.iloc[:-4]
  late_pg=float(tail.targets.mean()) if len(tail) else 0.0;early=float(prior.targets.mean()) if len(prior) else late_pg
  late.append((pid,season,late_pg,late_pg-early))
 late=pd.DataFrame(late,columns=['player_id','season','late_targets_pg','late_target_growth'])
 s=s.merge(late,on=['player_id','season'],validate='one_to_one')
 s['prior_rank']=s.groupby('season').fantasy_prev.rank(method='average',ascending=False)
 # metadata; missing optional fields remain missing, but fields used in a model must be numeric or explicitly imputed
 need=['gsis_id','birth_date','rookie_season','draft_year','draft_round','draft_pick']
 if any(c not in p for c in need):raise RuntimeError('required player metadata columns unavailable')
 meta=p[need].copy()
 if meta.gsis_id.dropna().duplicated().any():raise RuntimeError('duplicate metadata identity')
 meta.birth_date=pd.to_datetime(meta.birth_date,errors='coerce')
 for c in ['rookie_season','draft_year','draft_round','draft_pick']:meta[c]=pd.to_numeric(meta[c],errors='coerce')
 # draft consistency: only use draft_pick where state is internally consistent; otherwise leave unavailable
 complete=meta[['draft_year','draft_round','draft_pick']].notna().all(axis=1)
 inconsistent=complete & ((meta.draft_round<1)|(meta.draft_round>7)|(meta.draft_pick<1)|(meta.draft_pick>300)|(meta.draft_year%1!=0)|(meta.draft_round%1!=0)|(meta.draft_pick%1!=0))
 mismatch=complete & meta.rookie_season.notna() & meta.draft_year.ne(meta.rookie_season)
 meta.loc[inconsistent|mismatch,'draft_pick']=np.nan
 s=s.merge(meta,left_on='player_id',right_on='gsis_id',how='left',validate='many_to_one',indicator=True)
 if (s._merge!='both').any():raise RuntimeError('unresolved source-to-player identity')
 s=s.drop(columns='_merge')
 s['age']=s.season-s.birth_date.dt.year
 s['experience']=np.where(s.rookie_season.notna(),s.season-s.rookie_season,np.nan)
 # create target-year rows from prior season only
 x=s.copy();x['target_year']=x.season+1
 x=x.merge(v[v.position_group.eq('TE')][['player_id','target_year','v04_pred','actual','history_count']],on=['player_id','target_year'],how='inner',validate='one_to_one')
 audit={'te_player_seasons':int(len(s)),'paired_v04_rows':int(len(x)),'duplicate_player_seasons':0,'unresolved_player_identity':0,'red_zone_usage_available':False,'snap_role_available':False,'starter_status_inferred':False,'draft_pick_available_rows':int(x.draft_pick.notna().sum()),'experience_available_rows':int(x.experience.notna().sum())}
 return x,audit

def fit_archetype(train,test):
 cols=['targets_pg','target_share','receiving_tds','yards_per_target','catch_rate','late_target_growth']
 imp=SimpleImputer(strategy='median');sc=StandardScaler();A=sc.fit_transform(imp.fit_transform(train[cols]));B=sc.transform(imp.transform(test[cols]))
 k=min(5,max(2,len(train)//35))
 km=KMeans(n_clusters=k,random_state=17,n_init=20).fit(A)
 return km.labels_,km.predict(B),k

def eval_fold(train,test,features,with_arch=False,alpha=10):
 if with_arch:
  atr,ate,k=fit_archetype(train,test);tr=train.copy();te=test.copy();tr['archetype']=atr.astype(str);te['archetype']=ate.astype(str)
  num=features;pre=ColumnTransformer([('num',Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler())]),num),('cat',OneHotEncoder(handle_unknown='ignore'),['archetype'])])
  model=Pipeline([('pre',pre),('ridge',Ridge(alpha=alpha))]);model.fit(tr[num+['archetype']],tr.actual);pred=model.predict(te[num+['archetype']]);return pred,k
 model=ridge(alpha);model.fit(train[features],train.actual);return model.predict(test[features]),None

def evaluate(x):
 rows=[]
 for y in DEV:
  tr=x[x.target_year<y].copy();te=x[x.target_year.eq(y)].copy()
  if len(tr)<45 or len(te)<8:continue
  rows.append({'season':y,'model':'validated_v04','train_n':None,'n':int(len(te)),**rank_metrics(te.actual,te.v04_pred)})
  specs=[('ridge_generic',BASE,False,10),('ridge_role',ROLE,False,10),('ridge_role_light',ROLE,False,30),('empirical_archetype',ROLE,True,20)]
  for name,feats,arch,alpha in specs:
   pred,k=eval_fold(tr,te,feats,arch,alpha)
   r={'season':y,'model':name,'train_n':int(len(tr)),'n':int(len(te)),**rank_metrics(te.actual,pred)}
   if k:r['archetype_count']=k
   rows.append(r)
 return pd.DataFrame(rows)

def relevance_diagnostics(x):
 folds=[]
 feats=ROLE
 for y in DEV:
  tr=x[x.target_year<y].copy();te=x[x.target_year.eq(y)].copy()
  if len(tr)<50 or len(te)<8:continue
  # relevance = actual TE24 within season; breakout = prior rank >24 and actual TE12; collapse = prior rank <=12 and actual rank >24
  for d in [tr,te]:d['actual_rank']=d.groupby('target_year').actual.rank(method='average',ascending=False)
  tr['relevant']=(tr.actual_rank<=24).astype(int);te['relevant']=(te.actual_rank<=24).astype(int)
  if tr.relevant.nunique()<2 or te.relevant.nunique()<2:continue
  m=Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('logit',LogisticRegression(C=.1,max_iter=2000))]);m.fit(tr[feats],tr.relevant);p=m.predict_proba(te[feats])[:,1]
  auc=float(roc_auc_score(te.relevant,p));brier=float(brier_score_loss(te.relevant,p))
  breakout=((te.prior_rank>24)&(te.actual_rank<=12));collapse=((te.prior_rank<=12)&(te.actual_rank>24))
  q75=np.quantile(p,.75);q25=np.quantile(p,.25)
  folds.append({'season':y,'n':int(len(te)),'role_survival_auc':auc,'role_survival_brier':brier,'false_breakout_rate':float(((p>=q75)&~breakout).sum()/max(1,(p>=q75).sum())),'missed_breakout_rate':float(((p<q75)&breakout).sum()/max(1,breakout.sum())),'collapse_identification_rate':float(((p<=q25)&collapse).sum()/max(1,collapse.sum())),'breakout_n':int(breakout.sum()),'collapse_n':int(collapse.sum())})
 return folds

def early_career(x,model_name):
 out={}
 for exp,label in [(0,'year1_to_year2'),(1,'year2_to_year3'),(2,'year3_to_year4')]:
  d=x[x.experience.eq(exp)].copy();folds=[]
  for y in DEV:
   tr=x[x.target_year<y].copy();te=d[d.target_year.eq(y)].copy()
   if len(tr)<45 or len(te)<3:continue
   pred,_=eval_fold(tr,te,ROLE,False,10);base=rank_metrics(te.actual,te.v04_pred);cand=rank_metrics(te.actual,pred)
   folds.append({'season':y,'n':int(len(te)),'candidate_mae':cand['mae'],'v04_mae':base['mae'],'mae_gain_pct':float(100*(base['mae']-cand['mae'])/base['mae']) if base['mae'] else None,'candidate_spearman':cand['spearman'],'v04_spearman':base['spearman']})
  out[label]={'n':int(len(d[d.target_year.isin(DEV)])),'folds':folds,'mean_mae_gain_pct':float(np.mean([f['mae_gain_pct'] for f in folds if f['mae_gain_pct'] is not None])) if folds else None}
 return out

def summarize(df):
 base=df[df.model.eq('validated_v04')];out={}
 for name in [x for x in df.model.unique() if x!='validated_v04']:
  g=df[df.model.eq(name)].merge(base[['season','mae','rmse','spearman','top12_overlap','top24_overlap','pairwise_accuracy']],on='season',suffixes=('','_base'))
  g['mae_gain_pct']=100*(g.mae_base-g.mae)/g.mae_base
  g['top12_delta']=g.top12_overlap-g.top12_overlap_base;g['top24_delta']=g.top24_overlap-g.top24_overlap_base
  out[name]={'folds':int(len(g)),'wins':int((g.mae_gain_pct>0).sum()),'mean_mae_gain_pct':float(g.mae_gain_pct.mean()),'worst_mae_gain_pct':float(g.mae_gain_pct.min()),'mean_spearman_delta':finite((g.spearman-g.spearman_base).mean()),'mean_top12_delta':finite(g.top12_delta.mean()),'mean_top24_delta':finite(g.top24_delta.mean()),'mean_pairwise_delta':finite((g.pairwise_accuracy-g.pairwise_accuracy_base).mean()),'folds_detail':g[['season','n','mae','mae_base','mae_gain_pct','rmse','rmse_base','spearman','spearman_base','top12_overlap','top12_overlap_base','top24_overlap','top24_overlap_base','pairwise_accuracy','pairwise_accuracy_base']].to_dict('records')}
 return out

def retrospective(x,name):
 te=x[x.target_year.eq(RETRO)].copy();tr=x[x.target_year<RETRO].copy()
 if len(te)<8:return {'n':int(len(te)),'status':'insufficient'}
 pred,_=eval_fold(tr,te,ROLE,False,10)
 return {'n':int(len(te)),'status':'retrospective_observed_not_used_for_selection','candidate':rank_metrics(te.actual,pred),'validated_v04':rank_metrics(te.actual,te.v04_pred)}

def main():
 w,p,v,m=load();x,audit=build(w,p,v);df=evaluate(x);s=summarize(df)
 # predeclared gate: >=3 evaluable folds, majority MAE wins, >=3% MAE gain OR >=.04 Spearman gain, no fold worse than -12%, no material top12/top24 deterioration
 candidates=[]
 for name,z in s.items():
  pass_gate=bool(z['folds']>=3 and z['wins']>z['folds']/2 and (z['mean_mae_gain_pct']>=3 or (z['mean_spearman_delta'] or -9)>=.04) and z['worst_mae_gain_pct']>=-12 and (z['mean_top12_delta'] or 0)>=-.08 and (z['mean_top24_delta'] or 0)>=-.08)
  z['candidate_gate_pass']=pass_gate
  if pass_gate:candidates.append(name)
 selected=max(candidates,key=lambda n:(s[n]['mean_mae_gain_pct'],s[n]['mean_spearman_delta'] or -9)) if candidates else None
 decision='READY FOR QA — HIGH RISK' if selected else 'MORE TE RESEARCH REQUIRED'
 rel=relevance_diagnostics(x);early=early_career(x,selected)
 res={'version':'te-specialization-ranking-research-v0.1','input_snapshot_sha256':m['snapshot_sha256'],'validated_v04_player_seasons_sha256':V04_SHA,'development_target_seasons':DEV,'retrospective_observed':RETRO,'control':'validated Projection v0.4 immutable','identity_and_data_audit':audit,'features':{'required_receiving_fields':REQ,'tested_role_features':ROLE,'red_zone_usage_proxy_used':False,'snap_or_starter_proxy_used':False,'true_zero_preserved':True,'missing_unavailable_not_zero_filled':True},'models':s,'selected_candidate':selected,'candidate_gate':{'rule':'>=3 folds; majority MAE wins; >=3% mean MAE gain OR >=0.04 mean Spearman gain; worst MAE fold >= -12%; mean top12/top24 overlap delta >= -0.08'},'early_career':early,'uncertainty':{'role_survival_probability':rel,'prediction_intervals':'diagnostic_not_promoted_in_v0.1','collapse_and_breakout_are_diagnostic_only':True},'archetypes':{'method':'chronology-safe KMeans on standardized TE receiving-role inputs, fit separately inside each training fold; cluster labels have no subjective names','point_model_tested':'empirical_archetype' in s},'retrospective_2025':retrospective(x,selected),'flags':{'experimental':True,'production_projection_eligible':False,'dynasty_value_eligible':False,'production_modified':False,'core_modified':False,'ui_modified':False,'idp_modified':False},'decision':decision}
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(res,sort_keys=True,indent=2,allow_nan=False)+'\n')
 print(decision)
if __name__=='__main__':main()
