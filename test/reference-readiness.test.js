'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readiness = require('../src/reference-readiness.js');

test('reports the missing evidence that blocks a standards-reference building load', () => {
  const result = readiness.evaluate({
    designStation: 'Manchester',
    groundStation: 'Manchester',
    dwellingAttachment: 'Semi-detached',
    airtightnessMethod: 'Measured 50 Pa permeability'
  });

  assert.equal(result.inputsComplete, false);
  assert.deepEqual(result.missing, [
    'ventilation-zone storeys',
    'sheltered external sides',
    'measured 50 Pa air permeability',
    'air-test envelope area',
    'air-test envelope volume'
  ]);
  assert.equal(result.readyForSizing, false);
  assert.match(result.statusText, /not used for boiler sizing/i);
});

test('records complete standard-method evidence but keeps the reference route in validation', () => {
  const result = readiness.evaluate({
    designStation: 'Manchester',
    groundStation: 'Manchester',
    dwellingAttachment: 'Semi-detached',
    ventilationStoreys: '2',
    shelteredSides: '2',
    airtightnessMethod: 'Standard default'
  });

  assert.equal(result.inputsComplete, true);
  assert.deepEqual(result.missing, []);
  assert.equal(result.readyForSizing, false);
  assert.match(result.statusText, /inputs complete.*validation/i);
});

test('accepts justified design infiltration ACH without air-test fields', () => {
  const result = readiness.evaluate({
    designStation: 'Manchester',
    groundStation: 'Manchester',
    dwellingAttachment: 'Detached',
    ventilationStoreys: '1',
    shelteredSides: '0',
    airtightnessMethod: 'Design infiltration ACH',
    designInfiltrationAch: '0.55'
  });

  assert.equal(result.inputsComplete, true);
  assert.deepEqual(result.missing, []);
});
