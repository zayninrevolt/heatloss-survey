const { test, expect } = require('@playwright/test');

async function setFields(page, values) {
  await page.evaluate(values => {
    for (const [id, value] of Object.entries(values)) {
      const field = document.getElementById(id);
      if (!field) throw Error('Missing ' + id);
      field.value = value;
      if (field.value !== value) throw Error('Rejected ' + id + '=' + value);
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, values);
}

async function openDefaults(page) {
  await page.evaluate(() => {
    for (let node = document.getElementById('hl_apply_defaults').parentElement; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#radsTab').click();
});

test('property and room internal-wall menus use exactly the same material choices', async ({ page }) => {
  const choices = await page.evaluate(() => {
    const options = id => Array.from(document.getElementById(id).options,
      option => ({ label: option.text, value: option.value }));
    return { property: options('hl_default_internal_wall'), room: options('hl_lounge_internal_wall_type') };
  });
  expect(choices.property).toEqual(choices.room);
  expect(choices.property.map(o => o.label)).toEqual([
    '', 'aerated block', 'breeze block', 'single brick', 'stud and plasterboard'
  ]);
  const indices = await page.evaluate(() => [
    document.getElementById('hl_default_internal_wall').selectedIndex,
    document.getElementById('hl_lounge_internal_wall_type').selectedIndex
  ]);
  expect(indices).toEqual([0, 0]);
});

const roomFields = {
  r_ceiling: '2.4', hl_outdoor_temp: '-3', hl_ground_temp: '10', hl_property_age_band: 'H',
  hl_bridge_method: 'Percentage', hl_reheat_factor: '1', hl_exposed_location: '1',
  hl_high_ceiling_factor: '1', hl_radiator_temperature: '55',
  rad_lounge_len: '4', rad_lounge_wid: '3', rad_lounge_outside: '1',
  hl_lounge_indoor_temp: '21', hl_lounge_wall_type: 'Cavity wall, insulated',
  hl_lounge_window_type: 'No windows', hl_lounge_window_count: '0',
  hl_lounge_door_type: 'No external door', hl_lounge_door_count: '0',
  hl_lounge_floor_type: 'Insulated solid ground floor',
  hl_lounge_loft_type: 'Plasterboard with 200mm insulation',
  hl_lounge_ventilation_mode: 'Automatic', hl_lounge_ventilation_device: 'No additional vent or flue',
  hl_lounge_internal_wall_count: '2', hl_lounge_internal_wall_type: 'Heated room, aerated block',
  hl_lounge_internal_segment_1_length: '6', hl_lounge_internal_segment_1_adjacent_temp: '10',
  hl_lounge_internal_segment_2_length: '5', hl_lounge_internal_segment_2_adjacent_temp: '18'
};

async function prepareRoom(page) {
  await setFields(page, roomFields);
  await setFields(page, { hl_lounge_internal_wall_count: '2' });
  const complete = await page.evaluate(() => window.heatLossResultsV60.rooms.find(r => r.key === 'lounge').complete);
  expect(complete).toBe(true);
}

async function preservedState(page) {
  return page.evaluate(() => {
    const data = getData();
    const protectedKeys = ['rad_lounge_len', 'rad_lounge_wid', 'hl_lounge_internal_wall_count',
      'hl_lounge_internal_wall_type', 'hl_lounge_internal_segment_1_length',
      'hl_lounge_internal_segment_1_adjacent_temp', 'hl_lounge_internal_segment_2_length',
      'hl_lounge_internal_segment_2_adjacent_temp'];
    return {
      fields: Object.fromEntries(protectedKeys.map(key => [key, data[key]])),
      totalWatts: window.heatLossResultsV60.totalWatts,
      roomWatts: window.heatLossResultsV60.rooms.find(r => r.key === 'lounge').totalWatts
    };
  });
}

test('loading an old unheated property default preserves room geometry and temperatures', async ({ page }) => {
  await prepareRoom(page);
  const before = await preservedState(page);
  await page.evaluate(() => setData({ ...getData(), hl_default_internal_wall: 'Unheated space, breeze block' }));
  await expect(page.locator('#hl_default_internal_wall')).toHaveValue('Heated room, breeze block');
  expect(await preservedState(page)).toEqual(before);
  await page.reload();
  await page.locator('#radsTab').click();
  await expect(page.locator('#hl_default_internal_wall')).toHaveValue('Heated room, breeze block');
  expect(await preservedState(page)).toEqual(before);
});

test('cancelling replacement of existing room choices leaves the survey unchanged', async ({ page }) => {
  await prepareRoom(page);
  await setFields(page, {
    hl_default_wall: '', hl_default_window: '',
    hl_default_internal_wall: 'Heated room, breeze block'
  });
  const before = await preservedState(page);
  const dialogs = [];
  page.on('dialog', async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
  });
  await openDefaults(page);
  await page.locator('#hl_apply_defaults').click();
  expect(await preservedState(page)).toEqual(before);
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0].type).toBe('confirm');
  expect(dialogs[0].message).toMatch(/replace existing room construction choices/i);
});

for (const material of ['aerated block', 'breeze block', 'single brick', 'stud and plasterboard']) {
  test(`applying the ${material} default never blanks a room construction`, async ({ page }) => {
    const value = 'Heated room, ' + material;
    await setFields(page, { hl_default_internal_wall: value });
    await openDefaults(page);
    await page.locator('#hl_apply_defaults').click();
    const rooms = await page.evaluate(() => Array.from(
      document.querySelectorAll('[id^="hl_"][id$="_internal_wall_type"]'),
      field => ({ value: field.value, index: field.selectedIndex })));
    expect(rooms.length).toBeGreaterThan(1);
    for (const room of rooms) {
      expect(room.value).toBe(value);
      expect(room.index).toBeGreaterThanOrEqual(0);
    }
  });
}

test('confirming defaults changes material only, preserving counts, lengths and boundary temperatures', async ({ page }) => {
  await prepareRoom(page);
  const before = await preservedState(page);
  await setFields(page, { hl_default_wall: '', hl_default_window: '',
    hl_default_internal_wall: 'Heated room, breeze block' });
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.type()); await dialog.accept(); });
  await openDefaults(page);
  await page.locator('#hl_apply_defaults').click();
  const after = await preservedState(page);
  expect(dialogs).toEqual(['confirm']);
  expect(after.fields).toEqual({ ...before.fields, hl_lounge_internal_wall_type: 'Heated room, breeze block' });
  const room = await page.evaluate(() => window.heatLossResultsV60.rooms.find(r => r.key === 'lounge'));
  expect(room.complete).toBe(true);
  expect(room.internalWallU).toBe(2.76);
  expect(after.totalWatts).not.toBe(before.totalWatts);
  await page.reload();
  await page.locator('#radsTab').click();
  expect(await preservedState(page)).toEqual(after);
});

