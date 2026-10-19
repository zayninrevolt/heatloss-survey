const {test,expect}=require('@playwright/test');const fs=require('node:fs/promises');
const {bedrooms,outline,label}=require('../helpers/floor-plan-driver');
test('unreadable metadata cannot display a cached plan from the previously opened survey',async({page})=>{
 await bedrooms(page);await page.locator('#layoutInclude').check();await expect(page.locator('#preview .layout-sheet-wrap')).toHaveCount(1);
 await page.evaluate(()=>{document.getElementById('house_layout').value='{broken';update();});
 await expect(page.locator('#layoutStatus')).toContainText('could not be read');await expect(page.locator('#preview .layout-sheet-wrap')).toHaveCount(0);
});
