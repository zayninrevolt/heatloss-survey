'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const validation = require('../src/validation.js');

test('accepts plausible room inputs', () => {
  assert.deepEqual(validation.validateRoom({
    started: true, length: 4, width: 5, height: 2.4,
    indoor: 21, outdoor: -3, ground: 10, manualAch: 0.5,
    uValues: [{ label: 'Wall', value: 0.55 }], radiatorOutputsKw: [1.5]
  }), []);
});

test('returns actionable warnings for each physical range', () => {
  const warnings = validation.validateRoom({
    started: true, length: 0.2, width: 40, height: 8,
    indoor: 35, outdoor: 36, ground: 30, manualAch: 8,
    uValues: [{ label: 'Wall', value: 8 }], radiatorOutputsKw: [25]
  });
  assert.equal(warnings.length, 10);
  assert.ok(warnings.some(message => message.includes('Room length')));
  assert.ok(warnings.some(message => message.includes('U-value')));
  assert.ok(warnings.some(message => message.includes('radiator output')));
});

test('does not warn about empty optional U-values or radiator outputs', () => {
  assert.deepEqual(validation.validateRoom({
    indoor: 18, outdoor: -3, ground: 10,
    uValues: [{ label: 'Floor', value: 0 }], radiatorOutputsKw: [0]
  }), []);
});
