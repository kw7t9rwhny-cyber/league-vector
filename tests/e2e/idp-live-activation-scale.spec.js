const { test, expect } = require("@playwright/test");

const LEAGUE_ID = "99887766";
const league = {
  league_id: LEAGUE_ID,
  name: "Scale IDP Lifecycle",
  season: "2026",
  total_rosters: 14,
  roster_positions: ["QB", "DL", "DL", "LB", "LB", "DB", "DB", "IDP_FLEX", "IDP_FLEX", "BN"],
  scoring_settings: { pass_yd: 0.04, pass_td: 4, idp_tkl_solo: 1.5, idp_tkl_ast: 0.75, idp_sack: 4, idp_qb_hit: 1, idp_int: 5, idp_pass_def: 2, idp_ff: 3, idp_fum_rec: 2 },
  settings: { draft_rounds: 6, playoff_week_start: 15 },
};
const rosters = Array.from({ length: 14 }, (_, i) => ({ roster_id: i + 1, owner_id: `u${i + 1}`, players: [], starters: [], taxi: [], reserve: [] }));
const users = rosters.map((r) => ({ user_id: r.owner_id, display_name: r.owner_id }));
const marketCsv = "player,pos,team,age,ecr_1qb,ecr_2qb,value_1qb,value_2qb,scrape_date,fp_id\n";

async function routeLifecycle(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "raw.githubusercontent.com") return route.fulfill({ status: 200, contentType: "text/csv", body: marketCsv });
    if (url.hostname !== "api.sleeper.app") return route.continue();
    const path = url.pathname;
    if (path === `/v1/league/${LEAGUE_ID}`) return route.fulfill({ json: league });
    if (path === `/v1/league/${LEAGUE_ID}/users`) return route.fulfill({ json: users });
    if (path === `/v1/league/${LEAGUE_ID}/rosters`) return route.fulfill({ json: rosters });
    if (path === `/v1/league/${LEAGUE_ID}/traded_picks`) return route.fulfill({ json: [] });
    if (path === "/v1/players/nfl") return route.continue();
    if (path === "/v1/state/nfl") return route.fulfill({ json: { league_season: "2026", leg: 1 } });
    if (path.includes("/projections/nfl/")) return route.fulfill({ json: [] });
    if (path.includes(`/v1/league/${LEAGUE_ID}/transactions/`)) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: `Unhandled: ${url}` } });
  });
}

test("production-scale IDP lifecycle reveals shell promptly after normal analysis success", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.__idpActivationTiming = { successAt: null, visibleAt: null };
    document.addEventListener("DOMContentLoaded", () => {
      const status = document.getElementById("status");
      const shell = document.getElementById("experimentalIdpRankings");
      new MutationObserver(() => {
        if (status.classList.contains("success") && window.__idpActivationTiming.successAt == null) window.__idpActivationTiming.successAt = performance.now();
      }).observe(status, { attributes: true, childList: true, subtree: true });
      new MutationObserver(() => {
        if (!shell.hidden && window.__idpActivationTiming.visibleAt == null) window.__idpActivationTiming.visibleAt = performance.now();
      }).observe(shell, { attributes: true, attributeFilter: ["hidden"] });
    });
  });
  await routeLifecycle(page);
  await page.goto("/");
  await page.getByLabel("Sleeper league ID or URL").fill(LEAGUE_ID);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(page.locator("#status")).toHaveClass(/success/, { timeout: 90_000 });
  await expect(page.locator("#experimentalIdpRankings")).toBeVisible({ timeout: 30_000 });
  const timing = await page.evaluate(() => window.__idpActivationTiming);
  expect(timing.successAt).not.toBeNull();
  expect(timing.visibleAt).not.toBeNull();
  expect(timing.visibleAt - timing.successAt, `IDP shell activation took ${timing.visibleAt - timing.successAt}ms after analysis success`).toBeLessThan(1500);
});
