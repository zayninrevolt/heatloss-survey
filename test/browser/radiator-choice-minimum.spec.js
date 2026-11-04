const { test, expect } = require('@playwright/test');

async function setFields(page, values) {
  await page.evaluate((values) => {
    for (const [id, value] of Object.entries(values)) {
      const field = document.getElementById(id);
      if (!field) throw Error(`Missing field ${id}`);
      field.value = value;
      if (field.value !== value) throw Error(`Rejected ${id}=${value}`);
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, values);
}
async function room(page) {
  return page.evaluate(() => window.heatLossResultsV60.rooms.find((r) => r.key === 'lounge'));
}
async function choices(page, id = 'rad_lounge_new_size') {
  return page.locator(`#${id} option[data-watts]`).evaluateAll((options) => options.map((o) => ({
    size: o.value, watts: Number(o.dataset.watts), label: o.textContent
  })));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#radsTab').click();
  await setFields(page, {
    r_ceiling: '2.4', hl_outdoor_temp: '-3', hl_ground_temp: '10',
    hl_property_age_band: 'H', hl_bridge_method: 'None', hl_reheat_factor: '1',
    hl_exposed_location: '1', hl_high_ceiling_factor: '1', hl_radiator_temperature: '55',
    rad_lounge_len: '1', rad_lounge_wid: '1', rad_lounge_outside: '1',
    hl_lounge_indoor_temp: '21', hl_lounge_internal_wall_count: '0',
    hl_lounge_wall_type: 'Cavity wall, insulated', hl_lounge_window_type: 'No windows',
    hl_lounge_door_type: 'No external door', hl_lounge_floor_type: 'Heated room below',
    hl_lounge_loft_type: 'Heated room above', hl_lounge_ventilation_mode: 'Automatic',
    hl_lounge_ventilation_device: 'No additional vent or flue',
    hl_lounge_rad_quantity: '1'
  });
});

test('replacement dropdown offers four real adequate choices without changing the automatic pick', async ({ page }) => {
  const result = await room(page);
  const available = await choices(page);
  expect(result.complete).toBe(true);
  expect(result.radiator.options).toHaveLength(1);
  expect(available).toHaveLength(4);
  expect(available.every((o) => o.watts + 0.01 >= result.radiatorRequirementWatts)).toBe(true);
  expect(available.filter((o) => /oversized/i.test(o.label)).length).toBeGreaterThan(0);
  expect(result.radiator.selected.size).toBe(result.radiator.options[0].size);
  expect(new Set(available.map((o) => o.size)).size).toBe(4);
});

test('a manually chosen oversized alternative survives reload and has screen and report warnings', async ({ page }) => {
  const before = await room(page);
  const alternative = (await choices(page)).find((o) => o.size !== before.radiator.selected.size);
  expect(alternative).toBeTruthy();
  await page.locator('#rad_lounge_new_size').selectOption(alternative.size);
  const selected = await room(page);
  expect(selected.radiator.selected.size).toBe(alternative.size);
  expect(selected.totalWatts).toBeCloseTo(before.totalWatts, 8);
  expect(selected.warnings.join(' ')).toContain('above the 50% oversize limit');
  await page.reload();
  await page.locator('#radsTab').click();
  await expect(page.locator('#rad_lounge_new_size')).toHaveValue(alternative.size);
  const report = await page.evaluate(() => buildPrintHtml('Radiator choices', ['Front', 'Rads', 'Heat Loss'], 'landscape'));
  expect(report).toContain('above the 50% oversize limit');
});

test('low-temperature choices use the current derated output and stay adequate', async ({ page }) => {
  await setFields(page, { hl_radiator_temperature: '45' });
  const available = await choices(page);
  const result = await room(page);
  expect(available.length).toBeGreaterThanOrEqual(4);
  expect(result.radiator.tabulated).toBe(false);
  expect(available.every((o) => o.watts + 0.01 >= result.radiatorRequirementWatts)).toBe(true);
});

test('two-radiator dropdowns also offer four closest valid combined-output choices', async ({ page }) => {
  await setFields(page, { hl_lounge_rad_quantity: '2' });
  const initial = await room(page);
  // A tiny room has no pair inside the normal limit; expanding the visible
  // choices must not silently manufacture an automatic recommendation.
  expect(initial.radiator.selected).toBe(null);
  const firstChoices = await choices(page);
  expect(firstChoices).toHaveLength(4);
  await page.locator('#rad_lounge_new_size').selectOption(firstChoices[0].size);
  const chosen = await room(page);
  expect(chosen.radiator.selected.quantity).toBe(2);
  expect(chosen.radiator.selected.watts).toBeGreaterThanOrEqual(chosen.radiatorRequirementWatts);
  const secondChoices = await choices(page, 'rad_lounge_new_size_2');
  expect(secondChoices).toHaveLength(4);
  expect(secondChoices.every((o) => o.watts + chosen.radiator.selectedFirst.watts >= chosen.radiatorRequirementWatts - 0.01)).toBe(true);
  expect(chosen.warnings.join(' ')).toContain('above the 50% oversize limit');
  await page.locator('#rad_lounge_new_size_2').selectOption(secondChoices[secondChoices.length - 1].size);
  const recorded = await room(page);
  await page.reload();
  await page.locator('#radsTab').click();
  const restored = await room(page);
  expect(restored.radiator.selectedFirst.size).toBe(recorded.radiator.selectedFirst.size);
  expect(restored.radiator.selectedSecond.size).toBe(recorded.radiator.selectedSecond.size);
});
