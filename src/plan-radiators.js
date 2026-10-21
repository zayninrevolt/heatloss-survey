(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PlanRadiators=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Drawing coordinates only. No dimensions, outputs or survey radiator choices.
 var cache=new WeakMap(),directions={top:[0,1],right:[-1,0],bottom:[0,-1],left:[1,0]};
 function boundaries(region){
  if(cache.has(region))return cache.get(region);
  var cells=new Set(region.cells),groups=new Map(),walls=[];
  function edge(name,pos,n){var key=name+':'+pos;if(!groups.has(key))groups.set(key,{edge:name,pos:pos,values:[]});groups.get(key).values.push(n);}
  region.cells.forEach(function(id){var x=id%80,y=Math.floor(id/80);if(y===0||!cells.has(id-80))edge('top',y,x);if(x===79||!cells.has(id+1))edge('right',x+1,y);if(y===59||!cells.has(id+80))edge('bottom',y+1,x);if(x===0||!cells.has(id-1))edge('left',x,y);});
  groups.forEach(function(g){var ns=g.values.sort(function(a,b){return a-b;}),start=ns[0],last=start;function add(){walls.push({edge:g.edge,pos:g.pos,from:start,to:last+1});}for(var i=1;i<ns.length;i++){if(ns[i]!==last+1){add();start=ns[i];}last=ns[i];}add();});
  cache.set(region,walls);return walls;
 }
 function vertical(edge){return edge==='left'||edge==='right';}
 function length(w){return Math.min(6,w.to-w.from-.4);}
 function projection(w,p){var margin=length(w)/2+.2,lo=Math.ceil((w.from+margin)*2)/2,hi=Math.floor((w.to-margin)*2)/2,along=Math.max(lo,Math.min(hi,Math.round(p[vertical(w.edge)?1:0]*2)/2));return vertical(w.edge)?[w.pos,along]:[along,w.pos];}
 function cellAt(p,edge){var x=Math.floor(p[0]),y=Math.floor(p[1]);if(edge==='right')x--;if(edge==='bottom')y--;return y*80+x;}
 function snap(regions,p,options){
  options=options||{};
  if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>80||p[1]<0||p[1]>60)throw Error('Drop the radiator inside a floor space.');
  var id=Math.floor(p[1])*80+Math.floor(p[0]),region=(options.cell!==undefined||(p[0]<80&&p[1]<60))?regions.find(function(s){return s.cells.includes(options.cell===undefined?id:options.cell);}):null;
  if(!region&&options.cell===undefined)region=regions.find(function(s){return boundaries(s).some(function(w){var along=p[vertical(w.edge)?1:0];return p[vertical(w.edge)?0:1]===w.pos&&along>w.from&&along<w.to;});});
  if(!region)throw Error('Drop the radiator inside a floor space.');
  var best;
  boundaries(region).forEach(function(w){var point=projection(w,p),distance=Math.hypot(point[0]-p[0],point[1]-p[1]);if(!best||distance<best.distance)best={edge:w.edge,point:point,cell:cellAt(point,w.edge),distance:distance};});
  return best;
 }
 function geometry(regions,r){
  var region=regions.find(function(s){return s.cells.includes(r.cell);});if(!region)throw Error('Radiator is outside the floor.');
  var v=vertical(r.edge),w=boundaries(region).find(function(w){return w.edge===r.edge&&w.pos===r.point[v?0:1]&&r.point[v?1:0]>w.from&&r.point[v?1:0]<w.to;});if(!w)throw Error('Radiator must stay attached to a room wall.');
  var span=length(w),along=r.point[v?1:0],cells=new Set(region.cells),clear=80,d=directions[r.edge];
  for(var a=Math.floor(along-span/2);a<Math.ceil(along+span/2);a++){
   var p=v?[w.pos,a+.5]:[a+.5,w.pos],n=0;
   while(n<80){var x=Math.floor(p[0]+d[0]*(n+.5)),y=Math.floor(p[1]+d[1]*(n+.5));if(x<0||x>=80||y<0||y>=60||!cells.has(y*80+x))break;n++;}clear=Math.min(clear,n);
  }
  if(!clear)throw Error('Radiator must fit against the room wall.');
  var offset=Math.min(1,clear/2);return {x:r.point[0]+d[0]*offset,y:r.point[1]+d[1]*offset,rotation:v?90:0,length:span,depth:Math.min(1,clear-.4)};
 }
 function validate(regions,raw){
  if(!Array.isArray(raw)||raw.length>60)throw Error('Invalid radiator markers.');var ids=new Set();
  return raw.map(function(r){
   if(!r||typeof r.id!=='string'||!/^[a-z0-9_-]{1,40}$/.test(r.id)||ids.has(r.id)||!Object.prototype.hasOwnProperty.call(directions,r.edge)||!Number.isInteger(r.cell)||r.cell<0||r.cell>=4800||!Array.isArray(r.point)||r.point.length!==2||!r.point.every(function(n){return Number.isFinite(n)&&Number.isInteger(n*2);}))throw Error('Invalid radiator marker.');
   ids.add(r.id);var s=snap(regions,r.point,{cell:r.cell});if(s.edge!==r.edge||s.cell!==r.cell||s.point.some(function(n,i){return n!==r.point[i];}))throw Error('Radiator must stay attached to its room wall.');
   var clean={id:r.id,cell:r.cell,edge:r.edge,point:r.point.slice()};geometry(regions,clean);return clean;
  });
 }
 return {snap:snap,geometry:geometry,validate:validate};
});
