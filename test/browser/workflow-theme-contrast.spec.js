const { test, expect } = require('@playwright/test');
const measure = require('./helpers/contrast-audit');

for (const width of [1280, 390]) for (const theme of ['light', 'dark']) {
  test(`workflow text stays readable in ${theme} mode at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({width, height:844});
    await page.addInitScript(t => localStorage.setItem('surveyTheme', t), theme);
    const errors=[];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Synthetic theme audit' : undefined));
    await page.goto('/index.html');
    async function check(state) {
      const audit = await page.evaluate(measure);
      expect(audit.theme).toBe(theme);
      expect(audit.measuredCount, state + ' must measure rendered text').toBeGreaterThanOrEqual(10);
      expect.soft(audit.failures, state + ' below WCAG text contrast').toEqual([]);
      expect(await page.locator('html').evaluate(e => e.scrollWidth <= e.clientWidth), state + ' overflow').toBe(true);
    }
    await check('Front');
    await page.locator('#radsTab').click(); await check('Rads unstarted');
    await page.locator('#hl_calculation_assumptions > summary').click(); await check('Rads assumptions');
    await page.evaluate(() => {
      const values={r_ceiling:'2.4',hl_outdoor_temp:'-3',hl_ground_temp:'10',hl_property_age_band:'H',hl_bridge_method:'Percentage',rad_lounge_len:'4',rad_lounge_wid:'3',rad_lounge_outside:'1',hl_lounge_internal_wall_count:'0',hl_lounge_wall_type:'Cavity wall, insulated',hl_lounge_window_type:'No windows',hl_lounge_door_type:'No external door',hl_lounge_floor_type:'Insulated solid ground floor',hl_lounge_loft_type:'Solid concrete ceiling to another flat, uninsulated',hl_lounge_ventilation_mode:'Automatic',hl_lounge_ventilation_device:'No additional vent or flue'};
      for(const[id,value] of Object.entries(values)) {
        const field=document.getElementById(id); if(!field) throw Error('Missing '+id);
        field.value=value; if(field.value!==value) throw Error('Rejected '+id);
        field.dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(!window.heatLossResultsV60.rooms.find(r=>r.key==='lounge').complete) throw Error('Incomplete fixture');
    });
    await check('Rads complete');
    await page.locator('.hl-room-editor.is-active').getByRole('button',{name:'Hide room',exact:true}).click();
    await check('Hidden room');
    await page.locator('.hidden-room-pill-v50').filter({hasText:'Lounge'}).getByRole('button',{name:'Show',exact:true}).click();
    await check('Restored room');
    await page.locator('#a12aTab').click(); await check('A12a');
    await page.locator('#profileTab').click(); await check('Profile signatures');
    await page.locator('#frontTab').click();
    await page.locator('#moreToggleV58').click(); await check('More menu'); await page.keyboard.press('Escape');
    await page.locator('#surveyListBtnV57').click(); await check('Empty Surveys dialog');
    await page.getByRole('button',{name:'Save to list',exact:true}).click(); await check('Saved Surveys dialog'); await page.keyboard.press('Escape');
    await page.locator('#savePdfsBtn').click(); await check('PDF checklist'); await page.keyboard.press('Escape');
    await page.locator('#layoutTab').click(); await check('Layout empty');
    await page.getByRole('button',{name:'Rectangle',exact:true}).click(); await check('Layout drawing');
    await page.locator('#layoutMore').click(); await check('Layout options');
    await page.locator('#layoutOutlineOptions').click(); await check('Layout outline options');
    expect(errors).toEqual([]);
  });
}
