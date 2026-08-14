#!/usr/bin/env python3
import hashlib,json,sys
from pathlib import Path
import numpy as np,pandas as pd
from scipy.stats import spearmanr
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge,LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score,brier_score_loss

CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/lv-rookie-year2-v01')
V04=Path(sys.argv[2] if len(sys.argv)>2 else 'data/reports/projection-v04-canonical/run-a/candidate-player-seasons.json')
OUT=Path(sys.argv[3] if len(sys.argv)>3 else 'data/reports/projection-rookie-year2-v01/result.json')
SNAP='d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188'
POS=['QB','RB','WR','TE']; DEV_TARGETS=list(range(2020,2025)); RETRO=2025
STAT=['attempts','passing_yards','passing_tds','passing_interceptions','carries','rushing_yards','rushing_tds','targets','receptions','receiving_yards','receiving_tds']
FAMILIES={
 'production_only':['fantasy_r','fantasy_pg','opp_r','opp_pg','missed_games','rookie_pct'],
 'production_plus_draft':['draft_pick','age','fantasy_r','fantasy_pg','opp_r','opp_pg','missed_games','rookie_pct'],
 'full_year1':['draft_pick','age','fantasy_r','fantasy_pg','opp_r','opp_pg','eff','missed_games','late_opp_delta','late_opp_ratio','rookie_pct']
}

def met(a,p):
 a=np.asarray(a,float); p=np.asarray(p,float)
 rho=spearmanr(a,p).statistic if len(a)>2 and len(np.unique(p))>1 else np.nan
 return {'mae':float(np.mean(np.abs(a-p))),'rmse':float(np.sqrt(np.mean((a-p)**2))),'spearman':None if np.isnan(rho) else float(rho),'bias':float(np.mean(p-a))}

def ridge(alpha=10): return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('ridge',Ridge(alpha=alpha))])
def logit(): return Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('logit',LogisticRegression(C=.1,max_iter=2000))])

def load():
 m=json.loads((CACHE/'snapshot-manifest.json').read_text())
 if m['snapshot_sha256']!=SNAP: raise RuntimeError(f'validated control snapshot drift: {m["snapshot_sha256"]}')
 fs=[]
 for y in range(2015,2026):
  d=pd.read_csv(CACHE/f'stats_player_week_{y}.csv',low_memory=False); fs.append(d[d.season_type.eq('REG')])
 w=pd.concat(fs,ignore_index=True); p=pd.read_csv(CACHE/'players.csv',low_memory=False); v=json.loads(V04.read_text())
 return w,p,pd.DataFrame([{'player_id':x['id'],'target_year':int(x['y']),'position_group':x['pos'],'v04_pred':float(x['pred']),'v04_act':float(x['act']),'history_count':int(x['hc'])} for x in v]),m

def strict_meta(players):
 need=['gsis_id','birth_date','rookie_season','draft_year','draft_round','draft_pick']
 if any(c not in players for c in need): raise RuntimeError('required player metadata missing')
 if players.gsis_id.isna().any() or players.gsis_id.duplicated().any(): raise RuntimeError('player identity metadata not unique/complete')
 m=players[need].copy();m.birth_date=pd.to_datetime(m.birth_date,errors='coerce')
 for c in ['rookie_season','draft_year','draft_round','draft_pick']:m[c]=pd.to_numeric(m[c],errors='coerce')
 present=m[['draft_year','draft_round','draft_pick']].notna().sum(axis=1)
 m['draft_state']=np.select([present.eq(3),present.eq(0)],['COMPLETE','UNRESOLVED_MISSING'],default='INCONSISTENT_PARTIAL')
 complete=m.draft_state.eq('COMPLETE')
 invalid=complete & ((m.draft_year%1!=0)|(m.draft_round%1!=0)|(m.draft_pick%1!=0)|~m.draft_round.between(1,7)|~m.draft_pick.between(1,300))
 mismatch=complete & m.rookie_season.notna() & m.draft_year.ne(m.rookie_season)
 m.loc[invalid,'draft_state']='INCONSISTENT_VALUE';m.loc[mismatch,'draft_state']='INCONSISTENT_DRAFT_YEAR'
 supp=m.draft_state.eq('COMPLETE') & m.draft_round.gt(1) & m.draft_pick.eq(1);m.loc[supp,'draft_state']='SUPPLEMENTAL_EXCLUDED'
 return m

