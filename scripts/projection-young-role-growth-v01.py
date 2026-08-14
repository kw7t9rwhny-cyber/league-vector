#!/usr/bin/env python3
import hashlib,json,math,sys
from pathlib import Path
import numpy as np,pandas as pd
from scipy.stats import spearmanr
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge,ElasticNet,LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score,brier_score_loss
CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-young-v01')
CONTROL=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/projection-v04-cycle2/control/candidate-player-seasons.json')
OUT=Path(sys.argv[3] if len(sys.argv)>3 else 'data/reports/projection-young-role-growth-v01/result.json')
SNAP='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'
CONTROL_SHA='6d931abadbcb06e910bf953d941902c7c2cd1638'
DEV=[2020,2021,2022,2023,2024]; POS=['QB','RB','WR','TE']; EXPS=[1,2,3]
ROLE_THR={'QB':300,'RB':150,'WR':75,'TE':50}
def mae(a,p): return float(np.mean(np.abs(np.asarray(p)-np.asarray(a))))
def rmse(a,p): return float(np.sqrt(np.mean((np.asarray(p)-np.asarray(a))**2)))
def sp(a,p):
 r=spearmanr(a,p).statistic if len(a)>2 and len(np.unique(p))>1 else np.nan
 return None if np.isnan(r) else float(r)
def rank_overlap(a,p):
 n=len(a);k=max(3,int(math.ceil(n*.25)))
 ia=set(np.argsort(np.asarray(a))[-k:]);ip=set(np.argsort(np.asarray(p))[-k:])
 return float(len(ia&ip)/k)
def reg(kind='ridge',alpha=10):
 est=Ridge(alpha=alpha) if kind=='ridge' else ElasticNet(alpha=.1,l1_ratio=.5,max_iter=20000)
 return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('est',est)])
def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text());assert m['snapshot_sha256']==SNAP,m['snapshot_sha256']
 fs=[]
 for y in range(2015,2026):
  d=pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False);fs.append(d[d.season_type.eq('REG')])
 return pd.concat(fs,ignore_index=True),pd.read_csv(CACHE/'players.csv',low_memory=False),m
def aggregate(w,players):
 sums=['attempts','passing_yards','passing_tds','passing_interceptions','carries','rushing_yards','rushing_tds','targets','receptions','receiving_yards','receiving_tds']
 for c in sums:
  if c not in w:w[c]=0
 for c in ['target_share','wopr']:
  if c not in w:w[c]=np.nan
 # position-specific weekly opportunity and fantasy
 w=w.copy();w['opp']=np.where(w.position_group.eq('QB'),w.attempts,np.where(w.position_group.eq('RB'),w.carries+w.targets,w.targets))
 w['fantasy']=w.passing_yards*.04+w.passing_tds*4-w.passing_interceptions*2+w.rushing_yards*.1+w.rushing_tds*6+w.receptions+w.receiving_yards*.1+w.receiving_tds*6
 annual=w.groupby(['player_id','season','position_group'],as_index=False).agg(games=('week','nunique'),fantasy=('fantasy','sum'),opp=('opp','sum'),target_share=('target_share','mean'),wopr=('wopr','mean'),**{c:(c,'sum') for c in sums})
 # late-season growth: final four observed regular-season games vs earlier observed games
 growth=[]
 for key,g in w.groupby(['player_id','season','position_group']):
  g=g.sort_values('week'); last=g.tail(4); early=g.iloc[:-4]
  late=float(last.opp.mean()) if len(last) else np.nan; earlym=float(early.opp.mean()) if len(early) else np.nan
  growth.append((*key,late,earlym,late-earlym if pd.notna(earlym) else np.nan))
 gr=pd.DataFrame(growth,columns=['player_id','season','position_group','late_opp_pg','early_opp_pg','late_opp_growth'])
 a=annual.merge(gr,on=['player_id','season','position_group'],how='left')
 a['opp_pg']=a.opp/a.games.clip(lower=1);a['fantasy_pg']=a.fantasy/a.games.clip(lower=1);a['eff_fp_per_opp']=a.fantasy/a.opp.replace(0,np.nan)
 meta=players[['gsis_id','birth_date','rookie_season','draft_round','draft_pick']].copy();meta.birth_date=pd.to_datetime(meta.birth_date,errors='coerce')
 a=a.merge(meta,left_on='player_id',right_on='gsis_id',how='left');a['age']=a.season-a.birth_date.dt.year;a['experience']=a.season-a.rookie_season
 a['draft_pick_f']=pd.to_numeric(a.draft_pick,errors='coerce');a['log_pick']=np.log1p(a.draft_pick_f.fillna(300).clip(1,300));a['drafted']=a.draft_pick_f.notna().astype(int)
 a=a.sort_values(['player_id','season'])
 lagcols=['fantasy','fantasy_pg','games','opp','opp_pg','target_share','wopr','eff_fp_per_opp','late_opp_pg','early_opp_pg','late_opp_growth','attempts','carries','targets','receptions','receiving_yards']
 for lag in [1,2,3]:
  for c in lagcols:a[f'{c}_l{lag}']=a.groupby('player_id')[c].shift(lag)
 return a
