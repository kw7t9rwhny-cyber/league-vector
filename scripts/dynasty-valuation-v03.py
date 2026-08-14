#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY.
# experimental=true; production_dynasty_value_eligible=false; idp_numeric_eligible=false
import json, math, sys
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-dynasty-v03')
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v03/run.json')
SNAPSHOT='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'
POS=['QB','RB','WR','TE']
EVAL_YEARS=[2020,2021,2022,2023,2024]
HORIZONS=[3,4,5]
DISCOUNTS={'none':1.0,'mild':0.90,'moderate':0.80}
FLEX_SHARES={'RB':0.34,'WR':0.50,'TE':0.16}
CONFIGS={
 '1qb_standard':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':1,'sf':0,'te_bonus':0.0},
 'superflex':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':1,'sf':1,'te_bonus':0.0},
 'two_qb_like':{'teams':12,'slots':{'QB':2,'RB':2,'WR':3,'TE':1},'flex':1,'sf':0,'te_bonus':0.0},
 'te_premium_05':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':1,'sf':0,'te_bonus':0.5},
 'te_premium_10':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':1,'sf':0,'te_bonus':1.0},
 'two_te':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':2},'flex':1,'sf':0,'te_bonus':0.0},
 'two_te_premium':{'teams':12,'slots':{'QB':1,'RB':2,'WR':3,'TE':2},'flex':1,'sf':0,'te_bonus':0.5},
 'deep_flex':{'teams':14,'slots':{'QB':1,'RB':2,'WR':3,'TE':1},'flex':3,'sf':0,'te_bonus':0.0},
 'shallow':{'teams':10,'slots':{'QB':1,'RB':2,'WR':2,'TE':1},'flex':1,'sf':0,'te_bonus':0.0},
}
NEUTRAL=CONFIGS['1qb_standard']
RELEVANCE={'QB':100.0,'RB':60.0,'WR':60.0,'TE':40.0}
FEATS=['fantasy','games','attempts','carries','targets','receptions','fantasy_l1','games_l1','attempts_l1','carries_l1','targets_l1','receptions_l1','age','experience']

def ridge(alpha=20):
 return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('m',Ridge(alpha=alpha))])
def logit():
 return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('m',LogisticRegression(C=.1,max_iter=1000,random_state=0))])
def sp(a,b):
 a=np.asarray(a,dtype=float);b=np.asarray(b,dtype=float);ok=np.isfinite(a)&np.isfinite(b)
 return float(spearmanr(a[ok],b[ok]).statistic) if ok.sum()>3 and len(np.unique(b[ok]))>1 else None

def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text());assert m['snapshot_sha256']==SNAPSHOT,m['snapshot_sha256']
 fs=[]
 for y in range(2015,2026):
  d=pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False)
  fs.append(d[d.season_type.eq('REG')])
 return pd.concat(fs,ignore_index=True),pd.read_csv(CACHE/'players.csv',low_memory=False),m

def aggregate(w,players):
 sums=['attempts','completions','passing_yards','passing_tds','passing_interceptions','carries','rushing_yards','rushing_tds','targets','receptions','receiving_yards','receiving_tds']
 for c in sums:
  if c not in w:w[c]=0
 a=w.groupby(['player_id','season','position_group'],as_index=False).agg(games=('week','nunique'),**{c:(c,'sum') for c in sums})
 a['fantasy']=a.passing_yards*.04+a.passing_tds*4-a.passing_interceptions*2+a.rushing_yards*.1+a.rushing_tds*6+a.receptions+a.receiving_yards*.1+a.receiving_tds*6
 meta=players[['gsis_id','birth_date','rookie_season']].copy();meta['birth_date']=pd.to_datetime(meta.birth_date,errors='coerce')
 a=a.merge(meta,left_on='player_id',right_on='gsis_id',how='left')
 a['age']=a.season-a.birth_date.dt.year;a['experience']=a.season-a.rookie_season
 a=a[a.position_group.isin(POS)].sort_values(['player_id','season']).reset_index(drop=True)
 for c in ['fantasy','games','attempts','carries','targets','receptions']:
  a[c+'_l1']=a.groupby('player_id')[c].shift(1)
 for h in range(1,6):
  a[f'y{h}_fantasy']=a.groupby('player_id').fantasy.shift(-h)
  a[f'y{h}_receptions']=a.groupby('player_id').receptions.shift(-h)
 return a

