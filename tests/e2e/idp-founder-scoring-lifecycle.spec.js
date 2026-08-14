const { test, expect } = require('@playwright/test');

const LEAGUE_ID = '88776655';
const marketCsv = [
  'player,pos,team,age,ecr_1qb,ecr_2qb,value_1qb,value_2qb,scrape_date,fp_id',
  'Fixture Quarterback,QB,GB,26,20,10,5000,7000,2026-08-14,qb1',
].join('\n');

const founderIdpScoring = {
  blk_kick:2, bonus_sack_2p:2, def_st_ff:1, def_st_fum_rec:1, def_st_td:6, def_st_tkl_solo:2,
  def_td:6, ff:1, fum_rec:2, fum_rec_td:6, idp_blk_kick:3, idp_def_td:6, idp_ff:4,
  idp_fum_rec:2, idp_fum_ret_yd:0.1, idp_int:6, idp_int_ret_yd:0.1, idp_pass_def:3,
  idp_pass_def_3p:2, idp_qb_hit:0.5, idp_sack:5, idp_sack_yd:0.1, idp_safe:6,
  idp_tkl:1.25, idp_tkl_ast:0.75, idp_tkl_loss:3, idp_tkl_solo:1.75,
  sack:1, safe:2, st_ff:1, st_fum_rec:1, st_td:6,
};
const unsupportedPlayerKeys = [
  'bonus_sack_2p','fum_rec_td','idp_blk_kick','idp_fum_ret_yd','idp_int_ret_yd',
  'idp_pass_def_3p','idp_sack_yd','st_ff','st_fum_rec','st_td',
].sort();
const defensibleScoring = Object.fromEntries(Object.entries(founderIdpScoring).filter(([key]) => !unsupportedPlayerKeys.includes(key)));

const baseLeague = {
  league_id: LEAGUE_ID, name: 'Founder IDP Scoring Shape', season: '2026', total_rosters: 1,
  roster_positions: ['QB','DL','LB','DB','IDP_FLEX','BN'],
  settings: { draft_rounds: 2, playoff_week_start: 14 },
};
const users = [{ user_id:'u1', display_name:'Owner' }];
const rosters = [{ roster_id:1, owner_id:'u1', players:['qb1','dl1','lb1','db1','hy1'], starters:['qb1','dl1','lb1','db1','hy1'], taxi:[], reserve:[] }];
const players = {
  qb1:{ full_name:'Fixture Quarterback', position:'QB', fantasy_positions:['QB'], team:'GB', years_exp:3, active:true, status:'Active' },
  dl1:{ full_name:'Fixture Edge', position:'DL', fantasy_positions:['DL'], team:'DAL', years_exp:4, active:true, status:'Active' },
  lb1:{ full_name:'Fixture Linebacker', position:'LB', fantasy_positions:['LB'], team:'PIT', years_exp:4, active:true, status:'Active' },
  db1:{ full_name:'Fixture Safety', position:'DB', fantasy_positions:['DB'], team:'MIN', years_exp:4, active:true, status:'Active' },
  hy1:{ full_name:'Fixture Hybrid', position:'DL', fantasy_positions:['DL','LB'], team:'BAL', years_exp:3, active:true, status:'Active' },
};
const stats = (scale) => ({
  solo_tackles:60*scale, assisted_tackles:25*scale, total_tackles:85*scale, tackles_for_loss:8*scale,
  sacks:5*scale, qb_hits:10*scale, interceptions:1*scale, passes_defended:5*scale,
  forced_fumbles:2*scale, fumble_recoveries:1*scale, defensive_td:0, safeties:0,
});
const artifact = {
  v:'lv-projection-frontend-v0.3', m:'lv-projection-system-v0.3', d:'2026-08-14T12:00:00Z', through:2025,
  r:[
    {s:'dl1',g:'g-dl1',p:'DL',t:'DAL',z:'projection_ready',x:stats(1.0)},
    {s:'lb1',g:'g-lb1',p:'LB',t:'PIT',z:'projection_ready',x:stats(1.2)},
    {s:'db1',g:'g-db1',p:'DB',t:'MIN',z:'projection_ready',x:stats(0.9)},
    {s:'hy1',g:'g-hy1',p:'DL',t:'BAL',z:'projection_ready',x:stats(1.1)},
  ],
};

