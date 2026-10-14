const {test,expect}=require('@playwright/test');
const {setFields}=require('../helpers/reference-natural-driver.js');
const fields=require('../fixtures/reference-natural-multifloor-survey.json');

// Two stacked rooms: the ground-floor room records a heated ceiling and the
// first-floor room records a heated floor, so the survey itself states that the
// inter-storey interface exists without recording a plan overlap.
async function prepareMultiStorey(page){
  await page.goto('/index.html');
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.locator('#radsTab').click();
  await setFields(page,fields);
  await setFields(page,{hl_lounge_internal_wall_count:'0',hl_kitchen_internal_wall_count:'0'});
  await page.waitForFunction(()=>window.heatLossResultsV60?.includedRooms?.length===2);
}

test('a two-storey survey resolves the inter-storey boundary without changing boiler results',async({page})=>{
  await prepareMultiStorey(page);
  const before=await page.evaluate(()=>JSON.stringify(window.heatLossResultsV60));
  const state=await page.evaluate(()=>({reference:window.referenceNaturalCheckV1,boiler:JSON.stringify(window.heatLossResultsV60)}));
  expect(state.reference.available,JSON.stringify(state.reference.reason)).toBe(true);
  expect(state.reference.basis).toMatch(/2 recorded storeys/);
  expect(state.reference.basis).toMatch(/estimated zone height 4\.8/);
  expect(state.reference.basis).toMatch(/CIBSE DHDG 2026 Table 2-45/);
  expect(state.boiler).toBe(before);
  const rooms=state.reference.result.rooms;
  expect(rooms).toHaveLength(2);
  const boundary=room=>room.elements.find(e=>e.name.startsWith('intermediate-ceiling')||e.name.startsWith('intermediate-floor'));
  const lower=boundary(rooms[0]),upper=boundary(rooms[1]);
  // Both sides are the same physical interface, so they must use one construction,
  // one shared area and equal-and-opposite signed watts. The exposed result object
  // carries the RESOLVED effective U (construction U plus the internal bridge).
  expect(lower.effectiveU).toBeCloseTo(1.83,9);
  expect(upper.effectiveU).toBeCloseTo(1.83,9);
  expect(lower.netArea).toBe(12);
  expect(upper.netArea).toBe(12);
  expect(lower.bridgeFactor).toBe(0.1);
  expect(lower.totalWatts).toBeCloseTo(65.88,6);
  expect(upper.totalWatts).toBeCloseTo(-65.88,6);
  // The interface splits the room demands and must not enter the building demand.
  const withoutInterface=rooms.reduce((sum,room)=>sum+room.elements
    .filter(e=>!e.name.startsWith('intermediate-ceiling')&&!e.name.startsWith('intermediate-floor'))
    .reduce((sub,e)=>sub+e.totalWatts,0)+room.ventilation.zoneVentilationWatts,0);
  expect(state.reference.result.buildingWatts).toBeCloseTo(withoutInterface,6);
  expect(state.reference.result.emitterDemandWatts).toBeGreaterThan(state.reference.result.buildingWatts);
  expect(state.reference.result.equipmentSizingEnabled).toBe(false);
  await page.locator('#hl_design_review > summary').click();
  await expect(page.locator('#hl_reference_natural_summary')).toContainText('Building demand');
  await expect(page.locator('#hl_reference_natural_summary')).toContainText('Shared interfaces');
  const printed=await page.evaluate(()=>buildPrintHtml('Reference check',['Heat Loss'],'portrait'));
  expect(printed).toContain('CIBSE DHDG 2026 Table 2-45');
  expect(printed).toContain('not used for equipment sizing');
});

test('an inter-storey boundary without a recorded complementary room reports a named reason',async({page})=>{
  await prepareMultiStorey(page);
  await setFields(page,{hl_kitchen_floor_type:'Insulated solid ground floor'});
  const reference=await page.evaluate(()=>window.referenceNaturalCheckV1);
  expect(reference.available).toBe(false);
  expect(reference.reason).toMatch(/complementary heated floor/);
  expect(reference.reason).not.toMatch(/single-storey/);
  await page.locator('#hl_design_review > summary').click();
  await expect(page.locator('#hl_reference_natural_summary')).toContainText('unavailable');
});

test('a storey count of 4+ reports the storey count the exposure coefficient needs',async({page})=>{
  await prepareMultiStorey(page);
  await setFields(page,{hl_ventilation_storeys:'4+'});
  const reference=await page.evaluate(()=>window.referenceNaturalCheckV1);
  expect(reference.available).toBe(false);
  expect(reference.reason).toMatch(/1 to 4 ventilation-zone storeys/);
});