def build_predictions(a):
 rows=[]
 for y in EVAL_YEARS:
  for pos in POS:
   base=a[(a.season==y)&(a.position_group==pos)].copy()
   if base.empty:continue
   for h in range(1,6):
    tf=f'y{h}_fantasy';trc=f'y{h}_receptions'
    # Strict chronology: every training target season must be < valuation year y.
    tr=a[(a.position_group==pos)&((a.season+h)<y)&a[tf].notna()].copy()
    if len(tr)<60:continue
    tr['rel']=(tr[tf]>=RELEVANCE[pos]).astype(int)
    direct_f=ridge();direct_f.fit(tr[FEATS],tr[tf])
    direct_r=ridge();direct_r.fit(tr[FEATS],tr[trc].fillna(0))
    surv=logit();surv.fit(tr[FEATS],tr.rel)
    reltr=tr[tr.rel.eq(1)].copy()
    if len(reltr)<40:continue
    cond_f=ridge();cond_f.fit(reltr[FEATS],reltr[tf])
    cond_r=ridge();cond_r.fit(reltr[FEATS],reltr[trc].fillna(0))
    pdirect=np.maximum(0,direct_f.predict(base[FEATS]));rdirect=np.maximum(0,direct_r.predict(base[FEATS]))
    psurv=surv.predict_proba(base[FEATS])[:,1]
    pcond=np.maximum(0,cond_f.predict(base[FEATS]));rcond=np.maximum(0,cond_r.predict(base[FEATS]))
    for i,(_,r) in enumerate(base.iterrows()):
     rows.append({'player_id':r.player_id,'valuation_season':y,'target_season':y+h,'pos':pos,'age':None if pd.isna(r.age) else float(r.age),'experience':None if pd.isna(r.experience) else float(r.experience),'current':float(r.fantasy),'current_receptions':float(r.receptions),'h':h,
      'direct_fantasy':float(pdirect[i]),'direct_receptions':float(rdirect[i]),'survival':float(psurv[i]),'conditional_fantasy':float(pcond[i]),'conditional_receptions':float(rcond[i]),
      'expected_conditional_fantasy':float(psurv[i]*pcond[i]),'expected_conditional_receptions':float(psurv[i]*rcond[i]),
      'actual_fantasy':None if pd.isna(r[tf]) else float(r[tf]),'actual_receptions':None if pd.isna(r[trc]) else float(r[trc])})
 return pd.DataFrame(rows)

def scoring(df,cfg,prefix):
 # Exact TE reception premium: base PPR already contains 1 point/reception; add league premium only to TE receptions.
 fantasy=df[f'{prefix}_fantasy'].astype(float).copy();recs=df[f'{prefix}_receptions'].astype(float).fillna(0)
 return fantasy + np.where(df.pos.eq('TE'),cfg['te_bonus']*recs,0.0)

