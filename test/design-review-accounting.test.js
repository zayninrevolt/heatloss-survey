const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const design = require('../src/design-review.js');

// Execute the actual private controller helper with a minimal recorded-result context.
// Browser tests separately verify the live form, persistence and printed integration.
const controller = fs.readFileSync(require.resolve('../combined-heatloss.js'), 'utf8');
const start = controller.indexOf('  function computeDesignReview() {');
const end = controller.indexOf('  function designReviewSummaryHtml', start);
assert.ok(start >= 0 && end > start, 'The real review function must be found');

function reviewFor(rooms, { provisional = false, incompleteRooms = [], selectedRadiatorWatts } = {}) {
  const context = {
    window: { DesignReview: design, heatLossResultsV60: {
      includedRooms: rooms, incompleteRooms, provisional,
      radiatorOutputWatts: selectedRadiatorWatts == null
        ? rooms.reduce((sum, room) => sum + room.totalWatts, 0) : selectedRadiatorWatts
    } },
    stringValue: id => ({ hl_dwelling_attachment: 'Semi-detached', hl_shielding_class: 'Normal shielding' }[id] || ''),
    numberValue: (id, fallback) => fallback
  };
  vm.createContext(context);
  vm.runInContext(controller.slice(start, end), context);
  return context.computeDesignReview();
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}

// Synthetic independent longhand: external fabric 100 W, ventilation 66 W,
// internal transfer +/-50 W; percentage bridging is 10% of the full base load.
// Only heated transfers (including their bridging/room allowances) leave the
// building account. The figures are not a second implementation of the report.
function recordedRoom(internal = 0, heated = true, factor = 1) {
  const base = 100 + 66 + internal;
  const bridge = base * 0.1;
  const total = (base + bridge) * factor;
  return {
    fabricWatts: 100 + internal + bridge,
    bridgeWatts: bridge,
    internalWallWatts: internal,
    ventilationWatts: 66,
    factorMultiplier: factor,
    totalWatts: total,
    radiatorRequirementWatts: Math.max(0, total),
    propertyWatts: total - (heated ? internal * 1.1 * factor : 0)
  };
}

for (const [name, internal, heated, expectedFabric] of [
  ['no internal wall retains bridging', 0, true, 116.6],
  ['heated neighbour is not counted twice', 50, true, 116.6],
  ['signed gain from a heated neighbour is removed only from building load', -50, true, 116.6],
  ['unheated boundary stays in the building account', 50, false, 171.6]
]) {
  test(`recorded-method review: ${name}`, () => {
    const room = recordedRoom(internal, heated);
    const result = reviewFor([room]);
    close(result.fabricDemandKw * 1000, expectedFabric);
    close(result.ventilationDemandKw * 1000, 66);
    close(result.buildingDemandKw * 1000, expectedFabric + 66);
    close(result.roomEmitterDemandKw * 1000, room.totalWatts);
    close(result.fabricDemandKw + result.ventilationDemandKw, result.buildingDemandKw);
  });
}

test('review applies each recorded room allowance separately, not their arithmetic mean', () => {
  const a = recordedRoom(50, true, 1.2);
  const b = { fabricWatts: 220, bridgeWatts: 20, internalWallWatts: 0,
    ventilationWatts: 0, factorMultiplier: 1, totalWatts: 220, propertyWatts: 220,
    radiatorRequirementWatts: 220 };
  const result = reviewFor([a, b]);
  close(result.buildingDemandKw * 1000, 182.6 * 1.2 + 220);
  close(result.ventilationDemandKw * 1000, 66 * 1.2);
  close(result.fabricDemandKw * 1000, 116.6 * 1.2 + 220);
});

test('partial review excludes incomplete rooms and announces the exclusion', () => {
  const result = reviewFor([recordedRoom()], {
    provisional: true, incompleteRooms: [{ roomName: 'Kitchen' }]
  });
  close(result.buildingDemandKw * 1000, 182.6);
  assert.match(result.notes.join(' '), /1 started room.*excluded/);
});

test('empty and started-but-incomplete reviews return a safe complete shape', () => {
  for (const incompleteRooms of [[], [{ roomName: 'Kitchen' }]]) {
    const result = reviewFor([], { incompleteRooms });
    assert.equal(result.complete, false);
    assert.equal(result.buildingDemandKw, 0);
    assert.ok(Array.isArray(result.implemented));
    assert.ok(Array.isArray(result.outstanding));
    assert.ok(Array.isArray(result.notes));
    assert.ok(result.exposure);
    if (incompleteRooms.length) assert.match(result.notes.join(' '), /Complete Kitchen/);
  }
});

test('building account is independent of emitter allocation and boiler minimum', () => {
  const room = recordedRoom();
  const before = reviewFor([room]);
  const allocated = reviewFor([{ ...room, radiatorRequirementWatts: room.radiatorRequirementWatts + 500 }]);
  close(allocated.buildingDemandKw, before.buildingDemandKw);
  close(allocated.fabricDemandKw, before.fabricDemandKw);
  assert.ok(allocated.roomEmitterDemandKw > before.roomEmitterDemandKw);
  assert.ok(before.buildingDemandKw < 12);
});

test('emitter demand means calculated requirement, not the capacity of selected radiators', () => {
  const room = { ...recordedRoom(), radiatorRequirementWatts: 300 };
  const result = reviewFor([room], { selectedRadiatorWatts: 800 });
  close(result.roomEmitterDemandKw * 1000, 300);
  const noneSelected = reviewFor([room], { selectedRadiatorWatts: 0 });
  close(noneSelected.roomEmitterDemandKw * 1000, 300);
  close(noneSelected.buildingDemandKw, result.buildingDemandKw);
});
