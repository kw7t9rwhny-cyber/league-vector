#!/usr/bin/env python3
# Experimental only; production_dynasty_value_eligible=false
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
CONFIGS={'1qb_standard':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':1,'sf':0,'te_bonus':0},'superflex':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':1,'sf':1,'te_bonus':0},'te_premium':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':1,'sf':0,'te_bonus':0.5},'heavy_te_premium_2te':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':2},'flex':2,'sf':0,'te_bonus':1.0},'deep_flex':{'teams':14,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':3,'sf':0,'te_bonus':0},'shallow':{'teams':10,'slots':{'QB':1,'RB':2,'WR':2,'TE':1},'flex':1,'sf':0,'te_bonus':0}}
def ridge(alpha=20): return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('m',Ridge(alpha=alpha))])
def logit(): return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('m',LogisticRegression(C=.1,max_iter=1000))])
def sp(a,b):
 a=np.asarray(a);b=np.asarray(b);ok=np.isfinite(a)&np.isfinite(b)
 return float(spearmanr(a[ok],b[ok]).statistic) if ok.sum()>3 and len(np.unique(b[ok]))>1 else None
def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text());assert m['snapshot_sha256']==SNAPSHOT
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
 meta=players[['gsis_id','birth_date','rookie_season']].copy();meta['birth_date']=pd.to_datetime(meta.birth_date,errors='coerce');a=a.merge(meta,left_on='player_id',right_on='gsis_id',how='left');a['age']=a.season-a.birth_date.dt.year;a['experience']=a.season-a.rookie_season;a=a[a.position_group.isin(POS)].sort_values(['player_id','season'])
 for c in ['fantasy','games','attempts','carries','targets','receptions']:
  a[c+'_l1']=a.groupby('player_id')[c].shift(1)
 for h in range(1,6):a[f'y{h}']=a.groupby('player_id').fantasy.shift(-h)
 return a
FEATS=['fantasy','games','attempts','carries','targets','receptions','fantasy_l1','games_l1','age','experience']
def threshold(p):return {'QB':100,'RB':60,'WR':60,'TE':40}[p]
def predictions(a):
 rows=[]
 for y in range(2020,2025):
  for pos in POS:
   base=a[(a.season==y)&(a.position_group==pos)].copy()
   for h in range(1,6):
    tr=a[(a.position_group==pos)&(a.season+h<y)&a[f'y{h}'].notna()].copy()
    if len(tr)<60 or base.empty:continue
    tr['rel']=(tr[f'y{h}']>=threshold(pos)).astype(int);pm=ridge();pm.fit(tr[FEATS],tr[f'y{h}']);lm=logit();lm.fit(tr[FEATS],tr.rel);pp=np.maximum(0,pm.predict(base[FEATS]));ss=lm.predict_proba(base[FEATS])[:,1]
    for i,(_,r) in enumerate(base.iterrows()):rows.append({'player_id':r.player_id,'season':y,'pos':pos,'age':r.age,'experience':r.experience,'current':r.fantasy,'h':h,'pred':float(pp[i]),'survival':float(ss[i]),'actual':None if pd.isna(r[f'y{h}']) else float(r[f'y{h}'])})
 return pd.DataFrame(rows)
def score(d,cfg):
 x=d.copy();x['pred_scored']=x.pred;x['actual_scored']=x.actual
 if cfg['te_bonus']:
  te=x.pos.eq('TE');x.loc[te,'pred_scored']*=1+0.12*cfg['te_bonus'];x.loc[te,'actual_scored']*=1+0.12*cfg['te_bonus']
 return x
def repl(d,cfg,col):
 teams=cfg['teams'];sel=set();levels={}
 for pos,n in cfg['slots'].items():
  q=d[d.pos.eq(pos)].sort_values(col,ascending=False);take=q.head(teams*n);sel.update(take.index);levels[pos]=float(take[col].iloc[-1]) if len(take) else 0
 remain=d.loc[~d.index.isin(sel)].copy()
 for _ in range(teams*cfg['flex']):
  e=remain[remain.pos.isin(['RB','WR','TE'])]
  if e.empty:break
  ix=e[col].idxmax();sel.add(ix);remain=remain.drop(ix)
 for _ in range(teams*cfg['sf']):
  if remain.empty:break
  ix=remain[col].idxmax();sel.add(ix);remain=remain.drop(ix)
 for pos in POS:
  q=d[(d.pos.eq(pos))&(~d.index.isin(sel))].sort_values(col,ascending=False)
  if len(q):levels[pos]=float(q[col].iloc[0])
 return levels
