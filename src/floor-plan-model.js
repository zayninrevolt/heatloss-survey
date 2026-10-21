(function(root,factory){'use strict';var old=typeof module==='object'&&module.exports?require('./layout-model.js'):root.HouseLayoutModel;var api=factory(old,typeof module==='object'&&module.exports?require('./plan-radiators.js'):root.PlanRadiators);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.FloorPlanModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(G,R){
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
  var ids=new Set(),keys=new Set(),count=0,radiatorCount=0;
  var floors=v.floors.map(function(f){
   if(!f||typeof f.id!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(f.id)||ids.has(f.id)||!text(f.name,40)||!Array.isArray(f.outline)||!Array.isArray(f.walls)||!Array.isArray(f.labels)||f.outline.length>32||f.walls.length>120)throw new Error('Invalid floor.');
   ids.add(f.id);var o=f.outline.map(function(p){if(!point(p))throw new Error('Invalid floor corner.');return p.slice();});
   if(o.length){G.polygon(o.map(function(p){return [p[0]*8,p[1]*8];}));o.forEach(function(p,i){var next=o[(i+1)%o.length];if(p[0]!==next[0]&&p[1]!==next[1])throw new Error('Floor edges must be horizontal or vertical.');});}
   else if(f.walls.length||f.labels.length)throw new Error('Draw a floor outline first.');
   var walls=new Set();var w=f.walls.map(function(w){if(!w||typeof w.id!=='string'||!/^[a-z0-9_-]{1,40}$/.test(w.id)||walls.has(w.id)||!point(w.a)||!point(w.b)||(w.a[0]!==w.b[0]&&w.a[1]!==w.b[1])||(w.a[0]===w.b[0]&&w.a[1]===w.b[1]))throw new Error('Invalid internal wall.');walls.add(w.id);return {id:w.id,a:w.a.slice(),b:w.b.slice()};});
   var labels=f.labels.map(function(l){count++;if(count>60||!l||typeof l.key!=='string'||!/^[a-z0-9_]{1,80}$/.test(l.key)||keys.has(l.key)||!text(l.label,80)||!Number.isInteger(l.cell)||l.cell<0||l.cell>=4800)throw new Error('Invalid or duplicate room label.');keys.add(l.key);return {key:l.key,label:l.label,cell:l.cell};});
   var next={id:f.id,name:f.name,outline:o,walls:w,labels:labels},regions=spaces(next);if(f.radiators!==undefined){next.radiators=R.validate(regions,f.radiators);radiatorCount+=next.radiators.length;if(radiatorCount>120)throw Error('Too many radiator markers.');}return next;
  });
  var clean={version:2,front:v.front,includeReport:v.includeReport,floors:floors};if(JSON.stringify(clean).length>50000)throw new Error('Layout is too large.');return clean;
 }
 // Touch splits operate on a derived space, never on measured survey geometry.
 function split(f,cell,opts){
  opts=opts||{};
  if(opts.kind==='corner'&&!opts.corner){
   var fallback;
   for(var name of ['top-left','top-right','bottom-right','bottom-left']){var trial=split(f,cell,{...opts,corner:name});if(trial.floor)return trial;if(!fallback)fallback=trial;}
   return fallback;
  }
  var regions=spaces(f),region=regions.find(function(s){return s.cells.includes(cell);});
  if(!region)throw new Error('Select a space inside this floor.');
  var set=new Set(region.cells),vertical=opts.axis!=='horizontal';
  var xs=region.cells.map(function(id){return id%80;}),ys=region.cells.map(function(id){return Math.floor(id/80);});
  var left=Math.min.apply(null,xs),right=Math.max.apply(null,xs)+1,top=Math.min.apply(null,ys),bottom=Math.max.apply(null,ys)+1;
  var low=vertical?left:top,high=vertical?right:bottom,from=vertical?top:left,to=vertical?bottom:right;
  var position=Number.isInteger(opts.position)?opts.position:Math.round((low+high)/2);
  var options={kind:opts.kind==='L'?'L':opts.kind==='corner'?'corner':'straight',axis:vertical?'vertical':'horizontal',position:position};
  var added=[],used=new Set(f.walls.map(function(w){return w.id;})),i=1;
  function id(){while(used.has('s'+i))i++;var value='s'+i++;used.add(value);return value;}
  // Clip each divider to the chosen space, including concave outlines and existing walls.
  function cut(v,pos,lo,hi){
   var aStart=null,min=Math.max(0,Math.min(lo,hi)),max=Math.min(v?60:80,Math.max(lo,hi));
   if(pos<=0||pos>=(v?80:60))return;
   function run(end){added.push({id:id(),a:v?[pos,aStart]:[aStart,pos],b:v?[pos,end]:[end,pos]});aStart=null;}
   for(var n=min;n<=max;n++){
    var a=v?n*80+pos-1:(pos-1)*80+n,b=v?n*80+pos:pos*80+n;
    var interior=n<max&&set.has(a)&&set.has(b);
    if(interior&&aStart===null)aStart=n;
    if(!interior&&aStart!==null)run(n);
   }
  }
  function handle(id,axis,p,min,max){return {id:id,axis:axis,point:p,min:min,max:max};}
  var handles=[],bad=position<=low||position>=high;
  if(options.kind==='corner'){
   var corners=['top-left','top-right','bottom-right','bottom-left'];options.corner=corners.includes(opts.corner)?opts.corner:'top-left';
   var onLeft=options.corner.endsWith('left'),onTop=options.corner.startsWith('top');
   options.x=Number.isInteger(opts.x)?opts.x:Math.round(onLeft?left+(right-left)/4:right-(right-left)/4);
   options.y=Number.isInteger(opts.y)?opts.y:Math.round(onTop?top+(bottom-top)/4:bottom-(bottom-top)/4);
   var x=options.x,y=options.y,vStart=onTop?top:y,vEnd=onTop?y:bottom,hStart=onLeft?left:x,hEnd=onLeft?x:right;
   cut(true,x,vStart,vEnd);cut(false,y,hStart,hEnd);
   handles=[handle('x','x',[x,onTop?vStart+(vEnd-vStart)/4:vEnd-(vEnd-vStart)/4],left+1,right-1),handle('y','y',[onLeft?hStart+(hEnd-hStart)/4:hEnd-(hEnd-hStart)/4,y],top+1,bottom-1)];
   bad=x<=left||x>=right||y<=top||y>=bottom;
  }else if(options.kind==='L'){
   options.first=Number.isInteger(opts.first)?opts.first:Math.round(low+(high-low)/3);
   options.second=Number.isInteger(opts.second)?opts.second:Math.round(low+2*(high-low)/3);
   options.offset=Number.isInteger(opts.offset)?opts.offset:Math.round((from+to)/2);
   var a=options.first,b=options.second,c=options.offset;
   cut(vertical,a,from,c);cut(!vertical,c,a,b);cut(vertical,b,c,to);
   handles=[handle('first',vertical?'x':'y',vertical?[a,(from+c)/2]:[(from+c)/2,a],low+1,high-1),handle('second',vertical?'x':'y',vertical?[b,(c+to)/2]:[(c+to)/2,b],low+1,high-1),handle('offset',vertical?'y':'x',vertical?[(a+b)/2,c]:[c,(a+b)/2],from+1,to-1)];
   bad=a<=low||a>=high||b<=low||b>=high||a===b||c<=from||c>=to;
  }else{
   cut(vertical,position,from,to);
   handles=[handle('position',vertical?'x':'y',vertical?[position,(from+to)/2]:[(from+to)/2,position],low+1,high-1)];
  }
  var candidate={id:f.id,name:f.name,outline:f.outline.map(function(p){return p.slice();}),walls:f.walls.concat(added).map(function(w){return {id:w.id,a:w.a.slice(),b:w.b.slice()};}),labels:f.labels.map(function(l){return {...l};})},error=null;
  try{if(bad||!added.length||spaces(candidate).length!==regions.length+1)throw new Error('Move the divider until it makes two spaces.');reflowRadiators(f,candidate);decode({version:2,front:'bottom',includeReport:false,floors:[candidate]});}catch(e){error=e.message;candidate=null;}
  return {floor:candidate,error:error,walls:added,handles:handles,options:options};
 }
 function reflowRadiators(before,after,moving){
  if(before.radiators===undefined)return after;
  var old=spaces(before),next=spaces(after);
  after.radiators=before.radiators.map(function(r){
   var point=r.point.slice(),region=old.find(function(s){return s.cells.includes(r.cell);}),cell=moving&&region?(region.label?region.label.cell:region.anchor):r.cell;
   if(moving){var axis=moving.wall.a[0]===moving.wall.b[0]?0:1,other=1-axis,onFace=axis===0?(r.edge==='left'||r.edge==='right'):(r.edge==='top'||r.edge==='bottom');if(onFace&&point[axis]===moving.wall.a[axis]&&point[other]>=Math.min(moving.wall.a[other],moving.wall.b[other])&&point[other]<=Math.max(moving.wall.a[other],moving.wall.b[other])){point[axis]=moving.value;cell=(Math.floor(point[1])-(r.edge==='bottom'?1:0))*80+Math.floor(point[0])-(r.edge==='right'?1:0);}}
   if(!next.some(function(s){return s.cells.includes(cell);}))cell=next.slice().sort(function(a,b){function distance(s){return Math.hypot(s.anchor%80-point[0],Math.floor(s.anchor/80)-point[1]);}return distance(a)-distance(b);})[0].anchor;
   var snapped=R.snap(next,point,{cell:cell});return {id:r.id,cell:snapped.cell,edge:snapped.edge,point:snapped.point};
  });return after;
 }
 function moveWall(f,id,value){
  var wall=f.walls.find(function(w){return w.id===id;});if(!wall||!Number.isInteger(value))throw new Error('Choose an internal wall.');
  var index=wall.a[0]===wall.b[0]?0:1,other=1-index,old=wall.a[index];
  var lo=Math.min(wall.a[other],wall.b[other]),hi=Math.max(wall.a[other],wall.b[other]);
  var next={id:f.id,name:f.name,outline:f.outline.map(function(p){return p.slice();}),labels:f.labels.map(function(l){return {...l};}),walls:f.walls.map(function(w){
   function moved(p){var q=p.slice();if(w.id===id||(p[index]===old&&p[other]>=lo&&p[other]<=hi))q[index]=value;return q;}
   return {id:w.id,a:moved(w.a),b:moved(w.b)};
  })};
  reflowRadiators(f,next,{wall:wall,value:value});decode({version:2,front:'bottom',includeReport:false,floors:[next]});
  if(spaces(next).length!==spaces(f).length)throw new Error('Keep the divider joined to the surrounding walls.');
  return next;
 }
 function closeOutline(points){
  if(!Array.isArray(points)||points.length<3||points.length>33||!points.every(point))throw new Error('Choose at least three valid outside corners.');
  var p=points.map(function(v){return v.slice();}),first=p[0],last=p[p.length-1];
  if(first[0]===last[0]&&first[1]===last[1]){p.pop();last=p[p.length-1];}
  var candidates=[p];
  if(first[0]!==last[0]&&first[1]!==last[1]){
   var prior=p[p.length-2],vertical=prior[0]===last[0],a=[first[0],last[1]],b=[last[0],first[1]];
   candidates=[p.concat([vertical?a:b]),p.concat([vertical?b:a])];
  }
  var problem;
  for(var i=0;i<candidates.length;i++){
   try{var next=candidates[i];if(next.length>32)throw new Error('Maximum 32 outside corners.');G.polygon(next.map(function(v){return [v[0]*8,v[1]*8];}));next.forEach(function(v,j){var n=next[(j+1)%next.length];if(v[0]!==n[0]&&v[1]!==n[1])throw new Error('Outside walls must be horizontal or vertical.');});return next;}
   catch(error){problem=error;}
  }
  throw new Error('Cannot close this outline: '+problem.message);
 }
 return {empty:empty,blank:blank,outline:outline,spaces:spaces,decode:decode,split:split,moveWall:moveWall,closeOutline:closeOutline};
});
