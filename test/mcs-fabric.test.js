'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fabric = require('../src/mcs-fabric.js');

test('MCS-reference bridge factors distinguish external defaults, internal defaults and known U-values', () => {
  for (const band of 'ABCDEFGHIJKLM') {
    const external = 'ABCDEFGHI'.includes(band) ? 0.15 : band === 'J' ? 0.11 : 0.08;
    const internal = 'ABCDEFGHIJK'.includes(band) ? 0.10 : 0.05;
    assert.equal(fabric.defaultBridgeFactor(band, 'external-default'), external, band);
    assert.equal(fabric.defaultBridgeFactor(band, 'internal-default'), internal, band);
    assert.equal(fabric.defaultBridgeFactor(band, 'known-u'), internal, band);
  }
  assert.throws(() => fabric.defaultBridgeFactor('Unknown', 'external-default'), /age band/i);
  assert.throws(() => fabric.defaultBridgeFactor('C', 'guessed'), /category/i);
});

test('element calculation deducts openings and applies bridging at the actual boundary temperature', () => {
  const input = {
    grossArea: 12, openingAreas: [2, 1], uValue: 0.55,
    indoorTemperature: 21, boundaryTemperature: 10,
    propertyAgeBand: 'C', bridgeCategory: 'external-default'
  };
  const result = fabric.calculateElement(input);
  assert.equal(result.methodId, 'mcs-reference-fabric-v1');
  assert.equal(result.netArea, 9);
  assert.equal(result.deltaT, 11);
  assert.equal(result.bridgeFactor, 0.15);
  assert.ok(Math.abs(result.baseWatts - 9 * 0.55 * 11) < 1e-9);
  assert.ok(Math.abs(result.bridgeWatts - 9 * 0.15 * 11) < 1e-9);
  assert.ok(Math.abs(result.totalWatts - 9 * (0.55 + 0.15) * 11) < 1e-9);
  assert.deepEqual(input.openingAreas, [2, 1]);
});

const element = {
  grossArea: 12, openingAreas: [], uValue: 0.55,
  indoorTemperature: 21, boundaryTemperature: -3,
  propertyAgeBand: 'C', bridgeCategory: 'known-u'
};

test('known-U elements accept an explicit zero bridge factor without guessing an unknown age', () => {
  const output = fabric.calculateElement({ ...element, propertyAgeBand: 'Unknown', bridgeFactor: 0 });
  assert.equal(output.bridgeFactor, 0);
  assert.equal(output.bridgeWatts, 0);
  assert.equal(output.bridgeSource, 'explicit');
  assert.ok(Math.abs(output.totalWatts - 12 * 0.55 * 24) < 1e-9);
});

test('invalid element measurements fail explicitly instead of producing plausible loads', () => {
  for (const invalid of [
    { grossArea: -1 }, { grossArea: '' }, { grossArea: '12' }, { grossArea: Infinity },
    { openingAreas: [13] }, { openingAreas: [-1] }, { openingAreas: [NaN] },
    { openingAreas: null }, { uValue: undefined }, { uValue: -1 },
    { indoorTemperature: '' }, { boundaryTemperature: null }, { boundaryTemperature: NaN },
    { bridgeFactor: -1 }, { bridgeFactor: NaN }, { bridgeCategory: 'guessed' }
  ]) {
    assert.throws(() => fabric.calculateElement({ ...element, ...invalid }), undefined, JSON.stringify(invalid));
  }
});

