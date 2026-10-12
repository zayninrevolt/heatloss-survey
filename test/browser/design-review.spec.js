const { test, expect } = require('@playwright/test');

const base = {
  r_ceiling: '2.4', hl_outdoor_temp: '-3', hl_ground_temp: '10',
  hl_property_age_band: 'H', hl_bridge_method: 'Percentage', hl_reheat_factor: '1',
  hl_exposed_location: '1', hl_high_ceiling_factor: '1', hl_radiator_temperature: '55',
  hl_dwelling_attachment: 'Semi-detached', hl_shielding_class: 'Normal shielding',
  rad_lounge_len: '4', rad_lounge_wid: '3', rad_lounge_outside: '1',
  hl_lounge_indoor_temp: '21', hl_lounge_internal_wall_count: '0',
  hl_lounge_wall_type: 'Cavity wall, insulated', hl_lounge_window_type: 'No windows',
  hl_lounge_window_count: '0', hl_lounge_door_type: 'No external door',
  hl_lounge_door_count: '0', hl_lounge_floor_type: 'Insulated solid ground floor',
  hl_lounge_loft_type: 'Plasterboard with 200mm insulation',
  hl_lounge_ventilation_mode: 'Automatic', hl_lounge_ventilation_device: 'No additional vent or flue'
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

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#radsTab').click();
  await setFields(page, base);
});

test('the heat-pump design review reports the separate figures and its limits', async ({ page }) => {
  const review = await page.evaluate(() => window.DesignReview.computeDesignReview());
  expect(review.complete).toBe(true);
  // Emitter demand is the room peak; the whole-building figure must be lower, because
  // BS EN 12831 does not sum room ventilation peaks into the plant load.
  expect(review.roomEmitterDemandKw).toBeGreaterThan(review.buildingDemandKw);
  expect(review.fabricDemandKw).toBeGreaterThan(0);
  expect(review.exposure).toEqual({ exposedFacades: 3, shielding: 'normal' });
  expect(review.implemented.join(' ')).toMatch(/without the ventilation-diversity reduction/);
  expect(review.outstanding.join(' ')).toMatch(/infiltration exposure flow/);
  // The whole review lives in a collapsed <details> by default, like every other
  // property-level report block; open it the way the surveyor would.
  await expect(page.locator('#hl_design_review')).not.toHaveAttribute('open', '');
  await page.locator('#hl_design_review > summary').click();
  await expect(page.locator('#hl_design_review_summary')).toBeVisible();
  await expect(page.locator('#hl_design_review_summary')).toContainText('kW');
  await expect(page.locator('#hl_design_review_limits')).toContainText('not an MCS design');
  // The surveyor reads the printed sheet, not the screen.
  const printed = await page.evaluate(() => buildPrintHtml('Design review', ['Heat Loss'], 'portrait'));
  expect(printed).toContain('Heat-pump design review (report only');
  expect(printed).toContain('infiltration exposure flow');
  expect(printed).toMatch(/\d+\.\d\d kW/);
});

test('the design review follows the visible property inputs without changing the boiler figures', async ({ page }) => {
  const before = await page.evaluate(() => window.heatLossResultsV60.totalWatts);
  await setFields(page, { hl_dwelling_attachment: 'Detached', hl_shielding_class: 'No shielding, open site' });
  const review = await page.evaluate(() => window.DesignReview.computeDesignReview());
  expect(review.exposure).toEqual({ exposedFacades: 4, shielding: 'none' });
  expect(review.buildingDemandKw).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.heatLossResultsV60.totalWatts)).toBeCloseTo(before, 8);
});

test('an incomplete survey leaves the design review uncalculated', async ({ page }) => {
  await setFields(page, { hl_lounge_floor_type: '' });
  const review = await page.evaluate(() => window.DesignReview.computeDesignReview());
  expect(review.complete).toBe(false);
  expect(review.buildingDemandKw).toBe(0);
  expect(review.notes.join(' ')).toMatch(/Lounge/);
  await expect(page.locator('#hl_design_review_summary')).toContainText('Complete');
});
