#!/usr/bin/env python3
# Wrapper enforcing complete observed horizons around the v0.3 research module.
import importlib.util,sys,math
from pathlib import Path

HERE=Path(__file__).resolve().parent
path=HERE/'dynasty-valuation-v03.py'
spec=importlib.util.spec_from_file_location('dynasty_v03',path)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

# Match production fixed-demand semantics exactly for the FLEX ablation:
# FLEX = RB 34% / WR 50% / TE 16%; SUPER_FLEX contributes 0.85 QB and no spill allocation.
_original_lineup=mod.lineup_replacement
def production_fixed_lineup(pool,cfg,col,mode='endogenous'):
    if mode!='fixed':
        return _original_lineup(pool,cfg,col,mode)
    pool=pool[pool[col].notna()].copy();levels={p:0.0 for p in mod.POS}
    demand={p:cfg['teams']*cfg['slots'].get(p,0) for p in mod.POS}
    for p,share in mod.FLEX_SHARES.items():demand[p]+=cfg['teams']*cfg['flex']*share
    if cfg['sf']:demand['QB']+=cfg['teams']*cfg['sf']*.85
    for p in mod.POS:
        q=pool[pool.pos.eq(p)].sort_values(col,ascending=False)
        rank=max(1,int(round(demand[p]))+1)
        levels[p]=float(q[col].iloc[min(rank-1,len(q)-1)]) if len(q) else 0.0
    return levels
mod.lineup_replacement=production_fixed_lineup

_original_candidate=mod.candidate_for_spec

def complete_horizon_candidate(a,p,cfg_name,cfg,horizon,discount,prediction_mode,replacement_mode,flex_mode):
    max_observed=int(a.season.max())
    eligible=p[p.valuation_season.le(max_observed-horizon)].copy()
    return _original_candidate(a,eligible,cfg_name,cfg,horizon,discount,prediction_mode,replacement_mode,flex_mode)

mod.candidate_for_spec=complete_horizon_candidate

# Replace historical reference tables with latest fully observed 4-year season (2021 in 2015-2025 snapshot).
def reference_tables(a,p):
    out=[];y=int(a.season.max())-4
    for cn in ['1qb_standard','superflex','two_te_premium']:
        cfg=mod.CONFIGS[cn]
        z=mod.candidate_for_spec(a,p,cn,cfg,4,'mild','direct','league','endogenous')
        z=z[z.valuation_season.eq(y)].copy()
        if z.empty:continue
        z['display_index']=0.0
        if z.pred.max()>0:z['display_index']=10000*z.pred/z.pred.max()
        chosen=[]
        for pos in mod.POS:
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
mod.reference_tables=reference_tables

if __name__=='__main__':
    mod.CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-dynasty-v03')
    mod.OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v03/run.json')
    mod.main()
