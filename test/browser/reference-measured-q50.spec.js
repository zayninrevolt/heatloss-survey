'use strict';
const {test,expect}=require('@playwright/test');
const {prepare,setFields}=require('../helpers/reference-natural-driver');
test('recorded measured q50 feeds only the experimental check and follows independent room/zone longhand',async({page})=>{
 await prepare(page);
 const legacy=await page.evaluate(()=>JSON.stringify(window.heatLossResultsV60));
 for(const q50 of ['6','18']) {
  await setFields(page,{hl_airtightness_method:'Measured 50 Pa permeability',hl_measured_air_permeability_50:q50});
  const state=await page.evaluate(()=>({ref:window.referenceNaturalCheckV1,legacy:JSON.stringify(window.heatLossResultsV60)}));
  expect(state.ref.available,state.ref.reason).toBe(true);
  expect(state.legacy).toBe(legacy);
  expect(state.ref.result.equipmentSizingEnabled).toBe(false);
  const v=state.ref.result.ventilation;
  expect(v.permeability50).toBe(Number(q50));
  expect(v.permeabilitySource).toBe('entered-q50');
  const totalEnvelope=v.rooms.reduce((sum,r)=>sum+r.envelopeArea,0);
  const zoneFlow=Number(q50)*totalEnvelope*0.05;
  expect(v.zoneInfiltrationFlowM3h).toBeCloseTo(zoneFlow,9);
  for(const room of v.rooms) {
   const leakage=Number(q50)*room.envelopeArea*0.05;
   const minimum=room.envelopeArea?0.5*room.volume:0;
   const roomFlow=Math.max(Math.min(zoneFlow,2*leakage),minimum);
   const zoneRoomFlow=Math.max(leakage,0.5*minimum);
   expect(room.roomVentilationWatts).toBeCloseTo(0.34*roomFlow*(room.indoorTemperature+2.7),8);
   expect(room.zoneVentilationWatts).toBeCloseTo(0.34*zoneRoomFlow*(room.indoorTemperature+2.7),8);
  }
  const print=await page.evaluate(()=>buildPrintHtml('Measured check',['Heat Loss'],'portrait'));
  expect(print).toContain('Measured q50 '+q50);
 }
 await setFields(page,{hl_airtightness_method:'Standard default'});
 const restored=await page.evaluate(()=>window.referenceNaturalCheckV1);
 expect(restored.result.ventilation.permeability50).toBe(12);
 expect(restored.basis).toContain('Standard q50 12');
});
test('missing measured evidence and a design-ACH route fail closed without substituting defaults',async({page})=>{
 await prepare(page);
 await setFields(page,{hl_airtightness_method:'Measured 50 Pa permeability',hl_measured_air_permeability_50:''});
 let result=await page.evaluate(()=>window.referenceNaturalCheckV1);
 expect(result.available).toBe(false);expect(result.reason).toMatch(/positive.*measured|measured.*positive/i);
 await setFields(page,{hl_measured_air_permeability_50:'0'});
 result=await page.evaluate(()=>window.referenceNaturalCheckV1);
 expect(result.available).toBe(false);
 await setFields(page,{hl_airtightness_method:'Design infiltration ACH',hl_design_infiltration_ach:'0.4'});
 result=await page.evaluate(()=>window.referenceNaturalCheckV1);
 expect(result.available).toBe(false);expect(result.reason).toMatch(/design.*ACH/i);
});
