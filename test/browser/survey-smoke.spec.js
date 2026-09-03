const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('saves and restores survey values', async ({ page }) => {
  const address = page.locator('#site_address');
  await address.fill('12 Test Street');
  await address.dispatchEvent('change');
  await page.reload();
  await expect(page.locator('#site_address')).toHaveValue('12 Test Street');
});

const sharedProfileFields = [
  {
    canonical: 'site_home',
    front: 'front_home',
    profile: 'p_home',
    value: '020 7946 0958'
  },
  {
    canonical: 'site_mobile',
    front: 'front_mobile',
    profile: 'p_mobile',
    value: '07700 900123'
  },
  {
    canonical: 'site_property_type',
    front: 'front_type',
    profile: 'p_property_type',
    value: 'Semi-detached'
  }
];

test('copies new main property details to hidden Front and Profile fields', async ({ page }) => {
  for (const field of sharedProfileFields) {
    await page.locator(`#${field.canonical}`).fill(field.value);
    await expect(page.locator(`#${field.front}`)).toHaveValue(field.value);
    await expect(page.locator(`#${field.profile}`)).toHaveValue(field.value);
  }
});

test('seeds new main property details from legacy Front values before Profile values', async ({ page }) => {
  const legacyData = Object.fromEntries(sharedProfileFields.flatMap((field) => [
    [field.front, `Front ${field.value}`],
    [field.profile, `Profile ${field.value}`]
  ]));
  await page.evaluate((data) => {
    localStorage.setItem('surveyWebData', JSON.stringify(data));
  }, legacyData);
  await page.reload();

  for (const field of sharedProfileFields) {
    const expected = `Front ${field.value}`;
    await expect(page.locator(`#${field.canonical}`)).toHaveValue(expected);
    await expect(page.locator(`#${field.front}`)).toHaveValue(expected);
    await expect(page.locator(`#${field.profile}`)).toHaveValue(expected);
  }
});

test('exports a JSON backup', async ({ page }) => {
  await page.locator('#site_address').fill('34 Export Road');
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => saveJson());
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^34 Export Road-\d{2}-\d{2}-\d{4}\.json$/);
  const content = await require('node:fs/promises').readFile(await download.path(), 'utf8');
  expect(JSON.parse(content).site_address).toBe('34 Export Road');
});

