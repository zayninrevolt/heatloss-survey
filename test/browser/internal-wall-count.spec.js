const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('wallCountTestStarted')) {
      localStorage.clear();
      sessionStorage.setItem('wallCountTestStarted', 'yes');
    }
  });
  await page.goto('/index.html');
  await page.locator('#radsTab').click();
  await page.locator('#rad_lounge_len').fill('4');
  await page.locator('#rad_lounge_wid').fill('3');
  await page.locator('#rad_lounge_outside').selectOption('1');
});

test('keeps all three suggested internal walls while entering their measurements', async ({ page }) => {
  const count = page.locator('#hl_lounge_internal_wall_count');
  await expect(count).toHaveValue('3');
  for (const [index, length] of [[1, '4'], [2, '3'], [3, '4']]) {
    await page.locator(`#hl_lounge_internal_segment_${index}_length`).fill(length);
    await page.locator(`#hl_lounge_internal_segment_${index}_adjacent_temp`).selectOption('18');
    await expect(count).toHaveValue('3');
    await expect(page.locator('#hl_lounge_internal_segment_3_wrap')).toBeVisible();
  }
  await page.reload();
  await page.locator('#radsTab').click();
  await expect(count).toHaveValue('3');
  await expect(page.locator('#hl_lounge_internal_segment_3_length')).toHaveValue('4');
});

test('accepts a manual internal-wall count on the first selection', async ({ page }) => {
  const count = page.locator('#hl_lounge_internal_wall_count');
  await page.locator('#hl_lounge_internal_segment_1_length').fill('4');
  await count.selectOption('3');
  await expect(count).toHaveValue('3');
  await expect(page.locator('#hl_lounge_internal_segment_3_wrap')).toBeVisible();
  await page.locator('#rad_lounge_outside').selectOption('2');
  await expect(count).toHaveValue('3');
  await count.selectOption('0');
  await expect(count).toHaveValue('0');
  await expect(page.locator('#hl_lounge_internal_segment_1_wrap')).toBeHidden();
  await page.reload();
  await page.locator('#radsTab').click();
  await expect(count).toHaveValue('0');
});
