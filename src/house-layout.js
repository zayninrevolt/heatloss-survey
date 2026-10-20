(function(win){
 'use strict';
 var doc=win.document,M=win.FloorPlanModel,G=win.HouseLayoutModel,field=doc.getElementById('house_layout');
 if(!field||!M||doc.getElementById('houseLayoutCanvas'))return;
 var state=M.empty(),floorId='ground',selected=null,lastRaw=null,loadError=false,legacy=false,history=[],tool='select',draft=null,start=null,splitDraft=null,previewFloor=null,gesture=null,pointers=new Map(),analyses=new Map(),readRaw=null,readValue=null,exitTab='frontTab',returnScroll=0;
 var view={x:0,y:0,w:640,h:480};
 doc.getElementById('layoutForm').replaceChildren();
 var panel=doc.createElement('section');panel.id='houseLayoutCanvas';panel.setAttribute('role','main');panel.tabIndex=-1;panel.setAttribute('aria-label','Floor plan editor');
 // Static markup only. Survey text is inserted with textContent or escaped SVG.
 panel.innerHTML='<header class="plan-topbar"><button type="button" id="layoutBack" aria-label="Back to survey">‹ Back</button><select id="layoutFloor" aria-label="Floor"></select><button type="button" id="layoutUndo" aria-label="Undo sketch edit">Undo</button><button type="button" id="layoutMore" aria-label="More plan options">More</button></header>'+
 '<div class="plan-caption"><strong id="layoutCanvasTitle">Floor plan</strong><span>Visual only · not to scale</span></div>'+
 '<div id="layoutStage"><svg id="houseLayoutSvg" viewBox="0 0 640 480" role="group" aria-label="Whole-floor plan drawing" aria-describedby="layoutDrawingHelp" tabindex="0"></svg><div id="layoutEmpty"><h2>Start this floor</h2><p>Choose its outside shape. Then split it into rooms.</p><button type="button" data-shape="Rectangle">Rectangle</button><button type="button" data-shape="L">L-shaped floor</button><button type="button" data-shape="custom">Custom outline</button></div><div class="plan-zoom"><button type="button" id="layoutZoomIn" aria-label="Zoom in">+</button><button type="button" id="layoutZoomOut" aria-label="Zoom out">−</button><button type="button" id="layoutFit" aria-label="Fit whole floor">Fit</button></div></div>'+
 '<p id="layoutStatus" role="status" aria-live="polite"></p><p id="layoutDrawingHelp">Tap a space to name it. Pinch to zoom.</p>'+
 '<footer id="layoutActions"><div id="layoutNormalActions"><button type="button" id="layoutSplit">Split space</button><button type="button" id="layoutName">Name space</button><button type="button" id="layoutAdjust" aria-pressed="false">Adjust walls</button></div><div id="layoutSplitActions" hidden><button type="button" id="layoutSplitCancel">Cancel split</button><button type="button" id="layoutRotate" aria-label="Rotate divider">Rotate</button><button type="button" id="layoutFlip" aria-label="Flip L-shaped divider">Flip</button><button type="button" id="layoutSplitApply">Apply split</button></div><div id="layoutDrawingActions" hidden><button type="button" id="layoutCancelCustom">Cancel drawing</button><button type="button" id="layoutFinishCustom">Finish floor outline</button></div><div id="layoutToolActions" hidden><button type="button" id="layoutDone">Done</button></div></footer>'+
 '<dialog id="layoutSheet" aria-labelledby="layoutSheetTitle"><div class="plan-sheet-head"><h2 id="layoutSheetTitle"></h2><button type="button" id="layoutSheetClose" aria-label="Close plan options">Done</button></div><div id="layoutSheetBody"></div></dialog>';
 doc.querySelector('.app').appendChild(panel);
 var svg=doc.getElementById('houseLayoutSvg'),sheet=doc.getElementById('layoutSheet');
 // Keep the physical touch target mounted while the scene changes. Removing a touched
 // SVG handle mid-drag loses native touchend delivery to the document.
 var scene=doc.createElementNS('http://www.w3.org/2000/svg','g'),surface=doc.createElementNS('http://www.w3.org/2000/svg','rect');
 surface.setAttribute('x','-1280');surface.setAttribute('y','-960');surface.setAttribute('width','3200');surface.setAttribute('height','2400');surface.setAttribute('fill','transparent');surface.setAttribute('aria-hidden','true');svg.append(scene,surface);
 function $(id){return doc.getElementById(id);}
 function clone(v){return JSON.parse(JSON.stringify(v));}
 function status(t){$('layoutStatus').textContent=t;}
 function esc(v){return String(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function names(){return new Map(win.allRoomNames().map(function(n){return [win.roomKeyFromName(n),n];}));}
 function floor(){return state.floors.find(function(f){return f.id===floorId;})||state.floors[0];}
 function replaceFloor(f){state.floors=state.floors.map(function(old){return old.id===f.id?f:old;});}
 function spaces(f){var token=JSON.stringify(f),saved=analyses.get(f.id);if(!saved||saved.token!==token){saved={token:token,value:M.spaces(f)};analyses.set(f.id,saved);}return saved.value;}
 function chosen(){return spaces(floor()).find(function(s){return s.cells.includes(selected);});}
 function cached(){if(readRaw!==field.value){var value=M.decode(field.value);readRaw=field.value;readValue=value;}return readValue;}
 function option(el,value,text,disabled){var o=doc.createElement('option');o.value=value;o.textContent=text;o.disabled=!!disabled;el.appendChild(o);}
 function labelText(label){return names().get(label.key)||label.label+' (not in survey)';}
 function marker(front){var opposite={top:'bottom',bottom:'top',left:'right',right:'left'},positions={top:[320,18],bottom:[320,468],left:[14,240],right:[626,240]};return [['Front',front],['Back',opposite[front]]].map(function(item){var p=positions[item[1]],rotation=item[1]==='left'?-90:item[1]==='right'?90:0;return '<text x="'+p[0]+'" y="'+p[1]+'" transform="rotate('+rotation+' '+p.join(' ')+')" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="14" fill="#253b52">'+item[0]+'</text>';}).join('');}
 function scale(){var m=svg.getScreenCTM();return m&&m.a||1;}
 function drawing(f,editing,front){
  var colors=['#e3ecf6','#e2ede7','#f4ebd8','#f3e5ed','#eae5f5'],body='<rect x="-1280" y="-960" width="3200" height="2400" fill="white"/>'+marker(front),font=editing?Math.max(16,Math.min(24,12/scale())):16;
  spaces(f).forEach(function(s,i){var label=s.label?labelText(s.label):'',active=editing&&s.cells.includes(selected),a=s.anchor,x=(a%80+.5)*8,y=(Math.floor(a/80)+.5)*8;
   body+='<g'+(editing?' data-space="'+s.id+'" tabindex="0" role="button" aria-label="'+esc(label||'Unlabelled space '+(i+1))+'"':'')+'><path d="'+s.path+'" fill="'+(active?'#ffe3bd':label?colors[i%colors.length]:'#f1f5f8')+'"/>';
   if(label||editing)body+='<text x="'+x+'" y="'+y+'" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="'+font+'" font-weight="'+(label?'700':'400')+'" fill="'+(label?'#243544':'#64788a')+'" pointer-events="none">'+esc(label||(splitDraft?'':'Tap to name'))+'</text>';
   body+='</g>';
  });
  f.walls.forEach(function(w){var attrs='x1="'+w.a[0]*8+'" y1="'+w.a[1]*8+'" x2="'+w.b[0]*8+'" y2="'+w.b[1]*8+'"';body+='<g'+(editing?' data-wall="'+esc(w.id)+'"':'')+'><line '+attrs+' stroke="#243544" stroke-width="4" pointer-events="none"/>'+(editing&&tool==='erase'?'<line '+attrs+' stroke="transparent" stroke-width="'+44/scale()+'" pointer-events="stroke"/>':'')+'</g>';});
  if(f.outline.length)body+='<polygon data-floor-outline="true" points="'+f.outline.map(function(p){return p[0]*8+','+p[1]*8;}).join(' ')+'" fill="none" stroke="#243544" stroke-width="6" stroke-linejoin="round" pointer-events="none"/>';
  return body;
 }
 function handle(attrs,p,axis,name){var r=23/scale(),size=9/scale(),x=p[0]*8,y=p[1]*8;return '<g '+attrs+' role="button" tabindex="0" aria-label="'+esc(name)+'"><circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#fff" stroke="#2563eb" stroke-width="'+2/scale()+'"/><path d="'+(axis==='x'?'M'+(x-size)+' '+y+'h'+size*2+'m-'+size*1.5+' -'+size*.5+'l-'+size*.5+' '+size*.5+' '+size*.5+' '+size*.5+'m'+size+' 0l'+size*.5+' -'+size*.5+' -'+size*.5+' -'+size*.5:'M'+x+' '+(y-size)+'v'+size*2+'m-'+size*.5+' -'+size*1.5+'l'+size*.5+' -'+size*.5+' '+size*.5+' '+size*.5+'m0 '+size+'l-'+size*.5+' '+size*.5+' -'+size*.5+' -'+size*.5)+'" stroke="#2563eb" stroke-width="'+2/scale()+'" fill="none" pointer-events="none"/></g>';}
 function paint(){
  svg.setAttribute('viewBox',[view.x,view.y,view.w,view.h].join(' '));
  var f=splitDraft&&splitDraft.result.floor||previewFloor||floor();scene.innerHTML=drawing(f,true,state.front);
  if(splitDraft){var result=splitDraft.result;result.walls.forEach(function(w){scene.insertAdjacentHTML('beforeend','<line x1="'+w.a[0]*8+'" y1="'+w.a[1]*8+'" x2="'+w.b[0]*8+'" y2="'+w.b[1]*8+'" stroke="'+(result.error?'#bd3434':'#2563eb')+'" stroke-width="5" pointer-events="none"/>');});result.handles.forEach(function(h){scene.insertAdjacentHTML('beforeend',handle('data-split-handle="'+h.id+'"',h.point,h.axis,'Move '+h.id+' divider handle'));});}
  else if(tool==='adjust')f.walls.forEach(function(w,i){scene.insertAdjacentHTML('beforeend',handle('data-move-wall="'+esc(w.id)+'"',[(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2],w.a[0]===w.b[0]?'x':'y','Move internal wall '+(i+1)));});
  if(tool==='outline'&&!draft){var r=23/scale();scene.insertAdjacentHTML('beforeend',f.outline.map(function(p,i){return '<g data-layout-corner="'+i+'" role="button" tabindex="0" aria-label="Reshape floor corner '+(i+1)+'"><circle cx="'+p[0]*8+'" cy="'+p[1]*8+'" r="'+r+'" fill="#fff" stroke="#2563eb" stroke-width="'+2/scale()+'"/><circle cx="'+p[0]*8+'" cy="'+p[1]*8+'" r="'+4/scale()+'" fill="#2563eb" pointer-events="none"/></g>';}).join(''));}
  if(draft){
   scene.insertAdjacentHTML('beforeend','<polyline points="'+draft.map(function(p){return p[0]*8+','+p[1]*8;}).join(' ')+'" fill="none" stroke="#2563eb" stroke-width="3" pointer-events="none"/>');
   draft.forEach(function(p,i){scene.insertAdjacentHTML('beforeend','<g data-draft-point="'+i+'" '+(i===0&&draft.length>=3?'role="button" tabindex="0" aria-label="Close custom outline"':'role="img" aria-label="Outside corner '+(i+1)+'"')+'><circle cx="'+p[0]*8+'" cy="'+p[1]*8+'" r="'+23/scale()+'" fill="transparent" pointer-events="all"/><circle cx="'+p[0]*8+'" cy="'+p[1]*8+'" r="'+6/scale()+'" fill="'+(i===0?'#fff':'#2563eb')+'" stroke="#2563eb" stroke-width="'+2/scale()+'" pointer-events="none"/></g>');});
  }
  if(start)scene.insertAdjacentHTML('beforeend','<line x1="'+start.a[0]*8+'" y1="'+start.a[1]*8+'" x2="'+start.end[0]*8+'" y2="'+start.end[1]*8+'" stroke="#2563eb" stroke-width="4" stroke-dasharray="6 3" pointer-events="none"/>');
 }
 function render(){
  floorId=floor().id;var f=floor(),s=chosen(),select=$('layoutFloor');select.replaceChildren();state.floors.forEach(function(f){option(select,f.id,f.name);});select.value=floorId;select.disabled=!!draft||!!splitDraft;
  $('layoutCanvasTitle').textContent=f.name;$('layoutEmpty').hidden=!!f.outline.length||!!draft;
  $('layoutSplit').disabled=!s;$('layoutName').disabled=!s;$('layoutAdjust').disabled=!f.walls.length;$('layoutAdjust').setAttribute('aria-pressed',String(tool==='adjust'));
  $('layoutUndo').disabled=!!splitDraft||(draft?!draft.length:!history.length);$('layoutMore').disabled=!!splitDraft||!!draft;
  $('layoutNormalActions').hidden=!!splitDraft||!!draft||!['select','adjust'].includes(tool);
  $('layoutSplitActions').hidden=!splitDraft;$('layoutDrawingActions').hidden=!draft;$('layoutToolActions').hidden=!!draft||!!splitDraft||['select','adjust'].includes(tool);
  $('layoutFinishCustom').disabled=!draft||draft.length<3;
  $('layoutFlip').hidden=!splitDraft||splitDraft.result.options.kind!=='L';$('layoutSplitApply').disabled=!splitDraft||!!splitDraft.result.error;
  var cornerRoom=splitDraft&&splitDraft.result.options.kind==='corner';$('layoutSplitApply').textContent=cornerRoom?'Add corner room':'Apply split';$('layoutRotate').textContent=cornerRoom?'Corner':'Rotate';$('layoutRotate').setAttribute('aria-label',cornerRoom?'Change room corner':'Rotate divider');
  $('layoutDrawingHelp').textContent=splitDraft?(cornerRoom?'Drag width and depth handles. Corner switches position.':'Drag the blue handles, then Apply split.'):draft?'Tap corners, or drag from the last blue point. Finish closes the outline.':({select:'Tap a space to name it. Pinch to zoom.',adjust:'Drag a blue handle to move its wall. Pinch to zoom.',outline:'Drag the corners to reshape this floor.',wall:'Manual wall: tap its start and end, or drag.',erase:'Tap a wall to remove it. Room labels are protected.'}[tool]);paint();
 }
 function closeSheet(){if(sheet.open)sheet.close();}
 function openSheet(title,html){closeSheet();$('layoutSheetTitle').textContent=title;$('layoutSheetBody').innerHTML=html;sheet.showModal();}
 $('layoutSheetClose').onclick=closeSheet;
 function reload(){
  if(field.value===lastRaw)return;lastRaw=field.value;legacy=false;loadError=false;
  try{var value=cached();legacy=value.version===1;state=legacy?M.empty():M.decode(value);status(legacy?'Old room-box sketch retained. Back up before replacing it.':'');}catch(error){state=M.empty();loadError=true;status('Saved layout could not be read. Export a backup before replacing it.');}
  selected=null;draft=null;start=null;splitDraft=null;previewFloor=null;gesture=null;history=[];analyses.clear();closeSheet();render();
 }
 function save(){
  var old=field.value,previous=loadError?'':old,savedHistory=history.slice(),cell=selected;
  if((loadError||legacy)&&!win.confirm('Replace the old sketch with whole-floor plans? Export a JSON backup first if you want to keep it. Survey measurements are unchanged.')){lastRaw=null;reload();return false;}
  try{var clean=M.decode(state),raw=JSON.stringify(clean);if(loadError)history=[];if(raw!==old){history.push(previous);if(history.length>20)history.shift();}state=clean;field.value=raw;lastRaw=raw;loadError=false;legacy=false;win.update();render();status('Plan updated · measurements unchanged');return true;}
  catch(error){lastRaw=null;reload();history=savedHistory;selected=cell;render();status(error.message);return false;}
 }
 function fit(){view={x:0,y:0,w:640,h:480};paint();}
 function create(points){floor().outline=points;floor().walls=[];floor().labels=[];draft=null;start=null;tool='select';selected=M.spaces(floor())[0].anchor;closeSheet();fit();save();}
 function shape(value){if(floor().outline.length&&!win.confirm('Replace this floor drawing and its sketch labels? Survey measurements are unchanged.'))return;closeSheet();if(value==='custom'){draft=[];start=null;tool='select';render();}else create(M.outline(value));}
 panel.querySelectorAll('[data-shape]').forEach(function(b){b.onclick=function(){shape(b.dataset.shape);};});
 function nameSpace(){
  var s=chosen();if(!s)return;openSheet(s.label?labelText(s.label):'Name this space','<label for="layoutRoom">Room from survey</label><select id="layoutRoom"></select><div class="plan-sheet-actions"><button type="button" id="layoutAssign">Label selected space</button><button type="button" id="layoutSplitSpace">Split this space</button></div><button type="button" id="layoutRemove">Remove room label</button>');
  var used=new Set();state.floors.forEach(function(f){f.labels.forEach(function(l){if(!s.label||l.key!==s.label.key)used.add(l.key);});});option($('layoutRoom'),'','Choose a room');names().forEach(function(n,k){option($('layoutRoom'),k,n+(used.has(k)?' (already labelled)':''),used.has(k));});$('layoutRoom').value=s.label?s.label.key:'';
  $('layoutAssign').disabled=!$('layoutRoom').value;$('layoutRoom').onchange=function(){$('layoutAssign').disabled=!this.value;};$('layoutRemove').hidden=!s.label;
  $('layoutAssign').onclick=function(){var key=$('layoutRoom').value;if(!names().has(key)||used.has(key))return;floor().labels=floor().labels.filter(function(l){return !s.cells.includes(l.cell);});floor().labels.push({key:key,label:names().get(key),cell:s.anchor});if(save())closeSheet();};
  $('layoutRemove').onclick=function(){floor().labels=floor().labels.filter(function(l){return !s.cells.includes(l.cell);});if(save())closeSheet();};$('layoutSplitSpace').onclick=splitMenu;
 }
 function splitMenu(){if(!chosen())return;openSheet('Split this space','<p>Choose a divider or a corner room, then drag its handles on the plan.</p><div class="plan-sheet-actions"><button type="button" id="layoutStraight">Straight split</button><button type="button" id="layoutL">L-shaped split</button><button type="button" id="layoutCorner">Corner room</button></div>');$('layoutStraight').onclick=function(){beginSplit('straight');};$('layoutL').onclick=function(){beginSplit('L');};$('layoutCorner').onclick=function(){beginSplit('corner');};}
 function beginSplit(kind){closeSheet();tool='select';splitDraft={base:clone(floor()),cell:selected,result:M.split(floor(),selected,{kind:kind})};status('');render();}
 function changeSplit(options){splitDraft.result=M.split(splitDraft.base,splitDraft.cell,options);$('layoutSplitApply').disabled=!!splitDraft.result.error;status(splitDraft.result.error||'');paint();}
 $('layoutSplit').onclick=splitMenu;$('layoutName').onclick=nameSpace;
 $('layoutSplitCancel').onclick=function(){splitDraft=null;status('Split cancelled. Plan unchanged.');render();};
 $('layoutRotate').onclick=function(){var o=splitDraft.result.options;if(o.kind==='corner'){var corners=['top-left','top-right','bottom-right','bottom-left'];changeSplit({kind:'corner',corner:corners[(corners.indexOf(o.corner)+1)%corners.length]});}else changeSplit({kind:o.kind,axis:o.axis==='vertical'?'horizontal':'vertical'});};
 $('layoutFlip').onclick=function(){var o=splitDraft.result.options;changeSplit({...o,first:o.second,second:o.first});};
 $('layoutSplitApply').onclick=function(){if(!splitDraft||!splitDraft.result.floor)return;var next=splitDraft.result.floor;splitDraft=null;replaceFloor(next);var regions=M.spaces(next);if(!regions.some(function(s){return s.cells.includes(selected);}))selected=regions[0].anchor;save();};
 $('layoutAdjust').onclick=function(){tool=tool==='adjust'?'select':'adjust';status('');render();};
 $('layoutDone').onclick=function(){tool='select';start=null;render();};
 function addFloor(){if(state.floors.length>=8||draft)return;var n=win.prompt('Name the new floor, for example Loft or Basement.','');if(n===null)return;n=n.trim();if(!n||n.length>40||state.floors.some(function(f){return f.name.toLowerCase()===n.toLowerCase();})){status('Choose a unique floor name, up to 40 characters.');return;}var i=state.floors.length+1;while(state.floors.some(function(f){return f.id==='floor'+i;}))i++;floorId='floor'+i;state.floors.push(M.blank(floorId,n));selected=null;tool='select';closeSheet();fit();save();}
 function more(){
  openSheet('Plan options','<label for="layoutFront">Front of property</label><select id="layoutFront"><option value="bottom">Bottom of drawing</option><option value="top">Top of drawing</option><option value="left">Left of drawing</option><option value="right">Right of drawing</option></select><label class="layout-report-option"><input type="checkbox" id="layoutInclude"> Include layout in report</label><div class="plan-sheet-actions"><button type="button" id="layoutSaveImage">Save layout image</button><button type="button" id="layoutAddFloor">Add floor</button><button type="button" id="layoutOutlineOptions">Floor outline</button></div><details><summary>Advanced drawing</summary><div class="plan-sheet-actions"><button type="button" data-plan-tool="wall">Draw internal wall</button><button type="button" data-plan-tool="erase">Remove wall</button><button type="button" data-plan-tool="outline">Edit floor outline</button></div></details>');
  $('layoutFront').value=state.front;$('layoutInclude').checked=state.includeReport;$('layoutSaveImage').disabled=!floor().outline.length;$('layoutAddFloor').disabled=state.floors.length>=8;
  $('layoutFront').onchange=function(){state.front=this.value;save();};$('layoutInclude').onchange=function(){state.includeReport=this.checked;save();};$('layoutAddFloor').onclick=addFloor;$('layoutSaveImage').onclick=saveImage;
  $('layoutOutlineOptions').onclick=function(){openSheet('Floor outline','<p>Replacing the outline clears this floor’s sketch walls and labels, not its survey measurements.</p><label for="layoutShape">Floor outline</label><select id="layoutShape"><option value="Rectangle">Rectangle</option><option value="L">L-shaped floor</option><option value="custom">Custom outline</option></select><button type="button" id="layoutCreateOutline">'+(floor().outline.length?'Replace floor outline':'Create floor outline')+'</button><button type="button" id="layoutEditOutline">Adjust existing outline</button>');$('layoutCreateOutline').onclick=function(){shape($('layoutShape').value);};$('layoutEditOutline').disabled=!floor().outline.length;$('layoutEditOutline').onclick=function(){closeSheet();tool='outline';render();};};
  sheet.querySelectorAll('[data-plan-tool]').forEach(function(b){b.disabled=!floor().outline.length;b.onclick=function(){tool=b.dataset.planTool;start=null;closeSheet();render();};});
 }
 $('layoutMore').onclick=more;
 $('layoutFloor').onchange=function(){floorId=this.value;selected=null;tool='select';previewFloor=null;status('');fit();render();};
 $('layoutUndo').onclick=function(){if(draft){draft.pop();render();return;}if(!history.length||splitDraft)return;var raw=history.pop(),keep=history.slice();field.value=raw;lastRaw=null;reload();history=keep;win.update();render();status('Sketch edit undone. Measurements unchanged.');};
 function finish(){if(!draft||draft.length<3)return;try{create(M.closeOutline(draft));}catch(error){status(error.message);}}
 $('layoutFinishCustom').onclick=finish;$('layoutCancelCustom').onclick=function(){draft=null;start=null;render();};
 function point(e){var p=new win.DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return [Math.max(0,Math.min(80,Math.round(p.x/8))),Math.max(0,Math.min(60,Math.round(p.y/8)))];}
 function near(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])*8*scale()<=23;}
 function aligned(a,b){return Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1])?[b[0],a[1]]:[a[0],b[1]];}
 function addWall(a,b){b=aligned(a,b);start=null;if(a[0]===b[0]&&a[1]===b[1]){render();return;}var i=1;while(floor().walls.some(function(w){return w.id==='w'+i;}))i++;floor().walls.push({id:'w'+i,a:a,b:b});save();}
 function zoom(factor,client){var before=svg.getScreenCTM(),p=new win.DOMPoint(client?client.x:svg.getBoundingClientRect().x+svg.clientWidth/2,client?client.y:svg.getBoundingClientRect().y+svg.clientHeight/2).matrixTransform(before.inverse()),w=Math.max(160,Math.min(960,view.w/factor)),ratio=w/view.w;view={x:p.x-(p.x-view.x)*ratio,y:p.y-(p.y-view.y)*ratio,w:w,h:w*.75};paint();}
 $('layoutZoomIn').onclick=function(){zoom(1.4);};$('layoutZoomOut').onclick=function(){zoom(1/1.4);};$('layoutFit').onclick=fit;
 function pinchInfo(){var a=Array.from(pointers.values()),p=a[0],q=a[1];return {distance:Math.hypot(p.x-q.x,p.y-q.y),x:(p.x+q.x)/2,y:(p.y+q.y)/2};}
 svg.addEventListener('pointerdown',function(e){
  if(e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.setPointerCapture(e.pointerId);
  if(pointers.size===2){previewFloor=null;if(gesture&&gesture.type==='custom'){draft=gesture.before;start=null;}gesture={type:'pinch',info:pinchInfo()};paint();return;}
  if(pointers.size>2)return;
  surface.style.pointerEvents='none';var target=doc.elementFromPoint(e.clientX,e.clientY)||svg;surface.style.pointerEvents='';
  var p=point(e),h=target.closest('[data-split-handle]'),w=target.closest('[data-move-wall]'),corner=target.closest('[data-layout-corner]');
  if(splitDraft&&h){var info=splitDraft.result.handles.find(function(a){return a.id===h.dataset.splitHandle;});gesture={type:'split',id:h.dataset.splitHandle,offset:splitDraft.result.options[info.id]-p[info.axis==='x'?0:1]};return;}
  if(w&&tool==='adjust'){var wall=floor().walls.find(function(a){return a.id===w.dataset.moveWall;}),axis=wall.a[0]===wall.b[0]?0:1;gesture={type:'wall',id:w.dataset.moveWall,base:clone(floor()),offset:wall.a[axis]-p[axis]};return;}
  if(corner&&tool==='outline'){gesture={type:'corner',index:Number(corner.dataset.layoutCorner),base:clone(floor())};return;}
  if(draft){
   var before=clone(draft),last=draft[draft.length-1];
   if(draft.length>=3&&near(p,draft[0])){gesture={type:'custom-close',x:e.clientX,y:e.clientY,moved:false};return;}
   if(!last){draft.push(p);last=p;}
   else if(!near(p,last)){if(draft.length>=31){status('Maximum 31 drawn corners before closing.');return;}p=aligned(last,p);if(p[0]!==last[0]||p[1]!==last[1])draft.push(p);last=p;}
   gesture={type:'custom',before:before,anchor:last.slice(),offset:[last[0]-p[0],last[1]-p[1]]};start={a:last.slice(),end:last.slice()};status('');render();return;
  }
  if(tool==='wall'){if(start){addWall(start.a,p);gesture=null;return;}start={a:p,end:p};gesture={type:'manual',x:e.clientX,y:e.clientY};paint();return;}
  var targetSpace=target.closest('[data-space]'),wall=target.closest('[data-wall]');gesture={type:'tap',space:targetSpace?Number(targetSpace.dataset.space):null,erase:tool==='erase'&&wall?wall.dataset.wall:null,x:e.clientX,y:e.clientY,view:{...view}};
 });
 svg.addEventListener('pointermove',function(e){
  if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});var g=gesture;
  if(g.type==='pinch'&&pointers.size>=2){var info=pinchInfo(),s=scale();view.x-=(info.x-g.info.x)/s;view.y-=(info.y-g.info.y)/s;zoom(info.distance/Math.max(1,g.info.distance),info);g.info=info;return;}
  var p=point(e);
  if(g.type==='split'&&splitDraft){var h=splitDraft.result.handles.find(function(h){return h.id===g.id;}),o={...splitDraft.result.options};o[h.id]=Math.max(h.min,Math.min(h.max,p[h.axis==='x'?0:1]+g.offset));changeSplit(o);}
  else if(g.type==='wall'){try{var w=g.base.walls.find(function(w){return w.id===g.id;});previewFloor=M.moveWall(g.base,g.id,p[w.a[0]===w.b[0]?0:1]+g.offset);status('');paint();}catch(error){status(error.message);}}
  else if(g.type==='corner'){try{var candidate={...g.base,outline:G.vertex(g.base.outline,g.index,p)},copy=clone(state);copy.floors=copy.floors.map(function(f){return f.id===candidate.id?candidate:f;});M.decode(copy);previewFloor=candidate;status('');paint();}catch(error){status(error.message);}}
  else if(g.type==='custom-close'){g.moved=Math.hypot(e.clientX-g.x,e.clientY-g.y)>8;}
  else if(g.type==='custom'&&start){var q=[Math.max(0,Math.min(80,p[0]+g.offset[0])),Math.max(0,Math.min(60,p[1]+g.offset[1]))];start.end=aligned(g.anchor,q);paint();}
  else if(g.type==='manual'&&start){start.end=aligned(start.a,p);g.moved=Math.hypot(e.clientX-g.x,e.clientY-g.y)>6;paint();}
  else if(g.type==='tap'){if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>8)g.panned=true;if(g.panned){var s=scale();view.x=g.view.x-(e.clientX-g.x)/s;view.y=g.view.y-(e.clientY-g.y)/s;paint();}}
 });
 function release(e,cancelled){
  pointers.delete(e.pointerId);if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);var g=gesture;
  if(g&&g.type==='pinch'&&pointers.size){var p=Array.from(pointers.values())[0];gesture={type:'tap',space:null,erase:null,x:p.x,y:p.y,view:{...view},panned:true};return;}
  gesture=null;if(!g)return;
  if(cancelled){previewFloor=null;if(g.type==='custom')draft=g.before;if(g.type==='manual'||g.type==='custom')start=null;render();return;}
  if(g.type==='custom-close'){if(!g.moved)finish();}
  else if(g.type==='custom'&&start){var end=start.end,last=draft[draft.length-1];if(end[0]!==last[0]||end[1]!==last[1]){if(draft.length<31)draft.push(end.slice());else status('Maximum 31 drawn corners before closing.');}start=null;render();}
  else if((g.type==='wall'||g.type==='corner')&&previewFloor){replaceFloor(previewFloor);previewFloor=null;save();}
  else if(g.type==='manual'&&g.moved&&start)addWall(start.a,start.end);
  else if(g.type==='tap'&&!g.panned&&!splitDraft){if(g.erase){floor().walls=floor().walls.filter(function(w){return w.id!==g.erase;});save();}else if(tool==='select'||tool==='adjust'){var s=spaces(floor()).find(function(s){return s.id===g.space;});selected=s?s.anchor:null;tool='select';render();if(s)nameSpace();}}
 }
 svg.addEventListener('pointerup',function(e){release(e,false);});svg.addEventListener('pointercancel',function(e){release(e,true);});
 svg.addEventListener('keydown',function(e){
  var moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},target=e.target.closest('[data-space]'),h=e.target.closest('[data-split-handle]'),w=e.target.closest('[data-move-wall]'),corner=e.target.closest('[data-layout-corner]');
  if(draft&&draft.length>=3&&e.target.closest('[data-draft-point="0"]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();finish();return;}
  if(e.key==='Escape'){splitDraft=null;previewFloor=null;gesture=null;start=null;draft=null;tool='select';render();return;}
  if(target&&(e.key==='Enter'||e.key===' ')){var s=spaces(floor()).find(function(s){return s.id===Number(target.dataset.space);});selected=s.anchor;render();nameSpace();e.preventDefault();}
  if(moves[e.key]&&(h||w||corner)){var d=moves[e.key],focus;
   try{if(h&&splitDraft){var id=h.dataset.splitHandle,handle=splitDraft.result.handles.find(function(a){return a.id===id;}),o={...splitDraft.result.options};o[id]=Math.max(handle.min,Math.min(handle.max,o[id]+d[handle.axis==='x'?0:1]));changeSplit(o);focus=svg.querySelector('[data-split-handle="'+id+'"]');}
    else if(w){var id=w.dataset.moveWall,wall=floor().walls.find(function(a){return a.id===id;}),axis=wall.a[0]===wall.b[0]?0:1;replaceFloor(M.moveWall(floor(),id,wall.a[axis]+d[axis]));save();focus=svg.querySelector('[data-move-wall="'+id+'"]');}
    else{var i=Number(corner.dataset.layoutCorner),p=floor().outline[i];floor().outline=G.vertex(floor().outline,i,[p[0]+d[0],p[1]+d[1]]);save();focus=svg.querySelector('[data-layout-corner="'+i+'"]');}if(focus)focus.focus({preventScroll:true});
   }catch(error){status(error.message);}e.preventDefault();
  }
 });
 $('layoutBack').onclick=function(){closeSheet();var tab=$(exitTab)||$('frontTab');if(tab)tab.click();win.requestAnimationFrame(function(){win.scrollTo(0,returnScroll);});};
 doc.querySelectorAll('.tab').forEach(function(tab){tab.addEventListener('click',function(){var entering=tab.id==='layoutTab';if(entering)returnScroll=win.scrollY;else exitTab=tab.id;doc.body.classList.toggle('house-layout-mode',entering);var skip=doc.querySelector('.skip-link');if(skip){skip.setAttribute('href',entering?'#houseLayoutCanvas':'#preview');skip.textContent=entering?'Skip to floor plan':'Skip to document preview';}if(entering){doc.body.classList.remove('hl-rads-focus-mode');reload();render();win.scrollTo(0,0);}else{closeSheet();splitDraft=null;previewFloor=null;gesture=null;pointers.clear();}});});
 var frame=0;win.addEventListener('resize',function(){if(!frame&&doc.body.classList.contains('house-layout-mode'))frame=win.requestAnimationFrame(function(){frame=0;paint();});});
 var oldSet=win.setData;win.setData=function(data){var raw=data&&Object.prototype.hasOwnProperty.call(data,'house_layout')?data.house_layout:'';if(typeof raw!=='string')throw new Error('Invalid layout in this survey.');M.decode(raw);var old=field.value;field.value=raw;lastRaw=null;try{var value=oldSet.apply(this,arguments);reload();return value;}catch(error){field.value=old;lastRaw=null;reload();throw error;}};
 var oldUpdate=win.update;win.update=function(){reload();return oldUpdate.apply(this,arguments);};
 // PDF popups copy inline styles, not linked stylesheets.
 var printStyle=doc.createElement('style');printStyle.id='houseLayoutPrintStyles';printStyle.textContent='.layout-sheet-wrap{background:#fff;color:#172b3a}.layout-sheet-wrap>svg{display:block;width:100%;height:auto}.layout-sheet-wrap>p{font:12px Arial,sans-serif;color:#253b52}@media print{.layout-sheet-wrap{break-inside:avoid;page-break-inside:avoid}.layout-sheet-wrap>svg{display:block;width:220mm!important;height:165mm!important;margin:0 auto}.layout-sheet-wrap>h2{margin:0 0 3mm!important;font:700 14pt Arial,sans-serif!important}.layout-sheet-wrap>p{margin:0 0 3mm!important;font:9pt Arial,sans-serif!important}}';doc.head.appendChild(printStyle);
 function image(f,front){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480" role="img" aria-label="'+esc(f.name)+' floor plan">'+drawing(f,false,front)+'<text x="16" y="20" font-family="Arial,sans-serif" font-size="12" fill="#253b52">'+esc(f.name)+'</text><text x="16" y="470" font-family="Arial,sans-serif" font-size="10" fill="#253b52">Not to scale</text></svg>';}
 async function saveImage(){if(draft||!floor().outline.length)return;var f=M.decode(state).floors.find(function(f){return f.id===floorId;}),front=state.front,button=this,url;button.disabled=true;try{url=win.URL.createObjectURL(new win.Blob([image(f,front)],{type:'image/svg+xml;charset=utf-8'}));var img=new win.Image();img.src=url;await img.decode();var c=doc.createElement('canvas');c.width=1280;c.height=960;var ctx=c.getContext('2d');if(!ctx)throw Error('Image export unavailable.');ctx.drawImage(img,0,0,c.width,c.height);var blob=await new Promise(function(resolve){c.toBlob(resolve,'image/png');});if(!blob)throw Error('Image export failed.');var a=doc.createElement('a'),u=win.URL.createObjectURL(blob);a.href=u;a.download='layout-'+(f.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'floor')+'.png';doc.body.appendChild(a);a.click();a.remove();win.setTimeout(function(){win.URL.revokeObjectURL(u);},1000);status('Floor-plan image downloaded.');}catch(error){status('Could not save the image. '+error.message);}finally{if(url)win.URL.revokeObjectURL(url);button.disabled=!floor().outline.length||!!draft;}}
 function insertLayouts(container){if(!container)return;container.querySelectorAll('.layout-sheet-wrap').forEach(function(el){el.remove();});var plan;try{plan=cached();}catch(error){return;}if(plan.version!==2||!plan.includeReport)return;var anchor=Array.from(container.children).find(function(n){var h=n.querySelector('h2');return h&&['A12a','Customer Profile'].includes(h.textContent.trim());});plan.floors.filter(function(f){return f.outline.length;}).forEach(function(f){var section=doc.createElement('section');section.className='sheet-wrap layout-sheet-wrap';section.innerHTML='<h2 class="sheet-title">Room layout: '+esc(f.name)+'</h2><p>Whole-floor visual guide. Not to scale; not used for heat-loss calculations.</p>'+image(f,plan.front);container.insertBefore(section,anchor||null);});}
 var oldRender=win.renderPreview;win.renderPreview=function(){var value=oldRender.apply(this,arguments);insertLayouts($('preview'));return value;};var oldPrint=win.buildPrintHtml;win.buildPrintHtml=function(title,titles){var html=oldPrint.apply(this,arguments);if(!Array.from(titles||[]).includes('Front')||!Array.from(titles||[]).includes('Rads'))return html;var parsed=new win.DOMParser().parseFromString(html,'text/html');insertLayouts(parsed.querySelector('main'));return '<!doctype html>\n'+parsed.documentElement.outerHTML;};
 reload();win.update();
})(window);
