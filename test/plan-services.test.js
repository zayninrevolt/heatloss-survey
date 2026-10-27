const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/floor-plan-model.js');

function plan() {
  const p = M.empty();
  p.floors[0].outline = M.outline('Rectangle');
  return p;
}

test('all four service marker types survive floor-plan decoding without changing old layouts', () => {
  const p = plan();
  p.floors[0].services = ['boiler', 'gas-meter', 'stop-tap', 'electric-meter'].map((type, i) => ({ id: 's' + i, type, point: [12 + i * 14, 20.5] }));
  const clean = M.decode(JSON.stringify(p));
  assert.deepEqual(clean.floors[0].services, p.floors[0].services);
  assert.deepEqual(M.decode(JSON.stringify(M.empty())), M.empty());
  assert.equal(Object.hasOwn(clean.floors[1], 'services'), false);
  clean.floors[0].services[0].point[0] = 33;
  assert.equal(p.floors[0].services[0].point[0], 12);
});

test('service markers reject invalid types, coordinates, identities and unsafe imports', () => {
  const valid = { id: 's1', type: 'boiler', point: [20, 20] };
  const bad = [null, {}, { ...valid, type: '<svg onload=alert(1)>' }, { ...valid, type: '__proto__' },
    { ...valid, id: 'bad\"id' }, { ...valid, point: [-1, 20] }, { ...valid, point: [81, 20] },
    { ...valid, point: [20, 61] }, { ...valid, point: [20.25, 20] },
    { ...valid, point: [NaN, 20] }, { ...valid, point: ['20', 20] }, { ...valid, point: [20, 20, 1] }];
  for (const marker of bad) {
    const p = plan(); p.floors[0].services = [marker];
    assert.throws(() => M.decode(p), /service marker/i);
  }
  for (const services of [null, {}, [valid, valid], Array.from({ length: 61 }, (_, i) => ({ ...valid, id: 's' + i }))]) {
    const p = plan(); p.floors[0].services = services;
    assert.throws(() => M.decode(p), /service marker/i);
  }
  const p = M.empty(); p.floors[0].services = [valid];
  assert.throws(() => M.decode(p), /outline/i);
});

test('service markers can identify external meters within the canvas but have a bounded total', () => {
  const p = plan();
  p.floors[0].services = [{ id: 'external', type: 'gas-meter', point: [2, 30] }];
  assert.deepEqual(M.decode(p).floors[0].services, p.floors[0].services);
  p.floors = Array.from({ length: 3 }, (_, n) => ({ ...p.floors[0], id: 'floor' + n,
    services: Array.from({ length: 41 }, (_, i) => ({ id: 's' + i, type: 'boiler', point: [20, 20] })) }));
  assert.throws(() => M.decode(p), /service marker/i);
});

test('splitting a space and moving its wall preserve service positions exactly', () => {
  const p = plan();
  p.floors[0].services = [{ id: 'boiler1', type: 'boiler', point: [20, 20] }, { id: 'gas1', type: 'gas-meter', point: [2, 30] }];
  const f = p.floors[0], result = M.split(f, M.spaces(f)[0].anchor, { kind: 'straight' });
  assert.equal(result.error, null);
  assert.deepEqual(result.floor.services, f.services);
  const moved = M.moveWall(result.floor, result.floor.walls[0].id, 45);
  assert.deepEqual(moved.services, f.services);
  moved.services[0].point[0] = 44;
  assert.equal(f.services[0].point[0], 20);
});
