#!/usr/bin/env python3
import importlib.util
import sys
from pathlib import Path
import pandas as pd

HERE=Path(__file__).resolve().parent
SPEC=importlib.util.spec_from_file_location('rookie_dynasty_v01',HERE/'rookie-dynasty-value-v01.py')
mod=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


def corrected_add_future_outcomes(rookies,seasons):
    base=rookies[['player_id','rookie_season','position_group','display_name','age','round','pick','log_pick','inv_pick','day']].drop_duplicates().copy()
    league=seasons[['player_id','season','position_group','fantasy','games']].copy()
    league['position_rank']=league.groupby(['season','position_group']).fantasy.rank(method='min',ascending=False)
    league['top_tier']=[int(r<=mod.TOP_N[p]) for r,p in zip(league.position_rank,league.position_group)]
    for h in range(0,5):
        q=league.copy(); q['rookie_season']=q.season-h
        q=q.rename(columns={'fantasy':f'y{h}_fantasy','games':f'y{h}_games','position_rank':f'y{h}_position_rank','top_tier':f'y{h}_top_tier'})
        q=q[['player_id','rookie_season','position_group',f'y{h}_fantasy',f'y{h}_games',f'y{h}_position_rank',f'y{h}_top_tier']]
        base=base.merge(q,on=['player_id','rookie_season','position_group'],how='left',validate='one_to_one')
        base[f'y{h}_fantasy']=base[f'y{h}_fantasy'].fillna(0.0)
        base[f'y{h}_games']=base[f'y{h}_games'].fillna(0)
        base[f'y{h}_top_tier']=base[f'y{h}_top_tier'].fillna(0).astype(int)
    base['multi_year_y1_y3']=base[['y1_fantasy','y2_fantasy','y3_fantasy']].sum(axis=1)
    base['career_persistence_y1_y3']=base[['y1_games','y2_games','y3_games']].gt(0).sum(axis=1)
    return base

mod.add_future_outcomes=corrected_add_future_outcomes
mod.main()
