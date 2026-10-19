const {test,expect}=require('@playwright/test');
async function xy(page,x,y){return page.locator('#houseLayoutSvg').evaluate((s,p)=>{let q=new DOMPoint(...p).matrixTransform(s.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);}
async function tap(page,x,y){const p=await xy(page,x,y);await page.touchscreen.tap(p.x,p.y);}
async function drag(page,selector,x,y){const box=await page.locator(selector).boundingBox(),to=await xy(page,x,y),cdp=await page.context().newCDPSession(page),from={x:box.x+box.width/2,y:box.y+box.height/2};await cdp.send('Input.synthesizeScrollGesture',{x:from.x,y:from.y,xDistance:to.x-from.x,yDistance:to.y-from.y,gestureSourceType:'touch',preventFling:true,speed:250});await cdp.detach();}
async function label(page,key,x,y){await tap(page,x,y);await page.locator('#layoutRoom').selectOption(key);await page.locator('#layoutAssign').tap();}
test.use({viewport:{width:390,height:844},hasTouch:true});
for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:844,height:390}])test('touch creation makes the interlocking L plan with no form/canvas scrolling '+viewport.width+'x'+viewport.height,async({page},info)=>{
 await page.setViewportSize(viewport);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/index.html');await page.evaluate(()=>setData({...getData(),_customRooms:['Living room']}));
 const before=await page.evaluate(()=>({data:getData(),results:JSON.stringify(heatLossResultsV60)}));
 await page.getByRole('tab',{name:'Layout',exact:true}).tap();
 await expect(page.getByRole('button',{name:'Back to survey',exact:true})).toBeInViewport();
 for(const name of ['Rectangle','L-shaped floor','Custom outline'])await expect(page.getByRole('button',{name,exact:true})).toBeInViewport({ratio:1});
 await page.getByRole('button',{name:'Rectangle',exact:true}).tap();
 await page.getByRole('button',{name:'Split space',exact:true}).tap();await page.getByRole('button',{name:'Straight split',exact:true}).tap();
 await expect(page.locator('#layoutSplitApply')).toHaveCSS('background-color','rgb(32, 90, 202)');
 await page.getByRole('button',{name:'Rotate divider',exact:true}).tap();await drag(page,'[data-split-handle="position"]',320,160);
 await page.getByRole('button',{name:'Apply split',exact:true}).tap();
 await expect(page.locator('#layoutSplitActions')).toBeHidden();
 await page.getByRole('button',{name:'Split space',exact:true}).tap();await page.getByRole('button',{name:'L-shaped split',exact:true}).tap();
 await drag(page,'[data-split-handle="first"]',240,220);await drag(page,'[data-split-handle="second"]',400,360);await drag(page,'[data-split-handle="offset"]',320,280);
 await page.screenshot({path:info.outputPath('touch-split-preview.png')});
 await page.getByRole('button',{name:'Apply split',exact:true}).tap();
 await label(page,'kitchen',320,88);await label(page,'living_room',512,320);await label(page,'hallway',128,320);
 const actual=await page.evaluate(()=>{const f=FloorPlanModel.decode(getData().house_layout).floors[0];return {walls:f.walls,spaces:FloorPlanModel.spaces(f).map(s=>({key:s.label?.key,cells:s.cells.sort((a,b)=>a-b)}))};});
 // Native scroll gestures include Chromium's touch-slop movement. Verify the actual
 // finger-created partition independently, rather than assuming a scripted end point.
 const plan=actual.spaces,[rear,first,middle,last]=actual.walls;expect(actual.walls).toHaveLength(4);expect(plan).toHaveLength(3);
 expect(rear.a[0]).toBe(4);expect(rear.b[0]).toBe(76);expect(first.a[1]).toBe(rear.a[1]);expect(first.b).toEqual(middle.a);expect(middle.b).toEqual(last.a);expect(last.b[1]).toBe(55);expect(first.a[0]).toBeLessThan(last.a[0]);
 for(const key of ['kitchen','living_room','hallway']){const cells=[];for(let y=5;y<55;y++)for(let x=4;x<76;x++){const k=y<rear.a[1],l=!k&&((y<middle.a[1]&&x>=first.a[0])||(y>=middle.a[1]&&x>=last.a[0]));if(key==='kitchen'?k:key==='living_room'?l:!k&&!l)cells.push(y*80+x);}expect(plan.find(s=>s.key===key).cells).toEqual(cells);}
 const after=await page.evaluate(()=>getData());delete before.data.house_layout;delete after.house_layout;expect(after).toEqual(before.data);expect(await page.evaluate(()=>JSON.stringify(heatLossResultsV60))).toBe(before.results);
 expect(await page.evaluate(()=>({y:scrollY,overflow:document.documentElement.scrollWidth>innerWidth}))).toEqual({y:0,overflow:false});
 await expect(page.getByRole('button',{name:'Undo sketch edit',exact:true})).toBeInViewport();await expect(page.getByRole('button',{name:'Name space',exact:true})).toBeInViewport();
 await page.screenshot({path:info.outputPath('touch-interlocking-plan.png')});await page.reload();await expect(page.locator('#house_layout')).toHaveValue(/"version":2/);await page.getByRole('tab',{name:'Layout',exact:true}).tap();await expect(page.locator('#houseLayoutSvg')).toContainText('Living room');expect(errors).toEqual([]);
});
test('split preview is non-destructive, locks unrelated edits, cancels cleanly and applies as one Undo step',async({page})=>{
 await page.goto('/index.html');await page.getByRole('tab',{name:'Layout',exact:true}).tap();await page.getByRole('button',{name:'Rectangle',exact:true}).tap();const before=await page.evaluate(()=>getData());
 await page.locator('#layoutSplit').tap();await page.getByRole('button',{name:'L-shaped split',exact:true}).tap();
 await expect(page.locator('#layoutMore')).toBeDisabled();await expect(page.locator('#layoutFloor')).toBeDisabled();await expect(page.locator('#layoutUndo')).toBeDisabled();
 await drag(page,'[data-split-handle="offset"]',320,280);expect(await page.evaluate(()=>getData())).toEqual(before);await page.locator('#layoutSplitCancel').tap();expect(await page.evaluate(()=>getData())).toEqual(before);
 await page.locator('#layoutSplit').tap();await page.getByRole('button',{name:'Straight split',exact:true}).tap();await page.locator('#layoutSplitApply').tap();await expect(page.locator('#houseLayoutSvg [data-space]')).toHaveCount(2);await page.locator('#layoutUndo').tap();expect(await page.evaluate(()=>getData())).toEqual(before);
});
test('grabbing the edge of a large wall handle does not make the wall jump to the finger',async({page})=>{
 await page.goto('/index.html');await page.getByRole('tab',{name:'Layout',exact:true}).tap();await page.getByRole('button',{name:'Rectangle',exact:true}).tap();await page.locator('#layoutSplit').tap();await page.getByRole('button',{name:'Straight split',exact:true}).tap();await page.locator('#layoutSplitApply').tap();await page.locator('#layoutAdjust').tap();
 const before=JSON.parse(await page.locator('#house_layout').inputValue()),box=await page.locator('[data-move-wall]').boundingBox(),from={x:box.x+box.width/2-15,y:box.y+box.height/2},to={x:from.x+10,y:from.y};
 const delta=await page.locator('#houseLayoutSvg').evaluate((s,points)=>{const m=s.getScreenCTM().inverse();return points.map(p=>Math.round(new DOMPoint(p.x,p.y).matrixTransform(m).x/8)).reduce((a,b)=>b-a);},[from,to]);
 const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[to]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const next=JSON.parse(await page.locator('#house_layout').inputValue());expect(next.floors[0].walls[0].a[0]).toBe(before.floors[0].walls[0].a[0]+delta);expect(next.floors[0].walls[0].b[0]).toBe(before.floors[0].walls[0].b[0]+delta);
});
test('split preview handles keep their grab offset and cancelled touch movement writes no survey data',async({page})=>{
 await page.goto('/index.html');await page.getByRole('tab',{name:'Layout',exact:true}).tap();await page.getByRole('button',{name:'Rectangle',exact:true}).tap();const before=await page.evaluate(()=>getData());await page.locator('#layoutSplit').tap();await page.getByRole('button',{name:'Straight split',exact:true}).tap();
 const h=page.locator('[data-split-handle="position"] circle'),old=Number(await h.getAttribute('cx'))/8,box=await h.boundingBox(),from={x:box.x+box.width/2-15,y:box.y+box.height/2},to={x:from.x+10,y:from.y};const delta=await page.locator('#houseLayoutSvg').evaluate((s,points)=>{const m=s.getScreenCTM().inverse();return points.map(p=>Math.round(new DOMPoint(p.x,p.y).matrixTransform(m).x/8)).reduce((a,b)=>b-a);},[from,to]);
 const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[to]});await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});expect(Number(await h.getAttribute('cx'))/8).toBe(old+delta);expect(await page.evaluate(()=>getData())).toEqual(before);
});
test('native pinch and pan change only the view and Fit restores the whole floor',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/index.html');await page.getByRole('tab',{name:'Layout',exact:true}).tap();await page.getByRole('button',{name:'Rectangle',exact:true}).tap();const before=await page.evaluate(()=>getData()),initial=await page.locator('#houseLayoutSvg').getAttribute('viewBox'),center=await xy(page,320,240),c=await page.context().newCDPSession(page);
 await c.send('Input.synthesizePinchGesture',{x:center.x,y:center.y,scaleFactor:1.5,gestureSourceType:'touch',relativeSpeed:400});expect(Number((await page.locator('#houseLayoutSvg').getAttribute('viewBox')).split(' ')[2])).toBeLessThan(640);expect(await page.evaluate(()=>getData())).toEqual(before);await expect(page.locator('#layoutSheet')).not.toBeVisible();
 const zoomed=await page.locator('#houseLayoutSvg').getAttribute('viewBox');await c.send('Input.synthesizeScrollGesture',{x:center.x,y:center.y,xDistance:40,gestureSourceType:'touch',preventFling:true,speed:200});expect(await page.locator('#houseLayoutSvg').getAttribute('viewBox')).not.toBe(zoomed);expect(await page.evaluate(()=>getData())).toEqual(before);await page.locator('#layoutFit').tap();await expect(page.locator('#houseLayoutSvg')).toHaveAttribute('viewBox',initial);expect(errors).toEqual([]);
});
test('published version-2 floor plans open unchanged and their shared walls remain touch-editable',async({page})=>{
 await page.goto('/index.html');await page.evaluate(()=>{const p={version:2,front:'bottom',includeReport:true,floors:[{id:'ground',name:'Ground floor',outline:[[4,5],[76,5],[76,55],[4,55]],walls:[{id:'w1',a:[4,20],b:[76,20]},{id:'w2',a:[30,20],b:[30,35]},{id:'w3',a:[30,35],b:[50,35]},{id:'w4',a:[50,35],b:[50,55]}],labels:[{key:'kitchen',label:'Kitchen',cell:840},{key:'living_room',label:'Living room',cell:2460},{key:'hallway',label:'Hallway',cell:3215}]}]};setData({...getData(),_customRooms:['Living room'],house_layout:JSON.stringify(p)});});const before=await page.evaluate(()=>getData());
 await page.getByRole('tab',{name:'Layout',exact:true}).tap();expect(await page.evaluate(()=>getData())).toEqual(before);await expect(page.locator('#houseLayoutSvg')).toContainText('Living room');await expect(page.locator('#preview .layout-sheet-wrap')).toHaveCount(1);await page.locator('#layoutAdjust').tap();await drag(page,'[data-move-wall="w1"]',320,176);
 const after=await page.evaluate(()=>getData()),f=JSON.parse(after.house_layout).floors[0],old=JSON.parse(before.house_layout).floors[0];expect(f.labels).toEqual(old.labels);expect(f.walls[0].a[1]).not.toBe(20);expect(f.walls[1].a[1]).toBe(f.walls[0].a[1]);await page.locator('#layoutUndo').tap();expect(await page.evaluate(()=>getData())).toEqual(before);
});
module.exports={xy,tap,drag,label};
