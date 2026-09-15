'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ventilation = require('../src/mcs-ventilation.js');

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9,
  `expected ${actual} to be ${expected}`);

test('does not treat permeability divided by twenty as a complete MCS infiltration result', () => {
  assert.throws(() => ventilation.buildingInfiltration({
    envelopeArea: 100, internalVolume: 200
  }), /normal exposure/i);

  const property = ventilation.buildingInfiltration({
    envelopeArea: 100, internalVolume: 200,
    // A deliberately neutral comparison multiplier. Live MCS use needs a
    // sourced value based on storeys, exposed facades and site altitude.
    normalExposureFactor: 1,
    shelterLevel: 'normal'
  });
  assert.equal(property.permeability50, 12);
  assert.equal(property.permeabilitySource, 'standard-default');
  assert.equal(property.exposureSource, 'caller-provided-normal-exposure-factor');
  close(property.normalExposureFactor, 1);
  close(property.shelterFactor, 1);
  close(property.infiltrationFlowM3h, 12 / 20 * 100);
  close(property.infiltrationAch, 0.3);

  const tested = ventilation.buildingInfiltration({
    envelopeArea: 100, internalVolume: 200, permeability50: 5,
    normalExposureFactor: 1, shelterLevel: 'normal'
  });
  assert.equal(tested.permeabilitySource, 'measured');
  close(tested.infiltrationFlowM3h, 5 / 20 * 100);
});

test('matches Heatpunk Fixture A shelter ratios once its normal-exposure factor is supplied', () => {
  // Observed in Heatpunk Standard method, 4 exposed façades, one storey,
  // q50 = 12, envelope 45.6 m², volume 28.8 m³, altitude 104 m.
  const shared = {
    envelopeArea: 45.6,
    internalVolume: 28.8,
    permeability50: 12,
    normalExposureFactor: 1.263157894736842
  };
  const normal = ventilation.buildingInfiltration({ ...shared, shelterLevel: 'normal' });
  const none = ventilation.buildingInfiltration({ ...shared, shelterLevel: 'none' });
  const intensive = ventilation.buildingInfiltration({ ...shared, shelterLevel: 'intensive' });

  close(normal.infiltrationFlowM3h, 34.56);
  close(none.infiltrationFlowM3h, 48.384);
  close(intensive.infiltrationFlowM3h, 20.736);
  close(none.infiltrationFlowM3h / normal.infiltrationFlowM3h, 1.4);
  close(intensive.infiltrationFlowM3h / normal.infiltrationFlowM3h, 0.6);
  assert.throws(() => ventilation.buildingInfiltration({
    ...shared, shelterLevel: 'woodland'
  }), /shelter/i);
});

test('a design air change rate replaces the permeability route instead of adding to it', () => {
  const property = ventilation.buildingInfiltration({
    envelopeArea: 100, internalVolume: 200, designAch: 0.5
  });
  assert.equal(property.permeabilitySource, 'design-air-change-rate');
  assert.equal(property.permeability50, null);
  close(property.infiltrationFlowM3h, 0.5 * 200);
});

test('infiltration, intentional ventilation and the room minimum are separate flows', () => {
  const property = ventilation.buildingInfiltration({ envelopeArea: 100, internalVolume: 200, normalExposureFactor: 1 });
  const room = ventilation.roomVentilation({
    roomType: 'Lounge/sitting room', roomVolume: 40, hasExternalEnvelope: true,
    property: property, ventilationSystem: 'Natural ventilation'
  });
  assert.equal(room.minimumAch, 0.5);
  close(room.minimumFlowM3h, 20);
  close(room.infiltrationFlowM3h, 12);
  close(room.flowM3h, 20);
  assert.equal(room.governed, 'room-minimum');

  const internal = ventilation.roomVentilation({
    roomType: 'Internal room/corridor', roomVolume: 40, hasExternalEnvelope: false,
    property: property, ventilationSystem: 'Natural ventilation'
  });
  assert.equal(internal.minimumAch, 0);
  close(internal.flowM3h, 12);
  assert.equal(internal.governed, 'infiltration');
});

test('mechanical ventilation flows follow the reference rates and MVHR recovery', () => {
  const property = ventilation.buildingInfiltration({ envelopeArea: 100, internalVolume: 200, normalExposureFactor: 1 });
  const mvhr = ventilation.roomVentilation({
    roomType: 'Lounge/sitting room', roomVolume: 40, hasExternalEnvelope: true,
    property: property, ventilationSystem: 'MVHR', mvhrEfficiency: 75
  });
  close(mvhr.mechanicalSupplyM3h, 20);
  close(mvhr.heatRecoveryFactor, 0.25);
  close(mvhr.flowM3h, 20);
  close(mvhr.heatLossFlowM3h, 5);

  const mev = ventilation.roomVentilation({
    roomType: 'Bathroom', roomVolume: 10, hasExternalEnvelope: true,
    property: property, ventilationSystem: 'MEV', mvhrEfficiency: 0
  });
  assert.equal(mev.mechanicalSupplyM3h, 0);
  close(mev.mechanicalExtractM3h, 5);
  close(mev.flowM3h, 5);
});

test('ventilation devices add their published airflow to the governing flow', () => {
  const property = ventilation.buildingInfiltration({ envelopeArea: 100, internalVolume: 200, normalExposureFactor: 1 });
  const room = ventilation.roomVentilation({
    roomType: 'Lounge/sitting room', roomVolume: 40, hasExternalEnvelope: true,
    property: property, ventilationSystem: 'Natural ventilation',
    devices: ['Open chimney', 'Intermittent extract fan']
  });
  close(room.deviceFlowM3h, 90);
  close(room.flowM3h, 20 + 90);
  assert.equal(ventilation.deviceFlowM3h('Chimney, permanently blocked'), 20);
  assert.equal(ventilation.deviceFlowM3h('Passive vent'), 10);
  assert.equal(ventilation.deviceFlowM3h('No additional vent or flue'), 0);
});

test('invalid ventilation inputs fail explicitly rather than defaulting silently', () => {
  assert.throws(() => ventilation.buildingInfiltration({ envelopeArea: 0, internalVolume: 200 }), /envelope/i);
  assert.throws(() => ventilation.buildingInfiltration({ envelopeArea: 100, internalVolume: 0 }), /volume/i);
  assert.throws(() => ventilation.buildingInfiltration({ envelopeArea: 100, internalVolume: 200, permeability50: -1 }), /permeability/i);
  assert.throws(() => ventilation.roomVentilation({
    roomType: 'Not a room', roomVolume: 10, hasExternalEnvelope: true,
    property: { infiltrationFlowM3h: 10, internalVolume: 200 }, ventilationSystem: 'Natural ventilation'
  }), /room type/i);
});

test('terminal ventilation devices are reported separately from infiltration', () => {
  const property = ventilation.buildingInfiltration({ envelopeArea: 100, internalVolume: 200, normalExposureFactor: 1 });
  const room = ventilation.roomVentilation({
    roomType: 'Kitchen', roomVolume: 30, hasExternalEnvelope: true,
    property: property, ventilationSystem: 'Natural ventilation',
    devices: ['Passive vent', 'Flueless gas fire']
  });
  assert.deepEqual(room.terminalDevices, ['Passive vent', 'Flueless gas fire']);
  close(room.deviceFlowM3h, 50);
});
