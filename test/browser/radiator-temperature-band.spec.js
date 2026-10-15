'use strict';
const { test, expect } = require('@playwright/test');
const { prepare, setFields } = require('../helpers/reference-natural-driver');

const FLOWS = ['45', '50', '55', '60', '65', '70', '75'];

async function radiatorFor(page, roomName) {
  return page.evaluate(name => {
    const room = window.heatLossResultsV60.includedRooms.find(r => r.roomName === name);
    return { indoor: room.indoor, requirement: room.radiatorRequirementWatts,
      radiator: room.radiator ? { flow: room.radiator.flow,
        meanWater: room.radiator.meanWater, deltaT: room.radiator.deltaT,
        correctionFactor: room.radiator.correctionFactor,
        tabulated: room.radiator.tabulated,
        temperatureWarning: room.radiator.temperatureWarning,
        selected: room.radiator.selected ? { size: room.radiator.selected.size,
          watts: room.radiator.selected.watts,
          ratedWatts: room.radiator.selected.ratedWatts } : null } : null,
      warnings: room.warnings };
  }, roomName);
}

test('the radiator design temperature offers 45 to 75 in 5 degC steps', async ({ page }) => {
  await prepare(page);
  const options = await page.locator('#hl_radiator_temperature option')
    .evaluateAll(list => list.map(o => o.value).filter(Boolean));
  expect(options).toEqual(FLOWS);
  // The Front page carries the same recorded value, so it must offer the same set.
  await page.locator('#frontTab').click();
  const front = await page.locator('#front_boiler_temp option')
    .evaluateAll(list => list.map(o => o.value).filter(Boolean));
  expect(front.slice().sort((a, b) => Number(a) - Number(b))).toEqual(FLOWS);
});

test('each new design temperature sizes the same room at its own delta-T', async ({ page }) => {
  await prepare(page);
  const readings = {};
  for (const flow of FLOWS) {
    await page.locator('#hl_radiator_temperature').selectOption(flow);
    const resolved = await radiatorFor(page, 'Lounge');
    readings[flow] = resolved;
    expect(resolved.radiator.flow).toBe(Number(flow));
    expect(resolved.radiator.meanWater).toBe(Number(flow) - 5);
    expect(resolved.radiator.deltaT).toBe(Number(flow) - 5 - resolved.indoor);
    expect(resolved.radiator.temperatureWarning).toBe(false);
    // The room heat loss never moves with the emitter design temperature: the
    // same load is simply matched by a larger emitter as the water cools.
    expect(resolved.requirement).toBeGreaterThan(0);
    expect(resolved.radiator.selected).not.toBeNull();
  }
  const requirement = flow => readings[flow].requirement;
  expect(requirement('45')).toBe(requirement('75'));
  // Rising flow temperature needs less ΔT50-equivalent radiator capacity, so
  // the rated capacity of the chosen emitter never rises. At the lowest
  // temperatures the catalogue can hit its largest width, so a plateau is
  // legitimate; an increase would mean the temperature correction is inverted.
  const rated = FLOWS.map(flow => readings[flow].radiator.selected.ratedWatts);
  rated.slice(1).forEach((value, index) => {
    expect(value).toBeLessThanOrEqual(rated[index] + 1e-9);
  });
  expect(rated[0]).toBeGreaterThan(rated[rated.length - 1]);
  expect(readings['45'].radiator.deltaT).toBe(19);
  expect(readings['75'].radiator.deltaT).toBe(49);
  // A 19 K design is extrapolated; the warmer options are tabulated.
  expect(readings['45'].radiator.tabulated).toBe(false);
  expect(readings['75'].radiator.tabulated).toBe(true);
});

test('a 45 degC design is reported as extrapolated below the published table', async ({ page }) => {
  await prepare(page);
  await page.locator('#hl_radiator_temperature').selectOption('45');
  const low = await radiatorFor(page, 'Lounge');
  expect(low.radiator.tabulated).toBe(false);
  expect(low.warnings.join(' ')).toMatch(/below the published/i);
  // 50 degC in a 21 degC room gives a 24 K delta-T, inside the table.
  await page.locator('#hl_radiator_temperature').selectOption('50');
  const tabulated = await radiatorFor(page, 'Lounge');
  expect(tabulated.radiator.tabulated).toBe(true);
  expect(tabulated.warnings.join(' ')).not.toMatch(/below the published/i);
});

test('a low design temperature still returns an adequate radiator or an explicit reason', async ({ page }) => {
  await prepare(page);
  await page.locator('#hl_radiator_temperature').selectOption('45');
  for (const name of ['Lounge', 'Kitchen']) {
    const room = await radiatorFor(page, name);
    const chosen = room.radiator.selected;
    const fallback = room.warnings.some(w => /minimum-size radiator exception/i.test(w));
    const noOption = room.warnings.some(w => /no single radiator option/i.test(w));
    expect(Boolean(chosen && chosen.watts + 1e-9 >= room.requirement) || noOption).toBe(true);
    if (chosen && chosen.watts > room.requirement * 1.5 + 1e-9) expect(fallback).toBe(true);
  }
});

test('the printed assumptions record the flow temperature and its basis', async ({ page }) => {
  await prepare(page);
  await page.locator('#hl_radiator_temperature').selectOption('45');
  const html = await page.evaluate(() => buildPrintHtml('Design temperature', ['Heat Loss'], 'portrait'));
  expect(html).toContain('45');
  expect(html).toMatch(/45\s*\/\s*35|45°C.*nominal ΔT20|nominal ΔT20/);
  await page.locator('#hl_radiator_temperature').selectOption('75');
  const warm = await page.evaluate(() => buildPrintHtml('Design temperature', ['Heat Loss'], 'portrait'));
  expect(warm).toMatch(/75°C.*nominal ΔT50|nominal ΔT50/);
  expect(warm).toContain('110% of the combined corrected output');
});

test('an existing saved survey keeps its recorded design temperature and result', async ({ page }) => {
  await prepare(page);
  await page.locator('#hl_radiator_temperature').selectOption('60');
  const before = await radiatorFor(page, 'Lounge');
  expect(before.radiator.flow).toBe(60);
  await page.reload();
  await page.locator('#radsTab').click();
  const after = await radiatorFor(page, 'Lounge');
  expect(after.radiator.flow).toBe(60);
  expect(after.requirement).toBe(before.requirement);
  expect(after.radiator.selected.watts).toBeCloseTo(before.radiator.selected.watts, 9);
});
