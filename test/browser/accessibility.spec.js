const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('provides keyboard skip navigation and a sequential heading outline', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.locator('.skip-link')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#preview')).toBeFocused();

  const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((elements) =>
    elements.filter((element) => element.offsetParent !== null).map((element) => element.tagName),
  );
  expect(headings.slice(0, 3)).toEqual(['H1', 'H2', 'H2']);
  expect(headings.every((tag, index) => index === 0 || Number(tag.slice(1)) <= Number(headings[index - 1].slice(1)) + 1)).toBe(true);
});

test('keeps keyboard focus inside each modal and restores it after Escape', async ({ page }) => {
  await page.locator('#savePdfsBtn').click();
  const pdf = page.locator('#pdfPanel');
  const pdfButtons = pdf.locator('button');
  await expect(pdfButtons.nth(0)).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(pdfButtons.nth(0)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(pdfButtons.nth(2)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#savePdfsBtn')).toBeFocused();

  await page.locator('#moreToggleV58').click();
  await page.locator('#clearFormBtn').click();
  const clear = page.locator('#clearConfirmPanel');
  const clearButtons = clear.locator('button');
  await expect(clearButtons.nth(1)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(clearButtons.nth(0)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(clear).toHaveAttribute('aria-hidden', 'true');

  await page.locator('#surveyListBtnV57').click();
  const surveys = page.locator('#surveyPanelV57');
  const surveyButtons = surveys.locator('button');
  await expect(surveyButtons.nth(0)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(surveyButtons.last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#surveyPanelV57')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#surveyListBtnV57')).toBeFocused();
});

test('uses non-animated room navigation when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const scrollRequest = await page.evaluate(() => {
    const navigator = document.createElement('nav');
    navigator.id = 'hl_room_navigator';
    window.__reducedMotionScroll = null;
    navigator.scrollIntoView = (options) => { window.__reducedMotionScroll = options; };
    document.body.appendChild(navigator);

    const completionField = document.createElement('input');
    completionField.id = 'rad_motion_test_completed';
    document.body.appendChild(completionField);
    window.completeRadiatorRoom('motion_test');

    navigator.remove();
    completionField.remove();
    return window.__reducedMotionScroll;
  });
  expect(scrollRequest).toEqual({ behavior: 'auto', block: 'start' });
});
