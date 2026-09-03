'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const heatLoss = require('../src/heat-loss.js');

function closeTo(actual, expected, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test('calculates a known reference room by component', () => {
  const result = heatLoss.computeHeatLossValues({
    deltaT: 24,
    internalDeltaT: 3,
    floorDeltaT: 11,
    floorArea: 20,
    volume: 48,
    netWallArea: 18,
    wallU: 0.55,
    internalWallArea: 12,
    internalWallU: 1.76,
    windowArea: 3,
    windowU: 1.6,
    doorArea: 1.8,
    doorU: 1.4,
    floorU: 0.25,
    roofU: 0.21,
    ventilationFlowM3h: 24,
    bridgePercent: 10
  });

  const expected = {
    wallWatts: 237.60000000000002,
    internalWallWatts: 63.36,
    windowWatts: 115.20000000000002,
    doorWatts: 60.48,
    floorWatts: 55,
    roofWatts: 100.8,
    ventilationFlowM3h: 24,
    ventilationWatts: 190.08,
    bridgeWatts: 82.25200000000001,
    fabricWatts: 714.6920000000001,
    totalWatts: 904.7720000000001
  };
  for (const [component, value] of Object.entries(expected)) {
    closeTo(result[component], value);
  }
});

test('uses an age-based thermal-bridge factor when supplied', () => {
  const result = heatLoss.computeHeatLossValues({
    deltaT: 20,
    netWallArea: 10,
    wallU: 1,
    bridgeArea: 30,
    bridgeFactorWm2K: 0.08
  });
  assert.equal(result.wallWatts, 200);
  assert.equal(result.bridgeWatts, 48);
  assert.equal(result.totalWatts, 248);
});

test('ground-floor temperature differences use ground rather than outdoor air', () => {
  const cases = [
    ['Uninsulated solid ground floor', 21, -3, 10, '', 11],
    ['Suspended timber ground floor, uninsulated', 21, -3, 10, '', 24],
    ['Floor above unheated cellar or garage', 21, -3, 10, '', 12],
    ['Floor above unheated cellar or garage', 21, -3, 10, '8', 13],
    ['Heated room below', 21, -3, 10, '', 0]
  ];
  for (const [type, indoor, outdoor, ground, adjacent, expected] of cases) {
    assert.equal(heatLoss.floorTemperatureDifference(
      type, indoor, outdoor, ground, adjacent), expected, type);
  }
});

test('ventilation includes recovery, devices, and distributed PIV flow', () => {
  const cases = [
    [{ volume: 50, ach: 0.5 }, 25],
    [{ volume: 50, ach: 0.5, heatRecovery: true, recoveryEfficiency: 80 }, 5],
    [{ volume: 50, ach: 0.5, deviceFlowM3h: 10, pivFlowM3h: 4 }, 39]
  ];
  for (const [input, expected] of cases) {
    closeTo(heatLoss.ventilationFlow(input), expected);
  }
});

test('altitude correction applies only for each complete 100 m above station', () => {
  const cases = [
    [-3, 99, 0, 0, -3],
    [-3, 100, 0, 1, -3.6],
    [-3, 299, 50, 2, -4.2],
    [-3, 25, 100, 0, -3]
  ];
  for (const [base, property, station, steps, temperature] of cases) {
    const result = heatLoss.altitudeAdjustedTemperature(base, property, station);
    assert.equal(result.steps, steps);
    closeTo(result.temperature, temperature);
  }
});

test('geometry helpers cover perimeter boundaries', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(count =>
    heatLoss.estimatedWallLength(5, 4, count)), [0, 4, 9, 14, 18]);
  assert.equal(heatLoss.remainingInternalWallLength(5, 4, 7), 11);
  assert.equal(heatLoss.remainingInternalWallLength(5, 4, 99), 0);
});

test('invalid and negative inputs cannot create negative or non-finite loss', () => {
  const result = heatLoss.computeHeatLossValues({
    deltaT: -10,
    floorArea: Infinity,
    netWallArea: 'not-a-number',
    ach: -1
  });
  assert.equal(result.totalWatts, 0);
  assert.ok(Object.values(result).every(Number.isFinite));
});

