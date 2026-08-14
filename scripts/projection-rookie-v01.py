#!/usr/bin/env python3
import hashlib,json,sys
from pathlib import Path
import numpy as np,pandas as pd
from scipy.stats import spearmanr
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression,Ridge,ElasticNet,LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score,brier_score_loss

CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-rookie-v01')
OUT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/projection-rookie-v01/result.json')
SNAP='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'
DEV=list(range(2018,2025)); POS=['QB','RB','WR','TE']
STAT_COLS=['attempts','passing_yards','passing_tds','passing_interceptions','carries','rushing_yards','rushing_tds','targets','receptions','receiving_yards','receiving_tds']

def mae(a,p): return float(np.mean(np.abs(np.asarray(p)-np.asarray(a))))
def rmse(a,p): return float(np.sqrt(np.mean((np.asarray(p)-np.asarray(a))**2)))
def sp(a,p):
    r=spearmanr(a,p).statistic if len(a)>2 and len(np.unique(p))>1 else np.nan
    return None if np.isnan(r) else float(r)

def model(kind):
    est={'linear':LinearRegression(),'ridge':Ridge(alpha=10),'elastic':ElasticNet(alpha=.1,l1_ratio=.5,max_iter=20000)}[kind]
    return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('est',est)])

def load():
    manifest=json.loads((CACHE/'snapshot-manifest.json').read_text())
    if manifest['snapshot_sha256'] != SNAP:
        raise RuntimeError(f"validated control snapshot drift: {manifest['snapshot_sha256']}")
    frames=[]
    for y in range(2015,2026):
        d=pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False)
        frames.append(d[d.season_type.eq('REG')])
    return pd.concat(frames,ignore_index=True),pd.read_csv(CACHE/'players.csv',low_memory=False),manifest

def build_source(w):
    for c in STAT_COLS:
        if c not in w: w[c]=0
    a=w.groupby(['player_id','season','position_group'],as_index=False,dropna=False).agg(
        games=('week','nunique'),**{c:(c,'sum') for c in STAT_COLS})
    a['fantasy']=a.passing_yards*.04+a.passing_tds*4-a.passing_interceptions*2+a.rushing_yards*.1+a.rushing_tds*6+a.receptions+a.receiving_yards*.1+a.receiving_tds*6
    return a[a.position_group.isin(POS)].copy()

def audit_and_join(source,players):
    needed=['gsis_id','display_name','birth_date','rookie_season','draft_year','draft_round','draft_pick','draft_team']
    missing=[c for c in needed if c not in players.columns]
    if missing: raise RuntimeError(f'missing required player metadata columns: {missing}')
    duplicate_gsis=players[players.gsis_id.duplicated(keep=False)]
    if len(duplicate_gsis): raise RuntimeError(f'duplicate gsis_id metadata rows: {len(duplicate_gsis)}')
    if players.gsis_id.isna().any(): raise RuntimeError('null gsis_id in player metadata')
    if source.player_id.isna().any(): raise RuntimeError('null source player_id in offensive source rows')
    meta=players[needed].copy(); meta.birth_date=pd.to_datetime(meta.birth_date,errors='coerce')
    joined=source.merge(meta,left_on='player_id',right_on='gsis_id',how='left',indicator=True,validate='many_to_one')
    unmatched=joined[joined['_merge'].ne('both')]
    source_dupe_ps=int(source.duplicated(['player_id','season']).sum())
    if source_dupe_ps: raise RuntimeError(f'duplicate source player-season identities: {source_dupe_ps}')
    if len(unmatched): raise RuntimeError(f'unmatched offensive source rows before rookie filtering: {len(unmatched)}')
    return joined.drop(columns=['_merge']),{
        'source_offensive_player_seasons':int(len(source)),
        'source_unique_player_ids':int(source.player_id.nunique()),
        'source_missing_player_id':int(source.player_id.isna().sum()),
        'metadata_rows':int(len(players)),
        'metadata_duplicate_gsis_id':int(len(duplicate_gsis)),
        'metadata_missing_gsis_id':int(players.gsis_id.isna().sum()),
        'source_to_metadata_unmatched_rows':int(len(unmatched)),
        'source_duplicate_player_seasons':source_dupe_ps,
        'join_contract':'many_to_one source.player_id -> players.gsis_id, audited before rookie filtering',
        'status':'PASS'
    }

