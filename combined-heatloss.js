/* Combined radiator survey and room heat-loss calculator. */
(function () {
  var STORAGE_KEY = 'heatLossDataV60';
  var NO_NEW_RADIATOR_SELECTION = 'No new radiator selected';
  var REPLACE_LIKE_FOR_LIKE_SELECTION = 'Replace existing radiator like for like';
  var CUSTOM_EXISTING_RADIATOR_SELECTION = 'Custom radiator or towel rail';
  var persistenceReady = false;
  var postcodeLookupTimer = null;
  var postcodeLookupInProgress = false;
  var postcodeLookupActivePostcode = '';
  var RADIATOR_OUTCOMES = [
    { label: 'Size a new radiator', value: 'New radiator required' },
    { label: 'Assess the existing radiator', value: 'Assess existing radiator' },
    { label: 'Replace existing radiator like for like', value: 'Replace existing radiator like for like' },
    { label: 'Customer refused radiator work', value: 'Customer refused' }
  ];
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
  var GROUND_TEMPERATURE_STATIONS = [
    { region: 'Borders', station: 'Boulmer', latitude: 55.42085, longitude: -1.60126, temperature: 9.0 },
    { region: 'East Pennines', station: 'Finningley', latitude: 53.4747, longitude: -0.9946, temperature: 10.0 },
    { region: 'East Scotland', station: 'Leuchars', latitude: 56.37734, longitude: -2.8620, temperature: 8.8 },
    { region: 'East Anglia', station: 'Honington', latitude: 52.3426, longitude: 0.7729, temperature: 10.1 },
    { region: 'Midlands', station: 'Elmdon', latitude: 52.4539, longitude: -1.7480, temperature: 9.8 },
    { region: 'North East England', station: 'Leeming', latitude: 54.29698, longitude: -1.53301, temperature: 9.4 },
    { region: 'North East Scotland', station: 'Dyce', latitude: 57.20486, longitude: -2.20531, temperature: 8.5 },
    { region: 'North West England', station: 'Carlisle', latitude: 54.93428, longitude: -2.96364, temperature: 9.4 },
    { region: 'North West Scotland', station: 'Stornoway', latitude: 58.21345, longitude: -6.31882, temperature: 8.6 },
    { region: 'Northern Ireland', station: 'Aldergrove', latitude: 54.66365, longitude: -6.22534, temperature: 9.4 },
    { region: 'Severn Valley', station: 'Filton', latitude: 51.5194, longitude: -2.5908, temperature: 10.6 },
    { region: 'South East England', station: 'Gatwick', latitude: 51.1481, longitude: -0.1903, temperature: 10.2 },
    { region: 'South West England', station: 'Plymouth', latitude: 50.35493, longitude: -4.12097, temperature: 11.0 },
    { region: 'Southern England', station: 'Hurn', latitude: 50.77946, longitude: -1.83622, temperature: 10.4 },
    { region: 'Thames Valley', station: 'Heathrow', latitude: 51.47922, longitude: -0.45061, temperature: 11.3 },
    { region: 'Wales', station: 'Aberporth', latitude: 52.13951, longitude: -4.57110, temperature: 9.9 },
    { region: 'West Pennines', station: 'Ringway', latitude: 53.3537, longitude: -2.2749, temperature: 10.0 },
    { region: 'West Scotland', station: 'Abbotsinch', latitude: 55.8719, longitude: -4.4331, temperature: 9.1 },
    { region: 'Channel Islands', station: 'St Helier', latitude: 49.1860, longitude: -2.1070, temperature: 12.4 }
  ];
  var STELRAD_ELITE_WATTS_PER_METRE_600 = {
    K1: 1000, 'P+': 1409, K2: 1778, K3: 2514
  };
  var STELRAD_STANDARD_WIDTHS = [
    400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600,
    1800, 2000, 2200, 2400, 2600, 2800, 3000
  ];
  var STELRAD_300_WIDTHS = [500, 1000, 1500, 2000, 2500, 3000];
  var STELRAD_P_PLUS_300_WIDTHS = [500, 1000, 1500, 2000, 2500];
  var STELRAD_P_PLUS_450_600_WIDTHS = [
    400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600,
    1800, 2000
  ];
  var STELRAD_P_PLUS_700_WIDTHS = [
    400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600,
    1800
  ];
  var STELRAD_ELITE_MODELS = [
    { type: 'K1', height: 300, wattsPerMetre: 517, widths: STELRAD_300_WIDTHS },
    { type: 'K1', height: 450, wattsPerMetre: 768, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K1', height: 600, wattsPerMetre: 1000, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K1', height: 700, wattsPerMetre: 1142, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'P+', height: 300, wattsPerMetre: 776, widths: STELRAD_P_PLUS_300_WIDTHS },
    { type: 'P+', height: 450, wattsPerMetre: 1106, widths: STELRAD_P_PLUS_450_600_WIDTHS },
    { type: 'P+', height: 600, wattsPerMetre: 1409, widths: STELRAD_P_PLUS_450_600_WIDTHS },
    { type: 'P+', height: 700, wattsPerMetre: 1597, widths: STELRAD_P_PLUS_700_WIDTHS },
    { type: 'K2', height: 300, wattsPerMetre: 1012, widths: STELRAD_300_WIDTHS },
    { type: 'K2', height: 450, wattsPerMetre: 1409, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K2', height: 600, wattsPerMetre: 1778, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K2', height: 700, wattsPerMetre: 2011, widths: STELRAD_STANDARD_WIDTHS },
    { type: 'K3', height: 300, wattsPerMetre: 1418, widths: [1000, 2000] },
    { type: 'K3', height: 500, wattsPerMetre: 2169, widths: [600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2400] },
    { type: 'K3', height: 600, wattsPerMetre: 2514, widths: [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2400] },
    { type: 'K3', height: 700, wattsPerMetre: 2841, widths: [500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000] }
  ];
  // Rated at 75/65°C with a 20°C room temperature, on the normal fan speed.
  // The Hi-Line LV is the bathroom-safe low-voltage model.
  var MYSON_FAN_CONVECTOR_MODELS = [
    { type: 'Myson Kickspace', height: 101, width: 496, wattsAtDt50: 755,
      size: 'Myson Kickspace 500' },
    { type: 'Myson Kickspace', height: 101, width: 560, wattsAtDt50: 1023,
      size: 'Myson Kickspace 600' },
    { type: 'Myson Kickspace', height: 101, width: 760, wattsAtDt50: 1707,
      size: 'Myson Kickspace 800' },
    { type: 'Myson Hi-Line RC', height: 277, width: 554, wattsAtDt50: 930,
      size: 'Myson Hi-Line RC 7-4' },
    { type: 'Myson Hi-Line RC', height: 277, width: 682, wattsAtDt50: 1610,
      size: 'Myson Hi-Line RC 10-6' },
    { type: 'Myson Hi-Line RC', height: 277, width: 887, wattsAtDt50: 2459,
      size: 'Myson Hi-Line RC 15-10' },
    { type: 'Myson Hi-Line RC', height: 277, width: 1171, wattsAtDt50: 3468,
      size: 'Myson Hi-Line RC 20-14' },
    { type: 'Myson Hi-Line LV', height: 277, width: 554, wattsAtDt50: 930,
      bathroomOnly: true, size: 'Myson Hi-Line LV 7-4' }
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
      'Solid stone, uninsulated': 1.7,
      'Solid brick, uninsulated': 2.1,
      'Solid wall with 50mm internal or external insulation': 0.55,
      'Solid wall with 100mm internal or external insulation': 0.32,
      'Cavity wall, uninsulated': 1.6,
      'Brick, open cavity, 100mm aerated block + 13mm plaster': 0.87,
      'Brick, open cavity, 125mm aerated block + 13mm plaster': 0.77,
      'Cavity wall, insulated': 0.55,
      'Modern insulated wall': 0.28,
      'Timber frame, insulated': 0.4,
      'System-built wall, uninsulated': 2.0,
      'System-built wall, insulated': 0.35,
      'Cob wall, uninsulated': 0.8,
      'Park home wall': 0.7
    },
    internalWall: {
      'No internal wall included': 0,
      'Heated room, aerated block': 0.82,
      'Heated room, breeze block': 2.76,
      'Heated room, single brick': 2.05,
      'Heated room, stud and plasterboard': 1.76,
      'Unheated space, aerated block': 0.82,
      'Unheated space, breeze block': 2.76,
      'Unheated space, single brick': 2.05,
      'Unheated space, stud and plasterboard': 1.76
    },
    window: {
      'No windows': 0,
      'Single glazing': 4.8,
      'Single glazing with secondary glazing': 2.9,
      'Older standard double glazing': 2.8,
      'Modern low-E double glazing': 1.6,
      'Triple glazing': 1.1,
      'Rooflight, double glazed': 1.8
    },
    door: {
      'No external door': 0,
      'Solid timber door': 3.0,
      'Solid timber door, 25% single glazed': 3.5,
      'Solid timber door, 50% single glazed': 3.9,
      'Insulated external door': 1.8,
      'Modern composite door': 1.4,
      'High-performance insulated door': 1.0
    },
    floor: {
      'Heated room below': 0,
      'Uninsulated solid ground floor': 0.7,
      'Uninsulated solid ground floor, DHDG example': 0.85,
      'Insulated solid ground floor': 0.25,
      'Suspended timber ground floor, uninsulated': 1.2,
      'Suspended timber ground floor, 50mm insulation': 0.5,
      'Suspended timber ground floor, 100mm insulation': 0.3,
      'Suspended timber ground floor, 150mm insulation': 0.22,
      'Floor above unheated cellar or garage': 0.7,
      'Floor above partially heated premises': 0.7,
      'Uninsulated exposed floor': 0.7,
      'Insulated exposed floor': 0.25
    },
    loft: {
      'Heated room above': 0,
      'Plasterboard, no loft insulation': 2.3,
      'Plasterboard with 50mm insulation': 0.68,
      'Plasterboard with 100mm insulation': 0.4,
      'Plasterboard with 200mm insulation': 0.21,
      'Plasterboard with 270mm insulation': 0.16,
      'Plasterboard with 300mm insulation': 0.14,
      'Flat roof, uninsulated': 2.3,
      'Flat roof, 200mm insulation, DHDG example': 0.17,
      'Flat roof, insulated': 0.25,
      'Sloping roof or room-in-roof, uninsulated': 2.3,
      'Sloping roof or room-in-roof, 100mm insulation': 0.4,
      'Sloping roof or room-in-roof, 150mm insulation': 0.25,
      'Sloping roof or room-in-roof, 200mm insulation': 0.18
    },
    airChange: {
      'Standard room': 0.5,
      'Draughty room': 1.0,
      'Very draughty room': 1.5
    },
    ventilationDevice: {
      'No additional vent or flue': 0,
      'Intermittent extract fan': 10,
      'Passive wall or window vent': 10,
      'Closed fireplace or chimney': 10,
      'Blocked chimney': 20,
      'Solid-fuel chimney': 20,
      'Other heater flue': 35,
      'Other open flue (vertical duct)': 20,
      'Flueless gas fire': 40,
      'Open chimney': 80
    }
  };

  var PROPERTY_AGE_BANDS = [
    { label: 'Unknown', value: 'Unknown' },
    { label: 'A, before 1900', value: 'A' },
    { label: 'B, 1900 to 1929', value: 'B' },
    { label: 'C, 1930 to 1949', value: 'C' },
    { label: 'D, 1950 to 1966', value: 'D' },
    { label: 'E, 1967 to 1975', value: 'E' },
    { label: 'F, 1976 to 1982', value: 'F' },
    { label: 'G, 1983 to 1990', value: 'G' },
    { label: 'H, 1991 to 1995', value: 'H' },
    { label: 'I, 1996 to 2002', value: 'I' },
    { label: 'J, 2003 to 2006', value: 'J' },
    { label: 'K, 2007 to 2011', value: 'K' },
    { label: 'L, 2012 to 2022', value: 'L' },
    { label: 'M, 2023 onwards', value: 'M' }
  ];
  var DHDG_ADJACENT_TEMPERATURES = [
    { label: '10°C, unheated space or party wall', value: '10' },
    { label: '18°C, functional room', value: '18' },
    { label: '21°C, living space', value: '21' },
    { label: '22°C, bathroom or shower room', value: '22' },
    { label: '23°C, vulnerable-person living temperature', value: '23' }
  ];
  var ADJACENT_SPACES = [
    { label: 'Use standard unheated-space assumption', value: 'Standard' },
    { label: 'Attached garage', value: 'Attached garage' },
    { label: 'Built-in garage', value: 'Built-in garage' },
    { label: 'Unheated cellar or basement', value: 'Unheated cellar or basement' },
    { label: 'Internal cupboard', value: 'Internal cupboard' },
    { label: 'Communal corridor or stairwell', value: 'Communal corridor or stairwell' },
    { label: 'Unheated conservatory', value: 'Unheated conservatory' },
    { label: 'Roof void', value: 'Roof void' },
    { label: 'Neighbouring dwelling', value: 'Neighbouring dwelling' },
    { label: 'Outside air', value: 'Outside air' }
  ];
  var ADJACENT_SPACE_FACTORS = {
    'Standard': 0.5,
    'Attached garage': 0.7,
    'Built-in garage': 0.5,
    'Unheated cellar or basement': 0.5,
    'Internal cupboard': 0.25,
    'Communal corridor or stairwell': 0.5,
    'Unheated conservatory': 0.8,
    'Roof void': 1,
    'Neighbouring dwelling': 0,
    'Outside air': 1
  };
  var THERMAL_BRIDGE_FACTORS = { A: 0.15, B: 0.15, C: 0.15, D: 0.15, E: 0.15, F: 0.15, G: 0.15, H: 0.15, I: 0.15, J: 0.11, K: 0.08, L: 0.08, M: 0.08, Unknown: 0.15 };

  var VENTILATION_SYSTEMS = [
    { label: 'Natural ventilation', value: 'Natural ventilation' },
    { label: 'Mechanical extract ventilation (MEV)', value: 'Mechanical extract ventilation (MEV)' },
    { label: 'Mechanical ventilation (MV)', value: 'Mechanical ventilation (MV)' },
    { label: 'Mechanical ventilation with heat recovery (MVHR)', value: 'Mechanical ventilation with heat recovery (MVHR)' },
    { label: 'Positive input ventilation (PIV)', value: 'Positive input ventilation (PIV)' }
  ];
  var AIR_CHANGE_MODES = [
    { label: 'Automatic, MCS/CIBSE room and age minimum', value: 'Automatic' },
    { label: 'Manual override', value: 'Manual override' }
  ];
  var RADIATOR_CONNECTIONS = [
    { label: 'BBOE, 4% lower emitter output', value: 'BBOE' },
    { label: 'TBOE, recommended reference connection', value: 'TBOE' }
  ];
  var VENTILATION_AGE_CATEGORIES = [
    { label: 'Use property age band', value: '' },
    { label: 'Pre-2000: 1.5 ACH baseline', value: 'pre-2000' },
    { label: '2000 to 2006: 1.0 ACH baseline', value: '2000-2006' },
    { label: '2006 onwards: 0.5 ACH baseline', value: '2006+' }
  ];
  var REHEAT_FACTORS = [
    { label: 'No intermittent-heating allowance', value: '1' },
    { label: 'Setback up to 8 hours: +10%', value: '1.1' },
    { label: 'Setback 8 to 11 hours: +15%', value: '1.15' },
    { label: 'Setback over 11 hours: +20%', value: '1.2' }
  ];
  var CEILING_FACTORS = [
    { label: 'Ceiling up to 2.4m: no allowance', value: '1' },
    { label: 'Ceiling up to 3.0m: +2%', value: '1.02' },
    { label: 'Ceiling up to 4.0m: +5%', value: '1.05' },
    { label: 'Ceiling above 4.0m: +8%', value: '1.08' }
  ];
  var RADIATOR_INSTALLATION_FACTORS = [
    { label: 'Standard wall-mounted, unobstructed', value: '1' },
    { label: 'Shelf above radiator: -5%', value: '0.95' },
    { label: 'Enclosed cabinet with top grille: -20%', value: '0.8' },
    { label: 'Enclosed cabinet with front grille: -30%', value: '0.7' }
  ];
  var RADIATOR_FINISH_FACTORS = [
    { label: 'Factory, oil or water-based finish', value: '1' },
    { label: 'Metallic paint: -15%', value: '0.85' }
  ];

  var HEAT_LOSS_SUFFIXES = [
    'indoor_temp',
    'external_wall_length',
    'wall_type',
    'alternative_wall_length',
    'alternative_wall_type',
    'internal_wall_length',
    'internal_wall_count',
    'internal_wall_type',
    'internal_adjacent_room',
    'internal_adjacent_space',
    'internal_adjacent_temp',
    'window_area',
    'window_width',
    'window_height',
    'window_count',
    'window_1_length',
    'window_1_width',
    'window_2_length',
    'window_2_width',
    'window_3_length',
    'window_3_width',
    'window_type',
    'door_area',
    'door_width',
    'door_height',
    'door_count',
    'door_1_length',
    'door_1_width',
    'door_2_length',
    'door_2_width',
    'door_type',
    'floor_type',
    'floor_exposed_perimeter',
    'floor_adjacent_temp',
    'loft_type',
    'roof_adjacent_temp',
    'rooflight_area',
    'rooflight_type',
    'internal_segment_1_length',
    'internal_segment_1_type',
    'internal_segment_1_adjacent_room',
    'internal_segment_1_adjacent_space',
    'internal_segment_1_adjacent_temp',
    'internal_segment_2_length',
    'internal_segment_2_type',
    'internal_segment_2_adjacent_room',
    'internal_segment_2_adjacent_space',
    'internal_segment_2_adjacent_temp',
    'internal_segment_3_length',
    'internal_segment_3_type',
    'internal_segment_3_adjacent_room',
    'internal_segment_3_adjacent_space',
    'internal_segment_3_adjacent_temp',
    'internal_segment_4_length',
    'internal_segment_4_type',
    'internal_segment_4_adjacent_room',
    'internal_segment_4_adjacent_space',
    'internal_segment_4_adjacent_temp',
    'building_part',
    'element_age_band',
    'assumption_quality',
    'ventilation_mode',
    'manual_ach',
    'ventilation_device',
    'chimney_restricted',
    'shared_radiator_with',
    'rad_max_height',
    'rad_max_width',
    'rad_preferred_width',
    'rad_panel_type',
    'radiator_installation',
    'radiator_finish',
    'rad_quantity'
  ];

  function numberValue(id, fallback) {
    var field = document.getElementById(id);
    if (!field || field.value === '') return Number(fallback || 0);
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
      if (id !== 'hl_bridge_pct' && !id.endsWith('_outcome')) {
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
        (id === 'hl_mvhr_efficiency' ? ' max="100"' : '') +
        (id === 'hl_outdoor_temp' || id === 'hl_property_altitude' ||
          id.endsWith('_internal_adjacent_temp') || id.endsWith('_floor_adjacent_temp') ||
          id.endsWith('_roof_adjacent_temp') || id.endsWith('_segment_1_adjacent_temp') ||
          id.endsWith('_segment_2_adjacent_temp') || id.endsWith('_segment_3_adjacent_temp') ||
          id.endsWith('_segment_4_adjacent_temp')
          ? ''
          : ' min="0"') + '>';
    }
    return '<div class="field"><label for="' + safeId + '">' +
      escapeHtml(label) + '</label>' + control +
      (help ? '<small>' + escapeHtml(help) + '</small>' : '') + '</div>';
  }

  function internalWallFieldHtml(key) {
    var options = Object.keys(VALUES.internalWall).filter(function (option) {
      return option.indexOf('Heated room, ') === 0;
    }).map(function (option) {
      return {
        label: option.replace(/^Heated room, /, ''),
        value: option
      };
    });
    return fieldHtml('hl_' + key + '_internal_wall_type',
      'Internal wall construction', 'select', options,
      'This construction is used for every numbered internal wall below.');
  }

  function internalWallSegmentsHtml(key) {
    var countOptions = [0, 1, 2, 3, 4].map(function (count) {
      return {
        label: count === 0 ? '0, no internal walls' : String(count),
        value: String(count)
      };
    });
    var rows = [1, 2, 3, 4].map(function (index) {
      var prefix = 'hl_' + key + '_internal_segment_' + index;
      return '<div class="hl-segment-card" id="' + escapeHtml(prefix) +
        '_wrap" hidden><h5>Wall ' + index + '</h5>' +
        '<div class="hl-wall-row-grid">' +
        fieldHtml(prefix + '_length', 'Wall ' + index + ' length (m)', 'number') +
        fieldHtml(prefix + '_adjacent_temp', 'Wall ' + index +
          ' temperature on other side (°C)', 'select', DHDG_ADJACENT_TEMPERATURES) +
        '</div>' +
        '<input type="hidden" id="' + escapeHtml(prefix) + '_type" data-id="' +
        escapeHtml(prefix) + '_type">' +
        '<input type="hidden" id="' + escapeHtml(prefix) +
        '_adjacent_room" data-id="' + escapeHtml(prefix) + '_adjacent_room">' +
        '<input type="hidden" id="' + escapeHtml(prefix) +
        '_adjacent_space" data-id="' + escapeHtml(prefix) + '_adjacent_space">' +
        '</div>';
    }).join('');
    return '<div class="hl-wall-segments">' +
      '<div class="hl-fields-grid">' +
      fieldHtml('hl_' + key + '_internal_wall_count', 'Number of internal walls',
        'select', countOptions,
        'Initially estimated as four minus the outside wall count. Change it for irregular rooms.') +
      internalWallFieldHtml(key) + '</div>' +
      '<p class="hl-help">Enter the measured length and the temperature on the other side of each wall.</p>' +
      rows + '</div>';
  }

  function sharedRadiatorFieldHtml(key) {
    var options = [{ label: 'No, size this room separately', value: '' }].concat(
      allRoomNames().filter(function (roomName) {
        return roomKeyFromName(roomName) !== key;
      }).map(function (roomName) {
        return { label: roomName, value: roomKeyFromName(roomName) };
      })
    );
    return fieldHtml('hl_' + key + '_shared_radiator_with',
      'Radiator supplied by another room', 'select', options,
      'Select the room containing the shared radiator. Each room keeps its own heat-loss calculation, but the host room sizes one radiator for both loads.');
  }

  function isBathroomRoomName(roomName) {
    return /bath|shower|en[\s-]*suite/i.test(String(roomName || ''));
  }

  function targetTemperature(roomName) {
    var name = String(roomName || '').toLowerCase();
    if (isBathroomRoomName(roomName)) return 22;
    if (name.includes('lounge') || name.includes('living')) return 21;
    return 18;
  }

  function previousTargetTemperature(roomName) {
    var name = String(roomName || '').toLowerCase();
    if (isBathroomRoomName(roomName)) return 22;
    if (name.includes('lounge') || name.includes('living') ||
        name.includes('dining')) return 21;
    if (name.includes('kitchen')) return 20;
    if (name.includes('bed')) return 18;
    if (name.includes('hall') || name.includes('landing') ||
        name.includes('wc') || name.includes('toilet')) return 18;
    return 20;
  }

  function targetTemperatureForAge(roomName, ageBand) {
    return window.HeatLossCalculations.roomDesignTemperature(roomName, ageBand);
  }

  function previousTargetTemperatureForAge(roomName, ageBand) {
    if (isBathroomRoomName(roomName)) return 22;
    if (['K', 'L', 'M'].includes(String(ageBand || 'Unknown'))) return 21;
    return previousTargetTemperature(roomName);
  }

  function openingMeasurementFieldsHtml(key, opening, number, label) {
    var fieldPrefix = 'hl_' + key + '_' + opening + '_' + number;
    return '<div class="hl-opening-measurement" id="' + escapeHtml(fieldPrefix) +
      '_wrap" hidden><div class="hl-fields-grid">' +
      fieldHtml(fieldPrefix + '_length', label + ' length (m)', 'number') +
      fieldHtml(fieldPrefix + '_width', label + ' width (m)', 'number') +
      '</div></div>';
  }

  function radiatorPanelHtml(roomName) {
    var key = roomKeyFromName(roomName);
    return '<section class="hl-radiator-panel" id="hl_' + escapeHtml(key) +
      '_radiator_panel"><div class="hl-radiator-panel-heading"><h4>Radiator assessment and selection</h4>' +
      '<p>Choose the outcome, record the existing radiator where required, then select any replacement.</p></div>' +
      fieldHtml('rad_' + key + '_outcome', roomName + ' - Radiator outcome', 'select',
        RADIATOR_OUTCOMES,
        'Choose a new radiator, assess the installed radiator, replace it like for like, or record that the customer refused radiator work.') +
      '<div class="hl-radiator-requirement" id="hl_' + escapeHtml(key) +
      '_radiator_requirement">Required radiator output: complete the room details to calculate.</div>' +
      '<div class="hl-radiator-controls" id="hl_' + escapeHtml(key) +
      '_radiator_controls"></div></section>';
  }

  function roomDropdownHtml(roomName) {
    var key = roomKeyFromName(roomName);
    var ageBand = stringValue('hl_property_age_band') || 'Unknown';
    var temperatures = [
      { label: '18°C, all other rooms', value: '18' },
      { label: '20°C, manual selection', value: '20' },
      { label: '21°C, living room or lounge', value: '21' },
      { label: '22°C, bathroom or shower room', value: '22' }
    ];
    var adjacentRooms = [{ label: 'Same design temperature', value: '' }].concat(
      allRoomNames().filter(function (candidate) {
        return roomKeyFromName(candidate) !== key;
      }).map(function (candidate) {
        return {
          label: candidate + ' (' + targetTemperatureForAge(candidate, ageBand) + '°C)',
          value: roomKeyFromName(candidate)
        };
      })
    );
    return '<details class="hl-room-dropdown" data-hl-room="' +
      escapeHtml(key) + '">' +
      '<summary><span>Heat loss details</span><span id="hl_' +
      escapeHtml(key) + '_summary">Uses room dimensions</span></summary>' +
      '<div class="hl-room-body">' +
      '<p class="hl-room-intro">Length and width come from this room. Ceiling height comes from the top of the Rads page. Construction choices apply standard values automatically.</p>' +
      '<div class="hl-room-geometry" id="hl_' + escapeHtml(key) +
      '_geometry" aria-live="polite">Enter the room length and width to see its wall geometry.</div>' +
      '<div class="hl-fields-grid">' +
      fieldHtml('hl_' + key + '_indoor_temp', 'Room design temperature', 'select', temperatures) +
      sharedRadiatorFieldHtml(key) +
      fieldHtml('hl_' + key + '_external_wall_length', 'Exposed wall length (m)', 'number', null, 'Leave blank to estimate it from the outside wall count above.') +
      fieldHtml('hl_' + key + '_wall_type', 'External wall construction', 'select', optionsFromMap(VALUES.externalWall)) +
      '</div>' +
      '<section class="hl-internal-wall" id="hl_' + escapeHtml(key) +
      '_internal_wall" hidden><div class="hl-internal-wall-heading"><h4>Internal wall details</h4><p id="hl_' +
      escapeHtml(key) + '_internal_wall_help"></p></div>' +
      internalWallSegmentsHtml(key) +
      '<input type="hidden" id="hl_' + escapeHtml(key) +
      '_internal_wall_length" data-id="hl_' + escapeHtml(key) + '_internal_wall_length">' +
      '<input type="hidden" id="hl_' + escapeHtml(key) +
      '_internal_adjacent_room" data-id="hl_' + escapeHtml(key) + '_internal_adjacent_room">' +
      '<input type="hidden" id="hl_' + escapeHtml(key) +
      '_internal_adjacent_space" data-id="hl_' + escapeHtml(key) + '_internal_adjacent_space">' +
      '<input type="hidden" id="hl_' + escapeHtml(key) +
      '_internal_adjacent_temp" data-id="hl_' + escapeHtml(key) + '_internal_adjacent_temp">' +
      '</section><div class="hl-fields-grid">' +
      '<input type="hidden" id="hl_' + escapeHtml(key) + '_window_area" data-id="hl_' +
      escapeHtml(key) + '_window_area">' +
      '<input type="hidden" id="hl_' + escapeHtml(key) + '_window_width" data-id="hl_' +
      escapeHtml(key) + '_window_width"><input type="hidden" id="hl_' +
      escapeHtml(key) + '_window_height" data-id="hl_' + escapeHtml(key) +
      '_window_height">' +
      fieldHtml('hl_' + key + '_window_type', 'Windows', 'select', optionsFromMap(VALUES.window)) +
      '<div id="hl_' + escapeHtml(key) + '_window_count_wrap" hidden>' +
      fieldHtml('hl_' + key + '_window_count', 'Number of windows', 'select', ['0', '1', '2', '3'], 'Choose the number first. Each window can be measured separately.') +
      '</div>' +
      '<div class="hl-opening-measurements" id="hl_' + escapeHtml(key) +
      '_window_measurements_wrap" hidden>' +
      openingMeasurementFieldsHtml(key, 'window', 1, 'Window 1') +
      openingMeasurementFieldsHtml(key, 'window', 2, 'Window 2') +
      openingMeasurementFieldsHtml(key, 'window', 3, 'Window 3') +
      '</div>' +
      '<input type="hidden" id="hl_' + escapeHtml(key) + '_door_area" data-id="hl_' +
      escapeHtml(key) + '_door_area">' +
      '<input type="hidden" id="hl_' + escapeHtml(key) + '_door_width" data-id="hl_' +
      escapeHtml(key) + '_door_width"><input type="hidden" id="hl_' +
      escapeHtml(key) + '_door_height" data-id="hl_' + escapeHtml(key) +
      '_door_height">' +
      fieldHtml('hl_' + key + '_door_type', 'External door', 'select', optionsFromMap(VALUES.door)) +
      '<div id="hl_' + escapeHtml(key) + '_door_count_wrap" hidden>' +
      fieldHtml('hl_' + key + '_door_count', 'Number of doors', 'select', ['0', '1', '2'], 'Choose the number first. Each door can be measured separately.') +
      '</div>' +
      '<div class="hl-opening-measurements" id="hl_' + escapeHtml(key) +
      '_door_measurements_wrap" hidden>' +
      openingMeasurementFieldsHtml(key, 'door', 1, 'Door 1') +
      openingMeasurementFieldsHtml(key, 'door', 2, 'Door 2') +
      '</div>' +
      fieldHtml('hl_' + key + '_floor_type', 'Floor', 'select', optionsFromMap(VALUES.floor),
        'Solid ground floors use the property ground temperature. Suspended and exposed floors use the outdoor design temperature.') +
      '<input type="hidden" id="hl_' + escapeHtml(key) +
      '_floor_adjacent_temp" data-id="hl_' + escapeHtml(key) + '_floor_adjacent_temp">' +
      fieldHtml('hl_' + key + '_loft_type', 'Ceiling or loft', 'select', optionsFromMap(VALUES.loft),
        'Roof and loft constructions use the outdoor design temperature because the loft space is already included in the U-value.') +
      '<input type="hidden" id="hl_' + escapeHtml(key) +
      '_roof_adjacent_temp" data-id="hl_' + escapeHtml(key) + '_roof_adjacent_temp">' +
      fieldHtml('hl_' + key + '_rooflight_type', 'Rooflights', 'select', [
        { label: 'No rooflights', value: 'No rooflights' },
        { label: 'Rooflight, double glazed', value: 'Rooflight, double glazed' },
        { label: 'Rooflight, single glazed', value: 'Single glazing' }
      ]) +
      fieldHtml('hl_' + key + '_rooflight_area', 'Total rooflight area (m²)', 'number', null, 'Keep rooflights separate from the roof or ceiling area.') +
      fieldHtml('hl_' + key + '_assumption_quality', 'Construction evidence', 'select', ['Measured and confirmed', 'Visually estimated', 'Age-based assumption', 'General default']) +
      fieldHtml('hl_' + key + '_ventilation_mode', 'Room air-change rate', 'select', AIR_CHANGE_MODES, 'Automatic uses the MCS/CIBSE minimum for this room type and the selected property age band, or 0 ACH where the room has no external envelope.') +
      fieldHtml('hl_' + key + '_manual_ach', 'Manual ACH override', 'number', null, 'Only used when Manual override is selected.') +
      fieldHtml('hl_' + key + '_ventilation_device', 'Additional vent, fan or flue', 'select', optionsFromMap(VALUES.ventilationDevice), 'Adds the published default airflow for this room. Open chimney uses the room-volume and throat-restriction ACH table.') +
      fieldHtml('hl_' + key + '_chimney_restricted', 'Open chimney throat restrictor', 'select', [
        { label: 'No restrictor', value: 'No' },
        { label: 'Restrictor fitted', value: 'Yes' }
      ], 'Only used for Open chimney. The airflow is selected from room volume: up to 40m³ or over 40m³.') +
      fieldHtml('hl_' + key + '_radiator_installation', 'Radiator installation', 'select', RADIATOR_INSTALLATION_FACTORS, 'The selected factor reduces actual emitter output for a shelf or enclosure.') +
      fieldHtml('hl_' + key + '_radiator_finish', 'Radiator finish', 'select', RADIATOR_FINISH_FACTORS, 'Metallic paint reduces output by 15%; factory, oil or water-based finishes use 1.00.') +
      fieldHtml('hl_' + key + '_rad_quantity', 'Number of new radiators', 'select', ['Automatic', '1', '2'], 'Automatic tries one radiator first, then two independently sized radiators if required.') +
      '</div>' +
      '<div class="hl-room-result" id="hl_' + escapeHtml(key) + '_result">' +
      '<div class="hl-result-main">Enter the room length and width</div>' +
      '</div></div></details>';
  }

  function propertySummaryHtml() {
    var radiatorTemperatures = [
      { label: '75°C, nominal ΔT50', value: '75' },
      { label: '65°C, nominal ΔT40', value: '65' },
      { label: '55°C, nominal ΔT30', value: '55' }
    ];
    var bridgeMethods = [
      { label: 'Age-based RdSAP factor', value: 'Age-based' },
      { label: 'Standard allowance, 10%', value: 'Percentage' },
      { label: 'No thermal-bridge allowance', value: 'None' }
    ];
    return '<div class="card hl-summary-card" id="heatLossSummaryCard">' +
      '<h3>Heat loss summary</h3>' +
      '<input type="hidden" id="survey_schema_version" data-id="_schemaVersion" value="' +
      window.SurveyPersistence.CURRENT_SCHEMA_VERSION + '">' +
      '<div class="hl-postcode-lookup">' +
      '<button type="button" id="hl_lookup_postcode">Use property postcode</button>' +
      '<div id="hl_postcode_lookup_status" role="status">Enter a property postcode above to set the design temperature, altitude and ground temperature.</div>' +
      '</div>' +
      '<p>Open Heat loss details inside each room. The room load is calculated automatically, then suitable Stelrad Elite or Myson fan-convector options can be selected in the radiator schedule.</p>' +
      '<div class="hl-summary-grid">' +
      fieldHtml('hl_property_age_band', 'Main property age band', 'select', PROPERTY_AGE_BANDS, 'Select Unknown when there is no reliable record. The surveyor can verify the age separately before finalising the survey.') +
      fieldHtml('hl_property_age_source', 'Property age evidence', 'select', ['Title deeds or building-control record', 'Homeowner or landlord', 'Visual estimate', 'Unknown']) +
      fieldHtml('hl_outdoor_temp', 'Outdoor design temperature (°C)', 'number', null, 'Automatically uses the nearest 99.6% reference value for the property postcode.') +
      fieldHtml('hl_bridge_method', 'Thermal bridge method', 'select', bridgeMethods, 'The percentage method applies the allowance to the complete room load before the room factors.') +
      fieldHtml('hl_ventilation_age_category', 'Ventilation age category', 'select', VENTILATION_AGE_CATEGORIES, 'Matches the presentation bands: pre-2000, 2000 to 2006, and 2006 onwards. Override the property age band when it crosses a band.') +
      fieldHtml('hl_exposed_location', 'Exposed location allowance', 'select', [
        { label: 'No additional exposed-location allowance', value: '1' },
        { label: 'Exposed site: +10%', value: '1.1' }
      ]) +
      fieldHtml('hl_reheat_factor', 'Intermittent heating / reheat allowance', 'select', REHEAT_FACTORS, 'Use the setback duration from the heating design. This is applied after the room heat loss is calculated.') +
      fieldHtml('hl_high_ceiling_factor', 'High-ceiling allowance', 'select', CEILING_FACTORS, 'The standard room height is 2.4m. Choose the nearest higher band for rooms with high ceilings.') +
      fieldHtml('hl_property_altitude', 'Property altitude (m)', 'number', null, 'Estimated from postcode coordinates using Elevation API EU and Copernicus terrain data. If higher than the reference station, the outdoor temperature is reduced by 0.6°C per complete 100m.') +
      fieldHtml('hl_ground_temp', 'Ground temperature (°C)', 'number', null, 'Uses the annual mean temperature from the nearest MCS reference station for solid ground floors.') +
      fieldHtml('hl_radiator_temperature', 'Radiator design temperature', 'select', radiatorTemperatures, 'Limited to the three system temperatures used: 75°C, 65°C or 55°C.') +
      fieldHtml('hl_radiator_connection', 'Radiator pipe connection', 'select', RADIATOR_CONNECTIONS, 'BBOE reduces each radiator’s effective output by 4%, multiplying it by 0.96. It does not change the calculated room heat loss. TBOE uses the temperature-corrected radiator output without this connection reduction.') +
      fieldHtml('hl_radiator_plan', 'Whole-property radiator outcome', 'select', [
        { label: 'Survey radiators room by room', value: 'Room by room' },
        { label: 'Customer refused all radiator work', value: 'Customer refused all' }
      ], 'Refusal marks every room as Refused while leaving the boiler and materials choices available.') +
      fieldHtml('hl_ventilation_system', 'Property ventilation system', 'select', VENTILATION_SYSTEMS, 'Automatic room ACH uses the selected MCS/CIBSE room and age minimum. MVHR reduces the mechanical ventilation loss by its heat-recovery efficiency. Additional vents and flues remain additive.') +
      fieldHtml('hl_mvhr_efficiency', 'MVHR heat recovery (%)', 'number', null, 'Only used for MVHR. Enter the design efficiency, normally taken from the unit data.') +
      '</div>' +
      '<p class="hl-help hl-age-guidance">If the age is unknown, leave it as Unknown and search separately using reliable property records. Do not infer the age from neighbouring homes.</p>' +
      '<details class="hl-property-defaults"><summary>Property construction defaults</summary>' +
      '<p class="hl-help">Applies external wall, internal wall and window defaults only. Floor, loft and room ventilation devices must be selected inside each room.</p>' +
      '<div class="hl-summary-grid">' +
      fieldHtml('hl_default_wall', 'External wall', 'select', optionsFromMap(VALUES.externalWall)) +
      fieldHtml('hl_default_internal_wall', 'Internal wall construction', 'select', optionsFromMap(VALUES.internalWall)) +
      fieldHtml('hl_default_window', 'Windows', 'select', optionsFromMap(VALUES.window)) +
      '</div><button type="button" id="hl_apply_defaults">Apply to all rooms</button></details>' +
      '<input type="hidden" id="hl_design_postcode" data-id="hl_design_postcode">' +
      '<input type="hidden" id="hl_design_station" data-id="hl_design_station">' +
      '<input type="hidden" id="hl_design_base_temp" data-id="hl_design_base_temp">' +
      '<input type="hidden" id="hl_design_station_altitude" data-id="hl_design_station_altitude">' +
      '<input type="hidden" id="hl_ground_station" data-id="hl_ground_station">' +
      '<input type="hidden" id="hl_design_manual" data-id="hl_design_manual">' +
      '<input type="hidden" id="hl_temperature_defaults_v62" data-id="hl_temperature_defaults_v62">' +
      '<input type="hidden" id="hl_temperature_defaults_v64" data-id="hl_temperature_defaults_v64">' +
      '<input type="hidden" id="hl_temperature_defaults_v65" data-id="hl_temperature_defaults_v65">' +
      '<input type="hidden" id="hl_applied_age_band" data-id="hl_applied_age_band">' +
      '<div class="hl-property-result"><div class="hl-total-number" id="hl_property_total">0.00 kW</div>' +
      '<div id="hl_property_detail">Enter at least one room to begin.</div></div>' +
      '<p class="hl-help"><b>Survey disclaimer:</b> Some property construction materials, insulation levels and dimensions may be presumed from visible evidence or typical construction where they cannot be verified. Confirm them before equipment selection.</p>' +
      '<p class="hl-help">This is a practical survey estimate. Confirm the property construction and postcode-derived location assumptions before selecting equipment.</p>' +
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

  function nearestGroundTemperatureStation(latitude, longitude) {
    return GROUND_TEMPERATURE_STATIONS.reduce(function (nearest, station) {
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

  async function propertyElevation(latitude, longitude) {
    var controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    var timeout = controller
      ? setTimeout(function () { controller.abort(); }, 7000)
      : null;
    var url = 'https://www.elevation-api.eu/v1/elevation/' +
      encodeURIComponent(latitude) + '/' + encodeURIComponent(longitude) + '?json';
    try {
      var response = await fetch(url, controller ? { signal: controller.signal } : {});
      if (!response.ok) return null;
      var body = await response.json();
      var elevation = body ? Number(body.elevation) : NaN;
      return Number.isFinite(elevation) ? Math.round(elevation) : null;
    } catch (error) {
      return null;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  function specialPostcodeStation(postcode) {
    var compact = normalisePostcode(postcode);
    if (compact.startsWith('JE') || compact.startsWith('GY')) {
      return {
        station: {
          location: 'Channel Islands',
          station: 'Maison St Louis Observatory',
          temperature: 0.1,
          altitude: 53
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

  function applyPostcodeDesignTemperature(postcode, match, locationDefaults) {
    var station = match.station;
    var elevation = locationDefaults ? locationDefaults.elevation : null;
    var groundMatch = locationDefaults ? locationDefaults.groundMatch : null;
    postcodeLookupInProgress = true;
    if (Number.isFinite(elevation)) {
      setValue('hl_property_altitude', elevation);
    } else {
      setValue('hl_property_altitude', '');
    }
    if (groundMatch && groundMatch.station) {
      setValue('hl_ground_temp', groundMatch.station.temperature.toFixed(1));
      setValue('hl_ground_station', groundMatch.station.region +
        ' (' + groundMatch.station.station + ')');
    }
    var propertyAltitudeText = stringValue('hl_property_altitude');
    var propertyAltitude = propertyAltitudeText === '' ? null : Number(propertyAltitudeText);
    var stationAltitude = Number(station.altitude) || 0;
    var altitudeSteps = propertyAltitude == null || !Number.isFinite(propertyAltitude)
      ? 0
      : Math.max(0, Math.floor((propertyAltitude - stationAltitude) / 100));
    var correctedTemperature = station.temperature - altitudeSteps * 0.6;
    setValue('hl_outdoor_temp', correctedTemperature.toFixed(1));
    setValue('hl_design_postcode', normalisePostcode(postcode));
    setValue('hl_design_station', station.location + ' (' + station.station + ')');
    setValue('hl_design_base_temp', station.temperature.toFixed(1));
    setValue('hl_design_station_altitude', stationAltitude);
    setValue('hl_design_manual', 'no');
    postcodeLookupInProgress = false;
    var locationMessage = Number.isFinite(elevation)
      ? ' Altitude ' + elevation + 'm.'
      : ' Altitude was unavailable and can be entered manually.';
    if (groundMatch && groundMatch.station) {
      locationMessage += ' Ground temperature ' +
        groundMatch.station.temperature.toFixed(1) + '°C from ' +
        groundMatch.station.region + ' (' + groundMatch.station.station + ').';
    }
    setPostcodeLookupStatus(
      'Using ' + station.location + ' (' + station.station + '), ' +
      correctedTemperature.toFixed(1) + '°C' +
      (altitudeSteps ? ' after a ' + (altitudeSteps * 0.6).toFixed(1) +
        '°C altitude correction.' : '.') + locationMessage +
        ' You can edit these values manually.',
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
        'Enter a property postcode above to set the design temperature, altitude and ground temperature.',
        ''
      );
      return;
    }
    if (postcodeLookupActivePostcode === compact) return;

    postcodeLookupActivePostcode = compact;
    setPostcodeLookupStatus('Finding the local design temperature, altitude and ground temperature...', 'loading');
    try {
      var coordinates = await postcodeCoordinates(postcode);
      if (normalisePostcode(postcodeField && postcodeField.value) !== compact) return;
      if (!coordinates) {
        setPostcodeLookupStatus(
          'Postcode not recognised. Enter the location values manually.',
          'error'
        );
        return;
      }
      var match = specialPostcodeStation(compact) ||
        nearestDesignStation(coordinates.latitude, coordinates.longitude);
      var groundMatch = nearestGroundTemperatureStation(
        coordinates.latitude,
        coordinates.longitude
      );
      var elevation = await propertyElevation(
        coordinates.latitude,
        coordinates.longitude
      );
      if (normalisePostcode(postcodeField && postcodeField.value) !== compact) return;
      applyPostcodeDesignTemperature(postcode, match, {
        elevation: elevation,
        groundMatch: groundMatch
      });
    } catch (error) {
      setPostcodeLookupStatus(
        'Postcode lookup is unavailable. Enter the location values manually.',
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

  function markGroundTemperatureManual() {
    if (postcodeLookupInProgress) return;
    setValue('hl_ground_station', 'Manual value');
    persistCombinedData();
  }

  function refreshPostcodeLookupStatus() {
    var postcode = normalisePostcode(stringValue('site_postcode'));
    var matchedPostcode = stringValue('hl_design_postcode');
    var station = stringValue('hl_design_station');
    var groundStation = stringValue('hl_ground_station');
    var altitudeText = stringValue('hl_property_altitude');
    if (!postcode) {
      setPostcodeLookupStatus(
        'Enter a property postcode above to set the design temperature, altitude and ground temperature.',
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
        '°C. Altitude ' + (altitudeText === ''
          ? 'not set'
          : Number(altitudeText).toFixed(0) + 'm') +
        '. Ground temperature ' + numberValue('hl_ground_temp', 10).toFixed(1) +
        '°C' + (groundStation === 'Manual value'
          ? ' (manual)'
          : groundStation ? ' from ' + groundStation : '') +
        '. You can edit these values manually.',
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
    var groundStation = stringValue('hl_ground_station');
    var altitudeResult = window.HeatLossCalculations.altitudeAdjustedTemperature(
      baseTemperature, propertyAltitude, stationAltitude
    );
    if (!altitudeResult) return;
    var steps = altitudeResult.steps;
    postcodeLookupInProgress = true;
    setValue('hl_outdoor_temp', altitudeResult.temperature.toFixed(1));
    postcodeLookupInProgress = false;
    setPostcodeLookupStatus(
      'Using ' + stringValue('hl_design_station') + ', ' +
      numberValue('hl_outdoor_temp', 0).toFixed(1) + '°C' +
      (steps ? ' after a ' + altitudeResult.correction.toFixed(1) +
        '°C altitude correction.' : '.') +
      ' Ground temperature ' + numberValue('hl_ground_temp', 10).toFixed(1) +
      '°C' + (groundStation === 'Manual value'
        ? ' (manual)'
        : groundStation ? ' from ' + groundStation : '') + '.',
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
    var groundTemperature = document.getElementById('hl_ground_temp');
    if (groundTemperature && groundTemperature.dataset.hlGroundWired !== 'yes') {
      groundTemperature.dataset.hlGroundWired = 'yes';
      groundTemperature.addEventListener('input', markGroundTemperatureManual);
    }
    refreshPostcodeLookupStatus();
  }

  window.lookupOutdoorDesignTemperatureV61 = performPostcodeLookup;

  function storedSurveyData() {
    try {
      return JSON.parse(localStorage.getItem('surveyWebData') || '{}') || {};
    } catch (error) {
      if (typeof showAppStatus === 'function') {
        showAppStatus('The autosaved survey is damaged and could not be restored. Import a JSON backup or continue with a new survey.', 'warning');
      }
      console.error('Could not restore autosaved survey:', error);
      return {};
    }
  }

  function storedCombinedData() {
    try {
      return window.SurveyPersistence.decode(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      if (typeof showAppStatus === 'function') {
        showAppStatus('Saved heat-loss details could not be restored. The current form is still usable.', 'warning');
      }
      console.error('Could not restore heat-loss data:', error);
      return {};
    }
  }

  function persistCombinedData() {
    if (!persistenceReady) return;
    var data = {};
    document.querySelectorAll('#radsForm [data-id]').forEach(function (field) {
      data[field.dataset.id] = field.value;
    });
    data._schemaVersion = window.SurveyPersistence.CURRENT_SCHEMA_VERSION;
    try {
      localStorage.setItem(STORAGE_KEY, window.SurveyPersistence.encode(data));
    } catch (error) {
      if (typeof showAppStatus === 'function') {
        showAppStatus('Could not save heat-loss details. Browser storage may be full; export JSON now.', 'warning');
      }
      console.error('Could not save heat-loss data:', error);
    }
  }

  function restoreValues(data) {
    Object.entries(data || {}).forEach(function (entry) {
      var field = document.querySelector('[data-id="' + CSS.escape(entry[0]) + '"]');
      if (!field) return;
      if (field.tagName === 'SELECT' && /_new_size_2$/.test(field.id)) {
        if (entry[1]) field.dataset.restoredValue = entry[1];
        else delete field.dataset.restoredValue;
      }
      field.value = entry[1];
    });
    migrateOldHeatLossValues(data || {});
  }

  function migrateOldHeatLossValues(data) {
    if (data.hl_property_age_source === 'Official EPC' ||
        data.hl_property_age_source === 'EPC developer data') {
      setValue('hl_property_age_source', 'Unknown');
    }
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
          setValue('hl_' + key + '_window_type', 'Older standard double glazing');
        }
      }
      if (data['hl_' + key + '_window_type'] === 'Double glazing') {
        setValue('hl_' + key + '_window_type', 'Older standard double glazing');
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
      var ventilationModeId = 'hl_' + key + '_ventilation_mode';
      var manualAchId = 'hl_' + key + '_manual_ach';
      var oldAirChange = data['hl_' + key + '_air_change'];
      if (!stringValue(ventilationModeId)) {
        if (oldAirChange === 'Draughty room' || oldAirChange === 'Very draughty room') {
          setValue(ventilationModeId, 'Manual override');
          if (!stringValue(manualAchId)) {
            setValue(manualAchId, VALUES.airChange[oldAirChange]);
          }
        } else {
          setValue(ventilationModeId, 'Automatic');
        }
      }
      if (!stringValue('hl_' + key + '_ventilation_device')) {
        setValue('hl_' + key + '_ventilation_device', 'No additional vent or flue');
      }
    });
  }

  function applyDefaults() {
    if (!stringValue('r_ceiling')) setValue('r_ceiling', 2.4);
    if (!stringValue('hl_outdoor_temp')) setValue('hl_outdoor_temp', -3);
    if (!stringValue('hl_bridge_pct')) setValue('hl_bridge_pct', 10);
    if (!stringValue('hl_ground_temp')) setValue('hl_ground_temp', 10);
    if (!stringValue('hl_property_age_band')) setValue('hl_property_age_band', 'Unknown');
    if (!stringValue('hl_property_age_source')) setValue('hl_property_age_source', 'Unknown');
    if (!stringValue('hl_bridge_method')) setValue('hl_bridge_method', 'Percentage');
    if (!stringValue('hl_ventilation_age_category')) setValue('hl_ventilation_age_category', '');
    if (!stringValue('hl_exposed_location')) setValue('hl_exposed_location', '1');
    if (!stringValue('hl_reheat_factor')) setValue('hl_reheat_factor', '1');
    if (!stringValue('hl_high_ceiling_factor')) setValue('hl_high_ceiling_factor', '1');
    if (!stringValue('hl_ventilation_system')) {
      setValue('hl_ventilation_system', 'Natural ventilation');
    }
    if (!stringValue('hl_mvhr_efficiency')) setValue('hl_mvhr_efficiency', 75);
    if (!['75', '65', '55'].includes(stringValue('hl_radiator_temperature'))) {
      setValue('hl_radiator_temperature', 75);
    }
    if (!stringValue('hl_radiator_connection')) setValue('hl_radiator_connection', 'BBOE');
    if (!stringValue('hl_radiator_plan')) {
      setValue('hl_radiator_plan', 'Room by room');
    }
    setValue('front_boiler_temp', stringValue('hl_radiator_temperature'));
    var propertyDefaults = {
      hl_default_wall: 'Cavity wall, insulated',
      hl_default_internal_wall: 'No internal wall included',
      hl_default_window: 'Older standard double glazing'
    };
    Object.entries(propertyDefaults).forEach(function (entry) {
      if (!stringValue(entry[0])) setValue(entry[0], entry[1]);
    });
    var migrateTemperatureDefaults = stringValue('hl_temperature_defaults_v62') !== 'yes';
    var migrateSimplifiedTemperatureDefaults =
      stringValue('hl_temperature_defaults_v64') !== 'yes';
    var migrateAgeTemperatureDefaults =
      stringValue('hl_temperature_defaults_v65') !== 'yes';
    allRoomNames().forEach(function (roomName) {
      var key = roomKeyFromName(roomName);
      var ageBand = stringValue('hl_property_age_band') || 'Unknown';
      var newIndoorDefault = targetTemperatureForAge(roomName, ageBand);
      var currentIndoorTemperature = stringValue('hl_' + key + '_indoor_temp');
      if (migrateTemperatureDefaults && currentIndoorTemperature === '20' &&
          previousTargetTemperature(roomName) === 20 &&
          newIndoorDefault !== 20) {
        setValue('hl_' + key + '_indoor_temp', newIndoorDefault);
      }
      if (migrateSimplifiedTemperatureDefaults &&
          Number(currentIndoorTemperature) === previousTargetTemperatureForAge(roomName, ageBand) &&
          newIndoorDefault !== previousTargetTemperatureForAge(roomName, ageBand)) {
        setValue('hl_' + key + '_indoor_temp', newIndoorDefault);
      }
      if (migrateAgeTemperatureDefaults &&
          Number(currentIndoorTemperature) === targetTemperature(roomName) &&
          newIndoorDefault !== targetTemperature(roomName)) {
        setValue('hl_' + key + '_indoor_temp', newIndoorDefault);
      }
      var defaults = {
        indoor_temp: newIndoorDefault,
        wall_type: 'Cavity wall, insulated',
        internal_wall_type: 'No internal wall included',
        window_count: '0',
        window_type: 'Older standard double glazing',
        door_count: '0',
        door_type: 'No external door',
        internal_adjacent_space: 'Standard',
        building_part: 'Main dwelling',
        element_age_band: 'Unknown',
        assumption_quality: 'General default',
        ventilation_mode: 'Automatic',
        ventilation_device: 'No additional vent or flue',
        chimney_restricted: 'No',
        radiator_installation: '1',
        radiator_finish: '1',
        rooflight_type: 'No rooflights',
        rad_max_height: 'Any',
        rad_panel_type: 'Any'
      };
      if (!stringValue('hl_' + key + '_window_count') &&
          numberValue('hl_' + key + '_window_area', 0) > 0) {
        setValue('hl_' + key + '_window_count', '1');
      }
      if (!stringValue('hl_' + key + '_door_count') &&
          numberValue('hl_' + key + '_door_area', 0) > 0) {
        setValue('hl_' + key + '_door_count', '1');
      }
      Object.entries(defaults).forEach(function (entry) {
        var id = 'hl_' + key + '_' + entry[0];
        if (!stringValue(id)) setValue(id, entry[1]);
      });
      if (!stringValue('rad_' + key + '_ex_quantity')) {
        setValue('rad_' + key + '_ex_quantity', '1');
      }
      if (!stringValue('hl_' + key + '_rad_quantity')) {
        setValue('hl_' + key + '_rad_quantity', String(Math.max(1,
          Math.min(2, Math.round(numberValue('rad_' + key + '_ex_quantity', 1)) || 1))));
      }
      if (!stringValue('rad_' + key + '_outcome')) {
        setValue('rad_' + key + '_outcome', 'New radiator required');
      }
    });
    setValue('hl_temperature_defaults_v62', 'yes');
    setValue('hl_temperature_defaults_v64', 'yes');
    setValue('hl_temperature_defaults_v65', 'yes');
    if (!stringValue('hl_applied_age_band')) {
      setValue('hl_applied_age_band', stringValue('hl_property_age_band') || 'Unknown');
    }
  }

  function applyPropertyConstructionDefaults() {
    var defaults = {
      wall_type: stringValue('hl_default_wall'),
      internal_wall_type: stringValue('hl_default_internal_wall'),
      window_type: stringValue('hl_default_window')
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
    var ageField = document.getElementById('hl_property_age_band');
    if (ageField && ageField.dataset.hlAgeWired !== 'yes') {
      ageField.dataset.hlAgeWired = 'yes';
      ageField.addEventListener('change', function () {
        var oldAge = stringValue('hl_applied_age_band') || 'Unknown';
        var newAge = ageField.value || 'Unknown';
        allRoomNames().forEach(function (roomName) {
          var id = 'hl_' + roomKeyFromName(roomName) + '_indoor_temp';
          if (numberValue(id, 0) === targetTemperatureForAge(roomName, oldAge)) {
            setValue(id, targetTemperatureForAge(roomName, newAge));
          }
        });
        setValue('hl_applied_age_band', newAge);
        calculateHeatLoss();
        persistCombinedData();
      });
    }
  }

  function estimatedWallLength(length, width, wallCount) {
    return window.HeatLossCalculations.estimatedWallLength(length, width, wallCount);
  }

  function remainingInternalWallLength(length, width, exposedWallLength) {
    return window.HeatLossCalculations.remainingInternalWallLength(
      length, width, exposedWallLength
    );
  }

  function mappedValue(group, selected) {
    var value = VALUES[group][selected];
    return Number.isFinite(value) ? value : 0;
  }

  function radiatorOutputFactor(key) {
    var installation = numberValue('hl_' + key + '_radiator_installation', 1);
    var finish = numberValue('hl_' + key + '_radiator_finish', 1);
    installation = installation > 0 && installation <= 1 ? installation : 1;
    finish = finish > 0 && finish <= 1 ? finish : 1;
    return installation * finish;
  }

  function radiatorConnectionOutputFactor() {
    return window.HeatLossCalculations.radiatorConnectionOutputFactor(
      stringValue('hl_radiator_connection') || 'BBOE'
    );
  }

  function effectiveRadiatorOutputFactor(key) {
    return radiatorOutputFactor(key) * radiatorConnectionOutputFactor();
  }

  function internalWallTemperatureFactor(selected) {
    return String(selected || '').indexOf('Unheated space') === 0 ? 0.5 : 0;
  }

  function isHeatedInternalWall(selected) {
    return String(selected || '').indexOf('Heated room') === 0;
  }

  function floorTemperatureDifference(floorType, indoor, outdoor, ground, adjacentTemperature) {
    return window.HeatLossCalculations.floorTemperatureDifference(
      floorType, indoor, outdoor, ground, adjacentTemperature
    );
  }

  function stelradCorrectionFactor(deltaT) {
    return window.RadiatorSizing.correctionFactor(deltaT, STELRAD_CORRECTION_FACTORS);
  }

  function stelradModel(type, height) {
    return STELRAD_ELITE_MODELS.find(function (model) {
      return model.type === type && model.height === Number(height || 600);
    });
  }

  function stelradOutput(type, width, correctionFactor, height) {
    var model = stelradModel(type, height || 600);
    return window.RadiatorSizing.output(model, width, correctionFactor);
  }

  function minimumStelradFallback(correctionFactor, filters) {
    var model = STELRAD_ELITE_MODELS.find(function (candidate) {
      return candidate.type === 'K1' && candidate.height === 450 &&
        candidate.widths.includes(400);
    });
    if (!model || (filters.maxHeight && model.height > filters.maxHeight) ||
        (filters.maxWidth && 400 > filters.maxWidth) ||
        (filters.panelType && filters.panelType !== 'Any' &&
          filters.panelType !== model.type)) {
      return null;
    }
    var watts = model.wattsPerMetre * 0.4 * correctionFactor *
      (Number(filters.outputFactor) || 1);
    return {
      type: model.type,
      height: model.height,
      width: 400,
      watts: watts,
      unitWatts: watts,
      quantity: 1,
      ratedWatts: model.wattsPerMetre * 0.4,
      oversizePercent: 0,
      minimumSizeFallback: true,
      size: '450(h) x 400(w) K1'
    };
  }

  function roomIsBathroom(roomName) {
    return isBathroomRoomName(roomName);
  }

  function sortRadiatorOptions(options, filters) {
    return options.sort(function (a, b) {
      if (filters.preferredWidth) {
        var aDistance = Math.abs(a.width - filters.preferredWidth);
        var bDistance = Math.abs(b.width - filters.preferredWidth);
        if (aDistance !== bDistance) return aDistance - bDistance;
      }
      return a.height - b.height || a.width - b.width || a.type.localeCompare(b.type) ||
        a.size.localeCompare(b.size);
    });
  }

  function mysonFanConvectorOptions(deltaT, filters, roomName) {
    if (!Number.isFinite(Number(deltaT))) return [];
    var bathroom = roomIsBathroom(roomName);
    return MYSON_FAN_CONVECTOR_MODELS.filter(function (model) {
      if (bathroom !== Boolean(model.bathroomOnly)) return false;
      if (filters.maxHeight && model.height > filters.maxHeight) return false;
      if (filters.maxWidth && model.width > filters.maxWidth) return false;
      return !filters.panelType || filters.panelType === 'Any';
    }).map(function (model) {
      // Myson's published 75/65 and 90/70 data follows a 1.06 exponent.
      var watts = model.wattsAtDt50 * Math.pow(Math.max(0, deltaT) / 50, 1.06) *
        (Number(filters.outputFactor) || 1);
      return {
        type: model.type,
        height: model.height,
        width: model.width,
        watts: watts,
        unitWatts: watts,
        quantity: 1,
        ratedWatts: model.wattsAtDt50,
        manufacturer: 'Myson',
        fanConvector: true,
        bathroomOnly: Boolean(model.bathroomOnly),
        size: model.size
      };
    });
  }

  function stelradIndividualOptions(correctionFactor, filters, roomName, deltaT,
    newInstallation) {
    filters = filters || {};
    var options = [];
    STELRAD_ELITE_MODELS.forEach(function (model) {
      // 500 mm high models are retained for an existing-radiator assessment,
      // but cannot be selected for a new installation.
      if (newInstallation && model.height === 500) return;
      if (filters.maxHeight && model.height > filters.maxHeight) return;
      if (filters.panelType && filters.panelType !== 'Any' &&
          model.type !== filters.panelType) return;
      model.widths.forEach(function (width) {
        if (filters.maxWidth && width > filters.maxWidth) return;
        var watts = model.wattsPerMetre * (width / 1000) * correctionFactor *
          (Number(filters.outputFactor) || 1);
        options.push({
          type: model.type,
          height: model.height,
          width: width,
          watts: watts,
          unitWatts: watts,
          quantity: 1,
          ratedWatts: model.wattsPerMetre * (width / 1000),
          manufacturer: 'Stelrad',
          size: model.height + '(h) x ' + width + '(w) ' + model.type
        });
      });
    });
    options = options.concat(mysonFanConvectorOptions(deltaT, filters, roomName));
    return sortRadiatorOptions(options, filters);
  }

  function suitableStelradOptions(requiredWatts, correctionFactor, filters, quantity,
    roomName, deltaT) {
    filters = filters || {};
    quantity = Math.max(1, Math.round(Number(quantity) || 1));
    if (requiredWatts <= 0) return [];
    var options = window.RadiatorSizing.suitableOptions(
      requiredWatts,
      stelradIndividualOptions(correctionFactor, filters, roomName, deltaT, true),
      quantity
    );
    var minimumFallback = quantity === 1
      ? minimumStelradFallback(correctionFactor, filters)
      : null;
    if (!options.length && minimumFallback && requiredWatts < minimumFallback.watts) {
      options.push(minimumFallback);
    }
    return sortRadiatorOptions(options, filters);
  }

  function suitableStelradPairData(requiredWatts, correctionFactor, filters, roomName,
    deltaT) {
    return window.RadiatorSizing.suitablePairs(
      requiredWatts,
      stelradIndividualOptions(correctionFactor, filters, roomName, deltaT, true)
    );
  }

  function legacyPairSize(selection) {
    var match = String(selection || '').match(/^2\s+x\s+(.+)$/i);
    return match ? match[1] : String(selection || '');
  }

  function recommendStelradElite(requiredWatts, indoor, currentSelection, key, roomName) {
    var flow = Number(stringValue('hl_radiator_temperature')) || 75;
    var returnTemperature = flow - 10;
    var meanWater = (flow + returnTemperature) / 2;
    var deltaT = meanWater - indoor;
    var correctionFactor = stelradCorrectionFactor(deltaT);
    var validTemperature = flow > returnTemperature && deltaT >= 20 && deltaT <= 65;
    var filters = {
      maxHeight: Number(stringValue('hl_' + key + '_rad_max_height')) || 0,
      maxWidth: numberValue('hl_' + key + '_rad_max_width', 0),
      preferredWidth: numberValue('hl_' + key + '_rad_preferred_width', 0),
      panelType: stringValue('hl_' + key + '_rad_panel_type') || 'Any',
      outputFactor: effectiveRadiatorOutputFactor(key)
    };
    var quantityChoice = stringValue('hl_' + key + '_rad_quantity') || 'Automatic';
    var currentFirstSize = legacyPairSize(currentSelection);
    var currentSecondField = document.getElementById('rad_' + key + '_new_size_2');
    var currentSecondSize = stringValue('rad_' + key + '_new_size_2') ||
      (currentSecondField && currentSecondField.dataset.restoredValue) || '';
    if (!currentSecondSize && String(currentSelection || '').match(/^2\s+x\s+/i)) {
      currentSecondSize = currentFirstSize;
    }
    var options = [];
    var secondOptions = [];
    var selectedFirst = null;
    var selectedSecond = null;
    var selected = null;
    var pairCount = 0;
    var usesTwo = false;
    if (validTemperature) {
      var singleOptions = suitableStelradOptions(
        requiredWatts, correctionFactor, filters, 1, roomName, deltaT
      );
      usesTwo = quantityChoice === '2' ||
        (quantityChoice === 'Automatic' && !singleOptions.length);
      if (!usesTwo) {
        options = singleOptions;
        selectedFirst = options.find(function (option) {
          return option.size === currentFirstSize;
        }) || options.find(function (option) {
          return option.height === 600 && option.type === 'K2';
        }) || options.reduce(function (closest, option) {
          return !closest || option.watts < closest.watts ? option : closest;
        }, null);
        selected = selectedFirst;
      } else {
        var pairData = suitableStelradPairData(requiredWatts, correctionFactor, filters,
          roomName, deltaT);
        pairCount = pairData.pairs.length;
        options = pairData.units;
        var currentFirst = options.find(function (option) {
          return option.size === currentFirstSize;
        });
        var currentSecond = options.find(function (option) {
          return option.size === currentSecondSize;
        });
        var currentWatts = currentFirst && currentSecond
          ? currentFirst.watts + currentSecond.watts
          : 0;
        var currentPairValid = currentWatts >= requiredWatts &&
          currentWatts <= requiredWatts * 1.5 + 0.01;
        var bestPair = currentPairValid
          ? { first: currentFirst, second: currentSecond, watts: currentWatts }
          : pairData.pairs.find(function (pair) {
            return currentFirst &&
              (pair.first.size === currentFirst.size || pair.second.size === currentFirst.size);
          }) || pairData.pairs[0];
        if (bestPair) {
          selectedFirst = currentPairValid
            ? currentFirst
            : bestPair.first.size === (currentFirst && currentFirst.size)
              ? bestPair.first
              : bestPair.second.size === (currentFirst && currentFirst.size)
                ? bestPair.second
                : bestPair.first;
          secondOptions = options.filter(function (option) {
            var combined = selectedFirst.watts + option.watts;
            return combined >= requiredWatts && combined <= requiredWatts * 1.5 + 0.01;
          });
          selectedSecond = currentPairValid
            ? currentSecond
            : secondOptions.find(function (option) {
              return option.size === currentSecondSize;
            }) || secondOptions.reduce(function (closest, option) {
              return !closest || option.watts < closest.watts ? option : closest;
            }, null);
          if (selectedSecond) {
            selected = {
              first: selectedFirst,
              second: selectedSecond,
              watts: selectedFirst.watts + selectedSecond.watts,
              size: selectedFirst.size + ' + ' + selectedSecond.size,
              quantity: 2,
              oversizePercent: Math.max(0,
                (selectedFirst.watts + selectedSecond.watts - requiredWatts) /
                requiredWatts * 100)
            };
          }
        }
      }
    }
    return {
      flow: flow,
      returnTemperature: returnTemperature,
      meanWater: meanWater,
      nominalDeltaT: flow - 25,
      deltaT: deltaT,
      correctionFactor: correctionFactor,
      filters: filters,
      quantityChoice: quantityChoice,
      usesTwo: usesTwo,
      options: options,
      secondOptions: secondOptions,
      selectedFirst: selectedFirst,
      selectedSecond: selectedSecond,
      pairCount: pairCount,
      selected: selected,
      temperatureWarning: !validTemperature
    };
  }

  function recommendedSystemOutputKw(radiatorOutputWatts) {
    return window.RadiatorSizing.recommendedSystemOutputKw(radiatorOutputWatts);
  }
  window.stelradEliteSizingV63 = {
    wattsPerMetre: STELRAD_ELITE_WATTS_PER_METRE_600,
    models: STELRAD_ELITE_MODELS,
    correctionFactor: stelradCorrectionFactor,
    output: stelradOutput,
    suitableOptions: suitableStelradOptions,
    recommendedSystemOutputKw: recommendedSystemOutputKw
  };

  function radiatorOutcomeForRoom(key) {
    if (stringValue('hl_radiator_plan') === 'Customer refused all') {
      return 'Customer refused';
    }
    return stringValue('rad_' + key + '_outcome') || 'New radiator required';
  }

  function existingRadiatorUnitForRoom(key, indoor, roomName, index) {
    var suffix = index > 1 ? '_' + index : '';
    var size = stringValue('rad_' + key + '_ex_size' + suffix);
    if (!size) return null;
    var radiatorFactor = effectiveRadiatorOutputFactor(key);
    if (size === CUSTOM_EXISTING_RADIATOR_SELECTION) {
      var customKw = numberValue('rad_' + key + '_ex_custom_kw' + suffix, 0);
      if (customKw <= 0) return null;
      return {
        type: 'Custom radiator or towel rail',
        size: CUSTOM_EXISTING_RADIATOR_SELECTION,
        unitSize: CUSTOM_EXISTING_RADIATOR_SELECTION,
        watts: customKw * 1000 * radiatorFactor,
        unitWatts: customKw * 1000 * radiatorFactor,
        quantity: 1,
        ratedWatts: customKw * 1000,
        customOutput: true
      };
    }
    var flow = Number(stringValue('hl_radiator_temperature')) || 75;
    var returnTemperature = flow - 10;
    var deltaT = (flow + returnTemperature) / 2 - indoor;
    if (deltaT < 20 || deltaT > 65) return null;
    var correctionFactor = stelradCorrectionFactor(deltaT);
    var option = stelradIndividualOptions(correctionFactor,
      { outputFactor: radiatorFactor }, roomName, deltaT, false).find(function (option) {
      return option.size === size;
    });
    if (!option) return null;
    return Object.assign({}, option, {
      unitSize: option.size,
      unitWatts: option.watts,
      quantity: 1
    });
  }

  function existingRadiatorForRoom(key, indoor, roomName) {
    var quantity = Math.max(1, Math.min(2,
      Math.round(numberValue('rad_' + key + '_ex_quantity', 1)) || 1));
    var radiators = [];
    for (var index = 1; index <= quantity; index += 1) {
      var radiator = existingRadiatorUnitForRoom(key, indoor, roomName, index);
      if (radiator) radiators.push(radiator);
    }
    if (!radiators.length) return null;
    return {
      type: radiators.length === 1 ? radiators[0].type : 'Existing radiators',
      size: radiators.map(function (radiator) { return radiator.size; }).join(' + '),
      unitSize: radiators[0].unitSize,
      watts: radiators.reduce(function (sum, radiator) {
        return sum + radiator.watts;
      }, 0),
      unitWatts: radiators[0].unitWatts,
      quantity: radiators.length,
      expectedQuantity: quantity,
      complete: radiators.length === quantity,
      ratedWatts: radiators.reduce(function (sum, radiator) {
        return sum + radiator.ratedWatts;
      }, 0),
      customOutput: radiators.some(function (radiator) {
        return radiator.customOutput;
      })
    };
  }

  function existingRadiatorGuidance(key) {
    var quantity = Math.max(1, Math.min(2,
      Math.round(numberValue('rad_' + key + '_ex_quantity', 1)) || 1));
    var missing = [];
    for (var index = 1; index <= quantity; index += 1) {
      var suffix = index > 1 ? '_' + index : '';
      var size = stringValue('rad_' + key + '_ex_size' + suffix);
      var label = index === 1 ? 'existing radiator size' :
        'existing radiator ' + index + ' size';
      if (!size) {
        missing.push('Select the ' + label);
      } else if (size === CUSTOM_EXISTING_RADIATOR_SELECTION &&
          numberValue('rad_' + key + '_ex_custom_kw' + suffix, 0) <= 0) {
        missing.push('Enter the custom output for existing radiator ' + index);
      }
    }
    return missing.join('. ') || 'Select a recognised existing radiator size';
  }

  function existingRadiatorOutputDescription(existingRadiator) {
    var prefix = existingRadiator && existingRadiator.expectedQuantity > 1
      ? 'Combined output of ' + existingRadiator.quantity + ' of ' +
        existingRadiator.expectedQuantity + ' existing radiators. '
      : '';
    return prefix + (existingRadiator && existingRadiator.customOutput
      ? 'Custom output entered for the retained radiator or towel rail.'
      : 'Temperature-corrected output of the selected existing-size radiator.');
  }

  function computeHeatLossValues(input) {
    return window.HeatLossCalculations.computeHeatLossValues(input);
  }
  window.computeHeatLossValuesV60 = computeHeatLossValues;

  function openingMeasurements(key, opening, maximumCount) {
    var type = stringValue('hl_' + key + '_' + opening + '_type');
    var noOpening = !type || (opening === 'window'
      ? type === 'No windows'
      : type === 'No external door');
    if (noOpening) return { area: 0, count: 0, complete: true, measured: true };
    var count = Math.max(0, Math.min(maximumCount, Math.round(numberValue(
      'hl_' + key + '_' + opening + '_count', 0))));
    var area = 0;
    var hasDetailedMeasurement = false;
    var measurementsComplete = true;
    var index;
    for (index = 1; index <= count; index += 1) {
      var length = numberValue('hl_' + key + '_' + opening + '_' + index + '_length', 0);
      var width = numberValue('hl_' + key + '_' + opening + '_' + index + '_width', 0);
      if (length > 0 || width > 0) hasDetailedMeasurement = true;
      if (length <= 0 || width <= 0) {
        measurementsComplete = false;
      } else {
        area += length * width;
      }
    }
    if (count === 0) {
      return { area: 0, count: 0, complete: true, measured: true };
    }
    if (!hasDetailedMeasurement) {
      var legacyLength = numberValue('hl_' + key + '_' + opening + '_width', 0);
      var legacyWidth = numberValue('hl_' + key + '_' + opening + '_height', 0);
      if (legacyLength > 0 && legacyWidth > 0) {
        return {
          area: legacyLength * legacyWidth * count,
          count: count,
          complete: true,
          measured: true
        };
      }
      var legacyArea = numberValue('hl_' + key + '_' + opening + '_area', 0);
      if (legacyArea > 0) {
        return { area: legacyArea, count: count, complete: true, measured: false };
      }
    }
    if (!measurementsComplete) {
      return { area: 0, count: count, complete: false, measured: true };
    }
    return { area: area, count: count, complete: true, measured: true };
  }

  function calculateRoom(roomName, ventilationContext) {
    ventilationContext = ventilationContext || {};
    var key = roomKeyFromName(roomName);
    var length = numberValue('rad_' + key + '_len', 0);
    var width = numberValue('rad_' + key + '_wid', 0);
    var height = numberValue('r_ceiling', 2.4);
    var propertyAgeBand = stringValue('hl_property_age_band') || 'Unknown';
    var indoor = numberValue('hl_' + key + '_indoor_temp',
      targetTemperatureForAge(roomName, propertyAgeBand));
    var outdoor = numberValue('hl_outdoor_temp', -3);
    var deltaT = indoor - outdoor;
    var floorArea = length * width;
    var volume = floorArea * height;
    var outsideWallCount = Math.round(numberValue('rad_' + key + '_outside', 0));
    var internalWallCountField = document.getElementById(
      'hl_' + key + '_internal_wall_count');
    var storedInternalWallCount = internalWallCountField
      ? String(internalWallCountField.value || '') : '';
    var internalWallCountIsManual = storedInternalWallCount !== '' &&
      (!internalWallCountField.dataset.hlCountWired ||
        internalWallCountField.dataset.hlCountManual === 'yes');
    var internalWallCountText = internalWallCountIsManual ? storedInternalWallCount : '';
    var legacySegmentCount = 0;
    for (var legacySegmentIndex = 1; legacySegmentIndex <= 4; legacySegmentIndex += 1) {
      if (numberValue('hl_' + key + '_internal_segment_' + legacySegmentIndex +
          '_length', 0) > 0) {
        legacySegmentCount = legacySegmentIndex;
      }
    }
    var suggestedInternalWallCount = Math.max(0, Math.min(4, 4 - outsideWallCount));
    var internalWallCount = internalWallCountText !== ''
      ? Math.max(0, Math.min(4, Math.round(Number(internalWallCountText) || 0)))
      : legacySegmentCount || suggestedInternalWallCount;
    var enteredWallLength = numberValue('hl_' + key + '_external_wall_length', 0);
    var wallLength = enteredWallLength > 0
      ? enteredWallLength
      : estimatedWallLength(length, width, outsideWallCount);
    var assumedWall = enteredWallLength <= 0 && outsideWallCount > 0;
    var enteredInternalWallLength = Math.max(0,
      numberValue('hl_' + key + '_internal_wall_length', 0));
    var calculatedInternalWallLength = remainingInternalWallLength(length, width,
      wallLength);
    var internalWallLength = internalWallCount === 0
      ? 0
      : enteredInternalWallLength > 0
        ? enteredInternalWallLength
        : calculatedInternalWallLength;
    var assumedInternalWall = internalWallCount > 0 && enteredInternalWallLength <= 0 &&
      calculatedInternalWallLength > 0;
    var windowMeasurements = openingMeasurements(key, 'window', 3);
    var windowCount = windowMeasurements.count;
    var measuredWindowArea = windowMeasurements.measured;
    var windowArea = windowMeasurements.complete
      ? windowMeasurements.area
      : Math.max(0, numberValue('hl_' + key + '_window_area', 0));
    var doorMeasurements = openingMeasurements(key, 'door', 2);
    var doorCount = doorMeasurements.count;
    var measuredDoorArea = doorMeasurements.measured;
    var doorArea = doorMeasurements.complete
      ? doorMeasurements.area
      : Math.max(0, numberValue('hl_' + key + '_door_area', 0));
    var grossWallArea = Math.max(0, wallLength * height);
    var netWallArea = Math.max(0, grossWallArea - windowArea - doorArea);
    var internalWallArea = internalWallLength * height;
    var rectangularPerimeter = 2 * (length + width);
    var openingsExceedWallArea = windowArea + doorArea > grossWallArea + 0.01;
    var manualWallExceedsRectangle = enteredWallLength > rectangularPerimeter + 0.01;
    var started = length > 0 || width > 0;
    var dimensionsComplete = length > 0 && width > 0 && height > 0;
    var wallType = stringValue('hl_' + key + '_wall_type');
    var alternativeWallLength = Math.min(wallLength,
      Math.max(0, numberValue('hl_' + key + '_alternative_wall_length', 0)));
    var alternativeWallType = stringValue('hl_' + key + '_alternative_wall_type');
    var internalWallType = stringValue('hl_' + key + '_internal_wall_type');
    var numberedInternalWallMode = internalWallCountText !== '' || legacySegmentCount === 0;
    var internalWallSegments = [];
    var internalWallMissing = [];
    for (var segmentIndex = 1; segmentIndex <= internalWallCount; segmentIndex += 1) {
      var segmentPrefix = 'hl_' + key + '_internal_segment_' + segmentIndex;
      var segmentLengthText = stringValue(segmentPrefix + '_length');
      var segmentLength = Number(segmentLengthText);
      var segmentAdjacentTempText = stringValue(segmentPrefix + '_adjacent_temp');
      var segmentAdjacentTemperature = Number(segmentAdjacentTempText);
      if (numberedInternalWallMode) {
        if (segmentLengthText === '' || !Number.isFinite(segmentLength) || segmentLength <= 0) {
          internalWallMissing.push('wall ' + segmentIndex + ' length');
        }
        if (segmentAdjacentTempText === '' || !Number.isFinite(segmentAdjacentTemperature)) {
          internalWallMissing.push('wall ' + segmentIndex + ' temperature on the other side');
        }
      }
      if (!Number.isFinite(segmentLength) || segmentLength <= 0) continue;
      var legacySegmentType = stringValue(segmentPrefix + '_type');
      var segmentType = mappedValue('internalWall', internalWallType) > 0
        ? internalWallType
        : legacySegmentType;
      var segmentAdjacentKey = stringValue(segmentPrefix + '_adjacent_room');
      var segmentAdjacentName = allRoomNames().find(function (candidate) {
        return roomKeyFromName(candidate) === segmentAdjacentKey;
      }) || '';
      var segmentAdjacentIndoor = segmentAdjacentName
        ? numberValue('hl_' + segmentAdjacentKey + '_indoor_temp',
          targetTemperatureForAge(segmentAdjacentName, propertyAgeBand))
        : indoor;
      var segmentAdjacentSpace = stringValue(segmentPrefix + '_adjacent_space') || 'Standard';
      var segmentDelta = segmentAdjacentTempText !== '' &&
          Number.isFinite(segmentAdjacentTemperature)
        ? indoor - segmentAdjacentTemperature
        : isHeatedInternalWall(segmentType)
          ? indoor - segmentAdjacentIndoor
          : String(segmentType || '').indexOf('Unheated space') === 0
            ? indoor - 10
            : 0;
      internalWallSegments.push({
        length: segmentLength,
        type: segmentType,
        u: mappedValue('internalWall', segmentType),
        deltaT: segmentDelta,
        adjacentRoomName: segmentAdjacentName,
        adjacentSpace: segmentAdjacentSpace,
        adjacentTemperature: segmentAdjacentTempText !== '' &&
          Number.isFinite(segmentAdjacentTemperature)
          ? segmentAdjacentTemperature : null
      });
    }
    if (internalWallSegments.length) {
      internalWallLength = internalWallSegments.reduce(function (sum, segment) {
        return sum + segment.length;
      }, 0);
      internalWallArea = internalWallSegments.reduce(function (sum, segment) {
        return sum + segment.length * height;
      }, 0);
      assumedInternalWall = false;
    }
    var windowType = stringValue('hl_' + key + '_window_type');
    var doorType = stringValue('hl_' + key + '_door_type');
    var floorType = stringValue('hl_' + key + '_floor_type');
    var loftType = stringValue('hl_' + key + '_loft_type');
    var ventilationMode = stringValue('hl_' + key + '_ventilation_mode') || 'Automatic';
    var manualAchText = stringValue('hl_' + key + '_manual_ach');
    var ventilationDevice = stringValue('hl_' + key + '_ventilation_device') ||
      'No additional vent or flue';
    var primaryWallU = mappedValue('externalWall', wallType);
    var alternativeWallU = mappedValue('externalWall', alternativeWallType);
    var wallU = wallLength > 0 && alternativeWallLength > 0 && alternativeWallU > 0
      ? ((wallLength - alternativeWallLength) * primaryWallU +
        alternativeWallLength * alternativeWallU) / wallLength
      : primaryWallU;
    var internalWallU = mappedValue('internalWall', internalWallType);
    var internalWallFactor = internalWallTemperatureFactor(internalWallType);
    var windowU = mappedValue('window', windowType);
    var doorU = mappedValue('door', doorType);
    var floorU = mappedValue('floor', floorType);
    var roofU = mappedValue('loft', loftType);
    var roofAdjacentTemperatureText = stringValue('hl_' + key + '_roof_adjacent_temp');
    var roofDeltaT = window.HeatLossCalculations.roofTemperatureDifference(
      indoor, outdoor, loftType === 'Heated room above'
        ? roofAdjacentTemperatureText : ''
    );
    var rooflightType = stringValue('hl_' + key + '_rooflight_type');
    var rooflightArea = rooflightType && rooflightType !== 'No rooflights'
      ? Math.max(0, numberValue('hl_' + key + '_rooflight_area', 0)) : 0;
    var rooflightU = mappedValue('window', rooflightType);
    var hasExternalEnvelope = wallLength > 0 || windowArea > 0 || doorArea > 0 ||
      rooflightArea > 0 || floorU > 0 || roofU > 0;
    var roomAgeBand = stringValue('hl_' + key + '_element_age_band');
    if (!roomAgeBand || roomAgeBand === 'Unknown') {
      roomAgeBand = stringValue('hl_property_age_band') || 'Unknown';
    }
    var ventilationAgeCategory = window.HeatLossCalculations.ventilationAgeCategory(
      stringValue('hl_ventilation_age_category') || roomAgeBand
    );
    var roomType = window.HeatLossCalculations.roomTypeForAirChange(roomName);
    var standardAch = window.HeatLossCalculations.minimumRoomAirChangeRate(
      roomName, ventilationAgeCategory, hasExternalEnvelope
    );
    var manualAch = Number(manualAchText);
    var manualAchValid = manualAchText !== '' && Number.isFinite(manualAch) && manualAch >= 0;
    var baseAch = ventilationMode === 'Manual override' && manualAchValid
      ? manualAch
      : standardAch;
    var ventilationSystem = stringValue('hl_ventilation_system') || 'Natural ventilation';
    var mvhrEfficiency = Math.max(0, Math.min(100,
      numberValue('hl_mvhr_efficiency', 75)));
    var heatRecoveryFactor = ventilationSystem ===
      'Mechanical ventilation with heat recovery (MVHR)'
      ? 1 - mvhrEfficiency / 100
      : 1;
    var baseVentilationFlowM3h = baseAch * volume;
    var recoveredVentilationFlowM3h = baseVentilationFlowM3h * heatRecoveryFactor;
    var deviceValue = ventilationDevice === 'Other open flue'
      ? 'Other heater flue'
      : ventilationDevice;
    var chimneyRestricted = stringValue('hl_' + key + '_chimney_restricted') === 'Yes';
    var chimneyAch = deviceValue === 'Open chimney'
      ? window.HeatLossCalculations.chimneyAirChangeRate(volume, chimneyRestricted)
      : 0;
    var deviceFlowM3h = chimneyAch > 0
      ? 0
      : mappedValue('ventilationDevice', deviceValue);
    var pivFlowM3h = ventilationSystem === 'Positive input ventilation (PIV)' &&
      Number(ventilationContext.propertyVolume) > 0
      ? 20 * volume / Number(ventilationContext.propertyVolume)
      : 0;
    var ventilationFlowM3h = recoveredVentilationFlowM3h + deviceFlowM3h +
      pivFlowM3h + chimneyAch * volume;
    var effectiveAch = volume > 0 ? ventilationFlowM3h / volume : 0;
    var missing = [];
    if (wallLength > 0 && !wallType) missing.push('external wall construction');
    if (alternativeWallLength > 0 && !alternativeWallType) {
      missing.push('alternative external wall construction');
    }
    if (numberedInternalWallMode && internalWallCount > 0) {
      if (mappedValue('internalWall', internalWallType) === 0) {
        missing.push('internal wall construction');
      }
      missing = missing.concat(internalWallMissing);
    } else if (internalWallSegments.length) {
      internalWallSegments.forEach(function (segment, index) {
        if (!segment.type || segment.u === 0) {
          missing.push('wall segment ' + (index + 1) + ' construction');
        }
      });
    } else if (internalWallLength > 0 && (!internalWallType || internalWallU === 0)) {
      missing.push('internal wall construction');
    }
    if (windowCount > 0 && !windowMeasurements.complete) missing.push('window dimensions');
    if (doorCount > 0 && !doorMeasurements.complete) missing.push('door dimensions');
    if (windowArea > 0 && (!windowType || windowU === 0)) missing.push('window construction');
    if (doorArea > 0 && (!doorType || doorU === 0)) missing.push('external door construction');
    if (rooflightArea > 0 && (!rooflightType || rooflightU === 0)) missing.push('rooflight construction');
    if (!floorType) missing.push('floor construction');
    if (!loftType) missing.push('ceiling or loft construction');
    if (!ventilationMode) missing.push('room air-change method');
    if (ventilationMode === 'Manual override' && !manualAchValid) {
      missing.push('manual air-change rate');
    }
    var complete = dimensionsComplete && missing.length === 0 && !openingsExceedWallArea;
    var adjacentKey = stringValue('hl_' + key + '_internal_adjacent_room');
    var adjacentName = allRoomNames().find(function (candidate) {
      return roomKeyFromName(candidate) === adjacentKey;
    }) || '';
    var adjacentIndoor = adjacentName
      ? numberValue('hl_' + adjacentKey + '_indoor_temp',
        targetTemperatureForAge(adjacentName, propertyAgeBand))
      : indoor;
    var adjacentSpace = stringValue('hl_' + key + '_internal_adjacent_space') || 'Standard';
    var adjacentTemperatureText = stringValue('hl_' + key + '_internal_adjacent_temp');
    var adjacentTemperatureKnown = adjacentTemperatureText !== '' &&
      Number.isFinite(Number(adjacentTemperatureText));
    var adjacentSpaceFactor = ADJACENT_SPACE_FACTORS[adjacentSpace];
    if (!Number.isFinite(adjacentSpaceFactor)) adjacentSpaceFactor = internalWallFactor;
    var internalDeltaT = 0;
    if (internalWallSegments.length) {
      internalDeltaT = internalWallSegments.reduce(function (sum, segment) {
        return sum + segment.deltaT * segment.length * height;
      }, 0) / Math.max(1, internalWallArea);
    } else if (isHeatedInternalWall(internalWallType)) {
      internalDeltaT = indoor - adjacentIndoor;
    } else if (String(internalWallType || '').indexOf('Unheated space') === 0) {
      internalDeltaT = adjacentTemperatureKnown
        ? indoor - Number(adjacentTemperatureText)
        : indoor - 10;
    }
    var floorAdjacentTemperatureText = stringValue('hl_' + key + '_floor_adjacent_temp');
    var floorDeltaT = floorTemperatureDifference(
      floorType,
      indoor,
      outdoor,
      numberValue('hl_ground_temp', 10),
      floorAdjacentTemperatureText
    );
    var bridgeMethod = stringValue('hl_bridge_method') || 'Percentage';
    var bridgeFactor = bridgeMethod === 'Age-based'
      ? THERMAL_BRIDGE_FACTORS[propertyAgeBand] || THERMAL_BRIDGE_FACTORS.Unknown
      : null;
    var bridgeArea = netWallArea + windowArea + doorArea +
      (floorU > 0 ? floorArea : 0) + (roofU > 0 ? floorArea : 0);
    var radiatorOutputsKw = [];
    for (var radiatorIndex = 1; radiatorIndex <= 2; radiatorIndex += 1) {
      var radiatorSuffix = radiatorIndex > 1 ? '_' + radiatorIndex : '';
      var customOutputText = stringValue('rad_' + key + '_ex_custom_kw' + radiatorSuffix);
      if (customOutputText !== '') radiatorOutputsKw.push(Number(customOutputText));
    }
    var validationIssues = window.SurveyValidation.validateRoomDetails({
      started: started,
      length: stringValue('rad_' + key + '_len'),
      width: stringValue('rad_' + key + '_wid'),
      height: stringValue('r_ceiling'),
      indoor: stringValue('hl_' + key + '_indoor_temp'),
      outdoor: stringValue('hl_outdoor_temp'),
      ground: stringValue('hl_ground_temp'),
      groundRequired: String(floorType || '').toLowerCase().indexOf('solid ground') >= 0,
      ventilationAch: effectiveAch,
      ventilationAchMaximum: 5 + chimneyAch,
      ventilationRequired: started,
      uValues: [
        { label: 'External wall', value: wallU, required: wallLength > 0 },
        { label: 'Internal wall', value: internalWallU, required: internalWallSegments.length === 0 && internalWallLength > 0 },
        { label: 'Window', value: windowU, required: windowArea > 0 },
        { label: 'Door', value: doorU, required: doorArea > 0 },
        { label: 'Floor', value: floorU, required: floorU > 0 },
        { label: 'Roof', value: roofU, required: roofU > 0 }
      ],
      radiatorOutputsKw: radiatorOutputsKw
    });
    complete = complete && window.SurveyValidation.canRecommendRadiator(validationIssues);
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
      roofDeltaT: roofDeltaT,
      rooflightArea: rooflightArea,
      rooflightU: rooflightU,
      internalSegments: internalWallSegments.length ? internalWallSegments.map(function (segment) {
        return { area: segment.length * height, u: segment.u, deltaT: segment.deltaT };
      }) : null,
      ach: effectiveAch,
      ventilationFlowM3h: ventilationFlowM3h,
      bridgePercent: bridgeMethod === 'Percentage' ? numberValue('hl_bridge_pct', 10) : 0,
      bridgeFactorWm2K: bridgeMethod === 'Age-based' ? bridgeFactor : null,
      bridgeArea: bridgeArea
    }) : computeHeatLossValues({});
    var unadjustedRoomWatts = heat.totalWatts;
    var roomFactors = window.HeatLossCalculations.applyAdditionalHeatLossFactors(
      unadjustedRoomWatts,
      {
        intermittent: numberValue('hl_reheat_factor', 1),
        exposed: numberValue('hl_exposed_location', 1),
        highCeiling: numberValue('hl_high_ceiling_factor', 1)
      }
    );
    heat.baseTotalWatts = unadjustedRoomWatts;
    heat.factorMultiplier = roomFactors.multiplier;
    heat.factorWatts = roomFactors.additionalWatts;
    heat.totalWatts = roomFactors.totalWatts;
    var radiatorFactor = radiatorOutputFactor(key);
    var radiatorConnection = stringValue('hl_radiator_connection') || 'BBOE';
    var radiatorRequirementWatts = window.HeatLossCalculations.radiatorSizingRequirement(
      heat.totalWatts, radiatorConnection
    );
    var warnings = validationIssues.map(function (issue) { return issue.message; });
    if (started && !dimensionsComplete) {
      warnings.push('Room length, width and ceiling height are required');
    }
    if (started && missing.length) {
      warnings.push('Select ' + missing.join(', '));
    }
    if (openingsExceedWallArea) {
      warnings.push('Window and door areas exceed the exposed wall area; correct the measurements before sizing a radiator');
    }
    if (manualWallExceedsRectangle) {
      warnings.push('Exposed wall length exceeds the simple rectangular perimeter; check this irregular-room measurement');
    }
    if (numberedInternalWallMode && internalWallSegments.length > 0 &&
        calculatedInternalWallLength > 0) {
      var enteredInternalWallTotal = internalWallSegments.reduce(function (sum, segment) {
        return sum + segment.length;
      }, 0);
      if (enteredInternalWallTotal < calculatedInternalWallLength - 0.01) {
        warnings.push(formatWallLength(calculatedInternalWallLength - enteredInternalWallTotal) +
          ' m of internal wall has not been entered. The remaining perimeter is ' +
          formatWallLength(calculatedInternalWallLength) +
          ' m, so add the missing walls or check the exposed wall length.');
      } else if (enteredInternalWallTotal > calculatedInternalWallLength + 0.01) {
        warnings.push('Entered internal walls total ' + formatWallLength(enteredInternalWallTotal) +
          ' m but only ' + formatWallLength(calculatedInternalWallLength) +
          ' m remains after the exposed wall. Check for double counting or an irregular room shape.');
      }
    }
    var radiatorOutcome = radiatorOutcomeForRoom(key);
    var existingRadiator = existingRadiatorForRoom(key, indoor, roomName);
    var usesExistingAssessment = radiatorOutcome === 'Assess existing radiator';
    var customerRefused = radiatorOutcome === 'Customer refused';
    var existingRadiatorAdequate = Boolean(
      complete && existingRadiator && existingRadiator.complete !== false &&
      existingRadiator.watts >= radiatorRequirementWatts
    );
    var currentRadiatorSelection = stringValue('rad_' + key + '_new_size');
    var replacesLikeForLike = radiatorOutcome === REPLACE_LIKE_FOR_LIKE_SELECTION;
    var newRadiatorDeclined = currentRadiatorSelection ===
      NO_NEW_RADIATOR_SELECTION;
    var radiator = complete && heat.totalWatts > 0 && !customerRefused &&
      !replacesLikeForLike && !(usesExistingAssessment && existingRadiatorAdequate)
      ? recommendStelradElite(radiatorRequirementWatts, indoor, currentRadiatorSelection, key,
        roomName)
      : null;
    var effectiveRadiator = customerRefused
      ? existingRadiator
      : newRadiatorDeclined
        ? existingRadiator
      : replacesLikeForLike
        ? existingRadiator
        : usesExistingAssessment && existingRadiatorAdequate
          ? existingRadiator
          : radiator && radiator.selected;
    if ((usesExistingAssessment || replacesLikeForLike) &&
        (!existingRadiator || existingRadiator.complete === false)) {
      warnings.push(existingRadiatorGuidance(key));
    }
    if (customerRefused && (!existingRadiator || existingRadiator.complete === false)) {
      warnings.push('Customer refused radiator work; select the existing radiator size to record its retained output');
    }
    if (customerRefused && existingRadiator && existingRadiator.watts < radiatorRequirementWatts) {
      warnings.push('Retained radiator output is below the calculated room requirement');
    }
    if (newRadiatorDeclined &&
        (!existingRadiator || existingRadiator.complete === false)) {
      warnings.push(existingRadiatorGuidance(key));
    }
    if (newRadiatorDeclined && existingRadiator &&
        existingRadiator.watts < radiatorRequirementWatts) {
      warnings.push('Existing radiator output is below the calculated room requirement');
    }
    if (usesExistingAssessment && complete && existingRadiator &&
        !existingRadiatorAdequate) {
      warnings.push('Existing radiator output is below the calculated room requirement');
    }
    if (replacesLikeForLike && complete && existingRadiator &&
        existingRadiator.watts < radiatorRequirementWatts) {
      warnings.push('Like-for-like replacement is below the calculated room requirement');
    }
    if (radiator && radiator.temperatureWarning) {
      warnings.push(radiator.flow <= radiator.returnTemperature
        ? 'Radiator flow temperature must be higher than return temperature'
        : 'Radiator ΔT is outside the supported 20°C to 65°C temperature range');
    }
    if (radiator && !radiator.temperatureWarning && !radiator.selected) {
      warnings.push(radiator.usesTwo
        ? 'No two-radiator combination meets the room requirement within the 50% oversize limit'
        : 'No single radiator option meets the room requirement within the 50% oversize limit');
    }
    var heatedInternalWatts = internalWallSegments.length
      ? internalWallSegments.reduce(function (sum, segment) {
        var isUnheatedBoundary = Number(segment.adjacentTemperature) === 10;
        if (!isHeatedInternalWall(segment.type) || isUnheatedBoundary) return sum;
        return sum + segment.length * height * segment.u * segment.deltaT;
      }, 0)
      : isHeatedInternalWall(internalWallType)
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
      perimeter: 2 * (length + width),
      enteredWallLength: enteredWallLength,
      wallLength: wallLength,
      assumedWall: assumedWall,
      alternativeWallLength: alternativeWallLength,
      alternativeWallType: alternativeWallType,
      alternativeWallU: alternativeWallU,
      calculatedInternalWallLength: calculatedInternalWallLength,
      internalWallLength: internalWallLength,
      internalWallCount: internalWallCount,
      assumedInternalWall: assumedInternalWall,
      windowArea: windowArea,
      windowCount: windowCount,
      doorArea: doorArea,
      doorCount: doorCount,
      wallType: wallType,
      internalWallType: internalWallType,
      internalWallSegments: internalWallSegments,
      internalWallFactor: internalWallFactor,
      internalDeltaT: internalDeltaT,
      adjacentRoomName: adjacentName,
      adjacentRoomKey: adjacentKey,
      adjacentIndoor: adjacentIndoor,
      adjacentSpace: adjacentSpace,
      adjacentSpaceFactor: adjacentSpaceFactor,
      adjacentTemperature: adjacentTemperatureKnown ? Number(adjacentTemperatureText) : null,
      windowType: windowType,
      measuredWindowArea: measuredWindowArea,
      doorType: doorType,
      measuredDoorArea: measuredDoorArea,
      floorType: floorType,
      floorExposedPerimeter: numberValue('hl_' + key + '_floor_exposed_perimeter', 0),
      floorAdjacentTemperature: floorAdjacentTemperatureText === ''
        ? null : Number(floorAdjacentTemperatureText),
      loftType: loftType,
      roofAdjacentTemperature: loftType !== 'Heated room above' ||
          roofAdjacentTemperatureText === ''
        ? null : Number(roofAdjacentTemperatureText),
      roofDeltaT: roofDeltaT,
      rooflightType: rooflightType,
      rooflightArea: rooflightArea,
      rooflightU: rooflightU,
      buildingPart: stringValue('hl_' + key + '_building_part') || 'Main dwelling',
      roomAgeBand: roomAgeBand,
      ventilationAgeCategory: ventilationAgeCategory,
      assumptionQuality: stringValue('hl_' + key + '_assumption_quality') || 'General default',
      ventilationMode: ventilationMode,
      manualAch: manualAchValid ? manualAch : null,
      ventilationDevice: ventilationDevice,
      ventilationSystem: ventilationSystem,
      mvhrEfficiency: mvhrEfficiency,
      hasExternalEnvelope: hasExternalEnvelope,
      roomType: roomType,
      standardAch: standardAch,
      baseAch: baseAch,
      propertyDesignAch: standardAch,
      baseVentilationFlowM3h: baseVentilationFlowM3h,
      deviceFlowM3h: deviceFlowM3h,
      pivFlowM3h: pivFlowM3h,
      chimneyAch: chimneyAch,
      chimneyRestricted: chimneyRestricted,
      ventilationFlowM3h: heat.ventilationFlowM3h,
      wallU: wallU,
      primaryWallU: primaryWallU,
      internalWallU: internalWallU,
      windowU: windowU,
      doorU: doorU,
      floorU: floorU,
      roofU: roofU,
      ach: effectiveAch,
      floorDeltaT: floorDeltaT,
      bridgeMethod: bridgeMethod,
      bridgeFactor: bridgeFactor,
      bridgeArea: bridgeArea,
      bridgeWatts: heat.bridgeWatts,
      internalWallWatts: heat.internalWallWatts,
      fabricWatts: heat.fabricWatts,
      ventilationWatts: heat.ventilationWatts,
      baseTotalWatts: heat.baseTotalWatts,
      factorMultiplier: heat.factorMultiplier,
      factorWatts: heat.factorWatts,
      totalWatts: heat.totalWatts,
      radiatorConnection: radiatorConnection,
      radiatorConnectionOutputFactor: radiatorConnectionOutputFactor(),
      radiatorOutputFactor: radiatorFactor,
      radiatorRequirementWatts: radiatorRequirementWatts,
      sharedRadiatorHostKey: '',
      sharedRadiatorHostName: '',
      sharedRadiatorRoomNames: [],
      propertyWatts: Math.max(0, heat.totalWatts - heatedInternalWatts),
      wattsPerSquareMetre: floorArea > 0 ? heat.totalWatts / floorArea : 0,
      radiatorOutcome: radiatorOutcome,
      customerRefused: customerRefused,
      replacesLikeForLike: replacesLikeForLike,
      newRadiatorDeclined: newRadiatorDeclined,
      existingRadiator: existingRadiator,
      existingRadiatorAdequate: existingRadiatorAdequate,
      effectiveRadiator: effectiveRadiator,
      radiator: radiator,
      warnings: warnings
    };
  }

  function setRadiatorFieldLabel(key, suffix, text) {
    var field = document.getElementById('rad_' + key + '_' + suffix);
    if (!field) return;
    var label = document.querySelector('label[for="' + field.id + '"]');
    if (label) label.textContent = text;
  }

  function updateRadiatorRequirementDisplay(result) {
    var display = document.getElementById('hl_' + result.key + '_radiator_requirement');
    if (!display) return;
    if (!result.complete) {
      display.textContent = result.started
        ? 'Required radiator output: complete the room details to calculate.'
        : 'Required radiator output: enter the room length and width to calculate.';
      display.dataset.state = 'incomplete';
      return;
    }
    var watts = Math.max(0, Number(result.radiatorRequirementWatts) || 0);
    display.textContent = 'Required radiator output: ' + (watts / 1000).toFixed(2) +
      ' kW (' + Math.round(watts) + ' W)';
    display.dataset.state = 'complete';
  }

  function clearCalculatedRadiatorFields(key) {
    ['kw', 'new_size', 'new_size_2', 'output'].forEach(function (suffix) {
      var field = document.getElementById('rad_' + key + '_' + suffix);
      if (!field) return;
      field.value = '';
      if (suffix === 'kw') {
        field.placeholder = 'Complete heat loss details';
        field.title = 'Complete the highlighted heat-loss details before the required radiator output can be calculated.';
      }
      if ((suffix === 'new_size' || suffix === 'new_size_2') &&
          field.tagName === 'SELECT') {
        field.innerHTML = '<option value="">Complete the room heat loss first</option>';
        field.disabled = true;
      }
      field.readOnly = true;
      if (suffix !== 'kw') field.removeAttribute('title');
    });
    var secondWrap = document.getElementById('hl_' + key + '_second_radiator_wrap');
    if (secondWrap) secondWrap.hidden = true;
  }

  function radiatorOptionLabel(option, requiredWatts, individual) {
    var label = option.size + ' | ' + (option.watts / 1000).toFixed(2) + ' kW';
    if (option.minimumSizeFallback) label += ' | minimum size';
    if (!individual) {
      label += ' | +' + Math.round(Math.max(0, option.watts - requiredWatts)) + ' W';
    }
    return label;
  }

  function populateRadiatorSelect(field, options, selectedSize, placeholderText,
    requiredWatts, individual, includeNoneOption, noneOptionLabel) {
    field.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = placeholderText;
    field.appendChild(placeholder);
    if (includeNoneOption) {
      var noneChoice = document.createElement('option');
      noneChoice.value = NO_NEW_RADIATOR_SELECTION;
      noneChoice.textContent = noneOptionLabel ||
        'Keep existing radiator | use Existing Size output';
      field.appendChild(noneChoice);
    }
    var groups = {};
    (options || []).forEach(function (option) {
      if (!groups[option.height]) {
        groups[option.height] = document.createElement('optgroup');
        groups[option.height].label = option.height + 'mm high';
        field.appendChild(groups[option.height]);
      }
      var choice = document.createElement('option');
      choice.value = option.size;
      choice.textContent = radiatorOptionLabel(option, requiredWatts, individual);
      choice.dataset.watts = option.watts.toFixed(2);
      groups[option.height].appendChild(choice);
    });
    if (selectedSize && (selectedSize === NO_NEW_RADIATOR_SELECTION ||
        (options || []).some(function (option) {
          return option.size === selectedSize;
        }))) {
      field.value = selectedSize;
    }
  }

  function configureExistingRadiatorField(result, index) {
    var suffix = index > 1 ? '_' + index : '';
    var field = document.getElementById('rad_' + result.key + '_ex_size' + suffix);
    var customOutputField = document.getElementById('rad_' + result.key +
      '_ex_custom_kw' + suffix);
    var customOutputWrap = document.getElementById('rad_' + result.key +
      '_ex_custom_kw_wrap' + suffix);
    var locationField = document.getElementById('rad_' + result.key +
      '_ex_loc' + suffix);
    if (!field) return null;
    var existingValue = field.value;
    if (field.tagName !== 'SELECT') {
      var select = document.createElement('select');
      select.id = field.id;
      select.dataset.id = field.dataset.id;
      select.className = field.className;
      select.setAttribute('aria-label', result.roomName + ' - Existing Size' +
        (index > 1 ? ' ' + index : ''));
      field.replaceWith(select);
      field = select;
    }
    if (field.dataset.existingRadiatorWired !== 'yes') {
      field.dataset.existingRadiatorWired = 'yes';
      field.addEventListener('change', function () {
        var customSelected = field.value === CUSTOM_EXISTING_RADIATOR_SELECTION;
        if (customOutputWrap) customOutputWrap.hidden = !customSelected;
        if (customOutputField) {
          customOutputField.disabled = !customSelected;
          customOutputField.required = customSelected;
        }
        if (typeof update === 'function') update();
        persistCombinedData();
      });
    }
    if (locationField && locationField.dataset.existingRadiatorWired !== 'yes') {
      locationField.dataset.existingRadiatorWired = 'yes';
      locationField.addEventListener('input', persistCombinedData);
      locationField.addEventListener('change', persistCombinedData);
    }
    var flow = Number(stringValue('hl_radiator_temperature')) || 75;
    var returnTemperature = flow - 10;
    var deltaT = (flow + returnTemperature) / 2 - result.indoor;
    var correctionFactor = stelradCorrectionFactor(deltaT);
    var options = deltaT >= 20 && deltaT <= 65
      ? stelradIndividualOptions(correctionFactor, {}, result.roomName, deltaT, false)
      : [];
    field.innerHTML = '<option value="">Select existing radiator size</option>';
    var groups = {};
    options.forEach(function (option) {
      var groupKey = option.height + '-' + option.type;
      if (!groups[groupKey]) {
        groups[groupKey] = document.createElement('optgroup');
        groups[groupKey].label = option.height + 'mm high, ' + option.type;
        field.appendChild(groups[groupKey]);
      }
      var choice = document.createElement('option');
      choice.value = option.size;
      choice.textContent = option.size + ' | ' +
        (option.watts / 1000).toFixed(2) + ' kW';
      choice.dataset.watts = option.watts.toFixed(2);
      groups[groupKey].appendChild(choice);
    });
    var customChoice = document.createElement('option');
    customChoice.value = CUSTOM_EXISTING_RADIATOR_SELECTION;
    customChoice.textContent = 'Custom radiator or towel rail | enter kW';
    field.appendChild(customChoice);
    if (existingValue && options.some(function (option) {
      return option.size === existingValue;
    }) || existingValue === CUSTOM_EXISTING_RADIATOR_SELECTION) {
      field.value = existingValue;
    } else if (existingValue) {
      var legacy = document.createElement('option');
      legacy.value = existingValue;
      legacy.textContent = existingValue + ' | unrecognised size';
      field.insertBefore(legacy, field.children[1] || null);
      field.value = existingValue;
    }
    var customSelected = field.value === CUSTOM_EXISTING_RADIATOR_SELECTION;
    if (customOutputWrap) customOutputWrap.hidden = !customSelected;
    if (customOutputField) {
      if (customOutputField.dataset.existingRadiatorWired !== 'yes') {
        customOutputField.dataset.existingRadiatorWired = 'yes';
        customOutputField.addEventListener('input', function () {
          if (typeof update === 'function') update();
          persistCombinedData();
        });
        customOutputField.addEventListener('change', function () {
          if (typeof update === 'function') update();
          persistCombinedData();
        });
      }
      customOutputField.disabled = !customSelected;
      customOutputField.required = customSelected;
      customOutputField.title = customSelected
        ? 'Required. Enter the output of one radiator or towel rail in kW at the selected design temperature.'
        : '';
    }
    field.title = 'Select the installed radiator size, or choose Custom radiator or towel rail and enter its output in kW.';
    return field;
  }

  function configureExistingRadiatorSelect(result) {
    var existingFieldsWrap = document.getElementById('hl_' + result.key +
      '_existing_radiator_fields');
    if (existingFieldsWrap) {
      existingFieldsWrap.hidden = result.radiatorOutcome === 'New radiator required';
    }
    var quantityField = document.getElementById('rad_' + result.key +
      '_ex_quantity');
    var newQuantityField = document.getElementById('hl_' + result.key +
      '_rad_quantity');
    var quantity = Math.max(1, Math.min(2,
      Math.round(numberValue('rad_' + result.key + '_ex_quantity', 1)) || 1));
    var firstField = null;
    for (var index = 1; index <= 2; index += 1) {
      var wrap = document.getElementById('rad_' + result.key +
        '_ex_radiator_' + index + '_wrap');
      if (wrap) wrap.hidden = index > quantity;
      var field = configureExistingRadiatorField(result, index);
      if (index === 1) firstField = field;
    }
    if (quantityField && quantityField.dataset.existingRadiatorWired !== 'yes') {
      quantityField.dataset.existingRadiatorWired = 'yes';
      quantityField.addEventListener('change', function () {
        if (newQuantityField &&
            newQuantityField.dataset.existingQuantityLinked !== 'no') {
          newQuantityField.value = String(Math.max(1, Math.min(2,
            Math.round(numberValue('rad_' + result.key + '_ex_quantity', 1)) || 1)));
        }
        if (typeof update === 'function') update();
        persistCombinedData();
      });
      quantityField.title = 'Defaults to one. Select the quantity to record each existing radiator separately.';
    }
    if (newQuantityField &&
        newQuantityField.dataset.existingQuantityLinked !== 'yes' &&
        newQuantityField.dataset.existingQuantityLinked !== 'no') {
      newQuantityField.dataset.existingQuantityLinked = 'yes';
      newQuantityField.addEventListener('change', function () {
        newQuantityField.dataset.existingQuantityLinked = 'no';
      });
    }
    return firstField;
  }

  function setSingleRadiatorChoice(field, value, label) {
    if (!field) return;
    field.innerHTML = '';
    var choice = document.createElement('option');
    choice.value = value;
    choice.textContent = label;
    field.appendChild(choice);
    field.value = value;
  }

  function configureRadiatorSelect(result) {
    var field = document.getElementById('rad_' + result.key + '_new_size');
    if (!field) return null;
    configureExistingRadiatorSelect(result);
    var existingFieldsWrap = document.getElementById('hl_' + result.key +
      '_existing_radiator_fields');
    if (existingFieldsWrap) {
      existingFieldsWrap.hidden = result.radiatorOutcome === 'New radiator required';
    }
    var existingValue = field.value;
    if (field.tagName !== 'SELECT') {
      var select = document.createElement('select');
      select.id = field.id;
      select.dataset.id = field.dataset.id;
      select.className = field.className;
      select.setAttribute('aria-label', result.roomName + ' - Replacement radiator');
      field.replaceWith(select);
      field = select;
    }
    field.disabled = false;
    var secondField = document.getElementById('rad_' + result.key + '_new_size_2');
    var secondWrap = document.getElementById('hl_' + result.key + '_second_radiator_wrap');
    if (field.dataset.stelradWired !== 'yes') {
      field.dataset.stelradWired = 'yes';
      field.addEventListener('change', function () {
        if (typeof update === 'function') update();
        persistCombinedData();
      });
    }
    if (secondField && secondField.dataset.stelradWired !== 'yes') {
      secondField.dataset.stelradWired = 'yes';
      secondField.addEventListener('change', function () {
        if (typeof update === 'function') update();
        persistCombinedData();
      });
    }

    var radiator = result.radiator;
    var usesTwo = radiator && radiator.usesTwo && !result.newRadiatorDeclined;
    if (result.sharedRadiatorHostName) {
      setSingleRadiatorChoice(field, 'Shared radiator',
        'Supplied by ' + result.sharedRadiatorHostName + ' radiator');
      setRadiatorFieldLabel(result.key, 'new_size', result.roomName + ' - Replacement radiator');
      field.title = result.roomName + ' heat loss is included in the radiator selected for ' +
        result.sharedRadiatorHostName + '.';
      if (secondWrap) secondWrap.hidden = true;
      if (secondField) secondField.value = '';
      return { first: field, second: secondField };
    }
    if (result.customerRefused) {
      setSingleRadiatorChoice(field, 'Refused', 'Refused');
      setRadiatorFieldLabel(result.key, 'new_size', result.roomName + ' - Replacement radiator');
      field.title = 'The customer refused radiator work for this room.';
      if (secondWrap) secondWrap.hidden = true;
      if (secondField) secondField.value = '';
      return { first: field, second: secondField };
    }
    if (result.replacesLikeForLike) {
      setSingleRadiatorChoice(field, REPLACE_LIKE_FOR_LIKE_SELECTION,
        'Replace existing radiator like for like');
      setRadiatorFieldLabel(result.key, 'new_size', result.roomName + ' - Replacement radiator');
      field.title = 'Like-for-like was selected in Radiator outcome. Record the installed radiator size above.';
      if (secondWrap) secondWrap.hidden = true;
      if (secondField) secondField.value = '';
      return { first: field, second: secondField };
    }
    if (result.radiatorOutcome === 'Assess existing radiator' &&
        result.existingRadiatorAdequate) {
      field.innerHTML = '';
      var keepExistingChoice = document.createElement('option');
      keepExistingChoice.value = 'No new radiator required';
      keepExistingChoice.textContent = 'Existing radiator is adequate, no replacement required';
      field.appendChild(keepExistingChoice);
      field.value = 'No new radiator required';
      setRadiatorFieldLabel(result.key, 'new_size', result.roomName + ' - Replacement radiator');
      field.title = 'The selected existing radiator meets the calculated room requirement. Choose a different Radiator outcome if it must be replaced.';
      if (secondWrap) secondWrap.hidden = true;
      if (secondField) secondField.value = '';
      return { first: field, second: secondField };
    }
    var warningPlaceholder = radiator && radiator.temperatureWarning
      ? 'Review the radiator design temperature'
      : 'Choose a suitable radiator';
    populateRadiatorSelect(
      field,
      radiator ? radiator.options : [],
      result.newRadiatorDeclined
        ? NO_NEW_RADIATOR_SELECTION
        : radiator && radiator.selectedFirst ? radiator.selectedFirst.size : existingValue,
      result.totalWatts <= 0 ? 'No radiator output required' :
        (usesTwo ? 'Choose radiator 1' : warningPlaceholder),
      result.totalWatts,
      Boolean(usesTwo),
      true,
      result.newRadiatorDeclined && result.existingRadiator &&
        !result.existingRadiatorAdequate
        ? 'Radiator refused, undersized | use Existing Size output'
        : 'Keep existing radiator | use Existing Size output'
    );
    setRadiatorFieldLabel(result.key, 'new_size', result.roomName +
      (usesTwo ? ' - Radiator 1' : ' - Replacement radiator'));
    field.setAttribute('aria-label', result.roomName +
      (usesTwo ? ' - Radiator 1' : ' - Replacement radiator'));
    if (secondField) {
      if (secondWrap) secondWrap.hidden = !usesTwo;
      if (usesTwo) {
        populateRadiatorSelect(
          secondField,
          radiator.secondOptions,
          radiator.selectedSecond ? radiator.selectedSecond.size : secondField.value,
          radiator.temperatureWarning ? 'Review the radiator design temperature' :
            'Choose radiator 2',
          result.totalWatts,
          true
        );
        delete secondField.dataset.restoredValue;
        secondField.setAttribute('aria-label', result.roomName + ' - Radiator 2');
      } else {
        secondField.value = '';
        delete secondField.dataset.restoredValue;
      }
    }
    field.title = 'Suitable Stelrad Elite and Myson fan-convector options at the selected design temperature. ' +
      'Choose another size, position or panel type where required.';
    return { first: field, second: secondField };
  }

  function formatWallLength(length) {
    return Math.max(0, Number(length) || 0).toFixed(2).replace(/\.00$/, '');
  }

  function renderRoomGeometry(result) {
    var geometry = document.getElementById('hl_' + result.key + '_geometry');
    var internalSection = document.getElementById('hl_' + result.key + '_internal_wall');
    var internalHelp = document.getElementById('hl_' + result.key + '_internal_wall_help');
    var internalCountField = document.getElementById(
      'hl_' + result.key + '_internal_wall_count');
    var hasDimensions = result.length > 0 && result.width > 0;
    if (geometry) {
      if (!hasDimensions) {
        geometry.textContent = 'Enter the room length and width to see its wall geometry.';
      } else if (result.enteredWallLength > 0) {
        geometry.innerHTML = '<span>Room perimeter <strong>' +
          formatWallLength(result.perimeter) + ' m</strong></span><span>Exposed <strong>' +
          formatWallLength(result.enteredWallLength) + ' m</strong></span><span>Internal <strong>' +
          formatWallLength(result.calculatedInternalWallLength) + ' m</strong></span>';
      } else if (result.wallLength > 0) {
        geometry.innerHTML = '<span>Room perimeter <strong>' +
          formatWallLength(result.perimeter) + ' m</strong></span><span>Exposed estimate <strong>' +
          formatWallLength(result.wallLength) + ' m</strong></span><span>Enter an exposed-wall measurement to calculate the remaining internal walls.</span>';
      } else {
        geometry.innerHTML = '<span>Room perimeter <strong>' +
          formatWallLength(result.perimeter) + ' m</strong></span><span>Enter an exposed-wall measurement to calculate the remaining internal walls.</span>';
      }
    }
    if (internalSection) internalSection.hidden = !hasDimensions;
    if (internalCountField) {
      if (!internalCountField.dataset.hlCountWired) {
        internalCountField.dataset.hlCountWired = 'yes';
        internalCountField.dataset.hlCountManual = internalCountField.value === '' ? 'no' : 'yes';
        internalCountField.addEventListener('change', function () {
          internalCountField.dataset.hlCountManual = 'yes';
        }, true);
      }
      if (internalCountField.dataset.hlCountManual !== 'yes') {
        internalCountField.value = String(result.internalWallCount);
      }
    }
    if (internalHelp && hasDimensions) {
      internalHelp.textContent = formatWallLength(result.calculatedInternalWallLength) +
        ' m is the remaining perimeter after the exposed wall. Enter each internal wall separately.';
    }
    for (var wallIndex = 1; wallIndex <= 4; wallIndex += 1) {
      var wallWrap = document.getElementById('hl_' + result.key +
        '_internal_segment_' + wallIndex + '_wrap');
      if (wallWrap) wallWrap.hidden = wallIndex > result.internalWallCount;
    }
    refreshOpeningMeasurementFields(result.key, 'window', 3);
    refreshOpeningMeasurementFields(result.key, 'door', 2);
  }

  function refreshOpeningMeasurementFields(key, opening, maximumCount) {
    var type = stringValue('hl_' + key + '_' + opening + '_type');
    var hasOpening = Boolean(type) && (opening === 'window'
      ? type !== 'No windows'
      : type !== 'No external door');
    var count = Math.max(0, Math.min(maximumCount, Math.round(numberValue(
      'hl_' + key + '_' + opening + '_count', 0))));
    var countWrap = document.getElementById('hl_' + key + '_' + opening +
      '_count_wrap');
    if (countWrap) countWrap.hidden = !hasOpening;
    var group = document.getElementById('hl_' + key + '_' + opening +
      '_measurements_wrap');
    if (group) group.hidden = !hasOpening || count === 0;
    for (var index = 1; index <= maximumCount; index += 1) {
      var wrapper = document.getElementById('hl_' + key + '_' + opening + '_' +
        index + '_wrap');
      if (wrapper) wrapper.hidden = !hasOpening || index > count;
    }
  }

  function sharedRadiatorRequirementDescription(result) {
    var rawWatts = Math.max(0, Number(result.sharedRadiatorRawCombinedWatts) || 0);
    var adjustmentWatts = Math.max(0,
      Number(result.sharedRadiatorTransferAdjustmentWatts) || 0);
    var requirementWatts = Math.max(0, Number(result.radiatorRequirementWatts) || 0);
    var description = 'Combined room heat loss: ' + Math.round(rawWatts) + ' W (' +
      (rawWatts / 1000).toFixed(2) + ' kW).';
    if (adjustmentWatts > 0.5) {
      description += ' Heated internal-wall transfer adjustment: minus ' +
        Math.round(adjustmentWatts) + ' W.';
    } else {
      description += ' No heated internal-wall transfer adjustment.';
    }
    return description + ' Radiator sizing requirement: ' + Math.round(requirementWatts) +
      ' W (' + (requirementWatts / 1000).toFixed(2) + ' kW).';
  }

  function renderRoomResult(result) {
    renderRoomGeometry(result);
    updateRadiatorRequirementDisplay(result);
    var resultBox = document.getElementById('hl_' + result.key + '_result');
    var summary = document.getElementById('hl_' + result.key + '_summary');
    var radKw = document.getElementById('rad_' + result.key + '_kw');
    var radOutput = document.getElementById('rad_' + result.key + '_output');
    if (result.customerRefused) {
      configureRadiatorSelect(result);
      if (radKw) {
        radKw.value = result.complete
          ? (result.radiatorRequirementWatts / 1000).toFixed(2)
          : '';
        radKw.placeholder = result.complete ? '' : 'Complete heat loss details';
        radKw.readOnly = true;
      }
      if (radOutput) {
        radOutput.value = result.existingRadiator
          ? (result.existingRadiator.watts / 1000).toFixed(2)
          : (result.complete ? '0.00' : '');
        radOutput.readOnly = true;
        radOutput.title = result.existingRadiator
          ? existingRadiatorOutputDescription(result.existingRadiator)
          : 'No existing radiator output has been recorded.';
      }
      if (summary) summary.textContent = 'Refused';
      if (resultBox) {
        resultBox.innerHTML =
          '<div class="hl-result-main"><strong>Refused</strong></div>' +
          '<div class="hl-result-breakdown">Customer refused radiator work for this room. ' +
          (result.existingRadiator
            ? 'The retained radiator output is included in the total.'
            : 'Record the existing radiator size to include its retained output.') +
          '</div>' +
          (result.warnings.length
            ? '<div class="hl-warning">' + escapeHtml(result.warnings.join('. ')) + '</div>'
            : '');
      }
      return;
    }
    configureExistingRadiatorSelect(result);
    if (result.replacesLikeForLike && !result.complete) {
      configureRadiatorSelect(result);
      if (radKw) {
        radKw.value = '';
        radKw.placeholder = 'Complete heat loss details';
        radKw.readOnly = true;
      }
      if (radOutput) {
        radOutput.value = result.existingRadiator
          ? (result.existingRadiator.watts / 1000).toFixed(2)
          : '';
        radOutput.readOnly = true;
        radOutput.title = existingRadiatorOutputDescription(result.existingRadiator);
      }
      if (summary) {
        summary.textContent = result.existingRadiator
          ? 'Replace like for like'
          : 'Select existing size';
      }
      if (resultBox) {
        resultBox.innerHTML =
          '<div class="hl-result-main"><strong>Like-for-like replacement</strong></div>' +
          '<div class="hl-result-breakdown">' +
          (result.existingRadiator
            ? escapeHtml(result.existingRadiator.size) + ' selected. The replacement can be recorded without completing the room heat loss.'
            : 'Select the installed height, width and panel type in Existing Size.') +
          '</div>';
      }
      return;
    }
    if (result.radiatorOutcome === 'Assess existing radiator' &&
        result.existingRadiator && !result.complete) {
      var incompleteRadiatorFields = configureRadiatorSelect(result);
      if (incompleteRadiatorFields && incompleteRadiatorFields.first) {
        setSingleRadiatorChoice(incompleteRadiatorFields.first, '',
          'Complete heat loss details to assess this radiator');
        incompleteRadiatorFields.first.disabled = true;
        incompleteRadiatorFields.first.title =
          'Complete the missing heat-loss details before choosing a replacement radiator.';
      }
      if (radKw) {
        radKw.value = '';
        radKw.placeholder = 'Complete heat loss details';
        radKw.title = result.warnings.join('. ');
        radKw.readOnly = true;
      }
      if (radOutput) {
        radOutput.value = (result.existingRadiator.watts / 1000).toFixed(2);
        radOutput.readOnly = true;
        radOutput.title = existingRadiatorOutputDescription(result.existingRadiator);
      }
      if (summary) summary.textContent = 'Incomplete heat loss';
      if (resultBox) {
        resultBox.innerHTML =
          '<div class="hl-result-main"><strong>Complete the heat-loss details</strong></div>' +
          '<div class="hl-result-breakdown">Existing radiator ' +
          escapeHtml(result.existingRadiator.size) + ' recorded at ' +
          (result.existingRadiator.watts / 1000).toFixed(2) +
          ' kW. Its suitability cannot be assessed until the room requirement is calculated.</div>' +
          '<div class="hl-warning">' + escapeHtml(result.warnings.join('. ')) + '</div>';
      }
      return;
    }
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
    var roomKw = result.totalWatts / 1000;
    var sharedRadiatorDisplay = window.RadiatorSizing.sharedRadiatorDisplay({
      roomWatts: result.totalWatts,
      radiatorRequirementWatts: result.radiatorRequirementWatts,
      suppliedRoomNames: result.sharedRadiatorRoomNames,
      suppliedByRoomName: result.sharedRadiatorHostName
    });
    if (radKw) {
      var displayedRequirementWatts = sharedRadiatorDisplay.suppliedByRoomName
        ? sharedRadiatorDisplay.individualRequirementWatts
        : sharedRadiatorDisplay.radiatorSizingRequirementWatts;
      radKw.value = (displayedRequirementWatts / 1000).toFixed(2);
      radKw.placeholder = '';
      radKw.readOnly = true;
      radKw.title = sharedRadiatorDisplay.suppliedByRoomName
        ? 'Individual room heat loss. This room is supplied by the radiator selected for ' +
          sharedRadiatorDisplay.suppliedByRoomName + '.'
        : sharedRadiatorDisplay.suppliedRoomNames.length
          ? sharedRadiatorRequirementDescription(result)
          : 'Required emitter output after the selected radiator connection allowance.';
    }
    var radiatorFields = configureRadiatorSelect(result);
    if (result.effectiveRadiator) {
      if (radOutput) {
        radOutput.value = (result.effectiveRadiator.watts / 1000).toFixed(2);
        radOutput.readOnly = true;
        radOutput.title = result.newRadiatorDeclined
          ? existingRadiatorOutputDescription(result.existingRadiator)
          : result.radiatorOutcome === 'New radiator required'
          ? 'Temperature-corrected Stelrad output.'
          : 'Temperature-corrected output of the selected existing-size radiator.';
      }
    } else {
      if (!result.sharedRadiatorHostName && !result.newRadiatorDeclined &&
          result.radiatorOutcome !== 'Replace existing radiator like for like') {
        if (radiatorFields && radiatorFields.first) radiatorFields.first.value = '';
        if (radiatorFields && radiatorFields.second) radiatorFields.second.value = '';
      }
      if (radOutput) {
        radOutput.value = result.newRadiatorDeclined ? '0.00' : '';
        radOutput.readOnly = true;
        radOutput.title = result.newRadiatorDeclined
          ? 'No new radiator selected at the customer’s request.'
          : '';
      }
    }
    var radiatorHtml = '';
    if (result.sharedRadiatorHostName) {
      radiatorHtml = '<div class="hl-radiator-result"><b>Shared radiator:</b> ' +
        'This room is supplied by the radiator selected for ' +
        escapeHtml(result.sharedRadiatorHostName) + '.</div>';
    } else if (result.sharedRadiatorRoomNames.length) {
      radiatorHtml = '<div class="hl-radiator-result"><b>Shared radiator:</b> ' +
        'This radiator also supplies ' +
        escapeHtml(result.sharedRadiatorRoomNames.join(' and ')) +
        '. ' + sharedRadiatorRequirementDescription(result) + '</div>';
    }
    if (result.radiatorOutcome === 'Assess existing radiator') {
      radiatorHtml += '<div class="hl-radiator-result"><b>Existing radiator:</b> ' +
        (result.existingRadiator
          ? escapeHtml(result.existingRadiator.size) + ' gives ' +
            (result.existingRadiator.watts / 1000).toFixed(2) + ' kW. ' +
            (result.existingRadiatorAdequate
              ? '<strong>No new radiator is required.</strong>'
              : 'It is below the room requirement, so a new size is shown above.')
          : 'Select the installed height, width and panel type in Existing Size.') +
        '</div>';
    } else if (result.radiatorOutcome === 'Replace existing radiator like for like') {
      radiatorHtml += '<div class="hl-radiator-result"><b>Like-for-like replacement:</b> ' +
        (result.existingRadiator
          ? escapeHtml(result.existingRadiator.size) + ' gives ' +
            (result.existingRadiator.watts / 1000).toFixed(2) +
            ' kW at the selected design temperature.'
          : 'Select the installed height, width and panel type in Existing Size.') +
        '</div>';
    } else if (result.newRadiatorDeclined) {
      radiatorHtml += '<div class="hl-radiator-result"><b>' +
        (result.existingRadiator && !result.existingRadiatorAdequate
          ? 'Radiator refused, undersized:'
          : 'Existing radiator retained:') + '</b> ' +
        (result.existingRadiator
          ? escapeHtml(result.existingRadiator.size) + ' gives ' +
            (result.existingRadiator.watts / 1000).toFixed(2) +
            ' kW at the selected design temperature.'
          : 'Select the installed height, width and panel type in Existing Size to record its output.') +
        '</div>';
    } else if (result.radiator) {
      var selectedIsMyson = result.radiator.selected &&
        (result.radiator.selected.manufacturer === 'Myson' ||
          result.radiator.selectedFirst &&
            result.radiator.selectedFirst.manufacturer === 'Myson');
      radiatorHtml += '<div class="hl-radiator-result"><b>' +
        (selectedIsMyson ? 'Myson fan convector' : 'Stelrad Elite') + ' at ' +
        result.radiator.flow.toFixed(0) + '/' +
        result.radiator.returnTemperature.toFixed(0) + '°C:</b> ' +
        (result.radiator.temperatureWarning
          ? 'Enter valid temperatures with a ΔT from 20°C to 65°C.'
          : result.radiator.selected
            ? result.radiator.usesTwo
              ? result.radiator.selectedFirst.size + ' plus ' +
                result.radiator.selectedSecond.size + ' gives ' +
                (result.radiator.selected.watts / 1000).toFixed(2) +
                ' kW combined. ' + result.radiator.pairCount +
                ' valid combinations meet the 50% oversize limit.'
              : result.radiator.selected.size + ' gives ' +
                (result.radiator.selected.watts / 1000).toFixed(2) + ' kW. ' +
                result.radiator.options.length + ' suitable size' +
                (result.radiator.options.length === 1 ? '' : 's') +
                ' within the 50% oversize limit ' +
                (result.radiator.options.length === 1 ? 'is' : 'are') +
                ' available in the New Size dropdown.'
            : result.radiator.usesTwo
              ? 'No two-radiator combination meets the room requirement within the 50% oversize limit.'
              : 'No single radiator option meets the room requirement within the 50% oversize limit.') +
        (result.radiator.temperatureWarning ? '' :
          '<small>Output adjusted for the selected design temperature at ΔT' +
          result.radiator.deltaT.toFixed(1) + '.</small>') +
        '</div>';
    }
    if (summary) {
      summary.textContent = result.existingRadiatorAdequate
        ? 'Existing radiator adequate'
        : Math.round(result.totalWatts) + ' W';
    }
    if (resultBox) {
      var ventilationDetails = result.baseAch.toFixed(2) + ' ACH base';
      if (result.ventilationSystem === 'Mechanical ventilation with heat recovery (MVHR)') {
        ventilationDetails += ', ' + result.mvhrEfficiency.toFixed(0) + '% heat recovery';
      }
      if (result.deviceFlowM3h > 0) {
        ventilationDetails += ', +' + result.deviceFlowM3h.toFixed(0) + ' m³/h ' +
          result.ventilationDevice.toLowerCase();
      }
      if (result.pivFlowM3h > 0) {
        ventilationDetails += ', +' + result.pivFlowM3h.toFixed(1) + ' m³/h PIV share';
      }
      if (result.chimneyAch > 0) {
        ventilationDetails += ', +' + result.chimneyAch.toFixed(1) + ' ACH open chimney' +
          (result.chimneyRestricted ? ' with restrictor' : ' without restrictor');
      }
      var factorDetails = result.factorMultiplier !== 1
        ? ' &nbsp; Design allowances: ×' + result.factorMultiplier.toFixed(2) +
          ' (' + (result.factorWatts >= 0 ? '+' : '') + Math.round(result.factorWatts) + ' W)'
        : '';
      var gainDetails = result.internalWallWatts < 0
        ? ' &nbsp; Internal-wall gain: ' + Math.round(result.internalWallWatts) + ' W'
        : '';
      var radiatorFactorDetails = result.radiatorOutputFactor !== 1
        ? ' &nbsp; Installation/finish output factor: ×' +
          result.radiatorOutputFactor.toFixed(2)
        : '';
      var connectionFactorDetails = result.radiatorConnectionOutputFactor !== 1
        ? ' &nbsp; ' + escapeHtml(result.radiatorConnection) +
          ' output factor: ×' + result.radiatorConnectionOutputFactor.toFixed(2)
        : '';
      resultBox.innerHTML =
        '<div class="hl-result-main"><strong>' + Math.round(result.totalWatts) +
        ' W</strong> (' + roomKw.toFixed(2) + ' kW)' +
        (result.assumedWall ? '<span class="hl-assumption">wall length estimated</span>' : '') +
        '</div><div class="hl-result-breakdown">Fabric: ' +
        Math.round(result.fabricWatts) + ' W &nbsp; Ventilation: ' +
        Math.round(result.ventilationWatts) + ' W &nbsp; Load density: ' +
        result.wattsPerSquareMetre.toFixed(1) + ' W/m²' + factorDetails + gainDetails +
        radiatorFactorDetails + connectionFactorDetails + '<br><small>' +
        escapeHtml(ventilationDetails) + '; effective heat-loss airflow ' +
        result.ach.toFixed(2) + ' ACH.</small></div>' + radiatorHtml +
        (result.warnings.length
          ? '<div class="hl-warning">' + escapeHtml(result.warnings.join('. ')) + '</div>'
          : '');
    }
  }

  function refreshRadiatorRequirement(room) {
    var requirement = Math.max(0, Number(room.radiatorRequirementWatts) || 0);
    var isAssessment = room.radiatorOutcome === 'Assess existing radiator';
    var likeForLike = room.radiatorOutcome ===
      'Replace existing radiator like for like';
    room.existingRadiatorAdequate = Boolean(room.complete && room.existingRadiator &&
      room.existingRadiator.complete !== false && room.existingRadiator.watts >= requirement);
    room.radiator = room.complete && requirement > 0 && !room.customerRefused &&
      !likeForLike && !(isAssessment && room.existingRadiatorAdequate)
      ? recommendStelradElite(requirement, room.indoor,
        stringValue('rad_' + room.key + '_new_size'), room.key, room.roomName)
      : null;
    room.effectiveRadiator = room.customerRefused || room.newRadiatorDeclined || likeForLike
      ? room.existingRadiator
      : isAssessment && room.existingRadiatorAdequate
        ? room.existingRadiator
        : room.radiator && room.radiator.selected;
    room.warnings = room.warnings.filter(function (warning) {
      return warning.indexOf('Existing radiator output is below') !== 0 &&
        warning.indexOf('Retained radiator output is below') !== 0 &&
        warning.indexOf('Like-for-like replacement is below') !== 0 &&
        warning.indexOf('No single radiator option') !== 0 &&
        warning.indexOf('No two-radiator combination') !== 0;
    });
    if (room.customerRefused && room.existingRadiator &&
        room.existingRadiator.watts < requirement) {
      room.warnings.push('Retained radiator output is below the calculated room requirement');
    } else if ((room.newRadiatorDeclined || isAssessment || likeForLike) &&
        room.existingRadiator && room.existingRadiator.watts < requirement) {
      room.warnings.push(likeForLike
        ? 'Like-for-like replacement is below the calculated room requirement'
        : 'Existing radiator output is below the calculated room requirement');
    }
    if (room.radiator && !room.radiator.temperatureWarning && !room.radiator.selected) {
      room.warnings.push(room.radiator.usesTwo
        ? 'No two-radiator combination meets the room requirement within the 50% oversize limit'
        : 'No single radiator option meets the room requirement within the 50% oversize limit');
    }
  }

  function applyHeatedInternalWallTransfers(results) {
    var byKey = {};
    results.forEach(function (room) {
      byKey[room.key] = room;
      room.receivedInternalWallWatts = 0;
    });
    results.forEach(function (room) {
      var adjacent = byKey[room.adjacentRoomKey];
      if (!room.complete || !adjacent || !adjacent.complete ||
          room.internalWallWatts <= 0 || adjacent.key === room.key) return;
      adjacent.receivedInternalWallWatts += room.internalWallWatts;
    });
    results.forEach(function (room) {
      var rawRequirement = Math.max(0,
        room.totalWatts - room.receivedInternalWallWatts);
      room.radiatorRequirementWatts = window.HeatLossCalculations.radiatorSizingRequirement(
        rawRequirement, room.radiatorConnection
      );
      refreshRadiatorRequirement(room);
    });
  }

  function applySharedRadiatorGroups(results) {
    var byKey = {};
    var groups = {};
    results.forEach(function (room) {
      byKey[room.key] = room;
      room.radiatorRequirementWatts = Number.isFinite(room.radiatorRequirementWatts)
        ? room.radiatorRequirementWatts
        : room.totalWatts;
      room.sharedRadiatorHostKey = '';
      room.sharedRadiatorHostName = '';
      room.sharedRadiatorRoomNames = [];
      room.sharedRadiatorRawCombinedWatts = 0;
      room.sharedRadiatorTransferAdjustmentWatts = 0;
    });
    results.forEach(function (room) {
      var hostKey = stringValue('hl_' + room.key + '_shared_radiator_with');
      var host = byKey[hostKey];
      var hostSharesAnotherRadiator = host &&
        stringValue('hl_' + host.key + '_shared_radiator_with') !== '';
      var guestHasConflictingOutcome = room.customerRefused ||
        room.radiatorOutcome === 'Replace existing radiator like for like' ||
        room.newRadiatorDeclined;
      var hostCanSupply = host && host.complete && room.complete &&
        !hostSharesAnotherRadiator && host.radiatorOutcome !== 'Customer refused' &&
        host.radiatorOutcome !== 'Replace existing radiator like for like' &&
        (!host.newRadiatorDeclined || Boolean(host.existingRadiator));
      if (guestHasConflictingOutcome) {
        room.warnings.push('A shared radiator cannot be used while this room is marked as refused, retained or like-for-like');
        return;
      }
      if (!hostCanSupply || hostKey === room.key) return;
      if (!groups[hostKey]) groups[hostKey] = [];
      groups[hostKey].push(room);
      room.sharedRadiatorHostKey = hostKey;
      room.sharedRadiatorHostName = host.roomName;
      room.radiator = null;
      room.effectiveRadiator = null;
    });
    Object.keys(groups).forEach(function (hostKey) {
      var host = byKey[hostKey];
      var suppliedRooms = groups[hostKey];
      host.sharedRadiatorRoomNames = suppliedRooms.map(function (room) {
        return room.roomName;
      });
      host.sharedRadiatorRawCombinedWatts = host.totalWatts + suppliedRooms.reduce(
        function (sum, room) { return sum + room.totalWatts; }, 0);
      host.radiatorRequirementWatts = host.radiatorRequirementWatts + suppliedRooms.reduce(
        function (sum, room) { return sum + room.radiatorRequirementWatts; }, 0);
      host.sharedRadiatorTransferAdjustmentWatts = Math.max(0,
        host.sharedRadiatorRawCombinedWatts - host.radiatorRequirementWatts);
      host.existingRadiatorAdequate = Boolean(host.existingRadiator &&
      host.existingRadiator.complete !== false &&
      host.existingRadiator.watts >= host.radiatorRequirementWatts);
      var isAssessment = host.radiatorOutcome === 'Assess existing radiator';
      host.radiator = isAssessment && host.existingRadiatorAdequate
        ? null
        : recommendStelradElite(host.radiatorRequirementWatts, host.indoor,
          stringValue('rad_' + host.key + '_new_size'), host.key, host.roomName);
      host.effectiveRadiator = host.newRadiatorDeclined
        ? host.existingRadiator
        : isAssessment && host.existingRadiatorAdequate
        ? host.existingRadiator
        : host.radiator && host.radiator.selected;
      host.warnings = host.warnings.filter(function (warning) {
        return warning.indexOf('Existing radiator output is below') !== 0 &&
          warning.indexOf('No single radiator option') !== 0 &&
          warning.indexOf('No two-radiator combination') !== 0;
      });
      if (isAssessment && !host.existingRadiator) {
        host.warnings.push(existingRadiatorGuidance(host.key));
      } else if (isAssessment && !host.existingRadiatorAdequate) {
        host.warnings.push('Existing radiator output is below the combined room requirement');
      } else if (host.newRadiatorDeclined && (!host.existingRadiator ||
          !host.existingRadiatorAdequate)) {
        host.warnings.push(host.existingRadiator
          ? 'Retained radiator output is below the combined room requirement'
          : existingRadiatorGuidance(host.key));
      }
      if (host.radiator && !host.radiator.temperatureWarning &&
          !host.radiator.selected) {
        host.warnings.push(host.radiator.usesTwo
          ? 'No two-radiator combination meets the combined room requirement within the 50% oversize limit'
          : 'No single radiator option meets the combined room requirement within the 50% oversize limit');
      }
    });
  }

  function calculateHeatLoss() {
    var roomNames = allRoomNames();
    var ceilingHeight = numberValue('r_ceiling', 2.4);
    var propertyVolume = roomNames.reduce(function (sum, roomName) {
      var key = roomKeyFromName(roomName);
      var length = numberValue('rad_' + key + '_len', 0);
      var width = numberValue('rad_' + key + '_wid', 0);
      return sum + (length > 0 && width > 0 && ceilingHeight > 0
        ? length * width * ceilingHeight
        : 0);
    }, 0);
    var results = roomNames.map(function (roomName) {
      return calculateRoom(roomName, { propertyVolume: propertyVolume });
    });
    applyHeatedInternalWallTransfers(results);
    applySharedRadiatorGroups(results);
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
    var radiatorOutputWatts = results.reduce(function (sum, room) {
      return sum + (room.effectiveRadiator
        ? room.effectiveRadiator.watts
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
      outputField.title = '12 kW minimum, or 110% of the combined selected radiator output when higher.';
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

  function refreshVentilationControls() {
    allRoomNames().forEach(function (roomName) {
      var key = roomKeyFromName(roomName);
      var mode = stringValue('hl_' + key + '_ventilation_mode');
      var manualField = document.getElementById('hl_' + key + '_manual_ach');
      if (manualField) {
        manualField.disabled = mode !== 'Manual override';
        manualField.title = manualField.disabled
          ? 'Select Manual override to enter a room air-change rate.'
          : 'Overrides the automatic 0.5 or 0 ACH room minimum.';
      }
    });
    var efficiency = document.getElementById('hl_mvhr_efficiency');
    if (efficiency) {
      efficiency.disabled = stringValue('hl_ventilation_system') !==
        'Mechanical ventilation with heat recovery (MVHR)';
      efficiency.title = efficiency.disabled
        ? 'Only used when MVHR is selected.'
        : 'Heat-recovery efficiency applied to the base mechanical airflow.';
    }
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
        field.addEventListener('input', function (event) {
          refreshVentilationControls();
          inputChanged(event);
        });
        field.addEventListener('change', function (event) {
          refreshVentilationControls();
          inputChanged(event);
        });
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
    if (!included && (label === 'Heated room below' ||
        label === 'Heated room above')) {
      return escapeHtml(label) + '<br><b>No heat loss included</b>';
    }
    if (!included) return 'Not included';
    return escapeHtml(label || 'Unknown') + '<br><b>' +
      Number(value || 0).toFixed(2) + ' W/m²K</b>';
  }

  function renderHeatLossAssumptionsSheet(calculation) {
    var rows = calculation.includedRooms || [];
    var station = stringValue('hl_design_station') || 'Manual value';
    var bridgeMethod = stringValue('hl_bridge_method') || 'Percentage';
    var bridgeSummary = bridgeMethod === 'Age-based'
      ? 'Age-based RdSAP y-value by room age'
      : bridgeMethod === 'None'
        ? 'None'
        : numberValue('hl_bridge_pct', 10).toFixed(0) + '% of complete room load';
    var allowanceSummary = 'Reheat ×' + numberValue('hl_reheat_factor', 1).toFixed(2) +
      ', exposed ×' + numberValue('hl_exposed_location', 1).toFixed(2) +
      ', high ceiling ×' + numberValue('hl_high_ceiling_factor', 1).toFixed(2);
    return '<div class="sheet-wrap" id="heatLossAssumptionsSheetV61">' +
      '<div class="sheet-title"><h2>Heat Loss</h2><small>U-values and ventilation assumptions used</small></div>' +
      '<table class="sheet heatloss-sheet heatloss-assumptions-sheet">' +
      '<tr><td class="label">Address</td><td colspan="3" class="input">' +
      cell('site_address') + '</td><td class="label">Reference station</td><td colspan="3" class="input">' +
      escapeHtml(station) + '</td></tr>' +
      '<tr><td class="label">Outdoor design</td><td class="input">' +
      escapeHtml(stringValue('hl_outdoor_temp')) + ' °C</td>' +
      '<td class="label">Thermal bridges</td><td class="input">' +
      bridgeSummary + '<br><small>' + allowanceSummary + '</small></td>' +
      '<td class="label">Radiator design</td><td colspan="3" class="input">Radiator options at ' +
      escapeHtml(stringValue('hl_radiator_temperature')) + '°C, nominal ΔT' +
      (Number(stringValue('hl_radiator_temperature')) - 25) + ', ' +
      escapeHtml(stringValue('hl_radiator_connection') || 'BBOE') +
      (stringValue('hl_radiator_connection') === 'TBOE'
        ? ' connection'
        : ' connection, applies a 4% BBOE emitter-output reduction (×0.96)') + '</td></tr>' +
      '<tr><td class="label">Property altitude</td><td class="input">' +
      escapeHtml(stringValue('hl_property_altitude')) + ' m</td>' +
      '<td class="label">Ground temperature</td><td class="input">' +
      escapeHtml(stringValue('hl_ground_temp')) + ' °C</td>' +
      '<td class="label">Ground reference</td><td colspan="3" class="input">' +
      escapeHtml(stringValue('hl_ground_station') || 'Manual value') + '</td></tr>' +
      '<tr><td class="label">Property age</td><td class="input">Band ' +
      escapeHtml(stringValue('hl_property_age_band') || 'Unknown') + '</td>' +
      '<td class="label">Age evidence</td><td colspan="5" class="input">' +
      escapeHtml(stringValue('hl_property_age_source') || 'Unknown') + '</td></tr>' +
      '<tr><td class="label">Ventilation system</td><td colspan="5" class="input">' +
      escapeHtml(stringValue('hl_ventilation_system') || 'Natural ventilation') +
      (stringValue('hl_ventilation_system') ===
        'Mechanical ventilation with heat recovery (MVHR)'
        ? ', ' + escapeHtml(stringValue('hl_mvhr_efficiency')) + '% heat recovery'
        : '') +
      '<br>Age category: ' + escapeHtml(stringValue('hl_ventilation_age_category') || 'From property age band') +
      '</td><td class="label">Room minimum</td><td class="input">Selected room type and age band</td></tr>' +
      '<tr><th>Room</th><th>External wall</th><th>Internal wall</th><th>Windows</th><th>External door</th><th>Floor</th><th>Ceiling / loft</th><th>Ventilation</th></tr>' +
      (rows.length ? rows.map(function (room) {
        return '<tr><td><b>' + escapeHtml(room.roomName) + '</b><br>Evidence: ' +
          escapeHtml(room.assumptionQuality) + '</td>' +
          '<td>' + uValueAssumption(room.wallType,
            room.alternativeWallLength > 0 ? room.primaryWallU : room.wallU,
            room.wallLength > 0) +
          (room.alternativeWallLength > 0
            ? '<br>Plus ' + room.alternativeWallLength.toFixed(2) + 'm ' +
              uValueAssumption(room.alternativeWallType, room.alternativeWallU, true)
            : '') +
          (room.bridgeMethod === 'Age-based'
            ? '<br>Bridge y-value: ' + room.bridgeFactor.toFixed(2) + ' W/m²K'
            : '') + '</td>' +
          '<td>' + uValueAssumption(room.internalWallType, room.internalWallU, room.internalWallLength > 0 && room.internalWallU > 0) +
          (room.adjacentRoomName ? '<br>Adjacent: ' + escapeHtml(room.adjacentRoomName) + ' (' + room.adjacentIndoor.toFixed(0) + '°C)' :
            room.internalWallLength > 0 && String(room.internalWallType).indexOf('Unheated') === 0
              ? '<br>Adjacent: ' + escapeHtml(room.adjacentSpace) +
                (room.adjacentTemperature == null
                  ? ', factor ' + room.adjacentSpaceFactor.toFixed(2)
                  : ', ' + room.adjacentTemperature.toFixed(1) + '°C')
              : '') + '</td>' +
          '<td>' + uValueAssumption(room.windowType, room.windowU, room.windowArea > 0 && room.windowU > 0) +
          (room.windowArea > 0 ? '<br>' + room.windowArea.toFixed(2) + 'm² ' +
            (room.measuredWindowArea ? 'from dimensions' : 'entered area') : '') + '</td>' +
          '<td>' + uValueAssumption(room.doorType, room.doorU, room.doorArea > 0 && room.doorU > 0) +
          (room.doorArea > 0 ? '<br>' + room.doorArea.toFixed(2) + 'm² ' +
            (room.measuredDoorArea ? 'from dimensions' : 'entered area') : '') + '</td>' +
          '<td>' + uValueAssumption(room.floorType, room.floorU, room.floorU > 0) +
          (room.floorExposedPerimeter > 0
            ? '<br>Exposed perimeter: ' + room.floorExposedPerimeter.toFixed(2) + 'm'
            : '') + '</td>' +
          '<td>' + uValueAssumption(room.loftType, room.roofU, room.roofU > 0) +
          (room.roofAdjacentTemperature == null
            ? '' : '<br>Adjacent room: ' + room.roofAdjacentTemperature.toFixed(1) + '°C') +
          (room.rooflightArea > 0
            ? '<br>Rooflight: ' + room.rooflightArea.toFixed(2) + 'm², U ' + room.rooflightU.toFixed(2)
            : '') + '</td>' +
          '<td>' + escapeHtml(room.ventilationMode) + ': <b>' +
          room.baseAch.toFixed(2) + ' ACH</b><br>Standard: ' +
          escapeHtml(room.roomType) + ', band ' + escapeHtml(room.roomAgeBand) +
          ' = ' + room.standardAch.toFixed(2) + ' ACH' +
          (room.ventilationDevice !== 'No additional vent or flue'
            ? '<br>' + escapeHtml(room.ventilationDevice) + ': +' +
              room.deviceFlowM3h.toFixed(0) + ' m³/h'
            : '') +
          (room.pivFlowM3h > 0
            ? '<br>PIV share: +' + room.pivFlowM3h.toFixed(1) + ' m³/h'
            : '') +
          '<br>Heat-loss equivalent: <b>' + room.ach.toFixed(2) + ' ACH</b></td></tr>';
      }).join('') : '<tr><td colspan="8" class="center">No completed rooms entered</td></tr>') +
      '<tr><td colspan="8" class="small"><b>Survey disclaimer:</b> Some property construction materials, insulation levels and dimensions may be presumed from visible evidence or typical construction where they cannot be verified. Confirm them before equipment selection.</td></tr>' +
      '<tr><td colspan="8" class="small">Each numbered internal wall uses its measured length, selected construction and entered temperature on the other side. Signed room-to-adjoining temperature differences are retained for room radiator sizing.</td></tr>' +
      '<tr><td colspan="8" class="small">Stelrad Elite ΔT50 outputs used (kW/m): K1 300/450/600/700mm = 0.517/0.768/1.000/1.142; P+ 300/450/600/700mm = 0.776/1.106/1.409/1.597; K2 300/450/600/700mm = 1.012/1.409/1.778/2.011; K3 300/500/600/700mm = 1.418/2.169/2.514/2.841. Outputs are multiplied by Stelrad’s published correction factor for mean water temperature minus room temperature.</td></tr>' +
      '<tr><td colspan="8" class="small">Myson fan-convector options use normal-fan 75/65°C outputs: Kickspace 500/600/800 = 0.755/1.023/1.707 kW; Hi-Line RC 7-4/10-6/15-10/20-14 = 0.930/1.610/2.459/3.468 kW; Hi-Line LV 7-4 = 0.930 kW. The LV is the only Myson option offered in bathroom and en-suite rooms.</td></tr>' +
      '<tr><td colspan="8" class="small">Radiator choices meet the calculated room heat loss without exceeding it by more than 50%. BBOE multiplies each radiator’s temperature-corrected output by 0.96 for the 4% connection reduction. It does not change the room or building heat loss. The front-page range-rate output is the higher of 12 kW or the combined corrected output of the selected radiators.</td></tr>' +
      '<tr><td colspan="8" class="small">Ventilation uses the selected MCS/CIBSE room and property-age minimum, or 0 ACH for a fully internal room. Room devices add their default airflow. MVHR applies the entered heat-recovery efficiency. PIV adds 20 m³/h across the property, shared by entered room volume. A manual room ACH overrides the automatic value.</td></tr>' +
      '<tr><td colspan="8" class="small">The detailed exposed floor perimeter is recorded for audit. The selected standard floor U-value is still used by this practical calculator. Use a certified BS EN 12831 or MCS tool where a full ISO 13370 ground-floor calculation is required.</td></tr>' +
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
          (room.customerRefused
            ? '<br><small>Radiator work refused</small>'
            : room.radiatorOutcome === 'Assess existing radiator' &&
                room.existingRadiatorAdequate
              ? '<br><small>' + escapeHtml(room.existingRadiator.size) +
                ', existing radiator adequate</small>'
              : room.radiatorOutcome === 'Replace existing radiator like for like' &&
                  room.existingRadiator
                ? '<br><small>' + escapeHtml(room.existingRadiator.size) +
                  ', replace like for like</small>'
                : room.newRadiatorDeclined
                  ? room.existingRadiator
                    ? '<br><small>' +
                      (!room.existingRadiatorAdequate
                        ? 'Radiator refused, undersized: '
                        : 'Existing radiator retained: ') +
                      escapeHtml(room.existingRadiator.size) + ', ' +
                      (room.existingRadiator.watts / 1000).toFixed(2) + ' kW</small>'
                    : '<br><small>Existing radiator size not recorded</small>'
                : room.effectiveRadiator
                  ? '<br><small>' + escapeHtml(room.effectiveRadiator.size) + ', ' +
                    (room.effectiveRadiator.watts / 1000).toFixed(2) + ' kW</small>'
                  : '') +
          (room.sharedRadiatorHostName
            ? '<br><small>Supplied by ' + escapeHtml(room.sharedRadiatorHostName) +
              ' radiator</small>'
            : room.sharedRadiatorRoomNames.length
              ? '<br><small>Also supplies ' +
                escapeHtml(room.sharedRadiatorRoomNames.join(' and ')) +
                '. ' + sharedRadiatorRequirementDescription(room) + '</small>'
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
    var key = roomKeyFromName(roomName);
    var original = previousRoomFormHtml(roomName, index);
    var existingSizePattern = new RegExp(
      '(<div class="field">\\s*<label for="rad_' + key +
      '_ex_size">[\\s\\S]*?<\\/div>)\\s*' +
      '(<div class="field">\\s*<label for="rad_' + key +
      '_ex_loc">[\\s\\S]*?<\\/div>)'
    );
    original = original.replace(existingSizePattern, function (
      matchedFields, existingSizeField, existingLocationField
    ) {
      var additionalExistingFields = '';
      for (var radiatorIndex = 2; radiatorIndex <= 2; radiatorIndex += 1) {
        additionalExistingFields +=
          '<div class="hl-existing-radiator-extra" id="rad_' +
          escapeHtml(key) + '_ex_radiator_' + radiatorIndex + '_wrap" hidden>' +
          '<div class="field"><label for="rad_' + escapeHtml(key) +
          '_ex_size_' + radiatorIndex + '">' + escapeHtml(roomName) +
          ' - Existing Size ' + radiatorIndex + '</label>' +
          '<select id="rad_' + escapeHtml(key) + '_ex_size_' + radiatorIndex +
          '" data-id="rad_' + escapeHtml(key) + '_ex_size_' + radiatorIndex +
          '"><option value="">Select existing radiator size</option></select></div>' +
          '<div class="field"><label for="rad_' + escapeHtml(key) +
          '_ex_loc_' + radiatorIndex + '">' + escapeHtml(roomName) +
          ' - Existing Location ' + radiatorIndex + '</label>' +
          '<input id="rad_' + escapeHtml(key) + '_ex_loc_' + radiatorIndex +
          '" data-id="rad_' + escapeHtml(key) + '_ex_loc_' + radiatorIndex +
          '" type="text"></div>' +
          '<div class="field hl-custom-existing-output" id="rad_' +
          escapeHtml(key) + '_ex_custom_kw_wrap_' + radiatorIndex + '" hidden>' +
          '<label for="rad_' + escapeHtml(key) + '_ex_custom_kw_' +
          radiatorIndex + '">' + escapeHtml(roomName) +
          ' - Custom existing output ' + radiatorIndex + ' (kW)</label>' +
          '<input id="rad_' + escapeHtml(key) + '_ex_custom_kw_' + radiatorIndex +
          '" data-id="rad_' + escapeHtml(key) + '_ex_custom_kw_' + radiatorIndex +
          '" type="number" min="0" step="0.01" inputmode="decimal" disabled>' +
          '<small>Required for a custom radiator or towel rail. Enter its known output at the selected design temperature.</small>' +
          '</div></div>';
      }
      return '<div id="hl_' + escapeHtml(key) + '_existing_radiator_fields">' +
        '<div class="field hl-existing-radiator-quantity">' +
        '<label for="rad_' + escapeHtml(key) + '_ex_quantity">' +
        escapeHtml(roomName) + ' - Number of existing radiators</label>' +
        '<select id="rad_' + escapeHtml(key) + '_ex_quantity" data-id="rad_' +
        escapeHtml(key) + '_ex_quantity"><option value="1">1</option>' +
        '<option value="2">2</option></select>' +
        '<small>Defaults to 1. Selecting a higher number reveals a size field for each radiator.</small>' +
        '</div>' + existingSizeField + existingLocationField +
        '<div class="field hl-custom-existing-output" id="rad_' +
        escapeHtml(key) + '_ex_custom_kw_wrap" hidden>' +
        '<label for="rad_' + escapeHtml(key) + '_ex_custom_kw">' +
        escapeHtml(roomName) + ' - Custom existing output per radiator (kW)</label>' +
        '<input id="rad_' + escapeHtml(key) + '_ex_custom_kw" data-id="rad_' +
        escapeHtml(key) + '_ex_custom_kw" type="number" min="0" step="0.01" ' +
        'inputmode="decimal" disabled>' +
        '<small>Required for a custom radiator or towel rail. Enter the output of one unit at the selected design temperature.</small>' +
        '</div>' + additionalExistingFields + '</div>';
    });
    var newSizePattern = new RegExp(
      '<div class="field">\\s*<label for="rad_' + key +
      '_new_size">[\\s\\S]*?<\\/div>'
    );
    var newSizeMatch = original.match(newSizePattern);
    var newSizeField = newSizeMatch ? newSizeMatch[0] : '';
    if (newSizeField) {
      newSizeField = newSizeField.replace(
        escapeHtml(roomName) + ' - New Size',
        escapeHtml(roomName) + ' - Replacement radiator'
      );
    }
    if (newSizeField) original = original.replace(newSizePattern, '');
    var secondRadiatorField =
      '<div class="field hl-second-radiator" id="hl_' + key +
      '_second_radiator_wrap" hidden>' +
      '<label for="rad_' + key + '_new_size_2">' + escapeHtml(roomName) +
      ' - Radiator 2</label>' +
      '<select id="rad_' + key + '_new_size_2" data-id="rad_' + key +
      '_new_size_2"><option value="">Choose radiator 2</option></select></div>';
    var outputPattern = new RegExp(
      '<div class="field">\\s*<label for="rad_' + key +
      '_output">[\\s\\S]*?<\\/div>'
    );
    var outputMatch = original.match(outputPattern);
    var outputField = outputMatch ? outputMatch[0] : '';
    if (outputField) original = original.replace(outputPattern, '');
    var heatLossAndRadiatorFields = roomDropdownHtml(roomName) + newSizeField +
      secondRadiatorField;
    var newLocationPattern = new RegExp(
      '(<div class="field">\\s*<label for="rad_' + key +
      '_new_loc">[\\s\\S]*?<\\/div>)'
    );
    if (newLocationPattern.test(original)) {
      original = original.replace(newLocationPattern, function (locationField) {
        return heatLossAndRadiatorFields + locationField;
      });
    } else {
      original = original.replace(/<\/details>\s*$/, heatLossAndRadiatorFields +
        '</details>');
    }
    var completionControl =
      '<input type="hidden" id="rad_' + escapeHtml(key) + '_completed" data-id="rad_' +
      escapeHtml(key) + '_completed">' +
      '<div class="room-completion-action">' +
      '<button type="button" data-room-completion-button="' + escapeHtml(key) +
      '" onclick="completeRadiatorRoom(\'' + escapeHtml(key) + '\')">Completed room</button>' +
      '</div>';
    var assembled = original.replace(
      /<\/details>\s*$/,
      outputField + completionControl + '</details>'
    );
    // Parse only markup produced by this app's local form builders in a detached
    // element. Dynamic room labels are escaped before they enter the added markup.
    var holder = document.createElement('div');
    holder.innerHTML = assembled;
    var room = holder.firstElementChild;
    var heatLossDetails = room && room.querySelector('details[data-hl-room="' + key + '"]');
    if (!room || !heatLossDetails) return assembled;

    var panelHolder = document.createElement('div');
    panelHolder.innerHTML = radiatorPanelHtml(roomName);
    var radiatorPanel = panelHolder.firstElementChild;
    heatLossDetails.insertAdjacentElement('afterend', radiatorPanel);
    var radiatorControls = radiatorPanel.querySelector('#hl_' + key + '_radiator_controls');

    function fieldContainer(id) {
      var element = room.querySelector('#' + id);
      return element ? (element.closest('.field') || element) : null;
    }

    var existingFields = room.querySelector('#hl_' + key + '_existing_radiator_fields');
    var existingTrvField = fieldContainer('rad_' + key + '_ex_trv');
    if (existingFields && existingTrvField) existingFields.appendChild(existingTrvField);

    if (existingFields) radiatorControls.appendChild(existingFields);
    [
      'hl_' + key + '_shared_radiator_with',
      'hl_' + key + '_radiator_installation',
      'hl_' + key + '_radiator_finish'
    ].forEach(function (id) {
      var field = fieldContainer(id);
      if (field) radiatorControls.appendChild(field);
    });
    [
      'hl_' + key + '_rad_quantity',
      'rad_' + key + '_new_size',
      'rad_' + key + '_new_size_2',
      'rad_' + key + '_new_loc',
      'rad_' + key + '_new_trv',
      'rad_' + key + '_kw',
      'rad_' + key + '_output'
    ].forEach(function (id) {
      var field = fieldContainer(id);
      if (field) radiatorControls.appendChild(field);
    });
    return holder.innerHTML;
  };

  function refreshRoomCompletionControls() {
    document.querySelectorAll('[data-room-completion-button]').forEach(function (button) {
      var key = button.dataset.roomCompletionButton;
      var field = document.getElementById('rad_' + key + '_completed');
      var completed = field && field.value === 'yes';
      button.textContent = completed ? 'Mark incomplete' : 'Completed room';
      button.classList.toggle('is-complete', completed);
      button.title = completed
        ? 'Reopen this room and return it to the normal progress count.'
        : 'Mark this room complete and collapse it.';
    });
  }

  window.completeRadiatorRoom = function (key) {
    var field = document.getElementById('rad_' + key + '_completed');
    if (!field) return;
    var completed = field.value === 'yes';
    field.value = completed ? '' : 'yes';
    var room = field.closest('details');
    if (room) room.open = completed;
    if (typeof update === 'function') update();
    if (typeof window.updateSectionBadgesV58 === 'function') {
      window.updateSectionBadgesV58();
    }
    refreshRoomCompletionControls();
    persistCombinedData();
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
    refreshVentilationControls();
    calculateHeatLoss();
    refreshRoomCompletionControls();
    return result;
  };

  var previousSetData = window.setData || setData;
  setData = window.setData = function (data) {
    var migratedData;
    try {
      migratedData = window.SurveyPersistence.migrateSurvey(data || {});
    } catch (error) {
      if (typeof showAppStatus === 'function') {
        showAppStatus('This survey could not be loaded: ' + error.message, 'warning');
      }
      console.error('Could not migrate survey data:', error);
      return;
    }
    rebuildRadsForm(migratedData);
    var result = previousSetData.call(this, migratedData);
    restoreValues(migratedData);
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
    return (calculation.radiatorOutputWatts / 1000).toFixed(2);
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
    refreshRoomCompletionControls();
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
        var sourceSecondRadiator = sourceData['rad_' + sourceKey + '_new_size_2'];
        if (sourceSecondRadiator != null) {
          var duplicateSecondField = document.getElementById(
            'rad_' + duplicateKey + '_new_size_2'
          );
          if (duplicateSecondField) {
            duplicateSecondField.dataset.restoredValue = sourceSecondRadiator;
          }
        }
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
