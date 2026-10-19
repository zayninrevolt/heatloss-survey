const {test,expect}=require('@playwright/test');

test('clickable checklist opens and focuses the missing property field without changing the survey',async({page})=>{
 await page.goto('/index.html');
 await page.getByRole('tab',{name:'Profile',exact:true}).click();
 await page.evaluate(()=>{document.getElementById('commonDetails').open=false;});
 const before=await page.evaluate(()=>getData());
 await page.getByRole('button',{name:'Save PDF',exact:true}).click();
 await page.locator('#pdfChecklistV53').getByRole('link',{name:/Address entered/}).click({timeout:5000});
 await expect(page.locator('#pdfPanel')).not.toBeVisible();
 await expect(page.locator('#frontTab')).toHaveAttribute('aria-selected','true');
 await expect(page.locator('#commonDetails')).toHaveJSProperty('open',true);
 await expect(page.locator('#site_address')).toBeFocused();
 expect(await page.evaluate(()=>getData())).toEqual(before);
});

test('heat-loss checklist finds the started incomplete room and its missing measurement',async({page})=>{
 await page.goto('/index.html');
 await page.evaluate(()=>{document.getElementById('rad_kitchen_len').value='4';update();});
 const before=await page.evaluate(()=>getData());
 await page.getByRole('button',{name:'Save PDF',exact:true}).click();
 await page.locator('#pdfChecklistV53').getByRole('link',{name:/Heat loss calculated/}).click();
 await expect(page.locator('.hl-room-editor.is-active')).toHaveAttribute('data-hl-room','kitchen');
 await expect(page.locator('#rad_kitchen_wid')).toBeFocused();
 expect(await page.evaluate(()=>getData())).toEqual(before);
});

test('hazard checklist opens the incomplete risk and focuses its unanswered hazard',async({page})=>{
 await page.goto('/index.html');
 await page.evaluate(()=>{document.getElementById('a_working_heights_haz').value='';document.querySelectorAll('#a12aForm details').forEach(d=>d.open=false);update();});
 await page.getByRole('button',{name:'Save PDF',exact:true}).click();
 await page.locator('#pdfChecklistV53').getByRole('link',{name:/A12a hazard/}).click();
 await expect(page.locator('#a12aTab')).toHaveAttribute('aria-selected','true');
 await expect(page.locator('#a_working_heights_haz')).toBeFocused();
 await expect(page.locator('#a_working_heights_haz')).toBeVisible();
});

test('radiator checklist opens a room radiator decision rather than the read-only counter',async({page})=>{
 await page.goto('/index.html');
 await page.getByRole('button',{name:'Save PDF',exact:true}).click();
 await page.locator('#pdfChecklistV53').getByRole('link',{name:/Radiators counted/}).click();
 await expect(page.locator('#radsTab')).toHaveAttribute('aria-selected','true');
 await expect(page.locator('#rad_lounge_outcome')).toBeFocused();
 await expect(page.locator('#rad_lounge_outcome')).toBeVisible();
});

test('checklist exposes complete and missing states to assistive technology',async({page})=>{
 await page.goto('/index.html');await page.getByRole('button',{name:'Save PDF',exact:true}).click();
 const checklist=page.locator('#pdfChecklistV53');
 await expect(checklist.getByRole('img',{name:'Needs attention',exact:true}).first()).toBeVisible();
 await expect(checklist.getByRole('img',{name:'Complete',exact:true}).first()).toBeVisible();
});

for(const [label,target,tab] of [
 ['Customer name entered','site_customer','frontTab'],['Surveyor entered','site_surveyor','frontTab'],['Survey date entered','site_date','frontTab'],
 ['Warning code entered','front_warning_codes','frontTab'],['Installation type selected','mat_install_type','radsTab'],
 ['Tenant signature completed','tenantSigPadV35','profileTab'],['Surveyor signature completed','surveyorSigPadV35','profileTab']
])test('checklist navigates to '+label,async({page})=>{
 await page.goto('/index.html');
 const before=await page.evaluate(()=>getData());
 await page.getByRole('button',{name:'Save PDF',exact:true}).click();
 await page.locator('#pdfChecklistV53').getByRole('link',{name:label,exact:true}).click();
 await expect(page.locator('#'+tab)).toHaveAttribute('aria-selected','true');
 await expect(page.locator('#'+target)).toBeVisible();
 await expect(page.locator('#'+target)).toBeFocused();
 expect(await page.evaluate(()=>getData())).toEqual(before);
});
