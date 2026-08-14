#!/usr/bin/env python3
import hashlib, json, math, sys, warnings
from pathlib import Path
import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy.stats import spearmanr
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, PoissonRegressor, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, brier_score_loss
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

SNAP='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'
QA_HEAD='fe936d37f346e3e8b027e33964e272dd34b04e9b'
QA_CANONICAL='5ffe308142d16641729c23a3542362f031516aa5e6835904e84787ee25096c4c'
POS=['DL','LB','DB']; DEV=list(range(2020,2025)); FLOAT_DECIMALS=8; RANK_DECIMALS=3
RANK_KEYS={'spearman'}
REQ=['def_sacks','def_sack_yards','def_interceptions','def_interception_yards','def_pass_defended','def_punt_blocks','def_pat_blocks','def_fg_blocks','fumble_recovery_tds','fumble_recovery_opp','fumble_recovery_yards_opp','special_teams_tds','def_tackles_solo']
WEIGHTS={'idp_int_ret_yd':0.1,'bonus_sack_2p':2.0,'idp_pass_def_3p':2.0,'fum_rec_td':6.0,'idp_fum_ret_yd':0.1,'idp_blk_kick':3.0,'st_td':6.0}


def rho(a,p):
    if len(np.unique(a))<2 or len(np.unique(p))<2:return None
    v=spearmanr(a,p).statistic
    return None if not np.isfinite(v) else float(v)

def score_metrics(actual,pred,weight):
    return {'mae':float(mean_absolute_error(actual,pred)),'rmse':float(mean_squared_error(actual,pred)**0.5),'spearman':rho(actual,pred),'fantasy_point_mae':float(mean_absolute_error(actual*weight,pred*weight)),'bias':float(np.mean(pred-actual))}

def audit_numeric(s,c,y):
    x=pd.to_numeric(s,errors='coerce');bad=int(x.isna().sum())
    out={'rows':int(len(x)),'missing_or_non_numeric':bad,'zero':int((x==0).sum()),'positive':int((x>0).sum())}
    if bad: raise RuntimeError(f'unavailable source states for {c} in {y}: {bad}; v0.2 refuses zero-fill')
    return x,out

def load(cache):
    manifest=json.loads((cache/'snapshot-manifest.json').read_text());assert manifest['snapshot_sha256']==SNAP
    rows=[];audit={};schema={}
    for y in range(2015,2026):
        d=pd.read_csv(cache/f'stats_player_week_{y}.csv',low_memory=False)
        d=d[(d.season_type=='REG')&d.position_group.isin(POS)].copy();schema[str(y)]=sorted(d.columns.tolist());audit[str(y)]={}
        for c in REQ:
            if c not in d: raise RuntimeError(f'missing required source column {c} in {y}')
            d[c],audit[str(y)][c]=audit_numeric(d[c],c,y)
        rows.append(d)
    return pd.concat(rows,ignore_index=True),manifest,audit,schema

def annualize(w):
    w=w.copy();w['sack2']=(w.def_sacks>=2).astype(int);w['pd3']=(w.def_pass_defended>=3).astype(int);w['blk']=w.def_punt_blocks+w.def_pat_blocks+w.def_fg_blocks
    a=w.groupby(['player_id','season','position_group'],as_index=False,sort=True).agg(games=('week','nunique'),sacks=('def_sacks','sum'),sack_yards=('def_sack_yards','sum'),ints=('def_interceptions','sum'),int_yards=('def_interception_yards','sum'),pd=('def_pass_defended','sum'),sack2=('sack2','sum'),pd3=('pd3','sum'),fum_rec_td=('fumble_recovery_tds','sum'),fum_rec=('fumble_recovery_opp','sum'),fum_ret_yards=('fumble_recovery_yards_opp','sum'),blk=('blk','sum'),st_td=('special_teams_tds','sum'),tackles=('def_tackles_solo','sum'))
    a=a.sort_values(['player_id','season','position_group'],kind='mergesort').reset_index(drop=True)
    for c in ['games','sacks','sack_yards','ints','int_yards','pd','sack2','pd3','fum_rec_td','fum_rec','fum_ret_yards','blk','st_td','tackles']:
        a[c+'_l1']=a.groupby('player_id',sort=True)[c].shift(1)
    return a

def evaluate_predictions(position,season,actual,preds,weight):
    return [{'position':position,'season':season,'model':name,'n':int(len(actual)),**score_metrics(actual,np.asarray(pred),weight)} for name,pred in preds.items()]

