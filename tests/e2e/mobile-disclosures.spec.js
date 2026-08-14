const { test, expect } = require("@playwright/test");

async function showResults(page) {
  await page.goto("/");
  await page.evaluate(() => {
    document.getElementById("results").hidden = false;
    document.getElementById("identityStatus").textContent = "Identity ready";
    document.getElementById("projectionStatus").textContent = "Projection ready";
    document.getElementById("scoringCoverage").textContent = "Scoring complete";
    document.getElementById("transactionStatus").textContent = "Trades loaded";
    document.getElementById("dataQuality").textContent = "Technical source details";
    document.getElementById("teams").innerHTML = '<article class="team"><h3>Team One</h3><div class="player">Player One</div></article>';
  });
}

test("data quality disclosure starts collapsed and expands/collapses", async ({ page }) => {
  await showResults(page);
  const disclosure = page.locator("#dataQualityDisclosure");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(page.getByText("Show data quality details", { exact: true })).toBeVisible();
  await expect(page.getByText("Identity ready", { exact: true })).toBeHidden();
  await page.getByText("Show data quality details", { exact: true }).click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(page.getByText("Identity ready", { exact: true })).toBeVisible();
  await expect(page.getByText("Technical source details", { exact: true })).toBeVisible();
  await page.getByText("Hide data quality details", { exact: true }).click();
  await expect(disclosure).not.toHaveAttribute("open", "");
});

test("league rosters start collapsed and expand/collapse", async ({ page }) => {
  await showResults(page);
  const disclosure = page.locator("#leagueRostersDisclosure");
  await expect(page.getByRole("heading", { name: "League Rosters" })).toBeVisible();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(page.getByText("Team One", { exact: true })).toBeHidden();
  await page.getByText("Show league rosters", { exact: true }).click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(page.getByText("Team One", { exact: true })).toBeVisible();
  await page.getByText("Hide league rosters", { exact: true }).click();
  await expect(disclosure).not.toHaveAttribute("open", "");
});

test("experimental projection disclosure remains collapsed by default", async ({ page }) => {
  await showResults(page);
  const projection = page.locator("#experimentalProjectionPanel");
  await projection.evaluate((element) => { element.hidden = false; });
  await expect(projection).not.toHaveAttribute("open", "");
  await expect(page.getByText("Show projections", { exact: true })).toBeVisible();
});

test("iPhone disclosure controls are touch-safe and do not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await showResults(page);

  for (const selector of ["#dataQualityDisclosure > summary", "#dynastyRankingsDisclosure > summary", "#leagueRostersDisclosure > summary"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
