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

test('returns structured blocking errors for incomplete required engineering inputs', () => {
  const issues = validation.validateRoomDetails({
    started: true,
    length: '',
    width: 'not-a-number',
    height: Infinity,
    indoor: '',
    outdoor: NaN,
    ground: '',
    groundRequired: true,
    ventilationAch: NaN,
    ventilationRequired: true,
    uValues: [
      { label: 'External wall', value: 0, required: true },
      { label: 'Floor', value: 0, required: false }
    ]
  });

  assert.deepEqual(
    issues.filter(issue => issue.severity === 'error').map(issue => issue.field),
    ['length', 'width', 'height', 'indoor', 'outdoor', 'ground',
      'external-wall-u-value', 'ventilation-ach']
  );
  assert.equal(validation.canRecommendRadiator(issues), false);
});

test('allows documented chimney ACH above the normal room-air-change guard', () => {
  assert.deepEqual(validation.validateRoomDetails({
    started: true, length: 4, width: 5, height: 2.4,
    indoor: 21, outdoor: -3, ground: 10,
    ventilationAch: 6.5, ventilationAchMaximum: 6.5,
    ventilationRequired: true,
    uValues: [], radiatorOutputsKw: []
  }), []);
});

test('allows recommendations when required inputs are valid and optional zero values are absent', () => {
  const issues = validation.validateRoomDetails({
    started: true,
    length: 4,
    width: 5,
    height: 2.4,
    indoor: 21,
    outdoor: -3,
    ground: 10,
    groundRequired: true,
    ventilationAch: 0.5,
    ventilationRequired: true,
    uValues: [
      { label: 'External wall', value: 0.55, required: true },
      { label: 'Floor', value: 0, required: false }
    ]
  });

  assert.deepEqual(issues, []);
  assert.equal(validation.canRecommendRadiator(issues), true);
});
