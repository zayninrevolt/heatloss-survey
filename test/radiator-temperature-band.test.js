'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sizing = require('../src/radiator-sizing.js');

const factors = { 15: 0.199, 19: 0.283, 20: 0.302, 50: 1, 65: 1.408 };

test('correction factors cover delta-T 20 down to delta-T 15', () => {
  assert.equal(typeof sizing.correctionFactor, 'function');
  // Above 20 K the published table is read directly.
  assert.equal(sizing.correctionFactor(20, factors), 0.302);
  assert.equal(sizing.correctionFactor(50, factors), 1);
  // Below 20 K the factor is derived with the manufacturer's exponent law
  // (delta-T / 20) ^ 1.3 applied to the lowest published entry.
  assert.equal(sizing.correctionFactor(15, factors),
    0.302 * Math.pow(15 / 20, 1.3));
  assert.equal(sizing.correctionFactor(19, factors),
    0.302 * Math.pow(19 / 20, 1.3));
  assert.ok(sizing.correctionFactor(15, factors) <
    sizing.correctionFactor(20, factors));
});

test('a 45 degC flow with a 21 degC room resolves a delta-T of 19 without clamping', () => {
  assert.equal(typeof sizing.meanWaterDeltaT, 'function');
  const resolved = sizing.meanWaterDeltaT({ flow: 45, room: 21 });
  assert.equal(resolved.drop, 10);
  assert.equal(resolved.meanWater, 40);
  assert.equal(resolved.deltaT, 19);
  assert.equal(resolved.tabulated, false, '19 K is below the published 20 K table entry');
  const tabulated = sizing.meanWaterDeltaT({ flow: 75, room: 21 });
  assert.equal(tabulated.deltaT, 49);
  assert.equal(tabulated.tabulated, true);
});

test('out-of-range flow/room combinations are rejected rather than clamped', () => {
  // 45 degC flow in a 26 degC room gives a 14 K delta-T, too low to use.
  assert.equal(sizing.meanWaterDeltaT({ flow: 45, room: 26 }).deltaT, 14);
  assert.equal(sizing.meanWaterDeltaT({ flow: 45, room: 26 }).tabulated, false);
  assert.equal(sizing.meanWaterDeltaT({ flow: 45, room: 26 }).usable, false);
  // A 21 degC room at 45 degC flow is usable but not tabulated.
  const low = sizing.meanWaterDeltaT({ flow: 45, room: 21 });
  assert.equal(low.deltaT, 19);
  assert.equal(low.usable, true);
  assert.equal(low.tabulated, false);
  // The top of the range stays inside the published table.
  assert.equal(sizing.meanWaterDeltaT({ flow: 75, room: 21 }).usable, true);
  assert.equal(sizing.meanWaterDeltaT({ flow: 75, room: 21 }).tabulated, true);
  assert.equal(sizing.meanWaterDeltaT({ flow: 300, room: 21 }).usable, false);
});

test('supported flow temperatures are exactly 45 to 75 in 5 degC steps', () => {
  assert.deepEqual(sizing.SUPPORTED_FLOW_TEMPERATURES, [45, 50, 55, 60, 65, 70, 75]);
});

test('a 45 degC design is flagged as extrapolated while 50 degC is tabulated', () => {
  // A 21 degC room: 45 degC flow gives 19 K, 50 degC flow gives 24 K.
  assert.equal(sizing.meanWaterDeltaT({ flow: 45, room: 21 }).tabulated, false);
  assert.equal(sizing.meanWaterDeltaT({ flow: 50, room: 21 }).tabulated, true);
  // A 22 degC bathroom is 1 K lower, so 50 degC is still tabulated and 45 degC is not.
  assert.equal(sizing.meanWaterDeltaT({ flow: 50, room: 22 }).tabulated, true);
  assert.equal(sizing.meanWaterDeltaT({ flow: 45, room: 22 }).tabulated, false);
});

test('the recorded flow-to-return spread stays 10 K at every supported temperature', () => {
  for (const flow of sizing.SUPPORTED_FLOW_TEMPERATURES) {
    const resolved = sizing.meanWaterDeltaT({ flow, room: 21 });
    assert.equal(resolved.drop, 10, String(flow));
    assert.equal(resolved.meanWater, flow - 5, String(flow));
    assert.equal(resolved.usable, true, String(flow));
  }
});
