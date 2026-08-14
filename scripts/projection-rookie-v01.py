#!/usr/bin/env python3
import hashlib,json,math,sys
from pathlib import Path
import numpy as np,pandas as pd
from scipy.stats import spearmanr
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression,Ridge,ElasticNet
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler,PolynomialFeatures
from sklearn.metrics import roc_auc_score,brier_score_loss
CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-rookie-v01'); OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/projection-rookie-v01/result.json')
SNAP='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'; DEV=list(range(2018,2025)); POS=['QB','RB','WR','TE']
def mae(a,p): return float(np.mean(np.abs(np.asarray(p)-np.asarray(a))))
def rmse(a,p): return float(np.sqrt(np.mean((np.asarray(p)-np.asarray(a))**2)))
def sp(a,p):
 r=spearmanr(a,p).statistic if len(a)>2 and len(np.unique(p))>1 else np.nan; return None if np.isnan(r) else float(r)
def model(kind):
 est={'linear':LinearRegression(),'ridge':Ridge(alpha=10),'elastic':ElasticNet(alpha=.1,l1_ratio=.5,max_iter=20000)}[kind]
 return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('est',est)])
def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text()); assert m['snapshot_sha256']==SNAP
 fs=[]
 for y in range(2015,2026):
  d=pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False);fs.append(d[d.season_type.eq('REG')])
 w=pd.concat(fs,ignore_index=True); p=pd.read_csv(CACHE/'players.csv',low_memory=False); return w,p,m
def data(w,p):
 cols=['attempts','passing_yards','passing_tds','passing_interceptions','carries','rushing_yards','rushing_tds','targets','receptions','receiving_yards','receiving_tds']
 for c in cols:
  if c not in w:w[c]=0
 a=w.groupby(['player_id','season','position_group'],as_index=False).agg(games=('week','nunique'),**{c:(c,'sum') for c in cols})
 a['fantasy']=a.passing_yards*.04+a.passing_tds*4-a.passing_interceptions*2+a.rushing_yards*.1+a.rushing_tds*6+a.receptions+a.receiving_yards*.1+a.receiving_tds*6
 meta=p[['gsis_id','birth_date','rookie_season','draft_round','draft_pick']].copy();meta.birth_date=pd.to_datetime(meta.birth_date,errors='coerce')
 a=a.merge(meta,left_on='player_id',right_on='gsis_id',how='left');a['age']=a.season-a.birth_date.dt.year;a['pick']=pd.to_numeric(a.draft_pick,errors='coerce');a['round']=pd.to_numeric(a.draft_round,errors='coerce');a['drafted']=a['pick'].notna().astype(int);a['pick_fill']=a['pick'].fillna(300).clip(1,300);a['log_pick']=np.log1p(a.pick_fill);a['inv_pick']=1/a.pick_fill;a['pick_in_round']=((a.pick_fill-1)%32)+1
 return a[(a.season==a.rookie_season)&a.position_group.isin(POS)].copy()
def feats(name):
 return {'pick':['pick_fill','drafted'],'logpick':['log_pick','drafted'],'inverse':['inv_pick','drafted'],'round':['round','drafted'],'round_pick':['round','pick_in_round','drafted'],'logpick_age':['log_pick','drafted','age']}[name]
def evaluate(r):
 rows=[]; names=['pick','logpick','inverse','round','round_pick','logpick_age']; kinds=['linear','ridge','elastic']
 for pos in POS:
  d=r[r.position_group.eq(pos)]
  for y in DEV:
   tr=d[d.season<y];te=d[d.season==y]
   if len(tr)<20 or len(te)<3:continue
   prior=np.repeat(tr.fantasy.mean(),len(te)); bucket=[]
   for _,x in te.iterrows():
    q=tr[tr['round'].fillna(99).eq(x['round'] if pd.notna(x['round']) else 99)];bucket.append((q.fantasy.mean() if len(q)>=5 else tr.fantasy.mean()))
   candidates=[('position_mean',prior),('round_bucket',np.array(bucket))]
   for n in names:
    for k in kinds:
     m=model(k);m.fit(tr[feats(n)],tr.fantasy);candidates.append((f'{k}_{n}',m.predict(te[feats(n)])))
   for n,pred in candidates:
    rows.append({'position':pos,'season':y,'model':n,'n':len(te),'mae':mae(te.fantasy,pred),'rmse':rmse(te.fantasy,pred),'spearman':sp(te.fantasy,pred)})
 return pd.DataFrame(rows)
