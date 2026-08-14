#!/usr/bin/env python3
import json, math, sys
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score

CACHE = Path(sys.argv[1] if len(sys.argv) > 1 else '.cache/lv-rookie-dynasty-v01')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'data/reports/rookie-dynasty-value-v01/result.json')
SNAP = 'd261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'
POS = ['QB','RB','WR','TE']
SELECTION_MAX_OUTCOME_SEASON = 2024
RETROSPECTIVE_OBSERVED = 2025
CUTOFFS = {'week1':1,'week4':4,'week8':8,'rookie_end':18}
TOP_N = {'QB':12,'RB':24,'WR':24,'TE':12}
STAT_COLS = ['attempts','passing_yards','passing_tds','passing_interceptions','carries','rushing_yards','rushing_tds','targets','receptions','receiving_yards','receiving_tds']


def finite(x):
    if x is None: return None
    try:
        y=float(x)
        return y if math.isfinite(y) else None
    except Exception:
        return None

def sp(a,b):
    a=np.asarray(a,dtype=float); b=np.asarray(b,dtype=float)
    if len(a)<3 or len(np.unique(a))<2 or len(np.unique(b))<2: return None
    return finite(spearmanr(a,b).statistic)

def mae(a,p): return finite(np.mean(np.abs(np.asarray(a)-np.asarray(p))))
def rmse(a,p): return finite(np.sqrt(np.mean((np.asarray(a)-np.asarray(p))**2)))
def pairwise_accuracy(y,p):
    y=np.asarray(y); p=np.asarray(p); n=len(y)
    if n<2: return None
    good=total=0
    for i in range(n):
        for j in range(i+1,n):
            if y[i]==y[j] or p[i]==p[j]: continue
            total += 1
            good += int((y[i]-y[j])*(p[i]-p[j]) > 0)
    return finite(good/total) if total else None

def rank_metrics(y,p,top_n):
    y=np.asarray(y); p=np.asarray(p); n=len(y)
    if n<3: return {'spearman':None,'pairwise_accuracy':None,'top_n_precision':None,'top_n_recall':None,'false_breakout_rate':None,'missed_breakout_rate':None}
    k=min(top_n,n)
    actual=set(np.argsort(-y)[:k].tolist()); pred=set(np.argsort(-p)[:k].tolist())
    hit=len(actual&pred)
    return {
        'spearman':sp(y,p),
        'pairwise_accuracy':pairwise_accuracy(y,p),
        'top_n_precision':finite(hit/len(pred)) if pred else None,
        'top_n_recall':finite(hit/len(actual)) if actual else None,
        'false_breakout_rate':finite(len(pred-actual)/len(pred)) if pred else None,
        'missed_breakout_rate':finite(len(actual-pred)/len(actual)) if actual else None,
    }

def ridge():
    return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('model',Ridge(alpha=10.0))])

def fantasy(df):
    return (df.passing_yards*.04 + df.passing_tds*4 - df.passing_interceptions*2 + df.rushing_yards*.1 + df.rushing_tds*6 + df.receptions + df.receiving_yards*.1 + df.receiving_tds*6)

def load():
    manifest=json.loads((CACHE/'snapshot-manifest.json').read_text())
    if manifest.get('snapshot_sha256') != SNAP: raise RuntimeError('validated frozen snapshot drift')
    frames=[]
    for y in range(2015,2026):
        f=CACHE/f'stats_player_week_{y}.csv'
        if not f.exists(): raise RuntimeError(f'missing frozen source {f.name}')
        d=pd.read_csv(f,low_memory=False)
        d=d[d.season_type.eq('REG')].copy()
        for c in STAT_COLS:
            if c not in d.columns: d[c]=0.0
        frames.append(d)
    return pd.concat(frames,ignore_index=True),pd.read_csv(CACHE/'players.csv',low_memory=False),manifest

def build_seasons(w):
    a=w.groupby(['player_id','season','position_group'],as_index=False).agg(games=('week','nunique'),**{c:(c,'sum') for c in STAT_COLS})
    a['fantasy']=fantasy(a)
    return a[a.position_group.isin(POS)].copy()

