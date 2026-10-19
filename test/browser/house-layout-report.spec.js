const {test,expect}=require('@playwright/test');
const {chromiumPdfPages}=require('../helpers/chromium-pdf.cjs');
const {bedrooms,outline,label}=require('../helpers/floor-plan-driver');

test('layout pages are opt-in, landscape and inside the same complete report',async({page},testInfo)=>{
 await bedrooms(page);
 await expect(page.locator('#layoutInclude')).not.toBeChecked();
 await outline(page,'ground','Rectangle');await label(page,'lounge',128,224);
 await expect(page.locator('#preview .layout-sheet-wrap')).toHaveCount(0);
 await page.locator('#layoutInclude').check();await expect(page.locator('#preview .layout-sheet-wrap')).toHaveCount(2);
 const before=await page.evaluate(()=>getData());page.on('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Save PDF',exact:true}).click();const opened=page.waitForEvent('popup');
 await page.getByRole('button',{name:'Save report PDF',exact:true}).click();const print=await opened;await print.waitForLoadState('load');
 const headings=await print.locator('main').evaluate(el=>Array.from(el.children,x=>x.querySelector('h2')?.textContent.trim()).filter(Boolean));
 expect(headings.indexOf('Room layout: Ground floor')).toBeGreaterThan(headings.lastIndexOf('Heat Loss'));
 expect(headings.indexOf('Room layout: First floor')).toBeLessThan(headings.indexOf('A12a'));
 expect(headings.at(-1)).toBe('Customer Profile');await expect(print.locator('.layout-sheet-wrap')).toHaveCount(2);
 const pdf=await print.pdf({path:testInfo.outputPath('report-with-layout.pdf'),printBackground:true,preferCSSPageSize:true});
 const pages=chromiumPdfPages(pdf);expect(pages[0].height).toBeGreaterThan(pages[0].width);
 expect(pages.slice(1,-2).every(p=>p.width>p.height)).toBe(true);expect(pages.slice(-2).every(p=>p.height>p.width)).toBe(true);
 expect(pages.every(p=>p.textCodes>40)).toBe(true);expect(await page.evaluate(()=>getData())).toEqual(before);
 await page.locator('#pdfPanel').getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('#layoutInclude').uncheck();await expect(page.locator('#preview .layout-sheet-wrap')).toHaveCount(0);
});
