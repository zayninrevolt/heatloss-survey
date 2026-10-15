'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
let myson = {};
try { myson = require('../src/myson-fan-convectors.js'); }
catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }

test('Myson normal-speed outputs match the February 2025 manufacturer tables, not other models', () => {
  assert.equal(typeof myson.output, 'function');
  for (const [size,at30,at50] of [
    ['Myson Kickspace 500',566,896], ['Myson Kickspace 600',729,1278],
    ['Myson Kickspace 800',1077,1707], ['Myson Hi-Line RC 7-4',541,930],
    ['Myson Hi-Line RC 10-6',937,1610], ['Myson Hi-Line RC 15-10',1431,2459],
    ['Myson Hi-Line RC 20-14',2018,3468], ['Myson Hi-Line LV 7-4',541,930]
  ]) {
    assert.equal(myson.output(size,30),at30,size+' at delta-T30');
    assert.equal(myson.output(size,50),at50,size+' at delta-T50');
  }
});

test('Myson interpolation stays between published points and never uses a fitted exponent', () => {
  assert.equal(myson.output('Myson Hi-Line RC 7-4',40),735.5);
  assert.equal(myson.output('Myson Kickspace 500',35),648.5);
  for (const deltaT of [19,22,29,51,NaN,Infinity,-1]) {
    assert.equal(myson.output('Myson Kickspace 500',deltaT),null,String(deltaT));
  }
  assert.equal(myson.output('not a model',40),null);
});
