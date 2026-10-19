(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HouseLayoutModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function empty() {
    return { version: 1, front: 'bottom', includeReport: false, floors: [
      { id: 'ground', name: 'Ground floor', rooms: [] },
      { id: 'first', name: 'First floor', rooms: [] }
    ] };
  }
  function room(key, label, shape) {
    return { key: key, label: label, points: shape === 'L'
      ? [[80,80],[256,80],[256,160],[160,160],[160,256],[80,256]]
      : [[80,80],[256,80],[256,208],[80,208]] };
  }
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  function cross(a, b, c) { return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); }
  function onSegment(a, b, p) {
    return Math.abs(cross(a,b,p)) < 1e-7 && p[0] >= Math.min(a[0],b[0]) && p[0] <= Math.max(a[0],b[0]) &&
      p[1] >= Math.min(a[1],b[1]) && p[1] <= Math.max(a[1],b[1]);
  }
  function intersects(a,b,c,d) {
    var x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
    return (x*y<0 && z*w<0) || onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
  }
  function polygon(points) {
    if (!Array.isArray(points) || points.length<3 || points.length>32) throw new Error('Invalid room polygon.');
    var copy=points.map(function(p){
      if (!Array.isArray(p) || p.length!==2 || !p.every(function(n){return typeof n==='number' && Number.isFinite(n);}) ||
          p[0]<0 || p[0]>640 || p[1]<0 || p[1]>480) throw new Error('Room shape is outside the drawing.');
      return [p[0],p[1]];
    });
    var area=0;
    for(var i=0;i<copy.length;i++){
      var a=copy[i],b=copy[(i+1)%copy.length];
      if(a[0]===b[0] && a[1]===b[1]) throw new Error('Room polygon has duplicate corners.');
      area+=a[0]*b[1]-b[0]*a[1];
      for(var j=i+2;j<copy.length;j++){
        if(i===0 && j===copy.length-1)continue;
        if(intersects(a,b,copy[j],copy[(j+1)%copy.length]))throw new Error('Room polygon crosses itself.');
      }
    }
    if(Math.abs(area)<128)throw new Error('Room shape is too small.');
    return copy;
  }
  function text(value,max) { return typeof value==='string' && value.trim() && value.length<=max; }
  function decode(raw) {
    if(raw==='' || raw===undefined)return empty();
    if(typeof raw==='string' && raw.length>50000)throw new Error('Layout is too large.');
    var value=typeof raw==='string'?JSON.parse(raw):raw;
    if(!object(value) || value.version!==1)throw new Error('Unsupported layout version.');
    if(!['top','right','bottom','left'].includes(value.front) || typeof value.includeReport!=='boolean' ||
       !Array.isArray(value.floors) || value.floors.length<1 || value.floors.length>8)throw new Error('Invalid layout.');
    var ids=new Set(),keys=new Set(),count=0;
    var floors=value.floors.map(function(f){
      if(!object(f) || typeof f.id!=='string' || !/^[a-z][a-z0-9_-]{0,39}$/.test(f.id) || ids.has(f.id) ||
         !text(f.name,40) || !Array.isArray(f.rooms))throw new Error('Invalid or duplicate layout floor.');
      ids.add(f.id);
      var rooms=f.rooms.map(function(r){
        count++;
        if(count>60 || !object(r) || typeof r.key!=='string' || !/^[a-z0-9_]{1,80}$/.test(r.key) ||
           keys.has(r.key) || !text(r.label,80))throw new Error('Invalid or duplicate layout room.');
        keys.add(r.key);
        return {key:r.key,label:r.label,points:polygon(r.points)};
      });
      return {id:f.id,name:f.name,rooms:rooms};
    });
    return {version:1,front:value.front,includeReport:value.includeReport,floors:floors};
  }
  function bounds(points) {
    var xs=points.map(function(p){return p[0];}),ys=points.map(function(p){return p[1];});
    return {left:Math.min.apply(null,xs),right:Math.max.apply(null,xs),top:Math.min.apply(null,ys),bottom:Math.max.apply(null,ys)};
  }
  function translate(points,dx,dy) {
    var b=bounds(points);dx=Math.max(-b.left,Math.min(640-b.right,dx));dy=Math.max(-b.top,Math.min(480-b.bottom,dy));
    return points.map(function(p){return [p[0]+dx,p[1]+dy];});
  }
  function rotate(points) {
    var b=bounds(points),x=(b.left+b.right)/2,y=(b.top+b.bottom)/2;
    var next=points.map(function(p){return [x-(p[1]-y),y+(p[0]-x)];});
    var n=bounds(next);
    if(n.right-n.left>640 || n.bottom-n.top>480)throw new Error('Resize this shape before rotating it.');
    return polygon(translate(next,Math.max(0,-n.left)-Math.max(0,n.right-640),Math.max(0,-n.top)-Math.max(0,n.bottom-480)));
  }
  function vertex(points,index,point) {
    var next=points.map(function(p){return p.slice();}),old=points[index];
    var before=(index+points.length-1)%points.length,after=(index+1)%points.length;
    next[index]=point.slice();
    if(points[before][0]===old[0])next[before][0]=point[0];
    if(points[before][1]===old[1])next[before][1]=point[1];
    if(points[after][0]===old[0])next[after][0]=point[0];
    if(points[after][1]===old[1])next[after][1]=point[1];
    return polygon(next);
  }
  function inside(p,points) {
    var result=false;
    for(var i=0,j=points.length-1;i<points.length;j=i++){
      var a=points[i],b=points[j];
      if(onSegment(a,b,p))return true;
      if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;
    }
    return result;
  }
  function distance(p,a,b) {
    var x=b[0]-a[0],y=b[1]-a[1],length=x*x+y*y;
    var t=length?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/length)):0;
    return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);
  }
  function labelPoint(points) {
    var b=bounds(points),best=points[0].slice(),score=-1;
    for(var i=1;i<16;i++)for(var j=1;j<16;j++){
      var p=[b.left+(b.right-b.left)*i/16,b.top+(b.bottom-b.top)*j/16];
      if(!inside(p,points))continue;
      var d=Math.min.apply(null,points.map(function(a,n){return distance(p,a,points[(n+1)%points.length]);}));
      if(d>score){score=d;best=p;}
    }
    return best;
  }
  return { empty: empty, room: room, decode: decode, polygon: polygon, bounds:bounds,
    translate:translate, rotate:rotate, vertex:vertex, inside:inside, labelPoint:labelPoint };
});