def audit_join(seasons,players):
    needed=['gsis_id','display_name','birth_date','rookie_season','draft_year','draft_round','draft_pick','draft_team']
    miss=[c for c in needed if c not in players.columns]
    if miss: raise RuntimeError(f'missing metadata columns {miss}')
    if players.gsis_id.isna().any(): raise RuntimeError('null metadata gsis_id')
    dup=players.gsis_id.duplicated(keep=False)
    if dup.any(): raise RuntimeError(f'duplicate metadata gsis_id rows {int(dup.sum())}')
    if seasons.player_id.isna().any(): raise RuntimeError('null source player_id')
    if seasons.duplicated(['player_id','season']).any(): raise RuntimeError('duplicate source player-season')
    meta=players[needed].copy(); meta['birth_date']=pd.to_datetime(meta.birth_date,errors='coerce')
    j=seasons.merge(meta,left_on='player_id',right_on='gsis_id',how='left',indicator=True,validate='many_to_one')
    unmatched=int(j._merge.ne('both').sum())
    if unmatched: raise RuntimeError(f'unmatched offensive source rows before rookie filtering: {unmatched}')
    return j.drop(columns=['_merge']), {'status':'PASS','source_player_seasons':int(len(seasons)),'source_unique_players':int(seasons.player_id.nunique()),'source_to_metadata_unmatched_rows':unmatched,'metadata_duplicate_gsis_id':int(dup.sum()),'join_contract':'audited many_to_one source.player_id -> players.gsis_id before rookie filtering'}

def classify_draft(j):
    x=j.copy(); x['draft_year_num']=pd.to_numeric(x.draft_year,errors='coerce'); x['round']=pd.to_numeric(x.draft_round,errors='coerce'); x['pick']=pd.to_numeric(x.draft_pick,errors='coerce')
    present=x[['draft_year_num','round','pick']].notna().sum(axis=1)
    x['draft_state']=np.select([present.eq(3),present.eq(0)],['CONFIRMED_DRAFTED','UNRESOLVED_MISSING'],default='INCONSISTENT_PARTIAL')
    c=x.draft_state.eq('CONFIRMED_DRAFTED')
    x.loc[c & ((x.draft_year_num%1!=0)|(x['round']%1!=0)|(x['pick']%1!=0)),'draft_state']='INCONSISTENT_NONINTEGER'
    c=x.draft_state.eq('CONFIRMED_DRAFTED'); x.loc[c & (~x['round'].between(1,7)|~x['pick'].between(1,300)),'draft_state']='INCONSISTENT_RANGE'
    c=x.draft_state.eq('CONFIRMED_DRAFTED'); rookie_num=pd.to_numeric(x.rookie_season,errors='coerce'); x.loc[c & rookie_num.notna() & x.draft_year_num.ne(rookie_num),'draft_state']='INCONSISTENT_DRAFT_YEAR'
    # Supplemental-draft encodings are not ordinary draft capital and fail closed from model evidence.
    c=x.draft_state.eq('CONFIRMED_DRAFTED'); x.loc[c & x['round'].gt(1) & x['pick'].eq(1),'draft_state']='CONFIRMED_SUPPLEMENTAL_DRAFTED'
    counts={str(k):int(v) for k,v in x.draft_state.value_counts().sort_index().items()}
    return x, {'status':'PASS_FAIL_CLOSED','draft_state_counts':counts,'confirmed_undrafted_rows':0,'missing_is_not_udfa':True,'eligible_rule':'CONFIRMED_DRAFTED only; missing/partial/inconsistent/supplemental states excluded'}

