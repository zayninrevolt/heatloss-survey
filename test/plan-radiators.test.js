'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../src/floor-plan-model');
const floor=()=>({...M.blank('ground','Ground floor'),outline:M.outline('Rectangle')});
test('visual radiator snaps parallel to all four walls on the inside of the chosen room',()=>{
 const R=require('../src/plan-radiators'),f=floor(),regions=M.spaces(f),before=structuredClone(f);
 for(const [p,edge,point,rotation] of [[[40,6],'top',[40,5],0],[[75,30],'right',[76,30],90],[[40,54],'bottom',[40,55],0],[[5,30],'left',[4,30],90]]){
  const r=R.snap(regions,p);assert.equal(r.edge,edge);assert.deepEqual(r.point,point);assert(regions[0].cells.includes(r.cell));const g=R.geometry(regions,r);assert.equal(g.rotation,rotation);assert(g.x>4&&g.x<76&&g.y>5&&g.y<55);assert(g.length>0&&g.depth>0);
 }
 assert.deepEqual(f,before);
});
test('wall movement and new room splits retain markers and keep them on their original room side',()=>{
 const R=require('../src/plan-radiators');let f=M.split(floor(),2440,{kind:'straight',position:40}).floor;f.labels=[{key:'lounge',label:'Lounge',cell:2420},{key:'bed_1',label:'Bed 1',cell:2460}];const r=R.snap(M.spaces(f),[39,30]);f.radiators=[{id:'r1',cell:r.cell,edge:r.edge,point:r.point}];const before=structuredClone(f),moved=M.moveWall(f,f.walls[0].id,48);assert.deepEqual(f,before);assert.deepEqual(moved.radiators[0].point,[48,30]);assert.equal(M.spaces(moved).find(s=>s.cells.includes(moved.radiators[0].cell)).label.key,'lounge');
 const split=M.split(moved,2420,{kind:'straight',axis:'horizontal',position:35});assert.equal(split.error,null);assert.deepEqual(split.floor.radiators,moved.radiators);assert.deepEqual(M.decode({...M.empty(),floors:[split.floor]}).floors[0],split.floor);
});
test('shrinking an unnamed room keeps its radiator on the same face of the moving wall',()=>{
 const R=require('../src/plan-radiators'),f=M.split(floor(),2420,{kind:'straight',position:40}).floor,r=R.snap(M.spaces(f),[39,30]);f.radiators=[{id:'r1',cell:r.cell,edge:r.edge,point:r.point}];const moved=M.moveWall(f,f.walls[0].id,10);assert.equal(moved.radiators[0].edge,'right');assert.deepEqual(moved.radiators[0].point,[10,30]);assert.equal(moved.radiators[0].cell,2409);
});
test('the right canvas boundary cannot alias the first cell of the following grid row',()=>{
 const R=require('../src/plan-radiators'),f=M.split({...floor(),outline:[[0,0],[80,0],[80,60],[0,60]]},2420,{kind:'straight',position:40}).floor,ss=M.spaces(f);for(const y of [1,20,30,58]){const r=R.snap(ss,[80,y]);assert.equal(r.edge,'right');assert.equal(r.point[0],80);assert(r.point[1]>=0&&r.point[1]<=60);assert.equal(r.cell%80,79);}
});
test('concave and one-cell spaces keep the complete symbol inside the intended floor',()=>{
 const R=require('../src/plan-radiators'),G=require('../src/layout-model');
 for(const [outline,p,edge] of [[M.outline('L'),[55,40],'right'],[M.outline('L'),[60,29],'bottom'],[[[4,5],[5,5],[5,6],[4,6]],[4.5,5.5],'top']]){
  const f={...floor(),outline},ss=M.spaces(f),r=R.snap(ss,p),g=R.geometry(ss,r);assert.equal(r.edge,edge);const halfX=(g.rotation?g.depth:g.length)/2,halfY=(g.rotation?g.length:g.depth)/2;for(const x of [g.x-halfX,g.x+halfX])for(const y of [g.y-halfY,g.y+halfY])assert(G.inside([x,y],outline));
 }
 for(const p of [[57,40],[NaN,10],[1e12,5],[-1,30],null])assert.throws(()=>R.snap(M.spaces({...floor(),outline:M.outline('L')}),p));
});
test('marker budgets are bounded across the complete survey as well as each floor',()=>{
 const R=require('../src/plan-radiators'),f=floor(),r=R.snap(M.spaces(f),[40,6]);const floors=Array.from({length:3},(_,i)=>({...f,id:'floor'+i,name:'Floor '+i,radiators:Array.from({length:40},(_,j)=>({id:'r'+j,cell:r.cell,edge:r.edge,point:r.point}))}));assert.equal(M.decode({...M.empty(),floors}).floors.length,3);floors[2].radiators.push({id:'r40',cell:r.cell,edge:r.edge,point:r.point});assert.throws(()=>M.decode({...M.empty(),floors}),/Too many radiator/);
});
test('optional visual markers round-trip without changing old version-2 floors, and malformed markers fail closed',()=>{
 const R=require('../src/plan-radiators'),old=M.empty();assert.deepEqual(M.decode(old),old);
 const f=floor(),r={id:'r1',...R.snap(M.spaces(f),[40,6])};f.radiators=[{...r,extra:'strip me'}];const p={...M.empty(),floors:[f]},clean=M.decode(p);assert.deepEqual(clean.floors[0].radiators,[{id:'r1',cell:r.cell,edge:r.edge,point:r.point}]);assert.deepEqual(M.decode(JSON.stringify(clean)),clean);
 for(const radiators of [null,{},[r,r],[{...r,id:'<img>'}],[{...r,point:[40,30]}],[{...r,cell:0}],[{...r,edge:'diagonal'}],[{...r,point:[NaN,5]}],Array.from({length:61},(_,i)=>({...r,id:'r'+i}))])assert.throws(()=>M.decode({...p,floors:[{...f,radiators}]}));
});
