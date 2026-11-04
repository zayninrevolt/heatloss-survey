const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`opens directly in the dark app shell with slow CSS at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      function recordFirstShellFrame() {
        const sidebar = document.querySelector('.sidebar');
        const tab = document.querySelector('.tab.active');
        if (sidebar && tab && sidebar.getClientRects().length) {
          window.firstShellFrame = {
            body: getComputedStyle(document.body).backgroundColor,
            sidebar: getComputedStyle(sidebar).backgroundColor,
            tab: getComputedStyle(tab).backgroundColor
          };
          return;
        }
        requestAnimationFrame(recordFirstShellFrame);
      }
      requestAnimationFrame(recordFirstShellFrame);
    });
    await page.route('**/combined-heatloss.css*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.firstShellFrame)).toEqual({
      body: 'rgb(23, 21, 18)',
      sidebar: 'rgb(36, 32, 28)',
      tab: 'rgb(243, 164, 119)'
    });
    await expect(page.locator('.sidebar')).toHaveCSS('background-color', 'rgb(36, 32, 28)');
  });
}

test('uses the shared warm dark app shell while preserving spreadsheet document colours', async ({ page }) => {
  await expect(page.locator('body')).toHaveClass(/app-shell-theme/);
  await expect(page.locator('.sidebar')).toHaveCSS('background-color', 'rgb(36, 32, 28)');
  await expect(page.locator('.tab.active')).toHaveCSS('background-color', 'rgb(243, 164, 119)');
  await expect(page.locator('.sheet').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.sheet .input').first()).toHaveCSS('background-color', 'rgb(255, 255, 102)');
  await expect(page.locator('.sheet .input').first()).toHaveCSS('color', 'rgb(17, 17, 17)');
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/app-shell-theme-desktop.png', fullPage: false });
});