def interception_return_models(a):
    rows=[];cal=[]
    for pos in POS:
        d=a[(a.position_group==pos)&a.int_yards_l1.notna()].copy()
        for y in DEV:
            tr=d[d.season<y];te=d[d.season==y];actual=te.int_yards.to_numpy()
            feats=['ints_l1','int_yards_l1','pd_l1','games_l1','tackles_l1']
            preds={'zero':np.zeros(len(te)),'prior_yards':te.int_yards_l1.to_numpy(),'position_mean':np.repeat(tr.int_yards.mean(),len(te))}
            rate=tr.int_yards.sum()/max(tr.ints.sum(),1e-9);preds['prior_ints_x_conditional_rate']=te.ints_l1.to_numpy()*rate
            direct=Pipeline([('i',SimpleImputer(strategy='median')),('s',StandardScaler()),('r',Ridge(alpha=10))]);direct.fit(tr[feats],tr.int_yards);preds['ridge_direct']=np.maximum(0,direct.predict(te[feats]))
            cnt_feats=['ints_l1','pd_l1','games_l1','tackles_l1'];cnt=Pipeline([('i',SimpleImputer(strategy='median')),('s',StandardScaler()),('p',PoissonRegressor(alpha=1,max_iter=2000))]);cnt.fit(tr[cnt_feats],tr.ints);eints=np.maximum(0,cnt.predict(te[cnt_feats]));cond=tr.loc[tr.ints>0,'int_yards'].sum()/max(tr.loc[tr.ints>0,'ints'].sum(),1);preds['poisson_int_count_x_conditional_mean']=eints*cond
            occ=Pipeline([('i',SimpleImputer(strategy='median')),('s',StandardScaler()),('l',LogisticRegression(C=.1,max_iter=2000))]);occ.fit(tr[cnt_feats],(tr.ints>0).astype(int));p=occ.predict_proba(te[cnt_feats])[:,1];condseason=tr.loc[tr.ints>0,'int_yards'].mean();preds['hurdle_occurrence_x_conditional_mean']=p*condseason
            rows.extend(evaluate_predictions(pos,y,actual,preds,WEIGHTS['idp_int_ret_yd']))
            cal.append({'position':pos,'season':y,'n':int(len(te)),'actual_interception_occurrence_rate':float((te.ints>0).mean()),'actual_return_yard_positive_rate':float((te.int_yards>0).mean()),'mean_interceptions':float(te.ints.mean()),'mean_return_yards':float(te.int_yards.mean()),'occurrence_brier':float(brier_score_loss((te.ints>0).astype(int),p))})
    return rows,cal

def count_models(a,target,primary,weight):
    rows=[]
    for pos in POS:
        d=a[(a.position_group==pos)&a[target+'_l1'].notna()].copy();feats=[primary+'_l1',target+'_l1','games_l1','tackles_l1']
        for y in DEV:
            tr=d[d.season<y];te=d[d.season==y];actual=te[target].to_numpy();med=tr[feats].median();Xtr=tr[feats].fillna(med).to_numpy();Xte=te[feats].fillna(med).to_numpy();sc=StandardScaler().fit(Xtr);Xs=sc.transform(Xtr);Xt=sc.transform(Xte)
            preds={'zero':np.zeros(len(te)),'position_mean':np.repeat(tr[target].mean(),len(te)),'prior_count':te[target+'_l1'].to_numpy()}
            if tr[target].sum()>0:
                pm=PoissonRegressor(alpha=1,max_iter=2000).fit(Xs,tr[target]);preds['poisson']=np.maximum(0,pm.predict(Xt))
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore');nb=sm.GLM(tr[target].to_numpy(),sm.add_constant(Xs,has_constant='add'),family=sm.families.NegativeBinomial(alpha=1.0)).fit(maxiter=200,disp=0);preds['negative_binomial']=np.maximum(0,nb.predict(sm.add_constant(Xt,has_constant='add')))
            if (tr[target]>0).nunique()==2:
                lg=LogisticRegression(C=.1,max_iter=2000).fit(Xs,(tr[target]>0).astype(int));p=lg.predict_proba(Xt)[:,1];posmask=tr[target]>0
                positive=np.repeat(tr.loc[posmask,target].mean(),len(te))
                if int(posmask.sum())>=20:
                    pp=PoissonRegressor(alpha=1,max_iter=2000).fit(Xs[posmask],tr.loc[posmask,target]-1);positive=1+np.maximum(0,pp.predict(Xt))
                preds['hurdle']=p*positive
            rows.extend(evaluate_predictions(pos,y,actual,preds,weight))
    return rows