def build(w,players,v04):
 w=w[w.position_group.isin(POS)].copy()
 if w.player_id.isna().any(): raise RuntimeError('null weekly offensive player identity')
 for c in STAT:
  if c not in w:w[c]=0
 w['fantasy']=w.passing_yards*.04+w.passing_tds*4-w.passing_interceptions*2+w.rushing_yards*.1+w.rushing_tds*6+w.receptions+w.receiving_yards*.1+w.receiving_tds*6
 w['opp']=np.where(w.position_group.eq('QB'),w.attempts+w.carries,w.carries+w.targets)
 src=w.groupby(['player_id','season','position_group'],as_index=False,dropna=False).agg(games=('week','nunique'),fantasy=('fantasy','sum'),attempts=('attempts','sum'),carries=('carries','sum'),targets=('targets','sum'),opp=('opp','sum'))
 if src.duplicated(['player_id','season']).any():raise RuntimeError('duplicate source player-season')
 meta=strict_meta(players)
 j=src.merge(meta,left_on='player_id',right_on='gsis_id',how='left',indicator=True,validate='many_to_one')
 if (j._merge!='both').any(): raise RuntimeError('unmatched source identity before cohort filtering')
 j=j.drop(columns='_merge')
 bad=j[j.season.eq(j.rookie_season)&j.draft_state.str.startswith('INCONSISTENT')]
 if len(bad):raise RuntimeError(f'inconsistent draft metadata reached rookie source: {len(bad)}')
 late=[]
 for (pid,s,pos),g in w.groupby(['player_id','season','position_group']):
  g=g.sort_values('week'); tail=g.tail(4); prev=g.iloc[:-4]
  last=float(tail.opp.mean()) if len(tail) else 0.0; before=float(prev.opp.mean()) if len(prev) else last
  late.append((pid,s,last-before,last/(before+1.0)))
 late=pd.DataFrame(late,columns=['player_id','season','late_opp_delta','late_opp_ratio']);j=j.merge(late,on=['player_id','season'],how='left',validate='one_to_one')
 rook=j[(j.season==j.rookie_season)&j.position_group.isin(POS)].copy()
 eligible=rook[rook.draft_state.eq('COMPLETE')].copy()
 eligible['age']=eligible.season-eligible.birth_date.dt.year
 eligible['fantasy_pg']=eligible.fantasy/eligible.games.clip(lower=1);eligible['opp_pg']=eligible.opp/eligible.games.clip(lower=1);eligible['eff']=eligible.fantasy/eligible.opp.clip(lower=1)
 eligible['missed_games']=eligible.apply(lambda x:(16 if int(x.season)<=2020 else 17)-int(x.games),axis=1)
 eligible['rookie_pct']=eligible.groupby(['season','position_group']).fantasy.rank(pct=True,method='average')
 y2=src.rename(columns={'season':'target_year','games':'games_y2','fantasy':'fantasy_y2','attempts':'attempts_y2','carries':'carries_y2','targets':'targets_y2','opp':'opp_y2'})
 z=eligible.merge(y2,left_on=['player_id','position_group'],right_on=['player_id','position_group'],how='inner')
 z=z[z.target_year.eq(z.rookie_season+1)].copy()
 z=z.rename(columns={'fantasy':'fantasy_r','games':'games_r','attempts':'attempts_r','carries':'carries_r','targets':'targets_r','opp':'opp_r'})
 z=z.merge(v04,on=['player_id','target_year','position_group'],how='left',validate='one_to_one')
 audit={'source_offensive_player_seasons':int(len(src)),'source_unique_players':int(src.player_id.nunique()),'source_to_metadata_unmatched':0,'metadata_duplicate_gsis':int(players.gsis_id.duplicated().sum()),'raw_rookie_rows':int(len(rook)),'eligible_confirmed_drafted_rookies':int(len(eligible)),'unresolved_rookie_draft_metadata_excluded':int((rook.draft_state=='UNRESOLVED_MISSING').sum()),'supplemental_rookies_excluded':int((rook.draft_state=='SUPPLEMENTAL_EXCLUDED').sum()),'paired_year2_rows':int(len(z)),'paired_duplicate_identities':int(z.duplicated(['player_id','target_year']).sum()),'team_change_point_in_time_safe':False,'team_change_limitation':'Frozen weekly stats can identify eventual Year-2 team but do not prove the move was known at a preseason cutoff; team-change is excluded from selectable features.'}
 if audit['paired_duplicate_identities']:raise RuntimeError('duplicate year2 identity')
 return z,audit

