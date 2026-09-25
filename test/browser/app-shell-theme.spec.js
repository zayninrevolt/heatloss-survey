const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('uses the shared warm dark app shell while preserving spreadsheet document colours', async ({ page }) => {
  await expect(page.locator('body')).toHaveClass(/app-shell-theme/);
  await expect(page.locator('.sidebar')).toHaveCSS('background-color', 'rgb(36, 32, 28)');
  await expect(page.locator('.tab.active')).toHaveCSS('background-color', 'rgb(243, 164, 119)');
  await expect(page.locator('.sheet').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.sheet .input').first()).toHaveCSS('background-color', 'rgb(255, 255, 102)');
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/app-shell-theme-desktop.png', fullPage: false });
});
