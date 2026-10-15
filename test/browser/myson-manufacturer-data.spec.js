'use strict';
const {test,expect}=require('@playwright/test');
const {prepare,setFields}=require('../helpers/reference-natural-driver');
test('Myson low-temperature choices fail closed instead of inventing output or fan operation',async({page})=>{
 await prepare(page);
 await setFields(page,{hl_radiator_temperature:'45'});
 expect(await page.locator('#rad_lounge_ex_size option').evaluateAll(rows=>rows.filter(o=>/Myson/.test(o.value)).length)).toBe(0);
 expect(await page.locator('#rad_lounge_new_size option').evaluateAll(rows=>rows.filter(o=>/Myson/.test(o.value)).length)).toBe(0);
 const print=await page.evaluate(()=>buildPrintHtml('Manufacturer limits',['Heat Loss'],'portrait'));
 expect(print).toContain('Myson');expect(print).toContain('340');expect(print).toMatch(/not offered outside.*30.*50/i);
});
test('correct Kickspace ratings are used on screen and saved sizes survive an unsupported temperature',async({page})=>{
 await prepare(page);
 await setFields(page,{hl_radiator_temperature:'75',hl_lounge_indoor_temp:'20'});
 await setFields(page,{rad_lounge_ex_size:'Myson Kickspace 500',rad_lounge_outcome:'Assess existing radiator'});
 let state=await page.evaluate(()=>({room:window.heatLossResultsV60.includedRooms.find(r=>r.key==='lounge'),data:getData()}));
 expect(state.room.existingRadiator.ratedWatts).toBe(896);
 expect(state.room.existingRadiator.watts).toBeCloseTo(896*0.96,8);
 await setFields(page,{hl_radiator_temperature:'45'});
 expect(await page.locator('#rad_lounge_ex_size').inputValue()).toBe('Myson Kickspace 500');
 const low=await page.evaluate(()=>window.heatLossResultsV60.includedRooms.find(r=>r.key==='lounge'));
 expect(low.existingRadiatorAdequate).toBe(false);
 expect(low.warnings.join(' ')).toMatch(/Myson.*manufacturer.*output/i);
 await page.reload();await page.locator('#radsTab').click();
 expect(await page.locator('#rad_lounge_ex_size').inputValue()).toBe('Myson Kickspace 500');
});
test('inactive second-emitter metadata cannot trigger a Myson output warning',async({page})=>{
 await prepare(page);
 await setFields(page,{hl_radiator_temperature:'75',rad_lounge_ex_quantity:'1',rad_lounge_ex_size:'600(h) x 1000(w) K2',rad_lounge_ex_size_2:'Myson Kickspace 500'});
 await setFields(page,{hl_radiator_temperature:'45'});
 const room=await page.evaluate(()=>window.heatLossResultsV60.includedRooms.find(r=>r.key==='lounge'));
 expect(room.warnings.join(' ')).not.toMatch(/Recorded Myson/);
});
test('old calculation data shows the emitter review and a future-method import preserves the current survey',async({page})=>{
 await prepare(page);
 const old=await page.evaluate(()=>{
  const saved=JSON.parse(localStorage.getItem('heatLossDataV60'));
  saved.data._calcMethodVersion=3;
  return JSON.stringify(saved);
 });
 // Seed on the NEW document: pagehide deliberately autosaves the current one.
 await page.addInitScript(saved=>localStorage.setItem('heatLossDataV60',saved),old);
 await page.reload();await page.locator('#radsTab').click();
 await expect(page.locator('#surveyReviewNotes')).toContainText('Emitter manufacturer data updated');
 await expect(page.locator('#surveyReviewNotes')).toContainText('Myson');
 const before=await page.evaluate(()=>getData());
 const dialogPromise=page.waitForEvent('dialog');
 await page.locator('#loadFile').setInputFiles({name:'future-method.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...before,_calcMethodVersion:99}))});
 const dialog=await dialogPromise;expect(dialog.message()).toContain('newer');await dialog.dismiss();
 expect(await page.evaluate(()=>getData())).toEqual(before);
});
