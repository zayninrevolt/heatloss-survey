(function (root, factory) {
  var exposure = typeof module === 'object' && module.exports
    ? require('./design-review.js') : root.DesignReview;
  var api = factory(exposure);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.McsVentilation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (exposure) {
  'use strict';

  // Ventilation model structure from MCS's published reference data:
  // - q50 default and mechanical system rates:
  //   https://heatloadcalculator.mcscertified.com/docs/reference-sources/ventilation-rates
  // - required exposure inputs (storeys, external facades, sheltered sides):
  //   https://heatloadcalculator.mcscertified.com/docs/data-models/property-schema
  // - 50 Pa to ambient-pressure starting conversion and device rates:
  //   SAP 10.2 (17-12-2021) section 2 and Table 2.1
  // - highest-of combination rule: room design rate, intentional mechanical
  //   ventilation, or the room's share of building infiltration.
  //
  // Two explicitly separate APIs live here:
  // - buildingInfiltration/roomVentilation are the original experimental v1
  //   helpers, retained for compatibility and NOT used by the live reference check;
  // - calculateNaturalZone is the corrected natural-only v2 path, using
  //   Table B.8 directly, envelope leakage allocation and the directional cap.
  // See docs/reference-natural-validation.md for equations, sources and scope.
  // Neither route replaces the saved legacy boiler method or selects equipment.

  var METHOD_ID = 'mcs-reference-ventilation-v1';
  var DEFAULT_PERMEABILITY_50 = 12;
  // q50 is converted to an ambient-pressure starting flow in SAP 10.2, then
  // the complete BS EN 12831 method adjusts it for the building's exposure.
  // The exposure coefficient cannot be guessed from construction age or a
  // generic "retrofit" label. It must be supplied by the exposure calculation
  // (storeys, exposed facades, sheltered sides and elevation).
  var PERMEABILITY_TO_AMBIENT_DIVISOR = 20;
  // These relative shelter factors are an externally observed regression
  // target from Heatpunk Standard Method Fixture A, not a substitute for the
  // BS EN 12831 normal-exposure calculation itself.
  var SHELTER_FACTORS = { intensive: 0.6, normal: 1, none: 1.4 };
  var MINIMUM_ROOM_ACH = 0.5;
  var MECHANICAL_ACH = 0.5;
  var PIV_SUPPLY_M3H = 20;

  var ROOM_TYPES = [
    'Bathroom', 'Bedroom', 'Bedroom with en-suite', 'Bedroom/study', 'Breakfast room',
    'Cloakroom/WC', 'Dining room', 'Dressing room', 'Family/breakfast room', 'Games room',
    'Hall', 'Internal room/corridor', 'Kitchen', 'Landing', 'Lounge/sitting room',
    'Living room', 'Shower room', 'Store room', 'Study', 'Toilet', 'Utility room'
  ];

  var DEVICE_FLOWS = {
    'Chimney or flue attached to closed fire': { flow: 10, terminal: false },
    'Chimney or flue attached to solid fuel boiler': { flow: 20, terminal: false },
    'Chimney or flue attached to other heater': { flow: 35, terminal: false },
    'Open chimney': { flow: 80, terminal: false },
    'Chimney, permanently blocked': { flow: 20, terminal: false },
    'Open flue or vertical duct': { flow: 20, terminal: false },
    'Intermittent extract fan': { flow: 10, terminal: false },
    'Passive vent': { flow: 10, terminal: true },
    'Flueless gas fire': { flow: 40, terminal: true }
  };

  function positiveNumber(value, name) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new RangeError(name + ' must be a positive number');
    }
    return number;
  }

  function nonNegativeNumber(value, name) {
    var number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new RangeError(name + ' must be zero or a positive number');
    }
    return number;
  }

  function normalExposureFactor(input) {
    if (input.normalExposureFactor === undefined || input.normalExposureFactor === null ||
      input.normalExposureFactor === '') {
      throw new RangeError('A normal exposure factor is required for permeability-based infiltration');
    }
    return positiveNumber(input.normalExposureFactor, 'Normal exposure factor');
  }

  function shelterFactor(input) {
    var level = String(input.shelterLevel || 'normal').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(SHELTER_FACTORS, level)) {
      throw new RangeError('A recognised shelter level is required');
    }
    return { level: level, factor: SHELTER_FACTORS[level] };
  }

  function buildingInfiltration(input) {
    input = input || {};
    var internalVolume = positiveNumber(input.internalVolume, 'Internal volume');
    var hasDesignAch = input.designAch !== undefined && input.designAch !== null &&
      input.designAch !== '';
    if (hasDesignAch) {
      var designAch = positiveNumber(input.designAch, 'Design air-change rate');
      return {
        methodId: METHOD_ID,
        permeability50: null,
        permeabilitySource: 'design-air-change-rate',
        exposureSource: 'not-applicable',
        normalExposureFactor: null,
        shelterLevel: null,
        shelterFactor: null,
        designAch: designAch,
        internalVolume: internalVolume,
        envelopeArea: input.envelopeArea == null ? null : Number(input.envelopeArea),
        infiltrationFlowM3h: designAch * internalVolume,
        infiltrationAch: designAch
      };
    }
    var envelopeArea = positiveNumber(input.envelopeArea, 'Envelope area');
    var measured = input.permeability50 !== undefined && input.permeability50 !== null &&
      input.permeability50 !== '';
    var permeability50 = measured
      ? nonNegativeNumber(input.permeability50, 'Air permeability at 50 Pa')
      : DEFAULT_PERMEABILITY_50;
    var normalFactor = normalExposureFactor(input);
    var shelter = shelterFactor(input);
    var ambientStartingFlow = permeability50 / PERMEABILITY_TO_AMBIENT_DIVISOR * envelopeArea;
    var flow = ambientStartingFlow * normalFactor * shelter.factor;
    return {
      methodId: METHOD_ID,
      permeability50: permeability50,
      permeabilitySource: measured ? 'measured' : 'standard-default',
      exposureSource: 'caller-provided-normal-exposure-factor',
      normalExposureFactor: normalFactor,
      shelterLevel: shelter.level,
      shelterFactor: shelter.factor,
      ambientStartingFlowM3h: ambientStartingFlow,
      designAch: null,
      internalVolume: internalVolume,
      envelopeArea: envelopeArea,
      infiltrationFlowM3h: flow,
      infiltrationAch: flow / internalVolume
    };
  }

  function deviceFlowM3h(device) {
    var entry = DEVICE_FLOWS[device];
    return entry ? entry.flow : 0;
  }

  function isTerminalDevice(device) {
    var entry = DEVICE_FLOWS[device];
    return Boolean(entry && entry.terminal);
  }

  function systemKey(ventilationSystem) {
    var value = String(ventilationSystem || 'Natural ventilation').toUpperCase();
    if (value.indexOf('MVHR') >= 0 || value.indexOf('HEAT RECOVERY') >= 0) return 'MVHR';
    if (value.indexOf('MEV') >= 0 || value.indexOf('EXTRACT') >= 0) return 'MEV';
    if (value.indexOf('PIV') >= 0 || value.indexOf('POSITIVE INPUT') >= 0) return 'PIV';
    if (value.indexOf('MECHANICAL') >= 0) return 'MV';
    return 'NATURAL';
  }

  function roomVentilation(input) {
    input = input || {};
    var roomType = String(input.roomType || '');
    if (ROOM_TYPES.indexOf(roomType) < 0) {
      throw new RangeError('A recognised room type is required for the ventilation minimum');
    }
    var roomVolume = positiveNumber(input.roomVolume, 'Room volume');
    var property = input.property || {};
    var buildingVolume = positiveNumber(property.internalVolume, 'Building internal volume');
    var buildingInfiltrationFlow = nonNegativeNumber(property.infiltrationFlowM3h,
      'Building infiltration flow');
    var system = systemKey(input.ventilationSystem);
    var minimumAch = input.hasExternalEnvelope === false || roomType === 'Internal room/corridor'
      ? 0 : MINIMUM_ROOM_ACH;
    var minimumFlowM3h = minimumAch * roomVolume;
    var mechanicalSupplyM3h = 0;
    var mechanicalExtractM3h = 0;
    if (system === 'MV' || system === 'MVHR') {
      mechanicalSupplyM3h = MECHANICAL_ACH * roomVolume;
      mechanicalExtractM3h = MECHANICAL_ACH * roomVolume;
    } else if (system === 'MEV') {
      mechanicalExtractM3h = MECHANICAL_ACH * roomVolume;
    } else if (system === 'PIV') {
      mechanicalSupplyM3h = PIV_SUPPLY_M3H * roomVolume / buildingVolume;
    }
    var recoveryEfficiency = system === 'MVHR'
      ? Math.max(0, Math.min(100, Number(input.mvhrEfficiency) || 0))
      : 0;
    var heatRecoveryFactor = 1 - recoveryEfficiency / 100;
    var infiltrationFlowM3h = buildingInfiltrationFlow * roomVolume / buildingVolume;
    var mechanicalFlowM3h = Math.max(mechanicalSupplyM3h, mechanicalExtractM3h);
    // Ties go to intentional mechanical ventilation, which is the air route that
    // heat recovery can act on. Recovery is applied only to the governing flow.
    var governed = 'infiltration';
    var governingFlowM3h = infiltrationFlowM3h;
    if (minimumFlowM3h > governingFlowM3h) {
      governed = 'room-minimum';
      governingFlowM3h = minimumFlowM3h;
    }
    if (mechanicalFlowM3h >= governingFlowM3h && mechanicalFlowM3h > 0) {
      governed = 'mechanical';
      governingFlowM3h = mechanicalFlowM3h;
    }
    var devices = Array.isArray(input.devices) ? input.devices.slice() : [];
    var deviceFlow = devices.reduce(function (sum, device) {
      return sum + deviceFlowM3h(device);
    }, 0);
    var heatLossFlowM3h = governingFlowM3h *
      (governed === 'mechanical' ? heatRecoveryFactor : 1) + deviceFlow;
    return {
      methodId: METHOD_ID,
      roomType: roomType,
      roomVolume: roomVolume,
      minimumAch: minimumAch,
      minimumFlowM3h: minimumFlowM3h,
      mechanicalSupplyM3h: mechanicalSupplyM3h,
      mechanicalExtractM3h: mechanicalExtractM3h,
      infiltrationFlowM3h: infiltrationFlowM3h,
      heatRecoveryFactor: heatRecoveryFactor,
      terminalDevices: devices.filter(isTerminalDevice),
      deviceFlowM3h: deviceFlow,
      governed: governed,
      governingFlowM3h: governingFlowM3h,
      flowM3h: governingFlowM3h + deviceFlow,
      heatLossFlowM3h: heatLossFlowM3h
    };
  }

  // Natural-ventilation reference route, independently checked against the
  // commercial fixtures. Brack (2023), printed pp. 11-12, equations 13-16:
  // q_env,z = q50 * A_env,z * f_qv,z for balanced natural ventilation;
  // q_leak,i = q_env,z * A_env,i / A_env,z;
  // q_env,i = min(q_env,z, q_leak,i * f_dir).
  // Table B.8 supplies f_qv,z. The direction factor is REQUIRED, not fitted.
  // Zone watts use the published max(leakage, fi-z * room minimum) expression;
  // never halve the room heat load or the governing room flow indiscriminately.
  // Mechanical ventilation, combustion and ATDs are deliberately unsupported.
  function calculateNaturalZone(input) {
    input = input || {};
    if (!exposure || typeof exposure.exposureCoefficient !== 'function') {
      throw new RangeError('The sourced exposure coefficient module is required');
    }
    function hasUnsupportedDevices(value) {
      if (value.devices != null && (!Array.isArray(value.devices) || value.devices.length)) return true;
      return ['atdFlowM3h', 'openFlowM3h'].some(function (key) {
        return value[key] != null && (!Number.isFinite(Number(value[key])) || Number(value[key]) !== 0);
      });
    }
    if ((input.ventilationSystem && input.ventilationSystem !== 'Natural ventilation') ||
        hasUnsupportedDevices(input)) {
      throw new RangeError('This reference route supports natural ventilation without devices only');
    }
    if (!Array.isArray(input.rooms) || !input.rooms.length) {
      throw new RangeError('A complete ventilation-zone room list is required');
    }
    var outside = Number(input.outdoorTemperature);
    if (input.outdoorTemperature == null || input.outdoorTemperature === '' ||
        !Number.isFinite(outside)) throw new RangeError('Outdoor temperature is required');
    var facades = positiveNumber(input.exposedFacades, 'Number of exposed facades');
    if (!Number.isInteger(facades)) throw new RangeError('Exposed facades must be an integer');
    var direction = positiveNumber(input.directionFactor, 'Sourced room direction factor');
    var coefficient = exposure.exposureCoefficient(input);
    var measured = input.permeability50 != null && input.permeability50 !== '';
    var q50 = measured ? nonNegativeNumber(input.permeability50, 'Air permeability at 50 Pa')
      : DEFAULT_PERMEABILITY_50;
    var seen = {};
    var rooms = input.rooms.map(function (room) {
      var id = String(room.id || '');
      if (!id || seen[id]) throw new RangeError('Room identifiers must be present and unique');
      seen[id] = true;
      if (hasUnsupportedDevices(room)) throw new RangeError('Room ventilation devices are unsupported');
      var volume = positiveNumber(room.volume, 'Room volume');
      if (room.envelopeArea == null || room.envelopeArea === '') {
        throw new RangeError('Room external envelope area is required');
      }
      var envelopeArea = nonNegativeNumber(room.envelopeArea, 'Room envelope area');
      var temperature = Number(room.indoorTemperature);
      if (room.indoorTemperature == null || room.indoorTemperature === '' ||
          !Number.isFinite(temperature) || temperature <= outside) {
        throw new RangeError('Room design temperature must exceed outdoor temperature');
      }
      var minimumAch = room.minimumAch == null ? MINIMUM_ROOM_ACH
        : nonNegativeNumber(room.minimumAch, 'Room minimum ACH');
      if (!envelopeArea) minimumAch = 0;
      return { id: id, volume: volume, envelopeArea: envelopeArea,
        indoorTemperature: temperature, minimumAch: minimumAch,
        minimumFlowM3h: minimumAch * volume };
    });
    var envelope = rooms.reduce(function (sum, room) { return sum + room.envelopeArea; }, 0);
    if (!envelope) throw new RangeError('The zone needs a positive external envelope area');
    var zoneFlow = q50 * envelope * coefficient;
    var roomToZone = rooms.length === 1 ? 1 : 0.5;
    rooms.forEach(function (room) {
      room.leakageFlowM3h = zoneFlow * room.envelopeArea / envelope;
      room.peakInfiltrationFlowM3h = Math.min(zoneFlow, room.leakageFlowM3h * direction);
      room.roomOutdoorFlowM3h = Math.max(room.peakInfiltrationFlowM3h, room.minimumFlowM3h);
      room.zoneOutdoorFlowM3h = Math.max(room.leakageFlowM3h, roomToZone * room.minimumFlowM3h);
      var deltaT = room.indoorTemperature - outside;
      room.roomVentilationWatts = 0.34 * room.roomOutdoorFlowM3h * deltaT;
      room.zoneVentilationWatts = 0.34 * room.zoneOutdoorFlowM3h * deltaT;
    });
    return {
      methodId: 'reference-natural-ventilation-v2',
      scope: 'Natural ventilation without mechanical systems, combustion openings or ATDs',
      permeability50: q50, permeabilitySource: measured ? 'entered-q50' : 'standard-default',
      exposureCoefficient: coefficient, directionFactor: direction,
      roomToZoneCoefficient: roomToZone, envelopeArea: envelope,
      zoneInfiltrationFlowM3h: zoneFlow, heatCapacityWhM3K: 0.34, rooms: rooms,
      roomVentilationWatts: rooms.reduce(function (sum, room) { return sum + room.roomVentilationWatts; }, 0),
      zoneVentilationWatts: rooms.reduce(function (sum, room) { return sum + room.zoneVentilationWatts; }, 0)
    };
  }

  return {
    calculateNaturalZone: calculateNaturalZone,
    buildingInfiltration: buildingInfiltration,
    roomVentilation: roomVentilation,
    deviceFlowM3h: deviceFlowM3h,
    isTerminalDevice: isTerminalDevice,
    methodId: METHOD_ID,
    deviceFlows: DEVICE_FLOWS,
    roomTypes: ROOM_TYPES
  };
});
