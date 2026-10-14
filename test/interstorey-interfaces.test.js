'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
let interfaces={};try{interfaces=require('../src/interstorey-interfaces.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const fabric=require('../src/mcs-fabric.js');
const room=(id,temperature,area=12,above=false,below=false)=>({id,roomName:id,indoor:temperature,floorArea:area,loftType:above?'Heated room above':'Flat roof, insulated',floorType:below?'Heated room below':'Insulated solid ground floor'});
const basic=()=>({rooms:[room('lower',21,20,true),room('upper',18,12,false,true)],interfaces:[{lowerRoom:'lower',upperRoom:'upper',area:8,construction:'100mm insulation'}],storeys:2,propertyAgeBand:'F'});
test('one shared measured insulated interface creates reciprocal signed room elements',()=>{
 const input=basic(),before=JSON.stringify(input),r=interfaces.resolve(input);
 assert.equal(r.methodId,'explicit-interstorey-v1');assert.equal(r.interfaces.length,1);
 assert.equal(r.byRoom.lower.ceilingCoveredArea,8);assert.equal(r.byRoom.upper.floorCoveredArea,8);
 assert.equal(r.byRoom.lower.ceilingRemainderArea,12);assert.equal(r.byRoom.upper.floorRemainderArea,4);
 const a=r.byRoom.lower.elements[0],b=r.byRoom.upper.elements[0];
 assert.equal(a.grossArea,8);assert.equal(b.grossArea,8);assert.equal(a.uValue,0.32);assert.equal(b.uValue,0.32);
 assert.equal(a.boundaryTemperature,18);assert.equal(b.boundaryTemperature,21);
 assert.equal(a.heatedTransfer,true);assert.equal(a.bridgeCategory,'internal-default');
 const x=fabric.calculateElement(a),y=fabric.calculateElement(b);
 assert.ok(Math.abs(x.totalWatts-(0.32+0.10)*8*3)<1e-9);assert.equal(x.totalWatts,-y.totalWatts);
 assert.equal(JSON.stringify(input),before);
});
test('explicit interfaces reject missing, conflicting or unsafe records instead of guessing',()=>{
 const bad=[{interfaces:[]},{interfaces:[{...basic().interfaces[0],area:0}]},{interfaces:[{...basic().interfaces[0],area:13}]},
 {interfaces:[{...basic().interfaces[0],construction:'Unknown'}]},{interfaces:[{...basic().interfaces[0],upperRoom:'missing'}]},
 {interfaces:[{...basic().interfaces[0],upperRoom:'lower'}]},{interfaces:[...basic().interfaces,...basic().interfaces]},
 {rooms:[room('lower',21,20,false),room('upper',18,12,false,true)]},{interfaces:'not an array'},
 {rooms:[room('lower',NaN,20,true),room('upper',18,12,false,true)]}];
 for(const patch of bad)assert.throws(()=>interfaces.resolve({...basic(),...patch}),RangeError,JSON.stringify(patch));
});
test('three-storey links handle multiple neighbours, area sums and cyclic contradictions',()=>{
 const rooms=[room('a',21,12,true),room('b',18,12,true,true),room('c',22,12,false,true)];
 const links=[{lowerRoom:'a',upperRoom:'b',area:12,construction:'Uninsulated'},{lowerRoom:'b',upperRoom:'c',area:12,construction:'100mm insulation'}];
 const input={rooms,interfaces:links,storeys:3,propertyAgeBand:'F'},r=interfaces.resolve(input);
 assert.equal(r.byRoom.b.elements.length,2);assert.equal(r.byRoom.b.floorRemainderArea,0);assert.equal(r.byRoom.b.ceilingRemainderArea,0);
 const term=e=>fabric.calculateElement(e).totalWatts;
 assert.ok(Math.abs(r.interfaces[1].uValue-0.31)<1e-9);assert.ok(Math.abs(r.byRoom.a.elements.map(term).reduce((a,b)=>a+b,0)+r.byRoom.b.elements.map(term).reduce((a,b)=>a+b,0)+r.byRoom.c.elements.map(term).reduce((a,b)=>a+b,0))<1e-9);
 assert.throws(()=>interfaces.resolve({...input,storeys:2}),/storeys/);
 const cycleRooms=rooms.map(r=>({...r,floorType:'Heated room below',loftType:'Heated room above'}));
 assert.throws(()=>interfaces.resolve({...input,rooms:cycleRooms,interfaces:links.concat({lowerRoom:'c',upperRoom:'a',area:12,construction:'Uninsulated'})}),/cycle/i);
 const split={rooms:[room('a',21,12,true),room('b',18,6,false,true),room('c',18,6,false,true)],interfaces:[{lowerRoom:'a',upperRoom:'b',area:6,construction:'Uninsulated'},{lowerRoom:'a',upperRoom:'c',area:6,construction:'100mm insulation'}],storeys:2,propertyAgeBand:'F'};
 assert.equal(interfaces.resolve(split).byRoom.a.ceilingCoveredArea,12);
 assert.throws(()=>interfaces.resolve({...split,rooms:[room('a',21,10,true),...split.rooms.slice(1)]}),/area/i);
});
