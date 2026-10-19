const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const modulePath=path.join(__dirname,'../src/layout-model.js');

test('visual layout links an L-shaped room to its survey identity without measurements',()=>{
 assert.ok(fs.existsSync(modulePath),'The visual-only layout model must exist');
 const model=require(modulePath);
 const layout=model.empty();
 const room=model.room('bed_1','Bed 1','L');
 layout.floors[1].rooms.push(room);
 const restored=model.decode(JSON.stringify(layout));
 assert.equal(restored.floors[1].rooms[0].key,'bed_1');
 assert.equal(restored.floors[1].rooms[0].label,'Bed 1');
 assert.equal(restored.floors[1].rooms[0].points.length,6);
 assert.equal(Object.hasOwn(room,'floorArea'),false);
 assert.equal(Object.hasOwn(room,'length'),false);
 assert.equal(Object.hasOwn(room,'width'),false);
});

test('layout imports reject malformed, unsupported, excessive or ambiguous data',()=>{
 const model=require(modulePath);
 for(const raw of ['null','[]','{}','{bad',JSON.stringify({...model.empty(),version:2}),'x'.repeat(50001)])assert.throws(()=>model.decode(raw));
 for(const bad of [NaN,Infinity,-1,641]){
  const layout=model.empty();const r=model.room('bed_1','Bed 1','L');r.points[0][0]=bad;layout.floors[0].rooms.push(r);
  assert.throws(()=>model.decode(JSON.stringify(layout)));
 }
 const duplicate=model.empty();duplicate.floors[0].rooms.push(model.room('bed_1','Bed 1','L'));duplicate.floors[1].rooms.push(model.room('bed_1','Bed 1','L'));
 assert.throws(()=>model.decode(JSON.stringify(duplicate)),/room/i);
 const badFloor=model.empty();badFloor.floors[1].id=badFloor.floors[0].id;assert.throws(()=>model.decode(JSON.stringify(badFloor)));
});

test('layout polygons reject crossings and preserve bounded visual-only fields',()=>{
 const model=require(modulePath);const layout=model.empty();
 const room=model.room('bed_1','Bed 1','L');room.floorArea=999;room.points=[[80,80],[240,240],[80,240],[240,80]];layout.floors[0].rooms.push(room);
 assert.throws(()=>model.decode(JSON.stringify(layout)),/shape|polygon/i);
 room.points=model.room('bed_1','Bed 1','L').points;room.label='Bedroom <1> & front';
 const safe=model.decode(JSON.stringify(layout));assert.equal(safe.floors[0].rooms[0].label,room.label);assert.equal(Object.hasOwn(safe.floors[0].rooms[0],'floorArea'),false);
 room.points=Array.from({length:33},(_,i)=>[i+50,50]);assert.throws(()=>model.decode(JSON.stringify(layout)));
});

test('visual editing preserves room identity, valid L shapes and an interior label anchor',()=>{
 const model=require(modulePath);const room=model.room('bed_1','Bed 1','L');const original=JSON.stringify(room);
 const rotated=model.rotate(room.points);assert.equal(rotated.length,6);model.polygon(rotated);
 const moved=model.translate(rotated,10000,-10000);model.polygon(moved);assert.ok(moved.every(p=>p[0]>=0&&p[0]<=640&&p[1]>=0&&p[1]<=480));
 const edited=model.vertex(room.points,3,[176,176]);model.polygon(edited);
 assert.ok(model.inside(model.labelPoint(edited),edited));
 assert.equal(JSON.stringify(room),original);
});
