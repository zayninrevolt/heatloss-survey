const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('saves and restores survey values', async ({ page }) => {
  const address = page.locator('#site_address');
  await address.fill('12 Test Street');
  await address.dispatchEvent('change');
  await page.reload();
  await expect(page.locator('#site_address')).toHaveValue('12 Test Street');
});

const sharedProfileFields = [
  {
    canonical: 'site_home',
    front: 'front_home',
    profile: 'p_home',
    value: '020 7946 0958'
  },
  {
    canonical: 'site_mobile',
    front: 'front_mobile',
    profile: 'p_mobile',
    value: '07700 900123'
  },
  {
    canonical: 'site_property_type',
    front: 'front_type',
    profile: 'p_property_type',
    value: 'Semi-detached'
  }
];

test('copies new main property details to hidden Front and Profile fields', async ({ page }) => {
  for (const field of sharedProfileFields) {
    await page.locator(`#${field.canonical}`).fill(field.value);
    await expect(page.locator(`#${field.front}`)).toHaveValue(field.value);
    await expect(page.locator(`#${field.profile}`)).toHaveValue(field.value);
  }
});

test('seeds new main property details from legacy Front values before Profile values', async ({ page }) => {
  const legacyData = Object.fromEntries(sharedProfileFields.flatMap((field) => [
    [field.front, `Front ${field.value}`],
    [field.profile, `Profile ${field.value}`]
  ]));
  await page.evaluate((data) => {
    localStorage.setItem('surveyWebData', JSON.stringify(data));
  }, legacyData);
  await page.reload();

  for (const field of sharedProfileFields) {
    const expected = `Front ${field.value}`;
    await expect(page.locator(`#${field.canonical}`)).toHaveValue(expected);
    await expect(page.locator(`#${field.front}`)).toHaveValue(expected);
    await expect(page.locator(`#${field.profile}`)).toHaveValue(expected);
  }
});

test('exports a JSON backup', async ({ page }) => {
  await page.locator('#site_address').fill('34 Export Road');
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => saveJson());
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^34 Export Road-\d{2}-\d{2}-\d{4}\.json$/);
  const content = await require('node:fs/promises').readFile(await download.path(), 'utf8');
  expect(JSON.parse(content).site_address).toBe('34 Export Road');
});

test('postcode lookup failure leaves manual temperatures usable', async ({ page }) => {
  await page.route('https://api.postcodes.io/**', route => route.abort());
  await page.locator('#site_postcode').fill('SW1A 1AA');
  await page.locator('#radsTab').click();
  await page.locator('#hl_lookup_postcode').click();
  await expect(page.locator('#hl_postcode_lookup_status')).toContainText(
    /could not|unavailable|check/i
  );
  await expect(page.locator('#hl_outdoor_temp')).toBeEditable();
});

test('print output contains the heat-loss sheet', async ({ page }) => {
  const html = await page.evaluate(() =>
    buildPrintHtml('Smoke test', ['Front', 'Rads'], 'portrait'));
  expect(html).toContain('Heat Loss');
  expect(html).toContain('Smoke test');
});