test('selects the requested age and room based minimum ACH values', () => {
  const oldProperty = [
    ['Bathroom', 3.0],
    ['Bedroom', 1.0],
    ['Bedroom with en-suite', 2.0],
    ['Kitchen', 2.0],
    ['Hallway', 2.0],
    ['Landing', 2.0],
    ['Lounge', 1.5],
    ['D Room', 1.5],
    ['WC', 2.0],
    ['Utility room', 3.0],
    ['Internal room/corridor', 0.0]
  ];
  for (const [room, expected] of oldProperty) {
    assert.equal(heatLoss.minimumRoomAirChangeRate(room, 'H'), expected, room);
  }
  assert.equal(heatLoss.minimumRoomAirChangeRate('Kitchen', 'I'), 1.5);
  assert.equal(heatLoss.minimumRoomAirChangeRate('Kitchen', 'J'), 1.5);
  assert.equal(heatLoss.minimumRoomAirChangeRate('Bedroom', 'K'), 0.5);
  assert.equal(heatLoss.minimumRoomAirChangeRate('Landing', 'H', true), 2.0);
  assert.equal(heatLoss.minimumRoomAirChangeRate('Landing', 'H', false), 0.0);
  assert.equal(heatLoss.roomDesignTemperature('Bedroom with en-suite', 'H'), 21);
  assert.equal(heatLoss.roomDesignTemperature('Study', 'H'), 21);
  assert.equal(heatLoss.roomDesignTemperature('Bedroom', 'H'), 18);
  assert.equal(heatLoss.roomDesignTemperature('Bedroom', 'K'), 21);
  assert.equal(heatLoss.roomDesignTemperature('Bathroom', 'K'), 22);
  assert.equal(heatLoss.roomDesignTemperature('Hall', 'K'), 21);
});

test('BBOE derates radiator output without changing the room requirement', () => {
  assert.equal(heatLoss.radiatorSizingRequirement(2000, 'TBOE'), 2000);
  assert.equal(heatLoss.radiatorSizingRequirement(2000, 'BBOE'), 2000);
  assert.equal(heatLoss.radiatorSizingRequirement(2000, ''), 2000);
  assert.equal(heatLoss.radiatorConnectionOutputFactor('TBOE'), 1);
  assert.equal(heatLoss.radiatorConnectionOutputFactor('BBOE'), 0.96);
  assert.equal(heatLoss.radiatorConnectionOutputFactor(''), 1);
});

test('preserves signed heat gains and applies percentage bridges to the complete room load', () => {
  const result = heatLoss.computeHeatLossValues({
    deltaT: 20,
    internalDeltaT: -4,
    internalWallArea: 10,
    internalWallU: 1,
    ventilationFlowM3h: 100,
    bridgePercent: 10
  });
  assert.equal(result.internalWallWatts, -40);
  assert.equal(result.ventilationWatts, 660);
  assert.equal(result.bridgeWatts, 62);
  assert.equal(result.totalWatts, 682);
});

test('uses an explicit adjacent temperature for roofs and retains signed floor gains', () => {
  assert.equal(heatLoss.roofTemperatureDifference(21, -3, ''), 24);
  assert.equal(heatLoss.roofTemperatureDifference(18, -3, '21'), -3);
  assert.equal(heatLoss.floorTemperatureDifference('Heated room below', 18, -3, 10, '21'), -3);
});

test('uses the DHDG ventilation age categories and chimney rates', () => {
  assert.equal(heatLoss.minimumRoomAirChangeRate('Lounge', '2000-2006', true), 1);
  assert.equal(heatLoss.minimumRoomAirChangeRate('Lounge', '2006+', true), 0.5);
  assert.equal(heatLoss.chimneyAirChangeRate(35, false), 5);
  assert.equal(heatLoss.chimneyAirChangeRate(60, true), 2);
});

test('applies documented additional room factors in sequence', () => {
  const result = heatLoss.applyAdditionalHeatLossFactors(2000, {
    thermalBridge: 1.1,
    intermittent: 1.1,
    exposed: 1.1,
    highCeiling: 1.05
  });
  assert.ok(Math.abs(result.totalWatts - 2795.1) < 0.001);
  assert.ok(Math.abs(result.additionalWatts - 795.1) < 0.001);
});
