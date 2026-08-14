const { test, expect } = require("@playwright/test");

const LEAGUE_ID = "87654321";
const marketCsv = [
  "player,pos,team,age,ecr_1qb,ecr_2qb,value_1qb,value_2qb,scrape_date,fp_id",
  "Josh Allen,QB,BUF,30,1,1,9500,9800,2026-08-13,201",
  "Christian McCaffrey,RB,SF,30,10,12,7000,6800,2026-08-13,202",
].join("\n");

const league = {
  league_id: LEAGUE_ID,
  name: "Search Regression League",
  season: "2026",
  total_rosters: 1,
  roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
  scoring_settings: { pass_yd: 0.04, pass_td: 4, rec: 1 },
  settings: { draft_rounds: 2, playoff_week_start: 14 },
};

const players = {
  josh: { full_name: "Josh Allen", position: "QB", fantasy_positions: ["QB"], team: "BUF", years_exp: 8 },
  cmc: { full_name: "Christian McCaffrey", position: "RB", fantasy_positions: ["RB"], team: "SF", years_exp: 9 },
};

async function mockSearchLeague(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "raw.githubusercontent.com") {
      return route.fulfill({ status: 200, contentType: "text/csv", body: marketCsv });
    }
    if (url.pathname.endsWith("/data/experimental/2026-projections.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        v: "lv-projection-frontend-v0.3", m: "lv-projection-system-v0.3", d: "2026-08-13T12:00:00Z", through: 2025, aliases: [], r: [],
      }) });
    }
    if (url.hostname !== "api.sleeper.app") return route.continue();
    const path = url.pathname;
    if (path === `/v1/league/${LEAGUE_ID}`) return route.fulfill({ json: league });
    if (path === `/v1/league/${LEAGUE_ID}/users`) return route.fulfill({ json: [{ user_id: "u1", display_name: "Owner" }] });
    if (path === `/v1/league/${LEAGUE_ID}/rosters`) return route.fulfill({ json: [{ roster_id: 1, owner_id: "u1", players: ["josh", "cmc"], starters: ["josh", "cmc"], taxi: [], reserve: [] }] });
    if (path === `/v1/league/${LEAGUE_ID}/traded_picks`) return route.fulfill({ json: [] });
    if (path === "/v1/players/nfl") return route.fulfill({ json: players });
    if (path === "/v1/state/nfl") return route.fulfill({ json: { league_season: "2026", leg: 1 } });
    if (path.includes("/projections/nfl/")) return route.fulfill({ json: [
      { player_id: "josh", stats: { pass_yd: 280, pass_td: 2, rush_yd: 35 } },
      { player_id: "cmc", stats: { rush_yd: 70, rec: 5, rec_yd: 45 } },
    ] });
    if (path.includes(`/v1/league/${LEAGUE_ID}/transactions/`)) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: `Unhandled fixture URL: ${url}` } });
  });
}

async function analyze(page) {
  await mockSearchLeague(page);
  await page.goto("/");
  await page.getByLabel("Sleeper league ID or URL").fill(LEAGUE_ID);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(page.locator("#status")).toHaveText(/League Vector v0\.8 foundation calculated/, { timeout: 15000 });
}

test("production dynasty search stays visible while rankings start collapsed and auto-open on search", async ({ page }) => {
  await analyze(page);
  const search = page.getByLabel("Search dynasty players");
  const disclosure = page.locator("#dynastyRankingsDisclosure");
  const joshCard = page.locator("#playerValues .player-card", { hasText: "Josh Allen" });
  const cmcCard = page.locator("#playerValues .player-card", { hasText: "Christian McCaffrey" });

  await expect(search).toBeVisible();
  await expect(page.locator("#dynastySearchStatus")).toHaveText("2 currently ranked dynasty players.");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(joshCard).toBeHidden();
  await expect(cmcCard).toBeHidden();

  await page.getByText("Show dynasty rankings", { exact: true }).click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(joshCard).toBeVisible();
  await expect(cmcCard).toBeVisible();
  const valueBefore = await joshCard.locator(".lv-value").textContent();

  await page.getByText("Hide dynasty rankings", { exact: true }).click();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await search.fill("jOsH aLlEn");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(joshCard).toBeVisible();
  await expect(cmcCard).toBeHidden();
  await expect(joshCard.locator(".lv-value")).toHaveText(valueBefore);

  await search.fill("not-a-real-player");
  await expect(page.locator("[data-dynasty-search-empty]")).toHaveText("No dynasty players match “not-a-real-player”.");
  await search.fill("");
  await expect(joshCard).toBeVisible();
  await expect(cmcCard).toBeVisible();
  await expect(joshCard.locator(".lv-value")).toHaveText(valueBefore);
});

test("production dynasty search is usable at iPhone-sized viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await analyze(page);
  const search = page.getByLabel("Search dynasty players");
  const disclosure = page.locator("#dynastyRankingsDisclosure");
  await expect(search).toBeVisible();
  await expect(disclosure).not.toHaveAttribute("open", "");

  const box = await search.boundingBox();
  expect(box).not.toBeNull();
  expect(box.height).toBeGreaterThanOrEqual(40);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);

  await search.fill("Josh Allen");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(page.locator("#playerValues .player-card", { hasText: "Josh Allen" })).toBeVisible();
  await expect(page.locator("#playerValues .player-card", { hasText: "Christian McCaffrey" })).toBeHidden();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
