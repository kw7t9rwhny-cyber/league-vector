const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function count(text, needle) {
  return text.split(needle).length - 1;
}

test('experimental UI scripts use only the current cache versions', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const primary = ['experimental-ui-v03.js', 'v=0.3.4'].join('?');
  const enhancements = ['experimental-ui-v03-enhancements.js', 'v=0.3.3'].join('?');
  const oldPrimary = ['experimental-ui-v03.js', 'v=0.3.3'].join('?');
  const oldEnhancements = ['experimental-ui-v03-enhancements.js', 'v=0.3.2'].join('?');

  assert.equal(count(html, primary), 1);
  assert.equal(count(html, enhancements), 1);
  assert.equal(count(html, oldPrimary), 0);
  assert.equal(count(html, oldEnhancements), 0);
});

test('projection browser stylesheet uses only the current cache version', () => {
  const ui = fs.readFileSync('experimental-ui-v03.js', 'utf8');
  assert.equal(count(ui, 'projection-browser-v01.css?v=0.2'), 1);
  assert.equal(count(ui, 'projection-browser-v01.css?v=0.1'), 0);
});
