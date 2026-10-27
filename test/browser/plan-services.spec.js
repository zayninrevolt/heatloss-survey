const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { point, tap, options, back } = require('../helpers/floor-plan-driver');
const { chromiumPdfPages } = require('../helpers/chromium-pdf.cjs');
const symbols = [['boiler', 'Boiler'], ['gas-meter', 'Gas meter'], ['stop-tap', 'Stop tap'], ['electric-meter', 'Electric meter']];
async function rectangle(page) {
  await page.goto('/index.html');
  await page.getByRole('tab', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
}
async function add(page, label, x, y) {
  await page.getByRole('button', { name: 'Add service symbol', exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await tap(page, x, y);
}

test('all four service symbols can be placed with a matching key underneath the layout', async ({ page }, info) => {
  await rectangle(page);
  const before = await page.evaluate(() => getData());
  for (const [i, [type, label]] of symbols.entries()) {
    await add(page, label, 112 + i * 120, 176);
    await expect(page.locator('#houseLayoutSvg [data-service-symbol="' + type + '"]')).toHaveCount(1);
    await expect(page.getByRole('group', { name: 'Layout symbol key', exact: true })).toContainText(label);
  }
  const key = await page.locator('#layoutServiceKey').boundingBox(), stage = await page.locator('#layoutStage').boundingBox();
  expect(key.y).toBeGreaterThanOrEqual(stage.y + stage.height);
  const after = await page.evaluate(() => getData());
  const f = JSON.parse(after.house_layout).floors[0];
  expect(f.services.map(s => s.type)).toEqual(symbols.map(s => s[0]));
  expect(f.services.map(s => s.point)).toEqual([[14,22],[29,22],[44,22],[59,22]]);
  delete before.house_layout; delete after.house_layout;
  expect(after).toEqual(before);
  await page.screenshot({ path: info.outputPath('layout-services.png') });
});

test('service symbols drag, reposition, remove and Undo without changing survey measurements', async ({ page }) => {
  await rectangle(page);
  await add(page, 'Boiler', 112, 176);
  const id = JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].services[0].id;
  const a = await point(page, 112, 176), b = await point(page, 280, 208);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
  const moved = JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].services[0];
  expect(moved).toEqual({ id, type: 'boiler', point: [35, 26] });
  await tap(page, 280, 208);
  await page.getByRole('button', { name: 'Reposition symbol', exact: true }).click();
  await tap(page, 400, 320);
  const raw = await page.locator('#house_layout').inputValue();
  expect(JSON.parse(raw).floors[0].services[0]).toEqual({ id, type: 'boiler', point: [50, 40] });
  await tap(page, 400, 320);
  await page.getByRole('button', { name: 'Remove symbol', exact: true }).click();
  await expect(page.locator('#houseLayoutSvg [data-plan-service]')).toHaveCount(0);
  await page.locator('#layoutUndo').click();
  expect(await page.locator('#house_layout').inputValue()).toBe(raw);
});

test('service symbols and their key survive JSON reload, PNG export and the portrait PDF', async ({ page, browser }, info) => {
  test.setTimeout(180000);
  const { realisticSurvey } = require('../helpers/realistic-two-storey-driver');
  await realisticSurvey(page);
  const calculations = await page.evaluate(() => JSON.stringify(window.heatLossResultsV60));
  await page.getByRole('tab', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  for (const [i, [, label]] of symbols.entries()) await add(page, label, 112 + i * 120, 176);
  await page.locator('#layoutFloor').selectOption('first');
  await page.getByRole('button', { name: 'L-shaped floor', exact: true }).click();
  await add(page, 'Stop tap', 240, 200);
  expect(await page.evaluate(() => JSON.stringify(window.heatLossResultsV60))).toBe(calculations);
  await options(page); await page.locator('#layoutInclude').check();
  await expect(page.locator('#preview [data-service-key]')).toHaveCount(2);
  const png = page.waitForEvent('download'); await page.locator('#layoutSaveImage').click();
  const pngPath = info.outputPath('services-with-key.png'); await (await png).saveAs(pngPath);
  const bytes = await fs.readFile(pngPath);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(20)).toBe(1040);
  const downloading = page.waitForEvent('download'); await page.evaluate(() => saveJson());
  const file = info.outputPath('services-survey.json'); await (await downloading).saveAs(file);
  const raw = await page.locator('#house_layout').inputValue(); await page.reload();
  expect(await page.locator('#house_layout').inputValue()).toBe(raw);
  const context = await browser.newContext(), other = await context.newPage();
  await other.goto(page.url()); await other.locator('#loadFile').setInputFiles(file);
  await expect(other.locator('#appStatusMessage')).toHaveText('Survey backup imported.');
  expect(await other.locator('#house_layout').inputValue()).toBe(raw);
  other.on('dialog', d => d.accept());
  await other.getByRole('button', { name: 'Save PDF', exact: true }).click();
  const opening = other.waitForEvent('popup'); await other.getByRole('button', { name: 'Save report PDF', exact: true }).click();
  const print = await opening; await print.waitForLoadState('load');
  await expect(print.locator('[data-service-symbol]')).toHaveCount(5);
  await expect(print.locator('[data-service-key]')).toHaveCount(2);
  for (const [, label] of symbols) await expect(print.locator('[data-service-key]').first()).toContainText(label);
  const pages = chromiumPdfPages(await print.pdf({ path: info.outputPath('services-report.pdf'), printBackground: true, preferCSSPageSize: true }));
  await print.locator('.layout-sheet-wrap').screenshot({ path: info.outputPath('services-layout-print.png') });
  expect(pages.at(-3).width).toBeCloseTo(595, 0); expect(pages.at(-3).height).toBeCloseTo(842, 0);
  await print.locator('.layout-sheet-wrap').evaluateAll(nodes => nodes.forEach(n => n.remove()));
  const baseline = chromiumPdfPages(await print.pdf({ printBackground: true, preferCSSPageSize: true }));
  expect(pages).toHaveLength(baseline.length + 1);
  expect(await page.evaluate(() => JSON.stringify(window.heatLossResultsV60))).toBe(calculations);
  await context.close();
});

test('keyboard can place a service symbol, nudge it and open its options', async ({ page }) => {
  await rectangle(page);
  await page.locator('#layoutAddService').focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Stop tap', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const marker = page.locator('#houseLayoutSvg [data-plan-service]');
  await expect(marker).toHaveCount(1); await expect(marker).toBeFocused();
  const before = JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].services[0];
  await page.keyboard.press('ArrowRight');
  const after = JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].services[0];
  expect(after).toEqual({ ...before, point: [before.point[0] + 1, before.point[1]] });
  await expect(marker).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.locator('#layoutSheetTitle')).toHaveText('Stop tap position');
});

