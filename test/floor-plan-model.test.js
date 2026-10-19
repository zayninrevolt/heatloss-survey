const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const file=path.join(__dirname,'../src/floor-plan-model.js');
test('an L-shaped whole floor is fully covered by joined spaces separated by internal walls',()=>{
 assert.ok(fs.existsSync(file),'Whole-floor model must exist');const M=require(file);const floor=M.empty().floors[0];floor.outline=M.outline('L');
 const before=M.spaces(floor);assert.equal(before.length,1);
 floor.walls.push({id:'w1',a:[36,5],b:[36,55]});const spaces=M.spaces(floor);assert.equal(spaces.length,2);
 const cells=spaces.flatMap(s=>s.cells);assert.equal(new Set(cells).size,cells.length);assert.equal(cells.length,before[0].cells.length);
 assert.ok(spaces.every(s=>s.cells.includes(s.anchor)));
 floor.labels.push({key:'bed_1',label:'Bed 1',cell:spaces[0].anchor});floor.labels.push({key:'bed_2',label:'Bed 2',cell:spaces[1].anchor});
 const plan=M.empty();plan.floors[0]=floor;assert.equal(M.decode(JSON.stringify(plan)).floors[0].labels.length,2);
 floor.walls=[];assert.throws(()=>M.decode(JSON.stringify(plan)),/label|join|space/i);
});
test('T-junctions and enclosed internal spaces keep every floor cell exactly once',()=>{
 const M=require(file);for(const walls of [[{id:'w1',a:[36,5],b:[36,55]},{id:'w2',a:[4,25],b:[36,25]}],[{id:'w1',a:[20,20],b:[40,20]},{id:'w2',a:[40,20],b:[40,40]},{id:'w3',a:[40,40],b:[20,40]},{id:'w4',a:[20,40],b:[20,20]}]]){
  const f=M.empty().floors[0];f.outline=M.outline('Rectangle');const original=M.spaces(f)[0].cells;f.walls=walls;const spaces=M.spaces(f),cells=spaces.flatMap(s=>s.cells);assert.equal(cells.length,original.length);assert.equal(new Set(cells).size,cells.length);assert.ok(spaces.every(s=>s.cells.includes(s.anchor)));assert.equal(spaces.length,walls.length===2?3:2);
 }
});
test('floor-plan imports enforce geometry, identity, version and payload bounds',()=>{
 const M=require(file);for(const raw of ['null','[]','{}','{bad','x'.repeat(50001),JSON.stringify({...M.empty(),version:99})])assert.throws(()=>M.decode(raw));
 for(const p of [[-1,5],[81,5],[4,61],[4,NaN],[4.5,5]]){const v=M.empty();v.floors[0].outline=M.outline('L');v.floors[0].outline[0]=p;assert.throws(()=>M.decode(JSON.stringify(v)));}
 const v=M.empty();v.floors[0].outline=M.outline('L');v.floors[0].walls=[{id:'bad',a:[78,40],b:[78,50]}];assert.throws(()=>M.decode(v),/outside/i);
 v.floors[0].walls=[];v.floors[0].labels=[{key:'bed_1',label:'Bed 1',cell:0}];assert.throws(()=>M.decode(v),/outside/i);
 v.floors[0].labels=[];v.floors[1].id='ground';assert.throws(()=>M.decode(v));
});
