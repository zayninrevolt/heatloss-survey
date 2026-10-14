const test = require('node:test');
const assert = require('node:assert/strict');
const review = require('../src/design-review.js');

test('natural design review resolves the published exposure height and shielding bands', () => {
  const coefficient = (height, shielding = 'normal', facades = 4, baseHeight = 0) =>
    review.exposureCoefficient({ zoneHeight: height, shielding, exposedFacades: facades, baseHeight });
  assert.equal(coefficient(5), 0.05);
  assert.equal(coefficient(5, 'intensive'), 0.03);
  assert.equal(coefficient(5, 'none'), 0.07);
  assert.equal(coefficient(5, 'none', 1), 0.03);
  assert.equal(coefficient(5.01, 'intensive'), 0.05);
  assert.equal(coefficient(10, 'none'), 0.07);
  assert.equal(coefficient(10.01), 0.08);
  assert.equal(coefficient(20), 0.08);
  assert.equal(coefficient(20.01), 0.11);
  assert.equal(coefficient(5, 'normal', 4, 50.01), 0.09);
  // The 0.09 merged cell applies to multiple facades up to 20 m zone height,
  // not the single-facade row or the >20 m column in the actual Table B.8 image.
  assert.equal(coefficient(5, 'normal', 1, 50.01), 0.03);
  assert.equal(coefficient(20.01, 'normal', 4, 50.01), 0.11);
  assert.equal(coefficient(5, 'normal', 2), 0.05, 'a mid-terrace zone uses the more-than-one-facade column');
  assert.equal(coefficient(5, 'none', 3), 0.07);
  for (const input of [
    { zoneHeight: 0, shielding: 'normal', exposedFacades: 4, baseHeight: 0 },
    { zoneHeight: 5, shielding: 'guess', exposedFacades: 4, baseHeight: 0 },
    { zoneHeight: 5, shielding: 'normal', exposedFacades: 0, baseHeight: 0 },
    { zoneHeight: 5, shielding: 'normal', exposedFacades: -1, baseHeight: 0 },
    { zoneHeight: 5, shielding: 'normal', exposedFacades: 4, baseHeight: -1 }
  ]) assert.throws(() => review.exposureCoefficient(input), RangeError);
});

test('the exposed facade count comes from the recorded dwelling attachment', () => {
  assert.equal(review.exposedFacadesForAttachment('Detached'), 4);
  assert.equal(review.exposedFacadesForAttachment('Semi-detached'), 3);
  assert.equal(review.exposedFacadesForAttachment('End terrace'), 3);
  assert.equal(review.exposedFacadesForAttachment('Mid terrace'), 2);
  assert.equal(review.exposedFacadesForAttachment('Enclosed end-terrace flat'), 2);
  assert.equal(review.exposedFacadesForAttachment('Enclosed mid-terrace flat'), 1);
  assert.throws(() => review.exposedFacadesForAttachment(''), RangeError);
  assert.throws(() => review.exposedFacadesForAttachment('Bungalow'), RangeError);
});

test('a room minimum above the leakage flow governs and keeps its own flow', () => {
  const governed = review.governingFlow({ roomVolume: 30, roomLeakageM3h: 4, deviceFlowM3h: 10 });
  assert.equal(governed.minimumFlowM3h, 15);
  assert.equal(governed.governingFlowM3h, 15);
  assert.equal(governed.minimumGoverned, true);
  assert.equal(governed.designWattsPerKelvin, 0.34 * 25);
  const internal = review.governingFlow({ roomVolume: 30, roomLeakageM3h: 9, hasExternalEnvelope: false });
  assert.equal(internal.minimumFlowM3h, 0);
  assert.equal(internal.governingFlowM3h, 9);
  assert.equal(internal.designWattsPerKelvin, 0.34 * 9);
  assert.throws(() => review.governingFlow({ roomVolume: 0 }), RangeError);
  assert.throws(() => review.governingFlow({ roomVolume: 20, roomLeakageM3h: -1 }), RangeError);
});
