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
SNAP='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188';V04_SHA='9e329e7901ecb8e925d5f5aae695dadc30195b33e67f3943177dc13087b45ab0'
DEV=list(range(2020,2025));RETRO=2025;REQ=['targets','receptions','receiving_yards','receiving_tds']
BASE=['fantasy_prev','fantasy_pg','targets','targets_pg','receptions','receiving_yards','receiving_tds','games','missed_games','prior_rank']
ROLE=BASE+['late_targets_pg','late_target_growth','yards_per_target','catch_rate','age','experience'];ROLE_DRAFT=ROLE+['draft_pick']
def finite(v):return None if v is None or not math.isfinite(float(v)) else float(v)
def metrics(a,p):
 a=np.asarray(a,float);p=np.asarray(p,float);r=spearmanr(a,p).statistic if len(a)>2 and len(np.unique(p))>1 else np.nan
 return {'mae':float(np.mean(np.abs(a-p))),'rmse':float(np.sqrt(np.mean((a-p)**2))),'spearman':None if np.isnan(r) else float(r)}
def top(a,p,n):
 n=min(n,len(a));return None if n==0 else float(len(set(np.argsort(-np.asarray(a))[:n])&set(np.argsort(-np.asarray(p))[:n]))/n)
def pair(a,p):
 ok=tot=0;a=np.asarray(a,float);p=np.asarray(p,float)
 for i in range(len(a)):
  for j in range(i+1,len(a)):
   if a[i]==a[j]:continue
   tot+=1;ok+=int((a[i]-a[j])*(p[i]-p[j])>0)
 return None if not tot else float(ok/tot)
def rankmet(a,p):
 d=metrics(a,p);d.update(top12_overlap=top(a,p,12),top24_overlap=top(a,p,24),pairwise_accuracy=pair(a,p));return d
def ridge(alpha=10):return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('ridge',Ridge(alpha=alpha))])
def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text());assert m['snapshot_sha256']==SNAP
 if hashlib.sha256(V04.read_bytes()).hexdigest()!=V04_SHA:raise RuntimeError('v0.4 comparator drift')
 w=pd.concat([pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False).query("season_type == 'REG'") for y in range(2015,2026)],ignore_index=True)
 p=pd.read_csv(CACHE/'players.csv',low_memory=False);v=json.loads(V04.read_text())
 v=pd.DataFrame([{'player_id':x['id'],'target_year':int(x['y']),'position_group':x['pos'],'v04_pred':float(x['pred']),'actual':float(x['act'])} for x in v]);return w,p,v,m
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
 need=['gsis_id','birth_date','rookie_season','draft_year','draft_round','draft_pick'];meta=p[need].copy()
 if meta.gsis_id.dropna().duplicated().any():raise RuntimeError('duplicate metadata identity')
 meta.birth_date=pd.to_datetime(meta.birth_date,errors='coerce')
 for c in ['rookie_season','draft_year','draft_round','draft_pick']:meta[c]=pd.to_numeric(meta[c],errors='coerce')
 present=meta[['draft_year','draft_round','draft_pick']].notna().sum(axis=1);meta['draft_state']=np.select([present.eq(3),present.eq(0)],['COMPLETE','UNAVAILABLE'],default='INCONSISTENT_PARTIAL');c=meta.draft_state.eq('COMPLETE');bad=c&((meta.draft_round<1)|(meta.draft_round>7)|(meta.draft_pick<1)|(meta.draft_pick>300));mismatch=c&meta.rookie_season.notna()&meta.draft_year.ne(meta.rookie_season);meta.loc[bad,'draft_state']='INCONSISTENT_VALUE';meta.loc[mismatch,'draft_state']='INCONSISTENT_DRAFT_YEAR'
 s=s.merge(meta,left_on='player_id',right_on='gsis_id',how='left',validate='many_to_one',indicator=True)
 if (s._merge!='both').any():raise RuntimeError('unresolved source identity')
 s=s.drop(columns='_merge');s['age']=s.season-s.birth_date.dt.year;s['experience']=np.where(s.rookie_season.notna(),s.season-s.rookie_season,np.nan);x=s.copy();x['target_year']=x.season+1;x=x.merge(v[v.position_group.eq('TE')][['player_id','target_year','v04_pred','actual']],on=['player_id','target_year'],validate='one_to_one')
 audit={'te_player_seasons':int(len(s)),'paired_v04_rows':int(len(x)),'duplicate_player_seasons':0,'unresolved_player_identity':0,'team_pass_volume_available':False,'target_share_available':False,'red_zone_usage_available':False,'snap_role_available':False,'starter_status_inferred':False,'draft_complete_rows':int((x.draft_state=='COMPLETE').sum()),'draft_unavailable_rows':int((x.draft_state=='UNAVAILABLE').sum()),'draft_inconsistent_rows':int(x.draft_state.str.startswith('INCONSISTENT').sum())};return x,audit
