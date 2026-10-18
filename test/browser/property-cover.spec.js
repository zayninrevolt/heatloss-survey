const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { chromiumPdfPages } = require('../helpers/chromium-pdf.cjs');

async function syntheticPhoto(page, width = 1800, height = 1200) {
  const url = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d9e8ee'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ae6d52'; ctx.fillRect(width * .2, height * .35, width * .6, height * .65);
    ctx.fillStyle = '#35495e'; ctx.beginPath(); ctx.moveTo(width * .1, height * .4);
    ctx.lineTo(width * .5, height * .1); ctx.lineTo(width * .9, height * .4); ctx.fill();
    ctx.fillStyle = '#f6e8ad';
    for (let x = 0; x < 14; x++) for (let y = 0; y < 8; y++) {
      ctx.fillRect(width * (.23 + x * .04), height * (.43 + y * .05), width * .02, height * .025);
    }
    return canvas.toDataURL('image/png');
  }, { width, height });
  return { name: 'synthetic-property.png', mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64') };
}

async function uploadPhoto(page) {
  await page.locator('#propertyPhotoFile').setInputFiles(await syntheticPhoto(page));
  await expect(page.locator('#propertyPhotoPreview')).toBeVisible();
  await expect(page.locator('#property_photo')).toHaveValue(/^data:image\/jpeg;base64,/);
  return page.locator('#property_photo').inputValue();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('property photo is compressed and survives JSON export, import and reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#site_address').fill('12 Synthetic Survey Road');
  const photo = await uploadPhoto(page);
  expect(photo.length).toBeGreaterThan(20000);
  expect(photo.length).toBeLessThanOrEqual(360000);
  const dimensions = await page.locator('#propertyPhotoPreview').evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
  expect(Math.max(dimensions.width, dimensions.height)).toBeLessThanOrEqual(1600);
  const downloaded = page.waitForEvent('download');
  await page.evaluate(() => saveJson());
  const content = await fs.readFile(await (await downloaded).path(), 'utf8');
  expect(JSON.parse(content).property_photo).toBe(photo);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#loadFile').setInputFiles({ name: 'with-photo.json', mimeType: 'application/json', buffer: Buffer.from(content) });
  await expect(page.locator('#appStatusMessage')).toHaveText('Survey backup imported.');
  await expect(page.locator('#property_photo')).toHaveValue(photo);
  await expect(page.locator('#preview .report-cover img')).toHaveAttribute('src', photo);
  await page.reload();
  await expect(page.locator('#propertyPhotoPreview')).toHaveAttribute('src', photo);
  expect(errors).toEqual([]);
});

