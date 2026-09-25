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
  await page.locator('#radsTab').click();
  await page.evaluate(() => {
    const fields = {
      r_ceiling: '2.4', hl_outdoor_temp: '-3', hl_ground_temp: '10',
      hl_property_age_band: 'H', hl_ventilation_age_category: '',
      hl_bridge_method: 'Percentage', hl_reheat_factor: '1',
      hl_exposed_location: '1', hl_high_ceiling_factor: '1', hl_radiator_temperature: '55',
      rad_lounge_len: '4', rad_lounge_wid: '3', rad_lounge_outside: '1',
      hl_lounge_indoor_temp: '21', hl_lounge_internal_wall_count: '0',
      hl_lounge_wall_type: 'Cavity wall, insulated', hl_lounge_window_type: 'No windows',
      hl_lounge_window_count: '0', hl_lounge_door_type: 'No external door',
      hl_lounge_door_count: '0', hl_lounge_floor_type: 'Insulated solid ground floor',
      hl_lounge_loft_type: 'Plasterboard with 200mm insulation',
      hl_lounge_ventilation_mode: 'Automatic',
      hl_lounge_ventilation_device: 'No additional vent or flue'
    };
    for (const [id, value] of Object.entries(fields)) {
      const field = document.getElementById(id);
      if (!field) throw new Error(`Missing field ${id}`);
      field.value = value;
      if (field.value !== value) throw new Error(`Rejected field ${id}=${value}`);
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await expect(page.locator('#hl_room_navigator')).toBeVisible();
  const scrollRequest = await page.evaluate(() => {
    const navigator = document.getElementById('hl_room_navigator');
    window.__reducedMotionScroll = null;
    navigator.scrollIntoView = (options) => { window.__reducedMotionScroll = options; };
    document.querySelector('[data-room-completion-button="lounge"]').click();
    return window.__reducedMotionScroll;
  });
  expect(scrollRequest).toEqual({ behavior: 'auto', block: 'start' });
});
