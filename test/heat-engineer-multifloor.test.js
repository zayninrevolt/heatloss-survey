'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ventilation = require('../src/mcs-ventilation.js');
const fabric = require('../src/mcs-fabric.js');
const designReview = require('../src/design-review.js');
const reference = require('../src/reference-natural-design.js');
const fixture = require('./fixtures/heat-engineer-multifloor.json');

const close = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) < tol, `${a} must equal ${b} within ${tol}`);

// Every input below is the value the vendor resolved, so a failure can only be a
// method difference. Bridge factors are supplied explicitly for the externally
// exposed elements and omitted for the intermediate element, which must pick up
// the internal age-band default instead.
function element(name, grossArea, uValue, boundaryTemperature, inside, options = {}) {
  const base = {
    name,
    grossArea,
    uValue,
    boundaryTemperature,
    indoorTemperature: inside,
    openingAreas: options.openingAreas || []
  };
  if (options.propertyAgeBand) base.propertyAgeBand = options.propertyAgeBand;
  if (options.bridgeCategory) base.bridgeCategory = options.bridgeCategory;
  if (options.bridgeFactor !== undefined) base.bridgeFactor = options.bridgeFactor;
  if (options.heatedTransfer) base.heatedTransfer = true;
  return base;
}

function zoneInputs() {
  const p = fixture.conditions;
  return {
    permeability50: p.q50,
    outdoorTemperature: p.outdoor,
    zoneHeight: fixture.zone.vendorZoneHeight,
    baseHeight: 0,
    exposedFacades: p.exposedFacades,
    shielding: fixture.zone.shielding,
    directionFactor: p.directionFactor,
    rooms: fixture.rooms.map((room, index) => ({
      id: index ? 'kitchen' : 'lounge',
      volume: p.area * p.height,
      envelopeArea: room.envelopeArea,
      indoorTemperature: room.indoor
    }))
  };
}

function designInputs(temperatures) {
  const p = fixture.conditions;
  const inside = temperatures || fixture.rooms.map((room) => room.indoor);
  const base = zoneInputs();
  return {
    ...base,
    rooms: base.rooms.map((room, index) => {
      const isGroundFloor = index === 0;
      const age = p.ageBand;
      const external = { propertyAgeBand: age, bridgeCategory: 'known-u', bridgeFactor: p.externalBridge };
      const elements = [
        element('wall', p.externalWallLength * p.height, p.wallU, p.outdoor, inside[index], {
          ...external,
          openingAreas: [p.windowArea, isGroundFloor ? p.loungeDoorArea : 0]
        }),
        element('window', p.windowArea, p.windowU, p.outdoor, inside[index], external)
      ];
      if (isGroundFloor) {
        elements.push(element('door', p.loungeDoorArea, p.doorU, p.outdoor, inside[index], external));
        elements.push(element('groundFloor', p.area, p.groundFloorU, p.ground, inside[index], external));
      } else {
        elements.push(element('roof', p.area, p.roofU, p.outdoor, inside[index], external));
      }
      // One intermediate floor element per room, at the neighbouring storey's
      // temperature, with the internal age-band default bridging.
      elements.push(element('intermediate', p.area, p.intermediateFloorU,
        inside[index ? 0 : 1], inside[index], {
          propertyAgeBand: age, bridgeCategory: 'internal-default', heatedTransfer: true
        }));
      return { ...room, indoorTemperature: inside[index], elements };
    })
  };
}

test('multi-floor reference reproduces the captured two-storey zone and room flows', () => {
  const p = fixture.conditions;
  const result = ventilation.calculateNaturalZone(zoneInputs());
  assert.equal(result.methodId, 'reference-natural-ventilation-v2');
  close(result.zoneInfiltrationFlowM3h, fixture.zone.infiltrationFlowM3h);
  close(result.exposureCoefficient, fixture.zone.exposureCoefficient);
  close(result.roomToZoneCoefficient, fixture.zone.roomToZoneCoefficient);
  close(result.zoneVentilationWatts, fixture.zone.ventilationWatts);
  close(result.envelopeArea, fixture.zone.envelopeArea);
  fixture.rooms.forEach((room, index) => {
    const resolved = result.rooms[index];
    close(resolved.minimumFlowM3h, room.minimumFlowM3h);
    close(resolved.leakageFlowM3h, room.leakageFlowM3h);
    close(resolved.peakInfiltrationFlowM3h, room.peakFlowM3h);
    close(resolved.roomOutdoorFlowM3h, room.peakFlowM3h);
    close(resolved.roomVentilationWatts, room.roomVentilationWatts);
    close(resolved.zoneVentilationWatts, room.zoneVentilationWatts);
  });
  close(p.area * p.height, 28.8);
});