def lineup_replacement(pool,cfg,col,mode='endogenous'):
 pool=pool[np.isfinite(pool[col])].copy()
 levels={p:0.0 for p in POS}
 if pool.empty:return levels
 if mode=='fixed':
  demand={p:cfg['teams']*cfg['slots'].get(p,0) for p in POS}
  for p,share in FLEX_SHARES.items(): demand[p]+=cfg['teams']*cfg['flex']*share
  if cfg['sf']:
   demand['QB']+=cfg['teams']*cfg['sf']*.85
   spill=cfg['teams']*cfg['sf']*.15
   demand['RB']+=spill*.34;demand['WR']+=spill*.50;demand['TE']+=spill*.16
  for p in POS:
   q=pool[pool.pos.eq(p)].sort_values(col,ascending=False)
   rank=max(1,int(math.ceil(demand[p]+1)))
   levels[p]=float(q[col].iloc[min(rank-1,len(q)-1)]) if len(q) else 0.0
  return levels
 selected=set()
 # Dedicated slots first.
 for p,n in cfg['slots'].items():
  q=pool[pool.pos.eq(p)].sort_values(col,ascending=False)
  take=q.head(cfg['teams']*n);selected.update(take.index)
 remain=pool.loc[~pool.index.isin(selected)].copy()
 # FLEX: actual competition among eligible remaining players.
 for _ in range(cfg['teams']*cfg['flex']):
  e=remain[remain.pos.isin(['RB','WR','TE'])]
  if e.empty:break
  ix=e[col].idxmax();selected.add(ix);remain=remain.drop(ix)
 # Superflex: actual competition among all remaining offensive positions.
 for _ in range(cfg['teams']*cfg['sf']):
  if remain.empty:break
  ix=remain[col].idxmax();selected.add(ix);remain=remain.drop(ix)
 for p in POS:
  q=pool[(pool.pos.eq(p))&(~pool.index.isin(selected))].sort_values(col,ascending=False)
  if len(q):levels[p]=float(q[col].iloc[0])
 return levels

def actual_replacement_by_target(a,cfg,target_season,flex_mode='endogenous'):
 # Target replacement uses ONLY the real target-season pool. It may include entrants who actually existed in that target season,
 # but never any later/future season. This is outcome construction, not a predictor input.
 d=a[a.season.eq(target_season)][['player_id','position_group','fantasy','receptions']].rename(columns={'position_group':'pos'}).copy()
 d['actual_scored']=d.fantasy+np.where(d.pos.eq('TE'),cfg['te_bonus']*d.receptions.fillna(0),0.0)
 return lineup_replacement(d,cfg,'actual_scored',flex_mode)

def predicted_replacement(pred_h,cfg,pred_col,flex_mode='endogenous'):
 # Predictor replacement uses only players present at the valuation season and their leakage-safe horizon predictions.
 d=pred_h[['player_id','pos',pred_col]].copy()
 return lineup_replacement(d,cfg,pred_col,flex_mode)

def candidate_for_spec(a,p,cfg_name,cfg,horizon,discount,prediction_mode,replacement_mode,flex_mode):
 z=[]
 disc=DISCOUNTS[discount]
 years=sorted(p.valuation_season.unique())
 for y in years:
  accum={}
  for h in range(1,horizon+1):
   dh=p[(p.valuation_season.eq(y))&p.h.eq(h)].copy()
   if dh.empty:continue
   if prediction_mode=='direct':
    dh['pred_fantasy']=dh.direct_fantasy;dh['pred_receptions']=dh.direct_receptions
   else:
    dh['pred_fantasy']=dh.expected_conditional_fantasy;dh['pred_receptions']=dh.expected_conditional_receptions
   dh['pred_scored']=scoring(dh,cfg,'pred')
   dh['actual_scored']=scoring(dh,cfg,'actual')
   rcfg=NEUTRAL if replacement_mode=='neutral' else cfg
   pred_levels=predicted_replacement(dh,rcfg,'pred_scored',flex_mode)
   actual_levels=actual_replacement_by_target(a,cfg,y+h,flex_mode)
   w=disc**(h-1)
   for _,r in dh.iterrows():
    k=(r.player_id,r.pos,r.age,r.experience)
    if k not in accum:accum[k]={'pred':0.0,'actual':0.0,'y1':0.0,'current':r.current,'components':[]}
    ps=max(0.0,float(r.pred_scored)-float(pred_levels.get(r.pos,0.0)))
    av=0.0 if pd.isna(r.actual_scored) else max(0.0,float(r.actual_scored)-float(actual_levels.get(r.pos,0.0)))
    accum[k]['pred']+=w*ps;accum[k]['actual']+=w*av
    if h==1:accum[k]['y1']=ps
    accum[k]['components'].append({'h':h,'weight':w,'pred_points':float(r.pred_scored),'pred_replacement':float(pred_levels.get(r.pos,0.0)),'pred_surplus':ps,'survival':float(r.survival),'actual_points':None if pd.isna(r.actual_scored) else float(r.actual_scored),'actual_replacement':float(actual_levels.get(r.pos,0.0)),'actual_surplus':av})
  for k,v in accum.items():z.append({'valuation_season':y,'player_id':k[0],'pos':k[1],'age':k[2],'experience':k[3],**v})
 return pd.DataFrame(z)

