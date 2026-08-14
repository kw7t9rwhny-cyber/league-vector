const { test, expect } = require("@playwright/test");

const LEAGUE_ID = "87654321";
const marketCsv = [
  "player,pos,team,age,ecr_1qb,ecr_2qb,value_1qb,value_2qb,scrape_date,fp_id",
  "Test Quarterback,QB,GB,26,20,10,5000,7000,2026-08-14,1",
].join("\n");

const league = {
  league_id: LEAGUE_ID,
  name: "IDP Integration League",
  season: "2026",
  total_rosters: 2,
  roster_positions: ["QB", "LB", "IDP_FLEX", "BN"],
  scoring_settings: { pass_yd: 0.04, pass_td: 4, tkl_solo: 1, tkl_ast: 0.5, sack: 4 },
  settings: { draft_rounds: 2, playoff_week_start: 14 },
};

const users = [
  { user_id: "u1", display_name: "Alpha" },
  { user_id: "u2", display_name: "Beta" },
];
const rosters = [
  { roster_id: 1, owner_id: "u1", players: ["qb1", "lb1", "dl1", "db1"], starters: ["qb1", "lb1", "dl1"], taxi: [], reserve: [] },
  { roster_id: 2, owner_id: "u2", players: ["lb2", "hy1", "db2"], starters: ["lb2", "hy1"], taxi: [], reserve: [] },
];
const players = {
  qb1: { full_name: "Test Quarterback", position: "QB", fantasy_positions: ["QB"], team: "GB", years_exp: 3, active: true, status: "Active" },
  lb1: { full_name: "Test Linebacker", position: "LB", fantasy_positions: ["LB"], team: "PIT", years_exp: 3, active: true, status: "Active" },
  lb2: { full_name: "Second Linebacker", position: "LB", fantasy_positions: ["LB"], team: "CHI", years_exp: 2, active: true, status: "Active" },
  dl1: { full_name: "Test Edge", position: "DL", fantasy_positions: ["DL"], team: "DAL", years_exp: 4, active: true, status: "Active" },
  db1: { full_name: "Test Safety", position: "DB", fantasy_positions: ["DB"], team: "MIN", years_exp: 4, active: true, status: "Active" },
  db2: { full_name: "Second Safety", position: "DB", fantasy_positions: ["DB"], team: "DET", years_exp: 2, active: true, status: "Active" },
  hy1: { full_name: "Hybrid Defender", position: "DL", fantasy_positions: ["DL", "LB"], team: "BAL", years_exp: 3, active: true, status: "Active" },
};

const artifact = {
  v: "lv-projection-frontend-v0.3",
  m: "lv-projection-system-v0.3",
  d: "2026-08-14T12:00:00Z",
  through: 2025,
  r: [
    { s: "lb1", g: "g-lb1", p: "LB", t: "OLD", z: "projection_ready", x: { ts: 100, ta: 30, sk: 5 } },
    { s: "lb2", g: "g-lb2", p: "LB", t: "CHI", z: "projection_ready", x: { ts: 85, ta: 30, sk: 3 } },
    { s: "dl1", g: "g-dl1", p: "DL", t: "DAL", z: "projection_ready", x: { ts: 70, ta: 20, sk: 11 } },
    { s: "db1", g: "g-db1", p: "DB", t: "MIN", z: "projection_ready", x: { ts: 80, ta: 25, sk: 1 } },
    { s: "db2", g: "g-db2", p: "DB", t: "DET", z: "projection_ready", x: { ts: 72, ta: 20, sk: 1 } },
    { s: "hy1", g: "g-hy1", p: "DL", t: "BAL", z: "projection_ready", x: { ts: 78, ta: 24, sk: 8 } },
  ],
};

async function mockData(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/data/experimental/2026-projections.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(artifact) });
    }
    if (url.hostname === "raw.githubusercontent.com") return route.fulfill({ status: 200, contentType: "text/csv", body: marketCsv });
    if (url.hostname !== "api.sleeper.app") return route.continue();
    const path = url.pathname;
    if (path === `/v1/league/${LEAGUE_ID}`) return route.fulfill({ json: league });
    if (path === `/v1/league/${LEAGUE_ID}/users`) return route.fulfill({ json: users });
    if (path === `/v1/league/${LEAGUE_ID}/rosters`) return route.fulfill({ json: rosters });
    if (path === `/v1/league/${LEAGUE_ID}/traded_picks`) return route.fulfill({ json: [] });
    if (path === "/v1/players/nfl") return route.fulfill({ json: players });
    if (path === "/v1/state/nfl") return route.fulfill({ json: { league_season: "2026", leg: 1 } });
    if (path.includes("/projections/nfl/")) return route.fulfill({ json: [{ player_id: "qb1", stats: { pass_yd: 250, pass_td: 2 } }] });
    if (path.includes(`/v1/league/${LEAGUE_ID}/transactions/`)) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: `Unhandled fixture URL: ${url}` } });
  });
}

async function analyze(page) {
  await page.goto("/");
  await page.getByLabel("Sleeper league ID or URL").fill(LEAGUE_ID);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(page.locator("#status")).toHaveText(/League Vector v0\.8 foundation calculated/, { timeout: 15_000 });
  await expect(page.locator("#experimentalIdpRankings")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#idpRankingStatus")).toContainText("Current-season experimental defensive rankings", { timeout: 15_000 });
}

test("real analysis lifecycle builds PR22 contract and renders separate IDP rankings without changing offense", async ({ page }) => {
  await mockData(page);
  await analyze(page);
  const offensiveValue = await page.locator("#playerValues .lv-value").first().textContent();
  await page.getByText("Show IDP rankings", { exact: true }).click();
  const rows = page.locator("#idpRankingRows");
  await expect(rows).toContainText("Test Linebacker");
  await expect(rows).toContainText("PIT");
  await expect(rows).not.toContainText("OLD");
  await expect(rows).toContainText("Hybrid Defender");
  await expect(rows).toContainText("Eligible: DL / LB");
  await expect(rows).toContainText("Dynasty Value");
  await expect(rows).toContainText("Unavailable");
  const contract = await page.evaluate(() => window.__leagueVectorIdpRankingsContract);
  expect(contract.status).toBe("ready_experimental");
  expect(contract.firewall.idp_dynasty_value_available).toBe(false);
  expect(contract.firewall.offense_idp_combined_dynasty_rankings_available).toBe(false);
  expect(contract.players.every((player) => player.idp_dynasty_value_available === false && player.dynasty_value === null)).toBe(true);
  expect(await page.locator("#playerValues .lv-value").first().textContent()).toBe(offensiveValue);
  await page.getByLabel("Search IDP players").fill("Hybrid");
  await expect(rows).toContainText("Hybrid Defender");
  await expect(rows).not.toContainText("Test Linebacker");
});

test("iPhone lifecycle renders the approved IDP contract with no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockData(page);
  await analyze(page);
  await page.getByText("Show IDP rankings", { exact: true }).click();
  await expect(page.getByLabel("Search IDP players")).toBeVisible();
  await page.getByRole("button", { name: "LB", exact: true }).click();
  await expect(page.locator("#idpRankingRows")).toContainText("Test Linebacker");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
