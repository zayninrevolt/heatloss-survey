const {test,expect}=require('@playwright/test');
const KEY='heatlossPersonalDefaultsV1';
async function settings(page){
 await page.locator('#moreToggleV58').click();
 await page.getByRole('menuitem',{name:'Personal defaults',exact:true}).click({timeout:5000});
 return page.getByRole('dialog',{name:'Personal defaults',exact:true});
}

test('personal defaults persist locally and apply only when starting a new survey',async({page})=>{
 await page.goto('/index.html');
 await page.locator('#site_address').fill('Synthetic existing job');
 await page.locator('#site_address').dispatchEvent('change');
 await page.locator('#site_surveyor').fill('Existing surveyor');
 await page.locator('#site_surveyor').dispatchEvent('change');
 await page.locator('#site_company').fill('Existing company');
 await page.locator('#site_company').dispatchEvent('change');
 const before=await page.evaluate(()=>getData());
 const dialog=await settings(page);
 await dialog.getByLabel('Default surveyor name',{exact:true}).fill('  Synthetic Surveyor  ');
 await dialog.getByLabel('Default company name',{exact:true}).fill('Synthetic Heating Ltd');
 await dialog.getByRole('button',{name:'Save defaults',exact:true}).click();
 await expect(dialog).not.toBeVisible();
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY)).toEqual({version:1,surveyor:'Synthetic Surveyor',company:'Synthetic Heating Ltd'});
 expect(await page.evaluate(()=>getData())).toEqual(before);
 await page.reload();
 await expect(page.locator('#site_surveyor')).toHaveValue('Existing surveyor');
 await expect(page.locator('#site_company')).toHaveValue('Existing company');
 page.on('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Surveys',exact:true}).click();
 await page.getByRole('button',{name:'New survey',exact:true}).click();
 await expect(page.locator('#site_address')).toHaveValue('');
 await expect(page.locator('#site_surveyor')).toHaveValue('Synthetic Surveyor');
 await expect(page.locator('#site_company')).toHaveValue('Synthetic Heating Ltd');
 await expect(page.locator('#front_surveyor')).toHaveValue('Synthetic Surveyor');
 await expect(page.locator('#preview .report-cover-company')).toHaveText('Synthetic Heating Ltd');
 await page.getByRole('button',{name:'Surveys',exact:true}).click();
 await page.locator('.survey-item-v57').filter({hasText:'Synthetic existing job'}).getByRole('button',{name:'Open',exact:true}).click();
 await expect(page.locator('#site_surveyor')).toHaveValue('Existing surveyor');
 await expect(page.locator('#site_company')).toHaveValue('Existing company');
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).surveyor,KEY)).toBe('Synthetic Surveyor');
});

test('personal defaults populate a genuinely fresh survey on opening the app',async({page})=>{
 await page.addInitScript(({key})=>localStorage.setItem(key,JSON.stringify({version:1,surveyor:'Fresh default surveyor',company:'Fresh default company'})),{key:KEY});
 await page.goto('/index.html');
 await expect(page.locator('#site_surveyor')).toHaveValue('Fresh default surveyor');
 await expect(page.locator('#site_company')).toHaveValue('Fresh default company');
 await expect(page.locator('#front_surveyor')).toHaveValue('Fresh default surveyor');
 await expect(page.locator('#site_address')).toHaveValue('');
 await expect(page.locator('#site_customer')).toHaveValue('');
 await expect(page.locator('#property_photo')).toHaveValue('');
 await expect(page.locator('#p_tenant_sig')).toHaveValue('');
 await expect(page.locator('#p_surveyor_sig')).toHaveValue('');
});

test('loading a survey with blank author fields does not fill them from personal defaults',async({page})=>{
 await page.goto('/index.html');
 await page.evaluate(key=>{localStorage.setItem(key,JSON.stringify({version:1,surveyor:'Do not inject',company:'Private preference'}));setData({...getData(),site_address:'Synthetic imported job',front_address:'Synthetic imported job',site_surveyor:'',front_surveyor:'',site_company:''});},KEY);
 await page.reload();
 await expect(page.locator('#site_surveyor')).toHaveValue('');
 await expect(page.locator('#site_company')).toHaveValue('');
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).surveyor,KEY)).toBe('Do not inject');
});