def classify_draft(joined):
    x=joined.copy()
    x['draft_year_num']=pd.to_numeric(x.draft_year,errors='coerce')
    x['round']=pd.to_numeric(x.draft_round,errors='coerce')
    x['pick']=pd.to_numeric(x.draft_pick,errors='coerce')
    present=x[['draft_year_num','round','pick']].notna().sum(axis=1)
    x['draft_state']=np.select([present.eq(3),present.eq(0)],['CONFIRMED_DRAFTED','UNRESOLVED_MISSING'],default='INCONSISTENT_PARTIAL')
    complete=x.draft_state.eq('CONFIRMED_DRAFTED')
    noninteger=complete & ((x.draft_year_num%1!=0)|(x['round']%1!=0)|(x['pick']%1!=0))
    invalid_range=complete & (~x['round'].between(1,7) | ~x['pick'].between(1,300))
    year_mismatch=complete & x.rookie_season.notna() & x.draft_year_num.ne(pd.to_numeric(x.rookie_season,errors='coerce'))
    x.loc[noninteger,'draft_state']='INCONSISTENT_NONINTEGER'
    x.loc[invalid_range,'draft_state']='INCONSISTENT_RANGE'
    x.loc[year_mismatch,'draft_state']='INCONSISTENT_DRAFT_YEAR'
    supplemental=x.draft_state.eq('CONFIRMED_DRAFTED') & x['round'].gt(1) & x['pick'].eq(1)
    x.loc[supplemental,'draft_state']='CONFIRMED_SUPPLEMENTAL_DRAFTED'
    ordinary=x[x.draft_state.eq('CONFIRMED_DRAFTED')].drop_duplicates('player_id')
    boundary_violations=[]; duplicate_player_ids=[]
    for year,g in ordinary.groupby('draft_year_num'):
        dup=g[g.duplicated(['pick'],keep=False)]
        if len(dup): duplicate_player_ids.extend(dup.player_id.tolist())
        by_round=g.groupby('round')['pick'].agg(['min','max']).sort_index()
        for r in range(1,7):
            if r in by_round.index and r+1 in by_round.index and by_round.loc[r,'max'] >= by_round.loc[r+1,'min']:
                boundary_violations.append({'draft_year':int(year),'round':r,'round_max_pick':int(by_round.loc[r,'max']),'next_round_min_pick':int(by_round.loc[r+1,'min'])})
    if duplicate_player_ids:
        x.loc[x.player_id.isin(duplicate_player_ids),'draft_state']='INCONSISTENT_DUPLICATE_PICK'
    if boundary_violations:
        raise RuntimeError(f'ordinary draft round/pick boundary violations: {boundary_violations[:5]}')
    draft_audit={
        'draft_state_counts_all_source_rows':{str(k):int(v) for k,v in x.draft_state.value_counts().sort_index().items()},
        'confirmed_undrafted_rows':0,
        'confirmed_undrafted_definition':'Requires an independent explicit UDFA/undrafted marker; frozen players.csv has none, so no all-missing row is assumed undrafted.',
        'unresolved_missing_rows':int(x.draft_state.eq('UNRESOLVED_MISSING').sum()),
        'partial_metadata_rows':int(x.draft_state.eq('INCONSISTENT_PARTIAL').sum()),
        'draft_year_rookie_season_mismatch_rows':int(x.draft_state.eq('INCONSISTENT_DRAFT_YEAR').sum()),
        'invalid_range_rows':int(x.draft_state.eq('INCONSISTENT_RANGE').sum()),
        'noninteger_rows':int(x.draft_state.eq('INCONSISTENT_NONINTEGER').sum()),
        'duplicate_draft_pick_rows':int(x.draft_state.eq('INCONSISTENT_DUPLICATE_PICK').sum()),
        'supplemental_draft_rows_detected':int(x.draft_state.eq('CONFIRMED_SUPPLEMENTAL_DRAFTED').sum()),
        'ordinary_round_pick_boundary_violations':boundary_violations,
        'fail_closed_rule':'Only internally consistent CONFIRMED_DRAFTED rows are eligible for v0.1 model evidence. UNRESOLVED_MISSING and every inconsistent state are excluded; supplemental selections are detected separately and excluded from this ordinary-draft model.'
    }
    return x,draft_audit

