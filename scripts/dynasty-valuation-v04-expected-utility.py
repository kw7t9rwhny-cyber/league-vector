#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY.
# Correct distribution-aware dynasty utility: survival-state mixture of positive surplus.
# No production activation. No market anchor. No arbitrary value floor/cap.
import importlib.util,json,sys
from pathlib import Path
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
pp=HERE/'dynasty-valuation-v03-position-model.py'
spec=importlib.util.spec_from_file_location('pm',pp)
pm=importlib.util.module_from_spec(spec);spec.loader.exec_module(pm)
r=pm.r;mod=pm.mod
CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-dynasty-v04')
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v04/expected-utility.json')
mod.CACHE=CACHE
DISCOUNTS={'moderate':.80,'mild':.90,'none':1.0}


def state_fit(a,y,pos,h,state):
    feats=pm.FEATURES[pos];tf=f'y{h}_fantasy';trc=f'y{h}_receptions'
    tr=a[(a.position_group.eq(pos))&((a.season+h)<y)].copy()
    if len(tr)<60:return None
    tr['rel']=(tr[tf]>=mod.RELEVANCE[pos]).astype(int);st=tr[tr.rel.eq(state)].copy()
    if len(st)<40:return None
    mf=mod.ridge();mr=mod.ridge();mf.fit(st[feats],st[tf]);mr.fit(st[feats],st[trc])
    rf=(st[tf].to_numpy(dtype=float)-mf.predict(st[feats])).astype(float)
    rr=(st[trc].to_numpy(dtype=float)-mr.predict(st[feats])).astype(float)
    return mf,mr,rf,rr


def build_uncertainty_predictions(a):
    rows=[];bank={}
    for y in mod.EVAL_YEARS:
      for pos in mod.POS:
        feats=pm.FEATURES[pos];base=a[(a.season.eq(y))&(a.position_group.eq(pos))].copy()
        if base.empty:continue
        for h in range(1,6):
          tf=f'y{h}_fantasy';trc=f'y{h}_receptions';tr=a[(a.position_group.eq(pos))&((a.season+h)<y)].copy()
          if len(tr)<60:continue
          tr['rel']=(tr[tf]>=mod.RELEVANCE[pos]).astype(int)
          if tr.rel.nunique()<2:continue
          surv=mod.logit();surv.fit(tr[feats],tr.rel);ps=surv.predict_proba(base[feats])[:,1]
          relfit=state_fit(a,y,pos,h,1);nonfit=state_fit(a,y,pos,h,0)
          if relfit is None or nonfit is None:continue
          rmf,rmr,rrf,rrr=relfit;nmf,nmr,nrf,nrr=nonfit
          bank[(int(y),pos,h)]={'rel_f':rrf,'rel_r':rrr,'non_f':nrf,'non_r':nrr}
          rmu_f=np.maximum(0,rmf.predict(base[feats]));rmu_r=np.maximum(0,rmr.predict(base[feats]))
          nmu_f=np.maximum(0,nmf.predict(base[feats]));nmu_r=np.maximum(0,nmr.predict(base[feats]))
          for i,(_,x) in enumerate(base.iterrows()):
            rows.append({'player_id':x.player_id,'valuation_season':int(y),'target_season':int(y+h),'pos':pos,
              'age':None if pd.isna(x.age) else float(x.age),'experience':None if pd.isna(x.experience) else float(x.experience),
              'current':float(x.fantasy),'h':h,'survival':float(ps[i]),'rel_mu_f':float(rmu_f[i]),'rel_mu_r':float(rmu_r[i]),
              'non_mu_f':float(nmu_f[i]),'non_mu_r':float(nmu_r[i]),'actual_fantasy':float(x[tf]),'actual_receptions':float(x[trc])})
    return pd.DataFrame(rows),bank


def state_value(row,cfg,rep,state,bank):
    b=bank[(int(row.valuation_season),row.pos,int(row.h))]
    if state=='rel':rf,rr,bf,br=b['rel_f'],b['rel_r'],row.rel_mu_f,row.rel_mu_r
    else:rf,rr,bf,br=b['non_f'],b['non_r'],row.non_mu_f,row.non_mu_r
    n=min(len(rf),len(rr))
    if n<20:return 0.0,0.0
    pts=np.maximum(0,bf+rf[:n]);rec=np.maximum(0,br+rr[:n])
    if row.pos=='TE':pts=pts+cfg['te_bonus']*rec
    s=np.maximum(0,pts-rep)
    return float(s.mean()),float((pts>rep).mean())