test('cancelled new-survey confirmation leaves the current job untouched',async({page})=>{
 await page.goto('/index.html');
 await page.locator('#site_address').fill('Synthetic job to keep');await page.locator('#site_address').dispatchEvent('change');
 await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({version:1,surveyor:'Do not apply',company:'Do not apply'})),KEY);
 const before=await page.evaluate(()=>getData());
 page.on('dialog',d=>d.dismiss());
 await page.getByRole('button',{name:'Surveys',exact:true}).click();
 await page.getByRole('button',{name:'New survey',exact:true}).click();
 expect(await page.evaluate(()=>getData())).toEqual(before);
});

test('defaults dialog supports cancellation and a complete keyboard focus trap',async({page})=>{
 await page.goto('/index.html');
 const dialog=await settings(page);
 await expect(dialog.getByLabel('Default surveyor name',{exact:true})).toBeFocused();
 const controls=dialog.locator('input,button');
 const count=await controls.count();
 for(let i=1;i<=count;i++){await page.keyboard.press('Tab');await expect(controls.nth(i%count)).toBeFocused();}
 await dialog.getByLabel('Default surveyor name',{exact:true}).fill('Unsaved preference');
 await page.keyboard.press('Escape');
 await expect(dialog).not.toBeVisible();await expect(page.locator('#moreToggleV58')).toBeFocused();
 expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBeNull();
 const reopened=await settings(page);await expect(reopened.getByLabel('Default surveyor name',{exact:true})).toHaveValue('');
 await reopened.getByRole('button',{name:'Cancel',exact:true}).click();await expect(reopened).not.toBeVisible();
});

test('blocked preference storage reports failure without changing the job or existing preferences',async({page})=>{
 await page.goto('/index.html');
 const before=await page.evaluate(()=>getData());
 await page.evaluate(key=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Blocked','QuotaExceededError');return original.call(this,k,v);};},KEY);
 const dialog=await settings(page);await dialog.getByLabel('Default surveyor name',{exact:true}).fill('Cannot save');
 await dialog.getByRole('button',{name:'Save defaults',exact:true}).click();
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('status')).toContainText('Could not save defaults');
 expect(await page.evaluate(()=>getData())).toEqual(before);
 expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBeNull();
});

test('JSON imports preserve their own author details without changing personal defaults',async({page})=>{
 await page.goto('/index.html');page.on('dialog',d=>d.accept());
 const preference={version:1,surveyor:'My saved default',company:'My saved company'};
 await page.evaluate(({key,preference})=>localStorage.setItem(key,JSON.stringify(preference)),{key:KEY,preference});
 const data=await page.evaluate(()=>({...getData(),site_address:'Synthetic imported job',front_address:'Synthetic imported job',site_surveyor:'Imported author',front_surveyor:'Imported author',site_company:'Imported company'}));
 await page.locator('#loadFile').setInputFiles({name:'synthetic-survey.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await expect(page.locator('#site_surveyor')).toHaveValue('Imported author');
 await expect(page.locator('#site_company')).toHaveValue('Imported company');
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY)).toEqual(preference);
});

for(const raw of ['not valid JSON',JSON.stringify({version:2,surveyor:'Unsupported version'})])test('unreadable or unsupported defaults are ignored safely: '+raw.slice(0,20),async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:KEY,raw});
 await page.goto('/index.html');const dialog=await settings(page);
 await expect(dialog.getByLabel('Default surveyor name',{exact:true})).toHaveValue('');
 await expect(dialog.getByLabel('Default company name',{exact:true})).toHaveValue('');
 expect(errors).toEqual([]);
});

test('only bounded author fields are used, and default text cannot inject HTML or customer data',async({page})=>{
 const company='<img src=x onerror="window.__preferenceExecuted=true">';
 await page.addInitScript(({key,company})=>localStorage.setItem(key,JSON.stringify({version:1,surveyor:'S'.repeat(200),company,site_address:'Must not copy',site_customer:'Must not copy',property_photo:'Must not copy',p_tenant_sig:'Must not copy'})),{key:KEY,company});
 await page.goto('/index.html');
 await expect(page.locator('#site_surveyor')).toHaveValue('S'.repeat(120));
 await expect(page.locator('#site_company')).toHaveValue(company);
 await expect(page.locator('#preview .report-cover-company img')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__preferenceExecuted)).toBeUndefined();
 for(const id of ['site_address','site_customer','property_photo','p_tenant_sig','p_surveyor_sig'])await expect(page.locator('#'+id)).toHaveValue('');
});