test('multi-floor reference reproduces every captured fabric element and total', () => {
  const result = reference.calculate(designInputs());
  assert.equal(result.equipmentSizingEnabled, false);
  const byName = (room, name) => room.elements.find((item) => item.name === name);
  fixture.rooms.forEach((room, index) => {
    const resolved = result.rooms[index];
    close(resolved.fabricWatts, room.fabricWatts);
    const expected = room.elements;
    ['wall', 'window', 'door', 'groundFloor', 'roof'].forEach((name) => {
      if (!expected[name]) return;
      close(byName(resolved, name).totalWatts, expected[name]);
    });
    const intermediate = byName(resolved, 'intermediate');
    close(intermediate.totalWatts, index ? expected.intermediateFloor : expected.intermediateCeiling);
    close(intermediate.bridgeFactor, fixture.conditions.internalBridge);
    close(intermediate.effectiveU, fixture.conditions.intermediateFloorU + fixture.conditions.internalBridge);
    close(resolved.roomDemandWatts, room.emitterTotals.roomWatts);
  });
  close(result.buildingWatts, fixture.zone.buildingWatts);
  close(result.emitterDemandWatts, fixture.zone.emitterDemandWatts);
  close(result.ventilation.zoneVentilationWatts, fixture.zone.ventilationWatts);
});

test('the intermediate floor splits the room demands and leaves the building demand unchanged', () => {
  const withIntermediate = reference.calculate(designInputs([21, 18]));
  const withoutIntermediate = reference.calculate({
    ...designInputs([21, 18]),
    rooms: designInputs([21, 18]).rooms.map((room) => ({
      ...room,
      elements: room.elements.filter((item) => item.name !== 'intermediate')
    }))
  });
  // Dropping the intermediate floor moves each room's emitter demand by 65.88 W
  // (a loss for the warmer room, a gain for the cooler one) and leaves the
  // building demand and the zone ventilation identical, because the two terms
  // are equal and opposite and neither is part of the building fabric.
  const term = (result, index) =>
    result.rooms[index].elements.find((item) => item.name === 'intermediate').totalWatts;
  close(term(withIntermediate, 0), 65.88);
  close(term(withIntermediate, 1), -65.88);
  close(withIntermediate.rooms[0].roomDemandWatts - withoutIntermediate.rooms[0].roomDemandWatts, 65.88);
  close(withIntermediate.rooms[1].roomDemandWatts - withoutIntermediate.rooms[1].roomDemandWatts, -65.88);
  close(withIntermediate.buildingWatts, withoutIntermediate.buildingWatts);
  close(withIntermediate.emitterDemandWatts, withoutIntermediate.emitterDemandWatts);
  close(withIntermediate.ventilation.zoneVentilationWatts, withoutIntermediate.ventilation.zoneVentilationWatts);
  assert.notEqual(withIntermediate.rooms[0].roomDemandWatts, withoutIntermediate.rooms[0].roomDemandWatts);
});

test('the intermediate construction carries the CIBSE DHDG 2026 Table 2-45 uninsulated value', () => {
  const p = fixture.conditions;
  const deltaT = fixture.rooms[0].indoor - fixture.rooms[1].indoor;
  close((p.intermediateFloorU + p.internalBridge) * p.area * deltaT, 65.88);
  close((p.intermediateFloorU + p.externalBridge) * p.area * deltaT, 67.68);
  close(fabric.defaultBridgeFactor(p.ageBand, 'internal-default'), 0.1);
  close(fabric.defaultBridgeFactor(p.ageBand, 'external-default'), 0.15);
  const resolved = fabric.calculateElement(element('intermediate', p.area, p.intermediateFloorU,
    fixture.rooms[1].indoor, fixture.rooms[0].indoor, {
      propertyAgeBand: p.ageBand, bridgeCategory: 'internal-default'
    }));
  close(resolved.totalWatts, 65.88);
  close(resolved.bridgeFactor, 0.1);
  // A later age band halves the internal allowance, so the intermediate term must
  // move with the recorded band rather than hard-coding 0.10.
  close(fabric.defaultBridgeFactor('L', 'internal-default'), 0.05);
});

test('the two-storey zone height stays inside the single-storey Table B.8 band at normal shielding', () => {
  const p = fixture.conditions;
  const at = (zoneHeight) => designReview.exposureCoefficient({
    zoneHeight, exposedFacades: p.exposedFacades, baseHeight: 0, shielding: 'normal'
  });
  close(at(p.height), fixture.zone.exposureCoefficient);
  close(at(fixture.zone.vendorZoneHeight), fixture.zone.exposureCoefficient);
  close(at(2 * p.height), fixture.zone.exposureCoefficient);
  // The band does move once the zone passes 10 m, which is why the storey count
  // has to be recorded rather than assumed away.
  close(at(11), 0.08);
});

test('multi-floor reference fails closed on incomplete geometry and duplicate rooms', () => {
  const base = zoneInputs();
  const bad = [
    { rooms: base.rooms.map((r, i) => (i ? r : { ...r, envelopeArea: undefined })) },
    { rooms: base.rooms.map((r, i) => (i ? r : { ...r, volume: 0 })) },
    { rooms: base.rooms.map((r) => ({ ...r, id: 'same' })) },
    { rooms: base.rooms.map((r, i) => (i ? r : { ...r, indoorTemperature: -10 })) }
  ];
  bad.forEach((patch) => assert.throws(() => ventilation.calculateNaturalZone({ ...base, ...patch }), RangeError));
});
