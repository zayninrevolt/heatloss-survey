'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sizing = require('../src/radiator-sizing.js');

const factors = { 20: 0.302, 21: 0.322, 22: 0.342, 50: 1, 65: 1.408 };
const models = [
  { type: 'K1', height: 600, wattsPerMetre: 1000, widths: [400, 600, 1000] },
  { type: 'K2', height: 600, wattsPerMetre: 1778, widths: [400, 600, 1000] },
  { type: 'K3', height: 500, wattsPerMetre: 2169, widths: [600] }
];

test('correction-factor lookup clamps boundaries and interpolates', () => {
  assert.equal(sizing.correctionFactor(10, factors), 0.302);
  assert.equal(sizing.correctionFactor(20.5, factors), 0.312);
  assert.equal(sizing.correctionFactor(80, factors), 1.408);
});

test('published delta-T50 output scales by width and correction factor', () => {
  assert.equal(sizing.output(models[1], 600, 1), 1066.8);
  assert.equal(sizing.output(models[1], 600, 0.5), 533.4);
});

test('new-installation options exclude legacy 500 mm models and obey filters', () => {
  const options = sizing.individualOptions({
    models,
    correctionFactor: 1,
    filters: { maxWidth: 600, panelType: 'K2' },
    newInstallation: true
  });
  assert.deepEqual(options.map(option => option.size), [
    '600(h) x 400(w) K2', '600(h) x 600(w) K2'
  ]);
});

test('single-radiator options enforce requirement and 50% oversize boundary', () => {
  const options = [
    { size: 'too small', watts: 999, ratedWatts: 999 },
    { size: 'exact', watts: 1000, ratedWatts: 1000 },
    { size: 'limit', watts: 1500, ratedWatts: 1500 },
    { size: 'too large', watts: 1500.02, ratedWatts: 1500.02 }
  ];
  assert.deepEqual(sizing.suitableOptions(1000, options, 1)
    .map(option => option.size), ['exact', 'limit']);
});

test('automatic selection falls back to the smallest valid two-radiator pair', () => {
  const units = [
    { size: 'A', watts: 700 },
    { size: 'B', watts: 900 },
    { size: 'C', watts: 1200 }
  ];
  const pairs = sizing.suitablePairs(1600, units);
  assert.deepEqual(pairs.pairs.map(pair => [pair.size, pair.watts]), [
    ['A + B', 1600], ['B + B', 1800], ['A + C', 1900],
    ['B + C', 2100], ['C + C', 2400]
  ]);
  assert.equal(sizing.selectRadiators(1600, [], pairs, 'Automatic').size, 'A + B');
});

test('system output retains 12 kW minimum and applies 10% headroom above it', () => {
  assert.equal(sizing.recommendedSystemOutputKw(5000), 12);
  assert.equal(sizing.recommendedSystemOutputKw(15000), 16.5);
});
