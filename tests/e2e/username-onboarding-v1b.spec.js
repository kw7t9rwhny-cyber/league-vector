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
  ip: [{ p: "LB", n: 1 }],
};

const state = { season: "2026", league_season: "2026", leg: 1 };
const sleeperUser = { username: "codytest", user_id: "u1", display_name: "Cody Test", avatar: null };
const league = {
  league_id: LEAGUE_ID,
  name: "Command Center League",
  season: "2026",
  sport: "nfl",
  status: "pre_draft",
  total_rosters: 2,
  avatar: null,
  roster_positions: ["QB", "RB", "WR", "TE", "SUPER_FLEX", "DL", "LB", "DB", "BN"],
  scoring_settings: { pass_yd: 0.04, pass_td: 4, rec: 1, tkl_solo: 1 },
  settings: { type: 2, taxi_slots: 3, draft_rounds: 2, playoff_week_start: 14 },
};
const users = [
  { user_id: "u1", display_name: "Cody Test", metadata: { team_name: "Alpha & Co" } },
  { user_id: "u2", display_name: "Owner Two", metadata: { team_name: "Beta Team" } },
];
const rosters = [
  { roster_id: 1, owner_id: "u1", players: ["p1", "p2", "p3"], starters: ["p1", "p2", "0", "0", "0", "0", "0", "0"], taxi: [], reserve: [] },
  { roster_id: 2, owner_id: "u2", players: [], starters: [], taxi: [], reserve: [] },
];
const players = {
  p1: { full_name: "Test Quarterback", position: "QB", fantasy_positions: ["QB"], team: "NE", years_exp: 2 },
  p2: { full_name: "Test Runner", position: "RB", fantasy_positions: ["RB"], team: "DAL", years_exp: 1 },
  p3: { full_name: "Test Defender", position: "LB", fantasy_positions: ["LB"], team: "PIT", years_exp: 3 },
};

async function mockData(page, options = {}) {
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
    if (path === "/v1/state/nfl") return route.fulfill({ json: state });
    if (path === "/v1/user/codytest") return route.fulfill({ json: options.userMissing ? null : sleeperUser });
    if (path === "/v1/user/u1/leagues/nfl/2026") return route.fulfill({ json: options.noLeagues ? [] : [league] });
    if (path === `/v1/league/${LEAGUE_ID}`) return route.fulfill({ json: league });
    if (path === `/v1/league/${LEAGUE_ID}/users`) return route.fulfill({ json: users });
    if (path === `/v1/league/${LEAGUE_ID}/rosters`) {
      const value = options.multipleMatches
        ? [rosters[0], { ...rosters[0], roster_id: 3, players: ["p1"], starters: ["p1"] }]
        : rosters;
      return route.fulfill({ json: value });
    }
    if (path === `/v1/league/${LEAGUE_ID}/traded_picks`) return route.fulfill({ json: [] });
    if (path === "/v1/players/nfl") return route.fulfill({ json: players });
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

async function findLeagues(page) {
  await page.goto("/");
  await page.getByLabel("Sleeper username").fill("@codytest");
  await page.getByRole("button", { name: /Find my leagues/i }).click();
  await expect(page.getByRole("button", { name: "Analyze Command Center League" })).toBeVisible();
}

test("finds current leagues, identifies the user's roster and opens the Command Center", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockData(page);
  await findLeagues(page);

  const card = page.locator(".username-league-card");
  await expect(card).toContainText("Command Center League");
  await expect(card).toContainText("2 teams");
  await expect(card).toContainText("Dynasty");
  await expect(card).toContainText("Superflex / 2QB");
  await expect(card).toContainText("IDP");

  await page.getByRole("button", { name: "Analyze Command Center League" }).click();
  await expect(page.locator("#status")).toHaveText(/calculated/, { timeout: 15_000 });
  await expect(page.locator("#commandCenterDashboard")).toBeVisible();
  await expect(page.locator("#commandCenterChooser")).toBeHidden();
  await expect(page.locator("#commandCenterTeamTitle")).toHaveText("Alpha & Co");
  await expect(page.locator("#usernameOnboardingStatus")).toContainText("Analysis complete");
  await expect(page.getByText("Which team is yours?", { exact: true })).toBeHidden();

  const onboardingState = await page.evaluate(() => JSON.parse(localStorage.getItem("leagueVector.usernameOnboarding.v1b")));
  expect(onboardingState.username).toBe("codytest");
  expect(onboardingState.userId).toBe("u1");
  expect(onboardingState.lastLeagueId).toBe(LEAGUE_ID);
  const commandState = await page.evaluate(() => JSON.parse(localStorage.getItem("leagueVector.commandCenter.v1a")));
  expect(commandState).toEqual({ leagueId: LEAGUE_ID, rosterId: 1 });

  await expect(page.locator("#advancedLeagueImport")).not.toHaveAttribute("open", "");
  await expect(page.locator("#advancedLeagueImport #leagueId")).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("handles missing accounts and no-current-league states without touching the analyzer", async ({ page }) => {
  await mockData(page, { userMissing: true });
  await page.goto("/");
  await page.getByLabel("Sleeper username").fill("codytest");
  await page.getByRole("button", { name: /Find my leagues/i }).click();
  await expect(page.locator("#usernameOnboardingStatus")).toContainText("No Sleeper account was found");
  await expect(page.locator("#usernameLeagueChooser")).toBeHidden();
  await expect(page.locator("#results")).toBeHidden();
});

test("asks for a roster only when multiple roster matches exist and keeps the sample demo truthful", async ({ page }) => {
  await mockData(page, { multipleMatches: true });
  await findLeagues(page);
  await page.getByRole("button", { name: "Analyze Command Center League" }).click();
  await expect(page.locator("#usernameRosterChooser")).toBeVisible();
  await expect(page.locator("#usernameRosterGrid .username-roster-choice")).toHaveCount(2);
  await expect(page.locator("#results")).toBeHidden();

  await page.locator("#usernameRosterGrid .username-roster-choice").first().click();
  await expect(page.locator("#commandCenterDashboard")).toBeVisible({ timeout: 15_000 });

  await page.locator("#commandCenterDashboard").getByRole("button", { name: "Run another league" }).click();
  await page.getByRole("button", { name: "Try the sample demo" }).click();
  await expect(page.locator("#usernameOnboardingStatus")).toContainText("static sample interface");
  await expect(page.locator("#preview")).toHaveClass(/onboarding-demo-focus/);
});
