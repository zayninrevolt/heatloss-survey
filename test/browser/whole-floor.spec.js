const {test,expect}=require('@playwright/test');
const {outline,wall,label}=require('../helpers/floor-plan-driver');
test('whole-floor outline is divided by shared walls into labelled spaces without changing measurements',async({page})=>{
 await page.goto('/index.html');const before=await page.evaluate(()=>({data:getData(),results:JSON.stringify(heatLossResultsV60)}));
 await outline(page);await expect(page.locator('#houseLayoutSvg [data-floor-outline]')).toHaveCount(1);await expect(page.locator('#houseLayoutSvg [data-space]')).toHaveCount(1);
 await wall(page,[288,40],[288,440]);await expect(page.locator('#houseLayoutSvg [data-space]')).toHaveCount(2);
 await label(page,'bed_1',128,224);await label(page,'bed_2',368,160);await expect(page.locator('#houseLayoutSvg')).toContainText('Bed 1');await expect(page.locator('#houseLayoutSvg')).toContainText('Bed 2');
 const after=await page.evaluate(()=>getData());delete before.data.house_layout;delete after.house_layout;expect(after).toEqual(before.data);expect(await page.evaluate(()=>JSON.stringify(heatLossResultsV60))).toBe(before.results);
});
