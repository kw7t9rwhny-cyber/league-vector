const { test, expect } = require("@playwright/test");

const completeCoverage = {
  status: "complete",
  supported_keys: ["sack", "tkl_solo"],
  unsupported_keys: [],
  missing_projected_stats: [],
};

const safeContract = {
  version: "lv-idp-current-season-rankings-v0.1",
  label: "Experimental IDP Current-Season Rankings v0.1",
  status: "ready_experimental",
  risk: "HIGH",
  blocked_reasons: [],
  unavailable_reasons: [],
  methodology: {
    projection: "Score safely current-eligible projected IDP counting stats under league scoring.",
    replacement: "Exact eligibility replacement threshold.",
    surplus: "projected_points - league_replacement_points when available.",
  },
  league_structure: { valid: true, reason: null, teams: 1, dedicated: { DL: 1, LB: 1, DB: 1 }, flex: 1, unsupported_roster_slots: [] },
  scoring_coverage: { ...completeCoverage, active_supported_stats: ["sacks", "solo_tackles"], meaningful_incomplete: false, scoring: { sacks: 4, solo_tackles: 1.5 } },
  identity_audit: { valid: true, duplicates: [] },
  replacement_points_by_eligibility: { DL: 160, "DL/LB": 163.2, LB: 150, DB: 145 },
  replacement_availability_by_eligibility: {
    DL: { status: "available", reason: null },
    "DL/LB": { status: "available", reason: null },
    LB: { status: "available", reason: null },
    DB: { status: "available", reason: null },
  },
  counts: { projection_ready_idp_before_current_gate: 4, safely_current_eligible: 3, safely_ranked: 3, excluded: 1, by_primary_position: { DL: 1, LB: 1, DB: 1 } },
  readiness: {
    DL: { current_season_ranking: "READY_FOR_EXPERIMENTAL_CURRENT_SEASON_RANKING", current_season_surplus: "READY_EXPERIMENTAL", dynasty_value: "NOT_READY", player_count: 1, role_confidence: "limited" },
    LB: { current_season_ranking: "READY_FOR_EXPERIMENTAL_CURRENT_SEASON_RANKING", current_season_surplus: "NOT_READY", dynasty_value: "NOT_READY", player_count: 1, role_confidence: "limited" },
    DB: { current_season_ranking: "READY_FOR_EXPERIMENTAL_CURRENT_SEASON_RANKING", current_season_surplus: "READY_EXPERIMENTAL", dynasty_value: "NOT_READY", player_count: 1, role_confidence: "limited" },
  },
  players: [
    {
      player_id: "lv:1", sleeper_id: "1", gsis_id: "g1", name: "Hybrid Edge", team: "GB",
      team_source: "verified_current_sleeper_eligibility_authority", primary_position: "DL", eligible_positions: ["DL", "LB"],
      current_status: "verified_current", projected_points: 211.4, league_replacement_points: 163.2,
      replacement_availability: { status: "available", reason: null }, projected_surplus: 48.2,
      scoring_coverage: completeCoverage, role_confidence: "limited", historical_role_model_available: false,
      eligibility_verified: true, current_season_ranking_available: true, current_season_surplus_available: true,
      idp_dynasty_value_available: false, dynasty_value: null, experimental: true,
      warnings: ["current-season projection only; not Dynasty Value", "role confidence limited because defensive snap/depth history is incomplete"],
    },
    {
      player_id: "lv:2", sleeper_id: "2", gsis_id: "g2", name: "Vector Linebacker", team: "PIT",
      team_source: "verified_current_sleeper_eligibility_authority", primary_position: "LB", eligible_positions: ["LB"],
      current_status: "verified_current", projected_points: 198.1, league_replacement_points: null,
      replacement_availability: { status: "unavailable", reason: "insufficient_current_pool_for_replacement" }, projected_surplus: null,
      scoring_coverage: completeCoverage, role_confidence: "limited", historical_role_model_available: false,
      eligibility_verified: true, current_season_ranking_available: true, current_season_surplus_available: false,
      idp_dynasty_value_available: false, dynasty_value: null, experimental: true,
      warnings: ["current-season projection only; not Dynasty Value", "current-season replacement unavailable: insufficient_current_pool_for_replacement"],
    },
    {
      player_id: "lv:3", sleeper_id: "3", gsis_id: "g3", name: "Vector Safety", team: "MIN",
      team_source: "verified_current_sleeper_eligibility_authority", primary_position: "DB", eligible_positions: ["DB"],
      current_status: "verified_current", projected_points: 177.3, league_replacement_points: 145,
      replacement_availability: { status: "available", reason: null }, projected_surplus: 32.3,
      scoring_coverage: completeCoverage, role_confidence: "limited", historical_role_model_available: false,
      eligibility_verified: true, current_season_ranking_available: true, current_season_surplus_available: true,
      idp_dynasty_value_available: false, dynasty_value: null, experimental: true,
      warnings: ["current-season projection only; not Dynasty Value", "historical starter/reserve role model unavailable"],
    },
  ],
  excluded: [{ sleeper_id: "4", gsis_id: "g4", name: "Unsafe Retired", primary_position: "DB", reason: "unsafe_current_eligibility" }],
  firewall: {
    idp_dynasty_value_available: false,
    offense_idp_combined_dynasty_rankings_available: false,
    production_activation_authorized: false,
  },
};

