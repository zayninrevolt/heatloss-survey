(function (win) {
  'use strict';
  var doc = win.document;
  if (doc.documentElement.dataset.workflowQolInstalled) return;
  doc.documentElement.dataset.workflowQolInstalled = 'yes';

  function reveal(target) {
    for (var parent = target.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
  }

  function checklistTarget(id) {
    if (id === 'heatLossSummaryCard' || id === 'hl_rooms_card') {
      var rooms = (win.heatLossResultsV60 || {}).rooms || [];
      var room = rooms.find(function (r) { return r.started && !r.complete; }) ||
        rooms.find(function (r) { return !r.complete; }) || rooms[0];
      if (room) {
        win.selectRadiatorRoomV60(room.key);
        if (id === 'hl_rooms_card') return doc.getElementById('rad_' + room.key + '_outcome');
        var fields = ['rad_' + room.key + '_len', 'rad_' + room.key + '_wid', 'rad_' + room.key + '_outside'];
        var missing = fields.map(function (fieldId) { return doc.getElementById(fieldId); })
          .find(function (field) { return field && (field.value === '' || (field.type === 'number' && Number(field.value) <= 0)); });
        return missing || doc.getElementById('hl_' + room.key + '_result') || doc.getElementById(fields[0]);
      }
    }
    if (id === 'a12aForm') {
      var risks = Array.from(doc.querySelectorAll('#a12aForm select[id$="_app"]'));
      for (var app of risks) {
        if (!app.value.trim()) return app;
        var hazard = doc.getElementById(app.id.replace(/_app$/, '_haz'));
        if (app.value !== 'No' && hazard && !hazard.value.trim()) return hazard;
      }
      return risks[0] || doc.getElementById(id);
    }
    return doc.getElementById(id);
  }

  doc.addEventListener('click', function (event) {
    var link = event.target.closest('[data-survey-check]');
    if (!link || !link.closest('#pdfChecklistV53')) return;
    event.preventDefault();
    var target = checklistTarget(link.dataset.surveyCheck);
    if (!target) return;
    win.hidePdfOptions();
    var section = target.closest('[role="tabpanel"]');
    var tab = doc.querySelector('.tab[data-tab="' + (section ? section.id : 'frontForm') + '"]');
    if (tab) tab.click();
    reveal(target);
    win.requestAnimationFrame(function () {
      reveal(target);
      if (!target.matches('input, select, textarea, button, a[href], [tabindex]')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
  });

  // Preferences are separate from survey payloads and never learned from an import.
  var defaultsKey = 'heatlossPersonalDefaultsV1';
  function preferenceText(value) {
    return typeof value === 'string' ? value.trim().slice(0, 120) : '';
  }
  function readDefaults() {
    try {
      var value = JSON.parse(win.localStorage.getItem(defaultsKey) || 'null');
      if (!value || value.version !== 1) return { version: 1, surveyor: '', company: '' };
      return { version: 1, surveyor: preferenceText(value.surveyor), company: preferenceText(value.company) };
    } catch (error) {
      return { version: 1, surveyor: '', company: '' };
    }
  }
  function applyPersonalDefaults() {
    var value = readDefaults();
    if (!value.surveyor && !value.company) return;
    var surveyor = doc.getElementById('site_surveyor');
    var company = doc.getElementById('site_company');
    var setSurveyor = surveyor && !surveyor.value && value.surveyor;
    if (setSurveyor) surveyor.value = value.surveyor;
    if (company && !company.value) company.value = value.company;
    // The common-field change handler also updates the legacy Front alias,
    // which is required when the saved survey is rebuilt on reload.
    if (setSurveyor) surveyor.dispatchEvent(new win.Event('change', { bubbles: true }));
    else win.update();
  }

  var defaultsPanel = doc.createElement('div');
  defaultsPanel.id = 'personalDefaultsPanel';
  defaultsPanel.className = 'pdf-panel';
  defaultsPanel.setAttribute('role', 'dialog');
  defaultsPanel.setAttribute('aria-modal', 'true');
  defaultsPanel.setAttribute('aria-labelledby', 'personalDefaultsTitle');
  defaultsPanel.setAttribute('aria-hidden', 'true');
  // Static markup only. Stored strings are assigned to input.value, never HTML.
  defaultsPanel.innerHTML = '<form class="pdf-card" id="personalDefaultsForm">' +
    '<h3 id="personalDefaultsTitle">Personal defaults</h3>' +
    '<p>Used when starting a new survey. Saving defaults does not change the current job.</p>' +
    '<div class="field"><label for="defaultSurveyorName">Default surveyor name</label>' +
    '<input type="text" id="defaultSurveyorName" maxlength="120" autocomplete="off"></div>' +
    '<div class="field"><label for="defaultCompanyName">Default company name</label>' +
    '<input type="text" id="defaultCompanyName" maxlength="120" autocomplete="off"></div>' +
    '<p>Stored only in this browser on this device, not in cookies or a cloud account. Clearing site data removes these defaults. Customer details, photos and signatures are never saved as defaults.</p>' +
    '<p id="personalDefaultsStatus" role="status" aria-live="polite"></p>' +
    '<button type="submit">Save defaults</button>' +
    '<button type="button" class="secondary" id="cancelPersonalDefaults">Cancel</button></form>';
  doc.body.appendChild(defaultsPanel);
  win.installModalFocusTrap(defaultsPanel);

  function closeDefaults() {
    defaultsPanel.classList.remove('open');
    defaultsPanel.setAttribute('aria-hidden', 'true');
    doc.getElementById('moreToggleV58').focus();
  }
  var defaultsMenu = doc.createElement('button');
  defaultsMenu.type = 'button';
  defaultsMenu.setAttribute('role', 'menuitem');
  defaultsMenu.textContent = 'Personal defaults';
  doc.getElementById('moreDangerSepV58').before(defaultsMenu);
  defaultsMenu.addEventListener('click', function () {
    win.closeMoreMenuV58();
    var value = readDefaults();
    doc.getElementById('defaultSurveyorName').value = value.surveyor;
    doc.getElementById('defaultCompanyName').value = value.company;
    doc.getElementById('personalDefaultsStatus').textContent = '';
    defaultsPanel.classList.add('open');
    defaultsPanel.setAttribute('aria-hidden', 'false');
    doc.getElementById('defaultSurveyorName').focus();
  });
  doc.getElementById('cancelPersonalDefaults').addEventListener('click', closeDefaults);
  defaultsPanel.addEventListener('click', function (event) {
    if (event.target === defaultsPanel) closeDefaults();
  });
  defaultsPanel.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { event.stopPropagation(); closeDefaults(); }
  });
  doc.getElementById('personalDefaultsForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var value = { version: 1, surveyor: preferenceText(doc.getElementById('defaultSurveyorName').value),
      company: preferenceText(doc.getElementById('defaultCompanyName').value) };
    try {
      win.localStorage.setItem(defaultsKey, JSON.stringify(value));
      closeDefaults();
      win.showAppStatus('Personal defaults saved for new surveys on this device.');
    } catch (error) {
      doc.getElementById('personalDefaultsStatus').textContent = 'Could not save defaults in this browser. Your survey has not changed.';
    }
  });
  var previousNewSurvey = win.newSurveyV57;
  win.newSurveyV57 = function () {
    var started = previousNewSurvey.apply(this, arguments);
    if (started === true) applyPersonalDefaults();
    return started;
  };

  if (win._personalDefaultsFreshStart) applyPersonalDefaults();

  var style = doc.createElement('style');
  style.textContent = '#pdfPanel .pdf-card,#personalDefaultsPanel .pdf-card{box-sizing:border-box;width:min(430px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow-y:auto}' +
    '#personalDefaultsPanel input,#personalDefaultsPanel button{min-height:44px}' +
    '@media print{#personalDefaultsPanel{display:none!important}}' +
    '#pdfChecklistV53 li{align-items:center}#pdfChecklistV53 a{display:flex;align-items:center;min-height:44px;flex:1;color:inherit;text-decoration:underline;text-underline-offset:3px}' +
    '#pdfChecklistV53 a:focus-visible{outline:3px solid #2563eb;outline-offset:2px;border-radius:4px}';
  doc.head.appendChild(style);
})(window);
