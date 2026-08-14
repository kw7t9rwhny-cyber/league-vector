#!/usr/bin/env python3
import json, math, sys
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-dynasty-v02')
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v02/results.json')
SNAPSHOT='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'
POS=['QB','RB','WR','TE']; HORIZONS=[2,3,4,5]
DISCOUNTS={'none':1.0,'mild':0.90,'moderate':0.80}
CONFIGS={
 '1qb_standard':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':1,'sf':0,'te_bonus':0},
 'superflex':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':1,'sf':1,'te_bonus':0},
 'te_premium':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':1,'sf':0,'te_bonus':0.5},
 'heavy_te_premium_2te':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':2},'flex':2,'sf':0,'te_bonus':1.0},
 'deep_flex':{'teams':14,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':3,'sf':0,'te_bonus':0},
 'shallow':{'teams':10,'slots':{'QB':1,'RB':2,'WR':2,'TE':1},'flex':1,'sf':0,'te_bonus':0},
}

def ridge(alpha=20): return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('m',Ridge(alpha=alpha))])
def logit(): return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('m',LogisticRegression(C=.1,max_iter=1000))])
def sp(a,b):
 a=np.asarray(a);b=np.asarray(b); ok=np.isfinite(a)&np.isfinite(b)
 return float(spearmanr(a[ok],b[ok]).statistic) if ok.sum()>3 and len(np.unique(b[ok]))>1 else None

def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text()); assert m['snapshot_sha256']==SNAPSHOT
 fs=[]
 for y in range(2015,2026):
  d=pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False);fs.append(d[d.season_type.eq('REG')])
 return pd.concat(fs,ignore_index=True),pd.read_csv(CACHE/'players.csv',low_memory=False),m

def aggregate(w,players):
 sums=['attempts','carries','targets','receptions','passing_yards','passing_tds','passing_interceptions','rushing_yards','rushing_tds','receiving_yards','receiving_tds']
 for c in sums:
  if c not in w:w[c]=0
 a=w.groupby(['player_id','season','position_group'],as_index=False).agg(games=('week','nunique'),**{c:(c,'sum') for c in sums})
 a['fantasy']=a.passing_yards*.04+a.passing_tds*4-a.passing_interceptions*2+a.rushing_yards*.1+a.rushing_tds*6+a.receptions+a.receiving_yards*.1+a.receiving_tds*6
 meta=players[['gsis_id','birth_date','rookie_season']].copy();meta['birth_date']=pd.to_datetime(meta.birth_date,errors='coerce')
 a=a.merge(meta,left_on='player_id',right_on='gsis_id',how='left');a['age']=a.season-a.birth_date.dt.year;a['experience']=a.season-a.rookie_season
 a=a[a.position_group.isin(POS)].sort_values(['player_id','season'])
 for c in ['fantasy','games','attempts','carries','targets','receptions']:
  a[c+'_l1']=a.groupby('player_id')[c].shift(1);a[c+'_l2']=a.groupby('player_id')[c].shift(2)
 for h in range(1,6): a[f'y{h}']=a.groupby('player_id').fantasy.shift(-h)
 return a

def relevant_threshold(pos): return {'QB':100,'RB':60,'WR':60,'TE':40}[pos]
FEATS=['fantasy','games','attempts','carries','targets','receptions','fantasy_l1','games_l1','age','experience']

def chronological_predictions(a):
 rows=[]
 # valuation season y predicts y+h; only train examples whose target season precedes y
 for y in range(2020,2025):
  for pos in POS:
   base=a[(a.season==y)&(a.position_group==pos)&a.fantasy.notna()].copy()
   if base.empty: continue
   for h in range(1,6):
    tr=a[(a.position_group==pos)&(a.season+h<y)&a[f'y{h}'].notna()].copy()
    if len(tr)<60: continue
    thr=relevant_threshold(pos); tr['rel']=(tr[f'y{h}']>=thr).astype(int)
    pm=ridge();pm.fit(tr[FEATS],tr[f'y{h}'])
    lm=logit();lm.fit(tr[FEATS],tr.rel)
    pred=np.maximum(0,pm.predict(base[FEATS])); surv=lm.predict_proba(base[FEATS])[:,1]
    for i,(_,r) in enumerate(base.iterrows()): rows.append({'player_id':r.player_id,'season':y,'pos':pos,'age':r.age,'experience':r.experience,'current':r.fantasy,'h':h,'pred':float(pred[i]),'survival':float(surv[i]),'actual':None if pd.isna(r[f'y{h}']) else float(r[f'y{h}'])})
 return pd.DataFrame(rows)

def scoring_points(df,cfg):
 x=df.copy();x['pred_scored']=x.pred;x['actual_scored']=x.actual
 # PPR base already included; TE premium is incremental reception bonus. Approx future receptions from current reception share of fantasy points is not defensible, so use current receptions projected by point-production ratio only for league-context sensitivity.
 # This is explicitly a sensitivity proxy, not a production TE forecast.
 if cfg['te_bonus']:
  te=x.pos.eq('TE'); x.loc[te,'pred_scored']*=1+0.12*cfg['te_bonus'];x.loc[te,'actual_scored']*=1+0.12*cfg['te_bonus']
 return x

