const {test}=require('node:test');const assert=require('node:assert/strict');const M=require('../src/floor-plan-model');
const floor=()=>({...M.blank('ground','Ground floor'),outline:M.outline('Rectangle')});
test('a corner room uses two short joined walls on any corner without a full-span preliminary cut',()=>{
 for(const corner of ['top-left','top-right','bottom-right','bottom-left']){
  const f=floor(),before=structuredClone(f),left=corner.endsWith('left'),top=corner.startsWith('top'),x=left?20:60,y=top?20:40;
  const r=M.split(f,30*80+40,{kind:'corner',corner,x,y});assert.equal(r.error,null);assert.equal(r.options.kind,'corner');assert.equal(r.options.corner,corner);assert.equal(r.floor.walls.length,2);assert.equal(M.spaces(r.floor).length,2);assert.deepEqual(f,before);
  assert.deepEqual(r.handles.map(h=>h.id).sort(),['x','y']);assert.deepEqual(r.handles.map(h=>h.axis).sort(),['x','y']);
  for(const w of r.floor.walls){assert(Math.abs(w.a[0]-w.b[0])<72);assert(Math.abs(w.a[1]-w.b[1])<50);}
  const expected=[];for(let row=5;row<55;row++)for(let col=4;col<76;col++)if((left?col<x:col>=x)&&(top?row<y:row>=y))expected.push(row*80+col);
  const room=M.spaces(r.floor).find(s=>s.cells.includes(expected[0]));assert.deepEqual(room.cells.sort((a,b)=>a-b),expected);
  assert.deepEqual(M.decode({...M.empty(),floors:[r.floor]}).floors[0],r.floor);
 }
});
test('four labelled corner rooms can be added consecutively without any room-wide starter wall',()=>{
 let f=floor();f.labels=[{key:'lounge',label:'Lounge',cell:30*80+40}];
 for(let i=1;i<=4;i++){
  const parent=M.spaces(f).sort((a,b)=>b.cells.length-a.cells.length)[0],r=M.split(f,parent.anchor,{kind:'corner'});assert.equal(r.error,null);
  const next=M.spaces(r.floor),newRoom=next.filter(s=>!s.label).sort((a,b)=>a.cells.length-b.cells.length)[0];r.floor.labels.push({key:'bed_'+i,label:'Bed '+i,cell:newRoom.anchor});f=r.floor;
  assert.equal(M.spaces(f).length,i+1);assert.equal(f.walls.length,i*2);assert.equal(f.labels.length,i+1);
 }
 assert.equal(new Set(M.spaces(f).flatMap(s=>s.cells)).size,M.spaces(f).reduce((n,s)=>n+s.cells.length,0));M.decode({...M.empty(),floors:[f]});
 for(const w of f.walls){assert(Math.abs(w.a[0]-w.b[0])<72);assert(Math.abs(w.a[1]-w.b[1])<50);}
});
test('invalid oversized divider coordinates terminate safely inside the bounded drawing grid',()=>{
 const {spawnSync}=require('node:child_process'),modulePath=require.resolve('../src/floor-plan-model');
 const script=`const M=require(${JSON.stringify(modulePath)});const f={...M.blank('ground','Ground floor'),outline:M.outline('Rectangle')};for(const o of [{kind:'corner',corner:'top-left',x:Number.MAX_SAFE_INTEGER,y:Number.MAX_SAFE_INTEGER},{kind:'L',first:20,second:50,offset:Number.MAX_SAFE_INTEGER}]){const r=M.split(f,2440,o);if(r.floor||!r.error)process.exit(2);}`;
 const r=spawnSync(process.execPath,['-e',script],{timeout:5000,encoding:'utf8'});assert.equal(r.status,0,r.error?.message||r.stderr);
});
test('custom Finish closes either drawing direction without retracing the last edge',()=>{
 const a=[[8,8],[72,8],[72,52]],b=[[8,8],[8,52],[72,52]],before=structuredClone(a);
 assert.deepEqual(M.closeOutline(a),[[8,8],[72,8],[72,52],[8,52]]);assert.deepEqual(a,before);
 assert.deepEqual(M.closeOutline(b),[[8,8],[8,52],[72,52],[72,8]]);
 const l=[[8,8],[72,8],[72,30],[52,30],[52,52]];
 assert.deepEqual(M.closeOutline(l),[...l,[8,52]]);
 const complete=[...l,[8,52]];assert.deepEqual(M.closeOutline(complete),complete);assert.deepEqual(M.closeOutline([...complete,[8,8]]),complete);
 for(const outline of [M.closeOutline(a),M.closeOutline(b),M.closeOutline(l)])assert.equal(M.spaces({...floor(),outline}).length,1);
});