def build_rookies(joined):
    x,audit=classify_draft(joined)
    raw=x[(x.season==x.rookie_season)&x.position_group.isin(POS)].copy()
    raw_dupes=int(raw.duplicated(['player_id','season']).sum())
    if raw_dupes: raise RuntimeError(f'duplicate raw rookie player-seasons: {raw_dupes}')
    raw_counts={str(k):int(v) for k,v in raw.draft_state.value_counts().sort_index().items()}
    unresolved_dev=raw[raw.season.isin(DEV)&raw.draft_state.eq('UNRESOLVED_MISSING')]
    inconsistent=raw[raw.draft_state.str.startswith('INCONSISTENT')]
    if len(inconsistent): raise RuntimeError(f'inconsistent draft metadata in rookie cohort: {len(inconsistent)}')
    eligible=raw[raw.draft_state.eq('CONFIRMED_DRAFTED')].copy()
    if eligible.empty: raise RuntimeError('no model-eligible rookie rows after draft provenance gate')
    eligible['age']=eligible.season-eligible.birth_date.dt.year
    eligible['drafted']=1
    eligible['pick_fill']=eligible['pick']; eligible['log_pick']=np.log1p(eligible.pick_fill); eligible['inv_pick']=1/eligible.pick_fill; eligible['pick_in_round']=((eligible.pick_fill-1)%32)+1
    if eligible[['draft_year_num','round','pick']].isna().any().any(): raise RuntimeError('unresolved draft metadata reached model cohort')
    if eligible.duplicated(['player_id','season']).any(): raise RuntimeError('duplicate eligible rookie player-season')
    audit.update({
        'rookie_raw_rows':int(len(raw)),
        'rookie_raw_draft_state_counts':raw_counts,
        'development_unresolved_missing_excluded':int(len(unresolved_dev)),
        'development_unresolved_missing_by_position':{p:int((unresolved_dev.position_group==p).sum()) for p in POS},
        'eligible_rookie_rows_all_years':int(len(eligible)),
        'eligible_development_rows':int(eligible.season.isin(DEV).sum()),
        'eligible_development_by_position':{p:int(len(eligible[eligible.season.isin(DEV)&eligible.position_group.eq(p)])) for p in POS},
        'eligible_duplicate_player_seasons':int(eligible.duplicated(['player_id','season']).sum()),
        'eligible_missing_draft_metadata':int(eligible[['draft_year_num','round','pick']].isna().any(axis=1).sum()),
        'eligible_draft_year_mismatch':int((eligible.draft_year_num!=eligible.rookie_season).sum()),
        'status':'PASS_FAIL_CLOSED'
    })
    return eligible,audit

def feats(name): return {'pick':['pick_fill','drafted'],'logpick':['log_pick','drafted'],'inverse':['inv_pick','drafted'],'round':['round','drafted'],'round_pick':['round','pick_in_round','drafted'],'logpick_age':['log_pick','drafted','age']}[name]

def evaluate(r):
    rows=[]; names=['pick','logpick','inverse','round','round_pick','logpick_age']; kinds=['linear','ridge','elastic']
    for pos in POS:
        d=r[r.position_group.eq(pos)]
        for y in DEV:
            tr=d[d.season<y]; te=d[d.season==y]
            if len(tr)<20 or len(te)<3: continue
            prior=np.repeat(tr.fantasy.mean(),len(te)); bucket=[]
            for _,x in te.iterrows():
                q=tr[tr['round'].eq(x['round'])]; bucket.append(q.fantasy.mean() if len(q)>=5 else tr.fantasy.mean())
            candidates=[('position_mean',prior),('round_bucket',np.array(bucket))]
            for n in names:
                for k in kinds:
                    m=model(k); m.fit(tr[feats(n)],tr.fantasy); candidates.append((f'{k}_{n}',m.predict(te[feats(n)])))
            for n,pred in candidates:
                rows.append({'position':pos,'season':y,'model':n,'n':len(te),'train_n':len(tr),'mae':mae(te.fantasy,pred),'rmse':rmse(te.fantasy,pred),'spearman':sp(te.fantasy,pred)})
    return pd.DataFrame(rows)

def select(df):
    out={}
    for pos in POS:
        d=df[df.position.eq(pos)]; base=d[d.model.eq('position_mean')]; scores=[]
        for n,g in d.groupby('model'):
            if n=='position_mean': continue
            z=g.merge(base[['season','mae']],on='season',suffixes=('','_base')); z['gain']=100*(z.mae_base-z.mae)/z.mae_base
            scores.append({'model':n,'folds':len(z),'wins':int((z.gain>0).sum()),'mean_gain_pct':float(z.gain.mean()),'median_gain_pct':float(z.gain.median()),'mean_mae':float(z.mae.mean()),'mean_rmse':float(z.rmse.mean()),'mean_spearman':float(z.spearman.dropna().mean()) if z.spearman.notna().any() else None,'worst_gain_pct':float(z.gain.min()),'best_gain_pct':float(z.gain.max())})
        scores.sort(key=lambda x:(x['wins'],x['mean_gain_pct']),reverse=True); out[pos]=scores
    return out

