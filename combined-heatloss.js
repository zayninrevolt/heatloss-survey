/* Combined radiator survey and room heat-loss calculator. */
(function () {
  var STORAGE_KEY = 'heatLossDataV60';
  var persistenceReady = false;
  var postcodeLookupTimer = null;
  var postcodeLookupInProgress = false;
  var postcodeLookupActivePostcode = '';
  var DESIGN_STATIONS = [
    { location: 'Belfast', station: 'Aldergrove', latitude: 54.6575, longitude: -6.2158, temperature: -3.2 },
    { location: 'Birmingham', station: 'Coleshill', latitude: 52.4800, longitude: -1.6890, temperature: -5.1 },
    { location: 'Cardiff', station: 'St Athan', latitude: 51.4050, longitude: -3.4400, temperature: -3.1 },
    { location: 'Edinburgh', station: 'Gogarbank', latitude: 55.9290, longitude: -3.3430, temperature: -5.4 },
    { location: 'Glasgow', station: 'Bishopton', latitude: 55.9070, longitude: -4.5330, temperature: -5.6 },
    { location: 'Leeds', station: 'Church Fenton', latitude: 53.8340, longitude: -1.1950, temperature: -3.3 },
    { location: 'London', station: 'Heathrow', latitude: 51.4790, longitude: -0.4490, temperature: -3.0 },
    { location: 'Manchester', station: 'Woodford', latitude: 53.3380, longitude: -2.1490, temperature: -4.5 },
    { location: 'Newcastle', station: 'Albemarle', latitude: 55.0190, longitude: -1.8800, temperature: -3.7 },
    { location: 'Norwich', station: 'Marham', latitude: 52.6510, longitude: 0.5690, temperature: -4.6 },
    { location: 'Nottingham', station: 'Watnall', latitude: 53.0050, longitude: -1.2500, temperature: -3.9 },
    { location: 'Plymouth', station: 'Mountbatten', latitude: 50.3540, longitude: -4.1210, temperature: -1.5 },
    { location: 'Southampton', station: 'Hurn', latitude: 50.7790, longitude: -1.8350, temperature: -4.8 },
    { location: 'Swindon', station: 'Brize Norton', latitude: 51.7580, longitude: -1.5760, temperature: -4.6 }
  ];
  var VALUES = {
    externalWall: {
      'Solid brick, uninsulated': 2.1,
      'Cavity wall, uninsulated': 1.6,
      'Cavity wall, insulated': 0.55,
      'Modern insulated wall': 0.28
    },
    internalWall: {
      'None': 0,
      'Single brick wall': 2.05,
      'Stud and plasterboard': 1.76
    },
    window: {
      'No windows': 0,
      'Single glazing': 4.8,
      'Double glazing': 2.8
    },
    door: {
      'No external door': 0,
      'Solid timber door': 3.0,
      'Insulated external door': 1.8
    },
    floor: {
      'Heated room below': 0,
      'Uninsulated ground or exposed floor': 0.7,
      'Insulated ground floor': 0.25
    },
    loft: {
      'Heated room above': 0,
      'Plasterboard, no loft insulation': 2.3,
      'Plasterboard with 50mm insulation': 0.68,
      'Plasterboard with 100mm insulation': 0.4,
      'Plasterboard with 200mm insulation': 0.21
    },
    airChange: {
      'Standard room': 0.5,
      'Draughty room': 1.0,
      'Very draughty room': 1.5
    }
  };

  var HEAT_LOSS_SUFFIXES = [
    'indoor_temp',
    'external_wall_length',
    'wall_type',
    'internal_wall_length',
    'internal_wall_type',
    'window_area',
    'window_type',
    'door_area',
    'door_type',
    'floor_type',
    'loft_type',
    'air_change'
  ];

  function numberValue(id, fallback) {
    var field = document.getElementById(id);
    var number = Number(field && field.value);
    return Number.isFinite(number) ? number : Number(fallback || 0);
  }

  function stringValue(id) {
    var field = document.getElementById(id);
    return field ? String(field.value || '') : '';
  }

  function setValue(id, value) {
    var field = document.getElementById(id);
    if (field && String(field.value) !== String(value)) {
      field.value = value;
    }
  }

  function optionsFromMap(map) {
    return Object.keys(map).map(function (label) {
      return { label: label, value: label };
    });
  }

  function fieldHtml(id, label, type, options, help) {
    var safeId = escapeHtml(id);
    var control = '';
    if (type === 'select') {
      var selectOptions = (options || []).slice();
      if (id !== 'hl_bridge_pct') {
        selectOptions.unshift({ label: '', value: '' });
      }
      control = '<select id="' + safeId + '" data-id="' + safeId + '">' +
        selectOptions.map(function (option) {
          var item = typeof option === 'string'
            ? { label: option, value: option }
            : option;
          return '<option value="' + escapeHtml(item.value) + '">' +
            escapeHtml(item.label) + '</option>';
        }).join('') +
        '</select>';
    } else {
      control = '<input id="' + safeId + '" data-id="' + safeId +
        '" type="number" step="any" inputmode="decimal">';
    }
    return '<div class="field"><label for="' + safeId + '">' +
      escapeHtml(label) + '</label>' + control +
      (help ? '<small>' + escapeHtml(help) + '</small>' : '') + '</div>';
  }

  function targetTemperature(roomName) {
    var name = String(roomName || '').toLowerCase();
    if (name.includes('bath') || name.includes('shower')) return 22;
    if (name.includes('lounge') || name.includes('living') ||
        name.includes('dining') || name.includes('d room')) return 21;
    if (name.includes('kitchen')) return 18;
    if (name.includes('bed')) return 18;
    if (name.includes('hall') || name.includes('landing') ||
        name.includes('wc') || name.includes('toilet')) return 18;
    return 18;
  }

  function previousTargetTemperature(roomName) {
    var name = String(roomName || '').toLowerCase();
    if (name.includes('bath') || name.includes('shower')) return 22;
    if (name.includes('lounge') || name.includes('living') ||
        name.includes('dining')) return 21;
    if (name.includes('kitchen')) return 20;
    if (name.includes('bed')) return 18;
    if (name.includes('hall') || name.includes('landing') ||
        name.includes('wc') || name.includes('toilet')) return 18;
    return 20;
  }

  function roomDropdownHtml(roomName) {
    var key = roomKeyFromName(roomName);
    var temperatures = [
      { label: '18°C, bedroom, kitchen or general room', value: '18' },
      { label: '20°C, manual selection', value: '20' },
      { label: '21°C, lounge or living room', value: '21' },
      { label: '22°C, bathroom or shower room', value: '22' }
    ];
    return '<details class="hl-room-dropdown" data-hl-room="' +
      escapeHtml(key) + '">' +
      '<summary><span>Heat loss details</span><span id="hl_' +
      escapeHtml(key) + '_summary">Uses room dimensions</span></summary>' +
      '<div class="hl-room-body">' +
      '<p class="hl-room-intro">Length and width come from this room. Ceiling height comes from the top of the Rads page. Construction choices apply standard values automatically.</p>' +
      '<div class="hl-fields-grid">' +
      fieldHtml('hl_' + key + '_indoor_temp', 'Room design temperature', 'select', temperatures) +
      fieldHtml('hl_' + key + '_external_wall_length', 'Exposed wall length (m)', 'number', null, 'Leave blank to estimate it from the outside wall count above.') +
      fieldHtml('hl_' + key + '_wall_type', 'External wall construction', 'select', optionsFromMap(VALUES.externalWall)) +
      fieldHtml('hl_' + key + '_internal_wall_length', 'Wall to unheated space (m)', 'number', null, 'Only include a garage, cupboard or other unheated space.') +
      fieldHtml('hl_' + key + '_internal_wall_type', 'Unheated internal wall', 'select', optionsFromMap(VALUES.internalWall)) +
      fieldHtml('hl_' + key + '_window_area', 'Window area (m²)', 'number') +
      fieldHtml('hl_' + key + '_window_type', 'Windows', 'select', optionsFromMap(VALUES.window)) +
      fieldHtml('hl_' + key + '_door_area', 'External door area (m²)', 'number') +
      fieldHtml('hl_' + key + '_door_type', 'External door', 'select', optionsFromMap(VALUES.door)) +
      fieldHtml('hl_' + key + '_floor_type', 'Floor', 'select', optionsFromMap(VALUES.floor)) +
      fieldHtml('hl_' + key + '_loft_type', 'Ceiling or loft', 'select', optionsFromMap(VALUES.loft)) +
      fieldHtml('hl_' + key + '_air_change', 'Draught level', 'select', optionsFromMap(VALUES.airChange)) +
      '</div>' +
      '<div class="hl-room-result" id="hl_' + escapeHtml(key) + '_result">' +
      '<div class="hl-result-main">Enter the room length and width</div>' +
      '</div></div></details>';
  }

  function propertySummaryHtml() {
    var bridgeOptions = [
      { label: 'Standard allowance, 10%', value: '10' },
      { label: 'Low allowance, 5%', value: '5' },
      { label: 'No allowance', value: '0' },
      { label: 'High allowance, 15%', value: '15' }
    ];
    return '<div class="card hl-summary-card" id="heatLossSummaryCard">' +
      '<h3>Heat loss summary</h3>' +
      '<p>Open Heat loss details inside each room. The calculated room load is copied into kW required automatically.</p>' +
      '<div class="hl-summary-grid">' +
      fieldHtml('hl_outdoor_temp', 'Outdoor design temperature (°C)', 'number', null, 'Automatically uses the nearest 99.6% reference value for the property postcode.') +
      fieldHtml('hl_bridge_pct', 'Thermal bridge allowance', 'select', bridgeOptions) +
      '</div>' +
      '<div class="hl-postcode-lookup">' +
      '<button type="button" id="hl_lookup_postcode">Use property postcode</button>' +
      '<div id="hl_postcode_lookup_status" role="status">Enter a property postcode above to set the outdoor design temperature.</div>' +
      '</div>' +
      '<input type="hidden" id="hl_design_postcode" data-id="hl_design_postcode">' +
      '<input type="hidden" id="hl_design_station" data-id="hl_design_station">' +
      '<input type="hidden" id="hl_design_manual" data-id="hl_design_manual">' +
      '<input type="hidden" id="hl_temperature_defaults_v62" data-id="hl_temperature_defaults_v62">' +
      '<div class="hl-property-result"><div class="hl-total-number" id="hl_property_total">0.00 kW</div>' +
      '<div id="hl_property_detail">Enter at least one room to begin.</div></div>' +
      '<p class="hl-help">This is a practical survey estimate. Confirm the property construction and local design temperature before selecting equipment.</p>' +
      '</div>';
  }

  function normalisePostcode(postcode) {
    return String(postcode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function postcodeOutcode(postcode) {
    var compact = normalisePostcode(postcode);
    return compact.length > 3 ? compact.slice(0, -3) : compact;
  }

  function setPostcodeLookupStatus(message, state) {
    var status = document.getElementById('hl_postcode_lookup_status');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state || '';
  }

  function degreesToRadians(value) {
    return value * Math.PI / 180;
  }

  function distanceBetweenCoordinates(latitude1, longitude1, latitude2, longitude2) {
    var earthRadiusKm = 6371;
    var latitudeDifference = degreesToRadians(latitude2 - latitude1);
    var longitudeDifference = degreesToRadians(longitude2 - longitude1);
    var a = Math.sin(latitudeDifference / 2) * Math.sin(latitudeDifference / 2) +
      Math.cos(degreesToRadians(latitude1)) * Math.cos(degreesToRadians(latitude2)) *
      Math.sin(longitudeDifference / 2) * Math.sin(longitudeDifference / 2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function nearestDesignStation(latitude, longitude) {
    return DESIGN_STATIONS.reduce(function (nearest, station) {
      var distance = distanceBetweenCoordinates(
        latitude,
        longitude,
        station.latitude,
        station.longitude
      );
      if (!nearest || distance < nearest.distance) {
        return { station: station, distance: distance };
      }
      return nearest;
    }, null);
  }

  async function fetchPostcodeResult(url) {
    var controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    var timeout = controller
      ? setTimeout(function () { controller.abort(); }, 7000)
      : null;
    try {
      var response = await fetch(url, controller ? { signal: controller.signal } : {});
      if (!response.ok) return null;
      var body = await response.json();
      return body && body.result ? body.result : null;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async function postcodeCoordinates(postcode) {
    var compact = normalisePostcode(postcode);
    var fullResult = await fetchPostcodeResult(
      'https://api.postcodes.io/postcodes/' + encodeURIComponent(compact)
    );
    if (fullResult && Number.isFinite(fullResult.latitude) &&
        Number.isFinite(fullResult.longitude)) {
      return {
        latitude: fullResult.latitude,
        longitude: fullResult.longitude,
        postcode: fullResult.postcode || postcode
      };
    }

    var outcode = postcodeOutcode(compact);
    if (!outcode) return null;
    var outcodeResult = await fetchPostcodeResult(
      'https://api.postcodes.io/outcodes/' + encodeURIComponent(outcode)
    );
    if (outcodeResult && Number.isFinite(outcodeResult.latitude) &&
        Number.isFinite(outcodeResult.longitude)) {
      return {
        latitude: outcodeResult.latitude,
        longitude: outcodeResult.longitude,
        postcode: outcode
      };
    }
    return null;
  }

  function specialPostcodeStation(postcode) {
    var compact = normalisePostcode(postcode);
    if (compact.startsWith('JE') || compact.startsWith('GY')) {
      return {
        station: {
          location: 'Channel Islands',
          station: 'Maison St Louis Observatory',
          temperature: 0.1
        },
        distance: 0
      };
    }
    if (compact.startsWith('IM')) {
      return {
        station: DESIGN_STATIONS[0],
        distance: 0
      };
    }
    return null;
  }

  function applyPostcodeDesignTemperature(postcode, match) {
    var station = match.station;
    postcodeLookupInProgress = true;
    setValue('hl_outdoor_temp', station.temperature.toFixed(1));
    setValue('hl_design_postcode', normalisePostcode(postcode));
    setValue('hl_design_station', station.location + ' (' + station.station + ')');
    setValue('hl_design_manual', 'no');
    postcodeLookupInProgress = false;
    setPostcodeLookupStatus(
      'Using ' + station.location + ' (' + station.station + '), ' +
      station.temperature.toFixed(1) + '°C. You can edit the temperature manually.',
      'success'
    );
    calculateHeatLoss();
    if (typeof update === 'function') update();
    persistCombinedData();
  }

  async function performPostcodeLookup() {
    if (postcodeLookupTimer) {
      clearTimeout(postcodeLookupTimer);
      postcodeLookupTimer = null;
    }
    var postcodeField = document.getElementById('site_postcode');
    var postcode = postcodeField ? postcodeField.value : '';
    var compact = normalisePostcode(postcode);
    if (compact.length < 2) {
      setPostcodeLookupStatus(
        'Enter a property postcode above to set the outdoor design temperature.',
        ''
      );
      return;
    }
    if (postcodeLookupActivePostcode === compact) return;

    postcodeLookupActivePostcode = compact;
    setPostcodeLookupStatus('Finding the local design temperature...', 'loading');
    try {
      var match = specialPostcodeStation(compact);
      if (!match) {
        var coordinates = await postcodeCoordinates(postcode);
        if (normalisePostcode(postcodeField && postcodeField.value) !== compact) return;
        if (!coordinates) {
          setPostcodeLookupStatus(
            'Postcode not recognised. Enter the outdoor design temperature manually.',
            'error'
          );
          return;
        }
        match = nearestDesignStation(coordinates.latitude, coordinates.longitude);
      }
      applyPostcodeDesignTemperature(postcode, match);
    } catch (error) {
      setPostcodeLookupStatus(
        'Postcode lookup is unavailable. Enter the outdoor design temperature manually.',
        'error'
      );
    } finally {
      if (postcodeLookupActivePostcode === compact) {
        postcodeLookupActivePostcode = '';
      }
    }
  }

  function schedulePostcodeLookup() {
    if (postcodeLookupTimer) clearTimeout(postcodeLookupTimer);
    postcodeLookupTimer = setTimeout(performPostcodeLookup, 650);
  }

  function markOutdoorTemperatureManual() {
    if (postcodeLookupInProgress) return;
    setValue('hl_design_manual', 'yes');
    var postcode = stringValue('site_postcode');
    setValue('hl_design_postcode', normalisePostcode(postcode));
    setPostcodeLookupStatus(
      'Manual outdoor design temperature selected for this postcode.',
      'manual'
    );
    persistCombinedData();
  }

  function refreshPostcodeLookupStatus() {
    var postcode = normalisePostcode(stringValue('site_postcode'));
    var matchedPostcode = stringValue('hl_design_postcode');
    var station = stringValue('hl_design_station');
    if (!postcode) {
      setPostcodeLookupStatus(
        'Enter a property postcode above to set the outdoor design temperature.',
        ''
      );
      return;
    }
    if (postcode === matchedPostcode && stringValue('hl_design_manual') === 'yes') {
      setPostcodeLookupStatus(
        'Manual outdoor design temperature selected for this postcode.',
        'manual'
      );
      return;
    }
    if (postcode === matchedPostcode && station) {
      setPostcodeLookupStatus(
        'Using ' + station + ', ' + numberValue('hl_outdoor_temp', 0).toFixed(1) +
        '°C. You can edit the temperature manually.',
        'success'
      );
      return;
    }
    performPostcodeLookup();
  }

  function wirePostcodeLookup() {
    var postcodeField = document.getElementById('site_postcode');
    if (postcodeField && postcodeField.dataset.hlPostcodeWired !== 'yes') {
      postcodeField.dataset.hlPostcodeWired = 'yes';
      postcodeField.addEventListener('input', schedulePostcodeLookup);
      postcodeField.addEventListener('change', performPostcodeLookup);
      postcodeField.addEventListener('blur', performPostcodeLookup);
    }

    var lookupButton = document.getElementById('hl_lookup_postcode');
    if (lookupButton && lookupButton.dataset.hlPostcodeWired !== 'yes') {
      lookupButton.dataset.hlPostcodeWired = 'yes';
      lookupButton.addEventListener('click', performPostcodeLookup);
    }

    var outdoorTemperature = document.getElementById('hl_outdoor_temp');
    if (outdoorTemperature && outdoorTemperature.dataset.hlManualWired !== 'yes') {
      outdoorTemperature.dataset.hlManualWired = 'yes';
      outdoorTemperature.addEventListener('input', markOutdoorTemperatureManual);
    }
    refreshPostcodeLookupStatus();
  }

  window.lookupOutdoorDesignTemperatureV61 = performPostcodeLookup;

  function storedSurveyData() {
    try {
      return JSON.parse(localStorage.getItem('surveyWebData') || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function storedCombinedData() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function persistCombinedData() {
    if (!persistenceReady) return;
    var data = {};
    var selectors = [
      '#radsForm [data-id^="hl_"]',
      '#radsForm [data-id="r_ceiling"]',
      '#radsForm [data-id^="rad_"][data-id$="_len"]',
      '#radsForm [data-id^="rad_"][data-id$="_wid"]',
      '#radsForm [data-id^="rad_"][data-id$="_outside"]'
    ].join(',');
    document.querySelectorAll(selectors).forEach(function (field) {
      data[field.dataset.id] = field.value;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function restoreValues(data) {
    Object.entries(data || {}).forEach(function (entry) {
      var field = document.querySelector('[data-id="' + CSS.escape(entry[0]) + '"]');
      if (field) field.value = entry[1];
    });
    migrateOldHeatLossValues(data || {});
  }

  function migrateOldHeatLossValues(data) {
    allRoomNames().forEach(function (roomName) {
      var key = roomKeyFromName(roomName);
      var oldWall = data['hl_' + key + '_wall_preset'];
      var oldWindow = data['hl_' + key + '_window_preset'];
      if (!stringValue('hl_' + key + '_wall_type') && oldWall) {
        if (VALUES.externalWall[oldWall] != null) {
          setValue('hl_' + key + '_wall_type', oldWall);
        }
      }
      if (!stringValue('hl_' + key + '_window_type') && oldWindow) {
        if (oldWindow === 'Single glazing') {
          setValue('hl_' + key + '_window_type', 'Single glazing');
        } else if (oldWindow.toLowerCase().includes('double')) {
          setValue('hl_' + key + '_window_type', 'Double glazing');
        }
      }
      if (data['hl_' + key + '_roof_exposed'] === 'Yes' &&
          !data['hl_' + key + '_loft_type']) {
        setValue('hl_' + key + '_loft_type', 'Plasterboard with 100mm insulation');
      }
      if (data['hl_' + key + '_floor_exposed'] === 'Yes' &&
          !data['hl_' + key + '_floor_type']) {
        setValue('hl_' + key + '_floor_type', 'Insulated ground floor');
      }
    });
  }

  function applyDefaults() {
    if (!stringValue('r_ceiling')) setValue('r_ceiling', 2.4);
    if (!stringValue('hl_outdoor_temp')) setValue('hl_outdoor_temp', -3);
    if (!stringValue('hl_bridge_pct')) setValue('hl_bridge_pct', 10);
    var migrateTemperatureDefaults = stringValue('hl_temperature_defaults_v62') !== 'yes';
    allRoomNames().forEach(function (roomName) {
      var key = roomKeyFromName(roomName);
      var newIndoorDefault = targetTemperature(roomName);
      var currentIndoorTemperature = stringValue('hl_' + key + '_indoor_temp');
      if (migrateTemperatureDefaults && currentIndoorTemperature === '20' &&
          previousTargetTemperature(roomName) === 20 &&
          newIndoorDefault !== 20) {
        setValue('hl_' + key + '_indoor_temp', newIndoorDefault);
      }
      var defaults = {
        indoor_temp: newIndoorDefault,
        wall_type: 'Cavity wall, insulated',
        internal_wall_type: 'None',
        window_type: 'Double glazing',
        door_type: 'No external door',
        floor_type: 'Heated room below',
        loft_type: 'Heated room above',
        air_change: 'Standard room'
      };
      Object.entries(defaults).forEach(function (entry) {
        var id = 'hl_' + key + '_' + entry[0];
        if (!stringValue(id)) setValue(id, entry[1]);
      });
    });
    setValue('hl_temperature_defaults_v62', 'yes');
  }

  function estimatedWallLength(length, width, wallCount) {
    var shorter = Math.min(length, width);
    var longer = Math.max(length, width);
    if (wallCount === 1) return shorter;
    if (wallCount === 2) return length + width;
    if (wallCount === 3) return length + width + longer;
    if (wallCount >= 4) return 2 * (length + width);
    return 0;
  }

  function mappedValue(group, selected) {
    var value = VALUES[group][selected];
    return Number.isFinite(value) ? value : 0;
  }

  function computeHeatLossValues(input) {
    var deltaT = Math.max(0, Number(input.deltaT) || 0);
    var internalDeltaT = Math.max(0, Number(input.internalDeltaT) || 0);
    var floorArea = Math.max(0, Number(input.floorArea) || 0);
    var volume = Math.max(0, Number(input.volume) || 0);
    var wallWatts = Math.max(0, Number(input.netWallArea) || 0) *
      Math.max(0, Number(input.wallU) || 0) * deltaT;
    var internalWallWatts = Math.max(0, Number(input.internalWallArea) || 0) *
      Math.max(0, Number(input.internalWallU) || 0) * internalDeltaT;
    var windowWatts = Math.max(0, Number(input.windowArea) || 0) *
      Math.max(0, Number(input.windowU) || 0) * deltaT;
    var doorWatts = Math.max(0, Number(input.doorArea) || 0) *
      Math.max(0, Number(input.doorU) || 0) * deltaT;
    var floorWatts = floorArea * Math.max(0, Number(input.floorU) || 0) * deltaT;
    var roofWatts = floorArea * Math.max(0, Number(input.roofU) || 0) * deltaT;
    var ventilationWatts = 0.33 * Math.max(0, Number(input.ach) || 0) *
      volume * deltaT;
    var externalFabric = wallWatts + windowWatts + doorWatts +
      floorWatts + roofWatts;
    var bridgeWatts = externalFabric *
      Math.max(0, Number(input.bridgePercent) || 0) / 100;
    var fabricWatts = externalFabric + internalWallWatts + bridgeWatts;
    return {
      wallWatts: wallWatts,
      internalWallWatts: internalWallWatts,
      windowWatts: windowWatts,
      doorWatts: doorWatts,
      floorWatts: floorWatts,
      roofWatts: roofWatts,
      ventilationWatts: ventilationWatts,
      bridgeWatts: bridgeWatts,
      fabricWatts: fabricWatts,
      totalWatts: fabricWatts + ventilationWatts
    };
  }
  window.computeHeatLossValuesV60 = computeHeatLossValues;

  function calculateRoom(roomName) {
    var key = roomKeyFromName(roomName);
    var length = numberValue('rad_' + key + '_len', 0);
    var width = numberValue('rad_' + key + '_wid', 0);
    var height = numberValue('r_ceiling', 2.4);
    var indoor = numberValue('hl_' + key + '_indoor_temp', targetTemperature(roomName));
    var outdoor = numberValue('hl_outdoor_temp', -3);
    var deltaT = Math.max(0, indoor - outdoor);
    var floorArea = length * width;
    var volume = floorArea * height;
    var outsideWallCount = Math.round(numberValue('rad_' + key + '_outside', 0));
    var enteredWallLength = numberValue('hl_' + key + '_external_wall_length', 0);
    var wallLength = enteredWallLength > 0
      ? enteredWallLength
      : estimatedWallLength(length, width, outsideWallCount);
    var assumedWall = enteredWallLength <= 0 && outsideWallCount > 0;
    var internalWallLength = Math.max(0, numberValue('hl_' + key + '_internal_wall_length', 0));
    var windowArea = Math.max(0, numberValue('hl_' + key + '_window_area', 0));
    var doorArea = Math.max(0, numberValue('hl_' + key + '_door_area', 0));
    var grossWallArea = Math.max(0, wallLength * height);
    var netWallArea = Math.max(0, grossWallArea - windowArea - doorArea);
    var internalWallArea = internalWallLength * height;
    var started = length > 0 || width > 0;
    var complete = length > 0 && width > 0 && height > 0;
    var wallType = stringValue('hl_' + key + '_wall_type');
    var internalWallType = stringValue('hl_' + key + '_internal_wall_type');
    var windowType = stringValue('hl_' + key + '_window_type');
    var doorType = stringValue('hl_' + key + '_door_type');
    var floorType = stringValue('hl_' + key + '_floor_type');
    var loftType = stringValue('hl_' + key + '_loft_type');
    var airChangeType = stringValue('hl_' + key + '_air_change');
    var wallU = mappedValue('externalWall', wallType);
    var internalWallU = mappedValue('internalWall', internalWallType);
    var windowU = mappedValue('window', windowType);
    var doorU = mappedValue('door', doorType);
    var floorU = mappedValue('floor', floorType);
    var roofU = mappedValue('loft', loftType);
    var ach = mappedValue('airChange', airChangeType);
    var heat = complete ? computeHeatLossValues({
      deltaT: deltaT,
      internalDeltaT: deltaT * 0.5,
      floorArea: floorArea,
      volume: volume,
      netWallArea: netWallArea,
      wallU: wallU,
      internalWallArea: internalWallArea,
      internalWallU: internalWallU,
      windowArea: windowArea,
      windowU: windowU,
      doorArea: doorArea,
      doorU: doorU,
      floorU: floorU,
      roofU: roofU,
      ach: ach,
      bridgePercent: numberValue('hl_bridge_pct', 10)
    }) : computeHeatLossValues({});
    var warnings = [];
    if (started && !complete) warnings.push('Room length, width and ceiling height are required');
    if (complete && windowArea + doorArea > grossWallArea && grossWallArea > 0) {
      warnings.push('Window and door areas exceed the exposed wall area');
    }
    if (complete && wallLength === 0 && internalWallLength === 0 &&
        floorU === 0 && roofU === 0) {
      warnings.push('No exposed wall, floor or loft has been recorded');
    }
    return {
      roomName: roomName,
      key: key,
      started: started,
      complete: complete,
      length: length,
      width: width,
      height: height,
      indoor: indoor,
      outdoor: outdoor,
      floorArea: floorArea,
      wallLength: wallLength,
      assumedWall: assumedWall,
      internalWallLength: internalWallLength,
      windowArea: windowArea,
      doorArea: doorArea,
      wallType: wallType,
      internalWallType: internalWallType,
      windowType: windowType,
      doorType: doorType,
      floorType: floorType,
      loftType: loftType,
      airChangeType: airChangeType,
      wallU: wallU,
      internalWallU: internalWallU,
      windowU: windowU,
      doorU: doorU,
      floorU: floorU,
      roofU: roofU,
      ach: ach,
      fabricWatts: heat.fabricWatts,
      ventilationWatts: heat.ventilationWatts,
      totalWatts: heat.totalWatts,
      wattsPerSquareMetre: floorArea > 0 ? heat.totalWatts / floorArea : 0,
      warnings: warnings
    };
  }

  function renderRoomResult(result) {
    var resultBox = document.getElementById('hl_' + result.key + '_result');
    var summary = document.getElementById('hl_' + result.key + '_summary');
    var radKw = document.getElementById('rad_' + result.key + '_kw');
    if (!result.started) {
      if (resultBox) {
        resultBox.innerHTML = '<div class="hl-result-main">Enter the room length and width</div>';
      }
      if (summary) summary.textContent = 'Uses room dimensions';
      return;
    }
    if (!result.complete) {
      if (resultBox) {
        resultBox.innerHTML = '<div class="hl-result-main">Incomplete room</div>' +
          '<div class="hl-warning">' + escapeHtml(result.warnings.join('. ')) + '</div>';
      }
      if (summary) summary.textContent = 'Incomplete';
      return;
    }
    var kw = result.totalWatts / 1000;
    if (radKw) {
      radKw.value = kw.toFixed(2);
      radKw.readOnly = true;
      radKw.title = 'Calculated from Heat loss details in this room.';
    }
    if (summary) summary.textContent = Math.round(result.totalWatts) + ' W';
    if (resultBox) {
      resultBox.innerHTML =
        '<div class="hl-result-main"><strong>' + Math.round(result.totalWatts) +
        ' W</strong> (' + kw.toFixed(2) + ' kW)' +
        (result.assumedWall ? '<span class="hl-assumption">wall length estimated</span>' : '') +
        '</div><div class="hl-result-breakdown">Fabric: ' +
        Math.round(result.fabricWatts) + ' W &nbsp; Ventilation: ' +
        Math.round(result.ventilationWatts) + ' W &nbsp; Load density: ' +
        result.wattsPerSquareMetre.toFixed(1) + ' W/m²</div>' +
        (result.warnings.length
          ? '<div class="hl-warning">' + escapeHtml(result.warnings.join('. ')) + '</div>'
          : '');
    }
  }

  function calculateHeatLoss() {
    var results = allRoomNames().map(calculateRoom);
    var included = results.filter(function (result) {
      return result.started && result.complete;
    });
    results.forEach(renderRoomResult);
    var totalWatts = included.reduce(function (sum, room) {
      return sum + room.totalWatts;
    }, 0);
    var totalArea = included.reduce(function (sum, room) {
      return sum + room.floorArea;
    }, 0);
    window.heatLossResultsV60 = {
      rooms: results,
      includedRooms: included,
      totalWatts: totalWatts,
      totalArea: totalArea,
      wattsPerSquareMetre: totalArea > 0 ? totalWatts / totalArea : 0
    };
    var total = document.getElementById('hl_property_total');
    var detail = document.getElementById('hl_property_detail');
    if (total) total.textContent = (totalWatts / 1000).toFixed(2) + ' kW';
    if (detail) {
      detail.textContent = included.length
        ? included.length + ' room' + (included.length === 1 ? '' : 's') +
          ' included, ' + Math.round(totalWatts) + ' W total, ' +
          window.heatLossResultsV60.wattsPerSquareMetre.toFixed(1) +
          ' W/m² across entered rooms.'
        : 'Enter at least one room to begin.';
    }
    var outputField = document.getElementById('r_output_temp');
    if (outputField && totalWatts > 0) {
      outputField.value = (totalWatts / 1000).toFixed(2);
      outputField.readOnly = true;
      outputField.title = 'Calculated from the completed rooms on the Rads page.';
    }
    return window.heatLossResultsV60;
  }

  function inputChanged(event) {
    if (!event.target || !event.target.dataset ||
        !event.target.dataset.id) return;
    calculateHeatLoss();
    if (typeof update === 'function') update();
  }

  function wireHeatLossFields() {
    document.querySelectorAll('#radsForm [data-id]').forEach(function (field) {
      var id = field.dataset.id || '';
      var isHeatLoss = id.startsWith('hl_');
      var isSharedRoomInput = id === 'r_ceiling' ||
        /^rad_.+_(len|wid|outside)$/.test(id);
      if (!isHeatLoss && !isSharedRoomInput) return;
      if (field.dataset.hlWired === 'yes') return;
      field.dataset.hlWired = 'yes';
      if (isHeatLoss) {
        field.addEventListener('input', inputChanged);
        field.addEventListener('change', inputChanged);
      }
      field.addEventListener('input', persistCombinedData);
      field.addEventListener('change', persistCombinedData);
    });
  }

  function installSummaryCard() {
    var radsForm = document.getElementById('radsForm');
    if (!radsForm || document.getElementById('heatLossSummaryCard')) return;
    var firstCard = radsForm.querySelector('.card');
    if (firstCard) {
      firstCard.insertAdjacentHTML('afterend', propertySummaryHtml());
    } else {
      radsForm.insertAdjacentHTML('afterbegin', propertySummaryHtml());
    }
  }

  function uValueAssumption(label, value, included) {
    if (!included) return 'Not included';
    return escapeHtml(label || 'Unknown') + '<br><b>' +
      Number(value || 0).toFixed(2) + ' W/m²K</b>';
  }

  function renderHeatLossAssumptionsSheet(calculation) {
    var rows = calculation.includedRooms || [];
    var station = stringValue('hl_design_station') || 'Manual value';
    return '<div class="sheet-wrap" id="heatLossAssumptionsSheetV61">' +
      '<div class="sheet-title"><h2>Heat Loss</h2><small>U-values and ventilation assumptions used</small></div>' +
      '<table class="sheet heatloss-sheet heatloss-assumptions-sheet">' +
      '<tr><td class="label">Address</td><td colspan="3" class="input">' +
      cell('site_address') + '</td><td class="label">Reference station</td><td colspan="3" class="input">' +
      escapeHtml(station) + '</td></tr>' +
      '<tr><td class="label">Outdoor design</td><td class="input">' +
      escapeHtml(stringValue('hl_outdoor_temp')) + ' °C</td>' +
      '<td class="label">Thermal bridges</td><td class="input">' +
      escapeHtml(stringValue('hl_bridge_pct')) + '%</td>' +
      '<td colspan="4" class="small">U-values are shown in W/m²K. Lower values indicate better insulation.</td></tr>' +
      '<tr><th>Room</th><th>External wall</th><th>Unheated internal wall</th><th>Windows</th><th>External door</th><th>Floor</th><th>Ceiling / loft</th><th>Ventilation</th></tr>' +
      (rows.length ? rows.map(function (room) {
        return '<tr><td><b>' + escapeHtml(room.roomName) + '</b></td>' +
          '<td>' + uValueAssumption(room.wallType, room.wallU, room.wallLength > 0) + '</td>' +
          '<td>' + uValueAssumption(room.internalWallType, room.internalWallU, room.internalWallLength > 0 && room.internalWallU > 0) + '</td>' +
          '<td>' + uValueAssumption(room.windowType, room.windowU, room.windowArea > 0 && room.windowU > 0) + '</td>' +
          '<td>' + uValueAssumption(room.doorType, room.doorU, room.doorArea > 0 && room.doorU > 0) + '</td>' +
          '<td>' + uValueAssumption(room.floorType, room.floorU, room.floorU > 0) + '</td>' +
          '<td>' + uValueAssumption(room.loftType, room.roofU, room.roofU > 0) + '</td>' +
          '<td>' + escapeHtml(room.airChangeType || 'Unknown') + '<br><b>' +
          room.ach.toFixed(2) + ' ACH</b></td></tr>';
      }).join('') : '<tr><td colspan="8" class="center">No completed rooms entered</td></tr>') +
      '<tr><td colspan="8" class="small">Different heat-loss calculators can produce different results because they may use age-based fabric values, different ground-floor methods, different air-change rates, different thermal-bridge allowances, or a different outdoor design temperature. Check that these assumptions match before comparing totals.</td></tr>' +
      '</table></div>';
  }

  function renderHeatLossSheet() {
    var calculation = window.heatLossResultsV60 || calculateHeatLoss();
    var rows = calculation.rooms.filter(function (room) {
      return room.started;
    });
    var resultsSheet = '<div class="sheet-wrap" id="heatLossSheetV60">' +
      '<div class="sheet-title"><h2>Heat Loss</h2><small>Combined radiator and room heat-loss survey</small></div>' +
      '<table class="sheet heatloss-sheet">' +
      '<tr><td class="label">Address</td><td colspan="5" class="input">' +
      cell('site_address') + '</td><td class="label">Outdoor design</td><td class="input">' +
      escapeHtml(stringValue('hl_outdoor_temp')) + ' °C</td></tr>' +
      '<tr><th>Room</th><th>Dimensions</th><th>Room temp</th><th>Exposed wall</th><th>Fabric</th><th>Ventilation</th><th>W/m²</th><th>Total</th></tr>' +
      (rows.length ? rows.map(function (room) {
        return '<tr><td>' + escapeHtml(room.roomName) + '</td><td>' +
          (room.complete
            ? room.length.toFixed(2) + ' x ' + room.width.toFixed(2) + ' x ' +
              room.height.toFixed(2) + ' m'
            : 'Incomplete') +
          '</td><td>' + room.indoor.toFixed(1) + ' °C</td><td>' +
          room.wallLength.toFixed(2) + ' m' +
          (room.assumedWall ? ' (estimated)' : '') +
          '</td><td>' + Math.round(room.fabricWatts) + ' W</td><td>' +
          Math.round(room.ventilationWatts) + ' W</td><td>' +
          room.wattsPerSquareMetre.toFixed(1) + '</td><td class="input"><b>' +
          Math.round(room.totalWatts) + ' W</b></td></tr>';
      }).join('') : '<tr><td colspan="8" class="center">No rooms entered</td></tr>') +
      '<tr><td colspan="6" class="label right">Property design heat loss</td>' +
      '<td class="input">' + calculation.wattsPerSquareMetre.toFixed(1) +
      ' W/m²</td><td class="input"><b>' +
      (calculation.totalWatts / 1000).toFixed(2) + ' kW</b></td></tr>' +
      '<tr><td colspan="8" class="small">Calculation uses automatic standard construction values, fabric area and temperature difference, plus room volume and air changes. Confirm the survey assumptions before selecting equipment. This is not a certified MCS or BS EN 12831 design report.</td></tr>' +
      '</table></div>';
    return resultsSheet + renderHeatLossAssumptionsSheet(calculation);
  }

  var previousRoomFormHtml = roomFormHtml;
  roomFormHtml = function (roomName, index) {
    var original = previousRoomFormHtml(roomName, index);
    return original.replace(/<\/details>\s*$/, roomDropdownHtml(roomName) + '</details>');
  };

  var previousRebuildRadsForm = rebuildRadsForm;
  rebuildRadsForm = function (savedOverride) {
    var saved = savedOverride && typeof savedOverride === 'object'
      ? savedOverride
      : (typeof getData === 'function' ? getData() : storedSurveyData());
    var result = previousRebuildRadsForm.apply(this, arguments);
    installSummaryCard();
    restoreValues(saved);
    applyDefaults();
    wireHeatLossFields();
    wirePostcodeLookup();
    calculateHeatLoss();
    return result;
  };

  var previousSetData = window.setData || setData;
  setData = window.setData = function (data) {
    rebuildRadsForm(data || {});
    var result = previousSetData.apply(this, arguments);
    restoreValues(data || {});
    applyDefaults();
    calculateHeatLoss();
    persistCombinedData();
    return result;
  };

  var previousCalculateRecommendedOutput = calculateRecommendedOutput;
  calculateRecommendedOutput = function () {
    var calculation = window.heatLossResultsV60 || calculateHeatLoss();
    if (calculation.totalWatts > 0) {
      return Number((calculation.totalWatts / 1000).toFixed(2));
    }
    return previousCalculateRecommendedOutput.apply(this, arguments);
  };

  var previousCalcTotalKw = calcTotalKw;
  calcTotalKw = function () {
    var calculation = window.heatLossResultsV60 || calculateHeatLoss();
    if (calculation.totalWatts > 0) {
      return (calculation.totalWatts / 1000).toFixed(2);
    }
    return previousCalcTotalKw.apply(this, arguments);
  };

  var previousRenderProfile = renderProfile;
  renderProfile = function () {
    return previousRenderProfile.apply(this, arguments) + renderHeatLossSheet();
  };

  var previousBuildPrintHtml = buildPrintHtml;
  buildPrintHtml = function (title, sheetTitles, orientation) {
    var sheets = Array.from(sheetTitles || []);
    if (sheets.includes('Front') && sheets.includes('Rads') &&
        !sheets.includes('Heat Loss')) {
      sheets.push('Heat Loss');
    }
    return previousBuildPrintHtml.call(this, title, sheets, orientation);
  };

  var previousUpdate = update;
  update = function () {
    calculateHeatLoss();
    var result = previousUpdate.apply(this, arguments);
    persistCombinedData();
    return result;
  };

  if (typeof window.duplicateRoomV50 === 'function') {
    var previousDuplicateRoom = window.duplicateRoomV50;
    window.duplicateRoomV50 = function (sourceKey) {
      var beforeKeys = allRoomNames().map(roomKeyFromName);
      var sourceData = typeof getData === 'function' ? getData() : {};
      previousDuplicateRoom(sourceKey);
      var duplicateRoom = allRoomNames().find(function (roomName) {
        return !beforeKeys.includes(roomKeyFromName(roomName));
      });
      if (duplicateRoom) {
        var duplicateKey = roomKeyFromName(duplicateRoom);
        HEAT_LOSS_SUFFIXES.forEach(function (suffix) {
          var sourceId = 'hl_' + sourceKey + '_' + suffix;
          var targetId = 'hl_' + duplicateKey + '_' + suffix;
          if (sourceData[sourceId] != null) setValue(targetId, sourceData[sourceId]);
        });
        update();
      }
    };
  }

  var initialData = Object.assign({},
    typeof getData === 'function' ? getData() : {}, storedSurveyData(),
    storedCombinedData());
  rebuildRadsForm(initialData);
  persistenceReady = true;
  var pdfButtons = document.querySelectorAll('#pdfPanel button');
  pdfButtons.forEach(function (button) {
    if (button.textContent.includes('Front + Rads PDF')) {
      button.textContent = 'Save Front + Rads + Heat Loss PDF';
    }
  });
  update();
})();