def continuous_models(a,target,count,weight):
    rows=[]
    for pos in POS:
        d=a[(a.position_group==pos)&a[target+'_l1'].notna()].copy()
        for y in DEV:
            tr=d[d.season<y];te=d[d.season==y];actual=te[target].to_numpy();feats=[count+'_l1',target+'_l1','games_l1','tackles_l1']
            rate=tr[target].sum()/max(tr[count].sum(),1e-9);preds={'zero':np.zeros(len(te)),'prior':te[target+'_l1'].to_numpy(),'count_rate':te[count+'_l1'].to_numpy()*rate}
            m=Pipeline([('i',SimpleImputer(strategy='median')),('s',StandardScaler()),('r',Ridge(alpha=10))]);m.fit(tr[feats],tr[target]);preds['ridge']=np.maximum(0,m.predict(te[feats]));rows.extend(evaluate_predictions(pos,y,actual,preds,weight))
    return rows

def prevalence(a,col):
    out=[]
    for pos in POS:
        d=a[(a.position_group==pos)&(a.season<=2024)];paired=d[d[col+'_l1'].notna()];prevpos=paired[paired[col+'_l1']>0]
        out.append({'position':pos,'player_seasons':int(len(d)),'positive_player_seasons':int((d[col]>0).sum()),'positive_rate':float((d[col]>0).mean()),'mean':float(d[col].mean()),'prior_positive_player_seasons':int(len(prevpos)),'positive_next_year_given_prior_positive':None if len(prevpos)==0 else float((prevpos[col]>0).mean())})
    return out

def aggregate(rows):
    frame=pd.DataFrame(rows);out=[]
    for (pos,model),g in frame.groupby(['position','model'],sort=True):
        out.append({'position':pos,'model':model,'folds':int(len(g)),'sample_size_sum':int(g.n.sum()),'mean_mae':float(g.mae.mean()),'mean_rmse':float(g.rmse.mean()),'mean_fantasy_point_mae':float(g.fantasy_point_mae.mean()),'mean_spearman':None if g.spearman.dropna().empty else float(g.spearman.dropna().mean()),'worst_fold_mae':float(g.mae.max())})
    return out

def classify(rows,models):
    f=pd.DataFrame(rows);result={}
    for pos in POS:
        z=f[(f.position==pos)&(f.model=='zero')].set_index('season');best=None
        for model in models:
            m=f[(f.position==pos)&(f.model==model)].set_index('season');years=sorted(set(z.index)&set(m.index))
            if not years:continue
            mean=float(m.loc[years,'fantasy_point_mae'].mean());wins=sum(float(m.loc[y,'fantasy_point_mae'])<float(z.loc[y,'fantasy_point_mae']) for y in years)
            cand={'model':model,'mean_fantasy_point_mae':mean,'wins_vs_zero':wins,'folds':len(years)}
            if best is None or (mean,-wins)<(best['mean_fantasy_point_mae'],-best['wins_vs_zero']):best=cand
        zero=float(z.fantasy_point_mae.mean());result[pos]={'zero_mean_fantasy_point_mae':zero,'best_nonzero':best,'zero_baseline_wins_mean':best is None or zero<=best['mean_fantasy_point_mae']}
    return result