def evaluate(z):
 rows=[]
 for pos in POS:
  d=z[z.position_group.eq(pos)].copy()
  for y in DEV_TARGETS:
   tr=d[d.target_year<y];te=d[d.target_year.eq(y)&d.v04_pred.notna()]
   if len(tr)<20 or len(te)<3:continue
   rows.append({'position':pos,'season':y,'model':'validated_v04','train_n':None,'n':int(len(te)),**met(te.fantasy_y2,te.v04_pred)})
   for name,feats in FAMILIES.items():
    m=ridge(10);m.fit(tr[feats],tr.fantasy_y2);pred=m.predict(te[feats])
    rows.append({'position':pos,'season':y,'model':name,'train_n':int(len(tr)),'n':int(len(te)),**met(te.fantasy_y2,pred)})
 return pd.DataFrame(rows)

def summarize(df,z):
 out={}
 for pos in POS:
  base=df[(df.position==pos)&(df.model=='validated_v04')];scores=[]
  for name in FAMILIES:
   g=df[(df.position==pos)&(df.model==name)]
   q=g.merge(base[['season','mae']],on='season',suffixes=('','_base'))
   if q.empty:continue
   q['gain_pct']=100*(q.mae_base-q.mae)/q.mae_base
   scores.append({'model':name,'folds':int(len(q)),'wins':int((q.gain_pct>0).sum()),'mean_gain_pct':float(q.gain_pct.mean()),'worst_gain_pct':float(q.gain_pct.min()),'mean_mae':float(g.mae.mean()),'mean_rmse':float(g.rmse.mean()),'mean_spearman':float(g.spearman.dropna().mean()) if g.spearman.notna().any() else None,'mean_bias':float(g.bias.mean()),'v04_mean_mae':float(base[base.season.isin(q.season)].mae.mean()),'folds_detail':[{'season':int(r.season),'n':int(r.n),'train_n':int(r.train_n),'candidate_mae':float(r.mae),'v04_mae':float(r.mae_base),'gain_pct':float(r.gain_pct),'won':bool(r.gain_pct>0)} for r in q.itertuples()]})
  scores.sort(key=lambda x:(x['wins'],x['mean_gain_pct']),reverse=True)
  n=int(len(z[(z.position_group==pos)&z.target_year.isin(DEV_TARGETS)&z.v04_pred.notna()]))
  out[pos]={'development_n':n,'families':scores,'best_by_development':scores[0] if scores else None}
 return out

def role_split(z):
 out={};feats=FAMILIES['production_plus_draft']
 for pos in POS:
  d=z[z.position_group.eq(pos)].copy();d['expanded']=(d.opp_y2/d.games_y2.clip(lower=1)>=1.25*d.opp_pg).astype(int);folds=[]
  for y in DEV_TARGETS:
   tr=d[d.target_year<y];te=d[d.target_year.eq(y)]
   if len(tr)<25 or len(te)<4 or tr.expanded.nunique()<2 or te.expanded.nunique()<2:continue
   m=logit();m.fit(tr[feats],tr.expanded);p=m.predict_proba(te[feats])[:,1]
   auc=float(roc_auc_score(te.expanded,p));brier=float(brier_score_loss(te.expanded,p));cond=[]
   for state in [0,1]:
    a=tr[tr.expanded.eq(state)];b=te[te.expanded.eq(state)]
    if len(a)>=15 and len(b)>=3:
     rm=ridge(10);rm.fit(a[feats],a.fantasy_y2);pr=rm.predict(b[feats]);cond.append({'expanded':bool(state),'n':int(len(b)),**met(b.fantasy_y2,pr)})
   folds.append({'season':y,'n':int(len(te)),'expansion_rate':float(te.expanded.mean()),'auc':auc,'brier':brier,'conditional_production':cond})
  out[pos]={'definition':'Year-2 opportunity/game >= 1.25 * rookie opportunity/game; diagnostic threshold only','folds':folds,'mean_auc':float(np.mean([x['auc'] for x in folds])) if folds else None,'mean_brier':float(np.mean([x['brier'] for x in folds])) if folds else None}
 return out