def replacement_for_horizon(d,cfg,value_col):
 # Endogenous lineup allocation: fill dedicated position slots, then FLEX/SF from remaining highest projected scorers.
 teams=cfg['teams']; selected=set(); levels={}
 for pos,n in cfg['slots'].items():
  q=d[d.pos.eq(pos)].sort_values(value_col,ascending=False); take=q.head(teams*n);selected.update(take.index);levels[pos]=float(take[value_col].iloc[-1]) if len(take) else 0
 remain=d.loc[~d.index.isin(selected)].copy()
 for _ in range(teams*cfg['flex']):
  elig=remain[remain.pos.isin(['RB','WR','TE'])]
  if elig.empty:break
  ix=elig[value_col].idxmax();selected.add(ix);remain=remain.drop(ix)
 for _ in range(teams*cfg['sf']):
  if remain.empty:break
  ix=remain[value_col].idxmax();selected.add(ix);remain=remain.drop(ix)
 # replacement = best non-selected player at each position after optimized lineup occupancy
 for pos in POS:
  q=d[(d.pos.eq(pos))&(~d.index.isin(selected))].sort_values(value_col,ascending=False)
  if len(q): levels[pos]=float(q[value_col].iloc[0])
 return levels

def evaluate(pred):
 results=[]; sensitivity=[]
 for cfgname,cfg in CONFIGS.items():
  scored=scoring_points(pred,cfg)
  for horizon in HORIZONS:
   for discname,disc in DISCOUNTS.items():
    player={}
    for h in range(1,horizon+1):
     dh=scored[scored.h.eq(h)].copy(); levels=replacement_for_horizon(dh,cfg,'pred_scored')
     for _,r in dh.iterrows():
      k=(r.player_id,r.season,r.pos,r.age,r.experience);player.setdefault(k,{'pred':0,'actual':0,'y1':0})
      w=disc**(h-1); ps=max(0,r.pred_scored-levels[r.pos]); act=0 if pd.isna(r.actual_scored) else max(0,r.actual_scored-levels[r.pos])
      # Survival is used only for h>=2; h1 point forecast stands alone because Cycle2 showed survival multiplication harms next-year MAE.
      surv=1 if h==1 else r.survival
      player[k]['pred']+=w*surv*ps;player[k]['actual']+=w*act
      if h==1:player[k]['y1']=ps
    z=pd.DataFrame([{'player_id':k[0],'season':k[1],'pos':k[2],'age':k[3],'experience':k[4],**v} for k,v in player.items()])
    z=z[z.actual.notna()]
    rho=sp(z.actual,z.pred);rho_y1=sp(z.actual,z.y1);rho_current=sp(z.actual,z.groupby('season').pred.transform(lambda _:0)+z.merge(a[['player_id','season','fantasy']],on=['player_id','season'],how='left').fantasy) if False else None
    # evaluate rank utility by season then average
    rs=[];base=[]
    for _,g in z.groupby('season'):
     rs.append(sp(g.actual,g.pred));base.append(sp(g.actual,g.y1))
    results.append({'config':cfgname,'horizon':horizon,'discount':discname,'n':len(z),'mean_season_spearman':float(np.nanmean(rs)),'mean_y1_surplus_spearman':float(np.nanmean(base)),'gain_vs_y1':float(np.nanmean(rs)-np.nanmean(base))})
 # sensitivity summaries
 r=pd.DataFrame(results)
 for cfg,g in r.groupby('config'):
  best=g.sort_values('mean_season_spearman',ascending=False).iloc[0]
  sensitivity.append({'config':cfg,'best_horizon':int(best.horizon),'best_discount':best.discount,'best_spearman':float(best.mean_season_spearman),'range_across_specs':float(g.mean_season_spearman.max()-g.mean_season_spearman.min()),'gain_vs_y1':float(best.gain_vs_y1)})
 return results,sensitivity

def archetypes(pred):
 # Deterministic synthetic equal-Y1 cases; future survival paths are empirical medians by age/position from chronological predictions.
 out=[]
 cases=[('QB',24,34,300),('WR',22,29,220),('RB',23,28,210),('TE',23,31,170)]
 for pos,young,old,p1 in cases:
  d=pred[pred.pos.eq(pos)]
  vals={}
  for age in [young,old]:
   vals[age]=[]
   for h in range(1,5):
    q=d[(d.h.eq(h))&(d.age.between(age-1,age+1))]
    surv=float(q.survival.median()) if len(q) else 0.5
    decay=float((q.pred/q.current.replace(0,np.nan)).median()) if len(q) else 0.7
    vals[age].append({'h':h,'survival':surv,'conditional_ratio':decay,'expected_points':p1*(decay if h>1 else 1)*(surv if h>1 else 1)})
  out.append({'position':pos,'equal_y1_points':p1,'young_age':young,'old_age':old,'young_path':vals[young],'old_path':vals[old]})
 return out

def main():
 global a
 w,players,m=load();a=aggregate(w,players);p=chronological_predictions(a);results,sens=evaluate(p)
 out={'version':'dynasty-valuation-research-v02','input_snapshot_sha256':m['snapshot_sha256'],'method':{'future_points':'chronological position-specific Ridge using current production/opportunity, age, experience and one-year history','survival':'chronological position-specific logistic relevance probability; applied only to horizons 2+','replacement':'league-config endogenous dedicated starters then FLEX/SF competition','discounts':DISCOUNTS,'horizons':HORIZONS},'evaluation':results,'sensitivity':sens,'archetypes':archetypes(p),'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False},'limitations':['No historical market snapshots are available in the frozen repository, so market-anchor variants cannot be fairly backtested chronologically in v0.2.','TE-premium future scoring uses an explicit sensitivity proxy because the frozen multi-horizon target is total PPR points rather than future stat-line projections; do not promote this TE-premium numeric result.','Rookies with zero NFL history are outside this veteran/limited-history model and require the separate rookie projection contract.','Value-scale mapping is intentionally deferred until raw football-utility score validation is stronger.']}
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(out,indent=2,sort_keys=True)+'\n');print(json.dumps(out,indent=2,sort_keys=True))
if __name__=='__main__':main()