def candidate(a,p,bank,cn,horizon=3,discount=.80,rep_scale=1.0,distribution=True):
    cfg=mod.CONFIGS[cn];rows=[];pp=p[p.valuation_season.le(int(a.season.max())-horizon)].copy()
    for y in sorted(pp.valuation_season.unique()):
      acc={};ok=True
      for h in range(1,horizon+1):
        dh=pp[(pp.valuation_season.eq(y))&pp.h.eq(h)].copy()
        if dh.empty:ok=False;break
        levels={}
        for pos in mod.POS:
          lvl,n=r.historical_level(a,cn,cfg,int(y),pos,'fixed','expanding_historical_median')
          if lvl is None:ok=False;break
          levels[pos]=float(lvl)*rep_scale
        if not ok:break
        actual_levels=mod.actual_replacement_by_target(a,cfg,int(y)+h,'fixed');w=discount**(h-1)
        for _,x in dh.iterrows():
          k=(x.player_id,x.pos,x.age,x.experience)
          if k not in acc:acc[k]={'pred':0.,'actual':0.,'y1':0.,'current':float(x.current),'components':[]}
          rep=levels[x.pos];p_rel=float(x.survival)
          rel_ep,rel_above=state_value(x,cfg,rep,'rel',bank);non_ep,non_above=state_value(x,cfg,rep,'non',bank)
          if distribution:ps=p_rel*rel_ep+(1-p_rel)*non_ep
          else:
            mean_f=p_rel*float(x.rel_mu_f)+(1-p_rel)*float(x.non_mu_f);mean_r=p_rel*float(x.rel_mu_r)+(1-p_rel)*float(x.non_mu_r)
            ps=max(0.,mean_f+(cfg['te_bonus']*mean_r if x.pos=='TE' else 0.)-rep)
          actual_scored=float(x.actual_fantasy)+(cfg['te_bonus']*float(x.actual_receptions) if x.pos=='TE' else 0.)
          av=max(0.,actual_scored-float(actual_levels.get(x.pos,0.)))
          acc[k]['pred']+=w*ps;acc[k]['actual']+=w*av
          if h==1:acc[k]['y1']=ps
          acc[k]['components'].append({'h':h,'weight':w,'replacement':rep,'survival':p_rel,'rel_expected_positive':rel_ep,
            'nonrel_expected_positive':non_ep,'rel_prob_above_replacement':rel_above,'nonrel_prob_above_replacement':non_above,
            'expected_positive_surplus':ps,'actual_surplus':av})
      if not ok:continue
      for k,v in acc.items():rows.append({'valuation_season':int(y),'player_id':k[0],'pos':k[1],'age':k[2],'experience':k[3],**v})
    return pd.DataFrame(rows)


def metrics(z):
    out=[]
    if z.empty:return out
    for (y,pos),g in z.groupby(['valuation_season','pos']):
      out.append({'valuation_season':int(y),'position':pos,'n':int(len(g)),'spearman':mod.sp(g.actual,g.pred),'y1_spearman':mod.sp(g.actual,g.y1),
        'zero_share':float((g.pred<=1e-9).mean()),'median_value':float(g.pred.median()),'p90_value':float(g.pred.quantile(.9))})
    for y,g in z.groupby('valuation_season'):
      out.append({'valuation_season':int(y),'position':'ALL','n':int(len(g)),'spearman':mod.sp(g.actual,g.pred),'y1_spearman':mod.sp(g.actual,g.y1),
        'zero_share':float((g.pred<=1e-9).mean()),'median_value':float(g.pred.median()),'p90_value':float(g.pred.quantile(.9))})
    return out


