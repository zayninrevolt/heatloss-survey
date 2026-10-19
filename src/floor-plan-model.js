(function(root,factory){'use strict';var old=typeof module==='object'&&module.exports?require('./layout-model.js'):root.HouseLayoutModel;var api=factory(old);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.FloorPlanModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(G){
 'use strict';
 function blank(id,name){return {id:id,name:name,outline:[],walls:[],labels:[]};}
 function empty(){return {version:2,front:'bottom',includeReport:false,floors:[blank('ground','Ground floor'),blank('first','First floor')]};}
 function outline(shape){return shape==='L'?[[4,5],[76,5],[76,30],[56,30],[56,55],[4,55]]:[[4,5],[76,5],[76,55],[4,55]];}
 function pair(a,b){return Math.min(a,b)+':'+Math.max(a,b);}
 function adjacent(id){var x=id%80,y=Math.floor(id/80),a=[];if(x)a.push(id-1);if(x<79)a.push(id+1);if(y)a.push(id-80);if(y<59)a.push(id+80);return a;}
 function spaces(f){
  if(!f.outline.length)return [];
  var cells=new Set(),blocked=new Set();
  for(var y=0;y<60;y++)for(var x=0;x<80;x++)if(G.inside([x+.5,y+.5],f.outline))cells.add(y*80+x);
  f.walls.forEach(function(w){
   var vertical=w.a[0]===w.b[0],start=Math.min(vertical?w.a[1]:w.a[0],vertical?w.b[1]:w.b[0]),end=Math.max(vertical?w.a[1]:w.a[0],vertical?w.b[1]:w.b[0]);
   for(var n=start;n<end;n++){
    var a=vertical?n*80+w.a[0]-1:(w.a[1]-1)*80+n,b=vertical?n*80+w.a[0]:w.a[1]*80+n;
    var validA=vertical?w.a[0]>0:w.a[1]>0,validB=vertical?w.a[0]<80:w.a[1]<60;
    if(!(validA&&cells.has(a)) && !(validB&&cells.has(b)))throw new Error('An internal wall is outside the floor outline.');
    if(validA&&validB)blocked.add(pair(a,b));
   }
  });
  var unseen=new Set(cells),result=[];
  while(unseen.size){
   if(result.length>=80)throw new Error('Too many spaces on one floor.');
   var first=unseen.values().next().value,queue=[first];unseen.delete(first);
   for(var i=0;i<queue.length;i++)adjacent(queue[i]).forEach(function(next){if(unseen.has(next)&&!blocked.has(pair(queue[i],next))){unseen.delete(next);queue.push(next);}});
   var set=new Set(queue),distance=new Map(),border=[];
   queue.forEach(function(id){if(adjacent(id).length<4||adjacent(id).some(function(n){return !set.has(n);})) {distance.set(id,1);border.push(id);}});
   var anchor=first,best=0,centreX=queue.reduce(function(sum,id){return sum+id%80;},0)/queue.length,centreY=queue.reduce(function(sum,id){return sum+Math.floor(id/80);},0)/queue.length;
   for(var j=0;j<border.length;j++){var id=border[j],d=distance.get(id),oldDistance=Math.hypot(anchor%80-centreX,Math.floor(anchor/80)-centreY),newDistance=Math.hypot(id%80-centreX,Math.floor(id/80)-centreY);
    if(d>best||(d===best&&newDistance<oldDistance)){best=d;anchor=id;}
    adjacent(id).forEach(function(n){if(set.has(n)&&!distance.has(n)){distance.set(n,d+1);border.push(n);}});
   }
   var rows=new Map();queue.forEach(function(id){var row=Math.floor(id/80);if(!rows.has(row))rows.set(row,[]);rows.get(row).push(id%80);});
   var path='';rows.forEach(function(xs,y){xs.sort(function(a,b){return a-b;});var start=xs[0],last=start;function run(){var width=(last-start+1)*8;path+='M'+start*8+' '+y*8+'h'+width+'v8h-'+width+'Z';}for(var k=1;k<xs.length;k++){if(xs[k]!==last+1){run();start=xs[k];}last=xs[k];}run();});
   var labels=f.labels.filter(function(label){return set.has(label.cell);});
   if(labels.length>1)throw new Error('This wall change would join two labelled rooms. Remove one sketch label first.');
   result.push({id:first,cells:queue,anchor:anchor,path:path,label:labels[0]||null});
  }
  f.labels.forEach(function(label){if(!cells.has(label.cell))throw new Error('A room label would be outside the floor.');});
  return result;
 }
 function point(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isInteger)&&p[0]>=0&&p[0]<=80&&p[1]>=0&&p[1]<=60;}
 function text(t,n){return typeof t==='string'&&t.trim()&&t.length<=n&&!/[\u0000-\u001f]/.test(t);}
 function decode(raw){
  if(raw===''||raw===undefined)return empty();
  if(typeof raw==='string'&&raw.length>50000)throw new Error('Layout is too large.');
  var v=typeof raw==='string'?JSON.parse(raw):raw;
  if(v&&v.version===1)return G.decode(v);
  if(!v||Array.isArray(v)||v.version!==2)throw new Error('Unsupported floor-plan version.');
  if(!['top','bottom','left','right'].includes(v.front)||typeof v.includeReport!=='boolean'||!Array.isArray(v.floors)||!v.floors.length||v.floors.length>8)throw new Error('Invalid floor plan.');
  var ids=new Set(),keys=new Set(),count=0;
  var floors=v.floors.map(function(f){
   if(!f||typeof f.id!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(f.id)||ids.has(f.id)||!text(f.name,40)||!Array.isArray(f.outline)||!Array.isArray(f.walls)||!Array.isArray(f.labels)||f.outline.length>32||f.walls.length>120)throw new Error('Invalid floor.');
   ids.add(f.id);var o=f.outline.map(function(p){if(!point(p))throw new Error('Invalid floor corner.');return p.slice();});
   if(o.length){G.polygon(o.map(function(p){return [p[0]*8,p[1]*8];}));o.forEach(function(p,i){var next=o[(i+1)%o.length];if(p[0]!==next[0]&&p[1]!==next[1])throw new Error('Floor edges must be horizontal or vertical.');});}
   else if(f.walls.length||f.labels.length)throw new Error('Draw a floor outline first.');
   var walls=new Set();var w=f.walls.map(function(w){if(!w||typeof w.id!=='string'||!/^[a-z0-9_-]{1,40}$/.test(w.id)||walls.has(w.id)||!point(w.a)||!point(w.b)||(w.a[0]!==w.b[0]&&w.a[1]!==w.b[1])||(w.a[0]===w.b[0]&&w.a[1]===w.b[1]))throw new Error('Invalid internal wall.');walls.add(w.id);return {id:w.id,a:w.a.slice(),b:w.b.slice()};});
   var labels=f.labels.map(function(l){count++;if(count>60||!l||typeof l.key!=='string'||!/^[a-z0-9_]{1,80}$/.test(l.key)||keys.has(l.key)||!text(l.label,80)||!Number.isInteger(l.cell)||l.cell<0||l.cell>=4800)throw new Error('Invalid or duplicate room label.');keys.add(l.key);return {key:l.key,label:l.label,cell:l.cell};});
   var next={id:f.id,name:f.name,outline:o,walls:w,labels:labels};spaces(next);return next;
  });
  var clean={version:2,front:v.front,includeReport:v.includeReport,floors:floors};if(JSON.stringify(clean).length>50000)throw new Error('Layout is too large.');return clean;
 }
 return {empty:empty,blank:blank,outline:outline,spaces:spaces,decode:decode};
});
