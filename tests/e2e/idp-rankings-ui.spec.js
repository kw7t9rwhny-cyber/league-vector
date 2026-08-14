const { test, expect } = require("@playwright/test");

const safeContract = {
  experimental: true,
  current_season: true,
  idp_dynasty_value_available: false,
  players: [
    { player_name: "Hybrid Edge", team: "GB", position: "DL", eligibility: ["DL", "LB"], current_eligible: true, projected_points: 211.4, projected_surplus: 48.2, status: "current_eligible", confidence: "Medium" },
    { player_name: "Vector Linebacker", team: "PIT", position: "LB", eligibility: ["LB"], current_eligible: true, projected_points: 198.1, status: "current_eligible", confidence: "High" },
    { player_name: "Vector Safety", team: "MIN", position: "DB", eligibility: ["DB"], current_eligible: true, projected_points: 177.3, status: "current_eligible", confidence: "Low", warning: "Role uncertainty" },
    { player_name: "Unsafe Retired", team: "FA", position: "LB", eligibility: ["LB"], current_eligible: false, projected_points: 300, projected_surplus: 100, status: "inactive" },
  ],
};

async function mount(page, contract = safeContract) {
  await page.goto("/");
  await page.evaluate((input) => window.renderLeagueVectorIdpRankings(input), contract);
}

async function openIdp(page) {
  const shell = page.locator("#experimentalIdpRankings");
  if (!(await shell.getAttribute("open"))) await page.getByText("Show IDP rankings", { exact: true }).click();
  await expect(shell).toHaveAttribute("open", "");
}

test("IDP shell is collapsed by default and clearly separated from Dynasty Rankings", async ({ page }) => {
  await mount(page);
  const shell = page.locator("#experimentalIdpRankings");
  await expect(shell).toBeVisible();
  await expect(shell).not.toHaveAttribute("open", "");
  await expect(page.getByText("EXPERIMENTAL IDP RANKINGS", { exact: true })).toBeVisible();
  await expect(page.getByText("Show IDP rankings", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Search IDP players")).toBeHidden();
});

test("renders only current-eligible rows and never invents IDP Dynasty Value", async ({ page }) => {
  await mount(page);
  await openIdp(page);
  const rows = page.locator("#idpRankingRows");
  await expect(rows).toContainText("Hybrid Edge");
  await expect(rows).toContainText("Vector Linebacker");
  await expect(rows).not.toContainText("Unsafe Retired");
  await expect(rows).toContainText("211.4");
  await expect(rows).toContainText("48.2");
  await expect(rows).toContainText("Dynasty Value");
  await expect(rows).toContainText("Unavailable");
  await expect(rows).not.toContainText(/Dynasty Value\s*\d/);
});

test("projected surplus degrades gracefully when absent and hybrids honor eligibility filters", async ({ page }) => {
  await mount(page);
  await openIdp(page);
  const lbCard = page.locator(".idp-ranking-card").filter({ hasText: "Vector Linebacker" });
  await expect(lbCard).not.toContainText("Projected surplus");
  await page.getByRole("button", { name: "DL", exact: true }).click();
  await expect(page.locator("#idpRankingRows")).toContainText("Hybrid Edge");
  await expect(page.locator("#idpRankingRows")).not.toContainText("Vector Linebacker");
  await page.getByRole("button", { name: "IDP FLEX", exact: true }).click();
  await expect(page.locator("#idpRankingRows .idp-ranking-card")).toHaveCount(3);
});

test("search and warning/confidence indicators remain compact and usable", async ({ page }) => {
  await mount(page);
  await openIdp(page);
  await page.getByLabel("Search IDP players").fill("Safety");
  const rows = page.locator("#idpRankingRows");
  await expect(rows).toContainText("Vector Safety");
  await expect(rows).toContainText("Low confidence");
  await expect(rows).toContainText("Role uncertainty");
  await expect(rows).not.toContainText("Hybrid Edge");
});

test("contract claiming numeric IDP Dynasty Value fails closed in this shell", async ({ page }) => {
  await mount(page, { ...safeContract, idp_dynasty_value_available: true });
  await openIdp(page);
  await expect(page.locator("#idpRankingRows .idp-ranking-card")).toHaveCount(0);
  await expect(page.locator("#idpRankingStatus")).toContainText("No approved current-season IDP ranking rows");
});

test("iPhone viewport has touch-safe filters and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mount(page);
  const actionHeight = await page.locator(".idp-rankings-action").evaluate((el) => el.getBoundingClientRect().height);
  expect(actionHeight).toBeGreaterThanOrEqual(48);
  await openIdp(page);
  const filterHeight = await page.getByRole("button", { name: "LB", exact: true }).evaluate((el) => el.getBoundingClientRect().height);
  expect(filterHeight).toBeGreaterThanOrEqual(42);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
