const { test, expect } = require("@playwright/test");

const LEAGUE_ID = "87654321";
const marketCsv = [
  "player,pos,team,age,ecr_1qb,ecr_2qb,value_1qb,value_2qb,scrape_date,fp_id",
  "Vector QB,QB,BUF,25,10,5,7000,8500,2026-08-13,1",
  "Vector RB,RB,GB,24,20,25,6500,6100,2026-08-13,2",
  "Vector WR,WR,MIN,23,18,22,6700,6400,2026-08-13,3",
  "Vector TE,TE,DET,26,40,42,4200,4100,2026-08-13,4",
].join("\n");

const artifact = {
  v: "lv-projection-frontend-v0.3",
  m: "lv-projection-system-v0.3",
  d: "2026-08-13T12:00:00Z",
  through: 2025,
  r: [
    { s: "q1", g: "gq", p: "QB", z: "projection_ready", x: { py: 4100, pt: 29, i: 11 }, c: "High", h: [2025, 2024, 2023] },
    { s: "r1", g: "gr", p: "RB", z: "projection_ready", x: { r: 210, ry: 950, rt: 8, tg: 65, rc: 50, cy: 390 }, c: "Medium", h: [2025, 2024] },
    { s: "w1", g: "gw", p: "WR", z: "projection_ready", x: { tg: 125, rc: 82, cy: 1080, ct: 8 }, c: "Medium", h: [2025, 2024, 2023] },
    { s: "t1", g: "gt", p: "TE", z: "projection_ready", x: { tg: 85, rc: 59, cy: 690, ct: 6 }, c: "Low", h: [2025, 2024] },
    { s: "l1", g: "gl", p: "LB", z: "projection_ready", x: { ts: 92, ta: 31, sk: 4, i: 1 }, c: "Medium", h: [2025, 2024] },
  ],
};

const users = [{ user_id: "u1", display_name: "Cody", metadata: { team_name: "Vector Testers" } }];
const players = {
  q1: { full_name: "Vector QB", position: "QB", fantasy_positions: ["QB"], team: "BUF", years_exp: 3 },
  r1: { full_name: "Vector RB", position: "RB", fantasy_positions: ["RB"], team: "GB", years_exp: 2 },
  w1: { full_name: "Vector WR", position: "WR", fantasy_positions: ["WR"], team: "MIN", years_exp: 2 },
  t1: { full_name: "Vector TE", position: "TE", fantasy_positions: ["TE"], team: "DET", years_exp: 4 },
  l1: { full_name: "Vector LB", position: "LB", fantasy_positions: ["LB"], team: "PIT", years_exp: 3 },
};
const rosters = [{ roster_id: 1, owner_id: "u1", players: Object.keys(players), starters: ["q1", "r1", "w1", "t1", "l1"], taxi: [], reserve: [] }];

function leagueFixture(slots = ["QB", "RB", "WR", "TE", "FLEX", "LB", "BN"]) {
  return {
    league_id: LEAGUE_ID,
    name: "Projection Browser League",
    season: "2026",
    total_rosters: 1,
    roster_positions: slots,
    scoring_settings: { pass_yd: 0.04, pass_td: 4, rec: 1, bonus_pass_yd_400: 3, tkl_solo: 1 },
    settings: { draft_rounds: 2, playoff_week_start: 14 },
  };
}

async function mockData(page, slots) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/data/experimental/2026-projections.json")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(artifact) });
    if (url.hostname === "raw.githubusercontent.com") return route.fulfill({ status: 200, contentType: "text/csv", body: marketCsv });
    if (url.hostname !== "api.sleeper.app") return route.continue();
    const path = url.pathname;
    if (path === `/v1/league/${LEAGUE_ID}`) return route.fulfill({ json: leagueFixture(slots) });
    if (path === `/v1/league/${LEAGUE_ID}/users`) return route.fulfill({ json: users });
    if (path === `/v1/league/${LEAGUE_ID}/rosters`) return route.fulfill({ json: rosters });
    if (path === `/v1/league/${LEAGUE_ID}/traded_picks`) return route.fulfill({ json: [] });
    if (path === "/v1/players/nfl") return route.fulfill({ json: players });
    if (path === "/v1/state/nfl") return route.fulfill({ json: { league_season: "2026", leg: 1 } });
    if (path.includes("/projections/nfl/")) return route.fulfill({ json: [] });
    if (path.includes(`/v1/league/${LEAGUE_ID}/transactions/`)) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: `Unhandled ${url}` } });
  });
}

async function analyze(page, slots) {
  await mockData(page, slots);
  await page.goto("/");
  await page.getByLabel("Sleeper league ID or URL").fill(LEAGUE_ID);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(page.locator("#experimentalProjectionStatus")).toContainText("Dynasty values are unchanged", { timeout: 15000 });
}

async function showProjections(page) {
  const board = page.locator("#experimentalProjectionPanel");
  if (!(await board.getAttribute("open"))) await page.getByText("Show projections", { exact: true }).click();
  await expect(board).toHaveAttribute("open", "");
}

