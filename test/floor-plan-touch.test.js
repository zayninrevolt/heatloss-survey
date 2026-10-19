const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../src/floor-plan-model');
function floor(){return {...M.blank('ground','Ground floor'),outline:M.outline('Rectangle')};}
test('one touch split divides only the selected space without changing the input floor',()=>{
 const f=floor(),before=structuredClone(f),cell=30*80+40;
 const result=M.split(f,cell,{kind:'straight',axis:'horizontal',position:20});
 assert.equal(result.error,null);assert.equal(M.spaces(result.floor).length,2);
 assert.deepEqual(result.floor.walls.map(w=>[w.a,w.b]),[[[4,20],[76,20]]]);
 assert.deepEqual(f,before);assert.equal(result.handles.length,1);assert.equal(result.handles[0].axis,'y');
 const next=M.split(result.floor,35*80+40,{kind:'straight',axis:'vertical',position:30});
 assert.equal(next.error,null);assert.equal(M.spaces(next.floor).length,3);
 assert.deepEqual(next.floor.walls[1].a,[30,20]);assert.deepEqual(next.floor.walls[1].b,[30,55]);
 assert.deepEqual(M.decode({...M.empty(),floors:[next.floor]}).floors[0],next.floor);
});
test('an L split makes the requested interlocking hallway and living room below a full-width rear kitchen',()=>{
 const kitchen=M.split(floor(),30*80+40,{kind:'straight',axis:'horizontal',position:20}).floor;
 const result=M.split(kitchen,40*80+40,{kind:'L',axis:'vertical',first:30,second:50,offset:35});
 assert.equal(result.error,null);assert.equal(M.spaces(result.floor).length,3);
 assert.deepEqual(result.floor.walls.slice(1).map(w=>[w.a,w.b]),[[[30,20],[30,35]],[[30,35],[50,35]],[[50,35],[50,55]]]);
 assert.equal(result.handles.length,3);assert.equal(result.options.kind,'L');
 const parts=M.spaces(result.floor);const hall=parts.find(s=>s.cells.includes(45*80+20)),living=parts.find(s=>s.cells.includes(25*80+60));
 assert(hall.cells.includes(45*80+40));assert(!hall.cells.includes(25*80+40));assert(living.cells.includes(25*80+40));assert(!living.cells.includes(45*80+40));
 const rotated=M.split(floor(),30*80+40,{kind:'L',axis:'horizontal',first:20,second:40,offset:40});
 assert.equal(rotated.error,null);assert.equal(M.spaces(rotated.floor).length,2);
 const flipped=M.split(kitchen,40*80+40,{kind:'L',first:50,second:30,offset:35});assert.equal(flipped.error,null);
});
test('dragging a shared wall stretches its adjoining dividers and keeps both labelled spaces',()=>{
 const f=M.split(M.split(floor(),30*80+40,{axis:'horizontal',position:20}).floor,40*80+40,{kind:'L',first:30,second:50,offset:35}).floor;
 f.labels=[{key:'kitchen',label:'Kitchen',cell:10*80+40},{key:'lounge',label:'Living room',cell:30*80+60},{key:'hall',label:'Hallway',cell:40*80+15}];
 const before=structuredClone(f),moved=M.moveWall(f,f.walls[0].id,25);
 assert.deepEqual(f,before);assert.equal(M.spaces(moved).length,3);assert.equal(moved.walls[1].a[1],25);assert.equal(moved.walls[0].a[1],25);
 assert.deepEqual(moved.labels,f.labels);M.decode({...M.empty(),floors:[moved]});
 const elbow=M.moveWall(f,f.walls[2].id,38);assert.equal(elbow.walls[1].b[1],38);assert.equal(elbow.walls[3].a[1],38);
 assert.throws(()=>M.moveWall(f,f.walls[0].id,59));assert.deepEqual(f,before);
});
module.exports={floor};
