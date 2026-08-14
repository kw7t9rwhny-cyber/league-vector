const test = require('node:test');
const assert = require('node:assert/strict');
const Data = require('../football-data-v08.js');
const Age = require('../scripts/idp-age-curves-v03.js');

function stat(value) { return { state: Data.DATA_STATE.VALUE, value }; }
function obs(gsis, season, week, position, solo, snaps) {
  return {
    gsis_id: gsis, season, week, position_group: position,
    stats: {
      solo_tackles:stat(solo), assisted_tackles:stat(0), tackles_for_loss:stat(0), sacks:stat(0), qb_hits:stat(0),
      interceptions:stat(0), passes_defended:stat(0), forced_fumbles:stat(0), fumble_recoveries:stat(0), defensive_td:stat(0), safeties:stat(0),
      defensive_snaps: snaps == null ? { state:Data.DATA_STATE.UNAVAILABLE, value:null } : stat(snaps),
    },
  };
}

test('age curve builder uses historical season age and preserves unavailable opportunity', () => {
  const bio = new Map([
    ['p1', { bio:{ birth_date:'1995-09-15', rookie_year:2018 } }],
  ]);
  const rows = [
    obs('p1',2020,1,'DB',4,null), obs('p1',2020,2,'DB',2,null),
    obs('p1',2021,1,'DB',5,null),
  ];
  const seasons = Age.buildPlayerSeasons(rows,bio);
  const y2020 = seasons.find((x)=>x.season===2020);
  assert.equal(y2020.player_season_age,24);
  assert.equal(y2020.experience_season,3);
  assert.equal(y2020.reference_points,9);
  assert.equal(y2020.defensive_snaps,null);
  assert.equal(y2020.opportunity_status,'defensive_snaps_unavailable');
  assert.equal(y2020.next_season_any_idp_observed,true);
  assert.equal(y2020.next_season_same_model_position,true);
});

test('curves expose participation survival separately from blocked true role survival', () => {
  const bio = new Map([
    ['p1', { bio:{ birth_date:'1995-01-01', rookie_year:2018 } }],
    ['p2', { bio:{ birth_date:'1995-01-01', rookie_year:2019 } }],
  ]);
  const rows = [
    obs('p1',2020,1,'LB',4,50), obs('p1',2021,1,'LB',5,55),
    obs('p2',2020,1,'LB',3,45),
  ];
  const seasons = Age.buildPlayerSeasons(rows,bio);
  const curves = Age.groupCurves(seasons,2021);
  const age25 = curves.find((x)=>x.position==='LB' && x.age===25);
  assert.ok(age25);
  assert.equal(age25.participation_survival_exposure_n,2);
  assert.equal(age25.next_season_any_idp_observed_rate,0.5);
  assert.equal(age25.role_survival_status,'BLOCKED_WITHOUT_POINT_IN_TIME_ROLE_OR_SNAP_AUTHORITY');
  assert.equal(age25.opportunity_n_with_defensive_snaps,2);
});
