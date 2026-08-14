#!/usr/bin/env python3
# HIGH-RISK RESEARCH ONLY. Diagnose youth differentiation and zero-value compression after robust projection/replacement fixes.
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
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v03/position-diagnostics.json')
mod.CACHE=CACHE

def cand(a,pred,cn,h=3):
 return r.candidate(a,pred,cn,'expanding_historical_median',horizon=h,discount='moderate',prediction_mode='conditional_survival',replacement_mode='league',flex_mode='fixed')

def zero_compression(z,cn):
 z=z[z.valuation_season.eq(2022)].copy();out=[]
 for pos,g in z.groupby('pos'):
  out.append({'config':cn,'position':pos,'n':int(len(g)),'zero_share':float((g.pred<=1e-9).mean()),'positive_n':int((g.pred>1e-9).sum()),
              'median_raw_surplus':float(g.pred.median()),'p75_raw_surplus':float(g.pred.quantile(.75)),'p90_raw_surplus':float(g.pred.quantile(.9))})
 return out

def youth_matched(z,cn):
 z=z[z.valuation_season.eq(2022)].copy();z['y1_projection']=z.components.apply(lambda x:x[0]['pred_points'] if x else np.nan);out=[]
 agecuts={'QB':(26,32),'RB':(24,27),'WR':(24,29),'TE':(25,30)}
 for pos,(youngmax,oldmin) in agecuts.items():
  gp=z[(z.pos.eq(pos))&z.y1_projection.notna()].copy()
  if len(gp)<20:continue
  gp['proj_bin']=pd.qcut(gp.y1_projection.rank(method='first'),q=5,labels=False)
  for b,g in gp.groupby('proj_bin'):
   young=g[g.age.le(youngmax)];old=g[g.age.ge(oldmin)]
   if len(young)<3 or len(old)<3:continue
   out.append({'config':cn,'position':pos,'projection_quintile':int(b),'young_n':int(len(young)),'old_n':int(len(old)),
               'young_median_age':float(young.age.median()),'old_median_age':float(old.age.median()),
               'young_median_y1_projection':float(young.y1_projection.median()),'old_median_y1_projection':float(old.y1_projection.median()),
               'young_median_surplus':float(young.pred.median()),'old_median_surplus':float(old.pred.median()),'young_minus_old_surplus':float(young.pred.median()-old.pred.median()),
               'young_realized_surplus':float(young.actual.median()),'old_realized_surplus':float(old.actual.median())})
 return out

def league_deltas(allz):
 out=[]
 base=allz['1qb_standard'];base=base[base.valuation_season.eq(2022)][['player_id','pos','pred']].rename(columns={'pred':'base'})
 for cn,z in allz.items():
  m=z[z.valuation_season.eq(2022)].merge(base,on=['player_id','pos'])
  for pos,g in m.groupby('pos'):
   out.append({'config':cn,'position':pos,'n':int(len(g)),'median_change_vs_1qb_standard':float((g.pred-g.base).median()),
               'p90_change_vs_1qb_standard':float((g.pred-g.base).quantile(.9)),'max_change_vs_1qb_standard':float((g.pred-g.base).max())})
 return out

def horizon_increment(z2,z3,cn):
 a=z2[z2.valuation_season.eq(2022)][['player_id','pos','pred']].rename(columns={'pred':'h2'})
 b=z3[z3.valuation_season.eq(2022)][['player_id','pos','pred']].rename(columns={'pred':'h3'})
 m=a.merge(b,on=['player_id','pos']);out=[]
 for pos,g in m.groupby('pos'):
  d=g.h3-g.h2
  out.append({'config':cn,'position':pos,'n':int(len(g)),'median_h3_minus_h2_raw':float(d.median()),'p90_h3_minus_h2_raw':float(d.quantile(.9)),
              'share_changed':float((d.abs()>1e-9).mean()),'rank_correlation_h2_h3':mod.sp(g.h2,g.h3)})
 return out

def main():
 w,players,manifest=mod.load();a=mod.aggregate(w,players);pred=pm.build_predictions(a)
 all3={cn:cand(a,pred,cn,3) for cn in mod.CONFIGS};all2={cn:cand(a,pred,cn,2) for cn in mod.CONFIGS}
 result={'version':'dynasty-v03-position-diagnostics-v1','snapshot_sha256':manifest['snapshot_sha256'],'zero_compression':[],'youth_matched':[],'league_deltas':league_deltas(all3),'horizon_increment':[],
         'interpretation_contract':'If expected-surplus clipping sends most rostered players to zero, raw expected surplus alone is insufficient as a complete dynasty asset value even if elite-player ordering is useful. Do not solve with arbitrary minimum values.',
         'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False}}
 for cn,z in all3.items():
  result['zero_compression']+=zero_compression(z,cn);result['youth_matched']+=youth_matched(z,cn);result['horizon_increment']+=horizon_increment(all2[cn],z,cn)
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,indent=2,sort_keys=True))
if __name__=='__main__':main()