def build(cache):
    w,m,audit,schema=load(cache);a=annualize(w);int_rows,int_cal=interception_return_models(a);sack=count_models(a,'sack2','sacks',2.0);pd3=count_models(a,'pd3','pd',2.0);frtd=count_models(a,'fum_rec_td','fum_rec',6.0);blk=count_models(a,'blk','sacks',3.0);std=count_models(a,'st_td','pd',6.0);fumret=continuous_models(a,'fum_ret_yards','fum_rec',.1)
    availability={'idp_int_ret_yd':{'fields':['def_interceptions','def_interception_yards'],'available':True},'bonus_sack_2p':{'fields':['def_sacks'],'available':True,'derived':'weekly count of games with def_sacks >= 2'},'idp_pass_def_3p':{'fields':['def_pass_defended'],'available':True,'derived':'weekly count of games with def_pass_defended >= 3'},'fum_rec_td':{'fields':['fumble_recovery_tds'],'available':True},'idp_fum_ret_yd':{'fields':['fumble_recovery_opp','fumble_recovery_yards_opp'],'available':True},'idp_blk_kick':{'fields':['def_punt_blocks','def_pat_blocks','def_fg_blocks'],'available':True},'st_td':{'fields':['special_teams_tds'],'available':True},'st_ff':{'fields':[],'available':False,'reason':'no separate player-level special-teams forced-fumble field in frozen weekly schema'},'st_fum_rec':{'fields':[],'available':False,'reason':'no separate player-level special-teams fumble-recovery field in frozen weekly schema'}}
    analyses={'idp_int_ret_yd':int_rows,'bonus_sack_2p':sack,'idp_pass_def_3p':pd3,'fum_rec_td':frtd,'idp_fum_ret_yd':fumret,'idp_blk_kick':blk,'st_td':std}
    candidates={'idp_int_ret_yd':['ridge_direct','poisson_int_count_x_conditional_mean','hurdle_occurrence_x_conditional_mean','prior_ints_x_conditional_rate'],'bonus_sack_2p':['poisson','negative_binomial','hurdle','prior_count','position_mean'],'idp_pass_def_3p':['poisson','negative_binomial','hurdle','prior_count','position_mean'],'fum_rec_td':['poisson','negative_binomial','hurdle','prior_count','position_mean'],'idp_fum_ret_yd':['ridge','count_rate','prior'],'idp_blk_kick':['poisson','negative_binomial','hurdle','prior_count','position_mean'],'st_td':['poisson','negative_binomial','hurdle','prior_count','position_mean']}
    readiness={}
    for cat in ['idp_int_ret_yd','bonus_sack_2p','idp_pass_def_3p','fum_rec_td','idp_fum_ret_yd','idp_blk_kick','st_td']:
        readiness[cat]={'classification':'UNSUPPORTED — ZERO BASELINE WINS','position_scoring_gate':classify(analyses[cat],candidates[cat])}
    readiness['st_ff']={'classification':'UNSUPPORTED — DATA BLOCKED','reason':availability['st_ff']['reason']};readiness['st_fum_rec']={'classification':'UNSUPPORTED — DATA BLOCKED','reason':availability['st_fum_rec']['reason']}
    return {'version':'idp-missing-stat-coverage-v0.2','research_base':{'qa_approved_head':QA_HEAD,'qa_approved_canonical_result_sha256':QA_CANONICAL,'frozen_input_sha256':m['snapshot_sha256'],'validated_control':'idp_sack_yd DL/LB only; DB unsupported; unchanged'},'chronology':{'development_seasons':DEV,'retrospective_observed':2025,'tuning_uses_2025':False},'source_state_contract':{'numeric_zero_distinct_from_missing':True,'null_distinct_from_zero':True,'unavailable_distinct_from_zero':True,'non_numeric_distinct_from_zero':True,'zero_fill_unavailable':False},'source_field_availability':availability,'source_state_audit':audit,'population':{'idp_int_ret_yd':prevalence(a,'int_yards'),'bonus_sack_2p':prevalence(a,'sack2'),'idp_pass_def_3p':prevalence(a,'pd3'),'fum_rec_td':prevalence(a,'fum_rec_td'),'idp_fum_ret_yd':prevalence(a,'fum_ret_yards'),'idp_blk_kick':prevalence(a,'blk'),'st_td':prevalence(a,'st_td')},'interception_occurrence_calibration':int_cal,'fold_rows':analyses,'aggregates':{k:aggregate(v) for k,v in analyses.items()},'readiness':readiness,'non_candidates_preserved':['idp_int_ret_yd','bonus_sack_2p','idp_pass_def_3p','fum_rec_td','idp_fum_ret_yd','idp_blk_kick','st_td','st_ff','st_fum_rec'],'global_scoring_gate':{'idp_sack_yd_globally_supported':False,'founder_like_scoring_rankable':False,'partial_support_does_not_imply_global_support':True},'firewalls':{'experimental':True,'production_projection_eligible':False,'idp_dynasty_value_available':False,'dynasty_value':None,'combined_offense_idp_dynasty_rankings_available':False,'core_integration_authorized':False,'ui_authorized':False,'production_authorized':False}}

def canonical(v,key=None):
    if isinstance(v,dict):return {k:canonical(v[k],k) for k in sorted(v)}
    if isinstance(v,list):return [canonical(x,key) for x in v]
    if isinstance(v,(np.integer,)):return int(v)
    if isinstance(v,(np.floating,float)):
        x=float(v)
        if not math.isfinite(x):raise RuntimeError('non-finite canonical output')
        dec=RANK_DECIMALS if key in RANK_KEYS else FLOAT_DECIMALS;r=float(f'{x:.{dec}f}');return 0.0 if r==0 else r
    return v

def serialize(v):return json.dumps(canonical(v),indent=2,sort_keys=True,allow_nan=False,ensure_ascii=False)+'\n'

def self_test():
    x,a=audit_numeric(pd.Series([0,1.0,0]),'x',9999);assert a['zero']==2
    for bad in [pd.Series([0,None]),pd.Series([0,'unavailable']),pd.Series([0,np.nan])]:
        try:audit_numeric(bad,'x',9999)
        except RuntimeError:pass
        else:raise AssertionError('missing state became zero')
    print('V02_SOURCE_STATE_SELF_TEST_PASS')

def main(argv):
    if argv==['--self-test']:self_test();return
    if len(argv)!=2:raise SystemExit('usage: idp-missing-stat-coverage-v02.py <cache> <output> | --self-test')
    txt=serialize(build(Path(argv[0])));p=Path(argv[1]);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(txt,encoding='utf-8',newline='\n');print(hashlib.sha256(txt.encode()).hexdigest())
if __name__=='__main__':main(sys.argv[1:])
