const {test,expect}=require('@playwright/test');
const {chromiumPdfPages}=require('../helpers/chromium-pdf.cjs');
async function seed(page,count){await page.goto('/index.html');await page.evaluate(n=>{const p=FloorPlanModel.empty();p.includeReport=true;p.floors=Array.from({length:n},(_,i)=>{const f=FloorPlanModel.blank('floor'+i,['Ground floor','First floor'][i]||'Floor '+(i+1));f.outline=FloorPlanModel.outline(i%2?'L':'Rectangle');const r=PlanRadiators.snap(FloorPlanModel.spaces(f),[5,20]);f.radiators=[{id:'r1',cell:r.cell,edge:r.edge,point:r.point}];return f;});setData({...getData(),house_layout:JSON.stringify(p)});},count);}
test('paired layouts print as one A4 portrait page without changing the other report orientations',async({page},info)=>{
 await seed(page,2);const before=await page.evaluate(()=>getData());page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Save PDF',exact:true}).click();const opened=page.waitForEvent('popup');await page.getByRole('button',{name:'Save report PDF',exact:true}).click();const print=await opened;await print.waitForLoadState('load');await print.emulateMedia({media:'print'});await require('node:fs/promises').writeFile(info.outputPath('layout-print-contract.json'),JSON.stringify(await print.evaluate(()=>({rules:Array.from(document.styleSheets).flatMap(s=>Array.from(s.cssRules)).filter(r=>r.cssText.startsWith('@page')).map(r=>r.cssText),layout:getComputedStyle(document.querySelector('.layout-sheet-wrap')).cssText,figures:Array.from(document.querySelectorAll('[data-layout-floor]'),e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,svg:e.querySelector('svg').getBoundingClientRect().height}))})),null,2));expect(await print.locator('.layout-sheet-wrap').evaluate(e=>getComputedStyle(e).page)).toBe('property-layout');await expect(print.locator('[data-layout-floor]')).toHaveCount(2);const pdf=await print.pdf({path:info.outputPath('portrait-paired-report.pdf'),preferCSSPageSize:true,printBackground:true}),pages=chromiumPdfPages(pdf);expect(pages[0].height).toBeGreaterThan(pages[0].width);expect(pages.slice(1,-3).every(p=>p.width>p.height)).toBe(true);expect(pages.slice(-3).every(p=>p.height>p.width)).toBe(true);expect(pages.at(-3).width).toBeCloseTo(595,0);expect(pages.at(-3).height).toBeCloseTo(842,0);expect(pages.every(p=>p.textCodes>40)).toBe(true);expect(await page.evaluate(()=>getData())).toEqual(before);
});
for(const count of [1,3,8])test('portrait sheets keep every floor exactly once for '+count+' floors',async({page},info)=>{
 await seed(page,count);
 const sheets=Math.ceil(count/2),before=await page.evaluate(()=>getData()),names=JSON.parse(before.house_layout).floors.map(f=>f.name);
 await expect(page.locator('#preview .layout-sheet-wrap')).toHaveCount(sheets);
 await expect(page.locator('#preview [data-layout-floor]')).toHaveCount(count);
 for(let i=0;i<sheets;i++)await expect(page.locator('#preview .layout-sheet-wrap').nth(i).locator('[data-layout-floor]')).toHaveCount(Math.min(2,count-i*2));
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Save PDF',exact:true}).click();
 const opened=page.waitForEvent('popup');await page.getByRole('button',{name:'Save report PDF',exact:true}).click();const print=await opened;await print.waitForLoadState('load');
 await expect(print.locator('.layout-sheet-wrap')).toHaveCount(sheets);
 await expect(print.locator('[data-layout-floor] h3')).toHaveText(names);
 await expect(print.locator('[data-radiator-symbol]')).toHaveCount(count);
 for(let i=0;i<sheets;i++)await expect(print.locator('.layout-sheet-wrap').nth(i).locator('[data-layout-floor]')).toHaveCount(Math.min(2,count-i*2));
 const buffer=await print.pdf({path:info.outputPath('paired-'+count+'-floors.pdf'),preferCSSPageSize:true,printBackground:true}),pages=chromiumPdfPages(buffer);
 expect(pages.slice(1,-(2+sheets)).every(p=>p.width>p.height)).toBe(true);
 expect(pages.slice(-(2+sheets)).every(p=>p.height>p.width)).toBe(true);
 for(const p of pages.slice(-(2+sheets),-2)){expect(p.width).toBeCloseTo(595,0);expect(p.height).toBeCloseTo(842,0);}
 expect(pages.every(p=>p.textCodes>40)).toBe(true);
 // Same popup, renderer and report content: remove ONLY inserted layout sections.
 // Ordinary report pagination varies across Chromium/font environments, not with floor count.
 await print.locator('.layout-sheet-wrap').evaluateAll(nodes=>nodes.forEach(node=>node.remove()));
 const baseline=chromiumPdfPages(await print.pdf({path:info.outputPath('without-layout-'+count+'-floors.pdf'),preferCSSPageSize:true,printBackground:true}));
 expect(pages).toHaveLength(baseline.length+sheets);
 const content=p=>({width:p.width,height:p.height,textCodes:p.textCodes});
 expect(pages.filter((p,i)=>i<pages.length-2-sheets||i>=pages.length-2).map(content)).toEqual(baseline.map(content));
 expect(await page.evaluate(()=>getData())).toEqual(before);
});
test('native print also keeps both layouts on one portrait page',async({page},info)=>{
 await seed(page,2);await page.emulateMedia({media:'print'});const pdf=await page.pdf({path:info.outputPath('native-paired-layout.pdf'),preferCSSPageSize:true,printBackground:true}),pages=chromiumPdfPages(pdf);expect(pages.slice(1,-3).every(p=>p.width>p.height)).toBe(true);expect(pages.slice(-3).every(p=>p.height>p.width)).toBe(true);await page.evaluate(()=>{const d=getData(),p=JSON.parse(d.house_layout);p.includeReport=false;setData({...d,house_layout:JSON.stringify(p)});});const baseline=chromiumPdfPages(await page.pdf({preferCSSPageSize:true,printBackground:true}));expect(pages).toHaveLength(baseline.length+1);const content=p=>({width:p.width,height:p.height,textCodes:p.textCodes});expect(pages.filter((p,i)=>i!==pages.length-3).map(content)).toEqual(baseline.map(content));
});
test('two floors share one portrait-layout preview sheet in saved floor order',async({page})=>{
 await seed(page,2);await expect(page.locator('#preview .layout-sheet-wrap')).toHaveCount(1);await expect(page.locator('#preview [data-layout-floor]')).toHaveCount(2);expect(await page.locator('#preview [data-layout-floor] h3').allTextContents()).toEqual(['Ground floor','First floor']);await expect(page.locator('#preview .layout-sheet-wrap [data-radiator-symbol]')).toHaveCount(2);
});