def summarize_specs(a,p):
 rows=[];posrows=[]
 # Main grid: all config x horizons x discounts; compare league vs neutral and endogenous vs fixed.
 for cn,cfg in CONFIGS.items():
  for H in HORIZONS:
   for dn in DISCOUNTS:
    for pm in ['direct','conditional_survival']:
     for rm in ['neutral','league']:
      for fm in ['fixed','endogenous']:
       z=candidate_for_spec(a,p,cn,cfg,H,dn,pm,rm,fm)
       if z.empty:continue
       ss=[];y1=[];cur=[]
       for _,g in z.groupby('valuation_season'):
        ss.append(sp(g.actual,g.pred));y1.append(sp(g.actual,g.y1));cur.append(sp(g.actual,g.current))
       row={'config':cn,'horizon':H,'discount':dn,'prediction_mode':pm,'replacement_mode':rm,'flex_mode':fm,'n':int(len(z)),'mean_spearman':float(np.nanmean(ss)),'y1_spearman':float(np.nanmean(y1)),'current_points_spearman':float(np.nanmean(cur)),'gain_vs_y1':float(np.nanmean(ss)-np.nanmean(y1)),'gain_vs_current':float(np.nanmean(ss)-np.nanmean(cur))}
       rows.append(row)
       for pos,gp in z.groupby('pos'):
        ps=[]
        for _,gy in gp.groupby('valuation_season'):ps.append(sp(gy.actual,gy.pred))
        posrows.append({**{k:row[k] for k in ['config','horizon','discount','prediction_mode','replacement_mode','flex_mode']},'pos':pos,'n':int(len(gp)),'mean_spearman':float(np.nanmean(ps))})
 return pd.DataFrame(rows),pd.DataFrame(posrows)

def ablations(spec):
 out={}
 # Hold H=4, mild, direct unless otherwise noted to isolate one dimension.
 base=spec[(spec.horizon.eq(4))&spec.discount.eq('mild')&spec.prediction_mode.eq('direct')]
 rep=[]
 for cn,g in base[base.flex_mode.eq('endogenous')].groupby('config'):
  q=g.set_index('replacement_mode').mean_spearman.to_dict();rep.append({'config':cn,'neutral':q.get('neutral'),'league':q.get('league'),'league_minus_neutral':None if 'neutral' not in q or 'league' not in q else q['league']-q['neutral']})
 out['league_vs_neutral']=rep
 flex=[]
 for cn,g in base[base.replacement_mode.eq('league')].groupby('config'):
  q=g.set_index('flex_mode').mean_spearman.to_dict();flex.append({'config':cn,'fixed':q.get('fixed'),'endogenous':q.get('endogenous'),'endogenous_minus_fixed':None if 'fixed' not in q or 'endogenous' not in q else q['endogenous']-q['fixed']})
 out['endogenous_vs_fixed_flex']=flex
 pm=[]
 b=spec[(spec.horizon.eq(4))&spec.discount.eq('mild')&spec.replacement_mode.eq('league')&spec.flex_mode.eq('endogenous')]
 for cn,g in b.groupby('config'):
  q=g.set_index('prediction_mode').mean_spearman.to_dict();pm.append({'config':cn,'direct':q.get('direct'),'conditional_survival':q.get('conditional_survival'),'conditional_minus_direct':None if 'direct' not in q or 'conditional_survival' not in q else q['conditional_survival']-q['direct']})
 out['prediction_contract']=pm
 return out