test('uses property age and room type for automatic ACH and defaults radiator connection to BBOE', async ({ page }) => {
  await page.locator('#radsTab').click();
  await expect(page.locator('#hl_radiator_connection')).toHaveValue('BBOE');
  await page.evaluate(() => {
    for (const key of ['lounge', 'kitchen', 'bed_1', 'bath', 'wc']) {
      for (const [suffix, value] of [['len', '4'], ['wid', '3'], ['outside', '1']]) {
        const field = document.getElementById(`rad_${key}_${suffix}`);
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
  await page.evaluate(() => {
    const values = {
      hl_lounge_wall_type: 'Cavity wall, insulated',
      hl_lounge_internal_wall_type: 'No internal wall included',
      hl_lounge_window_type: 'No windows',
      hl_lounge_window_count: '0',
      hl_lounge_door_type: 'No external door',
      hl_lounge_door_count: '0',
      hl_lounge_floor_type: 'Insulated solid ground floor',
      hl_lounge_loft_type: 'Plasterboard with 200mm insulation',
      hl_lounge_ventilation_mode: 'Automatic',
      hl_lounge_ventilation_device: 'No additional vent or flue'
    };
    for (const [id, value] of Object.entries(values)) {
      const field = document.getElementById(id);
      field.value = value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.locator('#hl_property_age_band').selectOption('H');
  const oldProperty = await page.evaluate(() =>
    Object.fromEntries(window.heatLossResultsV60.rooms.map(room => [room.roomName, {
      roomType: room.roomType,
      indoor: room.indoor,
      standardAch: room.standardAch
    }]))
  );
  expect(oldProperty.Lounge.standardAch).toBe(1.5);
  expect(oldProperty.Kitchen.standardAch).toBe(2);
  expect(oldProperty['Bed 1'].standardAch).toBe(1);
  expect(oldProperty.Bath.standardAch).toBe(3);
  expect(oldProperty.WC.standardAch).toBe(2);
  expect(oldProperty.Lounge.indoor).toBe(21);
  expect(oldProperty['Bed 1'].indoor).toBe(18);
  const deviceOptions = await page.locator('#hl_lounge_ventilation_device option').allTextContents();
  expect(deviceOptions).toContain('Other heater flue');
  expect(deviceOptions).toContain('Other open flue (vertical duct)');
  await expect(page.locator('#hl_bridge_method')).toHaveValue('Percentage');
  await page.locator('#hl_property_age_band').selectOption('K');
  const modernProperty = await page.evaluate(() =>
    Object.fromEntries(window.heatLossResultsV60.rooms.map(room => [room.roomName, room.indoor]))
  );
  expect(modernProperty['Bed 1']).toBe(21);
  const lounge = await page.evaluate(() =>
    window.heatLossResultsV60.rooms.find(room => room.roomName === 'Lounge')
  );
  expect(lounge.complete).toBe(true);
  expect(lounge.radiatorRequirementWatts).toBeCloseTo(lounge.totalWatts / 0.9, 5);
});
test('postcode lookup failure leaves manual temperatures usable', async ({ page }) => {
  await page.route('https://api.postcodes.io/**', route => route.abort());
  await page.locator('#site_postcode').fill('SW1A 1AA');
  await page.locator('#radsTab').click();
  await page.locator('#hl_lookup_postcode').click();
  await expect(page.locator('#hl_postcode_lookup_status')).toContainText(
    /could not|unavailable|check/i
  );
  await expect(page.locator('#hl_outdoor_temp')).toBeEditable();
});

test('print output contains the heat-loss sheet', async ({ page }) => {
  const html = await page.evaluate(() =>
    buildPrintHtml('Smoke test', ['Front', 'Rads'], 'portrait'));
  expect(html).toContain('Heat Loss');
  expect(html).toContain('Smoke test');
});

test('coalesces typing into one preview render and delayed autosave', async ({ page }) => {
  const result = await page.evaluate(async () => {
    if (!window.SurveyPerformance) return null;
    window.SurveyPerformance.resetStats();
    const field = document.getElementById('site_address');
    for (const value of ['1', '12', '123', '123 T', '123 Te']) {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    const duringTyping = window.SurveyPerformance.getStats();
    field.dispatchEvent(new Event('change', { bubbles: true }));
    const afterChange = window.SurveyPerformance.getStats();
    return { duringTyping, afterChange, saved: JSON.parse(localStorage.getItem('surveyWebData')).site_address };
  });

  expect(result).not.toBeNull();
  expect(result.duringTyping.renders).toBe(1);
  expect(result.duringTyping.autosaves).toBe(0);
  expect(result.afterChange.renders).toBe(2);
  expect(result.afterChange.autosaves).toBe(1);
  expect(result.saved).toBe('123 Te');
});

test('coalesces section badge refreshes while typing', async ({ page }) => {
  const result = await page.evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 350));
    window.SurveyPerformance.resetStats();
    const field = document.getElementById('site_address');
    for (const value of ['1', '12', '123', '123 T', '123 Te']) {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return window.SurveyPerformance.getStats();
  });

  expect(result.badgeUpdates).toBe(1);
});

test('skips inactive legacy heat-loss processing for general survey input', async ({ page }) => {
  const result = await page.evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 350));
    window.SurveyPerformance.resetStats();
    const field = document.getElementById('site_address');
    field.value = '12 Test Street';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => requestAnimationFrame(resolve));
    return window.SurveyPerformance.getStats();
  });

  expect(result.heatLossSyncs).toBe(0);
});

test('routes ordinary typing directly to the deferred preview scheduler', async ({ page }) => {
  const result = await page.evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 350));
    window.SurveyPerformance.resetStats();
    const field = document.getElementById('site_address');
    for (const value of ['1', '12', '123', '123 T', '123 Te']) {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return window.SurveyPerformance.getStats();
  });

  expect(result.inputUpdateCalls).toBe(0);
});