for (const route of ['button', 'escape', 'back', 'import']) test('cancel service placement safely using ' + route, async ({ page }) => {
  await rectangle(page); const before = await page.locator('#house_layout').inputValue();
  await page.locator('#layoutAddService').click(); await page.getByRole('button', { name: 'Gas meter', exact: true }).click();
  if (route === 'button') await page.locator('#layoutDone').click();
  else if (route === 'escape') await page.keyboard.press('Escape');
  else if (route === 'back') { await back(page); await page.getByRole('tab', { name: 'Layout', exact: true }).click(); }
  else await page.evaluate(() => setData(getData()));
  await expect(page.locator('#layoutDone')).toBeHidden();
  await expect(page.locator('#layoutFloor')).toBeEnabled();
  expect(await page.locator('#house_layout').inputValue()).toBe(before);
  await add(page, 'Boiler', 240, 200);
  expect(JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].services.map(s => s.type)).toEqual(['boiler']);
});

test('replacing an outline explicitly clears service symbols and Undo restores them', async ({ page }) => {
  await rectangle(page); await add(page, 'Gas meter', 16, 240);
  const before = await page.locator('#house_layout').inputValue();
  await options(page); await page.locator('#layoutOutlineOptions').click();
  const prompt = page.waitForEvent('dialog'); const replacing = page.locator('#layoutCreateOutline').click();
  const dialog = await prompt; expect(dialog.message()).toContain('service symbols'); await dialog.accept(); await replacing;
  await expect(page.locator('#houseLayoutSvg [data-plan-service]')).toHaveCount(0);
  await page.locator('#layoutUndo').click(); expect(await page.locator('#house_layout').inputValue()).toBe(before);
});

test('invalid service imports reject atomically and do not alter any survey field', async ({ page }) => {
  await rectangle(page); await add(page, 'Boiler', 240, 200);
  const before = await page.evaluate(() => getData()), p = JSON.parse(before.house_layout);
  p.floors[0].services[0].type = '<svg onload=alert(1)>';
  const alerted = page.waitForEvent('dialog');
  await page.locator('#loadFile').setInputFiles({ name: 'unsafe-service.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...before, site_address: 'Must not apply', house_layout: JSON.stringify(p) })) });
  const dialog = await alerted; expect(dialog.message()).toContain('Could not import'); await dialog.dismiss();
  expect(await page.evaluate(() => getData())).toEqual(before);
});

test.describe('service touch gestures', () => {
  test.use({ hasTouch: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) test('visible service drop and key fit ' + viewport.width + 'x' + viewport.height, async ({ page }, info) => {
    await page.setViewportSize(viewport); await rectangle(page); await add(page, 'Electric meter', 240, 200);
    const before = await page.locator('#house_layout').inputValue(), a = await point(page, 240, 200), aim = await point(page, 400, 240), c = await page.context().newCDPSession(page);
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 0 }] });
    await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: aim.x, y: aim.y + 72, id: 0 }] });
    expect(await page.locator('#house_layout').inputValue()).toBe(before);
    const centre = () => page.locator('#houseLayoutSvg [data-plan-service]').evaluate(e => { const p = new DOMPoint(0, 0).matrixTransform(e.getScreenCTM()); return { x: p.x, y: p.y }; });
    const visible = await centre(); expect(visible.x).toBeCloseTo(aim.x, 1); expect(visible.y).toBeCloseTo(aim.y, 1);
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const saved = await centre(); expect(saved.x).toBeCloseTo(visible.x, 4); expect(saved.y).toBeCloseTo(visible.y, 4);
    expect(JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].services[0].point).toEqual([50, 30]);
    const key = await page.locator('#layoutServiceKey').boundingBox(); expect(key.y + key.height).toBeLessThan(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('services-mobile.png') }); await c.detach();
  });
  for (const mode of ['cancel', 'pinch', 'outside']) test('unfinished service drag is not saved after ' + mode, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await rectangle(page); await add(page, 'Boiler', 240, 200);
    const before = await page.locator('#house_layout').inputValue(), a = await point(page, 240, 200), aim = await point(page, 400, 240), b = { x: aim.x, y: aim.y + 72, id: 0 }, c = await page.context().newCDPSession(page);
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 0 }] });
    await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [b] });
    if (mode === 'pinch') await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [b, { ...a, id: 1 }] });
    if (mode === 'outside') await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 2, y: 10, id: 0 }] });
    await c.send('Input.dispatchTouchEvent', { type: mode === 'cancel' ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    expect(await page.locator('#house_layout').inputValue()).toBe(before); await expect(page.locator('#layoutAddService')).toBeEnabled(); await c.detach();
  });
});
