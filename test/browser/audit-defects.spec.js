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

test('Rads uses one active room editor with a persistent room navigator', async ({ page }) => {
  await expect(page.locator('#hl_room_navigator')).toBeVisible();
  await expect(page.locator('.hl-room-editor.is-active')).toHaveCount(1);
  await expect(page.locator('.hl-room-editor:visible')).toHaveCount(1);
  await expect(page.locator('.hl-room-editor.is-active > details > summary')).toBeHidden();
  await expect(page.locator('.hl-room-editor.is-active #rad_lounge_len')).toBeVisible();
  // The room editor is ordered the way a room is surveyed.
  await expect(page.locator('.hl-room-editor.is-active .hl-room-section h4')).toHaveText([
    'Dimensions and exposure',
    'Windows and external doors',
    'Floor, ceiling and evidence',
    'Ventilation and air change'
  ]);

  const initial = await page.evaluate(() => ({
    active: document.querySelector('.hl-room-editor.is-active').dataset.hlRoom,
    roomButtons: document.querySelectorAll('#hl_room_navigator [data-hl-room-nav]').length,
    loungeLength: document.getElementById('rad_lounge_len').value
  }));
  expect(initial.active).toBe('lounge');
  expect(initial.roomButtons).toBeGreaterThan(1);
  expect(initial.loungeLength).toBe('4');

  const scrollRequest = await page.evaluate(() => {
    const navigator = document.getElementById('hl_room_navigator');
    window.__roomNavigatorScroll = null;
    navigator.scrollIntoView = options => { window.__roomNavigatorScroll = options; };
    document.querySelector('[data-room-completion-button="lounge"]').click();
    return window.__roomNavigatorScroll;
  });
  expect(scrollRequest).toEqual({ behavior: 'smooth', block: 'start' });
  await expect(page.locator('.hl-room-editor.is-active #rad_lounge_len')).toBeVisible();

  await page.locator('#hl_room_navigator [data-hl-room-nav]').nth(1).click();
  const switched = await page.evaluate(() => ({
    active: document.querySelector('.hl-room-editor.is-active').dataset.hlRoom,
    visibleEditors: [...document.querySelectorAll('.hl-room-editor')]
      .filter(editor => getComputedStyle(editor).display !== 'none').length,
    loungeLength: document.getElementById('rad_lounge_len').value,
    loungeEditorDisplay: getComputedStyle(document.querySelector('.hl-room-editor[data-hl-room="lounge"]')).display
  }));
  expect(switched.active).not.toBe('lounge');
  expect(switched.visibleEditors).toBe(1);
  expect(switched.loungeLength).toBe('4');
  expect(switched.loungeEditorDisplay).toBe('none');
});

