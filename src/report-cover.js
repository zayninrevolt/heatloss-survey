(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) { root.ReportCover = api; api.install(root); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var MAX_PHOTO_LENGTH = 360000;

  function isSafePhoto(value) {
    return typeof value === 'string' && value.length <= MAX_PHOTO_LENGTH &&
      /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value);
  }

  function escape(value) {
    return String(value || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render(data) {
    var hasPhoto = isSafePhoto(data.property_photo);
    var rawDate = String(data.site_date || data.front_date || '');
    var date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate.split('-').reverse().join('/') : rawDate;
    return '<section class="report-cover" aria-label="Report cover">' +
      (data.site_company ? '<p class="report-cover-company">' + escape(data.site_company) + '</p>' : '') +
      '<p class="report-cover-kicker">Property survey</p><h2>Heating survey report</h2>' +
      '<p class="report-cover-address">' + escape(data.site_address || data.front_address || 'Property address not entered') + '</p>' +
      '<p class="report-cover-postcode">' + escape(data.site_postcode || data.front_postcode) + '</p>' +
      (hasPhoto ? '<img src="' + data.property_photo + '" alt="Front of the surveyed property">' :
        '<div class="report-cover-photo-placeholder">Property photo (optional)<br>No photo added</div>') +
      '<dl><div><dt>Survey date</dt><dd>' + escape(date || 'Not entered') + '</dd></div>' +
      '<div><dt>Surveyor</dt><dd>' + escape(data.site_surveyor || data.front_surveyor || 'Not entered') + '</dd></div></dl>' +
      '<p class="report-cover-footer">Heating survey and room-by-room heat-loss report</p></section>';
  }

  var styles = '\n' +
    '.property-photo-card{margin-bottom:14px;padding:16px;border:1px solid #cbd5e1;border-radius:12px}' +
    '.property-photo-card h2{margin:0 0 8px;font-size:18px}.property-photo-card input[type=file]{max-width:100%;margin:10px 0}' +
    '.property-photo-card img{display:block;width:100%;max-height:200px;object-fit:contain;background:#eef2f6;border-radius:8px}' +
    '.property-photo-card [hidden]{display:none!important}.property-photo-card button{min-height:44px;margin-top:10px}' +
    '.property-photo-card p{font-size:13px;line-height:1.5}.property-photo-card [role=status]{overflow-wrap:anywhere}' +
    '.report-cover{box-sizing:border-box;width:min(100%,703px);min-width:0;min-height:950px;margin:0 auto 24px;padding:48px;background:#fff;color:#172b3a;border-top:8px solid #244c63;box-shadow:0 2px 12px #0001;font-family:Arial,sans-serif}' +
    '.report-cover .report-cover-kicker{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#456478;margin:0 0 18px}' +
    '.report-cover-company{font-size:19px;font-weight:700;overflow-wrap:anywhere;margin:0 0 18px;color:#244c63}' +
    '.report-cover h2{font-size:32px;line-height:1.15;margin:0 0 24px;color:#172b3a}' +
    '.report-cover-address{font-size:23px;line-height:1.35;white-space:pre-line;overflow-wrap:anywhere;margin:0 0 6px}' +
    '.report-cover-postcode{font-size:16px;margin:0 0 28px}.report-cover img{display:block;width:100%;height:360px;object-fit:contain;background:#f0f4f6}' +
    '.report-cover-photo-placeholder{box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;width:100%;height:360px;background:#f0f4f6;border:1px dashed #aabac5;color:#456478;font-size:15px;line-height:1.6}' +
    '.report-cover dl{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:30px 0}.report-cover dt{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#456478;margin-bottom:8px}' +
    '.report-cover dd{margin:0;font-size:16px;overflow-wrap:anywhere}.report-cover-footer{font-size:11px;color:#456478;border-top:1px solid #cbd5e1;padding-top:18px;margin-top:36px}' +
    '@media(max-width:600px){.report-cover{padding:24px;min-height:0}.report-cover h2{font-size:25px}.report-cover img{height:240px}.report-cover-address{font-size:20px}}';

  // One print contract for the main browser document and every PDF popup.
  // Keep these rules last so legacy print-fit wrappers cannot override them.
  var printStyles = `
@page property-cover { size: A4 portrait; margin: 12mm; }
@page property-report { size: A4 landscape; margin: 6mm; }
@page property-hns { size: A4 portrait; margin: 6mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; width: auto !important; background: #fff !important; }
  .app { display: block !important; }
  .main { width: auto !important; max-width: none !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
  .sheet-wrap {
    page: property-report; width: 285mm !important; max-width: 285mm !important;
    min-width: 0 !important; margin: 0 !important; padding: 0 !important;
    border: 0 !important; box-shadow: none !important; overflow: visible !important;
    break-after: page; page-break-after: always;
  }
  .sheet-wrap:last-child { break-after: auto; page-break-after: auto; }
  .sheet-wrap:has(.sheet.a12a), .sheet-wrap:has(.sheet.profile) {
    page: property-hns; width: 198mm !important; max-width: 198mm !important;
  }
  .sheet-wrap table.sheet.a12a, .sheet-wrap table.sheet.profile {
    width: 198mm !important; max-width: 198mm !important; min-width: 0 !important;
  }
  .sheet.heatloss-sheet { width: 285mm !important; max-width: 285mm !important; }
  .sheet.a12a td, .sheet.a12a th, .sheet.profile td, .sheet.profile th {
    height: auto !important; min-height: 0 !important; padding: 1.2px 2px !important;
    font-size: 7pt !important; line-height: 1.06 !important;
    white-space: normal !important; overflow-wrap: anywhere !important;
  }
  .sheet.profile td, .sheet.profile th { font-size: 6.6pt !important; }
  .sheet.profile .small { font-size: 5.8pt !important; }
  .sheet.profile { break-inside: auto !important; page-break-inside: auto !important; }
  .sheet.profile tr { break-inside: avoid; page-break-inside: avoid; }
  .sheet-wrap:has(.sheet.profile) > .sheet-title { break-after: avoid; page-break-after: avoid; }
  table.sheet.profile span.signature-cell, table.sheet.profile .signature-cell,
  table.sheet.profile img.signature-img, table.sheet.profile .signature-img,
  table.sheet.profile span.signature-placeholder, table.sheet.profile .signature-placeholder,
  table.sheet.profile td.input:has(span.signature-cell),
  table.sheet.profile td.input:has(span.signature-placeholder) {
    height: 36px !important; min-height: 36px !important; max-height: 36px !important;
  }
  table.sheet.profile img.signature-img { object-fit: contain !important; }
  .report-cover {
    page: property-cover; break-after: page; page-break-after: always; break-inside: avoid;
    display: flex; flex-direction: column; width: 186mm !important; height: 270mm !important;
    min-height: 0 !important; padding: 10mm !important; margin: 0 auto !important;
    box-shadow: none; border-top: 2mm solid #244c63;
  }
  .report-cover h2 { font-size: 24pt; }
  .report-cover-address { font-size: 18pt; }
  .report-cover img, .report-cover-photo-placeholder { height: 105mm; flex-shrink: 0; }
  .report-cover dl { margin: 8mm 0; }
  .report-cover-footer { margin-top: auto; }
}
`;

  function orderSections(container) {
    var order = ['Front', 'Rads', 'Heat Loss', 'A12a', 'Customer Profile'];
    var sections = Array.from(container.children).filter(function (section) {
      return section.classList.contains('sheet-wrap');
    });
    function rank(section) {
      var heading = section.querySelector('h2');
      var index = order.indexOf(heading ? heading.textContent.trim() : '');
      return index < 0 ? order.length : index;
    }
    // Move the existing nodes. Do not reconstruct tables or change survey data.
    sections.sort(function (a, b) { return rank(a) - rank(b); }).forEach(function (section) {
      container.appendChild(section);
    });
  }

  function install(win) {
    var doc = win.document;
    var field = doc.getElementById('property_photo');
    if (!field || doc.getElementById('propertyPhotoCard')) return;
    var style = doc.createElement('style');
    style.id = 'reportCoverStyles'; style.textContent = styles + printStyles;
    doc.head.appendChild(style);
    var card = doc.createElement('div');
    card.id = 'propertyPhotoCard'; card.className = 'card property-photo-card';
    // Static UI markup only. User data is assigned via textContent or a validated JPEG src.
    card.innerHTML = '<h2>Report cover</h2>' +
      '<div class="field" id="reportCompanyField"><label for="site_company">Company name (optional)</label></div>' +
      '<p>The portrait cover is previewed with the other documents and included in the report PDF. A property photo is optional. Report pages stay landscape; the photo and company name are included in your editable JSON backup.</p>' +
      '<label for="propertyPhotoFile">Add or replace property photo</label>' +
      '<input type="file" id="propertyPhotoFile" accept="image/jpeg,image/png,image/webp">' +
      '<img id="propertyPhotoPreview" alt="Selected front-of-property photo" hidden>' +
      '<button type="button" id="removePropertyPhoto" hidden>Remove photo</button>' +
      '<p id="propertyPhotoStatus" role="status" aria-live="polite">Optional. Choose a JPEG, PNG or WebP photo.</p>';
    doc.getElementById('frontForm').prepend(card);
    var company = doc.getElementById('site_company');
    company.type = 'text';
    company.maxLength = 120;
    company.placeholder = 'Company or trading name';
    doc.getElementById('reportCompanyField').appendChild(company);
    company.addEventListener('input', function (event) { win.update(event); });
    company.addEventListener('change', function () { win.update(); });
    var picker = doc.getElementById('propertyPhotoFile');
    var preview = doc.getElementById('propertyPhotoPreview');
    var remove = doc.getElementById('removePropertyPhoto');
    var status = doc.getElementById('propertyPhotoStatus');
    var generation = 0;

    function sync() {
      var valid = isSafePhoto(field.value);
      preview.hidden = !valid; remove.hidden = !valid;
      if (valid && preview.getAttribute('src') !== field.value) preview.src = field.value;
      if (!valid) preview.removeAttribute('src');
    }

    function report(message) { status.textContent = message; }

    function compress(file) {
      return new Promise(function (resolve, reject) {
        var url = win.URL.createObjectURL(file);
        var image = new win.Image();
        image.onerror = function () { win.URL.revokeObjectURL(url); reject(new Error('This photo could not be read. Choose a JPEG, PNG or WebP image.')); };
        image.onload = function () {
          win.URL.revokeObjectURL(url);
          try {
            var scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
            var canvas = doc.createElement('canvas');
            for (var attempt = 0; attempt < 8; attempt += 1) {
              canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
              canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
              var ctx = canvas.getContext('2d');
              ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
              var value = canvas.toDataURL('image/jpeg', Math.max(.5, .82 - attempt * .06));
              if (isSafePhoto(value)) { resolve(value); return; }
              scale *= .8;
            }
            reject(new Error('This photo is too large to save. Choose a smaller image.'));
          } catch (error) { reject(new Error('This photo could not be processed. Try a smaller JPEG image.')); }
        };
        image.src = url;
      });
    }

    picker.addEventListener('change', async function () {
      var file = picker.files[0];
      if (!file) return;
      var token = ++generation;
      picker.value = '';
      card.removeAttribute('aria-busy');
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 20 * 1024 * 1024) {
        report('Choose a JPEG, PNG or WebP image no larger than 20 MB. Your existing photo has not changed.');
        return;
      }
      report('Preparing property photo...');
      card.setAttribute('aria-busy', 'true');
      try {
        var value = await compress(file);
        if (token !== generation) return;
        field.value = value; sync(); win.update();
        report('Photo added. Included in saved surveys, JSON backups and the report cover.');
      } catch (error) {
        if (token === generation) report(error.message + ' Your existing photo has not changed.');
      } finally {
        if (token === generation) card.removeAttribute('aria-busy');
      }
    });
    remove.addEventListener('click', function () {
      generation += 1; field.value = ''; sync(); win.update();
      card.removeAttribute('aria-busy'); report('Photo removed. The cover remains available with a photo placeholder.');
    });

    var previousSetData = win.setData;
    win.setData = function (data) {
      var photo = data && data.property_photo || '';
      if (photo && !isSafePhoto(photo)) throw new Error('Invalid property photo in this survey.');
      generation += 1; field.value = photo;
      company.value = data && data.site_company || '';
      card.removeAttribute('aria-busy');
      var result = previousSetData.apply(this, arguments);
      sync(); report(photo ? 'Saved property photo restored.' : 'Optional. Choose a JPEG, PNG or WebP photo.');
      return result;
    };
    ['clearForm', 'newSurveyV57'].forEach(function (name) {
      var previous = win[name];
      win[name] = function () {
        generation += 1;
        card.removeAttribute('aria-busy');
        var result = previous.apply(this, arguments);
        sync();
        report(isSafePhoto(field.value) ? 'Property photo ready.' : 'Optional. Choose a JPEG, PNG or WebP photo.');
        return result;
      };
    });
    var previousBuildPrintHtml = win.buildPrintHtml;
    win.buildPrintHtml = function (title, sheetTitles, orientation) {
      var html = previousBuildPrintHtml.apply(this, arguments);
      var titles = Array.from(sheetTitles || []);
      var includeCover = titles.includes('Cover') || (titles.includes('Front') && titles.includes('Rads'));
      // The source report HTML is generated by this app. The photo has a strict
      // JPEG/base64 allowlist and every user-entered text value is escaped.
      var parsed = new win.DOMParser().parseFromString(html, 'text/html');
      if (includeCover) parsed.querySelector('main').insertAdjacentHTML('afterbegin', render(win.getData()));
      orderSections(parsed.querySelector('main'));
      var printStyle = parsed.createElement('style');
      printStyle.textContent = printStyles;
      // Preserve the existing portrait-only heat-loss export. Native printing
      // and the combined survey still use the landscape report page contract.
      if (orientation === 'portrait' && !includeCover &&
          !titles.includes('A12a') && !titles.includes('Customer Profile')) {
        printStyle.textContent += '@page property-report{size:A4 portrait;margin:6mm}' +
          '@media print{.sheet-wrap,.sheet.heatloss-sheet{width:198mm!important;max-width:198mm!important}}';
      }
      parsed.head.appendChild(printStyle);
      return '<!doctype html>\n' + parsed.documentElement.outerHTML;
    };
    var previousRenderFront = win.renderFront;
    win.renderFront = function () {
      sync();
      return render(win.getData()) + previousRenderFront.apply(this, arguments);
    };
    var previousRenderPreview = win.renderPreview;
    win.renderPreview = function () {
      var result = previousRenderPreview.apply(this, arguments);
      orderSections(doc.getElementById('preview'));
      return result;
    };
    sync(); win.update();
  }

  return { MAX_PHOTO_LENGTH: MAX_PHOTO_LENGTH, isSafePhoto: isSafePhoto, render: render, install: install };
});
