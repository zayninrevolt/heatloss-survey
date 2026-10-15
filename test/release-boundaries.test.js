'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const sizing=require('../src/radiator-sizing');
test('radiator design rejects unsupported flows and nonpositive flow-return drops',()=>{
 for(const config of [{flow:40,room:18},{flow:80,room:21},{flow:55,room:21,drop:0},{flow:55,room:21,drop:-10}]) {
  assert.equal(sizing.meanWaterDeltaT(config).usable,false,JSON.stringify(config));
 }
});

test('current-schema saved surveys require emitter review when calculation data advances',()=>{
 const p=require('../src/persistence');
 const source={_schemaVersion:4,_calcMethodVersion:3,hl_radiator_temperature:'55',rad_lounge_ex_size:'Myson Kickspace 500'};
 const result=p.decodeWithReport(source);
 assert.equal(p.CURRENT_CALC_METHOD_VERSION,4);
 assert.equal(result.data._schemaVersion,4);
 assert.equal(result.data._calcMethodVersion,4);
 assert.equal(result.data.rad_lounge_ex_size,source.rad_lounge_ex_size);
 assert.equal(result.data.hl_radiator_temperature,'55');
 assert.match(result.review.join(' '),/Myson.*manufacturer|manufacturer.*Myson/i);
 assert.equal(p.decodeWithReport(result.data).review.length,0);
});

test('a future calculation-method stamp is refused without downgrading the survey',()=>{
 const p=require('../src/persistence');
 const future={_schemaVersion:4,_calcMethodVersion:99,site_address:'Keep this survey'};
 assert.throws(()=>p.decodeWithReport(future),/newer.*calculation|calculation.*newer/i);
 assert.equal(future._calcMethodVersion,99);
});
