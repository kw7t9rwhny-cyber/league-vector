#!/usr/bin/env python3
import json, math, os, sys
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-v04-cycle2')
CONTROL=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/projection-v04-cycle2/control/candidate-player-seasons.json')
OUT=Path(sys.argv[3] if len(sys.argv)>3 else 'data/reports/projection-v04-cycle2/summary.json')
CONTROL_SHA='6d931abadbcb06e910bf953d941902c7c2cd1638'
SNAPSHOT='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'
DEV=[2020,2021,2022,2023,2024]
POS=['QB','RB','WR','TE']

def pipe(alpha=10):
    return Pipeline([('impute',SimpleImputer(strategy='median')),('scale',StandardScaler()),('ridge',Ridge(alpha=alpha))])

def mae(a,p): return float(np.mean(np.abs(np.asarray(p)-np.asarray(a))))
def rmse(a,p): return float(np.sqrt(np.mean((np.asarray(p)-np.asarray(a))**2)))
def sp(a,p):
    return float(spearmanr(a,p).statistic) if len(a)>2 and len(np.unique(p))>1 else None

def load():
    manifest=json.loads((CACHE/'snapshot-manifest.json').read_text())
    if manifest['snapshot_sha256']!=SNAPSHOT: raise SystemExit(f'control snapshot mismatch: {manifest["snapshot_sha256"]}')
    frames=[]
    for y in range(2015,2026):
        d=pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False)
        frames.append(d[d.season_type.eq('REG')])
    w=pd.concat(frames,ignore_index=True)
    players=pd.read_csv(CACHE/'players.csv',low_memory=False)
    return w,players,manifest

def aggregate(w,players):
    sums=['attempts','completions','passing_yards','passing_tds','passing_interceptions','carries','rushing_yards','rushing_tds','targets','receptions','receiving_yards','receiving_tds']
    for c in sums:
        if c not in w: w[c]=0
    a=w.groupby(['player_id','season','position_group'],as_index=False).agg(games=('week','nunique'),**{c:(c,'sum') for c in sums})
    shares=w.groupby(['player_id','season','position_group'],as_index=False).agg(target_share=('target_share','mean'),wopr=('wopr','mean'))
    a=a.merge(shares,on=['player_id','season','position_group'],how='left')
    a['fantasy']=a.passing_yards*.04+a.passing_tds*4-a.passing_interceptions*2+a.rushing_yards*.1+a.rushing_tds*6+a.receptions+a.receiving_yards*.1+a.receiving_tds*6
    meta=players[['gsis_id','birth_date','rookie_season','draft_round','draft_pick']].copy()
    meta['birth_date']=pd.to_datetime(meta.birth_date,errors='coerce')
    a=a.merge(meta,left_on='player_id',right_on='gsis_id',how='left')
    a['age']=a.season-a.birth_date.dt.year
    a['experience']=a.season-a.rookie_season
    a['draft_pick_f']=pd.to_numeric(a.draft_pick,errors='coerce')
    a['draft_round_f']=pd.to_numeric(a.draft_round,errors='coerce')
    a['drafted']=a.draft_pick_f.notna().astype(int)
    a['log_pick']=np.log1p(a.draft_pick_f.fillna(300))
    a=a.sort_values(['player_id','season'])
    for lag in [1,2,3]:
        for c in ['fantasy','games','attempts','carries','targets','receptions','receiving_yards','receiving_tds']:
            a[f'{c}_l{lag}']=a.groupby('player_id')[c].shift(lag)
    return a

def rookie(a):
    r=a[(a.season==a.rookie_season)&a.position_group.isin(POS)].copy()
    out=[]
    for pos in POS:
        rp=r[r.position_group.eq(pos)]
        for y in range(2018,2025):
            tr=rp[rp.season<y]; te=rp[rp.season==y]
            if len(tr)<15 or len(te)<3: continue
            base=np.repeat(tr.fantasy.mean(),len(te))
            for name,feats in [('draft_ridge',['log_pick','drafted']),('draft_age_ridge',['log_pick','drafted','age'])]:
                m=pipe(10);m.fit(tr[feats],tr.fantasy);p=m.predict(te[feats])
                out.append({'position':pos,'season':y,'model':name,'n':len(te),'mae':mae(te.fantasy,p),'rmse':rmse(te.fantasy,p),'spearman':sp(te.fantasy,p),'mae_gain_vs_cohort_mean_pct':100*(mae(te.fantasy,base)-mae(te.fantasy,p))/mae(te.fantasy,base)})
    df=pd.DataFrame(out);summary=[]
    for (pos,model),g in df.groupby(['position','model']):
        summary.append({'position':pos,'model':model,'folds':len(g),'n_total':int(g.n.sum()),'fold_wins':int((g.mae_gain_vs_cohort_mean_pct>0).sum()),'mean_mae':float(g.mae.mean()),'mean_rmse':float(g.rmse.mean()),'mean_spearman':float(g.spearman.mean()),'mean_gain_pct':float(g.mae_gain_vs_cohort_mean_pct.mean())})
    return summary