def eligible_rookies(j):
    x,audit=classify_draft(j)
    raw=x[(x.season==pd.to_numeric(x.rookie_season,errors='coerce')) & x.position_group.isin(POS)].copy()
    bad=raw[raw.draft_state.str.startswith('INCONSISTENT')]
    if len(bad): raise RuntimeError(f'inconsistent draft state inside raw rookie cohort: {len(bad)}')
    e=raw[raw.draft_state.eq('CONFIRMED_DRAFTED')].copy()
    if e.duplicated(['player_id','season']).any(): raise RuntimeError('duplicate eligible rookies')
    e['rookie_season']=pd.to_numeric(e.rookie_season).astype(int)
    e['age']=e.rookie_season-e.birth_date.dt.year
    e['log_pick']=np.log1p(e['pick']); e['inv_pick']=1/e['pick']; e['day']=np.select([e['round'].eq(1),e['round'].isin([2,3])],['DAY1','DAY2'],default='DAY3')
    audit.update({'raw_rookie_rows':int(len(raw)),'eligible_rookies':int(len(e)),'eligible_by_position':{p:int((e.position_group==p).sum()) for p in POS},'excluded_unresolved_missing':int(raw.draft_state.eq('UNRESOLVED_MISSING').sum()),'eligible_missing_draft_metadata':int(e[['draft_year_num','round','pick']].isna().any(axis=1).sum()),'eligible_draft_year_mismatch':int((e.draft_year_num!=e.rookie_season).sum())})
    if audit['eligible_missing_draft_metadata'] or audit['eligible_draft_year_mismatch']: raise RuntimeError('draft provenance gate failed')
    return e,audit

def add_future_outcomes(rookies,seasons):
    base=rookies[['player_id','rookie_season','position_group','display_name','age','round','pick','log_pick','inv_pick','day']].drop_duplicates().copy()
    for h in range(0,5):
        q=seasons[['player_id','season','fantasy','games']].copy(); q['rookie_season']=q.season-h
        q=q.rename(columns={'fantasy':f'y{h}_fantasy','games':f'y{h}_games'})[['player_id','rookie_season',f'y{h}_fantasy',f'y{h}_games']]
        base=base.merge(q,on=['player_id','rookie_season'],how='left',validate='one_to_one')
        base[f'y{h}_fantasy']=base[f'y{h}_fantasy'].fillna(0.0); base[f'y{h}_games']=base[f'y{h}_games'].fillna(0)
    for h in range(0,5):
        season=base.rookie_season+h
        ranks=base.groupby([season,base.position_group])[f'y{h}_fantasy'].rank(method='min',ascending=False)
        base[f'y{h}_top_tier']=[int(r<=TOP_N[p]) for r,p in zip(ranks,base.position_group)]
    base['multi_year_y1_y3']=base[['y1_fantasy','y2_fantasy','y3_fantasy']].sum(axis=1)
    base['career_persistence_y1_y3']=(base[['y1_games','y2_games','y3_games']].gt(0).sum(axis=1))
    return base

def cutoff_features(w,rookies):
    ids=rookies[['player_id','rookie_season','position_group','age','round','pick','log_pick','inv_pick','day']].drop_duplicates()
    rows=[]
    for name,week in CUTOFFS.items():
        d=w.merge(ids,left_on=['player_id','season','position_group'],right_on=['player_id','rookie_season','position_group'],how='inner')
        d=d[d.week<=week].copy()
        if d.empty: continue
        a=d.groupby(['player_id','rookie_season','position_group','age','round','pick','log_pick','inv_pick','day'],as_index=False).agg(games=('week','nunique'),**{c:(c,'sum') for c in STAT_COLS})
        a['fantasy_to_date']=fantasy(a); a['touches']=a.carries+a.receptions; a['opportunities']=a.attempts+a.carries+a.targets
        den=a.games.clip(lower=1)
        for c in ['attempts','carries','targets','receptions','touches','opportunities','fantasy_to_date']:
            a[c+'_pg']=a[c]/den
        a['yards_per_touch']=(a.rushing_yards+a.receiving_yards)/a.touches.replace(0,np.nan)
        a['catch_rate']=a.receptions/a.targets.replace(0,np.nan)
        a['tds']=a.passing_tds+a.rushing_tds+a.receiving_tds
        a['cutoff']=name
        rows.append(a)
    return pd.concat(rows,ignore_index=True) if rows else pd.DataFrame()

