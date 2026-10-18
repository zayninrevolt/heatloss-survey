'use strict';
const { test, expect } = require('@playwright/test');
const { prepare, setFields } = require('../helpers/reference-natural-driver');
const { chromiumPdfPages } = require('../helpers/chromium-pdf.cjs');

function noHeadingOnlyPages(pages) {
  expect(pages.length).toBeGreaterThan(1);
  const orphans = pages.map((page, index) => ({ page: index + 1, ...page }))
    .filter(page => page.textRuns <= 1 && page.textCodes <= 40);
  expect(orphans, 'A report page must not contain just a heading or be empty').toEqual([]);
}

async function exportThroughMenu(page, buttonName) {
  page.on('dialog', dialog => dialog.accept()); // synthetic, incomplete front sheet
  await page.getByRole('button', { name: 'Save PDFs', exact: true }).click();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const print = await popup;
  await print.waitForLoadState('load');
  await print.evaluate(() => document.fonts.ready);
  return print;
}

async function verifySurvey(page) {
  const result = await page.evaluate(() => ({
    included: window.heatLossResultsV60.includedRooms.length,
    total: window.heatLossResultsV60.totalWatts,
    legacy: JSON.stringify(window.heatLossResultsV60)
  }));
  expect(result.included).toBeGreaterThanOrEqual(2);
  expect(result.total).toBeGreaterThan(1000); // do not compare zero/incomplete rooms
  return result.legacy;
}

async function assertUnchanged(page, before) {
  expect(await page.evaluate(() => JSON.stringify(window.heatLossResultsV60))).toBe(before);
}

test('landscape survey PDF never orphans the heat-loss assumptions heading', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  const before = await verifySurvey(page);
  const print = await exportThroughMenu(page, 'Save Front + Rads + Heat Loss PDF');
  await expect(print.locator('#heatLossAssumptionsSheetV61')).toContainText('Survey disclaimer:');
  const pdf = await print.pdf({ path: testInfo.outputPath('survey.pdf'), printBackground: true,
    preferCSSPageSize: true });
  const pages = chromiumPdfPages(pdf);
  await testInfo.attach('pdf-page-metrics', { body: JSON.stringify(pages, null, 2), contentType: 'application/json' });
  // The approved report now always starts with a portrait cover; its body
  // remains landscape and still must not orphan any assumptions heading.
  expect(pages[0].height).toBeGreaterThan(pages[0].width);
  await expect(print.locator('.report-cover')).toHaveCount(1);
  expect(pages.slice(1).every(page => page.width > page.height)).toBe(true);
  noHeadingOnlyPages(pages);
  await assertUnchanged(page, before);
  expect(errors).toEqual([]);
});

test('portrait heat-loss PDF keeps its heading with assumptions and preserves shared records', async ({ page }, testInfo) => {
  await prepare(page);
  await setFields(page, { hl_ventilation_storeys: '2', hl_lounge_loft_type: 'Heated room above',
    hl_kitchen_floor_type: 'Heated room below' });
  await page.evaluate(() => {
    document.getElementById('hl_interstorey_interfaces').value = JSON.stringify([
      { upperRoom: 'kitchen', lowerRoom: 'lounge', area: 12, construction: '100mm insulation' }
    ]);
    update();
  });
  const before = await verifySurvey(page);
  const reference = await page.evaluate(() => window.referenceNaturalCheckV1);
  expect(reference.available, reference.reason).toBe(true);
  const html = await page.evaluate(() => buildPrintHtml('Print pagination regression', ['Heat Loss'], 'portrait'));
  const print = await page.context().newPage();
  await print.setContent(html, { waitUntil: 'load' });
  await print.evaluate(() => document.fonts.ready);
  await expect(print.locator('#heatLossAssumptionsSheetV61')).toContainText('12.00 m², 100mm insulation');
  const pdf = await print.pdf({ path: testInfo.outputPath('heat-loss-portrait.pdf'),
    printBackground: true, preferCSSPageSize: true });
  const pages = chromiumPdfPages(pdf);
  expect(pages.every(page => page.height > page.width)).toBe(true);
  noHeadingOnlyPages(pages);
  await assertUnchanged(page, before);
});

test('long room assumptions paginate without a detached heading or missing room rows', async ({ page }, testInfo) => {
  // Eight recorded rooms plus a real PDF export cannot fit the repository's
  // default 30 s budget on a slower CI runner (measured 22 s locally, exceeded
  // on GitHub Actions). This is a scoped allowance for this heavy case only;
  // the global test timeout is unchanged and the assertions are untouched.
  test.setTimeout(120_000);
  await prepare(page);
  const fields = require('../fixtures/reference-natural-survey.json');
  const keys = await page.evaluate(() => allRoomNames().map(roomKeyFromName).slice(0, 8));
  for (const key of keys.filter(key => key !== 'lounge' && key !== 'kitchen')) {
    const values = {};
    for (const [id, value] of Object.entries(fields)) {
      if (id.startsWith('hl_lounge_') || id.startsWith('rad_lounge_')) {
        values[id.replace('_lounge_', '_' + key + '_')] = value;
      }
    }
    values['hl_' + key + '_internal_wall_count'] = '0';
    await setFields(page, values);
  }
  const before = await verifySurvey(page);
  const names = await page.evaluate(() => window.heatLossResultsV60.includedRooms.map(room => room.roomName));
  expect(names).toHaveLength(8);
  const print = await exportThroughMenu(page, 'Save Front + Rads + Heat Loss PDF');
  for (const name of names) {
    await expect(print.locator('#heatLossAssumptionsSheetV61 .heatloss-assumptions-sheet')).toContainText(name);
  }
  const pdf = await print.pdf({ path: testInfo.outputPath('long-survey.pdf'), printBackground: true,
    preferCSSPageSize: true });
  const pages = chromiumPdfPages(pdf);
  noHeadingOnlyPages(pages);
  await assertUnchanged(page, before);
});

test('the separate health-and-safety PDF retains its portrait print layout', async ({ page }, testInfo) => {
  await prepare(page);
  const before = await verifySurvey(page);
  const print = await exportThroughMenu(page, 'Save H&S PDF');
  const pdf = await print.pdf({ path: testInfo.outputPath('health-and-safety.pdf'), printBackground: true,
    preferCSSPageSize: true });
  const pages = chromiumPdfPages(pdf);
  expect(pages.every(page => page.height > page.width)).toBe(true);
  await expect(print.locator('#heatLossAssumptionsSheetV61')).toHaveCount(0);
  await assertUnchanged(page, before);
});