def residual_signal(z):
 out=[];feats=['draft_pick','age']
 for pos in POS:
  d=z[z.position_group.eq(pos)].copy()
  for ry in sorted(d.rookie_season.unique()):
   tr=d[d.rookie_season<ry].drop_duplicates(['player_id','rookie_season']);te=d[d.rookie_season.eq(ry)].copy()
   if len(tr)<20 or len(te)<3:continue
   m=ridge(10);m.fit(tr[feats],tr.fantasy_r);res=te.fantasy_r.to_numpy()-m.predict(te[feats]);corr=None
   if te.v04_pred.notna().all() and len(res)>2:
    c=np.corrcoef(res,te.fantasy_y2.to_numpy()-te.v04_pred.to_numpy())[0,1];corr=None if np.isnan(c) else float(c)
   out.append({'position':pos,'rookie_season':int(ry),'n':int(len(te)),'residual_mean':float(np.mean(res)),'correlation_rookie_residual_to_y2_v04_error':corr})
 return out

def retrospective(z,summary):
 out={}
 for pos in POS:
  te=z[(z.position_group==pos)&(z.target_year==RETRO)&z.v04_pred.notna()];prior=z[(z.position_group==pos)&(z.target_year<RETRO)];best=summary[pos]['best_by_development']
  if len(te)<3 or best is None or len(prior)<20:out[pos]={'n':int(len(te)),'status':'insufficient'};continue
  name=best['model'];m=ridge(10);m.fit(prior[FAMILIES[name]],prior.fantasy_y2);pred=m.predict(te[FAMILIES[name]])
  out[pos]={'n':int(len(te)),'selected_from_pre2025':name,'candidate':met(te.fantasy_y2,pred),'validated_v04':met(te.fantasy_y2,te.v04_pred),'status':'retrospective_observed_not_used_for_selection'}
 return out

def main():
 w,p,v,m=load();z,audit=build(w,p,v);df=evaluate(z);summary=summarize(df,z);v04_hash=hashlib.sha256(V04.read_bytes()).hexdigest();material=False;gates={}
 for pos in POS:
  b=summary[pos]['best_by_development'];n=summary[pos]['development_n'];passed=bool(b and n>=50 and b['mean_gain_pct']>=5 and b['wins']>b['folds']/2 and b['worst_gain_pct']>=0)
  gates[pos]={'development_n':n,'candidate_gate_pass':passed,'rule':'>=50 rows; >=5% mean MAE gain vs validated v0.4; majority fold wins; no losing fold'};material|=passed
 decision='READY FOR QA — HIGH RISK' if material else 'MORE ROOKIE→YEAR-2 RESEARCH REQUIRED'
 res={'version':'rookie-year2-development-bridge-v0.1','input_snapshot_sha256':m['snapshot_sha256'],'validated_v04_player_seasons_sha256':v04_hash,'development_target_seasons':DEV_TARGETS,'retrospective_observed':RETRO,'identity_and_provenance':audit,'features':{'selectable':FAMILIES,'excluded_point_in_time_unsafe':['team_change'],'no_generic_age_multiplier':True,'age_is_only_a_regularized_feature':True},'head_to_head':summary,'fold_results':df.to_dict('records'),'role_expansion':role_split(z),'rookie_residual_signal':residual_signal(z),'retrospective_2025':retrospective(z,summary),'candidate_gates':gates,'established_player_regression':{'validated_v04_immutable':True,'control_file_sha256':v04_hash,'production_files_modified':False},'limitations':['Validated v0.4 comparable player-season predictions begin in 2020, limiting direct head-to-head to 2020-2024 development folds.','Team-change feature is excluded because frozen weekly stats do not prove point-in-time preseason transaction state.','Depth-chart/current opportunity information may be necessary to distinguish true Year-2 role expansion from noisy Year-1 production history.','Role-expansion threshold is a research diagnostic, not a production multiplier or point adjustment.'],'decision':decision,'flags':{'experimental':True,'production_projection_eligible':False,'dynasty_value_eligible':False,'ready_for_qa':bool(material)}}
 OUT.parent.mkdir(parents=True,exist_ok=True);text=json.dumps(res,indent=2,sort_keys=True)+'\n';OUT.write_text(text);print(hashlib.sha256(text.encode()).hexdigest());print(decision)
if __name__=='__main__':main()
