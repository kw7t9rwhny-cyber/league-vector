const { test, expect } = require("@playwright/test");

test("uses a compact mobile header while the command center is open and restores it on reset", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.evaluate(() => {
    document.querySelector("#results").hidden = false;
    window.dispatchEvent(new CustomEvent("leaguevector:analysis-ready", {
      detail: {
        league: { id: "mobile-header-test", name: "Mobile Header League", season: "2026", format: "1QB", teamCount: 1 },
        teams: [{
          rosterId: 1,
          teamName: "Test Team",
          ownerName: "Test Owner",
          offensiveRank: 1,
          totalTeams: 1,
          marketValue: 10000,
          leagueValue: 11000,
          starterValue: 7000,
          benchValue: 4000,
          completeness: 100,
          pickCount: 0,
          picks: [],
          positional: { QB: 6000, RB: 5000, WR: 0, TE: 0 },
          strength: "QB",
          weakness: "TE",
          offensivePlayerCount: 2,
          matchedOffensiveCount: 2,
          idpPlayerCount: 0,
          rosterPlayerCount: 2,
          starterCount: 2,
          taxiCount: 0,
          reserveCount: 0,
        }],
        dataQuality: { warnings: [] },
        support: { projectionStatus: "complete", idpDynastyValue: "unavailable", championshipProbability: "unavailable" },
      },
    }));
  });

  await expect(page.locator("body")).toHaveClass(/command-center-active/);
  await expect(page.locator("#commandCenterChooser")).toBeVisible();
  await expect(page.locator(".site-header .header-actions")).toBeHidden();

  const compactHeight = await page.locator(".site-header").evaluate((node) => node.getBoundingClientRect().height);
  expect(compactHeight).toBeLessThanOrEqual(46);

  await page.getByRole("button", { name: /Select Test Team/ }).click();
  await expect(page.locator("#commandCenterDashboard")).toBeVisible();
  const navigationTop = await page.locator(".cc-navigation").evaluate((node) => getComputedStyle(node).top);
  expect(navigationTop).toBe("44px");

  await page.locator("#commandCenterDashboard").getByRole("button", { name: "Run another league" }).click();
  await expect(page.locator("body")).not.toHaveClass(/command-center-active/);
  await expect(page.locator(".site-header .header-actions")).toBeVisible();
  const restoredHeight = await page.locator(".site-header").evaluate((node) => node.getBoundingClientRect().height);
  expect(restoredHeight).toBeGreaterThanOrEqual(60);
});
