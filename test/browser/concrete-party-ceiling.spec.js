const { test, expect } = require('@playwright/test');

const uninsulated = 'Solid concrete ceiling to another flat, uninsulated';
const insulated = 'Solid concrete ceiling to another flat, 100mm insulation';

async function setFields(page, values) {
  await page.evaluate((values) => {
    for (const [id, value] of Object.entries(values)) {
      const field = document.getElementById(id);
      if (!field) throw new Error(`Missing field ${id}`);
      field.value = value;
      if (field.value !== value) throw new Error(`Rejected ${id}=${value}`);
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, values);
}
async function room(page) {
  return page.evaluate(() => window.heatLossResultsV60.rooms.find((r) => r.key === 'lounge'));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#radsTab').click();
  await setFields(page, {
    r_ceiling: '2.4', hl_outdoor_temp: '-3', hl_ground_temp: '10',
    hl_property_age_band: 'H', hl_bridge_method: 'None',
    hl_reheat_factor: '1', hl_exposed_location: '1', hl_high_ceiling_factor: '1',
    hl_ventilation_storeys: '1', hl_dwelling_attachment: 'Detached',
    rad_lounge_len: '4', rad_lounge_wid: '3', rad_lounge_outside: '1',
    hl_lounge_indoor_temp: '21', hl_lounge_internal_wall_count: '0',
    hl_lounge_wall_type: 'Cavity wall, insulated',
    hl_lounge_window_type: 'No windows', hl_lounge_door_type: 'No external door',
    hl_lounge_floor_type: 'Insulated solid ground floor',
    hl_lounge_loft_type: 'Heated room above', hl_lounge_rooflight_type: 'No rooflights',
    hl_lounge_ventilation_mode: 'Automatic',
    hl_lounge_ventilation_device: 'No additional vent or flue'
  });
});

test('concrete party ceilings automatically use the fixed 10 degree unheated-space assumption', async ({ page }) => {
  await page.locator('#hl_lounge_loft_type').selectOption(uninsulated);
  await expect(page.locator('#hl_lounge_party_ceiling_adjacent_temp')).toHaveCount(0);
  const result = await room(page);
  expect(result.complete).toBe(true);
  expect(result.roofAdjacentTemperature).toBe(10);
  expect(result.roofDeltaT).toBe(21 - 10);
  await expect(page.locator('#hl_lounge_loft_type').locator('..')).toContainText('10°C unheated-space assumption');
  // Obsolete saved values must not override the fixed design assumption.
  await page.evaluate(() => setData(Object.assign(getData(), {
    hl_lounge_party_ceiling_adjacent_temp: '24', hl_lounge_roof_adjacent_temp: '24'
  })));
  expect((await room(page)).roofAdjacentTemperature).toBe(10);
});

test('concrete ceiling transfer matches independent U times area times room minus 10 degrees', async ({ page }) => {
  const ceiling = page.locator('#hl_lounge_loft_type');
  const noCeilingLoss = await room(page);
  await ceiling.selectOption(uninsulated);
  const concrete = await room(page);
  expect(concrete.roofU).toBe(1.82);
  expect(concrete.totalWatts - noCeilingLoss.totalWatts).toBeCloseTo(1.82 * 12 * (21 - 10), 8);
  await ceiling.selectOption(insulated);
  const insulatedRoom = await room(page);
  expect(insulatedRoom.roofU).toBe(0.57);
  expect(insulatedRoom.totalWatts - noCeilingLoss.totalWatts).toBeCloseTo(0.57 * 12 * (21 - 10), 8);
  expect(insulatedRoom.propertyWatts).toBeCloseTo(insulatedRoom.totalWatts, 8);
});

test('party ceilings stay out of outdoor bridge area and ventilation envelope assumptions', async ({ page }) => {
  for (const [method, allowance] of [['None', 1], ['Age-based', 1], ['Percentage', 1.1]]) {
    await setFields(page, { hl_bridge_method: method, hl_lounge_loft_type: 'Heated room above' });
    const noCeilingLoss = await room(page);
    await page.locator('#hl_lounge_loft_type').selectOption(uninsulated);
    const concrete = await room(page);
    expect(concrete.complete).toBe(true);
    expect(concrete.totalWatts - noCeilingLoss.totalWatts).toBeCloseTo(1.82 * 12 * (21 - 10) * allowance, 8);
    expect(concrete.bridgeArea).toBeCloseTo(concrete.wallLength * concrete.height + concrete.floorArea, 8);
  }
  await setFields(page, {
    rad_lounge_outside: '0', hl_lounge_floor_type: 'Heated room below',
    hl_lounge_internal_wall_count: '0'
  });
  expect((await room(page)).hasExternalEnvelope).toBe(false);
  expect((await room(page)).standardAch).toBe(0);
});

test('concrete ceiling selection and its 10 degree assumption survive reload and JSON round trip', async ({ page }) => {
  await page.locator('#hl_lounge_loft_type').selectOption(insulated);
  const before = await room(page);
  await page.reload();
  await page.locator('#radsTab').click();
  await expect(page.locator('#hl_lounge_loft_type')).toHaveValue(insulated);
  expect((await room(page)).roofAdjacentTemperature).toBe(10);
  expect((await room(page)).totalWatts).toBeCloseTo(before.totalWatts, 8);
  const report = await page.evaluate(() => {
    const data = window.SurveyPersistence.decode(window.SurveyPersistence.encode(getData()));
    setData(data);
    return buildPrintHtml('Concrete ceiling test', ['Front', 'Rads', 'Heat Loss'], 'landscape');
  });
  expect(report).toContain(insulated);
  expect(report).toContain('Adjacent flat: 10.0°C (unheated-space assumption)');
  expect((await room(page)).totalWatts).toBeCloseTo(before.totalWatts, 8);
});

test('party ceilings cannot masquerade as an exposed roof or accept rooflights', async ({ page }) => {
  await page.locator('#hl_lounge_loft_type').selectOption(uninsulated);
  expect(await page.evaluate(() => window.referenceNaturalCheckV1)).toMatchObject({
    available: false, reason: expect.stringContaining('Party ceilings to another dwelling')
  });
  await page.locator('#hl_lounge_rooflight_type').selectOption('Single-glazed roof window');
  await page.locator('#hl_lounge_rooflight_area').fill('1');
  expect((await room(page)).complete).toBe(false);
  expect((await room(page)).warnings.join(' ')).toContain('Rooflights cannot be assigned beneath another flat');
  await page.locator('#hl_lounge_rooflight_type').selectOption('No rooflights');
  await page.locator('#hl_lounge_loft_type').selectOption('Plasterboard with 200mm insulation');
  const externalRoof = await room(page);
  expect(externalRoof.complete).toBe(true);
  expect(externalRoof.roofDeltaT).toBe(21 - (-3));
  expect(externalRoof.roofAdjacentTemperature).toBe(null);
  await page.locator('#hl_lounge_loft_type').selectOption(uninsulated);
  expect((await room(page)).roofAdjacentTemperature).toBe(10);
});