def draft_decay(outcomes):
    result={}
    transforms=['pick','log_pick','inv_pick','round']
    for p in POS:
        result[p]={}
        d=outcomes[outcomes.position_group.eq(p)]
        for h in range(0,5):
            q=d[(d.rookie_season+h)<=SELECTION_MAX_OUTCOME_SEASON].copy()
            horizon={}
            for t in transforms:
                x=q[t].to_numpy(); y=q[f'y{h}_fantasy'].to_numpy(); corr=sp(x,y)
                horizon[t]={'n':int(len(q)),'spearman':corr,'absolute_spearman':finite(abs(corr)) if corr is not None else None}
            # Treat lower pick/round as stronger investment; AUC uses -pick.
            ybin=q[f'y{h}_top_tier'].to_numpy()
            auc=None
            if len(np.unique(ybin))>1: auc=finite(roc_auc_score(ybin,-q['pick'].to_numpy()))
            horizon['top_tier_auc_draft_pick']=auc
            result[p][f'year{h}']=horizon
    return result

def production_draft_matrix(outcomes):
    rows=[]
    for p in POS:
        d=outcomes[(outcomes.position_group==p)&((outcomes.rookie_season+3)<=SELECTION_MAX_OUTCOME_SEASON)].copy()
        if d.empty: continue
        med=d.groupby('rookie_season').y0_fantasy.transform('median')
        d['production_band']=np.where(d.y0_fantasy>=med,'HIGH','LOW')
        d['capital_band']=np.where(d.day.isin(['DAY1','DAY2']),'HIGH','LOW')
        for (cap,prod),g in d.groupby(['capital_band','production_band']):
            rows.append({'position':p,'draft_capital':cap,'rookie_production':prod,'n':int(len(g)),'mean_y1':finite(g.y1_fantasy.mean()),'mean_y2':finite(g.y2_fantasy.mean()),'mean_y3':finite(g.y3_fantasy.mean()),'mean_multi_year_y1_y3':finite(g.multi_year_y1_y3.mean()),'top_tier_y1_rate':finite(g.y1_top_tier.mean()),'top_tier_y2_rate':finite(g.y2_top_tier.mean()),'top_tier_y3_rate':finite(g.y3_top_tier.mean()),'mean_persistence_y1_y3':finite(g.career_persistence_y1_y3.mean())})
    return rows

def evaluate_updating(features,outcomes):
    if features.empty: return []
    d=features.merge(outcomes,on=['player_id','rookie_season','position_group','age','round','pick','log_pick','inv_pick','day'],how='inner',validate='many_to_one')
    feature_sets={
        'draft_only':['log_pick','round','age'],
        'opportunity_only':['games','attempts_pg','carries_pg','targets_pg','receptions_pg','touches_pg','opportunities_pg'],
        'production_only':['fantasy_to_date_pg','yards_per_touch','catch_rate','tds'],
        'draft_plus_opportunity':['log_pick','round','age','games','attempts_pg','carries_pg','targets_pg','receptions_pg','touches_pg','opportunities_pg'],
        'draft_plus_opportunity_plus_production':['log_pick','round','age','games','attempts_pg','carries_pg','targets_pg','receptions_pg','touches_pg','opportunities_pg','fantasy_to_date_pg','yards_per_touch','catch_rate','tds'],
    }
    rows=[]
    for p in POS:
      for cutoff in CUTOFFS:
       z=d[(d.position_group==p)&(d.cutoff==cutoff)].copy()
       for horizon in [1,2,3]:
        target=f'y{horizon}_fantasy'
        # Evaluation rookie class Y is valid for selection only when outcome Y+h <= 2024.
        for eval_year in sorted(z.rookie_season.unique()):
            if eval_year+horizon>SELECTION_MAX_OUTCOME_SEASON: continue
            tr=z[(z.rookie_season<eval_year)&((z.rookie_season+horizon)<=SELECTION_MAX_OUTCOME_SEASON)]
            te=z[z.rookie_season==eval_year]
            if len(tr)<25 or len(te)<3: continue
            for family,cols in feature_sets.items():
                m=ridge(); m.fit(tr[cols],tr[target]); pred=m.predict(te[cols]); ranks=rank_metrics(te[target],pred,TOP_N[p])
                rows.append({'position':p,'cutoff':cutoff,'horizon':horizon,'eval_rookie_season':int(eval_year),'family':family,'train_n':int(len(tr)),'n':int(len(te)),'mae':mae(te[target],pred),'rmse':rmse(te[target],pred),**ranks})
    return rows

