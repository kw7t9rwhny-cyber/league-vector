const { test, expect } = require("@playwright/test");

const LEAGUE_ID = "1312249622554501120";

test("real network analysis lifecycle reveals the separate IDP shell", async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByLabel("Sleeper league ID or URL").fill(LEAGUE_ID);
  await page.getByRole("button", { name: "Analyze League" }).click();
  await expect(page.locator("#status")).toHaveClass(/success/, { timeout: 90_000 });

  const diagnostics = await page.evaluate(() => ({
    rendererType: typeof window.renderLeagueVectorIdpRankings,
    rankingsType: typeof window.LeagueVectorIdpCurrentSeasonRankingsV01,
    projectionFrontendType: typeof window.LeagueVectorProjectionFrontend,
    dataType: typeof window.LeagueVectorData,
    contract: window.__leagueVectorIdpRankingsContract || null,
    shellHidden: document.getElementById("experimentalIdpRankings")?.hidden,
    statusClass: document.getElementById("status")?.className,
  }));

  expect(diagnostics, `IDP activation diagnostics: ${JSON.stringify({ ...diagnostics, consoleErrors })}`).toMatchObject({
    rendererType: "function",
    rankingsType: "object",
    projectionFrontendType: "object",
    dataType: "object",
    shellHidden: false,
  });
  expect(diagnostics.contract).toBeTruthy();
  await expect(page.locator("#experimentalIdpRankings")).toBeVisible();
});
