async function point(page,x,y){await page.locator('#houseLayoutSvg').scrollIntoViewIfNeeded();return page.locator('#houseLayoutSvg').evaluate((svg,p)=>{const q=new DOMPoint(...p).matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);}
async function tap(page,x,y){const p=await point(page,x,y);await page.mouse.click(p.x,p.y);}
async function wall(page,a,b){await page.getByRole('button',{name:'Draw internal wall',exact:true}).click();await tap(page,...a);await tap(page,...b);}
async function outline(page,floor='first',shape='L'){await page.getByRole('tab',{name:'Layout',exact:true}).click();await page.locator('#layoutFloor').selectOption(floor);await page.locator('#layoutShape').selectOption(shape);await page.locator('#layoutCreateOutline').click();}
async function label(page,key,x,y){await page.getByRole('button',{name:'Select space',exact:true}).click();await tap(page,x,y);await page.locator('#layoutRoom').selectOption(key);await page.locator('#layoutAssign').click();}
async function bedrooms(page){await page.goto('/index.html');await outline(page);await wall(page,[288,40],[288,440]);await label(page,'bed_1',128,224);await label(page,'bed_2',368,160);}
module.exports={point,tap,wall,outline,label,bedrooms};
