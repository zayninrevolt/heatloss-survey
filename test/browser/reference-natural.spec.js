const {test,expect}=require('@playwright/test');
const {prepare,setFields}=require('../helpers/reference-natural-driver.js');
const vendor=require('../fixtures/heat-engineer-reference.json');
test.beforeEach(async({page})=>{await prepare(page);});
test('natural reference check reads Lounge 21 and Kitchen 18 without changing boiler results',async({page})=>{
 const before=await page.evaluate(()=>JSON.stringify(window.heatLossResultsV60));
 await expect(page.locator('#hl_reference_natural_summary')).toHaveCount(1);
 const state=await page.evaluate(()=>({reference:window.referenceNaturalCheckV1,boiler:JSON.stringify(window.heatLossResultsV60)}));
 expect(state.reference.available).toBe(true);
 expect(state.reference.result.rooms.map(r=>r.ventilation.indoorTemperature)).toEqual([21,18]);
 expect(state.reference.result.buildingWatts).toBeGreaterThan(0);
 expect(state.reference.result.emitterDemandWatts).toBeGreaterThan(state.reference.result.buildingWatts);
 expect(state.reference.result.equipmentSizingEnabled).toBe(false);
 expect(state.boiler).toBe(before);
 await page.locator('#hl_design_review > summary').click();
 await expect(page.locator('#hl_reference_natural_summary')).toContainText('Building demand');
 await expect(page.locator('#hl_reference_natural_summary')).toContainText('not used for equipment sizing');
 const printed=await page.evaluate(()=>buildPrintHtml('Reference check',['Heat Loss'],'portrait'));
 expect(printed).toContain('Natural ventilation reference check');
 expect(printed).toContain('not used for equipment sizing');
 expect(printed).toContain((state.reference.result.buildingWatts/1000).toFixed(2)+' kW');
});
test('natural reference check clearly refuses unsupported mechanical ventilation',async({page})=>{
 await setFields(page,{hl_ventilation_system:'Mechanical ventilation with heat recovery (MVHR)'});
 const state=await page.evaluate(()=>window.referenceNaturalCheckV1);
 expect(state.available).toBe(false);
 expect(state.reason).toMatch(/mechanical/i);
 await page.locator('#hl_design_review > summary').click();
 await expect(page.locator('#hl_reference_natural_summary')).toContainText('unavailable');
});
test('browser-loaded reference modules match all five actual vendor captures',async({page})=>{
 const outputs=await page.evaluate(f=>{
   const p=f.conditions;
   return f.cases.map(c=>{
     const rooms=c.rooms.map((row,i)=>{
       const indoor=c.temperatures[i],door=i?0:p.loungeDoorArea;
       const common={indoorTemperature:indoor,propertyAgeBand:p.ageBand,bridgeCategory:'known-u',bridgeFactor:0.15,openingAreas:[]};
       const el=(name,grossArea,uValue,boundaryTemperature,extra={})=>({name,...common,grossArea,uValue,boundaryTemperature,...extra});
       return {id:i?'kitchen':'lounge',volume:c.volumes[i],envelopeArea:c.envelopes[i],indoorTemperature:indoor,elements:[
         el('wall',c.externalLengths[i]*p.height,p.wallU,p.outdoor,{openingAreas:[p.windowAreaEach,door]}),
         el('window',p.windowAreaEach,p.windowU,p.outdoor),el('door',door,p.doorU,p.outdoor),
         el('floor',c.areas[i],p.floorU,p.ground),el('roof',c.areas[i],p.roofU,p.outdoor),
         el('internal',3*2.4,p.internalWallU,c.adjacentTemperatures[i],{bridgeFactor:0.1,heatedTransfer:true})]};
     });
     const result=window.ReferenceNaturalDesign.calculate({rooms,outdoorTemperature:p.outdoor,permeability50:12,zoneHeight:2.4,baseHeight:0,exposedFacades:4,shielding:c.shielding,directionFactor:2});
     return {label:c.label,building:result.buildingWatts,emitters:result.emitterDemandWatts};
   });
 },vendor);
 expect(outputs).toHaveLength(vendor.cases.length);
 outputs.forEach((r,i)=>{expect(r.building).toBeCloseTo(vendor.cases[i].zoneTotal,8);expect(r.emitters).toBeCloseTo(vendor.cases[i].emitterTotal,8);});
});
