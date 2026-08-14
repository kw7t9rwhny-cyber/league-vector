#!/usr/bin/env python3
# HIGH-RISK research wrapper for Dynasty Valuation v0.3.
# Fixes exact-calendar targets, collapse/survivorship handling, complete horizons,
# production-equivalent fixed FLEX controls, and common-target horizon comparisons.
import importlib.util,sys,math,json
from pathlib import Path
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
path=HERE/'dynasty-valuation-v03.py'
spec=importlib.util.spec_from_file_location('dynasty_v03',path)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

# --- Exact calendar-season history / targets ---------------------------------
_original_aggregate=mod.aggregate
def exact_calendar_aggregate(w,players):
    a=_original_aggregate(w,players).copy()
    # The base script's groupby.shift() means "next observed row", not calendar Y+h.
    # Overwrite every lag/target with exact-season lookups.
    lookup_cols=['fantasy','games','attempts','carries','targets','receptions']
    maps={c:a.set_index(['player_id','season'])[c].to_dict() for c in lookup_cols}
    max_observed=int(a.season.max())
    for c in lookup_cols:
        mp=maps[c]
        a[c+'_l1']=[mp.get((pid,int(season)-1),np.nan) for pid,season in zip(a.player_id,a.season)]
    for h in range(1,6):
        for c in ['fantasy','receptions']:
            mp=maps[c];vals=[]
            for pid,season in zip(a.player_id,a.season):
                target=int(season)+h
                if target>max_observed:
                    vals.append(np.nan)
                else:
                    # If the player did not appear in a fully observed target season,
                    # realized production is zero. This preserves collapse/exit cases
                    # instead of conditioning the direct model on survivors.
                    vals.append(float(mp.get((pid,target),0.0)))
            a[f'y{h}_{c}']=vals
    return a
mod.aggregate=exact_calendar_aggregate

# --- Match production fixed-demand control exactly ---------------------------
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
        # Production rounds positional starter demand, then replacement is the next player.
        rank=max(1,int(round(demand[p]))+1)
        levels[p]=float(q[col].iloc[min(rank-1,len(q)-1)]) if len(q) else 0.0
    return levels
mod.lineup_replacement=production_fixed_lineup

# --- Fully observed requested horizons only ----------------------------------
_original_candidate=mod.candidate_for_spec
def complete_horizon_candidate(a,p,cfg_name,cfg,horizon,discount,prediction_mode,replacement_mode,flex_mode):
    max_observed=int(a.season.max())
    eligible=p[p.valuation_season.le(max_observed-horizon)].copy()
    return _original_candidate(a,eligible,cfg_name,cfg,horizon,discount,prediction_mode,replacement_mode,flex_mode)
mod.candidate_for_spec=complete_horizon_candidate

# --- Reference tables use latest fully observed four-year valuation season ----
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

# Compare shorter forecast streams against the SAME longer realized-utility target.
# This avoids claiming H=5 is better/worse merely because H=3 and H=5 used different years/targets.
def common_target_horizon(a,p,target_h):
    out=[];bypos=[]
    max_y=int(a.season.max())-target_h
    common=p[p.valuation_season.le(max_y)].copy()
    for cn,cfg in mod.CONFIGS.items():
        zs={}
        for h in range(3,target_h+1):
            zs[h]=_original_candidate(a,common,cn,cfg,h,'mild','direct','league','endogenous')
        target=zs[target_h][['valuation_season','player_id','pos','actual']].rename(columns={'actual':'target_actual'})
        row={'config':cn,'target_horizon':target_h,'valuation_years':sorted(set(int(x) for x in common.valuation_season.unique())),'scores':[]}
        for h,z in zs.items():
            m=z.merge(target,on=['valuation_season','player_id','pos'],how='inner')
            vals=[]
            for _,g in m.groupby('valuation_season'):vals.append(mod.sp(g.target_actual,g.pred))
            row['scores'].append({'predictor_horizon':h,'n':int(len(m)),'mean_spearman_vs_same_target':float(np.nanmean(vals))})
            for pos,gp in m.groupby('pos'):
                ps=[]
                for _,gy in gp.groupby('valuation_season'):ps.append(mod.sp(gy.target_actual,gy.pred))
                bypos.append({'config':cn,'target_horizon':target_h,'predictor_horizon':h,'pos':pos,'n':int(len(gp)),'mean_spearman_vs_same_target':float(np.nanmean(ps))})
        out.append(row)
    return out,bypos

if __name__=='__main__':
    mod.CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-dynasty-v03')
    mod.OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/dynasty-v03/run.json')
    w,players,m=mod.load();a=mod.aggregate(w,players);p=mod.build_predictions(a)
    specdf,posdf=mod.summarize_specs(a,p)
    h4,h4pos=common_target_horizon(a,p,4)
    h5,h5pos=common_target_horizon(a,p,5)
    output={
      'version':'dynasty-valuation-research-v03-exact-calendar-v2',
      'input_snapshot_sha256':m['snapshot_sha256'],
      'chronology':{
        'valuation_years':mod.EVAL_YEARS,
        'max_observed_season':int(a.season.max()),
        'rule':'training target calendar season < valuation season; target Y+h is exact calendar Y+h; missing player in an observed future season = zero production; requested horizon must be fully observed',
        'target_replacement':'actual target-season player pool only',
        'predictor_replacement':'valuation-season cohort using leakage-safe horizon predictions only'
      },
      'formula_family':{
        'prediction_contracts_tested':['direct_unconditional_including_zero_exit','survival_x_conditional_on_relevance'],
        'surplus':'max(0, expected_scored_points - predicted_replacement)',
        'target':'discounted realized exact-calendar future scoring above actual target-season replacement',
        'horizons':mod.HORIZONS,'discounts':mod.DISCOUNTS
      },
      'spec_results':specdf.round(8).to_dict('records'),
      'position_results':posdf.round(8).to_dict('records'),
      'ablations':mod.ablations(specdf),
      'horizon_descriptive_by_available_cohort':mod.marginal_horizon(specdf,posdf)[0],
      'position_horizon_descriptive_by_available_cohort':mod.marginal_horizon(specdf,posdf)[1],
      'common_target_h4':h4,
      'common_target_h4_position':h4pos,
      'common_target_h5':h5,
      'common_target_h5_position':h5pos,
      'sensitivity':mod.sensitivity(specdf),
      'age_cohorts':mod.age_cohort_decomposition(a,p),
      'reference_tables':reference_tables(a,p),
      'market_anchor':mod.market_anchor_status(),
      'rookie_contract':mod.rookie_contract(),
      'flags':{'experimental':True,'production_dynasty_value_eligible':False,'idp_numeric_eligible':False,'ready_for_qa':False},
      'limitations':[
        'H=5 fully observed evaluation is limited to valuation season 2020 in this 2015-2025 snapshot; common-target H=5 conclusions therefore have one valuation-year cohort.',
        'H=4 fully observed evaluation is limited to valuation seasons 2020-2021; H=3 to 2020-2022.',
        'No leakage-safe point-in-time historical dynasty market snapshots exist in the frozen repository, so market-anchor ablation remains blocked rather than approximated with current values.',
        'Zero-history rookies remain fail-closed pending a QA-approved rookie projection contract.',
        'Display index in reference tables is diagnostic normalization only, not a production value scale.'
      ]
    }
    mod.OUT.parent.mkdir(parents=True,exist_ok=True)
    mod.OUT.write_text(json.dumps(output,indent=2,sort_keys=True)+'\n')
    print(json.dumps(output,indent=2,sort_keys=True))
