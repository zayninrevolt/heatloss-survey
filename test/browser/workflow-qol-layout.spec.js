const {test,expect}=require('@playwright/test');
for(const viewport of [{width:768,height:1024},{width:390,height:550}]){
 test('defaults and checklist fit a '+viewport.width+'x'+viewport.height+' screen',async({page},info)=>{
  await page.setViewportSize(viewport);
  await page.goto('/index.html');
  await page.evaluate(()=>document.body.classList.add('theme-dark'));
  await page.locator('#moreToggleV58').click();
  await page.getByRole('menuitem',{name:'Personal defaults',exact:true}).click();
  const defaults=page.getByRole('dialog',{name:'Personal defaults',exact:true});
  const box=await defaults.locator('.pdf-card').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(8);expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.x+box.width).toBeLessThanOrEqual(viewport.width-8);
  expect(box.y+box.height).toBeLessThanOrEqual(viewport.height-8);
  await page.screenshot({path:info.outputPath('personal-defaults.png')});
  await defaults.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Save PDF',exact:true}).click();
  const card=await page.locator('#pdfPanel .pdf-card').boundingBox();
  expect(card.y).toBeGreaterThanOrEqual(8);expect(card.y+card.height).toBeLessThanOrEqual(viewport.height-8);
  const links=page.locator('#pdfChecklistV53 a');await expect(links).toHaveCount(11);
  expect(await links.evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44))).toBe(true);
  await page.screenshot({path:info.outputPath('clickable-checklist.png')});
 });
}
