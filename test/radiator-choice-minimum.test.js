const assert = require('node:assert/strict');
const test = require('node:test');
const sizing = require('../src/radiator-sizing.js');
const catalogue = [700, 900, 1100, 1300, 1800, 2200].map((watts, index) => ({
  size: `Size ${index}`, watts, height: 600, width: 400 + index * 100, type: 'K2'
}));

test('tops up a short replacement list with the closest adequate outputs without changing recommendations', () => {
  const recommended = sizing.suitableOptions(1000, catalogue);
  const before = JSON.stringify(recommended);
  const choices = sizing.closestReplacementChoices(1000, recommended, catalogue);
  assert.equal(choices.length, 4);
  assert.deepEqual(choices.map((option) => option.watts), [1100, 1300, 1800, 2200]);
  assert.ok(choices.every((option) => option.watts >= 1000));
  assert.deepEqual(choices.filter((option) => option.oversizeAlternative).map((option) => option.watts), [1800, 2200]);
  assert.equal(JSON.stringify(recommended), before);
  assert.equal(sizing.selectRadiators(1000, recommended, { pairs: [] }, '1').watts, 1100);
});

test('does not count an existing-size duplicate or fabricate options beyond available catalogue constraints', () => {
  const existing = { ...catalogue[2], existingReplacement: true };
  const choices = sizing.closestReplacementChoices(1000, [existing], catalogue);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices.map((option) => option.size)).size, 4);
  const limited = sizing.closestReplacementChoices(1000, [], catalogue.slice(0, 3));
  assert.deepEqual(limited.map((option) => option.watts), [1100]);
  assert.deepEqual(sizing.closestReplacementChoices(0, [], catalogue), []);
});

test('two-radiator top-ups test combined output rather than rejecting valid smaller individual emitters', () => {
  const units = [300, 400, 500, 600, 900].map((watts) => ({ size: String(watts), watts }));
  const firstChoices = sizing.closestPairChoices(1000, [], units);
  assert.equal(firstChoices.length, 4);
  assert.ok(firstChoices.every((option) => option.choiceCombinedWatts >= 1000));
  const secondChoices = sizing.closestReplacementChoices(1000, [], units, { otherWatts: 600 });
  assert.deepEqual(secondChoices.map((option) => option.watts), [400, 500, 600, 900]);
  assert.ok(secondChoices.every((option) => option.watts + 600 >= 1000));
  assert.equal(sizing.closestReplacementChoices(1000, [], units.slice(-1), { otherWatts: 900 })
    .find((option) => option.watts === 900).oversizeAlternative, true);
});