def evaluate(p):
 out=[]
 for cn,cfg in CONFIGS.items():
  s=score(p,cfg)
  for H in HORIZONS:
   for dn,disc in DISCOUNTS.items():
    players={}
    for h in range(1,H+1):
     dh=s[s.h.eq(h)].copy();levels=repl(dh,cfg,'pred_scored')
     for _,r in dh.iterrows():
      k=(r.player_id,r.season,r.pos,r.age,r.experience);players.setdefault(k,{'pred':0,'actual':0,'y1':0,'current':r.current})
      w=disc**(h-1);surv=1 if h==1 else r.survival;players[k]['pred']+=w*surv*max(0,r.pred_scored-levels[r.pos]);players[k]['actual']+=w*(0 if pd.isna(r.actual_scored) else max(0,r.actual_scored-levels[r.pos]));players[k]['y1']+=max(0,r.pred_scored-levels[r.pos]) if h==1 else 0
    z=pd.DataFrame([{'player_id':k[0],'season':k[1],'pos':k[2],'age':k[3],'experience':k[4],**v} for k,v in players.items()]);rs=[];b1=[];bc=[]
    for _,g in z.groupby('season'):rs.append(sp(g.actual,g.pred));b1.append(sp(g.actual,g.y1));bc.append(sp(g.actual,g.current))
    out.append({'config':cn,'horizon':H,'discount':dn,'n':len(z),'mean_season_spearman':float(np.nanmean(rs)),'y1_surplus_spearman':float(np.nanmean(b1)),'current_points_spearman':float(np.nanmean(bc)),'gain_vs_y1':float(np.nanmean(rs)-np.nanmean(b1))})
 r=pd.DataFrame(out);sens=[]
 for cfg,g in r.groupby('config'):
  b=g.sort_values('mean_season_spearman',ascending=False).iloc[0];sens.append({'config':cfg,'best_horizon':int(b.horizon),'best_discount':b.discount,'best_spearman':float(b.mean_season_spearman),'gain_vs_y1':float(b.gain_vs_y1),'range_across_specs':float(g.mean_season_spearman.max()-g.mean_season_spearman.min())})
 return out,sens
def archetypes(p):
 out=[]
 for pos,ya,oa,p1 in [('QB',24,34,300),('WR',22,29,220),('RB',23,28,210),('TE',23,31,170)]:
  d=p[p.pos.eq(pos)];paths={}
  for age in [ya,oa]:
   path=[]
   for h in range(1,5):
    q=d[(d.h.eq(h))&d.age.between(age-1,age+1)];surv=float(q.survival.median()) if len(q) else .5;ratio=float((q.pred/q.current.replace(0,np.nan)).median()) if len(q) else .7;path.append({'h':h,'survival':surv,'conditional_ratio':ratio,'expected_points':p1*(1 if h==1 else ratio*surv)})
   paths[age]=path
  out.append({'position':pos,'equal_y1_points':p1,'young_age':ya,'old_age':oa,'young_path':paths[ya],'old_path':paths[oa]})
 return out
def main():
 w,players,m=load();a=aggregate(w,players);p=predictions(a);ev,se=evaluate(p);o={'version':'dynasty-valuation-research-v02','input_snapshot_sha256':m['snapshot_sha256'],'evaluation':ev,'sensitivity':se,'archetypes':archetypes(p),'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False},'limitations':['No historical market snapshots in frozen repository: market-anchor variants cannot be chronologically backtested.','TE-premium future scoring uses a sensitivity proxy, not a promotable future stat-line model.','Zero-history rookies require separate rookie projection contract.','Display value-scale mapping deferred until raw football-utility validation is stronger.']};OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(o,indent=2,sort_keys=True)+'\n');print(json.dumps(o,indent=2,sort_keys=True))
if __name__=='__main__':main()
