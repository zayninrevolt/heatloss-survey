'use strict';
const { test, expect } = require('@playwright/test');
const { prepare, setFields } = require('../helpers/reference-natural-driver');

async function readings(page) {
  return page.evaluate(() => ({
    total: heatLossResultsV60.totalWatts,
    rooms: heatLossResultsV60.includedRooms.map(r => ({ name: r.roomName,
      ach: r.baseAch, standardAch: r.standardAch, ventilation: r.ventilationWatts,
      indoor: r.indoor, wallU: r.wallU, floorU: r.floorU, roofU: r.roofU,
      category: r.ventilationAgeCategory })),
    age: heatLossResultsV60.ventilationAge,
    provisional: heatLossResultsV60.provisional
  }));
}

test('an overlap-only year field resolves 1997 ventilation in the real calculation', async ({ page }) => {
  await prepare(page);
  await setFields(page, { hl_outdoor_temp: '-3', hl_ground_temp: '10' });
  await expect(page.locator('#hl_build_year')).toBeHidden();
  await page.locator('#hl_property_age_band').selectOption('I');
  await expect(page.getByLabel('Year built', { exact: true })).toBeVisible();
  await expect(page.locator('#hl_build_year')).toHaveAttribute('min', '1996');
  await expect(page.locator('#hl_build_year')).toHaveAttribute('max', '2002');
  const before = await readings(page);
  expect(before.rooms.map(r => r.ach)).toEqual([1, 1.5]);
  await page.locator('#hl_build_year').fill('1997');
  await page.locator('#hl_build_year').blur();
  const after = await readings(page);
  expect(after.rooms.map(r => r.ach)).toEqual([1.5, 2]);
  expect(after.age.source).toBe('build-year');
  expect(after.age.reviewRequired).toBe(false);
  expect(after.total - before.total).toBeCloseTo(0.33 * 28.8 * (0.5 * 24 + 0.5 * 21), 9);
  expect(after.rooms.map(({ indoor, wallU, floorU, roofU }) => ({ indoor, wallU, floorU, roofU })))
    .toEqual(before.rooms.map(({ indoor, wallU, floorU, roofU }) => ({ indoor, wallU, floorU, roofU })));
});

test('unresolved years preserve legacy totals but visibly mark the age assumption for review', async ({ page }) => {
  await prepare(page);
  await page.locator('#hl_property_age_band').selectOption('J');
  const before = await readings(page);
  await page.locator('#hl_build_year').fill('2006');
  const after = await readings(page);
  expect(after.total).toBe(before.total);
  expect(after.age.reviewRequired).toBe(true);
  expect(after.provisional).toBe(true);
  await expect(page.locator('#hl_build_year_status')).toContainText('overlaps at 2006');
  await expect(page.locator('#hl_property_detail')).toContainText('Provisional: confirm');
  const html = await page.evaluate(() => buildPrintHtml('Unresolved build year', ['Heat Loss'], 'portrait'));
  expect(html).toContain('Year built: 2006');
  expect(html).toContain('overlaps at 2006');
});

test('the year question appears only for overlapping automatic age bands', async ({ page }) => {
  await prepare(page);
  for (const band of ['Unknown', ...'ABCDEFGHIJKLM']) {
    await page.locator('#hl_property_age_band').selectOption(band);
    if (['I', 'J'].includes(band)) await expect(page.locator('#hl_build_year')).toBeVisible();
    else await expect(page.locator('#hl_build_year')).toBeHidden();
  }
  await page.locator('#hl_property_age_band').selectOption('J');
  await expect(page.locator('#hl_build_year')).toHaveAttribute('min', '2003');
  await expect(page.locator('#hl_build_year')).toHaveAttribute('max', '2006');
  await page.locator('#hl_calculation_assumptions > summary').click();
  await page.locator('#hl_ventilation_age_category').selectOption('2006+');
  await expect(page.locator('#hl_build_year')).toBeHidden();
  expect((await readings(page)).age.source).toBe('override');
});

test('year boundaries and explicit room overrides resolve independently', async ({ page }) => {
  await prepare(page);
  await page.locator('#hl_property_age_band').selectOption('I');
  for (const [year, ach] of [['1996', 1.5], ['1999', 1.5], ['2000', 1], ['2002', 1]]) {
    await page.locator('#hl_build_year').fill(year);
    expect((await readings(page)).rooms[0].ach).toBe(ach);
  }
  await page.locator('#hl_lounge_ventilation_mode').selectOption('Manual override');
  await page.locator('#hl_lounge_manual_ach').fill('0.8');
  await page.locator('#hl_build_year').fill('1997');
  expect((await readings(page)).rooms[0].ach).toBe(0.8);
  await page.locator('#hl_calculation_assumptions > summary').click();
  await page.locator('#hl_ventilation_age_category').selectOption('2006+');
  await expect(page.locator('#hl_build_year')).toBeHidden();
  const overridden = await readings(page);
  expect(overridden.rooms[0].ach).toBe(0.8);
  expect(overridden.rooms[1].ach).toBe(0.5);
  await page.locator('#hl_ventilation_age_category').selectOption('');
  await expect(page.locator('#hl_build_year')).toBeVisible();
  expect((await readings(page)).rooms[1].ach).toBe(2);
});