def archetype(tr,te):
 cols=['targets_pg','receiving_tds','yards_per_target','catch_rate','late_target_growth'];imp=SimpleImputer(strategy='median');sc=StandardScaler();A=sc.fit_transform(imp.fit_transform(tr[cols]));B=sc.transform(imp.transform(te[cols]));k=min(5,max(2,len(tr)//35));m=KMeans(n_clusters=k,random_state=17,n_init=20).fit(A);return m.labels_,m.predict(B),k
def predict(tr,te,features,arch=False,alpha=10):
 if not arch:m=ridge(alpha);m.fit(tr[features],tr.actual);return m.predict(te[features]),None
 a,b,k=archetype(tr,te);tr=tr.copy();te=te.copy();tr['arch']=a.astype(str);te['arch']=b.astype(str);pre=ColumnTransformer([('n',Pipeline([('i',SimpleImputer(strategy='median')),('s',StandardScaler())]),features),('c',OneHotEncoder(handle_unknown='ignore'),['arch'])]);m=Pipeline([('p',pre),('r',Ridge(alpha=alpha))]);m.fit(tr[features+['arch']],tr.actual);return m.predict(te[features+['arch']]),k
def evaluate(x):
 rows=[]
 for y in DEV:
  tr=x[x.target_year<y];te=x[x.target_year.eq(y)]
  if len(tr)<45 or len(te)<8:continue
  rows.append({'season':y,'model':'validated_v04','n':int(len(te)),**rankmet(te.actual,te.v04_pred)})
  for name,f,a,al in [('ridge_generic',BASE,False,10),('ridge_role',ROLE,False,10),('ridge_role_light',ROLE,False,30),('empirical_archetype',ROLE,True,20)]:
   pr,k=predict(tr,te,f,a,al);r={'season':y,'model':name,'n':int(len(te)),**rankmet(te.actual,pr)};rows.append(r)
  trd=tr[tr.draft_state.eq('COMPLETE')];ted=te[te.draft_state.eq('COMPLETE')]
  if len(trd)>=45 and len(ted)>=8:pr,_=predict(trd,ted,ROLE_DRAFT);rows.append({'season':y,'model':'ridge_role_draft_complete','n':int(len(ted)),**rankmet(ted.actual,pr)})
 return pd.DataFrame(rows)
def summarize(df):
 b=df[df.model.eq('validated_v04')];out={}
 for n in [x for x in df.model.unique() if x!='validated_v04']:
  g=df[df.model.eq(n)].merge(b,on='season',suffixes=('','_base'));g['gain']=100*(g.mae_base-g.mae)/g.mae_base;g['d12']=g.top12_overlap-g.top12_overlap_base;g['d24']=g.top24_overlap-g.top24_overlap_base
  out[n]={'folds':int(len(g)),'wins':int((g.gain>0).sum()),'mean_mae_gain_pct':float(g.gain.mean()),'worst_mae_gain_pct':float(g.gain.min()),'mean_spearman_delta':finite((g.spearman-g.spearman_base).mean()),'mean_top12_delta':finite(g.d12.mean()),'mean_top24_delta':finite(g.d24.mean()),'mean_pairwise_delta':finite((g.pairwise_accuracy-g.pairwise_accuracy_base).mean()),'folds_detail':g[['season','n','mae','mae_base','gain','rmse','rmse_base','spearman','spearman_base','top12_overlap','top12_overlap_base','top24_overlap','top24_overlap_base','pairwise_accuracy','pairwise_accuracy_base']].to_dict('records')}
 return out
def uncertainty(x):
 z=[]
 for y in DEV:
  tr=x[x.target_year<y].copy();te=x[x.target_year.eq(y)].copy()
  if len(tr)<50 or len(te)<8:continue
  for d in [tr,te]:d['rank']=d.groupby('target_year').actual.rank(ascending=False)
  tr['rel']=(tr['rank']<=24).astype(int);te['rel']=(te['rank']<=24).astype(int)
  if tr.rel.nunique()<2 or te.rel.nunique()<2:continue
  m=Pipeline([('i',SimpleImputer(strategy='median')),('s',StandardScaler()),('l',LogisticRegression(C=.1,max_iter=2000))]);m.fit(tr[ROLE],tr.rel);p=m.predict_proba(te[ROLE])[:,1];z.append({'season':y,'n':int(len(te)),'role_survival_auc':float(roc_auc_score(te.rel,p)),'role_survival_brier':float(brier_score_loss(te.rel,p))})
 return z
def early(x):
 out={}
 for e,label in [(0,'year1_to_year2'),(1,'year2_to_year3'),(2,'year3_to_year4')]:
  fs=[]
  for y in DEV:
   tr=x[x.target_year<y];te=x[(x.target_year==y)&(x.experience==e)]
   if len(tr)>=45 and len(te)>=3:pr,_=predict(tr,te,ROLE);c=rankmet(te.actual,pr);b=rankmet(te.actual,te.v04_pred);fs.append({'season':y,'n':int(len(te)),'candidate_mae':c['mae'],'v04_mae':b['mae'],'mae_gain_pct':100*(b['mae']-c['mae'])/b['mae'],'candidate_spearman':c['spearman'],'v04_spearman':b['spearman']})
  out[label]={'n':int(sum(f['n'] for f in fs)),'folds':fs,'mean_mae_gain_pct':float(np.mean([f['mae_gain_pct'] for f in fs])) if fs else None}
 return out
def main():
 w,p,v,m=load();x,a=build(w,p,v);s=summarize(evaluate(x));cand=[]
 for n,z in s.items():
  ok=n!='ridge_role_draft_complete' and z['folds']>=3 and z['wins']>z['folds']/2 and (z['mean_mae_gain_pct']>=3 or (z['mean_spearman_delta'] or -9)>=.04) and z['worst_mae_gain_pct']>=-12 and (z['mean_top12_delta'] if z['mean_top12_delta'] is not None else -9)>=-.08 and (z['mean_top24_delta'] if z['mean_top24_delta'] is not None else -9)>=-.08;z['candidate_gate_pass']=bool(ok);cand+=([n] if ok else [])
 selected=max(cand,key=lambda n:(s[n]['mean_mae_gain_pct'],s[n]['mean_spearman_delta'] or -9)) if cand else None;decision='READY FOR QA — HIGH RISK' if selected else 'MORE TE RESEARCH REQUIRED';te=x[x.target_year.eq(RETRO)];tr=x[x.target_year<RETRO];pr,_=predict(tr,te,ROLE)
 r={'version':'te-specialization-ranking-research-v0.1','input_snapshot_sha256':m['snapshot_sha256'],'validated_v04_player_seasons_sha256':V04_SHA,'development_target_seasons':DEV,'retrospective_observed':RETRO,'control':'validated Projection v0.4 immutable','identity_and_data_audit':a,'features':{'tested_role_features':ROLE,'team_pass_volume_and_target_share':'unavailable in frozen weekly schema; not inferred','red_zone_usage_proxy_used':False,'snap_or_starter_proxy_used':False,'draft_capital':'diagnostic only on COMPLETE consistent rows','true_zero_preserved':True,'missing_unavailable_not_zero_filled':True},'models':s,'selected_candidate':selected,'candidate_gate':{'rule':'>=3 full-cohort folds; majority MAE wins; >=3% mean MAE gain OR >=0.04 Spearman gain; worst fold >=-12%; mean top12/top24 delta >=-0.08'},'early_career':early(x),'uncertainty':{'role_survival_probability':uncertainty(x),'collapse_breakout':'research diagnostic only; no point multiplier'},'archetypes':{'method':'per-fold KMeans on empirical TE receiving-role features; no subjective labels'},'retrospective_2025':{'n':int(len(te)),'status':'retrospective_observed_not_used_for_selection','candidate_role_model':rankmet(te.actual,pr),'validated_v04':rankmet(te.actual,te.v04_pred)},'flags':{'experimental':True,'production_projection_eligible':False,'dynasty_value_eligible':False,'production_modified':False,'core_modified':False,'ui_modified':False,'idp_modified':False},'decision':decision};OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(r,sort_keys=True,indent=2,allow_nan=False)+'\n');print(decision)
if __name__=='__main__':main()
