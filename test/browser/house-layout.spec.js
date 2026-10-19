const {test,expect}=require('@playwright/test');const {bedrooms,outline,tap,point}=require('../helpers/floor-plan-driver');
test('removing a shared wall cannot silently merge Bedroom 1 and Bedroom 2',async({page})=>{
 await bedrooms(page);const before=await page.locator('#house_layout').inputValue();
 await page.getByRole('button',{name:'Remove wall',exact:true}).click();await tap(page,288,240);
 expect(await page.locator('#house_layout').inputValue()).toBe(before);await expect(page.locator('#layoutStatus')).toContainText('join two labelled rooms');
 await page.getByRole('button',{name:'Select space',exact:true}).click();await tap(page,368,160);await page.locator('#layoutRemove').click();
 await page.getByRole('button',{name:'Remove wall',exact:true}).click();await tap(page,288,240);await expect(page.locator('#houseLayoutSvg [data-space]')).toHaveCount(1);
 await page.locator('#layoutUndo').click();await expect(page.locator('#houseLayoutSvg [data-space]')).toHaveCount(2);
});
test('a named extra floor accepts a custom joined-up outer outline',async({page})=>{
 await page.goto('/index.html');await page.getByRole('tab',{name:'Layout',exact:true}).click();page.once('dialog',d=>d.accept('Loft'));await page.locator('#layoutAddFloor').click();
 await page.locator('#layoutShape').selectOption('custom');await page.locator('#layoutCreateOutline').click();
 for(const p of [[64,64],[576,64],[576,240],[416,240],[416,416],[64,416]])await tap(page,...p);
 await page.locator('#layoutFinishCustom').click();const plan=JSON.parse(await page.locator('#house_layout').inputValue());expect(plan.floors.at(-1).name).toBe('Loft');expect(plan.floors.at(-1).outline).toHaveLength(6);
 await expect(page.locator('#houseLayoutSvg [data-floor-outline]')).toHaveCount(1);await page.locator('#layoutFront').selectOption('left');expect(JSON.parse(await page.locator('#house_layout').inputValue()).front).toBe('left');
});
test('Save layout image exports the complete joined floor as a real PNG',async({page},info)=>{
 await bedrooms(page);const before=await page.evaluate(()=>getData()),downloading=page.waitForEvent('download');await page.locator('#layoutSaveImage').click();const download=await downloading;expect(download.suggestedFilename()).toBe('layout-first-floor.png');
 const output=info.outputPath('whole-first-floor.png');await download.saveAs(output);const data=require('node:fs').readFileSync(output);expect(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))).toBe(true);expect(data.readUInt32BE(16)).toBe(1280);expect(data.readUInt32BE(20)).toBe(960);expect(data.length).toBeGreaterThan(5000);expect(await page.evaluate(()=>getData())).toEqual(before);
});
test('keyboard floor-corner editing keeps focus and changes only visual geometry',async({page})=>{
 await page.goto('/index.html');await outline(page);await page.getByRole('button',{name:'Edit floor outline',exact:true}).click();
 const handle=page.locator('#houseLayoutSvg [data-layout-corner="3"]');await handle.focus();await page.keyboard.press('ArrowRight');await expect(handle).toBeFocused();
 const first=JSON.parse(await page.locator('#house_layout').inputValue()).floors[1].outline[3];await page.keyboard.press('ArrowDown');await expect(handle).toBeFocused();const next=JSON.parse(await page.locator('#house_layout').inputValue()).floors[1].outline[3];expect(next).toEqual([first[0],first[1]+1]);
});
test('dragging a floor corner reshapes the whole outline, not a single room',async({page})=>{
 await page.goto('/index.html');await outline(page);await page.getByRole('button',{name:'Edit floor outline',exact:true}).click();const raw=await page.locator('#house_layout').inputValue();const h=await page.locator('#houseLayoutSvg [data-layout-corner="3"]').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+16,h.y+h.height/2+16,{steps:4});await page.mouse.up();const plan=JSON.parse(await page.locator('#house_layout').inputValue());expect(plan.floors[1].outline).not.toEqual(JSON.parse(raw).floors[1].outline);expect(plan.floors[1].labels).toEqual([]);await expect(page.locator('#houseLayoutSvg [data-floor-outline]')).toHaveCount(1);
});
test('cancelled outline replacement preserves every room label and wall',async({page})=>{
 await bedrooms(page);const before=await page.evaluate(()=>getData());page.once('dialog',d=>d.dismiss());await page.locator('#layoutCreateOutline').click();expect(await page.evaluate(()=>getData())).toEqual(before);
});
test('keyboard skip navigation targets the visible floor plan and restores the report target',async({page})=>{
 await page.goto('/index.html');await page.getByRole('tab',{name:'Layout',exact:true}).click();const skip=page.locator('.skip-link');await skip.focus();await expect(skip).toHaveAttribute('href','#houseLayoutCanvas');await page.keyboard.press('Enter');await expect(page.locator('#houseLayoutCanvas')).toBeFocused();await expect(page.getByRole('main')).toHaveCount(1);
 await page.getByRole('tab',{name:'Front',exact:true}).click();await skip.focus();await expect(skip).toHaveAttribute('href','#preview');await page.keyboard.press('Enter');await expect(page.locator('#preview')).toBeFocused();await expect(page.getByRole('main')).toHaveCount(1);
});
