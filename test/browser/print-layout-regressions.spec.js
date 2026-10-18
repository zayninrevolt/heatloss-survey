const { test, expect } = require('@playwright/test');
const { chromiumPdfPages } = require('../helpers/chromium-pdf.cjs');

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('cover is previewed without a photo and has its own portrait PDF option', async ({ page }, testInfo) => {
  await expect(page.locator('#preview .report-cover')).toBeVisible();
  await expect(page.locator('#preview .report-cover-photo-placeholder')).toBeVisible();
  await page.getByLabel('Company name (optional)', { exact: true }).fill('Synthetic Cover Company');
  await expect(page.locator('#preview .report-cover-company')).toHaveText('Synthetic Cover Company');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Save PDFs', exact: true }).click();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Save cover PDF', exact: true }).click();
  const print = await popup;
  await print.waitForLoadState('load');
  await expect(print.locator('.report-cover')).toHaveCount(1);
  await expect(print.locator('.report-cover-company')).toHaveText('Synthetic Cover Company');
  await expect(print.locator('.sheet-wrap')).toHaveCount(0);
  const pages = chromiumPdfPages(await print.pdf({ path: testInfo.outputPath('cover-only.pdf'), preferCSSPageSize: true, printBackground: true }));
  expect(pages).toHaveLength(1);
  expect(pages[0].width).toBeCloseTo(595.28, 0);
  expect(pages[0].height).toBeCloseTo(841.89, 0);
});

test('native browser print uses portrait cover, landscape report and portrait H&S pages', async ({ page }, testInfo) => {
  await page.getByLabel('Company name (optional)', { exact: true }).fill('Synthetic Native Print Company');
  const before = await page.evaluate(() => JSON.stringify(window.heatLossResultsV60));
  const pdf = await page.pdf({ path: testInfo.outputPath('native-browser-print.pdf'), preferCSSPageSize: true, printBackground: true });
  const pages = chromiumPdfPages(pdf);
  expect(pages[0].width).toBeCloseTo(595.28, 0);
  expect(pages[0].height).toBeCloseTo(841.89, 0);
  expect(pages.some(p => p.width > p.height)).toBe(true);
  for (const p of pages) {
    expect(Math.min(p.width, p.height)).toBeCloseTo(595.28, 0);
    expect(Math.max(p.width, p.height)).toBeCloseTo(841.89, 0);
    expect(p.textCodes).toBeGreaterThan(40);
  }
  // Cover plus A12a and Customer Profile, not an orphan profile-heading page.
  expect(pages.filter(p => p.height > p.width)).toHaveLength(3);
  expect(await page.evaluate(() => JSON.stringify(window.heatLossResultsV60))).toBe(before);
  await testInfo.attach('native-print-page-sizes', { body: JSON.stringify(pages, null, 2), contentType: 'application/json' });
});

test('H&S PDF keeps the customer profile heading with its table without oversized signature gaps', async ({ page }, testInfo) => {
  await page.locator('#site_address').fill('12 Synthetic Profile Road');
  await page.locator('#site_address').dispatchEvent('change');
  await page.locator('#site_customer').fill('Synthetic Customer');
  await page.locator('#site_customer').dispatchEvent('change');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Save PDFs', exact: true }).click();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Save H&S PDF', exact: true }).click();
  const print = await popup;
  await print.waitForLoadState('load');
  await expect(print.locator('.sheet.profile')).toContainText('12 Synthetic Profile Road');
  await expect(print.locator('.sheet.profile')).toContainText('Synthetic Customer');
  await print.emulateMedia({ media: 'print' });
  const signatures = await print.locator('.sheet.profile .signature-placeholder').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().height));
  const pdf = await print.pdf({ path: testInfo.outputPath('customer-profile-corrected.pdf'), preferCSSPageSize: true, printBackground: true });
  const pages = chromiumPdfPages(pdf);
  expect(pages).toHaveLength(2);
  expect(pages.every(p => p.height > p.width && p.textCodes > 100)).toBe(true);
  expect(signatures).toHaveLength(2);
  expect(signatures.every(height => height <= 36)).toBe(true);
  await expect(print.locator('.report-cover')).toHaveCount(0);
});
