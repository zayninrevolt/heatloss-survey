'use strict';
const { test, expect } = require('@playwright/test');
const { prepare, setFields } = require('../helpers/reference-natural-driver');
const presets = [
  ['Brick, unfilled cavity, brick + plaster', 1.49],
  ['Brick, filled cavity, brick + plaster (50mm mineral wool)', 0.52]
];
const room = page => page.evaluate(() => window.heatLossResultsV60.includedRooms.find(r => r.key === 'lounge'));

for (const [label, u] of presets) test('brick cavity wall preset calculates and round-trips: ' + label, async ({ page, browser }, info) => {
  await prepare(page);
  const originalData = await page.evaluate(() => getData());
  const originalResult = await page.evaluate(() => JSON.stringify(window.heatLossResultsV60));
  const baseline = await room(page);
  expect(baseline.wallLength).toBeGreaterThan(0);
  // Selection must be genuinely offered and accepted, not silently ignored.
  await expect(page.locator('#hl_lounge_wall_type option').filter({ hasText: label })).toHaveCount(1);
  await setFields(page, { hl_lounge_wall_type: label });
  const changed = await room(page);
  expect(changed.wallType).toBe(label); expect(changed.wallU).toBe(u);
  const opaqueArea = baseline.wallLength * baseline.height - baseline.windowArea - baseline.doorArea;
  expect(opaqueArea).toBeGreaterThan(0);
  const delta = (u - baseline.wallU) * opaqueArea * (baseline.indoor - baseline.outdoor);
  expect(changed.fabricWatts - baseline.fabricWatts).toBeCloseTo(delta, 8);
  expect(changed.ventilationWatts).toBe(baseline.ventilationWatts);
  expect(changed.bridgeWatts).toBe(baseline.bridgeWatts);
  expect(changed.totalWatts - baseline.totalWatts).toBeCloseTo(delta, 8);
  const data = await page.evaluate(() => getData());
  const result = await page.evaluate(() => JSON.stringify(window.heatLossResultsV60));
  await page.reload();
  expect(await page.evaluate(() => getData())).toEqual(data);
  expect(await page.evaluate(() => JSON.stringify(window.heatLossResultsV60))).toBe(result);
  const downloading = page.waitForEvent('download'); await page.evaluate(() => saveJson());
  const file = info.outputPath('brick-cavity-survey.json'); await (await downloading).saveAs(file);
  const context = await browser.newContext(), other = await context.newPage();
  await other.goto(page.url()); await other.locator('#loadFile').setInputFiles(file);
  await expect(other.locator('#appStatusMessage')).toHaveText('Survey backup imported.');
  expect(await other.evaluate(() => getData())).toEqual(data);
  expect(await other.evaluate(() => JSON.stringify(window.heatLossResultsV60))).toBe(result);
  other.on('dialog', d => d.accept());
  await other.getByRole('button', { name: 'Save PDF', exact: true }).click();
  const opening = other.waitForEvent('popup'); await other.getByRole('button', { name: 'Save report PDF', exact: true }).click();
  const print = await opening; await print.waitForLoadState('load');
  const wallCell = print.locator('#heatLossAssumptionsSheetV61 tr').filter({ has: print.locator('td b', { hasText: /^Lounge$/ }) }).locator('td').nth(1);
  await expect(wallCell).toContainText(label); await expect(wallCell).toContainText(u.toFixed(2) + ' W/m²K');
  await expect(wallCell).toContainText('Open University');
  await expect(wallCell).toContainText('115mm brick leaves');
  if (u === 0.52) await expect(wallCell).toContainText('50mm mineral wool');
  await print.pdf({ path: info.outputPath('brick-cavity-report.pdf'), printBackground: true, preferCSSPageSize: true });
  await context.close();
  // Returning to the pre-existing selection reproduces every prior figure exactly.
  await page.evaluate(data => setData(data), originalData);
  expect(await page.evaluate(() => getData())).toEqual(originalData);
  expect(await page.evaluate(() => JSON.stringify(window.heatLossResultsV60))).toBe(originalResult);
});

test('both brick cavity presets are available as property defaults and propagate to all rooms', async ({ page }) => {
  await prepare(page);
  page.on('dialog', dialog => dialog.accept());
  for (const [label, u] of presets) {
    await expect(page.locator('#hl_default_wall option').filter({ hasText: label })).toHaveCount(1);
    await setFields(page, { hl_default_wall: label });
    await page.evaluate(() => document.getElementById('hl_apply_defaults').click());
    const values = await page.evaluate(() => allRoomNames().map(name => document.getElementById('hl_' + roomKeyFromName(name) + '_wall_type').value));
    expect(values.length).toBeGreaterThan(1); expect(values.every(value => value === label)).toBe(true);
    expect((await room(page)).wallU).toBe(u);
  }
});
