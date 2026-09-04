const { test, expect } = require("@playwright/test");
const fixture = require("../../data/pilot/synthetic-run.json");
const S = require("../../ranking-snapshot-v1");
const run = fixture.run_id;
const board = "/rankings.html";
const player = id => `/player.html?id=${id}&format=dynasty-1qb&run=${run}`;
const compare = (extra = "") => `/compare.html?a=lv:synthetic:demo-001&b=lv:synthetic:demo-002&format=dynasty-1qb&run=${run}${extra}`;
const row = (page, id) => page.locator(`[data-player-id="${id}"]`);
async function mock(page, mutate) {
  const raw = structuredClone(fixture); mutate(raw);
  let bytes; try { bytes = S.canonicalizeSnapshot(raw); } catch { bytes = JSON.stringify(raw); }
  await page.route("**/data/pilot/synthetic-run.json", route => route.fulfill({ body: bytes, contentType: "application/json" }));
}
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date("2026-09-05T00:00:00Z")); });

test("rankings use only local assets, show synthetic labeling and pin the run", async ({ page }) => {
  const external = [], errors = [];
  page.on("request", request => { if (new URL(request.url()).hostname !== "127.0.0.1") external.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  await page.goto(board);
  await expect(row(page, "lv:synthetic:demo-001")).toBeVisible();
  await expect(page.locator(".rank-board .rank-row")).toHaveCount(50);
  await expect(page.getByText("DEMO · SYNTHETIC DATA", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`run=${run}`));
  await page.getByText("Format assumptions, coverage & method").click();
  await expect(page.locator("#methodology")).toContainText("Multi-season dynasty player preference");
  await expect(page.locator("#methodology")).toContainText("64 fictional veteran players");
  expect(external).toEqual([]); expect(errors).toEqual([]);
});

test("search covers the final page and approved aliases; clear and empty states work", async ({ page }) => {
  await page.goto(board);
  await page.getByLabel("Find a player").fill("THE LANTERN");
  await expect(row(page, "lv:synthetic:demo-064")).toBeVisible();
  await expect(row(page, "lv:synthetic:demo-064").getByLabel("Overall rank 64")).toBeVisible();
  await page.getByLabel("Find a player").fill("No matching fictional person");
  await expect(page.getByRole("heading", { name: "No players match" })).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator(".rank-board .rank-row")).toHaveCount(50);
});

test("position filter preserves global rank and survives format changes", async ({ page }) => {
  await page.goto(board);
  await page.getByRole("button", { name: "QB", exact: true }).click();
  await expect(row(page, "lv:synthetic:demo-003").getByLabel("Overall rank 3")).toBeVisible();
  await page.getByRole("button", { name: "Dynasty Superflex", exact: true }).click();
  await expect(row(page, "lv:synthetic:demo-003").getByLabel("Overall rank 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "QB", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/format=dynasty-superflex/);
});

test("load more and player back links preserve query, position and visible count", async ({ page }) => {
  await page.goto(board);
  await page.getByRole("button", { name: "Load 50 more players" }).click();
  await expect(page.locator(".rank-board .rank-row")).toHaveCount(64);
  await row(page, "lv:synthetic:demo-064").getByRole("link", { name: "Synthetic Peregrine Reed", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Synthetic Peregrine Reed", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to rankings" }).click();
  await expect(page.locator(".rank-board .rank-row")).toHaveCount(64);
  await page.getByLabel("Find a player").fill("Cobalt");
  await page.getByRole("button", { name: "QB", exact: true }).click();
  await row(page, "lv:synthetic:demo-003").getByRole("link", { name: "Synthetic Cobalt Vale", exact: true }).click();
  await page.goBack();
  await expect(page.getByLabel("Find a player")).toHaveValue("Cobalt");
  await expect(page.getByRole("button", { name: "QB", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("player explains source and no history, optional evidence and nearest alternatives", async ({ page }) => {
  await page.goto(player("lv:synthetic:demo-003"));
  await expect(page.getByText("No prior published run", { exact: true })).toBeVisible();
  await expect(page.getByText("No supported change condition recorded.", { exact: true })).toBeVisible();
  const headings = await page.locator(".evidence-card > h2").allTextContents();
  expect(headings).toEqual(["WHY IS THIS PLAYER RANKED HERE?", "WHAT CHANGED?", "WHAT SUPPORTS THE RANK?", "WHAT HURTS THE CASE?", "WHAT WOULD CHANGE OUR MIND?", "WHO ARE THE CLOSEST ALTERNATIVES?"]);
  await expect(page.locator(".alternative")).toHaveCount(2);
  await page.locator(".driver summary").first().click();
  await expect(page.locator(".driver details").first()).toContainText("Original League Vector synthetic UI fixtures.");
});

test("unsupported player and unknown ID are distinct", async ({ page }) => {
  await page.goto(board);
  await page.getByLabel("Find a player").fill("Newleaf");
  await expect(row(page, "lv:synthetic:demo-rookie")).toContainText("Not ranked");
  await expect(row(page, "lv:synthetic:demo-rookie").locator("button")).toHaveCount(0);
  await row(page, "lv:synthetic:demo-rookie").getByRole("link").click();
  await expect(page.locator('[data-state="unsupported_player"]')).toContainText("Rookie: a supported rookie method");
  await expect(page.locator(".player-hero")).toHaveCount(0);
  await page.goto(player("missing"));
  await expect(page.locator('[data-error="invalid_player_id"]')).toBeVisible();
});

test("selection persists, rejects a third player, removes and completes comparison", async ({ page }) => {
  await page.goto(board);
  await row(page, "lv:synthetic:demo-001").getByRole("button").click();
  await row(page, "lv:synthetic:demo-002").getByRole("button").click();
  await row(page, "lv:synthetic:demo-003").getByRole("button").click();
  await expect(page.getByRole("status").filter({ hasText: "Remove one" })).toBeVisible();
  await expect(page.locator(".tray-player")).toHaveCount(2);
  await row(page, "lv:synthetic:demo-001").getByRole("link", { name: "Synthetic Aster Vale", exact: true }).click();
  await expect(page.locator(".tray-player")).toHaveCount(2);
  await page.getByRole("button", { name: "Remove Synthetic Bramble Vale", exact: true }).click();
  await expect(page.locator(".tray-player")).toHaveCount(1);
  await page.getByRole("link", { name: "Back to rankings" }).click();
  await row(page, "lv:synthetic:demo-002").getByRole("button").click();
  await page.getByRole("link", { name: "Compare players" }).click();
  await expect(page.locator('[data-outcome="NO_CLEAR_PREFERENCE"]')).toContainText("No approved pairwise preference rule");
  await page.getByRole("link", { name: "Swap sides" }).click();
  await expect(page.locator('[data-outcome="NO_CLEAR_PREFERENCE"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('a')).toBe('lv:synthetic:demo-002');
});

test("format switch preserves supported selections and search", async ({ page }) => {
  await page.goto(board);
  await row(page, "lv:synthetic:demo-001").getByRole("button").click();
  await page.getByLabel("Find a player").fill("Aster");
  await page.getByRole("button", { name: "Dynasty Superflex", exact: true }).click();
  await expect(page.locator(".tray-player")).toHaveCount(1);
  await expect(page.getByLabel("Find a player")).toHaveValue("Aster");
  await expect(page.locator("#pilot-notice")).toContainText("Selected players now use this format");
  await page.getByRole("button", { name: "Dynasty 1QB", exact: true }).click();
  await expect(page.locator(".tray-player")).toHaveCount(1);
});

test("valid comparison uses same run across format switch, copy and replacement links", async ({ page }) => {
  await page.goto(compare());
  await expect(page.locator(".compare-conclusion")).toContainText("Ranks do not measure the size");
  await page.getByRole("button", { name: "Dynasty Superflex", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`run=${run}`));
  expect(new URL(page.url()).searchParams.get("a")).toBe("lv:synthetic:demo-001");
  expect(new URL(page.url()).searchParams.get("b")).toBe("lv:synthetic:demo-002");
  await expect(page.getByRole("button", { name: "Dynasty Superflex", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Copy comparison link" }).click();
  await expect(page.locator("#pilot-notice")).toContainText(/link copied|Copy this exact-run link/);
  await page.getByRole("link", { name: "Replace a player" }).click();
  await expect(page.locator(".tray-player")).toHaveCount(2);
});

for (const [name, url, code] of [
  ["one-player comparison", `/compare.html?a=lv:synthetic:demo-001&format=dynasty-1qb&run=${run}`, "invalid_compare"],
  ["same player", `/compare.html?a=lv:synthetic:demo-001&b=lv:synthetic:demo-001&format=dynasty-1qb&run=${run}`, "invalid_compare"],
  ["cross-format comparison", compare("&bFormat=dynasty-superflex"), "cross_format_compare"],
  ["cross-run comparison", compare("&bRun=demo-old"), "cross_run_compare"],
  ["unsupported comparison", `/compare.html?a=lv:synthetic:demo-001&b=lv:synthetic:demo-rookie&format=dynasty-1qb&run=${run}`, "unsupported_compare"],
  ["invalid format", "/rankings.html?format=redraft", "unsupported_format"],
  ["empty format", "/rankings.html?format=", "unsupported_format"],
  ["unknown run", "/rankings.html?run=not-found", "unavailable_run"],
  ["duplicate identity parameter", compare("&a=lv:synthetic:demo-003"), "invalid_link"]
]) test(`fails closed for ${name}`, async ({ page }) => {
  await page.goto(url);
  await expect(page.locator(`[data-error="${code}"]`)).toBeVisible();
  await expect(page.locator(".rank-board, .compare-conclusion")).toHaveCount(0);
});

test("no pairwise rule produces an explicit abstention", async ({ page }) => {
  await page.goto(`/compare.html?a=lv:synthetic:demo-001&b=lv:synthetic:demo-004&format=dynasty-1qb&run=${run}`);
  await expect(page.locator('[data-outcome="NO_CLEAR_PREFERENCE"]')).toContainText("order alone does not establish");
});

test("loading, missing and malformed snapshots remain distinct", async ({ page }) => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/data/pilot/synthetic-run.json", async route => { await gate; await route.fulfill({ status: 404 }); });
  await page.goto(board);
  await expect(page.getByRole("heading", { name: "Loading demo snapshot…" })).toBeVisible();
  release();
  await expect(page.locator('[data-error="no_snapshot"]')).toBeVisible();
  await page.unroute("**/data/pilot/synthetic-run.json");
  await mock(page, r => r.formats["dynasty-1qb"].entries.push(r.formats["dynasty-1qb"].entries[0]));
  await page.goto(board);
  await expect(page.locator('[data-error="malformed_snapshot"]')).toBeVisible();
  await expect(page.locator(".rank-board")).toHaveCount(0);
});

test("malformed other format also blocks current page and compare", async ({ page }) => {
  await mock(page, r => { r.formats["dynasty-superflex"].entries[0].rank = 0; });
  await page.goto(compare());
  await expect(page.locator('[data-error="malformed_snapshot"]')).toBeVisible();
});

test("history uses exact Snapshot current/prior contracts", async ({ page }) => {
  const current = require("../../fixtures/ranking-snapshot-v1/synthetic-current.json");
  await mock(page, r => { for (const key of Object.keys(r)) delete r[key]; Object.assign(r, structuredClone(current)); });
  await page.goto(`/player.html?id=lv:synthetic:alpha&format=dynasty-1qb&run=${current.run_id}`);
  await expect(page.getByText("Previous rank 3 → current rank 1 (+2; positive means moved up).")).toBeVisible();
  await expect(page.getByText("Changed input evidence")).toBeVisible();
  await page.goto(`/player.html?id=lv:synthetic:charlie&format=dynasty-1qb&run=${current.run_id}`);
  await expect(page.getByText(/Other players’ ordering changed/)).toBeVisible();
  await page.unroute("**/data/pilot/synthetic-run.json");
  const modified = structuredClone(current); modified.method.version = "2";
  for (const board of Object.values(modified.formats)) for (const e of board.entries) if (e.ranking_status === "RANKED") e.history = { state: "NOT_COMPARABLE", previous_rank: null, changed_fact_refs: [] };
  await mock(page, r => { for (const key of Object.keys(r)) delete r[key]; Object.assign(r, modified); });
  await page.goto(`/player.html?id=lv:synthetic:alpha&format=dynasty-1qb&run=${current.run_id}`);
  await expect(page.getByText("Not comparable with the previous run.")).toBeVisible();
  await expect(page.getByText("Method changed.", { exact: true })).toBeVisible();
});

test("outdated and revoked snapshots suppress current preference", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-12T00:00:00Z"));
  await page.goto(board);
  await expect(page.getByText("OUTDATED DEMO RUN", { exact: true })).toBeVisible();
  await page.goto(compare());
  await expect(page.locator('[data-error="outdated_compare"]')).toBeVisible();
  await mock(page, r => { r.publication.state = "WITHDRAWN"; r.published_at = r.generated_at; });
  await page.goto(board);
  await expect(page.locator('[data-error="revoked_snapshot"]')).toBeVisible();
});

test("events disclose run identity and buckets without raw search strings", async ({ page }) => {
  await page.addInitScript(() => {
    window.pilotEvents = [];
    for (const name of ["rankings_viewed", "search_completed", "explanation_opened", "compare_selection"]) window.addEventListener(`leaguevector:${name}`, e => window.pilotEvents.push({ name, detail: e.detail }));
  });
  await page.goto(board);
  await page.getByLabel("Find a player").fill("private test query");
  await expect.poll(() => page.evaluate(() => window.pilotEvents.some(e => e.name === "search_completed"))).toBeTruthy();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await row(page, "lv:synthetic:demo-001").getByRole("button").click();
  await page.getByText("Format assumptions, coverage & method").click();
  const events = await page.evaluate(() => window.pilotEvents);
  expect(JSON.stringify(events)).not.toContain("private test query");
  expect(events.every(e => e.detail.run_id === run)).toBeTruthy();
  expect(events.some(e => e.name === "compare_selection")).toBeTruthy();
});

test("methodology and player evidence deep links open their disclosures", async ({ page }) => {
  await page.goto(`/rankings.html?format=dynasty-1qb&run=${run}#methodology`);
  await expect(page.locator("#methodology")).toHaveAttribute("open", "");
  await page.goto(player("lv:synthetic:demo-001") + "#ui-1qb-demo-001-role");
  await expect(page.locator("#ui-1qb-demo-001-role")).toHaveAttribute("open", "");
});

test("320/375px layout, long names, text enlargement and tray remain usable", async ({ page }) => {
  await mock(page, r => { for (const f of Object.values(r.formats)) f.entries.find(p => p.player_id === "lv:synthetic:demo-001").name = "Synthetic Aster Verylongsyntheticfamilyname Vale"; });
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto(board);
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await row(page, "lv:synthetic:demo-001").getByRole("button").click();
    await row(page, "lv:synthetic:demo-002").getByRole("button").click();
    for (const selector of ["#pilot-search", "[data-format]", "[data-position]", ".rank-row button", ".tray-player button"]) {
      const sizes = await page.locator(selector).evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { width: r.width, height: r.height }; }));
      expect(sizes.every(s => s.width >= 44 && s.height >= 44)).toBeTruthy();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.goto(player("lv:synthetic:demo-001"));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.goto(compare());
    await expect(page.locator(".compare-conclusion")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.addStyleTag({ content: "html { font-size: 200%; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("failed pinned run remains pinned when changing formats", async ({ page }) => {
  await page.goto("/rankings.html?run=unavailable-history");
  await expect(page.locator('[data-error="unavailable_run"]')).toBeVisible();
  await page.getByRole("button", { name: "Dynasty Superflex", exact: true }).click();
  await expect(page).toHaveURL(/run=unavailable-history/);
  await expect(page.locator('[data-error="unavailable_run"]')).toBeVisible();
});

test("unsupported detail retains the existing tray; keyboard load more continues at row 51", async ({ page }) => {
  await page.goto(board);
  await row(page, "lv:synthetic:demo-001").getByRole("button").click();
  await row(page, "lv:synthetic:demo-rookie").getByRole("link").click();
  await expect(page.locator(".tray-player")).toHaveCount(1);
  await page.getByRole("link", { name: "Back to rankings" }).click();
  await page.getByRole("button", { name: "Load 50 more players" }).focus();
  await page.keyboard.press("Enter");
  await expect(row(page, "lv:synthetic:demo-051").getByRole("link", { name: "Synthetic Cobalt Reed", exact: true })).toBeFocused();
});

test("format switch removes an unsupported selection with an explanation", async ({ page }) => {
  await mock(page, r => {
    const target = r.formats["dynasty-superflex"];
    const p = target.entries.find(p => p.player_id === "lv:synthetic:demo-003");
    p.rank = null; p.ranking_status = "NOT_RANKED"; p.evidence_state = "UNAVAILABLE"; p.unsupported_reason = "required_input_missing"; p.drivers = []; p.change_conditions = []; p.primary_reason = null; p.history = { state: "NOT_RANKED", previous_rank: null, changed_fact_refs: [] };
    for (const other of target.entries) if (other.rank !== null) other.rank -= 1;
    target.universe.eligible_player_ids = target.universe.eligible_player_ids.filter(id => id !== p.player_id); target.universe.coverage_count -= 1;
  });
  await page.goto(board);
  await row(page, "lv:synthetic:demo-003").getByRole("button").click();
  await page.getByRole("button", { name: "Dynasty Superflex", exact: true }).click();
  await expect(page.locator("#compare-tray")).toBeHidden();
  await expect(page.locator("#pilot-notice")).toContainText("Unsupported comparison selections were removed");
});

test("rankings and player detail support 200 percent text at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  for (const url of [board, player("lv:synthetic:demo-001")]) {
    await page.goto(url);
    await expect(page.locator(url === board ? ".rank-board" : ".player-hero")).toBeVisible();
    await page.addStyleTag({ content: "html { font-size: 200%; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("first ranking identity is reachable in the initial iPhone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(board);
  await expect(row(page, "lv:synthetic:demo-001")).toBeVisible();
  const name = await row(page, "lv:synthetic:demo-001").getByRole("link", { name: "Synthetic Aster Vale", exact: true }).boundingBox();
  expect(name.y + name.height).toBeLessThanOrEqual(812);
});

test("third URL reference is rejected and browser back restores detail-page selections", async ({ page }) => {
  await page.goto(compare("&c=lv:synthetic:demo-003"));
  await expect(page.locator('[data-error="invalid_compare"]')).toBeVisible();
  await page.goto(board);
  await row(page, "lv:synthetic:demo-001").getByRole("button").click();
  await row(page, "lv:synthetic:demo-002").getByRole("link", { name: "Synthetic Bramble Vale", exact: true }).click();
  await page.locator("[data-select='lv:synthetic:demo-002']").click();
  await page.goBack();
  await expect(page.locator(".tray-player")).toHaveCount(2);
  await expect(row(page, "lv:synthetic:demo-002").getByRole("button")).toHaveAttribute("aria-pressed", "true");
});
