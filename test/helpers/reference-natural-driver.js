'use strict';
const fields=require('../fixtures/reference-natural-survey.json');
async function setFields(page, values) {
  await page.evaluate(values=>{
    for (const [id,value] of Object.entries(values)) {
      const field=document.getElementById(id);
      if (!field) throw Error('Missing field '+id);
      field.value=value;
      if (field.value!==value) throw Error('Rejected '+id+'='+value);
      if (id.endsWith('_internal_wall_count')) field.dataset.hlCountManual='yes';
      field.dispatchEvent(new Event('change',{bubbles:true}));
    }
  },values);
}
async function prepare(page) {
  await page.goto('/index.html');
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.locator('#radsTab').click();
  await setFields(page,fields);
  await setFields(page,{hl_lounge_internal_wall_count:'1',hl_kitchen_internal_wall_count:'1'});
  await setFields(page,{hl_lounge_internal_segment_1_length:'3',hl_lounge_internal_segment_1_adjacent_temp:'18',hl_kitchen_internal_segment_1_length:'3',hl_kitchen_internal_segment_1_adjacent_temp:'21'});
  await page.waitForFunction(()=>window.heatLossResultsV60?.includedRooms?.length===2);
}
module.exports={prepare,setFields};
