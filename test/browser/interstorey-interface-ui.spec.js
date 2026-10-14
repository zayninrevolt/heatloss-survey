const {test,expect}=require('@playwright/test');
const {prepare,setFields}=require('../helpers/reference-natural-driver');
async function setup(page){await prepare(page);await setFields(page,{hl_ventilation_storeys:'2',hl_lounge_loft_type:'Heated room above',hl_kitchen_floor_type:'Heated room below',hl_lounge_internal_wall_count:'0',hl_kitchen_internal_wall_count:'0'});await page.evaluate(()=>window.selectRadiatorRoomV60('kitchen'));}
async function add(page,upper,lower,area,construction){
 await page.evaluate(k=>window.selectRadiatorRoomV60(k),upper);
 await page.locator('[data-if-add="'+upper+'"]').click();
 const row=page.locator('[data-if-upper="'+upper+'"] [data-if-row]').last();
 await row.locator('[data-if-field="lowerRoom"]').selectOption(lower);
 await row.locator('[data-if-field="area"]').fill(String(area));await row.locator('[data-if-field="area"]').press('Tab');
 await row.locator('[data-if-field="construction"]').selectOption(construction);
}
test('a measured insulated interface is entered once and shared on screen and print',async({page})=>{
 await setup(page);const before=await page.evaluate(()=>JSON.stringify(window.heatLossResultsV60));
 await add(page,'kitchen','lounge',12,'100mm insulation');
 const state=await page.evaluate(()=>({reference:window.referenceNaturalCheckV1,boiler:JSON.stringify(window.heatLossResultsV60),saved:getData()}));
 expect(state.boiler).toBe(before);expect(state.reference.available,state.reference.reason).toBe(true);
 const a=state.reference.result.rooms[0].elements.find(e=>e.name.startsWith('intermediate-ceiling'));
 const b=state.reference.result.rooms[1].elements.find(e=>e.name.startsWith('intermediate-floor'));
 expect(a.netArea).toBe(12);expect(a.effectiveU).toBeCloseTo(0.42,9);expect(a.totalWatts).toBeCloseTo((0.32+0.10)*12*3,8);expect(b.totalWatts).toBeCloseTo(-a.totalWatts,8);
 const links=JSON.parse(state.saved.hl_interstorey_interfaces);expect(links).toHaveLength(1);expect(links[0]).toEqual({upperRoom:'kitchen',lowerRoom:'lounge',area:12,construction:'100mm insulation'});
 await page.evaluate(()=>window.selectRadiatorRoomV60('lounge'));
 await expect(page.locator('#hl_lounge_interstorey_links')).toContainText('Kitchen');await expect(page.locator('#hl_lounge_interstorey_links')).toContainText('100mm insulation');
 expect(await page.locator('#hl_lounge_interstorey_links [data-if-field]').count()).toBe(0);
 const print=await page.evaluate(()=>buildPrintHtml('Interfaces',['Heat Loss'],'portrait'));
 expect(print).toContain('100mm insulation');expect(print).toContain('12.00 m²');expect(print).toContain('CIBSE DHDG 2026 Table 2-45');
});
test('shared-interface controls fit the room editor and hostile labels cannot execute markup',async({page})=>{
 await setup(page);await add(page,'kitchen','lounge',12,'Uninsulated');
 const row=page.locator('[data-if-upper="kitchen"] [data-if-row]').last();
 const width=await row.locator('[data-if-field="construction"]').evaluate(e=>e.getBoundingClientRect().width);
 expect(width).toBeGreaterThanOrEqual(180);
 await page.evaluate(()=>{document.getElementById('hl_interstorey_interfaces').value=JSON.stringify([{upperRoom:'kitchen',lowerRoom:'lounge',area:12,construction:'<img src=x onerror="window.ifPwned=true">'}]);update();window.selectRadiatorRoomV60('lounge');});
 await expect(page.locator('#hl_lounge_interstorey_links')).toContainText('<img');expect(await page.locator('#hl_lounge_interstorey_links img').count()).toBe(0);expect(await page.evaluate(()=>window.ifPwned)).toBeUndefined();
});
module.exports={setup,add};
test('malformed shared-interface data refuses the reference check without crashing the saved boiler survey',async({page})=>{
 await setup(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const original=await page.evaluate(()=>JSON.stringify(window.heatLossResultsV60));
 await page.evaluate(()=>{document.getElementById('hl_interstorey_interfaces').value='[null]';update();});
 const result=await page.evaluate(()=>({ref:window.referenceNaturalCheckV1,legacy:JSON.stringify(window.heatLossResultsV60)}));
 expect(result.ref.available).toBe(false);expect(result.ref.reason).toMatch(/record|interface/i);expect(result.legacy).toBe(original);expect(errors).toEqual([]);
});
test('unequal footprints use the measured overlap and account for the exposed remainder',async({page})=>{
 await setup(page);await setFields(page,{rad_lounge_len:'5',rad_lounge_wid:'4'});
 await add(page,'kitchen','lounge',8,'Uninsulated');
 let ref=await page.evaluate(()=>window.referenceNaturalCheckV1);expect(ref.available).toBe(false);expect(ref.reason).toMatch(/unshared.*12.00/);
 await page.locator('#hl_kitchen_interstorey_floor_remainder').selectOption('Insulated exposed floor');
 await page.evaluate(()=>window.selectRadiatorRoomV60('lounge'));
 await page.locator('#hl_lounge_interstorey_roof_remainder').selectOption('Flat roof, insulated');
 ref=await page.evaluate(()=>window.referenceNaturalCheckV1);expect(ref.available,ref.reason).toBe(true);
 const l=ref.result.rooms[0],u=ref.result.rooms[1];
 expect(l.elements.find(e=>e.name.startsWith('intermediate-ceiling')).netArea).toBe(8);
 expect(l.elements.find(e=>e.name==='unshared-roof').netArea).toBe(12);
 expect(u.elements.find(e=>e.name==='unshared-floor').netArea).toBe(4);
 expect(l.elements.find(e=>e.name==='unshared-roof').totalWatts).toBeCloseTo((0.25+0.15)*12*(21+2.7),8);
 expect(l.ventilation.envelopeArea).toBeCloseTo(11*2.4+20+12,8);
 expect(u.ventilation.envelopeArea).toBeCloseTo(11*2.4+12+4,8);
 expect(JSON.parse(await page.locator('#hl_interstorey_interfaces').inputValue())[0].area).toBe(8);
});
test('three-storey links use distinct shared records and signed downward heat flow',async({page})=>{
 await setup(page);
 const top=await page.evaluate(()=>allRoomNames().map(roomKeyFromName).find(k=>k!=='lounge'&&k!=='kitchen'));
 const values={hl_ventilation_storeys:'3',hl_kitchen_loft_type:'Heated room above'};
 Object.assign(values,Object.fromEntries(Object.entries({len:'4',wid:'3',outside:'3'}).map(([k,v])=>['rad_'+top+'_'+k,v])));
 Object.assign(values,Object.fromEntries(Object.entries({indoor_temp:'21',external_wall_length:'11',wall_type:'Cavity wall, insulated',window_type:'No windows',window_count:'0',door_type:'No external door',door_count:'0',floor_type:'Heated room below',loft_type:'Plasterboard with 200mm insulation',ventilation_mode:'Automatic',ventilation_device:'No additional vent or flue',internal_wall_type:'Heated room, aerated block'}).map(([k,v])=>['hl_'+top+'_'+k,v])));
 await setFields(page,values);await setFields(page,{['hl_'+top+'_internal_wall_count']:'0'});
 await add(page,'kitchen','lounge',12,'Uninsulated');await add(page,top,'kitchen',12,'100mm insulation');
 const ref=await page.evaluate(()=>window.referenceNaturalCheckV1);expect(ref.available,ref.reason).toBe(true);expect(ref.interfaces).toHaveLength(2);expect(ref.basis).toContain('3 recorded storeys');
 expect(ref.interfaces[1].uValue).toBe(0.31);
 const middle=ref.result.rooms.find(r=>r.id==='kitchen');expect(middle.elements.filter(e=>e.heatedTransfer)).toHaveLength(2);
 const sum=ref.result.rooms.flatMap(r=>r.elements).filter(e=>e.heatedTransfer).reduce((s,e)=>s+e.totalWatts,0);expect(sum).toBeCloseTo(0,8);
 expect(ref.result.equipmentSizingEnabled).toBe(false);
 // Independent longhand expectations from the actual UI fixture and published
 // coefficients, not copied from any module result. One room on each storey.
 const roles=[['lounge',21,11*2.4+12,(0.25+0.15)*12*(21-9.8),(1.73+0.10)*12*3],['kitchen',18,11*2.4,0,-(1.73+0.10)*12*3-(0.31+0.10)*12*3],[top,21,11*2.4+12,(0.21+0.15)*12*(21+2.7),(0.31+0.10)*12*3]];
 let building=0,emitters=0;
 for(const [id,temp,envelope,boundary,internal] of roles){
  const fabric=(0.55+0.15)*11*2.4*(temp+2.7)+boundary;
  const zoneVent=0.34*(12*0.05*envelope)*(temp+2.7),roomVent=2*zoneVent;
  const actual=ref.result.rooms.find(r=>r.id===id);
  expect(actual.fabricWatts).toBeCloseTo(fabric+internal,8);expect(actual.roomDemandWatts).toBeCloseTo(fabric+internal+roomVent,8);
  building+=fabric+zoneVent;emitters+=fabric+internal+roomVent;
 }
 expect(ref.result.buildingWatts).toBeCloseTo(building,8);expect(ref.result.emitterDemandWatts).toBeCloseTo(emitters,8);
});
test('unknown insulation, over-allocation and room-temperature changes never silently disagree',async({page})=>{
 await setup(page);await add(page,'kitchen','lounge',12,'Uninsulated');
 const row=page.locator('[data-if-upper="kitchen"] [data-if-row]').last();
 await row.locator('[data-if-field="construction"]').selectOption('');
 let ref=await page.evaluate(()=>window.referenceNaturalCheckV1);expect(ref.available).toBe(false);expect(ref.reason).toMatch(/insulation/);
 await row.locator('[data-if-field="construction"]').selectOption('Uninsulated');
 await row.locator('[data-if-field="area"]').fill('13');await row.locator('[data-if-field="area"]').press('Tab');
 ref=await page.evaluate(()=>window.referenceNaturalCheckV1);expect(ref.available).toBe(false);expect(ref.reason).toMatch(/fit both rooms/);
 await row.locator('[data-if-field="area"]').fill('12');await row.locator('[data-if-field="area"]').press('Tab');
 await setFields(page,{hl_lounge_indoor_temp:'18',hl_kitchen_indoor_temp:'21'});
 ref=await page.evaluate(()=>window.referenceNaturalCheckV1);expect(ref.available,ref.reason).toBe(true);expect(ref.interfaces[0].uValue).toBe(1.41);
 const terms=ref.result.rooms.flatMap(r=>r.elements).filter(e=>e.heatedTransfer);expect(terms[0].totalWatts).toBeCloseTo(-terms[1].totalWatts,8);
});
test('shared records survive reload and JSON import, while old unmeasured surveys stay unresolved',async({page})=>{
 await setup(page);await add(page,'kitchen','lounge',12,'100mm insulation');
 const saved=await page.evaluate(()=>getData());await page.reload();await page.locator('#radsTab').click();
 expect(await page.locator('#hl_interstorey_interfaces').inputValue()).toBe(saved.hl_interstorey_interfaces);
 await page.evaluate(d=>{const parsed=parseSurveyBackup(JSON.stringify(d));setData(parsed.data);},saved);
 expect(await page.locator('#hl_interstorey_interfaces').inputValue()).toBe(saved.hl_interstorey_interfaces);
 expect((await page.evaluate(()=>window.referenceNaturalCheckV1)).available).toBe(true);
 const old={...saved,_schemaVersion:3,_calcMethodVersion:3};delete old.hl_interstorey_interfaces;
 const state=await page.evaluate(d=>{const parsed=parseSurveyBackup(JSON.stringify(d));setData(parsed.data);return {review:parsed.review,reference:window.referenceNaturalCheckV1,legacy:document.getElementById('hl_calculation_method_version').value};},old);
 expect(state.review.join(' ')).toMatch(/measured area, insulation/);expect(state.reference.available).toBe(false);expect(state.reference.reason).toMatch(/record the shared interface/);expect(state.legacy).toBe('legacy-boiler-v1');
});
