const { test, expect } = require("@playwright/test");

const LEAGUE_ID = "12345678";
const marketCsv = [
  "player,pos,team,age,ecr_1qb,ecr_2qb,value_1qb,value_2qb,scrape_date,fp_id",
  "Test Quarterback Jr.,QB,NE,24,40,8,4000,8500,2026-08-12,99",
  "Test Runner,RB,DAL,23,20,28,6200,5900,2026-08-12,101",
  "Duplicate Name,QB,NE,26,90,45,1000,3000,2026-08-12,102",
  "Duplicate Name,QB,NYJ,26,91,46,900,2900,2026-08-12,103",
].join("\n");

const projectionArtifact = {
  v: "lv-projection-frontend-v0.3",
  m: "lv-projection-system-v0.3",
  d: "2026-08-13T12:00:00Z",
  through: 2025,
  aliases: [["p6", "p5"]],
  r: [
    { s: "p1", g: "g1", p: "QB", z: "projection_ready", x: { py: 4200, pt: 30, i: 12, ry: 250, rt: 3 }, c: "High", h: [2025, 2024, 2023] },
    { s: "p2", g: "g2", p: "RB", z: "projection_ready", x: { r: 220, ry: 980, rt: 8, tg: 70, rc: 55, cy: 450, ct: 3 }, c: "Medium", h: [2025, 2024] },
    { s: "p3", g: "g3", p: "LB", z: "projection_ready", x: { ts: 100, ta: 35, tt: 135, tl: 10, sk: 4, qh: 8, i: 1, pd: 5, ff: 2, fr: 1 }, c: "Medium", h: [2025, 2024, 2023] },
    { s: "p5", l: "lv:gsis:g5", g: "g5", p: "LB", z: "projection_ready", x: { ts: 90, ta: 30 }, c: "Medium", h: [2025, 2024] },
    { s: "p6", l: "lv:lv:gsis:g5", g: "g5", p: "LB", z: "projection_ready", x: { ts: 88, ta: 29 }, c: "Medium", h: [2025, 2024] },
  ],
};

function leagueFixture(superflex = false) {
  return {
    league_id: LEAGUE_ID,
    name: "Unsafe <img src=x onerror=alert(1)>",
    season: "2026",
    total_rosters: 2,
    roster_positions: ["QB", "RB", "WR", "TE", ...(superflex ? ["SUPER_FLEX"] : ["FLEX"]), "BN"],
    scoring_settings: {
      pass_yd: 0.04,
      pass_td: 4,
      rec: 1,
      bonus_pass_yd_400: 3,
      tkl_solo: 1,
    },
    settings: { draft_rounds: 2, playoff_week_start: 14 },
  };
}

const users = [
  { user_id: "u1", display_name: "Owner <script>alert(1)</script>", metadata: { team_name: "Alpha & Co" } },
  { user_id: "u2", display_name: "Owner Two", metadata: { team_name: "Beta" } },
];
const rosters = [
  { roster_id: 1, owner_id: "u1", players: ["p1", "p2", "p3", "p4"], starters: ["p1", "p2", "p4", "0", "0"], taxi: [], reserve: [] },
  { roster_id: 2, owner_id: "u2", players: [], starters: [], taxi: [], reserve: [] },
];
const players = {
  p1: { full_name: "Test Quarterback Jr.", position: "QB", fantasy_positions: ["QB"], team: "NE", years_exp: 2 },
  p2: { full_name: "Test Runner", position: "RB", fantasy_positions: ["RB"], team: "DAL", years_exp: 1 },
  p3: { full_name: "Test Defender", position: "LB", fantasy_positions: ["LB"], team: "PIT", years_exp: 3 },
  p4: { full_name: "Duplicate Name", position: "QB", fantasy_positions: ["QB"], team: "FA", years_exp: 4 },
};

async function mockData(page, options = {}) {
  const counts = { players: 0, projections: 0, transactions: 0 };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/data/experimental/2026-projections.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projectionArtifact) });
    }
    if (url.hostname === "raw.githubusercontent.com") {
      await route.fulfill({ status: 200, contentType: "text/csv", body: marketCsv });
      return;
    }
    if (url.hostname !== "api.sleeper.app") {
      await route.continue();
      return;
    }
    const path = url.pathname;
    if (path === `/v1/league/${LEAGUE_ID}`) return route.fulfill({ json: leagueFixture(options.superflex) });
    if (path === `/v1/league/${LEAGUE_ID}/users`) return route.fulfill({ json: users });
    if (path === `/v1/league/${LEAGUE_ID}/rosters`) return route.fulfill({ json: rosters });
    if (path === `/v1/league/${LEAGUE_ID}/traded_picks`) {
      return route.fulfill({ json: [{ season: "2027", round: 1, roster_id: 1, owner_id: 2 }] });
    }
    if (path === "/v1/players/nfl") {
      counts.players += 1;
      return route.fulfill({ json: players });
    }
    if (path === "/v1/state/nfl") return route.fulfill({ json: { league_season: "2026", leg: 1 } });
    if (path.includes("/projections/nfl/")) {
      counts.projections += 1;
      if (options.projectionFailure) return route.fulfill({ status: 503, json: { error: "fixture outage" } });
      return route.fulfill({ json: [
        { player_id: "p1", stats: { pass_yd: 250, pass_td: 2 } },
        { player_id: "p2", stats: { rec: 4 } },
      ] });
    }
    if (path.includes(`/v1/league/${LEAGUE_ID}/transactions/`)) {
      counts.transactions += 1;
      const round = Number(path.split("/").at(-1));
      return route.fulfill({ json: round === 1 ? [{ type: "trade", status: "complete", adds: { p1: 2 }, drops: {} }] : [] });
    }
    return route.fulfill({ status: 404, json: { error: `Unhandled fixture URL: ${url}` } });
  });
  return counts;
}

