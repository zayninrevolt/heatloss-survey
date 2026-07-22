/* Combined radiator survey and room heat-loss calculator. */
(function () {
  var STORAGE_KEY = 'heatLossDataV60';
  var persistenceReady = false;
  var postcodeLookupTimer = null;
  var postcodeLookupInProgress = false;
  var postcodeLookupActivePostcode = '';
  var DESIGN_STATIONS = [
    { location: 'Belfast', station: 'Aldergrove', latitude: 54.6575, longitude: -6.2158, temperature: -3.2, altitude: 63 },
    { location: 'Birmingham', station: 'Coleshill', latitude: 52.4800, longitude: -1.6890, temperature: -5.1, altitude: 96 },
    { location: 'Cardiff', station: 'St Athan', latitude: 51.4050, longitude: -3.4400, temperature: -3.1, altitude: 49 },
    { location: 'Edinburgh', station: 'Gogarbank', latitude: 55.9290, longitude: -3.3430, temperature: -5.4, altitude: 57 },
    { location: 'Glasgow', station: 'Bishopton', latitude: 55.9070, longitude: -4.5330, temperature: -5.6, altitude: 59 },
    { location: 'Leeds', station: 'Church Fenton', latitude: 53.8340, longitude: -1.1950, temperature: -3.3, altitude: 8 },
    { location: 'London', station: 'Heathrow', latitude: 51.4790, longitude: -0.4490, temperature: -3.0, altitude: 25 },
    { location: 'Manchester', station: 'Woodford', latitude: 53.3380, longitude: -2.1490, temperature: -4.5, altitude: 88 },
    { location: 'Newcastle', station: 'Albemarle', latitude: 55.0190, longitude: -1.8800, temperature: -3.7, altitude: 142 },
    { location: 'Norwich', station: 'Marham', latitude: 52.6510, longitude: 0.5690, temperature: -4.6, altitude: 21 },
    { location: 'Nottingham', station: 'Watnall', latitude: 53.0050, longitude: -1.2500, temperature: -3.9, altitude: 117 },
    { location: 'Plymouth', station: 'Mountbatten', latitude: 50.3540, longitude: -4.1210, temperature: -1.5, altitude: 50 },
    { location: 'Southampton', station: 'Hurn', latitude: 50.7790, longitude: -1.8350, temperature: -4.8, altitude: 10 },
    { location: 'Swindon', station: 'Brize Norton', latitude: 51.7580, longitude: -1.5760, temperature: -4.6, altitude: 82 }
  ];
  var STELRAD_ELITE_WATTS_PER_METRE_600 = { K1: 1000, K2: 1778, K3: 2514 };
  var STELRAD_STANDARD_WIDTHS = [
    400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600,
    1800, 2000, 2200, 2400, 2600, 2800, 3000
  ];
  var STELRAD_300_WIDTHS = [500, 1000, 1500, 2000, 2500, 3000];
  var STELRAD_ELITE_MODELS = [
    { type: 'K1', height: 300, wattsPerMetre: 517, widths: STELRAD_300_WIDTHS },
    { type: 'K1', height: 450, wattsPerMetre: 768, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K1', height: 600, wattsPerMetre: 1000, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K1', height: 700, wattsPerMetre: 1142, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K2', height: 300, wattsPerMetre: 1012, widths: STELRAD_300_WIDTHS },
    { type: 'K2', height: 450, wattsPerMetre: 1409, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K2', height: 600, wattsPerMetre: 1778, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K2', height: 700, wattsPerMetre: 2011, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K3', height: 300, wattsPerMetre: 1418, widths: [1000, 2000] },
    { type: 'K3', height: 500, wattsPerMetre: 2169, widths: [600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2400] },
    { type: 'K3', height: 600, wattsPerMetre: 2514, widths: [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2400] },
    { type: 'K3', height: 700, wattsPerMetre: 2841, widths: [500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000] }
  ];
  var STELRAD_CORRECTION_FACTORS = {
    20: 0.302, 21: 0.322, 22: 0.342, 23: 0.363, 24: 0.383,
    25: 0.404, 26: 0.426, 27: 0.447, 28: 0.469, 29: 0.491,
    30: 0.513, 31: 0.535, 32: 0.558, 33: 0.581, 34: 0.604,
    35: 0.627, 36: 0.651, 37: 0.675, 38: 0.699, 39: 0.723,
    40: 0.747, 41: 0.7714, 42: 0.796, 43: 0.821, 44: 0.846,
    45: 0.871, 46: 0.897, 47: 0.922, 48: 0.948, 49: 0.974,
    50: 1, 51: 1.026, 52: 1.052, 53: 1.079, 54: 1.105,
    55: 1.132, 56: 1.159, 57: 1.186, 58: 1.213, 59: 1.241,
    60: 1.268, 61: 1.296, 62: 1.324, 63: 1.352, 64: 1.38,
    65: 1.408
  };
  var VALUES = {
    externalWall: {
      'Solid brick, uninsulated': 2.1,
      'Cavity wall, uninsulated': 1.6,
      'Cavity wall, insulated': 0.55,
      'Modern insulated wall': 0.28
    },
    internalWall: {
      'No internal wall included': 0,
      'Heated room, single brick': 2.05,
      'Heated room, stud and plasterboard': 1.76,
      'Unheated space, single brick': 2.05,
      'Unheated space, stud and plasterboard': 1.76
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
      'Uninsulated solid ground floor': 0.7,
      'Insulated solid ground floor': 0.25,
      'Uninsulated exposed floor': 0.7,
      'Insulated exposed floor': 0.25
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
    'internal_adjacent_room',
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
        '" type="number" step="any" inputmode="decimal"' +
        (id === 'hl_outdoor_temp' ? '' : ' min="0"') + '>';
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
    var adjacentRooms = [{ label: 'Same design temperature', value: '' }].concat(
      allRoomNames().filter(function (candidate) {
        return roomKeyFromName(candidate) !== key;
      }).map(function (candidate) {
        return { label: candidate, value: roomKeyFromName(candidate) };
      })
    );
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
      fieldHtml('hl_' + key + '_internal_wall_length', 'Internal wall length (m)', 'number', null, 'For a heated adjoining room, select that room below so its design temperature is used.') +
      fieldHtml('hl_' + key + '_internal_wall_type', 'Internal wall construction', 'select', optionsFromMap(VALUES.internalWall)) +
      fieldHtml('hl_' + key + '_internal_adjacent_room', 'Heated room on other side', 'select', adjacentRooms, 'Only used when a heated internal wall is selected.') +
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
    var radiatorTemperatures = [
      { label: '75°C, nominal ΔT50', value: '75' },
      { label: '65°C, nominal ΔT40', value: '65' },
      { label: '55°C, nominal ΔT30', value: '55' }
    ];
    return '<div class="card hl-summary-card" id="heatLossSummaryCard">' +
      '<h3>Heat loss summary</h3>' +
      '<p>Open Heat loss details inside each room. The room load is calculated automatically, then suitable Stelrad Elite sizes can be selected in the radiator schedule.</p>' +
      '<div class="hl-summary-grid">' +
      fieldHtml('hl_outdoor_temp', 'Outdoor design temperature (°C)', 'number', null, 'Automatically uses the nearest 99.6% reference value for the property postcode.') +
      fieldHtml('hl_bridge_pct', 'Thermal bridge allowance', 'select', bridgeOptions) +
      fieldHtml('hl_property_altitude', 'Property altitude (m)', 'number', null, 'Optional. If higher than the reference station, the outdoor temperature is reduced by 0.6°C per complete 100m.') +
      fieldHtml('hl_ground_temp', 'Ground temperature (°C)', 'number', null, 'Used for solid ground floors instead of the outdoor design temperature.') +
      fieldHtml('hl_radiator_temperature', 'Radiator design temperature', 'select', radiatorTemperatures, 'Limited to the three system temperatures used: 75°C, 65°C or 55°C.') +
      '</div>' +
      '<details class="hl-property-defaults"><summary>Property construction defaults</summary>' +
      '<p class="hl-help">Applies external wall, internal wall, window and draught defaults only. Floor and loft must be selected inside each room.</p>' +
      '<div class="hl-summary-grid">' +
      fieldHtml('hl_default_wall', 'External wall', 'select', optionsFromMap(VALUES.externalWall)) +
      fieldHtml('hl_default_internal_wall', 'Internal wall construction', 'select', optionsFromMap(VALUES.internalWall)) +
      fieldHtml('hl_default_window', 'Windows', 'select', optionsFromMap(VALUES.window)) +
      fieldHtml('hl_default_air_change', 'Draught level', 'select', optionsFromMap(VALUES.airChange)) +
      '</div><button type="button" id="hl_apply_defaults">Apply to all rooms</button></details>' +
      '<div class="hl-postcode-lookup">' +
      '<button type="button" id="hl_lookup_postcode">Use property postcode</button>' +
      '<div id="hl_postcode_lookup_status" role="status">Enter a property postcode above to set the outdoor design temperature.</div>' +
      '</div>' +
      '<input type="hidden" id="hl_design_postcode" data-id="hl_design_postcode">' +
      '<input type="hidden" id="hl_design_station" data-id="hl_design_station">' +
      '<input type="hidden" id="hl_design_base_temp" data-id="hl_design_base_temp">' +
      '<input type="hidden" id="hl_design_station_altitude" data-id="hl_design_station_altitude">' +
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
          temperature: 0.1,
          altitude: 0
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
    var propertyAltitudeText = stringValue('hl_property_altitude');
    var propertyAltitude = propertyAltitudeText === '' ? null : Number(propertyAltitudeText);
    var stationAltitude = Number(station.altitude) || 0;
    var altitudeSteps = propertyAltitude == null || !Number.isFinite(propertyAltitude)
      ? 0
      : Math.max(0, Math.floor((propertyAltitude - stationAltitude) / 100));
    var correctedTemperature = station.temperature - altitudeSteps * 0.6;
    postcodeLookupInProgress = true;
    setValue('hl_outdoor_temp', correctedTemperature.toFixed(1));
    setValue('hl_design_postcode', normalisePostcode(postcode));
    setValue('hl_design_station', station.location + ' (' + station.station + ')');
    setValue('hl_design_base_temp', station.temperature.toFixed(1));
    setValue('hl_design_station_altitude', stationAltitude);
    setValue('hl_design_manual', 'no');
    postcodeLookupInProgress = false;
    setPostcodeLookupStatus(
      'Using ' + station.location + ' (' + station.station + '), ' +
      correctedTemperature.toFixed(1) + '°C' +
      (altitudeSteps ? ' after a ' + (altitudeSteps * 0.6).toFixed(1) +
        '°C altitude correction.' : '. You can edit the temperature manually.'),
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

  function recalculateAltitudeCorrection() {
    if (stringValue('hl_design_manual') === 'yes') return;
    var baseTemperature = Number(stringValue('hl_design_base_temp'));
    var stationAltitude = Number(stringValue('hl_design_station_altitude')) || 0;
    var propertyAltitudeText = stringValue('hl_property_altitude');
    if (!Number.isFinite(baseTemperature) || propertyAltitudeText === '') return;
    var propertyAltitude = Number(propertyAltitudeText);
    if (!Number.isFinite(propertyAltitude)) return;
    var steps = Math.max(0, Math.floor((propertyAltitude - stationAltitude) / 100));
    postcodeLookupInProgress = true;
    setValue('hl_outdoor_temp', (baseTemperature - steps * 0.6).toFixed(1));
    postcodeLookupInProgress = false;
    setPostcodeLookupStatus(
      'Using ' + stringValue('hl_design_station') + ', ' +
      numberValue('hl_outdoor_temp', 0).toFixed(1) + '°C' +
      (steps ? ' after a ' + (steps * 0.6).toFixed(1) + '°C altitude correction.' : '.'),
      'success'
    );
    calculateHeatLoss();
    persistCombinedData();
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
    var altitude = document.getElementById('hl_property_altitude');
    if (altitude && altitude.dataset.hlAltitudeWired !== 'yes') {
      altitude.dataset.hlAltitudeWired = 'yes';
      altitude.addEventListener('input', recalculateAltitudeCorrection);
      altitude.addEventListener('change', recalculateAltitudeCorrection);
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
    if (!stringValue('hl_radiator_temperature')) {
      var oldTemperature = Number(data.hl_flow_temp || data.front_boiler_temp);
      if (Number.isFinite(oldTemperature) && oldTemperature > 0) {
        setValue('hl_radiator_temperature', oldTemperature <= 60 ? 55 :
          (oldTemperature <= 70 ? 65 : 75));
      }
    }
    allRoomNames().forEach(function (roomName) {
      var key = roomKeyFromName(roomName);
      var oldWall = data['hl_' + key + '_wall_preset'];
      var oldWindow = data['hl_' + key + '_window_preset'];
      var oldInternalWall = data['hl_' + key + '_internal_wall_type'];
      var internalWallMigration = {
        'None': 'No internal wall included',
        'Single brick wall': 'Unheated space, single brick',
        'Stud and plasterboard': 'Unheated space, stud and plasterboard'
      };
      if (internalWallMigration[oldInternalWall]) {
        setValue('hl_' + key + '_internal_wall_type', internalWallMigration[oldInternalWall]);
      }
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
        setValue('hl_' + key + '_floor_type', 'Insulated solid ground floor');
      }
      if (data['hl_' + key + '_floor_type'] === 'Uninsulated ground or exposed floor') {
        setValue('hl_' + key + '_floor_type', 'Uninsulated solid ground floor');
      }
      if (data['hl_' + key + '_floor_type'] === 'Insulated ground floor') {
        setValue('hl_' + key + '_floor_type', 'Insulated solid ground floor');
      }
    });
  }

  function applyDefaults() {
    if (!stringValue('r_ceiling')) setValue('r_ceiling', 2.4);
    if (!stringValue('hl_outdoor_temp')) setValue('hl_outdoor_temp', -3);
    if (!stringValue('hl_bridge_pct')) setValue('hl_bridge_pct', 10);
    if (!stringValue('hl_ground_temp')) setValue('hl_ground_temp', 10);
    if (!['75', '65', '55'].includes(stringValue('hl_radiator_temperature'))) {
      setValue('hl_radiator_temperature', 75);
    }
    setValue('front_boiler_temp', stringValue('hl_radiator_temperature'));
    var propertyDefaults = {
      hl_default_wall: 'Cavity wall, insulated',
      hl_default_internal_wall: 'No internal wall included',
      hl_default_window: 'Double glazing',
      hl_default_air_change: 'Standard room'
    };
    Object.entries(propertyDefaults).forEach(function (entry) {
      if (!stringValue(entry[0])) setValue(entry[0], entry[1]);
    });
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
        internal_wall_type: 'No internal wall included',
        window_type: 'Double glazing',
        door_type: 'No external door',
        air_change: 'Standard room'
      };
      Object.entries(defaults).forEach(function (entry) {
        var id = 'hl_' + key + '_' + entry[0];
        if (!stringValue(id)) setValue(id, entry[1]);
      });
    });
    setValue('hl_temperature_defaults_v62', 'yes');
  }

  function applyPropertyConstructionDefaults() {
    var defaults = {
      wall_type: stringValue('hl_default_wall'),
      internal_wall_type: stringValue('hl_default_internal_wall'),
      window_type: stringValue('hl_default_window'),
      air_change: stringValue('hl_default_air_change')
    };
    allRoomNames().forEach(function (roomName) {
      var key = roomKeyFromName(roomName);
      Object.entries(defaults).forEach(function (entry) {
        if (entry[1]) setValue('hl_' + key + '_' + entry[0], entry[1]);
      });
    });
    calculateHeatLoss();
    if (typeof update === 'function') update();
    persistCombinedData();
  }

  function wirePropertyDefaults() {
    var button = document.getElementById('hl_apply_defaults');
    if (button && button.dataset.hlDefaultsWired !== 'yes') {
      button.dataset.hlDefaultsWired = 'yes';
      button.addEventListener('click', applyPropertyConstructionDefaults);
    }
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

  function internalWallTemperatureFactor(selected) {
    return String(selected || '').indexOf('Unheated space') === 0 ? 0.5 : 0;
  }

  function isHeatedInternalWall(selected) {
    return String(selected || '').indexOf('Heated room') === 0;
  }

  function floorTemperatureDifference(floorType, indoor, outdoor, ground) {
    if (String(floorType || '').includes('solid ground')) {
      return Math.max(0, indoor - ground);
    }
    if (String(floorType || '').includes('exposed floor')) {
      return Math.max(0, indoor - outdoor);
    }
    return 0;
  }

  function stelradCorrectionFactor(deltaT) {
    var value = Math.max(20, Math.min(65, Number(deltaT) || 0));
    var lower = Math.floor(value);
    var upper = Math.ceil(value);
    if (lower === upper) return STELRAD_CORRECTION_FACTORS[lower];
    var lowerFactor = STELRAD_CORRECTION_FACTORS[lower];
    var upperFactor = STELRAD_CORRECTION_FACTORS[upper];
    return lowerFactor + (upperFactor - lowerFactor) * (value - lower);
  }

  function stelradModel(type, height) {
    return STELRAD_ELITE_MODELS.find(function (model) {
      return model.type === type && model.height === Number(height || 600);
    });
  }

  function stelradOutput(type, width, correctionFactor, height) {
    var model = stelradModel(type, height || 600);
    return model
      ? model.wattsPerMetre * (width / 1000) * correctionFactor
      : 0;
  }

  function suitableStelradOptions(requiredWatts, correctionFactor) {
    var options = [];
    var maximumWatts = requiredWatts * 1.5;
    if (requiredWatts <= 0) return options;
    STELRAD_ELITE_MODELS.forEach(function (model) {
      model.widths.forEach(function (width) {
        var watts = model.wattsPerMetre * (width / 1000) * correctionFactor;
        if (watts < requiredWatts || watts > maximumWatts + 0.01) return;
        options.push({
          type: model.type,
          height: model.height,
          width: width,
          watts: watts,
          ratedWatts: model.wattsPerMetre * (width / 1000),
          oversizePercent: requiredWatts > 0
            ? Math.max(0, (watts - requiredWatts) / requiredWatts * 100)
            : 0,
          size: model.height + '(h) x ' + width + '(w) ' + model.type
        });
      });
    });
    return options.sort(function (a, b) {
      return a.height - b.height || a.width - b.width || a.type.localeCompare(b.type);
    });
  }

  function recommendStelradElite(requiredWatts, indoor, currentSelection) {
    var flow = Number(stringValue('hl_radiator_temperature')) || 75;
    var returnTemperature = flow - 10;
    var meanWater = (flow + returnTemperature) / 2;
    var deltaT = meanWater - indoor;
    var correctionFactor = stelradCorrectionFactor(deltaT);
    var validTemperature = flow > returnTemperature && deltaT >= 20 && deltaT <= 65;
    var options = validTemperature
      ? suitableStelradOptions(requiredWatts, correctionFactor)
      : [];
    var selected = options.find(function (option) {
      return option.size === currentSelection;
    }) || options.find(function (option) {
      return option.height === 600 && option.type === 'K2';
    }) || options.reduce(function (closest, option) {
      return !closest || option.watts < closest.watts ? option : closest;
    }, null);
    return {
      flow: flow,
      returnTemperature: returnTemperature,
      meanWater: meanWater,
      nominalDeltaT: flow - 25,
      deltaT: deltaT,
      correctionFactor: correctionFactor,
      options: options,
      selected: selected,
      temperatureWarning: !validTemperature
    };
  }

  function recommendedSystemOutputKw(radiatorOutputWatts) {
    var combinedOutputKw = Math.max(0, Number(radiatorOutputWatts) || 0) / 1000;
    return Number(Math.max(12, combinedOutputKw).toFixed(2));
  }
  window.stelradEliteSizingV63 = {
    wattsPerMetre: STELRAD_ELITE_WATTS_PER_METRE_600,
    models: STELRAD_ELITE_MODELS,
    correctionFactor: stelradCorrectionFactor,
    output: stelradOutput,
    suitableOptions: suitableStelradOptions,
    recommendedSystemOutputKw: recommendedSystemOutputKw
  };

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
    var floorDeltaT = input.floorDeltaT == null
      ? deltaT
      : Math.max(0, Number(input.floorDeltaT) || 0);
    var floorWatts = floorArea * Math.max(0, Number(input.floorU) || 0) * floorDeltaT;
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
    var dimensionsComplete = length > 0 && width > 0 && height > 0;
    var wallType = stringValue('hl_' + key + '_wall_type');
    var internalWallType = stringValue('hl_' + key + '_internal_wall_type');
    var windowType = stringValue('hl_' + key + '_window_type');
    var doorType = stringValue('hl_' + key + '_door_type');
    var floorType = stringValue('hl_' + key + '_floor_type');
    var loftType = stringValue('hl_' + key + '_loft_type');
    var airChangeType = stringValue('hl_' + key + '_air_change');
    var wallU = mappedValue('externalWall', wallType);
    var internalWallU = mappedValue('internalWall', internalWallType);
    var internalWallFactor = internalWallTemperatureFactor(internalWallType);
    var windowU = mappedValue('window', windowType);
    var doorU = mappedValue('door', doorType);
    var floorU = mappedValue('floor', floorType);
    var roofU = mappedValue('loft', loftType);
    var ach = mappedValue('airChange', airChangeType);
    var missing = [];
    if (wallLength > 0 && !wallType) missing.push('external wall construction');
    if (internalWallLength > 0 && (!internalWallType || internalWallU === 0)) {
      missing.push('internal wall construction');
    }
    if (windowArea > 0 && (!windowType || windowU === 0)) missing.push('window construction');
    if (doorArea > 0 && (!doorType || doorU === 0)) missing.push('external door construction');
    if (!floorType) missing.push('floor construction');
    if (!loftType) missing.push('ceiling or loft construction');
    if (!airChangeType) missing.push('draught level');
    var complete = dimensionsComplete && missing.length === 0;
    var adjacentKey = stringValue('hl_' + key + '_internal_adjacent_room');
    var adjacentName = allRoomNames().find(function (candidate) {
      return roomKeyFromName(candidate) === adjacentKey;
    }) || '';
    var adjacentIndoor = adjacentName
      ? numberValue('hl_' + adjacentKey + '_indoor_temp', targetTemperature(adjacentName))
      : indoor;
    var internalDeltaT = isHeatedInternalWall(internalWallType)
      ? Math.max(0, indoor - adjacentIndoor)
      : deltaT * internalWallFactor;
    var floorDeltaT = floorTemperatureDifference(
      floorType,
      indoor,
      outdoor,
      numberValue('hl_ground_temp', 10)
    );
    var heat = complete ? computeHeatLossValues({
      deltaT: deltaT,
      internalDeltaT: internalDeltaT,
      floorDeltaT: floorDeltaT,
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
    if (started && !dimensionsComplete) {
      warnings.push('Room length, width and ceiling height are required');
    }
    if (started && missing.length) {
      warnings.push('Select ' + missing.join(', '));
    }
    if (complete && windowArea + doorArea > grossWallArea && grossWallArea > 0) {
      warnings.push('Window and door areas exceed the exposed wall area');
    }
    if (complete && wallLength === 0 &&
        (internalWallLength === 0 || internalWallFactor === 0) &&
        floorU === 0 && roofU === 0) {
      warnings.push('No exposed wall, floor or loft has been recorded');
    }
    var currentRadiatorSelection = stringValue('rad_' + key + '_new_size');
    var radiator = complete
      ? recommendStelradElite(heat.totalWatts, indoor, currentRadiatorSelection)
      : null;
    if (radiator && radiator.temperatureWarning) {
      warnings.push(radiator.flow <= radiator.returnTemperature
        ? 'Radiator flow temperature must be higher than return temperature'
        : 'Radiator ΔT is outside Stelrad’s published 20°C to 65°C correction table');
    }
    if (radiator && !radiator.temperatureWarning && !radiator.selected) {
      warnings.push('No single Elite falls between the required output and the 50% oversize limit; use multiple radiators or review the design');
    }
    var heatedInternalWatts = isHeatedInternalWall(internalWallType)
      ? heat.internalWallWatts
      : 0;
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
      internalWallFactor: internalWallFactor,
      internalDeltaT: internalDeltaT,
      adjacentRoomName: adjacentName,
      adjacentIndoor: adjacentIndoor,
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
      floorDeltaT: floorDeltaT,
      internalWallWatts: heat.internalWallWatts,
      fabricWatts: heat.fabricWatts,
      ventilationWatts: heat.ventilationWatts,
      totalWatts: heat.totalWatts,
      propertyWatts: Math.max(0, heat.totalWatts - heatedInternalWatts),
      wattsPerSquareMetre: floorArea > 0 ? heat.totalWatts / floorArea : 0,
      radiator: radiator,
      warnings: warnings
    };
  }

  function clearCalculatedRadiatorFields(key) {
    ['kw', 'new_size', 'output'].forEach(function (suffix) {
      var field = document.getElementById('rad_' + key + '_' + suffix);
      if (!field) return;
      field.value = '';
      if (suffix === 'new_size' && field.tagName === 'SELECT') {
        field.innerHTML = '<option value="">Complete the room heat loss first</option>';
      }
      field.readOnly = true;
      field.removeAttribute('title');
    });
  }

  function radiatorOptionLabel(option, requiredWatts) {
    return option.size + ' | ' + (option.watts / 1000).toFixed(2) +
      ' kW | +' + Math.round(Math.max(0, option.watts - requiredWatts)) + ' W';
  }

  function configureRadiatorSelect(result) {
    var field = document.getElementById('rad_' + result.key + '_new_size');
    if (!field) return null;
    var existingValue = field.value;
    if (field.tagName !== 'SELECT') {
      var select = document.createElement('select');
      select.id = field.id;
      select.dataset.id = field.dataset.id;
      select.className = field.className;
      select.setAttribute('aria-label', result.roomName + ' - New Size');
      field.replaceWith(select);
      field = select;
    }
    if (field.dataset.stelradWired !== 'yes') {
      field.dataset.stelradWired = 'yes';
      field.addEventListener('change', function () {
        var selectedOption = field.options[field.selectedIndex];
        var output = document.getElementById('rad_' + result.key + '_output');
        if (output) {
          output.value = selectedOption && selectedOption.dataset.watts
            ? (Number(selectedOption.dataset.watts) / 1000).toFixed(2)
            : '';
        }
        if (typeof update === 'function') update();
        persistCombinedData();
      });
    }

    field.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = result.radiator && result.radiator.temperatureWarning
      ? 'Review the radiator design temperature'
      : 'Choose a suitable Stelrad Elite';
    field.appendChild(placeholder);

    var groups = {};
    (result.radiator ? result.radiator.options : []).forEach(function (option) {
      if (!groups[option.height]) {
        groups[option.height] = document.createElement('optgroup');
        groups[option.height].label = option.height + 'mm high';
        field.appendChild(groups[option.height]);
      }
      var choice = document.createElement('option');
      choice.value = option.size;
      choice.textContent = radiatorOptionLabel(option, result.totalWatts);
      choice.dataset.watts = option.watts.toFixed(2);
      groups[option.height].appendChild(choice);
    });

    var selectedSize = result.radiator && result.radiator.selected
      ? result.radiator.selected.size
      : existingValue;
    if (selectedSize && result.radiator.options.some(function (option) {
      return option.size === selectedSize;
    })) {
      field.value = selectedSize;
    }
    field.title = 'Suitable Stelrad Elite radiators at the selected design temperature. ' +
      'Choose another height, width or panel type where required.';
    return field;
  }

  function renderRoomResult(result) {
    var resultBox = document.getElementById('hl_' + result.key + '_result');
    var summary = document.getElementById('hl_' + result.key + '_summary');
    var radKw = document.getElementById('rad_' + result.key + '_kw');
    if (!result.started) {
      clearCalculatedRadiatorFields(result.key);
      if (resultBox) {
        resultBox.innerHTML = '<div class="hl-result-main">Enter the room length and width</div>';
      }
      if (summary) summary.textContent = 'Uses room dimensions';
      return;
    }
    if (!result.complete) {
      clearCalculatedRadiatorFields(result.key);
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
    var newSize = configureRadiatorSelect(result);
    var radOutput = document.getElementById('rad_' + result.key + '_output');
    if (result.radiator && result.radiator.selected) {
      if (newSize) {
        newSize.value = result.radiator.selected.size;
      }
      if (radOutput) {
        radOutput.value = (result.radiator.selected.watts / 1000).toFixed(2);
        radOutput.readOnly = true;
        radOutput.title = 'Temperature-corrected Stelrad output.';
      }
    } else {
      if (newSize) newSize.value = '';
      if (radOutput) radOutput.value = '';
    }
    var radiatorHtml = '';
    if (result.radiator) {
      radiatorHtml = '<div class="hl-radiator-result"><b>Stelrad Elite at ' +
        result.radiator.flow.toFixed(0) + '/' +
        result.radiator.returnTemperature.toFixed(0) + '°C:</b> ' +
        (result.radiator.temperatureWarning
          ? 'Enter valid temperatures with a ΔT from 20°C to 65°C.'
          : result.radiator.selected
            ? result.radiator.selected.size + ' gives ' +
              (result.radiator.selected.watts / 1000).toFixed(2) + ' kW. ' +
              result.radiator.options.length + ' suitable size' +
              (result.radiator.options.length === 1 ? '' : 's') +
              ' within the 50% oversize limit are available in the New Size dropdown.'
            : 'No single Elite falls between the required output and the 50% oversize limit.') +
        (result.radiator.temperatureWarning ? '' :
          '<small>Published ΔT50 output × ' + result.radiator.correctionFactor.toFixed(3) +
          ' correction factor at ΔT' + result.radiator.deltaT.toFixed(1) + '.</small>') +
        '</div>';
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
        result.wattsPerSquareMetre.toFixed(1) + ' W/m²</div>' + radiatorHtml +
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
      return sum + room.propertyWatts;
    }, 0);
    var totalArea = included.reduce(function (sum, room) {
      return sum + room.floorArea;
    }, 0);
    var radiatorOutputWatts = included.reduce(function (sum, room) {
      return sum + (room.radiator && room.radiator.selected
        ? room.radiator.selected.watts
        : 0);
    }, 0);
    var systemOutputKw = recommendedSystemOutputKw(radiatorOutputWatts);
    window.heatLossResultsV60 = {
      rooms: results,
      includedRooms: included,
      totalWatts: totalWatts,
      totalArea: totalArea,
      radiatorOutputWatts: radiatorOutputWatts,
      systemOutputKw: systemOutputKw,
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
    if (outputField) {
      outputField.value = String(systemOutputKw);
      outputField.readOnly = true;
      outputField.title = '12 kW minimum, or the combined selected radiator output when higher.';
    }
    return window.heatLossResultsV60;
  }
  window.hasCompletedHeatLossV63 = function () {
    var calculation = window.heatLossResultsV60;
    return Boolean(calculation && calculation.includedRooms.length && calculation.totalWatts > 0);
  };

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

  function wireRadiatorTemperature() {
    var designTemperature = document.getElementById('hl_radiator_temperature');
    var frontTemperature = document.getElementById('front_boiler_temp');
    if (designTemperature && designTemperature.dataset.hlTemperatureWired !== 'yes') {
      designTemperature.dataset.hlTemperatureWired = 'yes';
      designTemperature.addEventListener('change', function () {
        setValue('front_boiler_temp', designTemperature.value);
        if (typeof update === 'function') update();
        persistCombinedData();
      });
    }
    if (frontTemperature && frontTemperature.dataset.hlTemperatureWired !== 'yes') {
      frontTemperature.dataset.hlTemperatureWired = 'yes';
      frontTemperature.addEventListener('change', function () {
        setValue('hl_radiator_temperature', frontTemperature.value || 75);
        calculateHeatLoss();
        if (typeof update === 'function') update();
        persistCombinedData();
      });
    }
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
      '<td class="label">Radiator design</td><td colspan="3" class="input">Stelrad Elite at ' +
      escapeHtml(stringValue('hl_radiator_temperature')) + '°C, nominal ΔT' +
      (Number(stringValue('hl_radiator_temperature')) - 25) + '</td></tr>' +
      '<tr><th>Room</th><th>External wall</th><th>Internal wall</th><th>Windows</th><th>External door</th><th>Floor</th><th>Ceiling / loft</th><th>Ventilation</th></tr>' +
      (rows.length ? rows.map(function (room) {
        return '<tr><td><b>' + escapeHtml(room.roomName) + '</b></td>' +
          '<td>' + uValueAssumption(room.wallType, room.wallU, room.wallLength > 0) + '</td>' +
          '<td>' + uValueAssumption(room.internalWallType, room.internalWallU, room.internalWallLength > 0 && room.internalWallU > 0) +
          (room.adjacentRoomName ? '<br>Adjacent: ' + escapeHtml(room.adjacentRoomName) + ' (' + room.adjacentIndoor.toFixed(0) + '°C)' : '') + '</td>' +
          '<td>' + uValueAssumption(room.windowType, room.windowU, room.windowArea > 0 && room.windowU > 0) + '</td>' +
          '<td>' + uValueAssumption(room.doorType, room.doorU, room.doorArea > 0 && room.doorU > 0) + '</td>' +
          '<td>' + uValueAssumption(room.floorType, room.floorU, room.floorU > 0) + '</td>' +
          '<td>' + uValueAssumption(room.loftType, room.roofU, room.roofU > 0) + '</td>' +
          '<td>' + escapeHtml(room.airChangeType || 'Unknown') + '<br><b>' +
          room.ach.toFixed(2) + ' ACH</b></td></tr>';
      }).join('') : '<tr><td colspan="8" class="center">No completed rooms entered</td></tr>') +
      '<tr><td colspan="8" class="small">A heated internal wall uses the temperature difference between the two selected rooms for room radiator sizing. This transfer is excluded from the property total. An unheated space uses half the indoor-to-outdoor difference.</td></tr>' +
      '<tr><td colspan="8" class="small">Stelrad Elite ΔT50 outputs used (kW/m): K1 300/450/600/700mm = 0.517/0.768/1.000/1.142; K2 300/450/600/700mm = 1.012/1.409/1.778/2.011; K3 300/500/600/700mm = 1.418/2.169/2.514/2.841. Outputs are multiplied by Stelrad’s published correction factor for mean water temperature minus room temperature.</td></tr>' +
      '<tr><td colspan="8" class="small">Radiator choices meet the calculated room requirement without exceeding it by more than 50%. The front-page range-rate output is the higher of 12 kW or the combined corrected output of the selected radiators.</td></tr>' +
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
          Math.round(room.totalWatts) + ' W</b>' +
          (room.radiator && room.radiator.selected
            ? '<br><small>' + escapeHtml(room.radiator.selected.size) + ', ' +
              (room.radiator.selected.watts / 1000).toFixed(2) + ' kW</small>'
            : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="8" class="center">No rooms entered</td></tr>') +
      '<tr><td colspan="6" class="label right">Property design heat loss</td>' +
      '<td class="input">' + calculation.wattsPerSquareMetre.toFixed(1) +
      ' W/m²</td><td class="input"><b>' +
      (calculation.totalWatts / 1000).toFixed(2) + ' kW</b></td></tr>' +
      '<tr><td colspan="8" class="small">Room totals include any transfer to a cooler heated adjoining room for radiator sizing. The property total excludes that internal transfer. Confirm the survey assumptions before selecting equipment. This is not a certified MCS or BS EN 12831 design report.</td></tr>' +
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
    wireRadiatorTemperature();
    wirePostcodeLookup();
    wirePropertyDefaults();
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

  calculateRecommendedOutput = function () {
    var calculation = window.heatLossResultsV60 || calculateHeatLoss();
    return calculation.systemOutputKw;
  };

  calcTotalKw = function () {
    var calculation = window.heatLossResultsV60 || calculateHeatLoss();
    return (calculation.totalWatts / 1000).toFixed(2);
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