test('tablet layout exposes DHDG controls with touch-sized fields', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.locator('#radsTab').click();
  await expect(page.locator('#hl_ventilation_age_category')).toBeVisible();
  await expect(page.locator('#hl_reheat_factor')).toBeVisible();
  await expect(page.locator('#hl_high_ceiling_factor')).toBeVisible();
  await expect(page.locator('#hl_lounge_internal_segment_1_length')).toBeAttached();
  const metrics = await page.evaluate(() => {
    const summary = document.querySelector('.hl-summary-grid');
    const controls = [...document.querySelectorAll('#heatLossSummaryCard input:not([type="hidden"]), #heatLossSummaryCard select, .hl-room-body input:not([type="hidden"]), .hl-room-body select')].filter(control => control.getBoundingClientRect().height > 0);
    return {
      columns: getComputedStyle(summary).gridTemplateColumns,
      minControlHeight: Math.min(...controls.map(control => control.getBoundingClientRect().height)),
      segmentCount: document.querySelectorAll('.hl-room-dropdown[data-hl-room="lounge"] .hl-segment-card').length
    };
  });
  expect(metrics.columns).not.toBe('none');
  expect(metrics.minControlHeight).toBeGreaterThanOrEqual(44);
  expect(metrics.segmentCount).toBe(4);
});