def summarize_updating(rows):
    if not rows: return []
    d=pd.DataFrame(rows); out=[]
    metrics=['mae','rmse','spearman','pairwise_accuracy','top_n_precision','top_n_recall','false_breakout_rate','missed_breakout_rate']
    for keys,g in d.groupby(['position','cutoff','horizon','family']):
        r={'position':keys[0],'cutoff':keys[1],'horizon':int(keys[2]),'family':keys[3],'folds':int(g.eval_rookie_season.nunique()),'n':int(g.n.sum())}
        for m in metrics: r['mean_'+m]=finite(g[m].dropna().mean()) if g[m].notna().any() else None
        out.append(r)
    return sorted(out,key=lambda x:(x['position'],x['cutoff'],x['horizon'],x['family']))

def position_persistence(outcomes):
    rows=[]
    for p in POS:
        d=outcomes[(outcomes.position_group==p)&((outcomes.rookie_season+3)<=SELECTION_MAX_OUTCOME_SEASON)]
        rows.append({'position':p,'n':int(len(d)),'rookie_to_y1_spearman':sp(d.y0_fantasy,d.y1_fantasy),'rookie_to_y2_spearman':sp(d.y0_fantasy,d.y2_fantasy),'rookie_to_y3_spearman':sp(d.y0_fantasy,d.y3_fantasy),'draft_pick_to_y1_spearman':sp(d['pick'],d.y1_fantasy),'draft_pick_to_y2_spearman':sp(d['pick'],d.y2_fantasy),'draft_pick_to_y3_spearman':sp(d['pick'],d.y3_fantasy),'mean_active_future_seasons_y1_y3':finite(d.career_persistence_y1_y3.mean()),'top_tier_y1_rate':finite(d.y1_top_tier.mean()),'top_tier_y2_rate':finite(d.y2_top_tier.mean()),'top_tier_y3_rate':finite(d.y3_top_tier.mean())})
    return rows

def conflict_cohorts(outcomes,features):
    # Only conflicts supported by observed NFL opportunity are quantified here. Historical preseason depth conflicts remain blocked.
    end=features[features.cutoff.eq('rookie_end')][['player_id','rookie_season','position_group','opportunities_pg','targets_pg','touches_pg']]
    d=outcomes.merge(end,on=['player_id','rookie_season','position_group'],how='inner')
    d=d[(d.rookie_season+2)<=SELECTION_MAX_OUTCOME_SEASON].copy()
    rows=[]
    for p in POS:
        z=d[d.position_group.eq(p)].copy()
        if z.empty: continue
        med=z.groupby('rookie_season').opportunities_pg.transform('median')
        z['opp_band']=np.where(z.opportunities_pg>=med,'HIGH','LOW')
        z['capital_band']=np.where(z.day.isin(['DAY1','DAY2']),'HIGH','LOW')
        for (cap,opp),g in z.groupby(['capital_band','opp_band']):
            rows.append({'position':p,'draft_capital':cap,'observed_rookie_opportunity':opp,'n':int(len(g)),'mean_y1':finite(g.y1_fantasy.mean()),'mean_y2':finite(g.y2_fantasy.mean()),'top_tier_y1_rate':finite(g.y1_top_tier.mean()),'top_tier_y2_rate':finite(g.y2_top_tier.mean())})
    return rows

def retrospective_2025(outcomes,features):
    # Observational only: never used to choose features/families/thresholds.
    rows=[]
    for h in range(0,5):
        d=outcomes[(outcomes.rookie_season+h)==RETROSPECTIVE_OBSERVED]
        for p in POS:
            g=d[d.position_group.eq(p)]
            if len(g): rows.append({'position':p,'horizon':h,'n':int(len(g)),'mean_fantasy':finite(g[f'y{h}_fantasy'].mean()),'draft_pick_spearman':sp(g['pick'],g[f'y{h}_fantasy'])})
    return rows

