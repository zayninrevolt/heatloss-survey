const {test,expect}=require('@playwright/test');
test.use({hasTouch:true,viewport:{width:390,height:844}});
async function seed(page){
 await page.goto('/index.html');
 await page.evaluate(()=>{const p=FloorPlanModel.empty();p.floors[0].outline=[[4,5],[76,5],[76,55],[4,55]];p.floors[0].walls=[{id:'shared',a:[4,30],b:[76,30]}];setData({...getData(),house_layout:JSON.stringify(p)});});
 await page.getByRole('tab',{name:'Layout',exact:true}).tap();
}
async function xy(page,x,y){return page.locator('#houseLayoutSvg').evaluate((s,p)=>{const q=new DOMPoint(...p).matrixTransform(s.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);}
async function centre(page){return page.locator('#houseLayoutSvg [data-plan-radiator]').evaluate(e=>{const p=new DOMPoint(0,0).matrixTransform(e.getScreenCTM());return {x:p.x,y:p.y};});}
async function startPalette(page,c){const b=await page.locator('#layoutAddRadiator').boundingBox();await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:0}]});}
test('the visible upper-room radiator is the actual drop, not the lower room under the finger',async({page},info)=>{
 await seed(page);const before=await page.evaluate(()=>getData()),c=await page.context().newCDPSession(page),aim=await xy(page,80,232),finger={x:aim.x,y:aim.y+72};
 await startPalette(page,c);await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...finger,id:0}]});
 expect(await page.evaluate(()=>getData())).toEqual(before);
 // Independently specified upper face of the horizontal wall, not a call to the snap algorithm under test.
 const target=await page.locator('[data-radiator-drop-target]').evaluate(e=>[+e.getAttribute('cx')/8,+e.getAttribute('cy')/8]);expect(target).toEqual([10,30]);
 const visible=await centre(page);expect(visible.x).toBeCloseTo(aim.x,1);expect(visible.y).toBeCloseTo(aim.y,1);
 await page.screenshot({path:info.outputPath('visible-upper-room-before-drop.png')});
 await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const r=JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].radiators[0];expect(r).toMatchObject({cell:29*80+10,edge:'bottom',point:[10,30]});
 const saved=await centre(page);expect(saved.x).toBeCloseTo(visible.x,4);expect(saved.y).toBeCloseTo(visible.y,4);
 const after=await page.evaluate(()=>getData());delete after.house_layout;const baseline={...before};delete baseline.house_layout;expect(after).toEqual(baseline);
 await page.locator('#layoutUndo').tap();expect(await page.evaluate(()=>getData())).toEqual(before);await c.detach();
});
for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:844,height:390}])for(const side of ['upper','lower'])test('visible '+side+' face saves without a jump at '+viewport.width+'x'+viewport.height,async({page},info)=>{
 await page.setViewportSize(viewport);await seed(page);
 const before=await page.evaluate(()=>getData()),c=await page.context().newCDPSession(page),aim=await xy(page,320,side==='upper'?232:248),finger={x:aim.x,y:aim.y+72};
 expect(finger.y).toBeLessThan(viewport.height);await startPalette(page,c);await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...finger,id:0}]});
 const visible=await centre(page);expect(visible.y).toBeLessThan(finger.y-60);expect(visible.x).toBeCloseTo(aim.x,1);expect(visible.y).toBeCloseTo(aim.y,1);
 expect(await page.evaluate(()=>getData())).toEqual(before);await expect(page.locator('#preview [data-radiator-drag-overlay]')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('visible-'+side+'-face.png')});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const r=JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].radiators[0];expect(r).toMatchObject({cell:(side==='upper'?29:30)*80+40,edge:side==='upper'?'bottom':'top',point:[40,30]});
 const saved=await centre(page);expect(saved.x).toBeCloseTo(visible.x,4);expect(saved.y).toBeCloseTo(visible.y,4);await expect(page.locator('[data-radiator-drag-overlay]')).toHaveCount(0);
 await page.locator('#layoutUndo').tap();expect(await page.evaluate(()=>getData())).toEqual(before);await c.detach();
});
for(const side of ['left','right'])test('sub-cell aiming keeps the '+side+' face of a vertical shared wall',async({page})=>{
 await seed(page);await page.evaluate(()=>{const d=getData(),p=JSON.parse(d.house_layout);p.floors[0].walls=[{id:'shared',a:[40,5],b:[40,55]}];setData({...d,house_layout:JSON.stringify(p)});});
 const c=await page.context().newCDPSession(page),aim=await xy(page,(side==='left'?39.875:40.125)*8,240);await startPalette(page,c);await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:aim.x,y:aim.y+72,id:0}]});
 const visible=await centre(page),expected=await xy(page,(side==='left'?39:41)*8,240);expect(visible.x).toBeCloseTo(expected.x,1);expect(visible.y).toBeCloseTo(expected.y,1);
 await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const r=JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].radiators[0];expect(r).toMatchObject({edge:side==='left'?'right':'left',cell:30*80+(side==='left'?39:40),point:[40,30]});await c.detach();
});
for(const route of ['direct','reposition','tap'])test(route+' touch placement saves the visible position on the chosen wall face',async({page})=>{
 await seed(page);await page.evaluate(()=>{const d=getData(),p=JSON.parse(d.house_layout);p.floors[0].radiators=[{id:'existing',cell:15*80+4,edge:'left',point:[4,15]}];setData({...d,house_layout:JSON.stringify(p)});});
 const c=await page.context().newCDPSession(page),aim=await xy(page,320,248),finger={x:aim.x,y:aim.y+72},a=await centre(page),before=await page.locator('#house_layout').inputValue();
 if(route==='reposition'){await page.touchscreen.tap(a.x,a.y);await page.locator('#layoutRepositionRadiator').tap();}
 if(route==='tap'){await page.locator('#layoutAddRadiator').tap();await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...finger,id:0}]});}
 else{await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...(route==='direct'?a:finger),id:0}]});if(route==='direct')await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...finger,id:0}]});}
 const marker=page.locator('#houseLayoutSvg [data-plan-radiator]').last(),visible=await marker.evaluate(e=>{const p=new DOMPoint(0,0).matrixTransform(e.getScreenCTM());return {x:p.x,y:p.y};});expect(visible.y).toBeCloseTo(aim.y,1);expect(await page.locator('#house_layout').inputValue()).toBe(before);
 await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const rs=JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].radiators,r=rs[rs.length-1];expect(r).toMatchObject({id:route==='tap'?'r1':'existing',edge:'top',point:[40,30],cell:30*80+40});expect(rs).toHaveLength(route==='tap'?2:1);
 const saved=await marker.evaluate(e=>{const p=new DOMPoint(0,0).matrixTransform(e.getScreenCTM());return {x:p.x,y:p.y};});expect(saved.x).toBeCloseTo(visible.x,4);expect(saved.y).toBeCloseTo(visible.y,4);await c.detach();
});
for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:844,height:390},{width:320,height:568}])test('all outside walls remain reachable with a visible aim at '+viewport.width+'x'+viewport.height,async({page})=>{
 await page.setViewportSize(viewport);await seed(page);const c=await page.context().newCDPSession(page);
 for(const [x,y,edge] of [[320,48,'top'],[320,432,'bottom'],[40,160,'left'],[600,160,'right']]){
  const aim=await xy(page,x,y),finger={x:aim.x,y:aim.y+72};expect(finger.y).toBeLessThan(viewport.height);await startPalette(page,c);await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...finger,id:0}]});const visible=await page.locator('[data-radiator-lift]').evaluate(e=>{const p=new DOMPoint(0,0).matrixTransform(e.getScreenCTM());return {x:p.x,y:p.y};});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const rs=JSON.parse(await page.locator('#house_layout').inputValue()).floors[0].radiators;expect(rs[rs.length-1].edge).toBe(edge);const saved=await page.locator('#houseLayoutSvg [data-plan-radiator]').last().evaluate(e=>{const p=new DOMPoint(0,0).matrixTransform(e.getScreenCTM());return {x:p.x,y:p.y};});expect(saved.x).toBeCloseTo(visible.x,4);expect(saved.y).toBeCloseTo(visible.y,4);
 }
 await c.detach();
});
for(const zoomed of [false,true])test('preview drop stays correct through zoom, reload and JSON round-trip; zoom '+zoomed,async({page,browser},info)=>{
 await seed(page);if(zoomed)await page.locator('#layoutZoomIn').tap();const c=await page.context().newCDPSession(page),aim=await xy(page,320,232);await startPalette(page,c);await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:aim.x,y:aim.y+72,id:0}]});const transform=await page.locator('[data-plan-radiator]').getAttribute('transform');await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('[data-plan-radiator]')).toHaveAttribute('transform',transform);const raw=await page.locator('#house_layout').inputValue();
 const downloading=page.waitForEvent('download');await page.evaluate(()=>saveJson());const file=info.outputPath('visible-drop-survey.json');await (await downloading).saveAs(file);await page.reload();expect(await page.locator('#house_layout').inputValue()).toBe(raw);
 const context=await browser.newContext(),other=await context.newPage();await other.goto(page.url());await other.locator('#loadFile').setInputFiles(file);expect(await other.locator('#house_layout').inputValue()).toBe(raw);await context.close();await c.detach();
});
test('invalid visible aim cancels instead of dropping at the finger or retaining the last valid preview',async({page})=>{
 await seed(page);const before=await page.evaluate(()=>getData()),c=await page.context().newCDPSession(page),aim=await xy(page,320,232),box=await page.locator('#houseLayoutSvg').boundingBox();await startPalette(page,c);await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:aim.x,y:aim.y+72,id:0}]});await expect(page.locator('[data-radiator-lift]')).toBeVisible();await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:aim.x,y:box.y+10,id:0}]});await expect(page.locator('[data-radiator-lift]')).toHaveCount(0);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});expect(await page.evaluate(()=>getData())).toEqual(before);await c.detach();
});
