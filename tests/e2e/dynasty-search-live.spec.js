const { test, expect } = require("@playwright/test");

const LEAGUE_ID = "87654321";

async function mockLeague(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "raw.githubusercontent.com") {
      return route.fulfill({ status: 200, contentType: "text/csv", body: [
        "player,pos,team,age,ecr_1qb,ecr_2qb,value_1qb,value_2qb,scrape_date,fp_id",
        "Josh Allen,QB,BUF,30,1,1,9500,9800,2026-08-13,201",
        "Brock Purdy,QB,SF,26,15,14,6100,6500,2026-08-13,203",
      ].join("\n") });
    }
    if (url.pathname.endsWith("/data/experimental/2026-projections.json")) {
      return route.fulfill({ json: { v: "lv-projection-frontend-v0.3", m: "lv-projection-system-v0.3", aliases: [], r: [] } });
    }
    if (url.hostname !== "api.sleeper.app") return route.continue();
    const path = url.pathname;
    if (path === `/v1/league/${LEAGUE_ID}`) return route.fulfill({ json: { league_id: LEAGUE_ID, name: "Live Search", season: "2026", total_rosters: 1, roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "BN"], scoring_settings: { pass_yd: .04, pass_td: 4 }, settings: { playoff_week_start: 14 } } });
    if (path === `/v1/league/${LEAGUE_ID}/users`) return route.fulfill({ json: [{ user_id: "u1", display_name: "Owner" }] });
    if (path === `/v1/league/${LEAGUE_ID}/rosters`) return route.fulfill({ json: [{ roster_id: 1, owner_id: "u1", players: ["josh", "purdy"], starters: ["josh"], taxi: [], reserve: [] }] });
    if (path === `/v1/league/${LEAGUE_ID}/traded_picks`) return route.fulfill({ json: [] });
    if (path === "/v1/players/nfl") return route.fulfill({ json: {
      josh: { full_name: "Josh Allen", position: "QB", fantasy_positions: ["QB"], team: "BUF", years_exp: 8 },
      purdy: { full_name: "Brock Purdy", position: "QB", fantasy_positions: ["QB"], team: "SF", years_exp: 4 },
    } });
    if (path === "/v1/state/nfl") return route.fulfill({ json: { league_season: "2026", leg: 1 } });
    if (path.includes("/projections/nfl/")) return route.fulfill({ json: [
      { player_id: "josh", stats: { pass_yd: 280, pass_td: 2 } },
      { player_id: "purdy", stats: { pass_yd: 255, pass_td: 2 } },
    ] });
    if (path.includes(`/v1/league/${LEAGUE_ID}/transactions/`)) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: {} });
  });
}

async function analyze(page) {
  await page.goto("/");
  await page.getByLabel("Sleeper league ID or URL").fill(LEAGUE_ID);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(page.locator("#status")).toHaveText(/foundation calculated/, { timeout: 15000 });
}

async function verifyPurdy(page) {
  const search = page.getByLabel("Search dynasty players");
  const purdy = page.locator("#playerValues .player-card", { hasText: "Brock Purdy" });
  const allen = page.locator("#playerValues .player-card", { hasText: "Josh Allen" });
  const value = await purdy.locator(".lv-value").textContent();
  await search.fill("pUrDy");
  await expect(purdy).toBeVisible();
  await expect(allen).toBeHidden();
  await expect(purdy.locator(".lv-value")).toHaveText(value);
  await search.fill("nobody-like-this");
  await expect(page.locator("[data-dynasty-search-empty]")).toContainText("No dynasty players match");
  await search.fill("");
  await expect(allen).toBeVisible();
}

test("Purdy filters after real analysis and re-analysis", async ({ page }) => {
  await mockLeague(page);
  await analyze(page);
  await verifyPurdy(page);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(page.locator("#status")).toHaveText(/foundation calculated/, { timeout: 15000 });
  await verifyPurdy(page);
});

test("Purdy filters on iPhone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockLeague(page);
  await analyze(page);
  const search = page.getByLabel("Search dynasty players");
  await expect(search).toBeVisible();
  await search.click({ trial: true });
  await verifyPurdy(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