test('construction presets include the small DHDG reference set', async ({ page }) => {
  await page.locator('#radsTab').click();
  const result = await page.evaluate(() => {
    const set = (id, value) => {
      const field = document.getElementById(id);
      field.value = value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('rad_lounge_len', '4');
    set('rad_lounge_wid', '3');
    set('rad_lounge_outside', '1');
    set('hl_lounge_wall_type', 'Brick, open cavity, 100mm aerated block + 13mm plaster');
    set('hl_lounge_window_type', 'No windows');
    set('hl_lounge_window_count', '0');
    set('hl_lounge_door_type', 'No external door');
    set('hl_lounge_door_count', '0');
    set('hl_lounge_floor_type', 'Uninsulated solid ground floor, DHDG example');
    set('hl_lounge_loft_type', 'Flat roof, 200mm insulation, DHDG example');
    set('hl_lounge_ventilation_mode', 'Automatic');
    const oneHundred = window.heatLossResultsV60.rooms.find(room => room.roomName === 'Lounge');
    set('hl_lounge_wall_type', 'Brick, open cavity, 125mm aerated block + 13mm plaster');
    const oneTwentyFive = window.heatLossResultsV60.rooms.find(room => room.roomName === 'Lounge');
    return { oneHundred, oneTwentyFive };
  });
  expect(result.oneHundred.complete).toBe(true);
  expect(result.oneHundred.wallU).toBeCloseTo(0.87, 5);
  expect(result.oneHundred.floorU).toBeCloseTo(0.85, 5);
  expect(result.oneHundred.roofU).toBeCloseTo(0.17, 5);
  expect(result.oneTwentyFive.wallU).toBeCloseTo(0.77, 5);
});
test('browser calculation uses signed gains, chimney ACH and room allowances', async ({ page }) => {
  await page.locator('#radsTab').click();
  await page.evaluate(() => {
    const values = {
      rad_lounge_len: '4',
      rad_lounge_wid: '3',
      rad_lounge_outside: '1',
      hl_lounge_wall_type: 'Cavity wall, insulated',
      hl_lounge_window_type: 'No windows',
      hl_lounge_window_count: '0',
      hl_lounge_door_type: 'No external door',
      hl_lounge_door_count: '0',
      hl_lounge_floor_type: 'Insulated solid ground floor',
      hl_lounge_loft_type: 'Plasterboard with 200mm insulation',
      hl_lounge_ventilation_mode: 'Automatic',
      hl_lounge_ventilation_device: 'Open chimney',
      hl_lounge_chimney_restricted: 'No',
      hl_lounge_radiator_installation: '0.8',
      hl_lounge_radiator_finish: '0.85',
      hl_lounge_internal_segment_1_length: '3',
      hl_lounge_internal_segment_1_type: 'Heated room, aerated block',
      hl_lounge_internal_segment_1_adjacent_room: 'bath',
      hl_reheat_factor: '1.1'
    };
    for (const [id, value] of Object.entries(values)) {
      const field = document.getElementById(id);
      field.value = value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.waitForTimeout(100);
  const lounge = await page.evaluate(() =>
    window.heatLossResultsV60.rooms.find(room => room.roomName === 'Lounge')
  );
  expect(lounge.complete, JSON.stringify({ warnings: lounge.warnings, missing: lounge.missing })).toBe(true);
  expect(lounge.internalWallWatts).toBeLessThan(0);
  expect(lounge.chimneyAch).toBe(5);
  expect(lounge.factorMultiplier).toBeCloseTo(1.1, 5);
  expect(lounge.radiatorOutputFactor).toBeCloseTo(0.68, 5);
  expect(lounge.totalWatts).toBeCloseTo(lounge.baseTotalWatts * 1.1, 5);
});

test('new radiator sizing hides existing details and keeps like-for-like in the radiator picker', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const key = 'lounge';
    const outcome = document.getElementById(`rad_${key}_outcome`);
    const existingWrap = document.getElementById(`hl_${key}_existing_radiator_fields`);
    const existingSize = document.getElementById(`rad_${key}_ex_size`);

    const choose = (field, value) => {
      field.value = value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const waitForRender = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    choose(outcome, 'New radiator required');
    await waitForRender();
    const hiddenForNewRadiator = existingWrap.hidden;

    choose(outcome, 'Assess existing radiator');
    await waitForRender();
    const visibleForAssessment = !existingWrap.hidden;
    const installedSize = [...existingSize.options].find(option => option.value)?.value;
    choose(existingSize, installedSize);
    await waitForRender();

    const newSize = document.getElementById(`rad_${key}_new_size`);
    return {
      outcomeLabels: [...outcome.options].map(option => option.textContent),
      hiddenForNewRadiator,
      visibleForAssessment,
      newSizeLabels: newSize && newSize.tagName === 'SELECT'
        ? [...newSize.options].map(option => option.textContent)
        : []
    };
  });

  expect(result.outcomeLabels).toEqual([
    'Size a new radiator',
    'Assess the existing radiator',
    'Replace existing radiator like for like',
    'Customer refused radiator work'
  ]);
  expect(result.hiddenForNewRadiator).toBe(true);
  expect(result.visibleForAssessment).toBe(true);
  expect(result.newSizeLabels).toContain('Replace existing radiator like for like');
});

test('shows the radiator outcome, required kW and usable laptop input width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('#radsTab').click();
  await page.evaluate(() => {
    let element = document.getElementById('rad_lounge_len');
    while (element) {
      if (element.tagName === 'DETAILS') element.open = true;
      element = element.parentElement;
    }
    document.querySelector('details[data-hl-room="lounge"]').open = true;
  });

  const values = {
    rad_lounge_len: '5',
    rad_lounge_wid: '4',
    rad_lounge_outside: '1',
    hl_lounge_wall_type: 'Cavity wall, insulated',
    hl_lounge_window_type: 'No windows',
    hl_lounge_window_count: '0',
    hl_lounge_door_type: 'No external door',
    hl_lounge_door_count: '0',
    hl_lounge_floor_type: 'Insulated solid ground floor',
    hl_lounge_loft_type: 'Plasterboard with 200mm insulation',
    hl_lounge_ventilation_mode: 'Automatic'
  };
  await page.evaluate((values) => {
    for (const [id, value] of Object.entries(values)) {
      const field = document.getElementById(id);
      field.value = value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, values);
  const outcome = page.locator('#rad_lounge_outcome');
  await expect(outcome).toBeVisible();
  await expect(outcome).toHaveValue('New radiator required');
  await expect(outcome.locator('option')).toHaveText([
    'Size a new radiator',
    'Assess the existing radiator',
    'Replace existing radiator like for like',
    'Customer refused radiator work'
  ]);
  await expect(page.locator('#hl_lounge_radiator_requirement')).toHaveText(
    /^Required radiator output: \d+\.\d{2} kW \(\d+ W\)$/
  );
  await expect(page.locator('label[for="rad_lounge_new_size"]')).toContainText('Replacement radiator');
  await expect(page.locator('#rad_lounge_new_size option').filter({ hasText: 'kW' }).first()).toBeAttached();

  const metrics = await page.evaluate(() => ({
    sidebarWidth: document.querySelector('.sidebar').getBoundingClientRect().width,
    mainMinWidth: getComputedStyle(document.querySelector('.main')).minWidth,
    outcomeWidth: document.getElementById('rad_lounge_outcome').getBoundingClientRect().width,
    appColumns: getComputedStyle(document.querySelector('.app')).gridTemplateColumns
  }));
  expect(metrics.sidebarWidth).toBeGreaterThanOrEqual(440);
  expect(metrics.mainMinWidth).toBe('0px');
  expect(metrics.outcomeWidth).toBeGreaterThanOrEqual(300);
  expect(metrics.appColumns).toMatch(/^4\d{2}px/);
});