async function mount(page, contract = safeContract) {
  await page.goto("/");
  await page.evaluate((input) => {
    document.getElementById("results").hidden = false;
    return window.renderLeagueVectorIdpRankings(input);
  }, contract);
}

async function openIdp(page) {
  const shell = page.locator("#experimentalIdpRankings");
  if (!(await shell.getAttribute("open"))) await page.getByText("Show IDP rankings", { exact: true }).click();
  await expect(shell).toHaveAttribute("open", "");
}

test("IDP shell is collapsed by default and offensive Dynasty Value heading remains unchanged", async ({ page }) => {
  await mount(page);
  const shell = page.locator("#experimentalIdpRankings");
  await expect(shell).toBeVisible();
  await expect(shell).not.toHaveAttribute("open", "");
  await expect(page.getByText("EXPERIMENTAL IDP RANKINGS", { exact: true })).toBeVisible();
  await expect(page.getByText("Show IDP rankings", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Search IDP players")).toBeHidden();
  await expect(page.getByText("DYNASTY VALUE — v0.8 Formula", { exact: true })).toBeVisible();
});

test("canonical PR22 rows render and nested Dynasty firewall remains unavailable", async ({ page }) => {
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

test("projected surplus degrades gracefully and canonical hybrid eligibility drives filters", async ({ page }) => {
  await mount(page);
  await openIdp(page);
  const lbCard = page.locator(".idp-ranking-card").filter({ hasText: "Vector Linebacker" });
  await expect(lbCard).not.toContainText("Projected surplus");
  await page.getByRole("button", { name: "DL", exact: true }).click();
  await expect(page.locator("#idpRankingRows")).toContainText("Hybrid Edge");
  await expect(page.locator("#idpRankingRows")).not.toContainText("Vector Linebacker");
  await page.getByRole("button", { name: "LB", exact: true }).click();
  await expect(page.locator("#idpRankingRows")).toContainText("Hybrid Edge");
  await expect(page.locator("#idpRankingRows")).toContainText("Vector Linebacker");
  await page.getByRole("button", { name: "IDP FLEX", exact: true }).click();
  await expect(page.locator("#idpRankingRows .idp-ranking-card")).toHaveCount(3);
});

test("search and canonical role confidence/warnings remain compact and usable", async ({ page }) => {
  await mount(page);
  await openIdp(page);
  await page.getByLabel("Search IDP players").fill("Safety");
  const rows = page.locator("#idpRankingRows");
  await expect(rows).toContainText("Vector Safety");
  await expect(rows).toContainText("limited confidence");
  await expect(rows).toContainText("historical starter/reserve role model unavailable");
  await expect(rows).not.toContainText("Hybrid Edge");
});

test("nested Dynasty firewall mutation fails closed", async ({ page }) => {
  const unsafe = { ...safeContract, firewall: { ...safeContract.firewall, idp_dynasty_value_available: true } };
  await mount(page, unsafe);
  await openIdp(page);
  await expect(page.locator("#idpRankingRows .idp-ranking-card")).toHaveCount(0);
  await expect(page.locator("#idpRankingStatus")).toContainText("firewall contract is not in the approved fail-closed state");
});

test("row-level Dynasty firewall or eligibility drift fails closed", async ({ page }) => {
  const unsafeRows = safeContract.players.map((player, index) => index === 0 ? { ...player, idp_dynasty_value_available: true, dynasty_value: 9999 } : player);
  await mount(page, { ...safeContract, players: unsafeRows });
  await openIdp(page);
  await expect(page.locator("#idpRankingRows")).not.toContainText("Hybrid Edge");
  await expect(page.locator("#idpRankingRows .idp-ranking-card")).toHaveCount(2);
});

test("blocked/unavailable canonical contract exposes truth and renders no rows", async ({ page }) => {
  await mount(page, { ...safeContract, status: "unavailable", unavailable_reasons: ["no_rankable_current_players"] });
  await openIdp(page);
  await expect(page.locator("#idpRankingRows .idp-ranking-card")).toHaveCount(0);
  await expect(page.locator("#idpRankingStatus")).toContainText("no_rankable_current_players");
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
