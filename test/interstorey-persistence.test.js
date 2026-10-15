'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),p=require('../src/persistence');
test('schema migration preserves boiler inputs and flags old implicit heated interfaces without inventing measurements',()=>{
 const source={_schemaVersion:3,_calcMethodVersion:3,hl_calculation_method_version:'legacy-boiler-v1',hl_lounge_loft_type:'Heated room above',hl_kitchen_floor_type:'Heated room below',hl_lounge_roof_adjacent_temp:'18',rad_lounge_len:'4',rad_kitchen_len:'3'},snapshot=JSON.stringify(source);
 const result=p.decodeWithReport(source);assert.equal(p.CURRENT_SCHEMA_VERSION,4);assert.equal(result.data._calcMethodVersion,p.CURRENT_CALC_METHOD_VERSION);
 assert.equal(result.data.hl_lounge_roof_adjacent_temp,'18');assert.equal(result.data.hl_calculation_method_version,'legacy-boiler-v1');assert.equal(result.data.hl_interstorey_interfaces,'[]');
 assert.match(result.review.join(' '),/shared.*area.*insulation/i);assert.equal(JSON.stringify(source),snapshot);
 assert.equal(p.decodeWithReport(p.encode(result.data)).review.length,0);
});
test('the canonical shared-interface JSON round-trips unchanged and is not split into per-room copies',()=>{
 const links=JSON.stringify([{upperRoom:'kitchen',lowerRoom:'lounge',area:8,construction:'100mm insulation'}]);
 const d=p.decode(p.encode({_schemaVersion:4,_calcMethodVersion:3,hl_interstorey_interfaces:links}));assert.equal(d.hl_interstorey_interfaces,links);assert.equal(d.hl_lounge_interface,undefined);
});
