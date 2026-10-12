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
  // No heated-room transfer exists in this fixture. The recorded-method building
  // and room loads must agree; this report implements no ventilation diversity.
  const results = await page.evaluate(() => ({
    totalWatts: window.heatLossResultsV60.totalWatts,
    emitterRequirementWatts: window.heatLossResultsV60.includedRooms.reduce((sum, room) => sum + room.radiatorRequirementWatts, 0)
  }));
  expect(review.buildingDemandKw).toBeCloseTo(results.totalWatts / 1000, 10);
  expect(review.roomEmitterDemandKw).toBeCloseTo(results.emitterRequirementWatts / 1000, 10);
  expect(review.fabricDemandKw + review.ventilationDemandKw).toBeCloseTo(review.buildingDemandKw, 10);
  expect(review.fabricDemandKw).toBeGreaterThan(0);
  expect(review.exposure).toEqual({ exposedFacades: 3, shielding: 'normal' });
  expect(review.implemented.join(' ')).toMatch(/including bridging and recorded room allowances/);
  expect(review.implemented.join(' ')).toMatch(/No ventilation-diversity reduction/);
  expect(review.outstanding.join(' ')).toMatch(/infiltration exposure flow/);
  // The whole review lives in a collapsed <details> by default, like every other
  // property-level report block; open it the way the surveyor would.
  await expect(page.locator('#hl_design_review')).not.toHaveAttribute('open', '');
  await page.locator('#hl_design_review > summary').click();
  await expect(page.locator('#hl_design_review_summary')).toBeVisible();
  await expect(page.locator('#hl_design_review_summary')).toContainText('kW');
  await expect(page.locator('#hl_design_review_summary')).toContainText('including bridging and recorded room allowances');
  await expect(page.locator('#hl_design_review_summary')).toContainText('exposure coefficient is recorded, not applied');
  await expect(page.locator('#hl_design_review_summary')).toContainText('not a validated heat-pump sizing calculation');
  await expect(page.locator('#hl_design_review_limits')).toContainText('not an MCS design');
  // The surveyor reads the printed sheet, not the screen.
  const printed = await page.evaluate(() => buildPrintHtml('Design review', ['Heat Loss'], 'portrait'));
  expect(printed).toContain('Heat-pump design review (report only');
  expect(printed).toContain('infiltration exposure flow');
  expect(printed).toContain('including bridging and recorded room allowances');
  expect(printed).toContain('exposure coefficient is recorded, not applied');
  expect(printed).toContain('Not a validated heat-pump sizing calculation');
  expect(printed).toContain('recorded-method building load ' + review.buildingDemandKw.toFixed(2) + ' kW');
  expect(printed).toContain('room emitter demand ' + review.roomEmitterDemandKw.toFixed(2) + ' kW');
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

test('the review reconciles recorded-method building components without losing bridging or duplicating transfers', async ({ page }) => {
  const comparisons = [];
  for (const adjacent of [null, '18', '22', '10']) {
    if (adjacent == null) {
      await setFields(page, { hl_lounge_internal_wall_count: '0' });
    } else {
      await setFields(page, {
        hl_lounge_internal_wall_count: '1',
        hl_lounge_internal_wall_type: 'Heated room, single brick',
        hl_lounge_internal_segment_1_length: '11',
        hl_lounge_internal_segment_1_adjacent_temp: adjacent
      });
    }
    const state = await page.evaluate(() => {
      const result = window.heatLossResultsV60;
      const room = result.rooms.find(r => r.key === 'lounge');
      if (!room.complete || result.includedRooms.length !== 1) throw Error('Expected one complete room');
      const review = window.DesignReview.computeDesignReview();
      return {
        room,
        review,
        canonicalBuildingKw: room.propertyWatts / 1000,
        canonicalVentilationKw: room.ventilationWatts * room.factorMultiplier / 1000
      };
    });
    expect(state.room.bridgeWatts).toBeGreaterThan(0);
    comparisons.push({ boundary: adjacent || 'no internal wall',
      buildingDifferenceW: (state.review.buildingDemandKw - state.canonicalBuildingKw) * 1000,
      fabricDifferenceW: (state.review.fabricDemandKw -
        (state.canonicalBuildingKw - state.canonicalVentilationKw)) * 1000,
      ventilationDifferenceW: (state.review.ventilationDemandKw - state.canonicalVentilationKw) * 1000
    });
  }
  for (const c of comparisons) {
    expect(Math.abs(c.buildingDifferenceW), JSON.stringify(comparisons)).toBeLessThan(1e-9);
    expect(Math.abs(c.fabricDifferenceW), JSON.stringify(comparisons)).toBeLessThan(1e-9);
    expect(Math.abs(c.ventilationDifferenceW), JSON.stringify(comparisons)).toBeLessThan(1e-9);
  }
});

test('review emitter requirement survives customer refusal and is not selected radiator capacity', async ({ page }) => {
  await setFields(page, { hl_lounge_internal_wall_count: '0' });
  const before = await page.evaluate(() => ({
    requirement: window.heatLossResultsV60.rooms.find(r => r.key === 'lounge').radiatorRequirementWatts,
    building: window.DesignReview.computeDesignReview().buildingDemandKw
  }));
  expect(before.requirement).toBeGreaterThan(0);
  await setFields(page, { rad_lounge_outcome: 'Customer refused' });
  const state = await page.evaluate(() => ({
    room: window.heatLossResultsV60.rooms.find(r => r.key === 'lounge'),
    selectedOutput: window.heatLossResultsV60.radiatorOutputWatts,
    review: window.DesignReview.computeDesignReview(),
    printed: buildPrintHtml('Emitter requirement', ['Heat Loss'], 'portrait')
  }));
  expect(state.room.complete).toBe(true);
  expect(state.selectedOutput).toBe(0);
  expect(state.review.roomEmitterDemandKw).toBeCloseTo(before.requirement / 1000, 10);
  expect(state.review.buildingDemandKw).toBeCloseTo(before.building, 10);
  expect(state.printed).toContain('room emitter demand ' + (before.requirement / 1000).toFixed(2) + ' kW');
});