test('Rads prioritises rooms and reveals only the inputs relevant to the survey choice', async ({ page }) => {
  const initial = await page.evaluate(() => {
    const rooms = document.getElementById('hl_rooms_card');
    const summary = document.getElementById('heatLossSummaryCard');
    const fieldWrap = id => document.getElementById(id)?.closest('.field') || null;
    return {
      roomsImmediatelyAfterSetup: rooms.previousElementSibling === summary,
      assumptionsClosed: document.getElementById('hl_calculation_assumptions')?.open === false,
      focusButton: document.getElementById('hl_rads_focus_toggle')?.textContent.trim(),
      outputIsResult: fieldWrap('r_output_temp')?.hidden === true &&
        document.getElementById('hl_recommended_system_output')?.textContent.trim(),
      manualAchHidden: fieldWrap('hl_lounge_manual_ach')?.hidden,
      chimneyHidden: fieldWrap('hl_lounge_chimney_restricted')?.hidden,
      rooflightAreaHidden: fieldWrap('hl_lounge_rooflight_area')?.hidden,
      knownDoorUHidden: fieldWrap('hl_internal_door_known_u')?.hidden,
      mvhrHidden: fieldWrap('hl_mvhr_efficiency')?.hidden,
      radiatorControlsGrouped: [
        'hl_lounge_shared_radiator_with',
        'hl_lounge_radiator_installation',
        'hl_lounge_radiator_finish',
        'hl_lounge_rad_quantity'
      ].every(id => document.querySelector('#hl_lounge_radiator_panel')
        ?.contains(document.getElementById(id)))
    };
  });
  expect(initial.roomsImmediatelyAfterSetup).toBe(true);
  expect(initial.assumptionsClosed).toBe(true);
  expect(initial.focusButton).toBe('Focus on form');
  expect(initial.outputIsResult).toMatch(/12\.00 kW/);
  expect(initial.manualAchHidden).toBe(true);
  expect(initial.chimneyHidden).toBe(true);
  expect(initial.rooflightAreaHidden).toBe(true);
  expect(initial.knownDoorUHidden).toBe(true);
  expect(initial.mvhrHidden).toBe(true);
  expect(initial.radiatorControlsGrouped).toBe(true);

  await page.evaluate(() => {
    const set = (id, value) => {
      const field = document.getElementById(id);
      field.value = value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('hl_lounge_ventilation_mode', 'Manual override');
    set('hl_lounge_ventilation_device', 'Open chimney');
    set('hl_lounge_rooflight_type', 'Double or triple glazed roof window, 2002 to 2021');
    set('hl_internal_door_type', 'Known manufacturer/design U-value');
    set('hl_ventilation_system', 'Mechanical ventilation with heat recovery (MVHR)');
  });
  const revealed = await page.evaluate(() => {
    const fieldWrap = id => document.getElementById(id)?.closest('.field') || null;
    return {
      manualAch: !fieldWrap('hl_lounge_manual_ach').hidden,
      chimney: !fieldWrap('hl_lounge_chimney_restricted').hidden,
      rooflightArea: !fieldWrap('hl_lounge_rooflight_area').hidden,
      knownDoorU: !fieldWrap('hl_internal_door_known_u').hidden,
      mvhr: !fieldWrap('hl_mvhr_efficiency').hidden
    };
  });
  expect(revealed).toEqual({ manualAch: true, chimney: true, rooflightArea: true, knownDoorU: true, mvhr: true });

  await page.locator('#hl_rads_focus_toggle').click();
  await expect(page.locator('body')).toHaveClass(/hl-rads-focus-mode/);
  await expect(page.locator('#hl_rads_focus_toggle')).toHaveText('Show preview');
});

test('Rads focus mode is left when switching to another survey tab', async ({ page }) => {
  await page.locator('#radsTab').click();
  await page.locator('#hl_rads_focus_toggle').click();
  await expect(page.locator('body')).toHaveClass(/hl-rads-focus-mode/);
  await expect(page.locator('.main')).toBeHidden();

  await page.locator('#frontTab').click();
  await expect(page.locator('body')).not.toHaveClass(/hl-rads-focus-mode/);
  await expect(page.locator('.main')).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Front' })).toBeVisible();
});

test('Rads keeps the external wall count with the room dimensions', async ({ page }) => {
  await page.locator('#radsTab').click();
  const wallCount = page.locator('#rad_lounge_outside');
  await expect(wallCount).toBeVisible();
  await expect(wallCount.locator('xpath=ancestor::section[contains(@class, "hl-room-section-dimensions")]'))
    .toHaveCount(1);
});

test('flat rooflights replace opaque roof area instead of adding overlapping loss', async ({ page }) => {
  const opaque = await room(page);
  expect(opaque.complete).toBe(true);
  await setFields(page, {
    hl_lounge_rooflight_type: 'Double or triple glazed roof window, 2002 to 2021', hl_lounge_rooflight_area: '2'
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
      hl_lounge_rooflight_type: 'Double or triple glazed roof window, 2002 to 2021', hl_lounge_rooflight_area: area
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
    hl_lounge_rooflight_type: 'Double or triple glazed roof window, 2002 to 2021', hl_lounge_rooflight_area: '2'
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

test('a survey saved before the calculation fixes warns before its results are reused', async ({ page }) => {
  // Seeds an envelope that predates the calculation-method stamp, before the app's
  // own scripts run, because the app re-saves the survey during load.
  await page.addInitScript(() => {
    const key = 'heatLossDataV60';
    const envelope = JSON.parse(localStorage.getItem(key) || '{"data":{}}');
    envelope.data = envelope.data || {};
    envelope.schemaVersion = 2;
    delete envelope.data._calcMethodVersion;
    delete envelope.data._schemaVersion;
    localStorage.setItem(key, JSON.stringify(envelope));
  });
  await page.reload();
  const banner = page.locator('#surveyReviewNotes');
  await expect(banner).toContainText(/saved before the calculation fixes/i);
  await expect(banner).toContainText(/recheck/i);
});

test('a survey saved by this app version loads without that warning', async ({ page }) => {
  await page.reload();
  await expect(page.locator('#surveyReviewNotes')).toHaveCount(0);
});

// The first room that is not the fixture's lounge, discovered at runtime because
// the room list is built dynamically.
async function secondRoomKey(page) {
  return page.evaluate(() =>
    window.heatLossResultsV60.rooms.map(r => r.key).find(k => k !== 'lounge'));
}

test('an unfinished survey is labelled provisional and names what is missing', async ({ page }) => {
  const key = await secondRoomKey(page);
  // Dimensions but no construction details: started, but not complete.
  await setFields(page, { ['rad_' + key + '_len']: '4', ['rad_' + key + '_wid']: '3' });

  const state = await page.evaluate(() => ({
    included: window.heatLossResultsV60.includedRooms.length,
    incomplete: window.heatLossResultsV60.incompleteRooms.length,
    provisional: window.heatLossResultsV60.provisional
  }));
  expect(state.included).toBe(1);
  expect(state.incomplete).toBe(1);
  expect(state.provisional).toBe(true);

  const detail = await page.locator('#hl_property_detail').innerText();
  expect(detail).toMatch(/provisional/i);
  expect(detail).toMatch(/1 incomplete/i);
  expect(detail).toMatch(/ventilation/i);
});

test('a complete survey is not labelled provisional', async ({ page }) => {
  const state = await page.evaluate(() => ({
    incomplete: window.heatLossResultsV60.incompleteRooms.length,
    provisional: window.heatLossResultsV60.provisional
  }));
  expect(state.incomplete).toBe(0);
  expect(state.provisional).toBe(false);
  await expect(page.locator('#hl_property_detail')).not.toContainText(/provisional/i);
});

test('printing an unfinished survey warns before equipment recommendations are saved', async ({ page }) => {
  const key = await secondRoomKey(page);
  await setFields(page, { ['rad_' + key + '_len']: '4', ['rad_' + key + '_wid']: '3' });

  const messages = [];
  page.on('dialog', async dialog => {
    messages.push(dialog.message());
    await dialog.dismiss();
  });
  await page.evaluate(() => window.printPdfPart('front'));

  expect(messages.join(' ')).toMatch(/unfinished/i);
  expect(messages.join(' ')).toMatch(/provisional/i);
});

test('the live survey labels its legacy ventilation method honestly', async ({ page }) => {
  await expect(page.locator('#hl_calculation_method_notice')).toContainText(
    'legacy room-by-room ventilation method'
  );
  await expect(page.locator('#hl_calculation_method_notice')).toContainText(
    'not yet used for equipment sizing'
  );
  await expect(page.locator('#hl_ventilation_system').locator('..')).toContainText(
    'legacy automatic room ACH table'
  );
});


test('derives the audit survey record from canonical property and job inputs', async ({ page }) => {
  await setFields(page, {
    site_surveyor: 'Richard Chamberlain',
    site_date: '2026-09-25',
    r_job: 'Q-2026-091'
  });

  await expect(page.locator('#hl_surveyor_name')).toHaveValue('Richard Chamberlain');
  await expect(page.locator('#hl_survey_date')).toHaveValue('2026-09-25');
  await expect(page.locator('#hl_survey_reference')).toHaveValue('Q-2026-091');

  const result = await page.evaluate(() => ({
    surveyorReadOnly: document.getElementById('hl_surveyor_name').readOnly,
    dateReadOnly: document.getElementById('hl_survey_date').readOnly,
    referenceReadOnly: document.getElementById('hl_survey_reference').readOnly,
    print: buildPrintHtml('Audit metadata', ['Heat Loss'], 'portrait')
  }));

  expect(result.surveyorReadOnly).toBe(true);
  expect(result.dateReadOnly).toBe(true);
  expect(result.referenceReadOnly).toBe(true);
  expect(result.print).toContain('Richard Chamberlain, 2026-09-25');
  expect(result.print).toContain('Reference: Q-2026-091');
});

test('migrates a legacy audit survey record into blank canonical inputs', async ({ page }) => {
  await page.evaluate(() => {
    setData({
      hl_surveyor_name: 'Legacy Surveyor',
      hl_survey_date: '2026-03-01',
      hl_survey_reference: 'LEG-301'
    });
  });

  await expect(page.locator('#site_surveyor')).toHaveValue('Legacy Surveyor');
  await expect(page.locator('#site_date')).toHaveValue('2026-03-01');
  await expect(page.locator('#r_job')).toHaveValue('LEG-301');
});

test('records standards-reference evidence without changing the legacy boiler calculation', async ({ page }) => {
  await setFields(page, {
    site_surveyor: 'A. Surveyor',
    site_date: '2026-09-15',
    r_job: 'CASE-15',
    rad_lounge_len: '4',
    rad_lounge_wid: '3',
    rad_lounge_outside: '1',
    hl_lounge_wall_type: 'Brick, open cavity, 100mm aerated block + 13mm plaster',
    hl_lounge_window_type: 'No windows',
    hl_lounge_window_count: '0',
    hl_lounge_door_type: 'No external door',
    hl_lounge_door_count: '0',
    hl_lounge_floor_type: 'Uninsulated solid ground floor, DHDG example',
    hl_lounge_loft_type: 'Flat roof, 200mm insulation, DHDG example'
  });
  const before = await page.evaluate(() => window.heatLossResultsV60.totalWatts);

  await page.locator('#hl_audit_evidence_details summary').click();
  await page.locator('#hl_dwelling_attachment').selectOption('Semi-detached');
  await page.locator('#hl_airtightness_method').selectOption('Standard default');
  await page.locator('#hl_ventilation_storeys').selectOption('2');
  await page.locator('#hl_ventilation_sheltered_sides').selectOption('2');
  await page.locator('#hl_ventilation_evidence_notes').fill('Two facades sheltered by neighbouring homes.');
  await page.evaluate(() => {
    for (const id of ['hl_design_station', 'hl_ground_station']) {
      const field = document.getElementById(id);
      field.value = 'Manchester';
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await expect(page.locator('#hl_reference_readiness')).toContainText(
    'Reference inputs complete'
  );

  const result = await page.evaluate(() => ({
    totalWatts: window.heatLossResultsV60.totalWatts,
    saved: JSON.parse(localStorage.getItem('surveyWebData')),
    print: buildPrintHtml('Audit evidence', ['Heat Loss'], 'portrait')
  }));

  expect(result.totalWatts).toBeCloseTo(before, 8);
  expect(result.saved.hl_surveyor_name).toBe('A. Surveyor');
  expect(result.saved.hl_dwelling_attachment).toBe('Semi-detached');
  expect(result.print).toContain('Building-load reference inputs');
  expect(result.print).toContain('Two facades sheltered by neighbouring homes.');
  expect(result.print).toContain('Reference inputs complete');
  expect(result.print).toContain('Legacy boiler calculation');
});

test('a custom radiator rating goes stale when the design temperature changes', async ({ page }) => {
  await setFields(page, {
    rad_lounge_outcome: 'Assess existing radiator',
    rad_lounge_ex_size: 'Custom radiator or towel rail',
    rad_lounge_ex_custom_kw: '1'
  });
  // Entered at the fixture design temperature, so nothing is stale yet.
  expect((await room(page)).warnings.join(' ')).not.toMatch(/design temperature/i);

  await setFields(page, { hl_radiator_temperature: '75' });
  const stale = (await room(page)).warnings.join(' ');
  expect(stale).toMatch(/design temperature/i);
  expect(stale).toMatch(/confirm/i);

  // Re-entering the figure records the new design temperature and clears it.
  await setFields(page, { rad_lounge_ex_custom_kw: '0.8' });
  expect((await room(page)).warnings.join(' ')).not.toMatch(/design temperature/i);
});