def verify_claims(r,df,sel):
    claims={}
    for pos in POS:
        n=int(len(r[r.season.isin(DEV)&r.position_group.eq(pos)])); chosen=sel[pos][0]
        model_rows=df[(df.position==pos)&(df.model==chosen['model'])]
        base=df[(df.position==pos)&(df.model=='position_mean')][['season','mae']].rename(columns={'mae':'base_mae'})
        z=model_rows.merge(base,on='season'); z['gain_pct']=100*(z.base_mae-z.mae)/z.base_mae
        fold_checks=[{'season':int(row.season),'n':int(row.n),'train_n':int(row.train_n),'mae':float(row.mae),'base_mae':float(row.base_mae),'gain_pct':float(row.gain_pct),'won':bool(row.gain_pct>0)} for row in z.itertuples()]
        claims[pos]={'development_n':n,'chosen_model':chosen['model'],'reported_folds':len(fold_checks),'verified_wins':sum(int(x['won']) for x in fold_checks),'all_claimed_fold_wins_reconstructed':bool(sum(int(x['won']) for x in fold_checks)==chosen['wins']),'folds':fold_checks}
    return claims

def uncertainty(r,sel):
    out=[]
    for pos in POS:
        chosen=sel[pos][0]['model']; d=r[r.position_group.eq(pos)]
        for y in DEV:
            tr=d[d.season<y]; te=d[d.season==y]
            if len(tr)<20 or len(te)<3: continue
            if chosen=='round_bucket':
                pred=np.array([(tr[tr['round'].eq(x['round'])].fantasy.mean() if len(tr[tr['round'].eq(x['round'])])>=5 else tr.fantasy.mean()) for _,x in te.iterrows()]); cal=np.abs(tr.fantasy-tr.groupby('round').fantasy.transform('mean').fillna(tr.fantasy.mean()))
            else:
                kind,name=chosen.split('_',1); m=model(kind); m.fit(tr[feats(name)],tr.fantasy); pred=m.predict(te[feats(name)]); cal=np.abs(tr.fantasy-m.predict(tr[feats(name)]))
            for q in [.5,.8,.9]:
                radius=float(np.quantile(cal,q,method='higher')); out.append({'position':pos,'season':y,'model':chosen,'nominal':q,'coverage':float(np.mean(np.abs(te.fantasy-pred)<=radius)),'full_width':2*radius,'n':len(te)})
    return out

def role(r):
    threshold={'QB':100,'RB':80,'WR':80,'TE':60}; out=[]
    for pos in POS:
        d=r[r.position_group.eq(pos)].copy(); d['relevant']=(d.fantasy>=threshold[pos]).astype(int)
        for y in DEV:
            tr=d[d.season<y]; te=d[d.season==y]
            if len(tr)<25 or len(te)<4 or tr.relevant.nunique()<2 or te.relevant.nunique()<2: continue
            X=['log_pick','drafted','age']; m=Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('logit',LogisticRegression(C=.1,max_iter=1000))]); m.fit(tr[X],tr.relevant); p=m.predict_proba(te[X])[:,1]
            out.append({'position':pos,'season':y,'n':len(te),'auc':float(roc_auc_score(te.relevant,p)),'brier':float(brier_score_loss(te.relevant,p))})
    return out

def main():
    w,p,m=load(); source=build_source(w); joined,identity=audit_and_join(source,p); r,draft=build_rookies(joined); df=evaluate(r); sel=select(df); claims=verify_claims(r,df,sel)
    res={'version':'lv-rookie-projection-v0.1-provenance-remediation','input_snapshot_sha256':m['snapshot_sha256'],'development_cohorts':DEV,'retrospective_observed':2025,'selection_boundary':'2018-2024 development/post-selection evidence only; 2025 excluded from architecture/feature/hyperparameter selection','identity_audit':identity,'draft_integrity_audit':draft,'cohort_counts':r[r.season.isin(DEV)].groupby(['season','position_group']).size().reset_index(name='n').to_dict('records'),'model_rankings':sel,'claim_reconstruction':claims,'fold_results':df.to_dict('records'),'uncertainty':uncertainty(r,sel),'uncertainty_status':{'interval_calibrated':False,'reason':'v0.1 still uses in-sample training residuals as a proxy; chronological OOF calibration remains required'},'meaningful_role':role(r),'year2_transition':{'status':'not_evaluated_in_this_runner','reason':'rookie-only frame intentionally excludes post-rookie seasons; dedicated paired chronological study required'},'provenance_note':'Draft fields originate in frozen nflverse players.csv (draft data sourced by nflverse from PFR). The frozen file has no independent explicit undrafted marker, so all-missing draft fields are unresolved and excluded rather than assumed UDFA.','flags':{'experimental':True,'production_projection_eligible':False,'dynasty_value_eligible':False,'ready_for_qa':True,'risk':'HIGH'}}
    OUT.parent.mkdir(parents=True,exist_ok=True); text=json.dumps(res,indent=2,sort_keys=True)+'\n'; OUT.write_text(text); print(hashlib.sha256(text.encode()).hexdigest())
if __name__=='__main__': main()
