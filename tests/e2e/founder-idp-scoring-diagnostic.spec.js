const { test, expect } = require('@playwright/test');

const FOUNDER_LEAGUE_ID = '1329773225810366464';

test('diagnostic: enumerate live Founder league IDP scoring settings', async ({ request }) => {
  const response = await request.get(`https://api.sleeper.app/v1/league/${FOUNDER_LEAGUE_ID}`);
  expect(response.ok()).toBeTruthy();
  const league = await response.json();
  const scoring = league.scoring_settings || {};
  const idpPattern = /(?:^idp_|^tkl|sack|qb_hit|pass_def|(^|_)ff$|fum_rec|def_td|safe|blk_kick|def_2pt|int_ret|fum_ret|def_st|st_td|kick_ret|punt_ret)/;
  const active = Object.entries(scoring)
    .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) !== 0)
    .filter(([key]) => idpPattern.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  console.log('FOUNDER_IDP_SCORING=' + JSON.stringify(active));
  expect(active.length).toBeGreaterThan(0);
});