test('a blank default leaves existing room materials untouched', async ({ page }) => {
  await prepareRoom(page);
  await setFields(page, { hl_default_wall: '', hl_default_window: '', hl_default_internal_wall: '' });
  const before = await preservedState(page);
  await openDefaults(page);
  await page.locator('#hl_apply_defaults').click();
  expect(await preservedState(page)).toEqual(before);
});

test('retired no-wall property defaults do not reset recorded room wall counts', async ({ page }) => {
  await prepareRoom(page);
  const before = await preservedState(page);
  await page.evaluate(() => setData({ ...getData(), hl_default_internal_wall: 'No internal wall included' }));
  await expect(page.locator('#hl_default_internal_wall')).toHaveValue('');
  expect(await page.locator('#hl_default_internal_wall').evaluate(el => el.selectedIndex)).toBe(0);
  expect(await preservedState(page)).toEqual(before);
});

test('an invalid default aborts before any room selection is changed', async ({ page }) => {
  await prepareRoom(page);
  await setFields(page, { hl_default_wall: 'Modern insulated wall', hl_default_window: '' });
  const before = await preservedState(page);
  await page.evaluate(() => {
    const field = document.getElementById('hl_default_internal_wall');
    field.add(new Option('Unsupported legacy choice', 'Unsupported legacy choice'));
    field.value = 'Unsupported legacy choice';
  });
  const dialogs = [];
  page.on('dialog', async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  });
  const wallBefore = await page.locator('#hl_lounge_wall_type').inputValue();
  await openDefaults(page);
  await page.locator('#hl_apply_defaults').click();
  expect(await preservedState(page)).toEqual(before);
  await expect(page.locator('#hl_lounge_wall_type')).toHaveValue(wallBefore);
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0].type).toBe('alert');
  expect(dialogs[0].message).toMatch(/No room selections have been changed/);
});