test('custom company name appears on the cover and round-trips in the editable backup', async ({ page }) => {
  await page.getByLabel('Company name (optional)', { exact: true }).fill('Synthetic Heating & Survey Ltd');
  await uploadPhoto(page);
  await expect(page.locator('#preview .report-cover-company')).toHaveText('Synthetic Heating & Survey Ltd');
  const downloaded = page.waitForEvent('download');
  await page.evaluate(() => saveJson());
  const content = await fs.readFile(await (await downloaded).path(), 'utf8');
  expect(JSON.parse(content).site_company).toBe('Synthetic Heating & Survey Ltd');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#loadFile').setInputFiles({ name: 'company-survey.json', mimeType: 'application/json', buffer: Buffer.from(content) });
  await expect(page.getByLabel('Company name (optional)', { exact: true })).toHaveValue('Synthetic Heating & Survey Ltd');
  await expect(page.locator('#preview .report-cover-company')).toHaveText('Synthetic Heating & Survey Ltd');
  await page.reload();
  await expect(page.getByLabel('Company name (optional)', { exact: true })).toHaveValue('Synthetic Heating & Survey Ltd');
  const old = await page.evaluate(() => { const data = getData(); delete data.site_company; return data; });
  await page.locator('#loadFile').setInputFiles({ name: 'old-company-survey.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
  await expect(page.getByLabel('Company name (optional)', { exact: true })).toHaveValue('');
});

test('saved jobs restore their own photo and old backups do not inherit a previous photo', async ({ page }) => {
  const photo = await uploadPhoto(page);
  await page.locator('#site_address').fill('Synthetic photo job');
  await page.evaluate(() => saveSurveyToListV57());
  const photoJob = await page.evaluate(() => window._activeSurveyIdV57);
  await page.evaluate(() => setData({ site_address: 'Synthetic old job', property_photo: '' }));
  await expect(page.locator('#propertyPhotoPreview')).toBeHidden();
  await page.evaluate(() => saveSurveyAsNewV76());
  const oldJob = await page.evaluate(() => window._activeSurveyIdV57);
  await page.evaluate(id => loadSurveyFromListV57(id), photoJob);
  await expect(page.locator('#propertyPhotoPreview')).toHaveAttribute('src', photo);
  await page.evaluate(id => loadSurveyFromListV57(id), oldJob);
  await expect(page.locator('#property_photo')).toHaveValue('');
  await page.evaluate(id => loadSurveyFromListV57(id), photoJob);
  const legacy = await page.evaluate(() => { const data = getData(); delete data.property_photo; return data; });
  await page.locator('#loadFile').setInputFiles({ name: 'without-photo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
  await expect(page.locator('#property_photo')).toHaveValue('');
  await expect(page.locator('#preview .report-cover')).toHaveCount(1);
  await expect(page.locator('#preview .report-cover-photo-placeholder')).toBeVisible();
  await page.reload();
  await expect(page.locator('#propertyPhotoPreview')).toBeHidden();
});

test('invalid uploads and unsafe imported photos preserve the open survey', async ({ page }) => {
  const photo = await uploadPhoto(page);
  await page.locator('#propertyPhotoFile').setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
  await expect(page.locator('#propertyPhotoStatus')).toContainText('could not be read');
  await expect(page.locator('#property_photo')).toHaveValue(photo);
  await page.locator('#propertyPhotoFile').setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg onload="alert(1)"></svg>') });
  await expect(page.locator('#propertyPhotoStatus')).toContainText('Choose a JPEG, PNG or WebP');
  await expect(page.locator('#property_photo')).toHaveValue(photo);
  const current = await page.evaluate(() => getData());
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  for (const badPhoto of ['https://example.invalid/track.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,/9j/' + 'A'.repeat(360000)]) {
    await page.locator('#loadFile').setInputFiles({ name: 'unsafe-photo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...current, property_photo: badPhoto })) });
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
    await expect(page.locator('#property_photo')).toHaveValue(photo);
  }
  expect(dialogs).toHaveLength(3);
  expect(await page.evaluate(() => getData())).toEqual(current);
});

test('removing and clearing a photo persist without affecting a saved job', async ({ page }) => {
  const photo = await uploadPhoto(page);
  await page.evaluate(() => saveSurveyToListV57());
  const job = await page.evaluate(() => window._activeSurveyIdV57);
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(page.locator('#propertyPhotoPreview')).toBeHidden();
  await expect(page.locator('#preview .report-cover')).toHaveCount(1);
  await expect(page.locator('#preview .report-cover-photo-placeholder')).toBeVisible();
  await page.reload();
  await expect(page.locator('#property_photo')).toHaveValue('');
  await page.evaluate(id => loadSurveyFromListV57(id), job);
  await expect(page.locator('#property_photo')).toHaveValue(photo);
  page.on('dialog', dialog => dialog.accept());
  await page.evaluate(() => clearForm());
  await expect(page.locator('#propertyPhotoPreview')).toBeHidden();
  await page.reload();
  await expect(page.locator('#property_photo')).toHaveValue('');
});

test('clearing the form cancels a photo still being processed', async ({ page }) => {
  const file = await syntheticPhoto(page);
  await page.evaluate(() => {
    const NativeImage = window.Image;
    window.Image = function () {
      const image = new NativeImage();
      image.addEventListener('load', event => event.stopImmediatePropagation(), { once: true });
      window.pendingTestPhoto = image;
      return image;
    };
  });
  await page.locator('#propertyPhotoFile').setInputFiles(file);
  await expect(page.locator('#propertyPhotoCard')).toHaveAttribute('aria-busy', 'true');
  page.on('dialog', dialog => dialog.accept());
  await page.evaluate(() => clearForm());
  await expect(page.locator('#propertyPhotoCard')).not.toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => window.pendingTestPhoto.onload());
  await expect(page.locator('#property_photo')).toHaveValue('');
});

test('complete PDF keeps one portrait cover, unchanged landscape survey and portrait appendices', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const { realisticSurvey } = require('../helpers/realistic-two-storey-driver');
  await realisticSurvey(page);
  const before = await page.evaluate(() => JSON.stringify(window.heatLossResultsV60));
  const baseline = await page.context().newPage();
  await baseline.setContent(await page.evaluate(() => buildPrintHtml('Synthetic baseline', ['Front', 'Rads'], 'landscape')));
  // The cover now exists even without a photo. Compare only the landscape body.
  const baselinePages = chromiumPdfPages(await baseline.pdf({ preferCSSPageSize: true, printBackground: true })).slice(1);
  await baseline.close();
  await page.locator('#frontTab').click();
  await page.getByLabel('Company name (optional)', { exact: true }).fill('Synthetic Heating & Survey Ltd');
  const photo = await uploadPhoto(page);
  expect(await page.evaluate(() => JSON.stringify(window.heatLossResultsV60))).toBe(before);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Save PDF', exact: true }).click();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Save report PDF', exact: true }).click();
  const print = await popup;
  await print.waitForLoadState('load');
  await expect(print.locator('main > :first-child')).toHaveClass('report-cover');
  await expect(print.locator('.report-cover img')).toHaveAttribute('src', photo);
  await expect(print.locator('.report-cover')).toContainText('Heating survey report');
  await expect(print.locator('.report-cover-company')).toHaveText('Synthetic Heating & Survey Ltd');
  await print.evaluate(() => Promise.all(Array.from(document.images, image => image.decode())));
  const buffer = await print.pdf({ path: testInfo.outputPath('portrait-cover-landscape-report.pdf'), preferCSSPageSize: true, printBackground: true });
  const pages = chromiumPdfPages(buffer);
  expect(pages).toHaveLength(baselinePages.length + 3);
  expect(pages[0].height).toBeGreaterThan(pages[0].width);
  expect(pages[0].width).toBeCloseTo(595.28, 0);
  expect(pages[0].height).toBeCloseTo(841.89, 0);
  expect(pages.slice(1, -2).map(p => [p.width, p.height])).toEqual(baselinePages.map(p => [p.width, p.height]));
  expect(pages.slice(1, -2).every(p => p.width > p.height && p.textCodes > 40)).toBe(true);
  expect(pages.slice(-2).every(p => p.height > p.width && p.textCodes > 100)).toBe(true);
  await testInfo.attach('verified-page-sizes', { body: JSON.stringify(pages, null, 2), contentType: 'application/json' });
  await print.locator('.report-cover').screenshot({ path: testInfo.outputPath('cover-preview.png') });
  const hns = await page.evaluate(() => buildPrintHtml('HnS', ['A12a', 'Customer Profile'], 'portrait'));
  expect(hns).not.toContain('aria-label="Report cover"');
});
