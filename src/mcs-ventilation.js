(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.McsVentilation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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
  // The published MCS pages do not disclose the full BS EN 12831 exposure
  // coefficient table. Therefore callers must provide the calculated normal
  // exposure factor: accepting a q50 input alone would silently produce a
  // non-compliant, optimistic result. This module is not wired into live
  // surveys until that coefficient calculation is fully sourced and benchmarked.

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

  return {
    buildingInfiltration: buildingInfiltration,
    roomVentilation: roomVentilation,
    deviceFlowM3h: deviceFlowM3h,
    isTerminalDevice: isTerminalDevice,
    methodId: METHOD_ID,
    deviceFlows: DEVICE_FLOWS,
    roomTypes: ROOM_TYPES
  };
});
