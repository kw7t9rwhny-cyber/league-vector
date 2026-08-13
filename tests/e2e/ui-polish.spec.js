const { test, expect } = require("@playwright/test");

test("loads the isolated polish layer without changing the import contract", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your league/i })).toBeVisible();
  await expect(page.getByLabel("Sleeper league ID or URL")).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze League" })).toBeVisible();

  const polishLoaded = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) => String(sheet.href || "").includes("ui-polish.css"))
  );
  expect(polishLoaded).toBe(true);
});

test("keeps first-touch league import usable on an iPhone-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const input = page.getByLabel("Sleeper league ID or URL");
  const button = page.getByRole("button", { name: "Analyze League" });
  await expect(input).toBeVisible();
  await expect(button).toBeVisible();

  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    buttonHeight: document.querySelector("#go").getBoundingClientRect().height,
    inputWidth: document.querySelector("#leagueId").getBoundingClientRect().width,
    viewport: window.innerWidth,
  }));

  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.buttonHeight).toBeGreaterThanOrEqual(52);
  expect(metrics.inputWidth).toBeLessThanOrEqual(metrics.viewport - 28);
});
