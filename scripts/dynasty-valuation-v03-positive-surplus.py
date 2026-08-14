#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY. Distribution-aware expected positive surplus; no production activation.
import importlib.util,json,sys
from pathlib import Path
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
pp=HERE/'dynasty-valuation-v03-position-model.py'
spec=importlib.util.spec_from_file_location('pm',pp)
pm=importlib.util.module_from_spec(spec);spec.loader.exec_module(pm)
r=pm.r;mod=pm.mod
CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-dynasty-v03')
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v03/positive-surplus.json')
mod.CACHE=CACHE
DISCOUNTS={'moderate':.80,'mild':.90,'none':1.0}

def fit_residuals(a,y,pos,h,feats):
 tr=a[(a.position_group.eq(pos))&((a.season+h)<y)].copy()
 if len(tr)<60:return np.array([])
 tr['rel']=(tr[f'y{h}_fantasy']>=mod.RELEVANCE[pos]).astype(int)
 rel=tr[tr.rel.eq(1)].copy()
 if len(rel)<40:return np.array([])
 m=mod.ridge();m.fit(rel[feats],rel[f'y{h}_fantasy'])
 return (rel[f'y{h}_fantasy'].to_numpy()-m.predict(rel[feats])).astype(float)

def expected_positive(mean,rep,resid):
 if len(resid)<20:return max(0.0,mean-rep)
 return float(np.maximum(0.0,mean+resid-rep).mean())

def build(a,pred,cn,horizon=3,discount=.80,distribution=True):
 cfg=mod.CONFIGS[cn];rows=[]
 for y in sorted(pred.valuation_season.unique()):
  acc={}
  for h in range(1,horizon+1):
   dh=pred[(pred.valuation_season.eq(y))&pred.h.eq(h)].copy()
   if dh.empty:continue
   dh['pred_fantasy']=dh.expected_conditional_fantasy;dh['pred_receptions']=dh.expected_conditional_receptions
   dh['pred_scored']=mod.scoring(dh,cfg,'pred');dh['actual_scored']=mod.scoring(dh,cfg,'actual')
   levels=r.forecast_levels(a,cfg,y,h,'fixed','expanding_historical_median')
   actual_levels=mod.actual_replacement_by_target(a,cfg,y+h,'fixed')
   resid={p:fit_residuals(a,y,p,h,pm.FEATURES[p]) for p in mod.POS}
   w=discount**(h-1)
   for _,x in dh.iterrows():
    k=(x.player_id,x.pos,x.age,x.experience)
    if k not in acc:acc[k]={'pred':0.0,'actual':0.0,'y1':0.0,'current':float(x.current),'components':[]}
    rep=float(levels.get(x.pos,0.0));mu=float(x.pred_scored)
    ps=expected_positive(mu,rep,resid[x.pos]) if distribution else max(0.0,mu-rep)
    av=0.0 if pd.isna(x.actual_scored) else max(0.0,float(x.actual_scored)-float(actual_levels.get(x.pos,0.0)))
    acc[k]['pred']+=w*ps;acc[k]['actual']+=w*av
    if h==1:acc[k]['y1']=ps
    acc[k]['components'].append({'h':h,'weight':w,'mean_points':mu,'replacement':rep,'expected_positive_surplus':ps,'residual_n':int(len(resid[x.pos]))})
  for k,v in acc.items():rows.append({'valuation_season':y,'player_id':k[0],'pos':k[1],'age':k[2],'experience':k[3],**v})
 return pd.DataFrame(rows)

def metrics(z):
 out=[]
 for y,g in z.groupby('valuation_season'):
  out.append({'valuation_season':int(y),'n':int(len(g)),'spearman':mod.sp(g.actual,g.pred),'y1':mod.sp(g.actual,g.y1),'current':mod.sp(g.actual,g.current),'zero_share':float((g.pred<=1e-9).mean())})
 return out

def main():
 w,players,manifest=mod.load();a=mod.aggregate(w,players);pred=pm.build_predictions(a)
 result={'version':'dynasty-v03-expected-positive-surplus-v1','snapshot_sha256':manifest['snapshot_sha256'],'configs':{},'sensitivity':[],
 'contract':'Compare E[max(points-replacement,0)] approximated from chronology-safe empirical conditional residuals against max(E[points]-replacement,0). No arbitrary floor or market anchor.',
 'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_dynasty_value_available':False,'ready_for_qa':False}}
 for cn in mod.CONFIGS:
  dist=build(a,pred,cn,3,.80,True);clip=build(a,pred,cn,3,.80,False)
  result['configs'][cn]={'expected_positive':metrics(dist),'clipped_expectation':metrics(clip)}
  for H in [2,3,4]:
   for dn,d in DISCOUNTS.items():
    z=build(a,pred,cn,H,d,True);g=z[z.valuation_season.eq(2022)]
    if len(g):result['sensitivity'].append({'config':cn,'horizon':H,'discount':dn,'n':int(len(g)),'spearman':mod.sp(g.actual,g.pred),'zero_share':float((g.pred<=1e-9).mean())})
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,indent=2,sort_keys=True))
if __name__=='__main__':main()
