const { test, expect } = require('@playwright/test');
const { chromiumPdfPages } = require('../helpers/chromium-pdf.cjs');
const sectionOrder = ['Heating survey report', 'Front', 'Rads', 'Heat Loss', 'Heat Loss', 'A12a', 'Customer Profile'];

function headingsIn(container) {
  return container.evaluate(element => Array.from(element.children, section => section.querySelector('h2')?.textContent.trim()).filter(Boolean));
}

test('one complete PDF and its preview use cover, survey, H&S, then profile with mixed orientations', async ({ page }, testInfo) => {
  await page.goto('/index.html');
  await page.getByLabel('Company name (optional)', { exact: true }).fill('Synthetic Complete Report Ltd');
  await page.locator('#site_address').fill('12 Synthetic Complete Report Road');
  await page.locator('#site_address').dispatchEvent('change');
  await expect(page.locator('#preview .report-cover')).toBeVisible();
  expect(await headingsIn(page.locator('#preview'))).toEqual(sectionOrder);
  const before = await page.evaluate(() => getData());
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.getByRole('button', { name: 'Save PDF', exact: true }).click();
  await expect(page.locator('#pdfPanel button')).toHaveText(['Save report PDF', 'Close']);
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Save report PDF', exact: true }).click();
  const print = await popup;
  await print.waitForLoadState('load');
  expect(await headingsIn(print.locator('main'))).toEqual(sectionOrder);
  await expect(print.locator('.report-cover')).toHaveCount(1);
  await expect(print.locator('.report-cover-company')).toHaveText('Synthetic Complete Report Ltd');
  await expect(print.locator('.sheet.profile')).toContainText('12 Synthetic Complete Report Road');
  expect(dialogs.join('\n')).toContain('Tenant signature');
  expect(dialogs.join('\n')).toContain('Surveyor signature');
  const pdf = await print.pdf({ path: testInfo.outputPath('complete-report.pdf'), printBackground: true, preferCSSPageSize: true });
  const pages = chromiumPdfPages(pdf);
  expect(pages.length).toBeGreaterThan(4);
  expect(pages[0].height).toBeGreaterThan(pages[0].width);
  expect(pages.slice(1, -2).every(p => p.width > p.height)).toBe(true);
  expect(pages.slice(-2).every(p => p.height > p.width)).toBe(true);
  for (const p of pages) {
    expect(Math.min(p.width, p.height)).toBeCloseTo(595.28, 0);
    expect(Math.max(p.width, p.height)).toBeCloseTo(841.89, 0);
    expect(p.textCodes).toBeGreaterThan(40);
  }
  expect(await page.evaluate(() => getData())).toEqual(before);
  await testInfo.attach('complete-report-page-metrics', { body: JSON.stringify(pages, null, 2), contentType: 'application/json' });
});