def control_frame(a):
 raw=pd.DataFrame(json.loads(CONTROL.read_text())).rename(columns={'id':'player_id','pos':'position_group','y':'season','pred':'control_pred','act':'actual','hc':'history_count'})
 cols=['player_id','season','position_group','experience','age','log_pick','drafted']+[c for c in a.columns if c.endswith('_l1') or c.endswith('_l2')]
 return raw.merge(a[cols],on=['player_id','season','position_group'],how='left')
FEATURES={
 'opp':['control_pred','opp_l1','opp_pg_l1','games_l1','target_share_l1'],
 'growth':['control_pred','opp_l1','opp_pg_l1','late_opp_growth_l1','late_opp_pg_l1','games_l1'],
 'draft':['control_pred','opp_l1','opp_pg_l1','log_pick','drafted','games_l1'],
 'ageexp':['control_pred','opp_l1','opp_pg_l1','age','experience','games_l1'],
 'full':['control_pred','opp_l1','opp_pg_l1','games_l1','target_share_l1','wopr_l1','eff_fp_per_opp_l1','late_opp_growth_l1','fantasy_pg_l1','fantasy_l2','opp_pg_l2','log_pick','drafted','age','experience']
}
def eval_models(d):
 rows=[]
 for pos in POS:
  for exp in EXPS:
   z=d[(d.position_group==pos)&(d.experience==exp)].copy()
   for y in DEV:
    tr=z[z.season<y];te=z[z.season==y]
    if len(tr)<20 or len(te)<5:continue
    cp=te.control_pred.to_numpy();act=te.actual.to_numpy()
    rows.append({'position':pos,'experience':exp,'season':y,'model':'control','n':len(te),'mae':mae(act,cp),'rmse':rmse(act,cp),'spearman':sp(act,cp),'rank_overlap':rank_overlap(act,cp),'bias':float(np.mean(cp-act))})
    for name,feats in FEATURES.items():
     for kind in ['ridge','elastic']:
      m=reg(kind);m.fit(tr[feats],tr.actual);pred=m.predict(te[feats])
      rows.append({'position':pos,'experience':exp,'season':y,'model':f'{kind}_{name}','n':len(te),'mae':mae(act,pred),'rmse':rmse(act,pred),'spearman':sp(act,pred),'rank_overlap':rank_overlap(act,pred),'bias':float(np.mean(pred-act))})
     # residual form
     m=reg('ridge');m.fit(tr[[f for f in feats if f!='control_pred']],tr.actual-tr.control_pred);pred=cp+m.predict(te[[f for f in feats if f!='control_pred']])
     rows.append({'position':pos,'experience':exp,'season':y,'model':f'residual_{name}','n':len(te),'mae':mae(act,pred),'rmse':rmse(act,pred),'spearman':sp(act,pred),'rank_overlap':rank_overlap(act,pred),'bias':float(np.mean(pred-act))})
 return pd.DataFrame(rows)
def role_models(d,a):
 # actual target-season opportunity from aggregate, merged to control rows
 target=a[['player_id','season','position_group','opp']].rename(columns={'opp':'actual_opp'})
 z=d.merge(target,on=['player_id','season','position_group'],how='left');out=[]
 hist=['opp_l1','opp_pg_l1','games_l1','fantasy_pg_l1']; rich=hist+['late_opp_growth_l1','target_share_l1','eff_fp_per_opp_l1','log_pick','drafted','age','experience']
 for pos in POS:
  q=z[(z.position_group==pos)&z.experience.isin(EXPS)].copy();q['role']=(q.actual_opp>=ROLE_THR[pos]).astype(int);q['prior_role']=(q.opp_l1>=ROLE_THR[pos]).astype(int);q['expanded']=((q.prior_role==0)&(q.role==1)).astype(int)
  for y in DEV:
   tr=q[q.season<y];te=q[q.season==y]
   if len(tr)<40 or len(te)<8 or tr.role.nunique()<2 or te.role.nunique()<2:continue
   for name,feats in [('historical',hist),('rich',rich)]:
    m=Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('logit',LogisticRegression(C=.1,max_iter=1000))]);m.fit(tr[feats],tr.role);p=m.predict_proba(te[feats])[:,1]
    out.append({'position':pos,'season':y,'model':name,'n':len(te),'auc':float(roc_auc_score(te.role,p)),'brier':float(brier_score_loss(te.role,p))})
   # role expansion among prior backups only
   trb=tr[tr.prior_role==0];teb=te[te.prior_role==0]
   if len(trb)>=25 and len(teb)>=5 and trb.expanded.nunique()>1 and teb.expanded.nunique()>1:
    for name,feats in [('historical',hist),('rich',rich)]:
     m=Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('logit',LogisticRegression(C=.1,max_iter=1000))]);m.fit(trb[feats],trb.expanded);p=m.predict_proba(teb[feats])[:,1]
     out.append({'position':pos,'season':y,'model':f'expansion_{name}','n':len(teb),'auc':float(roc_auc_score(teb.expanded,p)),'brier':float(brier_score_loss(teb.expanded,p))})
 return out