def matched_youth(z):
    z=z[z.valuation_season.eq(2022)].copy();out=[]
    if z.empty:return out
    cuts={'QB':(26,32),'RB':(24,27),'WR':(24,29),'TE':(25,30)}
    for pos,(ym,om) in cuts.items():
      g=z[z.pos.eq(pos)].copy()
      if len(g)<20:continue
      g['y1bin']=pd.qcut(g.y1.rank(method='first'),q=5,labels=False)
      for b,q in g.groupby('y1bin'):
        young=q[q.age.le(ym)];old=q[q.age.ge(om)]
        if len(young)<3 or len(old)<3:continue
        out.append({'position':pos,'y1_quintile':int(b),'young_n':int(len(young)),'old_n':int(len(old)),
          'young_median_value':float(young.pred.median()),'old_median_value':float(old.pred.median()),'young_minus_old':float(young.pred.median()-old.pred.median()),
          'young_realized':float(young.actual.median()),'old_realized':float(old.actual.median())})
    return out


def comparisons(a,p,bank):
    out={'configs':{},'sensitivity':[],'horizon_availability':[],'player_examples':[]}
    for cn in mod.CONFIGS:
      dist=candidate(a,p,bank,cn,3,.80,1.,True);clip=candidate(a,p,bank,cn,3,.80,1.,False)
      out['configs'][cn]={'distribution_aware':metrics(dist),'clipped_expectation':metrics(clip),'matched_youth_2022':matched_youth(dist)}
      if not dist.empty:
        d=dist[dist.valuation_season.eq(2022)].copy();c=clip[clip.valuation_season.eq(2022)][['player_id','pos','pred']].rename(columns={'pred':'clipped'})
        m=d.merge(c,on=['player_id','pos']);m['delta']=m.pred-m.clipped
        for _,x in m.sort_values('delta',ascending=False).head(12).iterrows():
          out['player_examples'].append({'config':cn,'player_id':x.player_id,'position':x.pos,'age':x.age,'expected_positive_value':float(x.pred),
            'clipped_value':float(x.clipped),'delta':float(x.delta),'realized':float(x.actual),'components':x.components})
      for H in [2,3,4,5]:
        z=candidate(a,p,bank,cn,H,.80,1.,True);yrs=[] if z.empty else sorted(int(v) for v in z.valuation_season.unique())
        out['horizon_availability'].append({'config':cn,'horizon':H,'valuation_years':yrs,'available':bool(yrs)})
        for dn,d in DISCOUNTS.items():
          z=candidate(a,p,bank,cn,H,d,1.,True)
          for y,g in ([] if z.empty else z.groupby('valuation_season')):
            out['sensitivity'].append({'config':cn,'horizon':H,'discount':dn,'replacement_scale':1.0,'valuation_season':int(y),'n':int(len(g)),
              'spearman':mod.sp(g.actual,g.pred),'zero_share':float((g.pred<=1e-9).mean())})
      for rs in [.90,1.,1.10]:
        z=candidate(a,p,bank,cn,3,.80,rs,True);g=z[z.valuation_season.eq(2022)] if not z.empty else z
        if not g.empty:out['sensitivity'].append({'config':cn,'horizon':3,'discount':'moderate','replacement_scale':rs,'valuation_season':2022,
          'n':int(len(g)),'spearman':mod.sp(g.actual,g.pred),'zero_share':float((g.pred<=1e-9).mean())})
    return out


def main():
    w,players,manifest=mod.load();a=mod.aggregate(w,players);p,bank=build_uncertainty_predictions(a)
    result={'version':'dynasty-valuation-v04-expected-utility-v2','snapshot_sha256':manifest['snapshot_sha256'],
      'formula':'sum_t discount_t * E[max(scored_points_t - league_replacement_t, 0)] using chronology-safe relevance/non-relevance mixture distributions',
      'replacement':'expanding historical median actual point-in-time replacement using seasons strictly before valuation year; realized target uses target-season pool only',
      'market_anchor':{'weight':0.0,'status':'not_testable_without_leakage_safe_historical_market_snapshots'},
      'depth_chart_history':{'used':False,'limitation':'No historical point-in-time opportunity/depth-chart state is backfilled with hindsight.'},
      'results':comparisons(a,p,bank),'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_dynasty_value_available':False,'ready_for_qa':False}}
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,indent=2,sort_keys=True))
if __name__=='__main__':main()