function visibleProjectionNames(page) {
  return page.locator("#experimentalProjectionRows .projection-card:visible .projection-player b").allTextContents();
}

test("projection board is collapsed by default and can expand and collapse again", async ({ page }) => {
  await analyze(page);
  const board = page.locator("#experimentalProjectionPanel");
  await expect(board).not.toHaveAttribute("open", "");
  await expect(page.getByText("Show projections", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Search players")).toBeHidden();
  await showProjections(page);
  await expect(page.getByLabel("Search players")).toBeVisible();
  await expect(page.getByText("Hide projections", { exact: true })).toBeVisible();
  await page.getByText("Hide projections", { exact: true }).click();
  await expect(board).not.toHaveAttribute("open", "");
  await expect(page.getByLabel("Search players")).toBeHidden();
});

test("projection board open state survives same-session re-analysis", async ({ page }) => {
  await analyze(page);
  const board = page.locator("#experimentalProjectionPanel");
  await showProjections(page);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(board).toHaveAttribute("open", "");
  await expect(page.locator("#experimentalProjectionStatus")).toContainText("Dynasty values are unchanged", { timeout: 15000 });
});

test("position pills filter experimental projections and search composes with them", async ({ page }) => {
  await analyze(page);
  await showProjections(page);
  await expect(page.getByRole("group", { name: "Experimental projection position filter" })).toBeVisible();
  await page.getByRole("button", { name: "WR", exact: true }).click();
  expect(await visibleProjectionNames(page)).toEqual(["Vector WR"]);
  await page.getByLabel("Search players").fill("Vector T");
  await expect(page.locator("#experimentalProjectionRows .projection-empty")).toBeVisible();
  await page.getByRole("button", { name: "TE", exact: true }).click();
  expect(await visibleProjectionNames(page)).toEqual(["Vector TE"]);
});

test("FLEX follows imported normal-flex eligibility and does not become superflex", async ({ page }) => {
  await analyze(page, ["QB", "RB", "WR", "TE", "WRRB_FLEX", "SUPER_FLEX", "LB", "BN"]);
  await showProjections(page);
  await page.getByRole("button", { name: "FLEX", exact: true }).click();
  expect((await visibleProjectionNames(page)).sort()).toEqual(["Vector RB", "Vector WR"]);
  const architecture = await page.evaluate(() => window.__leagueVectorExperimental.filterArchitecture);
  expect(architecture.flexPositions.sort()).toEqual(["RB", "WR"]);
  expect(architecture.superflexPositions.sort()).toEqual(["QB", "RB", "TE", "WR"]);
});

test("compact cards keep technical content collapsed but accessible", async ({ page }) => {
  await analyze(page);
  await showProjections(page);
  const card = page.locator("#experimentalProjectionRows .projection-card").filter({ hasText: "Vector QB" });
  await expect(card.locator(".projection-compact-meta")).toContainText(/confidence/);
  await expect(card.locator(".projection-scoring-chip")).toContainText(/scoring coverage/);
  const unsupported = card.locator("details.projection-unsupported");
  await expect(unsupported).not.toHaveAttribute("open", "");
  await expect(unsupported.locator("p")).toBeHidden();
  await unsupported.locator("summary").click();
  await expect(unsupported.locator("p")).toContainText("bonus_pass_yd_400");
  const technical = card.locator("details.projection-technical");
  await expect(technical).not.toHaveAttribute("open", "");
  await technical.locator("summary").click();
  await expect(technical).toContainText(/Experimental only|League Vector v0.3/);
});

test("experimental and production dynasty search remain independent", async ({ page }) => {
  await analyze(page);
  await showProjections(page);
  const experimental = page.getByLabel("Search players");
  const dynasty = page.getByLabel("Search dynasty players");
  await experimental.fill("Vector WR");
  await expect(page.locator("#experimentalProjectionRows")).toContainText("Vector WR");
  await expect(page.locator("#playerValues")).toContainText("Vector QB");
  await dynasty.fill("Vector RB");
  await expect(page.locator("#dynastySearchStatus")).toContainText("1 of");
  await expect(page.locator("#experimentalProjectionRows")).toContainText("Vector WR");
  await expect(experimental).toHaveValue("Vector WR");
});

test("collapsed projection summary and expanded browser stay within an iPhone-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await analyze(page);
  const board = page.locator("#experimentalProjectionPanel");
  await expect(board).not.toHaveAttribute("open", "");
  const actionHeight = await page.locator(".projection-board-action").evaluate((el) => el.getBoundingClientRect().height);
  expect(actionHeight).toBeGreaterThanOrEqual(48);
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await showProjections(page);
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const nav = page.getByRole("group", { name: "Experimental projection position filter" });
  await expect(nav).toBeVisible();
  const pillHeight = await page.getByRole("button", { name: "QB", exact: true }).evaluate((el) => el.getBoundingClientRect().height);
  expect(pillHeight).toBeGreaterThanOrEqual(42);
});