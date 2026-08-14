const { test, expect } = require('@playwright/test');

const LEAGUE_ID = '87654322';

async function mockLeague(page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'raw.githubusercontent.com') {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: [
        'player,pos,team,age,ecr_1qb,ecr_2qb,value_1qb,value_2qb,scrape_date,fp_id',
        'Josh Allen,QB,BUF,30,1,1,9500,9800,2026-08-13,201',
        'Brock Purdy,QB,SF,26,15,14,6100,6500,2026-08-13,203',
      ].join('\n') });
    }
    if (url.pathname.endsWith('/data/experimental/2026-projections.json')) {
      return route.fulfill({ json: {
        v: 'lv-projection-frontend-v0.3', m: 'lv-projection-system-v0.3', d: '2026-08-13T12:00:00Z', through: 2025,
        aliases: [],
        r: [
          { s: 'josh', g: 'josh', p: 'QB', z: 'projection_ready', x: { py: 4200, pt: 32, ry: 400, rt: 5 }, c: 'High', h: [2025, 2024, 2023] },
          { s: 'purdy', g: 'purdy', p: 'QB', z: 'projection_ready', x: { py: 4050, pt: 29, ry: 180, rt: 2 }, c: 'High', h: [2025, 2024, 2023] },
        ],
      } });
    }
    if (url.hostname !== 'api.sleeper.app') return route.continue();
    const path = url.pathname;
    if (path === `/v1/league/${LEAGUE_ID}`) return route.fulfill({ json: { league_id: LEAGUE_ID, name: 'Search Separation', season: '2026', total_rosters: 1, roster_positions: ['QB','RB','WR','TE','FLEX','BN'], scoring_settings: { pass_yd: .04, pass_td: 4 }, settings: { playoff_week_start: 14 } } });
    if (path === `/v1/league/${LEAGUE_ID}/users`) return route.fulfill({ json: [{ user_id: 'u1', display_name: 'Owner' }] });
    if (path === `/v1/league/${LEAGUE_ID}/rosters`) return route.fulfill({ json: [{ roster_id: 1, owner_id: 'u1', players: ['josh','purdy'], starters: ['josh'], taxi: [], reserve: [] }] });
    if (path === `/v1/league/${LEAGUE_ID}/traded_picks`) return route.fulfill({ json: [] });
    if (path === '/v1/players/nfl') return route.fulfill({ json: {
      josh: { full_name: 'Josh Allen', position: 'QB', fantasy_positions: ['QB'], team: 'BUF', years_exp: 8 },
      purdy: { full_name: 'Brock Purdy', position: 'QB', fantasy_positions: ['QB'], team: 'SF', years_exp: 4 },
    } });
    if (path === '/v1/state/nfl') return route.fulfill({ json: { league_season: '2026', leg: 1 } });
    if (path.includes('/projections/nfl/')) return route.fulfill({ json: [
      { player_id: 'josh', stats: { pass_yd: 280, pass_td: 2 } },
      { player_id: 'purdy', stats: { pass_yd: 255, pass_td: 2 } },
    ] });
    if (path.includes(`/v1/league/${LEAGUE_ID}/transactions/`)) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: {} });
  });
}

test('experimental and dynasty searches remain independent', async ({ page }) => {
  await mockLeague(page);
  await page.goto('/');
  await page.getByLabel('Sleeper league ID or URL').fill(LEAGUE_ID);
  await page.getByRole('button', { name: 'Analyze League' }).click();
  await expect(page.locator('#status')).toHaveText(/foundation calculated/, { timeout: 15000 });

  const projectionSearch = page.getByLabel('Search players');
  const dynastySearch = page.getByLabel('Search dynasty players');
  await expect(dynastySearch).toBeVisible();
  await expect(projectionSearch).toBeHidden();
  await page.getByText('Show projections', { exact: true }).click();
  await expect(page.locator('#experimentalProjectionPanel')).toHaveAttribute('open', '');
  await expect(projectionSearch).toBeVisible();

  await projectionSearch.fill('Purdy');
  await expect(page.locator('#experimentalProjectionRows', { hasText: 'Brock Purdy' })).toBeVisible();
  await expect(page.locator('#experimentalProjectionRows')).not.toContainText('Josh Allen');
  await expect(page.locator('#playerValues')).toContainText('Josh Allen');

  await projectionSearch.fill('');
  await dynastySearch.fill('Allen');
  await expect(page.locator('#playerValues .player-card', { hasText: 'Josh Allen' })).toBeVisible();
  await expect(page.locator('#playerValues .player-card', { hasText: 'Brock Purdy' })).toBeHidden();
  await expect(page.locator('#experimentalProjectionRows')).toContainText('Brock Purdy');
});
