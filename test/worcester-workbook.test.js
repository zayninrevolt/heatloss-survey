const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const heatLoss = require('../src/heat-loss.js');
const reference = require('./fixtures/worcester-training-reference.json');

function close(actual, expected, label) {
  assert.ok(Number.isFinite(actual), `${label}: non-finite result`);
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);
}

function checkCase(engine, fixture) {
  const result = engine.computeHeatLossValues(fixture.input);
  for (const key of Object.values(reference.componentCells)) {
    close(result[key], fixture.expected[key], `${fixture.name}/${key}`);
  }
  close(result.totalWatts - result.bridgeWatts,
    fixture.expected.beforeBridgingWatts, `${fixture.name}/H50 before bridging`);
  const final = engine.applyAdditionalHeatLossFactors(result.totalWatts, fixture.factors);
  close(final.totalWatts, fixture.expected.totalWatts, `${fixture.name}/I54 final room watts`);
  close(final.totalWatts / fixture.input.floorArea,
    fixture.expected.wattsPerSquareMetre, `${fixture.name}/K54 watts per square metre`);
}

test('workbook fixtures have a pinned independent source and declare their limits', () => {
  assert.equal(reference.provenance.workbook, 'WBTA-000056-001-042024');
  assert.equal(reference.provenance.workbookSha256,
    'd83f230c543fb014cc5a4a415842941b5d7d414fa7b9873fb59488c5872d2f29');
  assert.match(reference.provenance.scope, /not native Excel/);
  assert.match(reference.provenance.ceilingFactor, /supplied explicitly/);
  assert.equal(reference.cases.length, 10);
  assert.equal(new Set(reference.cases.map(c => c.name)).size, reference.cases.length);
});

for (const fixture of reference.cases) {
  test(`Worcester training workbook parity: ${fixture.name}`, () => checkCase(heatLoss, fixture));
}

test('workbook parity detects a ventilation-coefficient regression in an isolated engine', () => {
  const source = fs.readFileSync(require.resolve('../src/heat-loss.js'), 'utf8');
  const target = 'var ventilationWatts = 0.33 * ventilationFlowM3h * deltaT;';
  assert.equal(source.split(target).length, 2, 'The mutation must affect exactly one coefficient');
  const context = { module: { exports: {} } };
  vm.runInNewContext(source.replace(target,
    'var ventilationWatts = 0.34 * ventilationFlowM3h * deltaT;'), context);
  assert.throws(() => checkCase(context.module.exports, reference.cases[0]), /ventilationWatts/);
});
