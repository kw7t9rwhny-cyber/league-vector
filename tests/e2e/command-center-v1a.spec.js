const { test, expect } = require("@playwright/test");

const LEAGUE_ID = "12345678";
const marketCsv = [
  "player,pos,team,age,ecr_1qb,ecr_2qb,value_1qb,value_2qb,scrape_date,fp_id",
  "Test Quarterback,QB,NE,24,40,8,4000,8500,2026-08-12,99",
  "Test Runner,RB,DAL,23,20,28,6200,5900,2026-08-12,101",
].join("\n");

const projectionArtifact = {
  v: "lv-projection-frontend-v0.3",
  m: "lv-projection-system-v0.3",
  d: "2026-08-13T12:00:00Z",
  through: 2025,
  aliases: [],
  r: [
    { s: "p1", g: "g1", p: "QB", z: "projection_ready", x: { py: 4200, pt: 30, i: 12 }, c: "High", h: [2025, 2024] },
    { s: "p2", g: "g2", p: "RB", z: "projection_ready", x: { r: 220, ry: 980, rt: 8 }, c: "Medium", h: [2025, 2024] },
    { s: "p3", g: "g3", p: "LB", z: "projection_ready", x: { ts: 100, ta: 35 }, c: "Medium", h: [2025, 2024] },
  ],
};

const league = {
  league_id: LEAGUE_ID,
  name: "Command Center League",
  season: "2026",
  total_rosters: 2,
  roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
  scoring_settings: { pass_yd: 0.04, pass_td: 4, rec: 1, tkl_solo: 1 },
  settings: { draft_rounds: 2, playoff_week_start: 14 },
};

const users = [
  { user_id: "u1", display_name: "Owner One", metadata: { team_name: "Alpha & Co" } },
  { user_id: "u2", display_name: "Owner Two", metadata: { team_name: "Beta Team" } },
];

const rosters = [
  { roster_id: 1, owner_id: "u1", players: ["p1", "p2", "p3"], starters: ["p1", "p2", "0", "0", "0"], taxi: [], reserve: [] },
  { roster_id: 2, owner_id: "u2", players: [], starters: [], taxi: [], reserve: [] },
];

const players = {
  p1: { full_name: "Test Quarterback", position: "QB", fantasy_positions: ["QB"], team: "NE", years_exp: 2 },
  p2: { full_name: "Test Runner", position: "RB", fantasy_positions: ["RB"], team: "DAL", years_exp: 1 },
  p3: { full_name: "Test Defender", position: "LB", fantasy_positions: ["LB"], team: "PIT", years_exp: 3 },
};

async function mockData(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/data/experimental/2026-projections.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projectionArtifact) });
    }
    if (url.hostname === "raw.githubusercontent.com") {
      return route.fulfill({ status: 200, contentType: "text/csv", body: marketCsv });
    }
    if (url.hostname !== "api.sleeper.app") return route.continue();
    const path = url.pathname;
    if (path === `/v1/league/${LEAGUE_ID}`) return route.fulfill({ json: league });
    if (path === `/v1/league/${LEAGUE_ID}/users`) return route.fulfill({ json: users });
    if (path === `/v1/league/${LEAGUE_ID}/rosters`) return route.fulfill({ json: rosters });
    if (path === `/v1/league/${LEAGUE_ID}/traded_picks`) return route.fulfill({ json: [{ season: "2027", round: 1, roster_id: 1, owner_id: 2 }] });
    if (path === "/v1/players/nfl") return route.fulfill({ json: players });
    if (path === "/v1/state/nfl") return route.fulfill({ json: { league_season: "2026", leg: 1 } });
    if (path.includes("/projections/nfl/")) {
      return route.fulfill({ json: [
        { player_id: "p1", stats: { pass_yd: 250, pass_td: 2 } },
        { player_id: "p2", stats: { rec: 4 } },
      ] });
    }
    if (path.includes(`/v1/league/${LEAGUE_ID}/transactions/`)) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: `Unhandled fixture URL: ${url}` } });
  });
}

async function analyze(page) {
  await page.goto("/");
  await page.getByLabel("Sleeper league ID or URL").fill(LEAGUE_ID);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(page.locator("#status")).toHaveText(/calculated/, { timeout: 15_000 });
}

test("opens a personalized supported-output dashboard after team selection", async ({ page }) => {
  await mockData(page);
  await analyze(page);

  await expect(page.locator("#commandCenter")).toBeVisible();
  await expect(page.locator("#commandCenterChooser")).toBeVisible();
  await expect(page.getByText("Which team is yours?", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Select Alpha & Co/ })).toBeVisible();

  await page.getByRole("button", { name: /Select Alpha & Co/ }).click();
  await expect(page.locator("#commandCenterDashboard")).toBeVisible();
  await expect(page.locator("#commandCenterTeamTitle")).toHaveText("Alpha & Co");
  await expect(page.locator("#commandCenterMetrics")).toContainText("#1 of 2");
  await expect(page.locator("#commandCenterMetrics")).toContainText("Supported roster value");
  await expect(page.locator("#commandCenterSupportRows")).toContainText("Numeric IDP dynasty value");
  await expect(page.locator("#commandCenterSupportRows")).toContainText("Unavailable");
  await expect(page.locator("#commandCenterPickList")).toContainText("2026 Round 1");

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("leagueVector.commandCenter.v1a")));
  expect(stored).toEqual({ leagueId: LEAGUE_ID, rosterId: 1 });

  await page.getByRole("button", { name: "Draft Picks" }).click();
  await expect(page.getByRole("button", { name: "Draft Picks" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Change team" }).click();
  await expect(page.locator("#commandCenterChooser")).toBeVisible();
  await expect(page.locator("#commandCenterDashboard")).toBeHidden();
});

test("restores a remembered team, supports reset, and has no mobile overflow", async ({ page }) => {
  await page.addInitScript(({ leagueId }) => {
    localStorage.setItem("leagueVector.commandCenter.v1a", JSON.stringify({ leagueId, rosterId: 1 }));
  }, { leagueId: LEAGUE_ID });
  await mockData(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await analyze(page);

  await expect(page.locator("#commandCenterDashboard")).toBeVisible();
  await expect(page.locator("#commandCenterChooser")).toBeHidden();
  await expect(page.locator("#commandCenterTitle")).toHaveText("Welcome back to your league");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.locator("#commandCenterDashboard").getByRole("button", { name: "Run another league" }).click();
  await expect(page.locator("#results")).toBeHidden();
  await expect(page.getByLabel("Sleeper league ID or URL")).toHaveValue("");
});
