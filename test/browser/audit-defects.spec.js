const { test, expect } = require('@playwright/test');

const base = {
  r_ceiling: '2.4', hl_outdoor_temp: '-3', hl_ground_temp: '10',
  hl_property_age_band: 'H', hl_ventilation_age_category: '',
  hl_bridge_method: 'Percentage', hl_reheat_factor: '1',
  hl_exposed_location: '1', hl_high_ceiling_factor: '1', hl_radiator_temperature: '55',
  rad_lounge_len: '4', rad_lounge_wid: '3', rad_lounge_outside: '1',
  hl_lounge_indoor_temp: '21', hl_lounge_internal_wall_count: '0',
  hl_lounge_wall_type: 'Cavity wall, insulated', hl_lounge_window_type: 'No windows',
  hl_lounge_window_count: '0', hl_lounge_door_type: 'No external door',
  hl_lounge_door_count: '0', hl_lounge_floor_type: 'Insulated solid ground floor',
  hl_lounge_loft_type: 'Plasterboard with 200mm insulation',
  hl_lounge_ventilation_mode: 'Automatic',
  hl_lounge_ventilation_device: 'No additional vent or flue'
};

async function setFields(page, values) {
  await page.evaluate(values => {
    for (const [id, value] of Object.entries(values)) {
      const field = document.getElementById(id);
      if (!field) throw Error(`Missing field ${id}`);
      field.value = value;
      if (field.value !== value) throw Error(`Rejected field ${id}=${value}`);
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, values);
}
async function room(page) {
  return page.evaluate(() => window.heatLossResultsV60.rooms.find(r => r.key === 'lounge'));
}
test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#radsTab').click();
  await setFields(page, base);
});

test('flat rooflights replace opaque roof area instead of adding overlapping loss', async ({ page }) => {
  const opaque = await room(page);
  expect(opaque.complete).toBe(true);
  await setFields(page, {
    hl_lounge_rooflight_type: 'Rooflight, double glazed', hl_lounge_rooflight_area: '2'
  });
  const glazed = await room(page);
  expect(glazed.complete).toBe(true);
  // Same geometry and allowances; only 2 square metres change construction.
  const replacementWatts = 2 * (glazed.rooflightU - glazed.roofU) * glazed.roofDeltaT;
  expect(glazed.totalWatts - opaque.totalWatts).toBeCloseTo(replacementWatts * 1.1, 8);
});

for (const area of ['', '0', '-1', '100']) {
  test(`rooflight area '${area}' blocks an incomplete or impossible survey`, async ({ page }) => {
    await setFields(page, {
      hl_lounge_rooflight_type: 'Rooflight, double glazed', hl_lounge_rooflight_area: area
    });
    const invalid = await room(page);
    expect(invalid.complete).toBe(false);
    expect(invalid.totalWatts).toBe(0);
    expect(invalid.radiator).toBeNull();
    expect(invalid.warnings.join(' ')).toMatch(/rooflight area/i);
    await setFields(page, { hl_lounge_rooflight_area: '2' });
    expect((await room(page)).complete).toBe(true);
    await setFields(page, { hl_lounge_rooflight_type: 'No rooflights' });
    expect((await room(page)).complete).toBe(true);
  });
}

test('rooflights cannot be assigned underneath a heated room above', async ({ page }) => {
  await setFields(page, {
    hl_lounge_loft_type: 'Heated room above',
    hl_lounge_rooflight_type: 'Rooflight, double glazed', hl_lounge_rooflight_area: '2'
  });
  expect((await room(page)).complete).toBe(false);
  expect((await room(page)).warnings.join(' ')).toMatch(/rooflight.*heated room above/i);
});