test('year resolution survives reload and JSON round trip while legacy surveys keep their old reading', async ({ page }) => {
  await prepare(page);
  await page.locator('#hl_property_age_band').selectOption('I');
  const legacyReading = await readings(page);
  await page.locator('#hl_build_year').fill('1997');
  await page.locator('#hl_build_year').blur();
  const recorded = await readings(page);
  const snapshot = await page.evaluate(() => getData());
  expect(snapshot.hl_build_year).toBe('1997');
  await page.reload();
  await page.locator('#radsTab').click();
  await expect(page.locator('#hl_build_year')).toHaveValue('1997');
  expect((await readings(page)).total).toBe(recorded.total);
  await page.evaluate(snapshot => {
    const parsed = parseSurveyBackup(JSON.stringify(snapshot));
    setData(parsed.data);
    update();
  }, snapshot);
  expect((await readings(page)).total).toBe(recorded.total);
  const legacy = { ...snapshot };
  delete legacy.hl_build_year;
  await page.evaluate(legacy => { setData(legacy); update(); }, legacy);
  await expect(page.locator('#hl_build_year')).toHaveValue('');
  const restoredLegacy = await readings(page);
  expect(restoredLegacy.total).toBe(legacyReading.total);
  expect(restoredLegacy.age.reviewRequired).toBe(true);
  expect(restoredLegacy.provisional).toBe(true);
});

test('a hidden stale year cannot change another band and year entry preserves manual temperatures', async ({ page }) => {
  await prepare(page);
  await page.locator('#hl_property_age_band').selectOption('I');
  await page.locator('#hl_lounge_indoor_temp').selectOption('20');
  await page.locator('#hl_build_year').fill('1997');
  expect((await readings(page)).rooms[0].indoor).toBe(20);
  await page.locator('#hl_property_age_band').selectOption('K');
  await expect(page.locator('#hl_build_year')).toBeHidden();
  const newer = await readings(page);
  expect(newer.rooms[0].indoor).toBe(20);
  expect(newer.rooms.map(r => r.ach)).toEqual([0.5, 0.5]);
  expect(newer.age.source).toBe('age-band');
  expect(newer.age.buildYear).toBe(null);
  await page.locator('#hl_property_age_band').selectOption('J');
  await expect(page.locator('#hl_build_year')).toBeVisible();
  await expect(page.locator('#hl_build_year')).toHaveAttribute('aria-invalid', 'true');
  expect((await readings(page)).rooms[0].ach).toBe(1);
});

test('out-of-band and fractional years leave figures unchanged and request review', async ({ page }) => {
  await prepare(page);
  await page.locator('#hl_property_age_band').selectOption('I');
  const baseline = await readings(page);
  for (const year of ['1900', '2023', '1997.5']) {
    await page.locator('#hl_build_year').fill(year);
    await expect(page.locator('#hl_build_year')).toHaveAttribute('aria-invalid', 'true');
    const current = await readings(page);
    expect(current.total).toBe(baseline.total);
    expect(current.age.source).toBe('legacy-band-assumption');
    expect(current.age.reviewRequired).toBe(true);
  }
});

test('the independent reference route is not disabled by an unconfirmed legacy ventilation age', async ({ page }) => {
  await prepare(page);
  await page.locator('#hl_property_age_band').selectOption('I');
  const before = await page.evaluate(() => window.referenceNaturalCheckV1);
  expect(before.available, before.reason).toBe(true);
  await expect(page.locator('#hl_property_detail')).not.toContainText('0 incomplete');
  await page.locator('#hl_build_year').fill('1997');
  const after = await page.evaluate(() => window.referenceNaturalCheckV1);
  expect(after.available, after.reason).toBe(true);
  expect(after.result).toEqual(before.result);
});

test('the real heat-loss PDF records the selected year and ventilation basis without orphan pages', async ({ page }, testInfo) => {
  const { chromiumPdfPages } = require('../helpers/chromium-pdf.cjs');
  await prepare(page);
  await page.locator('#hl_property_age_band').selectOption('I');
  await page.locator('#hl_build_year').fill('1997');
  const before = await readings(page);
  const html = await page.evaluate(() => buildPrintHtml('Year-built verification', ['Heat Loss'], 'portrait'));
  const print = await page.context().newPage();
  await print.setContent(html, { waitUntil: 'load' });
  await print.evaluate(() => document.fonts.ready);
  await expect(print.locator('#heatLossAssumptionsSheetV61')).toContainText('Year built: 1997');
  await expect(print.locator('#heatLossAssumptionsSheetV61')).toContainText('pre-2000 (from year built 1997)');
  const pdf = await print.pdf({ path: testInfo.outputPath('year-built-1997.pdf'), printBackground: true, preferCSSPageSize: true });
  const pages = chromiumPdfPages(pdf);
  expect(pages.length).toBeGreaterThan(1);
  expect(pages.filter(p => p.textRuns <= 1 && p.textCodes <= 40)).toEqual([]);
  expect((await readings(page)).total).toBe(before.total);
});
