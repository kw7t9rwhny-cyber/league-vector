const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("every app DOM lookup has a matching element", () => {
  const app = fs.readFileSync("app.js", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  const ids = [...app.matchAll(/\$\("([A-Za-z0-9_-]+)"\)/g)].map((match) => match[1]);
  for (const id of new Set(ids)) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `Missing #${id} in index.html`);
  }
});

test("HTML references existing local assets and only v0.8 labels", () => {
  const html = fs.readFileSync("index.html", "utf8");
  for (const asset of [...html.matchAll(/(?:src|href)="([^"?]+)(?:\?[^" ]*)?"/g)].map((match) => match[1])) {
    if (/^(?:https?:|#|mailto:|tel:)/.test(asset)) continue;
    assert.equal(fs.existsSync(asset), true, `Missing asset ${asset}`);
  }
  assert.doesNotMatch(html, /v0\.[67]/);
  assert.match(html, /v0\.8/);
});
