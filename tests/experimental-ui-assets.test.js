const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const PRIMARY = 'experimental-ui-v03.js?v=0.3.3';
const ENHANCEMENTS = 'experimental-ui-v03-enhancements.js?v=0.3.3';

test('experimental projection UI assets are explicit, unique, and cache-busted', () => {
  const html = fs.readFileSync('index.html', 'utf8');

  assert.match(html, new RegExp(PRIMARY.replace(/[.?]/g, '\\$&')));
  assert.match(html, new RegExp(ENHANCEMENTS.replace(/[.?]/g, '\\$&')));
  assert.doesNotMatch(html, /experimental-ui-v03\.js\?v=0\.3\.1/);
  assert.doesNotMatch(html, /experimental-ui-v03-enhancements\.js\?v=0\.3\.2/);
  assert.equal((html.match(/experimental-ui-v03\.js\?v=0\.3\.3/g) || []).length, 1);
  assert.equal((html.match(/experimental-ui-v03-enhancements\.js\?v=0\.3\.3/g) || []).length, 1);
});

test('static preview workflow ships and verifies the compact projection browser assets', () => {
  const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

  assert.match(workflow, /projection-browser-v01\.css/);
  assert.match(workflow, /experimental-ui-v03\.js/);
  assert.match(workflow, /experimental-ui-v03-enhancements\.js/);
  assert.match(workflow, /experimental-ui-v03\.js\?v=0\.3\.3/);
  assert.match(workflow, /experimental-ui-v03-enhancements\.js\?v=0\.3\.3/);
  assert.match(workflow, /curl[^\n]*experimental-ui-v03\.js/);
  assert.match(workflow, /curl[^\n]*experimental-ui-v03-enhancements\.js/);
  assert.match(workflow, /curl[^\n]*projection-browser-v01\.css/);
});