def select(df):
 picks={};summ=[]
 for pos in POS:
  for exp in EXPS:
   q=df[(df.position==pos)&(df.experience==exp)];base=q[q.model=='control'][['season','mae','rmse','spearman','rank_overlap','bias']].rename(columns={c:f'{c}_base' for c in ['mae','rmse','spearman','rank_overlap','bias']})
   cand=[]
   for name,g in q[q.model!='control'].groupby('model'):
    z=g.merge(base,on='season');
    if len(z)<3:continue
    z['gain']=100*(z.mae_base-z.mae)/z.mae_base
    rec={'position':pos,'experience':exp,'model':name,'folds':len(z),'wins':int((z.gain>0).sum()),'losses':int((z.gain<=0).sum()),'mean_gain_pct':float(z.gain.mean()),'median_gain_pct':float(z.gain.median()),'worst_gain_pct':float(z.gain.min()),'best_gain_pct':float(z.gain.max()),'mean_rmse':float(z.rmse.mean()),'mean_spearman':float(z.spearman.dropna().mean()) if z.spearman.notna().any() else None,'mean_rank_overlap':float(z.rank_overlap.mean()),'mean_bias':float(z.bias.mean())};cand.append(rec);summ.append(rec)
   eligible=[x for x in cand if x['wins']>x['losses'] and x['mean_gain_pct']>1 and x['median_gain_pct']>0 and x['worst_gain_pct']>-15]
   eligible.sort(key=lambda x:(x['wins'],x['mean_gain_pct']),reverse=True);picks[f'{pos}_Y{exp+1}']=eligible[0] if eligible else None
 return picks,summ
def retrospective_2025(d,picks):
 out=[]
 for pos in POS:
  for exp in EXPS:
   te=d[(d.position_group==pos)&(d.experience==exp)&(d.season==2025)];tr=d[(d.position_group==pos)&(d.experience==exp)&(d.season<2025)]
   if len(te)<3:continue
   key=f'{pos}_Y{exp+1}';choice=picks.get(key);pred=te.control_pred.to_numpy();name='control'
   if choice:
    name=choice['model'];parts=name.split('_',1);feats=FEATURES[parts[1]]
    if parts[0]=='residual':
     m=reg('ridge');m.fit(tr[[f for f in feats if f!='control_pred']],tr.actual-tr.control_pred);pred=te.control_pred.to_numpy()+m.predict(te[[f for f in feats if f!='control_pred']])
    else:
     m=reg(parts[0]);m.fit(tr[feats],tr.actual);pred=m.predict(te[feats])
   out.append({'position':pos,'experience':exp,'model':name,'n':len(te),'control_mae':mae(te.actual,te.control_pred),'candidate_mae':mae(te.actual,pred),'mae_gain_pct':100*(mae(te.actual,te.control_pred)-mae(te.actual,pred))/mae(te.actual,te.control_pred),'control_rmse':rmse(te.actual,te.control_pred),'candidate_rmse':rmse(te.actual,pred),'control_spearman':sp(te.actual,te.control_pred),'candidate_spearman':sp(te.actual,pred),'control_rank_overlap':rank_overlap(te.actual,te.control_pred),'candidate_rank_overlap':rank_overlap(te.actual,pred)})
 return out
def main():
 w,p,m=load();a=aggregate(w,p);d=control_frame(a);df=eval_models(d);picks,summ=select(df);roles=role_models(d,a);retro=retrospective_2025(d,picks)
 # established veterans are unchanged by construction
 young=d[(d.experience.isin(EXPS))&(d.season<=2024)].copy();bias=young.assign(err=young.control_pred-young.actual).groupby(['position_group','experience']).agg(n=('err','size'),control_bias=('err','mean'),control_mae=('err',lambda x:float(np.mean(np.abs(x))))).reset_index().to_dict('records')
 res={'version':'lv-young-role-growth-v0.1-research','validated_control_sha':CONTROL_SHA,'input_snapshot_sha256':m['snapshot_sha256'],'selection_evidence_seasons':DEV,'retrospective_observed_season':2025,'candidate_gate':{'min_folds':3,'wins_gt_losses':True,'mean_mae_gain_pct_gt':1,'median_gain_gt':0,'worst_fold_gain_pct_gt':-15},'selected_by_position_experience':picks,'candidate_summaries':summ,'fold_results':df.to_dict('records'),'role_models':roles,'control_bias_by_experience':bias,'retrospective_2025':retro,'established_veteran_policy':'unchanged_validated_v04','limitations':['no historical point-in-time depth charts','no target-season team-change feature because current team at historical prediction time is not frozen in this snapshot','2025 cannot influence selection','rookies handled by separate rookie research'],'flags':{'experimental':True,'production_projection_eligible':False,'dynasty_value_eligible':False}}
 OUT.parent.mkdir(parents=True,exist_ok=True);txt=json.dumps(res,indent=2,sort_keys=True)+'\n';OUT.write_text(txt);print(hashlib.sha256(txt.encode()).hexdigest())
if __name__=='__main__':main()
