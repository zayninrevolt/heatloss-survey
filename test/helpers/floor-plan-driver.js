async function point(page,x,y){return page.locator('#houseLayoutSvg').evaluate((svg,p)=>{const q=new DOMPoint(...p).matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);}
async function tap(page,x,y){const p=await point(page,x,y);await page.mouse.click(p.x,p.y);}
async function enter(page){if(!await page.locator('body').evaluate(b=>b.classList.contains('house-layout-mode')))await page.getByRole('tab',{name:'Layout',exact:true}).click();}
async function options(page){if(!await page.locator('#layoutSheet').evaluate(d=>d.open))await page.locator('#layoutMore').click();}
async function closeOptions(page){if(await page.locator('#layoutSheet').evaluate(d=>d.open))await page.locator('#layoutSheetClose').click();}
async function advanced(page,name){await options(page);await page.locator('#layoutSheet summary').click();await page.getByRole('button',{name,exact:true}).click();}
async function wall(page,a,b){if(!(await page.locator('#layoutDrawingHelp').textContent()).startsWith('Manual wall:'))await advanced(page,'Draw internal wall');await tap(page,...a);await tap(page,...b);}
async function outlineMenu(page){await options(page);await page.locator('#layoutOutlineOptions').click();}
async function outline(page,floor='first',shape='L'){await enter(page);await page.locator('#layoutFloor').selectOption(floor);if(await page.locator('#layoutEmpty').isVisible()&&shape!=='custom'){await page.locator('#layoutEmpty [data-shape="'+shape+'"]').click();}else{await outlineMenu(page);await page.locator('#layoutShape').selectOption(shape);await page.locator('#layoutCreateOutline').click();}}
async function label(page,key,x,y){if(await page.locator('#layoutDone').isVisible())await page.locator('#layoutDone').click();await closeOptions(page);await tap(page,x,y);await page.locator('#layoutRoom').selectOption(key);await page.locator('#layoutAssign').click();}
async function back(page){await closeOptions(page);if(await page.locator('#layoutBack').isVisible())await page.locator('#layoutBack').click();}
async function bedrooms(page){await page.goto('/index.html');await outline(page);await wall(page,[288,40],[288,440]);await label(page,'bed_1',128,224);await label(page,'bed_2',368,160);}
module.exports={point,tap,wall,outline,label,bedrooms,enter,options,closeOptions,advanced,outlineMenu,back};
