const {test,expect}=require('@playwright/test');
const {point,tap,wall}=require('../helpers/floor-plan-driver');
test('whole-floor outline is divided by shared walls into labelled spaces without changing measurements',async({page})=>{
 await page.goto('/index.html');const before=await page.evaluate(()=>({data:getData(),results:JSON.stringify(heatLossResultsV60)}));
 await page.getByRole('tab',{name:'Layout',exact:true}).click();await page.locator('#layoutFloor').selectOption('first');
 await page.getByLabel('Floor outline',{exact:true}).selectOption('L');await page.getByRole('button',{name:'Create floor outline',exact:true}).click({timeout:5000});
 await expect(page.locator('#houseLayoutSvg [data-floor-outline]')).toHaveCount(1);await expect(page.locator('#houseLayoutSvg [data-space]')).toHaveCount(1);
 await wall(page,[288,40],[288,440]);await expect(page.locator('#houseLayoutSvg [data-space]')).toHaveCount(2);
 await page.getByRole('button',{name:'Select space',exact:true}).click();await tap(page,128,224);await page.locator('#layoutRoom').selectOption('bed_1');await page.getByRole('button',{name:'Label selected space',exact:true}).click();
 await tap(page,368,160);await page.locator('#layoutRoom').selectOption('bed_2');await page.getByRole('button',{name:'Label selected space',exact:true}).click();
 await expect(page.locator('#houseLayoutSvg')).toContainText('Bed 1');await expect(page.locator('#houseLayoutSvg')).toContainText('Bed 2');
 const after=await page.evaluate(()=>getData());delete before.data.house_layout;delete after.house_layout;expect(after).toEqual(before.data);
 expect(await page.evaluate(()=>JSON.stringify(heatLossResultsV60))).toBe(before.results);
});
module.exports={point,tap,wall};