async function analyze(page) {
  await page.goto("/");
  await page.getByLabel("Sleeper league ID or URL").fill(`https://sleeper.com/leagues/${LEAGUE_ID}`);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(page.locator("#status")).toHaveText(/League Vector v0\.8 foundation calculated — paid value eligible/, { timeout: 15_000 });
}

test("renders a complete 1QB analysis without unsafe markup or numeric display errors", async ({ page }) => {
  const counts = await mockData(page);
  await analyze(page);
  await expect(page.locator("#marketFormat")).toHaveText("1QB");
  await expect(page.locator("#identityStatus")).toContainText("2 offensive players valued");
  await expect(page.locator("#identityStatus")).toContainText("1 ambiguous");
  await expect(page.locator("#scoringCoverage")).toContainText("Not applied to paid value");
  await expect(page.locator("#paidValueEligibility")).toHaveAttribute("data-state", "PAID_VALUE_ELIGIBLE");
  await expect(page.locator("#paidValueEligibility")).toHaveAttribute("data-projection-policy", "CONTEXT_ONLY_NOT_IN_VALUATION");
  await expect(page.locator("#paidValueEligibility")).toContainText("No missing projection was replaced with zero");
  await expect(page.locator("#teamAnalysis")).toContainText("IDP value unavailable: 1 defensive players excluded");
  await expect(page.locator("#teamAnalysis img, #teamAnalysis script")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/NaN|Infinity/);
  expect(counts.players).toBe(1);
  expect(counts.projections).toBe(0);
  expect(counts.transactions).toBe(18);
});

test("shows League Vector v0.3 experimental projections with truthful scoring coverage", async ({ page }) => {
  await mockData(page);
  await analyze(page);
  await expect(page.locator("#experimentalProjectionPanel")).toBeVisible();
  await expect(page.locator("#experimentalProjectionStatus")).toContainText("Dynasty values are unchanged");
  await expect(page.locator("#experimentalProjectionStatus")).not.toContainText("duplicate stable identities");
  await expect(page.locator("#projectionMeta")).toContainText("lv-projection-system-v0.3");
  await expect(page.locator("#experimentalProjectionRows")).toContainText("Test Runner");
  await expect(page.locator("#experimentalProjectionRows")).toContainText("Test Defender");
  await expect(page.locator("#experimentalProjectionRows")).toContainText("bonus_pass_yd_400");
  await page.getByText("Show projections", { exact: true }).click();
  await expect(page.locator("#experimentalProjectionPanel")).toHaveAttribute("open", "");
  await expect(page.getByLabel("Fantasy team")).toBeVisible();
  await expect(page.getByLabel("Sort")).toBeVisible();
  await page.locator("#experimentalProjectionRows details").first().locator("summary").click();
  await expect(page.locator("#experimentalProjectionRows")).toContainText(/Receiving|Rushing|Passing|Tackles/);
  await expect(page.locator("#experimentalTeamProjection")).toContainText("Alpha & Co");
  await expect(page.locator("#playerValues")).toContainText("Test Quarterback Jr.");
});

test("does not request or use the legacy projection adapter even when it would fail", async ({ page }) => {
  const counts = await mockData(page, { superflex: true, projectionFailure: true });
  await analyze(page);
  await expect(page.locator("#marketFormat")).toHaveText("Superflex / 2QB");
  await expect(page.locator("#projectionStatus")).toContainText("CONTEXT_ONLY_NOT_IN_VALUATION");
  await expect(page.locator("#projectionStatus")).toContainText("not requested");
  await expect(page.locator("#paidValueEligibility")).toContainText("PAID_VALUE_ELIGIBLE");
  await expect(page.locator("#playerValues")).toContainText("Weekly projections excluded from paid value");
  expect(counts.projections).toBe(0);
});

test("remains usable at a mobile viewport and submits from the keyboard", async ({ page }) => {
  await mockData(page);
  await page.goto("/");
  const input = page.getByLabel("Sleeper league ID or URL");
  await input.fill(LEAGUE_ID);
  await input.press("Enter");
  await expect(page.locator("#status")).toHaveText(/calculated/, { timeout: 15_000 });
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#experimentalProjectionPanel")).toBeVisible();
  await expect(page.locator("#experimentalProjectionStatus")).not.toContainText("duplicate stable identities");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
