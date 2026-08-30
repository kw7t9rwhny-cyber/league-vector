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
  const counts = { legacyProjectionRequests: 0, transactions: 0, sleeperRequests: 0 };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/data/experimental/2026-projections.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projectionArtifact) });
    }
    if (url.hostname === "raw.githubusercontent.com") {
      return route.fulfill({ status: 200, contentType: "text/csv", body: marketCsv });
    }
    if (url.hostname !== "api.sleeper.app") return route.continue();

    counts.sleeperRequests += 1;
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

test("paid-beta mode fails closed before network work while source rights remain unresolved", async ({ page }) => {
  const counts = await mockPaidData(page);
  await page.addInitScript(() => {
    window.__paidReadyEvents = 0;
    window.__paidBlockedEvents = 0;
    window.addEventListener("leaguevector:analysis-ready", () => { window.__paidReadyEvents += 1; });
    window.addEventListener("leaguevector:analysis-blocked", () => { window.__paidBlockedEvents += 1; });
  });
  await page.goto("/?paid_beta=1&source_rights=PAID_SUPPORTED");

  await expect(page.locator("#status")).toHaveText(
    "Paid-beta source-rights gate remains unresolved. No analysis was started.",
    { timeout: 15_000 },
  );
  await expect(page.getByRole("button", { name: "Analyze League" })).toBeDisabled();
  await expect(page.getByLabel("Sleeper league ID or URL")).toBeDisabled();
  await expect(page.locator("#results")).toBeHidden();
  await expect(page.locator("#playerValues .lv-value")).toHaveCount(0);
  await expect(page.locator("#teamAnalysis .metric-grid b")).toHaveCount(0);
  await expect(page.locator("#teams .roster-value")).toHaveCount(0);

  const runtime = await page.evaluate(() => {
    const slot = "__paidValueEligibilityV1Runtime";
    const descriptor = Object.getOwnPropertyDescriptor(window, slot);
    window[slot] = {
      contract: {
        source_rights_state: "PAID_SUPPORTED",
        state: "PAID_VALUE_ELIGIBLE",
      },
    };
    const contract = window.LeagueVectorCore.paidValueEligibility();
    const validation = window.LeagueVectorCore.validatePaidValueEligibility(contract);
    return {
      installed: window.__paidValueEligibilityV1Installed,
      runtimeSlotOwnProperty: Object.prototype.hasOwnProperty.call(window, slot),
      runtimeSlotValue: window[slot] === undefined ? "UNDEFINED" : "EXPOSED",
      runtimeSlotConfigurable: descriptor?.configurable,
      runtimeSlotEnumerable: descriptor?.enumerable,
      contract,
      validation,
      lastAnalysis: window.LeagueVectorLastAnalysis,
      readyEvents: window.__paidReadyEvents,
      blockedEvents: window.__paidBlockedEvents,
    };
  });

  expect(runtime.installed).toBe(true);
  expect(runtime.runtimeSlotOwnProperty).toBe(true);
  expect(runtime.runtimeSlotValue).toBe("UNDEFINED");
  expect(runtime.runtimeSlotConfigurable).toBe(false);
  expect(runtime.runtimeSlotEnumerable).toBe(false);
  expect(runtime.contract.source_rights_state).toBe("UNRESOLVED");
  expect(runtime.contract.state).toBe("PAID_VALUE_INELIGIBLE");
  expect(runtime.validation.valid).toBe(true);
  expect(runtime.validation.eligible).toBe(false);
  expect(runtime.lastAnalysis).toBeNull();
  expect(runtime.readyEvents).toBe(0);
  expect(runtime.blockedEvents).toBe(0);
  expect(counts.legacyProjectionRequests).toBe(0);
  expect(counts.transactions).toBe(0);
  expect(counts.sleeperRequests).toBe(0);
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
