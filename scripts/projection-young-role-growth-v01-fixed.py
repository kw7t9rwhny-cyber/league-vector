#!/usr/bin/env python3
import importlib.util
from pathlib import Path
p=Path(__file__).with_name('projection-young-role-growth-v01.py')
spec=importlib.util.spec_from_file_location('young_v01',p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def control_frame(a):
    raw=m.pd.DataFrame(m.json.loads(m.CONTROL.read_text())).rename(columns={'id':'player_id','pos':'position_group','y':'season','pred':'control_pred','act':'actual','hc':'history_count'})
    raw=raw.drop(columns=['age','experience'],errors='ignore')
    cols=['player_id','season','position_group','experience','age','log_pick','drafted']+[c for c in a.columns if c.endswith('_l1') or c.endswith('_l2')]
    return raw.merge(a[cols],on=['player_id','season','position_group'],how='left')
m.control_frame=control_frame
m.main()