def marginal_horizon(spec,posspec):
 rows=[]
 q=spec[(spec.discount.eq('mild'))&spec.prediction_mode.eq('direct')&spec.replacement_mode.eq('league')&spec.flex_mode.eq('endogenous')]
 for cn,g in q.groupby('config'):
  m=g.set_index('horizon').mean_spearman.to_dict();rows.append({'config':cn,'h3':m.get(3),'h4':m.get(4),'h5':m.get(5),'marginal_4_vs_3':None if 3 not in m or 4 not in m else m[4]-m[3],'marginal_5_vs_4':None if 4 not in m or 5 not in m else m[5]-m[4]})
 bypos=[]
 qp=posspec[(posspec.config.eq('1qb_standard'))&posspec.discount.eq('mild')&posspec.prediction_mode.eq('direct')&posspec.replacement_mode.eq('league')&posspec.flex_mode.eq('endogenous')]
 for pos,g in qp.groupby('pos'):
  m=g.set_index('horizon').mean_spearman.to_dict();best=max(m,key=m.get) if m else None
  bypos.append({'pos':pos,'h3':m.get(3),'h4':m.get(4),'h5':m.get(5),'best_horizon':None if best is None else int(best),'marginal_4_vs_3':None if 3 not in m or 4 not in m else m[4]-m[3],'marginal_5_vs_4':None if 4 not in m or 5 not in m else m[5]-m[4]})
 return rows,bypos

def sensitivity(spec):
 out=[]
 # Candidate family only: direct + league + endogenous. Range over H and discount.
 q=spec[(spec.prediction_mode.eq('direct'))&spec.replacement_mode.eq('league')&spec.flex_mode.eq('endogenous')]
 for cn,g in q.groupby('config'):
  b=g.sort_values('mean_spearman',ascending=False).iloc[0]
  out.append({'config':cn,'best_horizon':int(b.horizon),'best_discount':str(b.discount),'best_spearman':float(b.mean_spearman),'min_spearman':float(g.mean_spearman.min()),'range':float(g.mean_spearman.max()-g.mean_spearman.min())})
 return out

def age_cohort_decomposition(a,p):
 # Matched-ish archetype summaries derived from empirical medians; diagnostic only, not optimization.
 defs={'QB':(24,34),'RB':(23,28),'WR':(22,29),'TE':(23,31)};out=[]
 for pos,(ya,oa) in defs.items():
  d=p[p.pos.eq(pos)].copy()
  entry={'pos':pos,'young_age':ya,'old_age':oa,'horizons':[]}
  for h in range(1,6):
   q=d[d.h.eq(h)]
   vals=[]
   for label,age in [('young',ya),('old',oa)]:
    x=q[q.age.between(age-1,age+1)]
    vals.append((label,{'n':int(len(x)),'median_survival':None if x.empty else float(x.survival.median()),'median_direct_ratio':None if x.empty else float((x.direct_fantasy/x.current.replace(0,np.nan)).median()),'median_conditional_ratio':None if x.empty else float((x.conditional_fantasy/x.current.replace(0,np.nan)).median())}))
   entry['horizons'].append({'h':h,**dict(vals)})
  out.append(entry)
 return out