def main():
    w,players,manifest=load(); seasons=build_seasons(w); joined,identity=audit_join(seasons,players); rookies,draft_audit=eligible_rookies(joined); outcomes=add_future_outcomes(rookies,seasons); features=cutoff_features(w,rookies)
    fold_rows=evaluate_updating(features,outcomes); updating=summarize_updating(fold_rows)
    result={
      'research':'ROOKIE DYNASTY VALUE / DRAFT CAPITAL / OPPORTUNITY v0.1',
      'input_snapshot_sha256':manifest['snapshot_sha256'],
      'selection_evidence_max_outcome_season':SELECTION_MAX_OUTCOME_SEASON,
      'retrospective_observed':RETROSPECTIVE_OBSERVED,
      'identity_audit':identity,
      'draft_integrity_audit':draft_audit,
      'draft_capital_decay':draft_decay(outcomes),
      'production_vs_draft_capital_matrix':production_draft_matrix(outcomes),
      'opportunity_vs_draft_capital_matrix':conflict_cohorts(outcomes,features),
      'early_nfl_updating_fold_results':fold_rows,
      'early_nfl_updating_summary':updating,
      'position_specific_persistence':position_persistence(outcomes),
      'retrospective_2025_observation_only':retrospective_2025(outcomes,features),
      'historical_depth_chart_validation':{'status':'BLOCKED','reason':'Validated frozen snapshot does not contain historical point-in-time preseason depth charts/starter designations/competition/injury state. Current depth charts are prohibited from retrospective use.','blocked_tests':['preseason starter vs backup','competition ahead on depth chart','preseason promotion/demotion','competitor injury/release/trade at historical cutoff','vacated opportunity known at historical preseason cutoff']},
      'prospective_2026_opportunity_layer':{'status':'PROSPECTIVE / UNVALIDATED','allowed_inputs':['point-in-time archived depth position','starter/backup designation','snapshot-to-snapshot promotion/demotion','competitor injury/release/trade when captured prospectively','vacated opportunity from chronology-safe prior-season stats','current team competition'],'historical_predictive_claim':False},
      'architecture':{
        'concept':'Prospect Prior + Expected NFL Opportunity + Expected Production + Multi-Year Persistence + Position Scarcity/Replacement + Uncertainty',
        'draft_capital_role':'prior whose weight must be re-estimated by position and evidence cutoff; no permanent fixed draft boost',
        'update_checkpoints':['preseason','week1','week4','week8','rookie_end'],
        'separation':'Validated Rookie Projection v0.1 may be a comparator/input only; its coefficients are untouched and rookie dynasty valuation is a separate ranking problem.',
        'promotion_rule':'No numeric production Rookie Dynasty Value until independent high-risk validation clears chronology, ranking, replacement/scarcity, uncertainty and opportunity provenance.'
      },
      'future_backtest_with_historical_opportunity_data':{
        'required_source_properties':['original point-in-time preseason snapshots','ordered depth','starter/reserve status','stable player/team IDs','injury/reserve state at cutoff','retention/reproducibility rights','commercial derived-model rights'],
        'design':['freeze immutable source snapshots and hashes','team-specific final-preseason cutoff before first regular-season kickoff','join only information known by cutoff','compare draft-only vs opportunity-only vs combined vs combined+rookie production at Week1/4/8/end','use expanding chronological folds with 2025 retrospective_observed only','report MAE/RMSE/Spearman/pairwise/top-N/false-breakout/missed-breakout by position','test draft-capital x depth-chart conflict cohorts explicitly','require exact-head deterministic reproduction before QA']
      },
      'flags':{'experimental':True,'research_only':True,'production_rookie_dynasty_value_eligible':False,'production_dynasty_value_changed':False,'validated_rookie_projection_v01_changed':False,'validated_projection_v04_changed':False,'core_integration_authorized':False,'production_ui_authorized':False}
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n')
    print(json.dumps({'eligible_rookies':draft_audit['eligible_rookies'],'updating_folds':len(fold_rows),'output':str(OUT)},sort_keys=True))

if __name__=='__main__': main()
