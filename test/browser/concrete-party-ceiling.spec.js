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

test('concrete party ceilings require an explicit temperature in the flat above', async ({ page }) => {
  await page.locator('#hl_lounge_loft_type').selectOption(uninsulated);
  const temperature = page.locator('#hl_lounge_party_ceiling_adjacent_temp');
  await expect(temperature).toBeVisible();
  await expect(temperature).toHaveValue('');
  expect((await room(page)).complete).toBe(false);
  expect((await room(page)).warnings.join(' ')).toContain('Temperature in the flat above is required');
  await temperature.fill('18.5');
  expect((await room(page)).complete).toBe(true);
  expect((await room(page)).roofAdjacentTemperature).toBe(18.5);
  expect((await room(page)).roofDeltaT).toBe(21 - 18.5);
  for (const invalid of ['41', '-31', '']) {
    await temperature.fill(invalid);
    expect((await room(page)).complete).toBe(false);
  }
  await temperature.fill('0');
  expect((await room(page)).complete).toBe(true);
});

test('concrete ceiling transfer matches independent U times area times temperature difference', async ({ page }) => {
  const ceiling = page.locator('#hl_lounge_loft_type');
  const temperature = page.locator('#hl_lounge_party_ceiling_adjacent_temp');
  await ceiling.selectOption(uninsulated);
  await temperature.fill('21');
  const equal = await room(page);
  await temperature.fill('18.5');
  const cooler = await room(page);
  expect(cooler.roofU).toBe(1.82);
  expect(cooler.totalWatts - equal.totalWatts).toBeCloseTo(1.82 * 12 * (21 - 18.5), 8);
  await temperature.fill('24');
  const warmer = await room(page);
  expect(warmer.totalWatts - equal.totalWatts).toBeCloseTo(1.82 * 12 * (21 - 24), 8);
  await ceiling.selectOption(insulated);
  await temperature.fill('18.5');
  const insulatedRoom = await room(page);
  expect(insulatedRoom.roofU).toBe(0.57);
  expect(insulatedRoom.totalWatts - equal.totalWatts).toBeCloseTo(0.57 * 12 * (21 - 18.5), 8);
  // Another dwelling is outside this survey: its transfer must not cancel as
  // though it were another heated room included in the same property.
  expect(insulatedRoom.propertyWatts).toBeCloseTo(insulatedRoom.totalWatts, 8);
});

test('party ceilings stay out of outdoor bridge area and ventilation envelope assumptions', async ({ page }) => {
  await page.locator('#hl_lounge_loft_type').selectOption(uninsulated);
  const temperature = page.locator('#hl_lounge_party_ceiling_adjacent_temp');
  for (const [method, allowance] of [['None', 1], ['Age-based', 1], ['Percentage', 1.1]]) {
    await setFields(page, { hl_bridge_method: method });
    await temperature.fill('21');
    const equal = await room(page);
    await temperature.fill('18');
    const cooler = await room(page);
    expect(cooler.complete).toBe(true);
    expect(cooler.totalWatts - equal.totalWatts).toBeCloseTo(1.82 * 12 * (21 - 18) * allowance, 8);
    // The legacy age-based outdoor-area allowance remains unchanged, just as
    // for internal walls; do not multiply the party ceiling by outdoor delta-T.
    expect(cooler.bridgeArea).toBeCloseTo(cooler.wallLength * cooler.height + cooler.floorArea, 8);
  }
  await setFields(page, {
    rad_lounge_outside: '0', hl_lounge_floor_type: 'Heated room below',
    hl_lounge_internal_wall_count: '0'
  });
  const enclosed = await room(page);
  expect(enclosed.hasExternalEnvelope).toBe(false);
  expect(enclosed.standardAch).toBe(0);
});

test('concrete ceiling selection survives save reload and JSON round trip and appears in the report', async ({ page }) => {
  await page.locator('#hl_lounge_loft_type').selectOption(insulated);
  await page.locator('#hl_lounge_party_ceiling_adjacent_temp').fill('18.5');
  const before = await room(page);
  await page.reload();
  await page.locator('#radsTab').click();
  await expect(page.locator('#hl_lounge_loft_type')).toHaveValue(insulated);
  await expect(page.locator('#hl_lounge_party_ceiling_adjacent_temp')).toHaveValue('18.5');
  expect((await room(page)).totalWatts).toBeCloseTo(before.totalWatts, 8);
  const report = await page.evaluate(() => {
    const data = window.SurveyPersistence.decode(window.SurveyPersistence.encode(getData()));
    setData(data);
    return buildPrintHtml('Concrete ceiling test', ['Front', 'Rads', 'Heat Loss'], 'landscape');
  });
  expect(report).toContain(insulated);
  expect(report).toContain('Adjacent flat: 18.5°C');
  expect((await room(page)).totalWatts).toBeCloseTo(before.totalWatts, 8);
});

test('party ceilings cannot masquerade as an exposed roof or accept rooflights', async ({ page }) => {
  await page.locator('#hl_lounge_loft_type').selectOption(uninsulated);
  await page.locator('#hl_lounge_party_ceiling_adjacent_temp').fill('18');
  expect(await page.evaluate(() => window.referenceNaturalCheckV1)).toMatchObject({
    available: false, reason: expect.stringContaining('Party ceilings to another dwelling')
  });
  await page.locator('#hl_lounge_rooflight_type').selectOption('Single-glazed roof window');
  await page.locator('#hl_lounge_rooflight_area').fill('1');
  expect((await room(page)).complete).toBe(false);
  expect((await room(page)).warnings.join(' ')).toContain('Rooflights cannot be assigned beneath another flat');
  await page.locator('#hl_lounge_rooflight_type').selectOption('No rooflights');
  await page.locator('#hl_lounge_loft_type').selectOption('Plasterboard with 200mm insulation');
  await expect(page.locator('#hl_lounge_party_ceiling_adjacent_temp')).toBeHidden();
  const externalRoof = await room(page);
  expect(externalRoof.complete).toBe(true);
  expect(externalRoof.roofDeltaT).toBe(21 - (-3));
  expect(externalRoof.roofAdjacentTemperature).toBe(null);
  await page.locator('#hl_lounge_loft_type').selectOption(uninsulated);
  await expect(page.locator('#hl_lounge_party_ceiling_adjacent_temp')).toHaveValue('18');
});