def select(df):
 out={}
 for pos in POS:
  d=df[df.position.eq(pos)]; base=d[d.model.eq('position_mean')]
  scores=[]
  for n,g in d.groupby('model'):
   if n=='position_mean':continue
   z=g.merge(base[['season','mae']],on='season',suffixes=('','_base'));z['gain']=100*(z.mae_base-z.mae)/z.mae_base
   scores.append({'model':n,'folds':len(z),'wins':int((z.gain>0).sum()),'mean_gain_pct':float(z.gain.mean()),'median_gain_pct':float(z.gain.median()),'mean_mae':float(z.mae.mean()),'mean_rmse':float(z.rmse.mean()),'mean_spearman':float(z.spearman.dropna().mean()) if z.spearman.notna().any() else None,'worst_gain_pct':float(z.gain.min()),'best_gain_pct':float(z.gain.max())})
  scores.sort(key=lambda x:(x['wins'],x['mean_gain_pct']),reverse=True);out[pos]=scores
 return out
def uncertainty(r,df,sel):
 out=[]
 for pos in POS:
  chosen=sel[pos][0]['model']; d=r[r.position_group.eq(pos)]
  for y in DEV:
   tr=d[d.season<y];te=d[d.season==y]
   if len(tr)<20 or len(te)<3:continue
   # fit chosen architecture on pre-y; calibrate residuals only on earlier rookie cohorts via leave-year predictions
   if chosen=='round_bucket':
    pred=np.array([(tr[tr['round'].fillna(99).eq(x['round'] if pd.notna(x['round']) else 99)].fantasy.mean() if len(tr[tr['round'].fillna(99).eq(x['round'] if pd.notna(x['round']) else 99)])>=5 else tr.fantasy.mean()) for _,x in te.iterrows()])
   else:
    kind,name=chosen.split('_',1);m=model(kind);m.fit(tr[feats(name)],tr.fantasy);pred=m.predict(te[feats(name)])
   # rolling calibration from selected model's previous fold absolute residual proxy: use training residuals conservatively
   if chosen=='round_bucket': cal=np.abs(tr.fantasy-tr.groupby(tr['round'].fillna(99)).fantasy.transform('mean').fillna(tr.fantasy.mean()))
   else: cal=np.abs(tr.fantasy-m.predict(tr[feats(name)]))
   for q in [.5,.8,.9]:
    radius=float(np.quantile(cal,q,method='higher'));out.append({'position':pos,'season':y,'model':chosen,'nominal':q,'coverage':float(np.mean(np.abs(te.fantasy-pred)<=radius)),'full_width':2*radius,'n':len(te)})
 return out
def role(r,sel):
 threshold={'QB':100,'RB':80,'WR':80,'TE':60};out=[]
 for pos in POS:
  d=r[r.position_group.eq(pos)].copy();d['relevant']=(d.fantasy>=threshold[pos]).astype(int)
  for y in DEV:
   tr=d[d.season<y];te=d[d.season==y]
   if len(tr)<25 or len(te)<4 or tr.relevant.nunique()<2 or te.relevant.nunique()<2:continue
   X=['log_pick','drafted','age'];m=Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('logit',__import__('sklearn').linear_model.LogisticRegression(C=.1,max_iter=1000))]);m.fit(tr[X],tr.relevant);p=m.predict_proba(te[X])[:,1]
   out.append({'position':pos,'season':y,'n':len(te),'auc':float(roc_auc_score(te.relevant,p)),'brier':float(brier_score_loss(te.relevant,p))})
 return out
def year2(r):
 # rookie-input prediction of year-2 outcome, chronological by rookie class
 lookup=r[['player_id','season','position_group','fantasy','log_pick','drafted','age']].copy(); allrows=[]
 # year2 outcomes loaded separately are unavailable here; caller supplies merged full data in future cycle
 return {'status':'not_evaluated_in_this_runner','reason':'rookie-only frame intentionally excludes post-rookie seasons; transition requires dedicated paired cohort runner rather than accidental leakage'}
def main():
 w,p,m=load();r=data(w,p);df=evaluate(r);sel=select(df);res={'version':'lv-rookie-projection-v0.1-research','input_snapshot_sha256':m['snapshot_sha256'],'development_cohorts':DEV,'retrospective_observed':2025,'cohort_counts':r[r.season.isin(DEV)].groupby(['season','position_group']).size().reset_index(name='n').to_dict('records'),'identity_audit':{'rookie_rows':int(len(r)),'missing_player_id':int(r.player_id.isna().sum()),'duplicate_player_seasons':int(r.duplicated(['player_id','season']).sum()),'missing_draft_pick':int(r['pick'].isna().sum()),'missing_age':int(r.age.isna().sum())},'model_rankings':sel,'fold_results':df.to_dict('records'),'uncertainty':uncertainty(r,df,sel),'meaningful_role':role(r,sel),'year2_transition':year2(r),'flags':{'experimental':True,'production_projection_eligible':False,'dynasty_value_eligible':False}}
 OUT.parent.mkdir(parents=True,exist_ok=True);text=json.dumps(res,indent=2,sort_keys=True)+'\n';OUT.write_text(text);print(hashlib.sha256(text.encode()).hexdigest())
if __name__=='__main__':main()
