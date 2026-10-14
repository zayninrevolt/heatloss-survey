'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ventilation = require('../src/mcs-ventilation.js');
const fixture = require('./fixtures/heat-engineer-reference.json');
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} must equal ${b}`);
function inputs(c) {
  return {permeability50:12, outdoorTemperature:-2.7, zoneHeight:2.4, baseHeight:0,
    exposedFacades:4, shielding:c.shielding, directionFactor:2,
    rooms:c.rooms.map((values,i)=>({id:i?'kitchen':'lounge',volume:c.volumes[i],
      envelopeArea:c.envelopes[i],indoorTemperature:c.temperatures[i]}))};
}
test('natural reference separates room and zone ventilation at Lounge 21 and Kitchen 18', () => {
  const c=fixture.cases.find(c=>c.label==='different-temperatures');
  const result=ventilation.calculateNaturalZone(inputs(c));
  assert.equal(result.methodId,'reference-natural-ventilation-v2');
  for (let i=0;i<c.rooms.length;i++) {
    const expected=Object.fromEntries(fixture.columns.map((k,j)=>[k,c.rooms[i][j]]));
    close(result.rooms[i].roomOutdoorFlowM3h,expected.roomEnvelopeFlow);
    close(result.rooms[i].leakageFlowM3h,expected.roomLeakageFlow);
    close(result.rooms[i].roomVentilationWatts,expected.roomVentilation);
    close(result.rooms[i].zoneVentilationWatts,expected.zoneVentilation);
  }
  close(result.roomVentilationWatts,913.0060799999999);
  close(result.zoneVentilationWatts,456.50303999999994);
});
function designInputs(c) {
  const p=fixture.conditions;
  const base=inputs(c);
  return {...base, propertyAgeBand:p.ageBand, rooms:base.rooms.map((room,i)=>{
    const outside=p.outdoor, inside=c.temperatures[i], door=i?0:p.loungeDoorArea;
    const common={indoorTemperature:inside,propertyAgeBand:p.ageBand,bridgeCategory:'known-u',bridgeFactor:0.15,openingAreas:[]};
    const element=(name,grossArea,uValue,boundaryTemperature,extra={})=>({name,...common,grossArea,uValue,boundaryTemperature,...extra});
    return {...room,elements:[
      element('wall',c.externalLengths[i]*p.height,p.wallU,outside,{openingAreas:[p.windowAreaEach,door]}),
      element('window',p.windowAreaEach,p.windowU,outside),
      element('door',door,p.doorU,outside),
      element('floor',c.areas[i],p.floorU,p.ground),
      element('roof',c.areas[i],p.roofU,outside),
      element('internal',p.sharedWallLength*p.height,p.internalWallU,c.adjacentTemperatures[i],{bridgeFactor:0.1,heatedTransfer:true})
    ]};
  })};
}
test('natural reference rejects nonzero or malformed ventilation device flows instead of ignoring them', () => {
  const base=inputs(fixture.cases[0]);
  for (const patch of [{atdFlowM3h:-1},{openFlowM3h:NaN},{devices:'vent'},
    {rooms:base.rooms.map((r,i)=>i?r:{...r,atdFlowM3h:-5})}]) {
    assert.throws(()=>ventilation.calculateNaturalZone({...base,...patch}),RangeError);
  }
});

test('natural reference uses the room minimum and does not blindly halve peak infiltration', () => {
  const base=inputs(fixture.cases[0]);
  const single=ventilation.calculateNaturalZone({...base,rooms:[base.rooms[0]]});
  assert.equal(single.roomToZoneCoefficient,1);
  close(single.rooms[0].roomOutdoorFlowM3h,single.rooms[0].zoneOutdoorFlowM3h);
  const tight=ventilation.calculateNaturalZone({...base,permeability50:0});
  close(tight.rooms[0].roomOutdoorFlowM3h,0.5*28.8);
  close(tight.rooms[0].zoneOutdoorFlowM3h,0.5*0.5*28.8);
  const mixed=ventilation.calculateNaturalZone({...base,rooms:base.rooms.map((r,i)=>i?{...r,envelopeArea:0}:r)});
  close(mixed.rooms[1].minimumFlowM3h,0);
  close(mixed.rooms[1].roomOutdoorFlowM3h,0);
});

test('natural reference fails closed on incomplete, duplicate and unsupported inputs', () => {
  const base=inputs(fixture.cases[0]);
  const bad=[{rooms:[]},{exposedFacades:1.5},{directionFactor:undefined},
    {outdoorTemperature:''},{permeability50:-1},{shielding:'guess'},
    {ventilationSystem:'MVHR'}, {devices:['Open chimney']},
    {rooms:base.rooms.map(r=>({...r,id:'same'}))},
    {rooms:base.rooms.map((r,i)=>i?r:{...r,envelopeArea:undefined})},
    {rooms:base.rooms.map((r,i)=>i?r:{...r,volume:0})},
    {rooms:base.rooms.map((r,i)=>i?r:{...r,indoorTemperature:''})}];
  for(const patch of bad) assert.throws(()=>ventilation.calculateNaturalZone({...base,...patch}),RangeError);
});

test('natural reference default q50 and geometry do not mutate the supplied fixture', () => {
  const base=inputs(fixture.cases[0]);delete base.permeability50;
  const before=JSON.stringify(base);
  const result=ventilation.calculateNaturalZone(base);
  assert.equal(result.permeabilitySource,'standard-default');
  assert.equal(result.permeability50,12);
  assert.equal(JSON.stringify(base),before);
});

test('natural design composes per-element fabric with room and building flows for every captured case', () => {
  const design=require('../src/reference-natural-design.js');
  for (const c of fixture.cases) {
    const result=design.calculate(designInputs(c));
    close(result.buildingWatts,c.zoneTotal);
    close(result.emitterDemandWatts,c.emitterTotal);
    assert.equal(result.equipmentSizingEnabled,false);
    assert.match(result.scope,/natural/i);
    for (let i=0;i<c.rooms.length;i++) {
      const expected=Object.fromEntries(fixture.columns.map((k,j)=>[k,c.rooms[i][j]]));
      close(result.rooms[i].roomDemandWatts,expected.roomTotal);
      close(result.rooms[i].fabricWatts,expected.fabric);
      for (const element of result.rooms[i].elements) close(element.totalWatts,expected[element.name]);
    }
  }
});