def reference_tables(a,p):
 # Freeze objective representative historical cases from 2024, league configs; select by deterministic current-point quantiles, not names.
 out=[]
 y=2024
 for cn in ['1qb_standard','superflex','two_te_premium']:
  cfg=CONFIGS[cn]
  z=candidate_for_spec(a,p,cn,cfg,4,'mild','direct','league','endogenous')
  z=z[z.valuation_season.eq(y)].copy()
  if z.empty:continue
  z['display_index']=0.0
  if z.pred.max()>0:z['display_index']=10000*z.pred/z.pred.max()
  chosen=[]
  for pos in POS:
   gp=z[z.pos.eq(pos)].sort_values('current',ascending=False)
   if gp.empty:continue
   idxs=sorted(set([0,min(2,len(gp)-1),max(0,len(gp)//2),len(gp)-1]))
   chosen.extend(gp.iloc[idxs].to_dict('records'))
  movers=z.copy();movers['delta_rank']=movers.current.rank(ascending=False,method='min')-movers.pred.rank(ascending=False,method='min')
  movers=movers.reindex(movers.delta_rank.abs().sort_values(ascending=False).index).head(12)
  def clean(r):
   return {'player_id':r['player_id'],'position':r['pos'],'age':r['age'],'experience':r['experience'],'current_points':r['current'],'candidate_raw_surplus':r['pred'],'realized_target_surplus':r['actual'],'candidate_display_index':r['display_index'],'components':r['components']}
  out.append({'config':cn,'valuation_season':y,'representative':[clean(r) for r in chosen],'largest_rank_movers':[clean(r) for _,r in movers.iterrows()]})
 return out

def market_anchor_status():
 return {'executed':False,'reason':'No leakage-safe point-in-time historical dynasty market snapshots exist in the frozen repository evidence. Current market values cannot be backfilled into 2020-2024 without future-information leakage. Pure-football candidate selection therefore does not use a market anchor; market anchoring remains ineligible until a separately frozen/provenanced historical dataset exists.','candidate_market_anchor_weight':0.0}

def rookie_contract():
 return {'status':'fail_closed','required_fields':['player_id','position','age','zero_history','projection_distribution_or_point_estimate','projection_uncertainty','draft_capital_provenance','model_version','source_snapshot','qa_status'],'activation_rule':'Only consume rookie projection inputs whose model is explicitly QA-approved; otherwise return dynasty_candidate_available=false for model-derived rookie value or a clearly labeled non-model fallback outside this candidate.','production_activation':False}

def main():
 w,players,m=load();a=aggregate(w,players);p=build_predictions(a)
 spec,posspec=summarize_specs(a,p);abl=ablations(spec);mh,php=marginal_horizon(spec,posspec);sens=sensitivity(spec)
 result={'version':'dynasty-valuation-research-v03','input_snapshot_sha256':m['snapshot_sha256'],'chronology':{'valuation_years':EVAL_YEARS,'rule':'training target season < valuation season; actual target replacement uses only actual target-season pool; predictor replacement uses only valuation-season cohort predictions'},'formula_family':{'prediction_contracts_tested':['direct_unconditional','survival_x_conditional_on_relevance'],'surplus':'max(0, expected_scored_points - predicted_league_replacement)','target':'realized scored points above actual target-season league replacement','horizons':HORIZONS,'discounts':DISCOUNTS},'spec_results':spec.round(8).to_dict('records'),'position_results':posspec.round(8).to_dict('records'),'ablations':abl,'marginal_horizon':mh,'position_horizon':php,'sensitivity':sens,'age_cohorts':age_cohort_decomposition(a,p),'reference_tables':reference_tables(a,p),'market_anchor':market_anchor_status(),'rookie_contract':rookie_contract(),'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False,'ready_for_qa':False},'limitations':['Historical future entrants are included in actual target-season replacement because they truly existed in that outcome season, but cannot be known individually at valuation time; predictor replacement uses only the valuation-season cohort.','No point-in-time historical market snapshots: market-anchor ablation is methodologically blocked rather than approximated with leaked current values.','Rookies remain fail-closed pending an independently QA-approved rookie projection contract.','Display index is a monotonic diagnostic normalization only, not a proposed production value scale.']}
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,indent=2,sort_keys=True))
if __name__=='__main__':main()
