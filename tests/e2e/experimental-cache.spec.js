const { test, expect } = require('@playwright/test');

test('experimental UI scripts load once with current versioned URLs', async ({ page }) => {
  await page.goto('/');
  const sources = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
  expect(sources.filter(src => src === 'experimental-ui-v03.js?v=0.3.4')).toHaveLength(1);
  expect(sources.filter(src => src === 'experimental-ui-v03-enhancements.js?v=0.3.3')).toHaveLength(1);
  expect(sources.filter(src => src === 'experimental-ui-v03.js?v=0.3.3')).toHaveLength(0);
});