def young_bias(a,control):
    d=control.merge(a[['player_id','season','experience']],on=['player_id','season'],how='left')
    d['err']=d.control_pred-d.actual;d['abs_err']=d.err.abs()
    g=d[d.season<=2024].groupby(['position_group','experience']).agg(n=('err','size'),bias=('err','mean'),mae=('abs_err','mean')).reset_index()
    return g[g.experience.isin([1,2,3])].round(6).to_dict('records')

def uncertainty(control):
    d=control.copy();d['abs_err']=(d.control_pred-d.actual).abs();d['hist_group']=d.history_count.map({1:'1yr',2:'2yr',3:'3+yr'})
    out=[]
    for pos in POS:
        for scheme in ['position','history']:
            cov=[];width=[]
            for y in [2021,2022,2023,2024]:
                tr=d[(d.position_group==pos)&(d.season<y)];te=d[(d.position_group==pos)&(d.season==y)]
                hits=[];ws=[]
                for _,r in te.iterrows():
                    cal=tr if scheme=='position' else tr[tr.hist_group==r.hist_group]
                    if len(cal)<30: cal=tr
                    q=float(np.quantile(cal.abs_err,.8,method='higher'));hits.append(abs(r.control_pred-r.actual)<=q);ws.append(2*q)
                cov.append(np.mean(hits));width.append(np.mean(ws))
            out.append({'position':pos,'scheme':scheme,'mean_coverage80':float(np.mean(cov)),'mean_full_width':float(np.mean(width))})
    return out

def role_survival(a):
    thr={'QB':300,'RB':150,'WR':75,'TE':50};out=[]
    a=a.copy();a['opp']=np.nan
    a.loc[a.position_group.eq('QB'),'opp']=a.loc[a.position_group.eq('QB'),'attempts']
    a.loc[a.position_group.eq('RB'),'opp']=a.loc[a.position_group.eq('RB'),'carries']+a.loc[a.position_group.eq('RB'),'targets']
    a.loc[a.position_group.isin(['WR','TE']),'opp']=a.loc[a.position_group.isin(['WR','TE']),'targets']
    a['role']=[int(v>=thr.get(p,9999)) if pd.notna(v) else 0 for v,p in zip(a.opp,a.position_group)]
    feats=['fantasy_l1','games_l1','targets_l1','carries_l1','receptions_l1','age','experience']
    for pos in POS:
        wins=0;gains=[];aucs=[]
        d=a[(a.position_group==pos)&a.fantasy_l1.notna()]
        for y in DEV:
            tr=d[d.season<y];te=d[d.season==y]
            if len(tr)<50 or te.role.nunique()<2: continue
            m=Pipeline([('impute',SimpleImputer(strategy='median')),('scale',StandardScaler()),('logit',LogisticRegression(C=.1,max_iter=1000))]);m.fit(tr[feats],tr.role);prob=m.predict_proba(te[feats])[:,1]
            prior=te.attempts_l1 if pos=='QB' else (te.carries_l1+te.targets_l1 if pos=='RB' else te.targets_l1)
            bp=np.where(prior>=thr[pos],.875,.125);brier=float(np.mean((prob-te.role)**2));bb=float(np.mean((bp-te.role)**2));gain=100*(bb-brier)/bb
            wins+=int(gain>0);gains.append(gain)
            from sklearn.metrics import roc_auc_score
            aucs.append(float(roc_auc_score(te.role,prob)))
        out.append({'position':pos,'fold_wins':wins,'mean_brier_gain_pct':float(np.mean(gains)),'mean_auc':float(np.mean(aucs))})
    return out

def outliers(control):
    d=control[control.season<=2024].copy();d['abs_err']=(d.control_pred-d.actual).abs();out=[]
    for pos in POS:
        x=d[d.position_group==pos].sort_values('abs_err',ascending=False);k=max(1,int(math.ceil(len(x)*.1)))
        out.append({'position':pos,'n':len(x),'top10pct_share_abs_error':float(x.head(k).abs_err.sum()/x.abs_err.sum()),'p90_abs_error':float(x.abs_err.quantile(.9)),'max_abs_error':float(x.abs_err.max())})
    return out

def main():
    w,players,manifest=load();a=aggregate(w,players)
    raw=pd.DataFrame(json.loads(CONTROL.read_text()))
    control=raw.rename(columns={'id':'player_id','pos':'position_group','y':'season','pred':'control_pred','act':'actual','hc':'history_count'})
    result={'version':'lv-projection-v04-cycle2-repro-v1','control_sha':CONTROL_SHA,'input_snapshot_sha256':manifest['snapshot_sha256'],'selection_evidence_seasons':DEV,'retrospective_observed_season':2025,'rookie':rookie(a),'young_bias':young_bias(a,control),'uncertainty':uncertainty(control),'role_survival':role_survival(a),'outliers':outliers(control),'flags':{'experimental':True,'production_projection_eligible':False,'dynasty_value_eligible':False}}
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,indent=2,sort_keys=True))
if __name__=='__main__': main()
