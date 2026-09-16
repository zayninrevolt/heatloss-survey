(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HeatLossCalculations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function nonNegative(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function signedNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : (fallback || 0);
  }

  function estimatedWallLength(length, width, wallCount) {
    length = nonNegative(length);
    width = nonNegative(width);
    wallCount = Math.max(0, Math.round(nonNegative(wallCount)));
    var shorter = Math.min(length, width);
    var longer = Math.max(length, width);
    if (wallCount === 1) return shorter;
    if (wallCount === 2) return length + width;
    if (wallCount === 3) return length + width + longer;
    if (wallCount >= 4) return 2 * (length + width);
    return 0;
  }

  function remainingInternalWallLength(length, width, exposedWallLength) {
    var perimeter = 2 * (nonNegative(length) + nonNegative(width));
    exposedWallLength = nonNegative(exposedWallLength);
    if (perimeter <= 0) return 0;
    return Math.max(0, perimeter - Math.min(perimeter, exposedWallLength));
  }

  function floorTemperatureDifference(floorType, indoor, outdoor, ground,
    adjacentTemperature) {
    floorType = String(floorType || '').toLowerCase();
    indoor = Number(indoor) || 0;
    outdoor = Number(outdoor) || 0;
    ground = Number(ground) || 0;
    if (adjacentTemperature !== '' &&
        Number.isFinite(Number(adjacentTemperature)) &&
        (floorType.includes('heated room') || floorType.includes('cellar') ||
          floorType.includes('garage') || floorType.includes('partially heated'))) {
      return indoor - Number(adjacentTemperature);
    }
    if (floorType.includes('solid ground')) return indoor - ground;
    if (floorType.includes('suspended timber ground') ||
        floorType.includes('exposed floor')) {
      return indoor - outdoor;
    }
    if (floorType.includes('cellar') || floorType.includes('garage') ||
        floorType.includes('partially heated')) {
      return (indoor - outdoor) * 0.5;
    }
    return 0;
  }

  function roofTemperatureDifference(indoor, outdoor, adjacentTemperature) {
    indoor = signedNumber(indoor);
    outdoor = signedNumber(outdoor);
    if (adjacentTemperature !== '' &&
        Number.isFinite(Number(adjacentTemperature))) {
      return indoor - Number(adjacentTemperature);
    }
    return indoor - outdoor;
  }

  function altitudeAdjustedTemperature(baseTemperature, propertyAltitude,
    stationAltitude) {
    baseTemperature = Number(baseTemperature);
    propertyAltitude = Number(propertyAltitude);
    stationAltitude = Number(stationAltitude) || 0;
    if (!Number.isFinite(baseTemperature) || !Number.isFinite(propertyAltitude)) {
      return null;
    }
    var steps = Math.max(0, Math.floor((propertyAltitude - stationAltitude) / 100));
    return {
      steps: steps,
      correction: steps * 0.6,
      temperature: baseTemperature - steps * 0.6
    };
  }

  var ROOM_AIR_CHANGE_RATES = {
    old: {
      'Bathroom': 3.0,
      'Bedroom': 1.0,
      'Bedroom with en-suite': 2.0,
      'Bedroom/study': 1.5,
      'Breakfast room': 1.5,
      'Cloakroom/WC': 2.0,
      'Dining room': 1.5,
      'Dressing room': 1.5,
      'Family/breakfast room': 2.0,
      'Games room': 1.5,
      'Hall': 2.0,
      'Internal room/corridor': 0.0,
      'Kitchen': 2.0,
      'Landing': 2.0,
      'Lounge/sitting room': 1.5,
      'Living room': 1.5,
      'Shower room': 3.0,
      'Store room': 1.0,
      'Study': 1.5,
      'Toilet': 3.0,
      'Utility room': 3.0
    },
    middle: {
      'Bathroom': 1.5,
      'Bedroom': 1.0,
      'Bedroom with en-suite': 1.5,
      'Bedroom/study': 1.5,
      'Breakfast room': 1.0,
      'Cloakroom/WC': 1.5,
      'Dining room': 1.0,
      'Dressing room': 1.0,
      'Family/breakfast room': 1.5,
      'Games room': 1.0,
      'Hall': 1.0,
      'Internal room/corridor': 0.0,
      'Kitchen': 1.5,
      'Landing': 1.0,
      'Lounge/sitting room': 1.0,
      'Living room': 1.0,
      'Shower room': 1.5,
      'Store room': 0.5,
      'Study': 1.5,
      'Toilet': 1.5,
      'Utility room': 2.0
    },
    modern: {
      'Bathroom': 0.5,
      'Bedroom': 0.5,
      'Bedroom with en-suite': 1.0,
      'Bedroom/study': 0.5,
      'Breakfast room': 0.5,
      'Cloakroom/WC': 1.5,
      'Dining room': 0.5,
      'Dressing room': 0.5,
      'Family/breakfast room': 0.5,
      'Games room': 0.5,
      'Hall': 0.5,
      'Internal room/corridor': 0.0,
      'Kitchen': 0.5,
      'Landing': 0.5,
      'Lounge/sitting room': 0.5,
      'Living room': 0.5,
      'Shower room': 0.5,
      'Store room': 0.5,
      'Study': 0.5,
      'Toilet': 1.5,
      'Utility room': 0.5
    }
  };

  function roomTypeForAirChange(roomName) {
    var name = String(roomName || '').toLowerCase().trim();
    if (!name) return 'Bedroom';
    if (name.includes('internal') || name.includes('corridor')) {
      return 'Internal room/corridor';
    }
    if (name.includes('family') && name.includes('breakfast')) {
      return 'Family/breakfast room';
    }
    if (name.includes('bed') && (name.includes('en-suite') ||
        name.includes('ensuite') || name.includes('en suite'))) {
      return 'Bedroom with en-suite';
    }
    if (name.includes('bed') && name.includes('study')) return 'Bedroom/study';
    if (name.includes('cloakroom')) return 'Cloakroom/WC';
    if (name === 'wc' || name.includes(' wc') || name.startsWith('wc ')) {
      return 'Cloakroom/WC';
    }
    if (name.includes('bathroom') || name === 'bath' || name.startsWith('bath ')) {
      return 'Bathroom';
    }
    if (name.includes('shower')) return 'Shower room';
    if (name.includes('toilet')) return 'Toilet';
    if (name.includes('utility')) return 'Utility room';
    if (name.includes('breakfast')) return 'Breakfast room';
    if (name.includes('dining') || name === 'd room' || name.startsWith('d room ')) {
      return 'Dining room';
    }
    if (name.includes('dressing')) return 'Dressing room';
    if (name.includes('games')) return 'Games room';
    if (name.includes('landing')) return 'Landing';
    if (name.includes('hall')) return 'Hall';
    if (name.includes('kitchen')) return 'Kitchen';
    if (name.includes('lounge') || name.includes('sitting')) {
      return 'Lounge/sitting room';
    }
    if (name.includes('living')) return 'Living room';
    if (name.includes('store')) return 'Store room';
    if (name.includes('study') || name.includes('office')) return 'Study';
    if (name.includes('bed')) return 'Bedroom';
    return 'Bedroom';
  }

  function roomDesignTemperature(roomName, ageBand) {
    var roomType = roomTypeForAirChange(roomName);
    if (roomType === 'Bathroom' || roomType === 'Shower room') return 22;
    var band = String(ageBand || 'Unknown').toUpperCase();
    if (['K', 'L', 'M'].includes(band) || band === '2003-PRESENT') return 21;
    return [
      'Bedroom with en-suite',
      'Bedroom/study',
      'Breakfast room',
      'Dining room',
      'Family/breakfast room',
      'Games room',
      'Lounge/sitting room',
      'Living room',
      'Study'
    ].includes(roomType) ? 21 : 18;
  }

  // Two vocabularies live side by side and must never share aliases:
  // - Ventilation age categories: the named buckets 'pre-2000', '2000-2006', '2006+'
  //   (plus the legacy words old / middle / modern).
  // - Property age bands: the RdSAP letters A-M used by PROPERTY_AGE_BANDS in
  //   combined-heatloss.js. B is 1900-1929 and C is 1930-1949, so both are pre-2000
  //   properties. Reading them as the legacy 'middle'/'modern' letter aliases understated
  //   ventilation for older dwellings (a 1930-1949 lounge fell to 0.5 ACH, not 1.5).
  // I (1996-2002) straddles the 2000 boundary and keeps its previous 2000-2006 pick.
  var VENTILATION_AGE_BAND_CATEGORIES = {
    A: 'pre-2000',
    B: 'pre-2000',
    C: 'pre-2000',
    D: 'pre-2000',
    E: 'pre-2000',
    F: 'pre-2000',
    G: 'pre-2000',
    H: 'pre-2000',
    I: '2000-2006',
    J: '2000-2006',
    K: '2006+',
    L: '2006+',
    M: '2006+'
  };
  var VENTILATION_AGE_CATEGORY_ALIASES = {
    'PRE-2000': 'pre-2000',
    'OLD': 'pre-2000',
    '2000-2006': '2000-2006',
    '1996-2002': '2000-2006',
    'MIDDLE': '2000-2006',
    '2006+': '2006+',
    'MODERN': '2006+',
    '2003-PRESENT': '2006+'
  };
  var VENTILATION_AGE_GROUPS = {
    'pre-2000': 'old',
    '2000-2006': 'middle',
    '2006+': 'modern'
  };

  function roomAirChangeAgeGroup(ageBand) {
    return VENTILATION_AGE_GROUPS[ventilationAgeCategory(ageBand)] || 'old';
  }

  function ventilationAgeCategory(ageBand) {
    var band = String(ageBand || 'Unknown').trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(VENTILATION_AGE_BAND_CATEGORIES, band)) {
      return VENTILATION_AGE_BAND_CATEGORIES[band];
    }
    if (Object.prototype.hasOwnProperty.call(VENTILATION_AGE_CATEGORY_ALIASES, band)) {
      return VENTILATION_AGE_CATEGORY_ALIASES[band];
    }
    return 'pre-2000';
  }

  function minimumRoomAirChangeRate(roomName, ageBand, hasExternalEnvelope) {
    if (hasExternalEnvelope === false) return 0;
    var roomType = roomTypeForAirChange(roomName);
    var group = roomAirChangeAgeGroup(ageBand);
    return ROOM_AIR_CHANGE_RATES[group][roomType];
  }

  function chimneyAirChangeRate(volume, restricted) {
    volume = nonNegative(volume);
    if (!volume) return 0;
    if (volume <= 40) return restricted ? 3 : 5;
    return restricted ? 2 : 4;
  }

  function applyAdditionalHeatLossFactors(baseWatts, factors) {
    var base = signedNumber(baseWatts);
    factors = factors || {};
    var multiplier = ['thermalBridge', 'intermittent', 'exposed', 'highCeiling']
      .reduce(function (product, key) {
        var factor = signedNumber(factors[key], 1);
        return product * (factor > 0 ? factor : 1);
      }, 1);
    var total = base * multiplier;
    return {
      multiplier: multiplier,
      totalWatts: total,
      additionalWatts: total - base
    };
  }

  function radiatorSizingRequirement(roomWatts) {
    return nonNegative(roomWatts);
  }

  function radiatorConnectionOutputFactor(connectionType) {
    return String(connectionType || '').toUpperCase() === 'BBOE' ? 0.96 : 1;
  }

  function ventilationFlow(input) {
    input = input || {};
    var volume = nonNegative(input.volume);
    var baseAch = nonNegative(input.ach);
    var recoveryEfficiency = Math.min(100, nonNegative(input.recoveryEfficiency));
    var recoveryFactor = input.heatRecovery ? 1 - recoveryEfficiency / 100 : 1;
    return baseAch * volume * recoveryFactor +
      nonNegative(input.deviceFlowM3h) + nonNegative(input.pivFlowM3h);
  }

  function computeHeatLossValues(input) {
    input = input || {};
    var deltaT = signedNumber(input.deltaT);
    var internalDeltaT = signedNumber(input.internalDeltaT);
    var floorArea = nonNegative(input.floorArea);
    var volume = nonNegative(input.volume);
    var wallWatts = nonNegative(input.netWallArea) * nonNegative(input.wallU) * deltaT;
    var internalSegments = Array.isArray(input.internalSegments)
      ? input.internalSegments : [];
    var internalDoorArea = nonNegative(input.internalDoorArea);
    var internalDoorU = nonNegative(input.internalDoorU);
    var internalWallWatts = internalSegments.length
      ? internalSegments.reduce(function (sum, segment) {
        var segmentArea = nonNegative(segment.area);
        var segmentDoorArea = Math.min(segmentArea, nonNegative(segment.doorArea));
        return sum + (segmentArea - segmentDoorArea) * nonNegative(segment.u) *
          signedNumber(segment.deltaT) + segmentDoorArea * nonNegative(segment.doorU) *
          signedNumber(segment.deltaT);
      }, 0)
      : Math.max(0, nonNegative(input.internalWallArea) - internalDoorArea) *
        nonNegative(input.internalWallU) * internalDeltaT +
        internalDoorArea * internalDoorU * internalDeltaT;
    var windowWatts = nonNegative(input.windowArea) * nonNegative(input.windowU) * deltaT;
    var doorWatts = nonNegative(input.doorArea) * nonNegative(input.doorU) * deltaT;
    var floorDeltaT = input.floorDeltaT == null ? deltaT : signedNumber(input.floorDeltaT);
    var floorWatts = floorArea * nonNegative(input.floorU) * floorDeltaT;
    var roofDeltaT = input.roofDeltaT == null ? deltaT : signedNumber(input.roofDeltaT);
    var rooflightWatts = nonNegative(input.rooflightArea) *
      nonNegative(input.rooflightU) * roofDeltaT;
    // Flat-ceiling model: openings replace opaque roof, rather than overlap it.
    var netRoofArea = Math.max(0, floorArea - nonNegative(input.rooflightArea));
    var roofWatts = netRoofArea * nonNegative(input.roofU) * roofDeltaT;
    var ventilationFlowM3h = input.ventilationFlowM3h == null
      ? nonNegative(input.ach) * volume
      : nonNegative(input.ventilationFlowM3h);
    var ventilationWatts = 0.33 * ventilationFlowM3h * deltaT;
    var externalFabric = wallWatts + windowWatts + doorWatts + floorWatts +
      roofWatts + rooflightWatts;
    var bridgeBaseWatts = externalFabric + internalWallWatts + ventilationWatts;
    var bridgeWatts = input.bridgeFactorWm2K == null
      ? bridgeBaseWatts * signedNumber(input.bridgePercent) / 100
      : nonNegative(input.bridgeArea) * signedNumber(input.bridgeFactorWm2K) * deltaT;
    var fabricWatts = externalFabric + internalWallWatts + bridgeWatts;
    return {
      wallWatts: wallWatts,
      internalWallWatts: internalWallWatts,
      windowWatts: windowWatts,
      doorWatts: doorWatts,
      floorWatts: floorWatts,
      roofWatts: roofWatts,
      rooflightWatts: rooflightWatts,
      ventilationFlowM3h: ventilationFlowM3h,
      ventilationWatts: ventilationWatts,
      bridgeWatts: bridgeWatts,
      fabricWatts: fabricWatts,
      totalWatts: fabricWatts + ventilationWatts
    };
  }

  return {
    altitudeAdjustedTemperature: altitudeAdjustedTemperature,
    computeHeatLossValues: computeHeatLossValues,
    applyAdditionalHeatLossFactors: applyAdditionalHeatLossFactors,
    chimneyAirChangeRate: chimneyAirChangeRate,
    estimatedWallLength: estimatedWallLength,
    floorTemperatureDifference: floorTemperatureDifference,
    minimumRoomAirChangeRate: minimumRoomAirChangeRate,
    radiatorConnectionOutputFactor: radiatorConnectionOutputFactor,
    radiatorSizingRequirement: radiatorSizingRequirement,
    remainingInternalWallLength: remainingInternalWallLength,
    roofTemperatureDifference: roofTemperatureDifference,
    roomDesignTemperature: roomDesignTemperature,
    roomTypeForAirChange: roomTypeForAirChange,
    ventilationAgeCategory: ventilationAgeCategory,
    ventilationFlow: ventilationFlow
  };
});