for (const bridge of ['Percentage', 'Age-based']) {
  test(`${bridge}: heated transfers and their allowances do not leak into building demand`, async ({ page }) => {
    await setFields(page, {
      hl_bridge_method: bridge, hl_reheat_factor: '1.2',
      hl_exposed_location: '1.1', hl_high_ceiling_factor: '1.05',
      hl_lounge_internal_wall_count: '1',
      hl_lounge_internal_wall_type: 'Heated room, single brick',
      hl_lounge_internal_segment_1_length: '11', hl_lounge_internal_segment_1_adjacent_temp: '21'
    });
    const equal = await room(page);
    expect(equal.complete).toBe(true);
    for (const adjacent of ['18', '22']) {
      await setFields(page, { hl_lounge_internal_segment_1_adjacent_temp: adjacent });
      const transferred = await room(page);
      expect(transferred.complete).toBe(true);
      expect(transferred.totalWatts).not.toBe(equal.totalWatts);
      expect(transferred.propertyWatts).toBeCloseTo(equal.propertyWatts, 8);
      const building = await page.evaluate(() => window.heatLossResultsV60.totalWatts);
      expect(building).toBeCloseTo(equal.propertyWatts, 8);
    }
    await setFields(page, { hl_lounge_internal_segment_1_adjacent_temp: '10' });
    expect((await room(page)).propertyWatts).toBeGreaterThan(equal.propertyWatts);
  });
}

test('a fully internal room contributes no allowance-only building demand', async ({ page }) => {
  await setFields(page, {
    rad_lounge_outside: '0', hl_lounge_floor_type: 'Heated room below',
    hl_lounge_loft_type: 'Heated room above', hl_lounge_internal_wall_count: '1',
    hl_lounge_internal_wall_type: 'Heated room, single brick',
    hl_lounge_internal_segment_1_length: '14', hl_lounge_internal_segment_1_adjacent_temp: '18'
  });
  const internal = await room(page);
  expect(internal.complete).toBe(true);
  expect(internal.totalWatts).toBeGreaterThan(0);
  expect(internal.propertyWatts).toBeCloseTo(0, 8);
});

test('fully internal rooms reconcile the entire perimeter without blocking reviewable geometry', async ({ page }) => {
  await setFields(page, {
    rad_lounge_outside: '0', hl_lounge_floor_type: 'Heated room below',
    hl_lounge_loft_type: 'Heated room above', hl_lounge_internal_wall_count: '1',
    hl_lounge_internal_wall_type: 'Heated room, single brick',
    hl_lounge_internal_segment_1_length: '1', hl_lounge_internal_segment_1_adjacent_temp: '18'
  });
  const incomplete = await room(page);
  expect(incomplete.complete).toBe(true);
  expect(incomplete.calculatedInternalWallLength).toBe(14);
  expect(incomplete.warnings.join(' ')).toContain('13 m of internal wall has not been entered');
  await setFields(page, { hl_lounge_internal_segment_1_length: '14' });
  expect((await room(page)).warnings.join(' ')).not.toMatch(/internal wall has not been entered|Entered internal walls total/);
  await setFields(page, { hl_lounge_internal_segment_1_length: '15' });
  expect((await room(page)).warnings.join(' ')).toContain('Entered internal walls total');
});

test('minimum radiator exceptions report actual oversizing and warn the surveyor', async ({ page }) => {
  await setFields(page, {
    rad_lounge_outside: '0', hl_lounge_floor_type: 'Heated room below',
    hl_lounge_loft_type: 'Heated room above', hl_lounge_internal_wall_count: '1',
    hl_lounge_internal_wall_type: 'Heated room, single brick',
    hl_lounge_internal_segment_1_length: '1', hl_lounge_internal_segment_1_adjacent_temp: '18'
  });
  const result = await room(page);
  expect(result.complete).toBe(true);
  expect(result.radiator.selected.minimumSizeFallback).toBe(true);
  const oversize = (result.radiator.selected.watts / result.radiatorRequirementWatts - 1) * 100;
  expect(oversize).toBeGreaterThan(50);
  expect(result.radiator.selected.oversizePercent).toBeCloseTo(oversize, 8);
  expect(result.warnings.join(' ')).toMatch(/minimum.size.*oversiz/i);
  const visible = await page.locator('body').innerText();
  expect(visible).toContain('Minimum-size radiator exception');
});