async function mockLifecycle(page, scoring) {
  const league = { ...baseLeague, scoring_settings:{ pass_yd:0.04, pass_td:4, ...scoring } };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/data/experimental/2026-projections.json')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(artifact)});
    if (url.hostname === 'raw.githubusercontent.com') return route.fulfill({status:200,contentType:'text/csv',body:marketCsv});
    if (url.hostname !== 'api.sleeper.app') return route.continue();
    const path=url.pathname;
    if (path === `/v1/league/${LEAGUE_ID}`) return route.fulfill({json:league});
    if (path === `/v1/league/${LEAGUE_ID}/users`) return route.fulfill({json:users});
    if (path === `/v1/league/${LEAGUE_ID}/rosters`) return route.fulfill({json:rosters});
    if (path === `/v1/league/${LEAGUE_ID}/traded_picks`) return route.fulfill({json:[]});
    if (path === '/v1/players/nfl') return route.fulfill({json:players});
    if (path === '/v1/state/nfl') return route.fulfill({json:{league_season:'2026',leg:1}});
    if (path.includes('/projections/nfl/')) return route.fulfill({json:[{player_id:'qb1',stats:{pass_yd:250,pass_td:2}}]});
    if (path.includes(`/v1/league/${LEAGUE_ID}/transactions/`)) return route.fulfill({json:[]});
    return route.fulfill({status:404,json:{error:`Unhandled ${url}`}});
  });
}

async function analyze(page) {
  await page.goto('/');
  await page.getByLabel('Sleeper league ID or URL').fill(LEAGUE_ID);
  await page.getByRole('button',{name:'Analyze League'}).click();
  await expect(page.locator('#status')).toHaveClass(/success/,{timeout:15000});
  await expect(page.locator('#experimentalIdpRankings')).toBeVisible({timeout:15000});
  await page.waitForFunction(() => window.__leagueVectorIdpRankingsContract && window.__leagueVectorIdpRankingsContract.status !== 'building_current_season_rankings', null, {timeout:15000});
  return page.evaluate(() => window.__leagueVectorIdpRankingsContract);
}

test('full Founder scoring shape fails closed on the exact unprojected player categories', async ({page}) => {
  await mockLifecycle(page, founderIdpScoring);
  const contract = await analyze(page);
  expect(contract.status).toBe('blocked');
  expect(contract.blocked_reasons).toContain('meaningful_unsupported_idp_scoring_keys');
  expect(contract.scoring_coverage.unsupported_keys).toEqual(unsupportedPlayerKeys);
  expect(contract.players).toHaveLength(0);
  expect(contract.firewall.idp_dynasty_value_available).toBe(false);
});

test('same lifecycle renders nonzero rows when active player scoring is fully projectable', async ({page}) => {
  await mockLifecycle(page, defensibleScoring);
  const contract = await analyze(page);
  const offensiveBefore = await page.locator('#playerValues .lv-value').first().textContent();
  expect(contract.status).toBe('ready_experimental');
  expect(contract.players.length).toBeGreaterThan(0);
  expect(contract.players.every((row) => Number.isFinite(row.projected_points))).toBe(true);
  expect(contract.players.every((row) => row.idp_dynasty_value_available === false && row.dynasty_value === null)).toBe(true);
  expect(contract.firewall.offense_idp_combined_dynasty_rankings_available).toBe(false);
  expect(await page.locator('#playerValues .lv-value').first().textContent()).toBe(offensiveBefore);
});
