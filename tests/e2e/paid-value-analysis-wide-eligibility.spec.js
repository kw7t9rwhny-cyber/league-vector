const { test, expect } = require("@playwright/test");

const LEAGUE_ID = "12345678";
const marketCsv = [
  "player,pos,team,age,ecr_1qb,ecr_2qb,value_1qb,value_2qb,scrape_date,fp_id",
  "Paid Gate Quarterback,QB,NE,27,10,8,8000,8500,2026-08-30,9001",
].join("\n");

const projectionArtifact = {
  v: "lv-projection-frontend-v0.3",
  m: "lv-projection-system-v0.3",
  d: "2026-08-30T12:00:00Z",
  through: 2025,
  aliases: [],
  r: [],
};

async function mockPaidData(page) {
  const counts = { legacyProjectionRequests: 0, transactions: 0 };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/data/experimental/2026-projections.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projectionArtifact) });
    }
    if (url.hostname === "raw.githubusercontent.com") {
      return route.fulfill({ status: 200, contentType: "text/csv", body: marketCsv });
    }
    if (url.hostname !== "api.sleeper.app") return route.continue();

    if (url.pathname.includes("/projections/nfl/")) {
      counts.legacyProjectionRequests += 1;
      return route.fulfill({ status: 500, json: { error: "legacy projection endpoint must not be called" } });
    }
    if (url.pathname === `/v1/league/${LEAGUE_ID}`) {
      return route.fulfill({
        json: {
          league_id: LEAGUE_ID,
          name: "Paid Gate League",
          season: "2026",
          total_rosters: 1,
          roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
          scoring_settings: { pass_yd: 0.04, pass_td: 4, rec: 1 },
          settings: { draft_rounds: 2, playoff_week_start: 14 },
        },
      });
    }
    if (url.pathname === `/v1/league/${LEAGUE_ID}/users`) {
      return route.fulfill({ json: [{ user_id: "u1", display_name: "Founder", metadata: { team_name: "Gate Team" } }] });
    }
    if (url.pathname === `/v1/league/${LEAGUE_ID}/rosters`) {
      return route.fulfill({
        json: [{
          roster_id: 1,
          owner_id: "u1",
          players: ["p1"],
          starters: ["p1", "0", "0", "0", "0"],
          taxi: [],
          reserve: [],
        }],
      });
    }
    if (url.pathname === `/v1/league/${LEAGUE_ID}/traded_picks`) return route.fulfill({ json: [] });
    if (url.pathname === "/v1/players/nfl") {
      return route.fulfill({
        json: {
          p1: {
            full_name: "Paid Gate Quarterback",
            position: "QB",
            fantasy_positions: ["QB"],
            team: "NE",
            years_exp: 3,
          },
        },
      });
    }
    if (url.pathname === "/v1/state/nfl") return route.fulfill({ json: { league_season: "2026", leg: 1 } });
    if (url.pathname.includes(`/v1/league/${LEAGUE_ID}/transactions/`)) {
      counts.transactions += 1;
      return route.fulfill({ json: [] });
    }
    return route.fulfill({ status: 404, json: { error: `Unhandled fixture URL: ${url}` } });
  });
  return counts;
}

test("paid-beta mode excludes legacy projections and withholds every paid numeric value while source rights are unresolved", async ({ page }) => {
  const counts = await mockPaidData(page);
  await page.goto("/?paid_beta=1");
  await page.evaluate(() => {
    window.__paidReadyEvents = 0;
    window.__paidBlockedEvents = 0;
    window.addEventListener("leaguevector:analysis-ready", () => { window.__paidReadyEvents += 1; });
    window.addEventListener("leaguevector:analysis-blocked", () => { window.__paidBlockedEvents += 1; });
  });

  await page.getByLabel("Sleeper league ID or URL").fill(LEAGUE_ID);
  await page.getByRole("button", { name: "Analyze League" }).click();

  await expect(page.locator("#status")).toHaveText(
    "Paid-beta values withheld — source-rights approval remains unresolved.",
    { timeout: 15_000 },
  );
  await expect(page.locator("#status")).not.toHaveClass(/success/);
  await expect(page.locator("#results")).toHaveAttribute("data-paid-value-state", "PAID_VALUE_INELIGIBLE");
  await expect(page.locator("#paidValueEligibility")).toHaveAttribute("data-source-rights-state", "UNRESOLVED");
  await expect(page.locator("#paidValueEligibility")).toContainText("SOURCE_RIGHTS_UNRESOLVED");
  await expect(page.locator("#projectionStatus")).toContainText("not requested in paid-beta mode");

  await expect(page.locator("#playerValues .lv-value")).toHaveCount(0);
  await expect(page.locator("#playerValues")).toContainText("Paid player values unavailable");
  await expect(page.locator("#teamAnalysis .metric-grid b")).toHaveCount(0);
  await expect(page.locator("#teamAnalysis")).toContainText("Paid team values and ranks unavailable");
  await expect(page.locator("#teams .roster-value")).toHaveCount(0);
  await expect(page.locator("#teams")).toContainText("LV unavailable");

  const runtime = await page.evaluate(() => ({
    paidMode: document.documentElement.dataset.paidBetaMode,
    envelope: window.__leagueVectorPaidValueEligibility,
    lastAnalysis: window.LeagueVectorLastAnalysis,
    readyEvents: window.__paidReadyEvents,
    blockedEvents: window.__paidBlockedEvents,
  }));
  expect(runtime.paidMode).toBe("1");
  expect(runtime.envelope.state).toBe("PAID_VALUE_INELIGIBLE");
  expect(runtime.envelope.numeric_paid_output_authorized).toBe(false);
  expect(runtime.envelope.reason_codes).toContain("SOURCE_RIGHTS_UNRESOLVED");
  expect(runtime.lastAnalysis).toBeNull();
  expect(runtime.readyEvents).toBe(0);
  expect(runtime.blockedEvents).toBeGreaterThanOrEqual(1);
  expect(counts.legacyProjectionRequests).toBe(0);
  expect(counts.transactions).toBeGreaterThan(0);
});

test("ordinary free-alpha analysis remains outside the paid-beta gate", async ({ page }) => {
  await mockPaidData(page);
  await page.goto("/");
  await page.getByLabel("Sleeper league ID or URL").fill(LEAGUE_ID);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(page.locator("#status")).toHaveClass(/success/, { timeout: 15_000 });
  const installed = await page.evaluate(() => Boolean(window.__paidValueEligibilityV1Installed));
  expect(installed).toBe(false);
});
