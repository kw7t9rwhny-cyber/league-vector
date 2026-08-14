const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('production dynasty search assets are explicit and cache-busted', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const fixes = fs.readFileSync('live-test-fixes-v01.js', 'utf8');
  assert.match(html, /live-test-fixes-v01\.js\?v=0\.2/);
  assert.match(html, /dynasty-search-v01\.js\?v=0\.2/);
  assert.doesNotMatch(html, /live-test-fixes-v01\.js\?v=0\.1/);
  assert.equal((html.match(/dynasty-search-v01\.js\?v=0\.2/g) || []).length, 1);
  assert.doesNotMatch(fixes, /ensureDynastySearchLoaded/);
});
