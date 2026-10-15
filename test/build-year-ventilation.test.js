'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const heatLoss = require('../src/heat-loss.js');

test('an overlapping band uses its recorded 1997 build year for ventilation', () => {
  assert.equal(typeof heatLoss.resolveVentilationAge, 'function');
  const age = heatLoss.resolveVentilationAge({ ageBand: 'I', buildYear: '1997' });
  assert.equal(age.category, 'pre-2000');
  assert.equal(age.source, 'build-year');
  assert.equal(age.showYear, true);
  assert.equal(age.reviewRequired, false);
  assert.equal(age.buildYear, 1997);
  assert.equal(age.minYear, 1996);
  assert.equal(age.maxYear, 2002);
});

test('an explicit ventilation category takes priority and hides the year question', () => {
  const age = heatLoss.resolveVentilationAge({ ageBand: 'I', buildYear: '1997', override: '2006+' });
  assert.equal(age.category, '2006+');
  assert.equal(age.source, 'override');
  assert.equal(age.showYear, false);
  assert.equal(age.reviewRequired, false);
});

test('invalid or out-of-band years never become accepted construction evidence', () => {
  for (const buildYear of ['1997.5', '1.997e3', '1997abc', '1995', '2003', [1997], { year: 1997 }, true, Infinity]) {
    const age = heatLoss.resolveVentilationAge({ ageBand: 'I', buildYear });
    assert.equal(age.category, '2000-2006', JSON.stringify(buildYear));
    assert.equal(age.buildYear, null);
    assert.equal(age.reviewRequired, true);
    assert.equal(age.source, 'legacy-band-assumption');
  }
});

test('only bands crossing the source cutoffs ask for a year', () => {
  for (const band of ['Unknown', ...'ABCDEFGHIJKLM']) {
    const age = heatLoss.resolveVentilationAge({ ageBand: band, buildYear: '1997' });
    assert.equal(age.showYear, ['I', 'J'].includes(band), band);
    if (!age.showYear) {
      assert.equal(age.category, heatLoss.ventilationAgeCategory(band));
      assert.equal(age.source, 'age-band');
      assert.equal(age.reviewRequired, false);
      assert.equal(age.buildYear, null, 'A hidden/stale year must not affect another band');
    }
  }
});

test('supported recorded years resolve the 2000 boundary without changing the selected band', () => {
  for (const [ageBand, buildYear, expected] of [
    ['I', 1996, 'pre-2000'], ['I', 1999, 'pre-2000'],
    ['I', 2000, '2000-2006'], ['I', 2001, '2000-2006'], ['I', 2002, '2000-2006'],
    ['J', 2003, '2000-2006'], ['J', 2005, '2000-2006']
  ]) {
    const age = heatLoss.resolveVentilationAge({ ageBand, buildYear });
    assert.equal(age.category, expected);
    assert.equal(age.buildYear, buildYear);
    assert.equal(age.source, 'build-year');
    assert.equal(age.reviewRequired, false);
  }
});

test('the overlapping 2006 source labels require confirmation rather than an invented cutoff', () => {
  const age = heatLoss.resolveVentilationAge({ ageBand: 'J', buildYear: '2006' });
  assert.equal(age.category, '2000-2006', 'Preserve the legacy band value pending review');
  assert.equal(age.reviewRequired, true);
  assert.match(age.message, /overlaps at 2006/);
  const confirmed = heatLoss.resolveVentilationAge({ ageBand: 'J', buildYear: '2006', override: '2006+' });
  assert.equal(confirmed.category, '2006+');
  assert.equal(confirmed.reviewRequired, false);
});

test('blank years preserve all legacy band calculations without guessing a midpoint', () => {
  for (const band of ['Unknown', ...'ABCDEFGHIJKLM']) {
    const age = heatLoss.resolveVentilationAge({ ageBand: band });
    assert.equal(age.category, heatLoss.ventilationAgeCategory(band), band);
    assert.equal(age.buildYear, null);
    assert.equal(age.reviewRequired, ['I', 'J'].includes(band));
  }
});
