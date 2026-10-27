(function(win){
 'use strict';
 var doc=win.document,M=win.FloorPlanModel,G=win.HouseLayoutModel,R=win.PlanRadiators,field=doc.getElementById('house_layout');
 if(!field||!M||doc.getElementById('houseLayoutCanvas'))return;
 var state=M.empty(),floorId='ground',selected=null,lastRaw=null,loadError=false,legacy=false,history=[],tool='select',draft=null,start=null,splitDraft=null,previewFloor=null,gesture=null,pointers=new Map(),analyses=new Map(),readRaw=null,readValue=null,exitTab='frontTab',returnScroll=0;
 var view={x:0,y:0,w:640,h:480},placingRadiator=null,placingService=null;
 doc.getElementById('layoutForm').replaceChildren();
 var panel=doc.createElement('section');panel.id='houseLayoutCanvas';panel.setAttribute('role','main');panel.tabIndex=-1;panel.setAttribute('aria-label','Floor plan editor');
 // Static markup only. Survey text is inserted with textContent or escaped SVG.
 panel.innerHTML='<header class="plan-topbar"><button type="button" id="layoutBack" aria-label="Back to survey">‹ Back</button><select id="layoutFloor" aria-label="Floor"></select><button type="button" id="layoutUndo" aria-label="Undo sketch edit">Undo</button><button type="button" id="layoutMore" aria-label="More plan options">More</button></header>'+
 '<div class="plan-caption"><strong id="layoutCanvasTitle">Floor plan</strong><span>Visual only · not to scale</span></div>'+
 '<div id="layoutStage"><svg id="houseLayoutSvg" viewBox="0 0 640 480" role="group" aria-label="Whole-floor plan drawing" aria-describedby="layoutDrawingHelp" tabindex="0"></svg><div id="layoutEmpty"><h2>Start this floor</h2><p>Choose its outside shape. Then split it into rooms.</p><button type="button" data-shape="Rectangle">Rectangle</button><button type="button" data-shape="L">L-shaped floor</button><button type="button" data-shape="custom">Custom outline</button></div><div class="plan-zoom"><button type="button" id="layoutZoomIn" aria-label="Zoom in">+</button><button type="button" id="layoutZoomOut" aria-label="Zoom out">−</button><button type="button" id="layoutFit" aria-label="Fit whole floor">Fit</button></div></div>'+
 '<button type="button" id="layoutAddRadiator" aria-label="Add radiator marker">+ Radiator</button><button type="button" id="layoutAddService" aria-label="Add service symbol">+ Services</button><div id="layoutServiceKey" role="group" aria-label="Layout symbol key"></div><p id="layoutStatus" role="status" aria-live="polite"></p><p id="layoutDrawingHelp">Tap a space to name it. Pinch to zoom.</p>'+
 '<footer id="layoutActions"><div id="layoutNormalActions"><button type="button" id="layoutSplit">Split space</button><button type="button" id="layoutName">Name space</button><button type="button" id="layoutAdjust" aria-pressed="false">Adjust walls</button></div><div id="layoutSplitActions" hidden><button type="button" id="layoutSplitCancel">Cancel split</button><button type="button" id="layoutRotate" aria-label="Rotate divider">Rotate</button><button type="button" id="layoutFlip" aria-label="Flip L-shaped divider">Flip</button><button type="button" id="layoutSplitApply">Apply split</button></div><div id="layoutDrawingActions" hidden><button type="button" id="layoutCancelCustom">Cancel drawing</button><button type="button" id="layoutFinishCustom">Finish floor outline</button></div><div id="layoutToolActions" hidden><button type="button" id="layoutDone">Done</button></div></footer>'+
 '<dialog id="layoutSheet" aria-labelledby="layoutSheetTitle"><div class="plan-sheet-head"><h2 id="layoutSheetTitle"></h2><button type="button" id="layoutSheetClose" aria-label="Close plan options">Done</button></div><div id="layoutSheetBody"></div></dialog>';
 doc.querySelector('.app').appendChild(panel);
 var svg=doc.getElementById('houseLayoutSvg'),sheet=doc.getElementById('layoutSheet');doc.getElementById('layoutStage').appendChild(doc.getElementById('layoutAddRadiator'));
 doc.getElementById('layoutStage').appendChild(doc.getElementById('layoutAddService'));
 // Legend markup uses only fixed type metadata and glyphs, never imported survey HTML.
 $('layoutServiceKey').innerHTML='<strong>Key</strong>'+M.serviceTypes.map(function(t){return '<span><svg viewBox="-18 -18 36 36" width="24" height="24" aria-hidden="true">'+serviceGlyph(t.type)+'</svg>'+esc(t.label)+'</span>';}).join('');
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
 function spaces(f){var token=JSON.stringify([f.outline,f.walls,f.labels]),saved=analyses.get(f.id);if(!saved||saved.token!==token){saved={token:token,value:M.spaces(f)};analyses.set(f.id,saved);}return saved.value;}
 function chosen(){return spaces(floor()).find(function(s){return s.cells.includes(selected);});}
 function cached(){if(readRaw!==field.value){var value=M.decode(field.value);readRaw=field.value;readValue=value;}return readValue;}
 function option(el,value,text,disabled){var o=doc.createElement('option');o.value=value;o.textContent=text;o.disabled=!!disabled;el.appendChild(o);}
 function labelText(label){return names().get(label.key)||label.label+' (not in survey)';}
 function marker(front){var opposite={top:'bottom',bottom:'top',left:'right',right:'left'},positions={top:[320,18],bottom:[320,468],left:[14,240],right:[626,240]};return [['Front',front],['Back',opposite[front]]].map(function(item){var p=positions[item[1]],rotation=item[1]==='left'?-90:item[1]==='right'?90:0;return '<text x="'+p[0]+'" y="'+p[1]+'" transform="rotate('+rotation+' '+p.join(' ')+')" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="14" fill="#253b52">'+item[0]+'</text>';}).join('');}
 function scale(){var m=svg.getScreenCTM();return m&&m.a||1;}
 function serviceInfo(type){return M.serviceTypes.find(function(t){return t.type===type;});}
 function serviceGlyph(type){
  var t=serviceInfo(type),shape=type==='gas-meter'?'<circle r="14"':type==='stop-tap'?'<path d="M0 -17L17 0 0 17 -17 0Z"':'<rect x="-14" y="-14" width="28" height="28" rx="'+(type==='boiler'?2:7)+'"';
  return shape+' fill="white" stroke="'+t.color+'" stroke-width="2.5"/><text x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="'+t.color+'">'+t.code+'</text>';
 }
 function drawing(f,editing,front){
  var colors=['#e3ecf6','#e2ede7','#f4ebd8','#f3e5ed','#eae5f5'],body='<rect x="-1280" y="-960" width="3200" height="2400" fill="white"/>'+marker(front),font=editing?Math.max(16,Math.min(24,12/scale())):16;
  spaces(f).forEach(function(s,i){var label=s.label?labelText(s.label):'',active=editing&&s.cells.includes(selected),a=s.anchor,x=(a%80+.5)*8,y=(Math.floor(a/80)+.5)*8;
   body+='<g'+(editing?' data-space="'+s.id+'" tabindex="0" role="button" aria-label="'+esc(label||'Unlabelled space '+(i+1))+'"':'')+'><path d="'+s.path+'" fill="'+(active?'#ffe3bd':label?colors[i%colors.length]:'#f1f5f8')+'"/>';
   if(label||editing)body+='<text x="'+x+'" y="'+y+'" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="'+font+'" font-weight="'+(label?'700':'400')+'" fill="'+(label?'#243544':'#64788a')+'" pointer-events="none">'+esc(label||(splitDraft?'':'Tap to name'))+'</text>';
   body+='</g>';
  });
  f.walls.forEach(function(w){var attrs='x1="'+w.a[0]*8+'" y1="'+w.a[1]*8+'" x2="'+w.b[0]*8+'" y2="'+w.b[1]*8+'"';body+='<g'+(editing?' data-wall="'+esc(w.id)+'"':'')+'><line '+attrs+' stroke="#243544" stroke-width="4" pointer-events="none"/>'+(editing&&tool==='erase'?'<line '+attrs+' stroke="transparent" stroke-width="'+44/scale()+'" pointer-events="stroke"/>':'')+'</g>';});
  if(f.outline.length)body+='<polygon data-floor-outline="true" points="'+f.outline.map(function(p){return p[0]*8+','+p[1]*8;}).join(' ')+'" fill="none" stroke="#243544" stroke-width="6" stroke-linejoin="round" pointer-events="none"/>';
  (f.radiators||[]).forEach(function(r,i){var g=R.geometry(spaces(f),r),l=g.length*8,h=g.depth*8;body+='<g data-radiator-symbol="true"'+(editing?' data-plan-radiator="'+esc(r.id)+'" role="button" tabindex="0" aria-label="Radiator marker '+(i+1)+'"':'')+' transform="translate('+g.x*8+' '+g.y*8+') rotate('+g.rotation+')">'+(editing?'<rect x="'+(-Math.max(l,44/scale())/2)+'" y="'+(-Math.max(h,44/scale())/2)+'" width="'+Math.max(l,44/scale())+'" height="'+Math.max(h,44/scale())+'" fill="transparent"/>':'')+'<rect x="'+(-l/2)+'" y="'+(-h/2)+'" width="'+l+'" height="'+h+'" rx="1.5" fill="#d55438" stroke="#8c291a" stroke-width="1"/>'+'<path d="M'+(-l/3)+' '+(-h/2)+'v'+h+'M0 '+(-h/2)+'v'+h+'M'+l/3+' '+(-h/2)+'v'+h+'" stroke="#fff" stroke-width="1" pointer-events="none"/></g>';});
  (f.services||[]).forEach(function(s,i){var factor=editing?Math.max(1,24/(28*scale())):1,hit=44/(scale()*factor);body+='<g data-service-symbol="'+s.type+'"'+(editing?' data-plan-service="'+esc(s.id)+'" role="button" tabindex="0" aria-label="'+esc(serviceInfo(s.type).label)+' marker '+(i+1)+'"':'')+' transform="translate('+s.point[0]*8+' '+s.point[1]*8+') scale('+factor+')">'+(editing?'<rect x="'+(-hit/2)+'" y="'+(-hit/2)+'" width="'+hit+'" height="'+hit+'" fill="transparent"/>':'')+serviceGlyph(s.type)+'</g>';});
  return body;
 }
 function handle(attrs,p,axis,name){var r=23/scale(),size=9/scale(),x=p[0]*8,y=p[1]*8;return '<g '+attrs+' role="button" tabindex="0" aria-label="'+esc(name)+'"><circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#fff" stroke="#2563eb" stroke-width="'+2/scale()+'"/><path d="'+(axis==='x'?'M'+(x-size)+' '+y+'h'+size*2+'m-'+size*1.5+' -'+size*.5+'l-'+size*.5+' '+size*.5+' '+size*.5+' '+size*.5+'m'+size+' 0l'+size*.5+' -'+size*.5+' -'+size*.5+' -'+size*.5:'M'+x+' '+(y-size)+'v'+size*2+'m-'+size*.5+' -'+size*1.5+'l'+size*.5+' -'+size*.5+' '+size*.5+' '+size*.5+'m0 '+size+'l-'+size*.5+' '+size*.5+' -'+size*.5+' -'+size*.5)+'" stroke="#2563eb" stroke-width="'+2/scale()+'" fill="none" pointer-events="none"/></g>';}
 function paint(){
  svg.setAttribute('viewBox',[view.x,view.y,view.w,view.h].join(' '));
  var f=splitDraft&&splitDraft.result.floor||previewFloor||floor();scene.innerHTML=drawing(f,true,state.front);
  paintRadiatorLift(f);
  if(splitDraft){var result=splitDraft.result;result.walls.forEach(function(w){scene.insertAdjacentHTML('beforeend','<line x1="'+w.a[0]*8+'" y1="'+w.a[1]*8+'" x2="'+w.b[0]*8+'" y2="'+w.b[1]*8+'" stroke="'+(result.error?'#bd3434':'#2563eb')+'" stroke-width="5" pointer-events="none"/>');});result.handles.forEach(function(h){scene.insertAdjacentHTML('beforeend',handle('data-split-handle="'+h.id+'"',h.point,h.axis,'Move '+h.id+' divider handle'));});}
  else if(tool==='adjust')f.walls.forEach(function(w,i){scene.insertAdjacentHTML('beforeend',handle('data-move-wall="'+esc(w.id)+'"',[(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2],w.a[0]===w.b[0]?'x':'y','Move internal wall '+(i+1)));});
  if(tool==='outline'&&!draft){var r=23/scale();scene.insertAdjacentHTML('beforeend',f.outline.map(function(p,i){return '<g data-layout-corner="'+i+'" role="button" tabindex="0" aria-label="Reshape floor corner '+(i+1)+'"><circle cx="'+p[0]*8+'" cy="'+p[1]*8+'" r="'+r+'" fill="#fff" stroke="#2563eb" stroke-width="'+2/scale()+'"/><circle cx="'+p[0]*8+'" cy="'+p[1]*8+'" r="'+4/scale()+'" fill="#2563eb" pointer-events="none"/></g>';}).join(''));}
  if(draft){
   scene.insertAdjacentHTML('beforeend','<polyline points="'+draft.map(function(p){return p[0]*8+','+p[1]*8;}).join(' ')+'" fill="none" stroke="#2563eb" stroke-width="3" pointer-events="none"/>');
   draft.forEach(function(p,i){scene.insertAdjacentHTML('beforeend','<g data-draft-point="'+i+'" '+(i===0&&draft.length>=3?'role="button" tabindex="0" aria-label="Close custom outline"':'role="img" aria-label="Outside corner '+(i+1)+'"')+'><circle cx="'+p[0]*8+'" cy="'+p[1]*8+'" r="'+23/scale()+'" fill="transparent" pointer-events="all"/><circle cx="'+p[0]*8+'" cy="'+p[1]*8+'" r="'+6/scale()+'" fill="'+(i===0?'#fff':'#2563eb')+'" stroke="#2563eb" stroke-width="'+2/scale()+'" pointer-events="none"/></g>');});
   // The guide interpolates only validated numeric draft coordinates, never labels or imported HTML.
   var pending=start&&(start.end[0]!==start.a[0]||start.end[1]!==start.a[1]),guide=pending?draft.concat([start.end]):draft,end=guide[guide.length-1],first=guide[0];if(guide.length>=4&&(end[0]===first[0]||end[1]===first[1])){try{M.closeOutline(guide);scene.insertAdjacentHTML('beforeend','<g data-custom-snap="alignment" pointer-events="none"><line x1="'+end[0]*8+'" y1="'+end[1]*8+'" x2="'+first[0]*8+'" y2="'+first[1]*8+'" stroke="#16803d" stroke-width="'+2/scale()+'" stroke-dasharray="6 4"/><circle cx="'+first[0]*8+'" cy="'+first[1]*8+'" r="'+10/scale()+'" fill="none" stroke="#16803d" stroke-width="'+2/scale()+'"/></g>');}catch(error){}}
  }
  if(start)scene.insertAdjacentHTML('beforeend','<line x1="'+start.a[0]*8+'" y1="'+start.a[1]*8+'" x2="'+start.end[0]*8+'" y2="'+start.end[1]*8+'" stroke="#2563eb" stroke-width="4" stroke-dasharray="6 3" pointer-events="none"/>');
 }
 function render(){
  floorId=floor().id;var f=floor(),s=chosen(),select=$('layoutFloor');select.replaceChildren();state.floors.forEach(function(f){option(select,f.id,f.name);});select.value=floorId;select.disabled=!!draft||!!splitDraft;
  $('layoutCanvasTitle').textContent=f.name;$('layoutEmpty').hidden=!!f.outline.length||!!draft;
  $('layoutSplit').disabled=!s;$('layoutName').disabled=!s;$('layoutAdjust').disabled=!f.walls.length;$('layoutAdjust').setAttribute('aria-pressed',String(tool==='adjust'));
  var placing=tool==='radiator'||tool==='service';
  $('layoutUndo').disabled=placing||!!splitDraft||(draft?!draft.length:!history.length);$('layoutMore').disabled=placing||!!splitDraft||!!draft;
  $('layoutFloor').disabled=$('layoutFloor').disabled||placing;$('layoutAddRadiator').disabled=!f.outline.length||!!draft||!!splitDraft||!['select','adjust'].includes(tool);$('layoutAddService').disabled=$('layoutAddRadiator').disabled;$('layoutDone').textContent=placing?'Cancel placement':'Done';
  $('layoutNormalActions').hidden=!!splitDraft||!!draft||!['select','adjust'].includes(tool);
  $('layoutSplitActions').hidden=!splitDraft;$('layoutDrawingActions').hidden=!draft;$('layoutToolActions').hidden=!!draft||!!splitDraft||['select','adjust'].includes(tool);
  $('layoutFinishCustom').disabled=!draft||draft.length<3;
  $('layoutFlip').hidden=!splitDraft||splitDraft.result.options.kind!=='L';$('layoutSplitApply').disabled=!splitDraft||!!splitDraft.result.error;
  var cornerRoom=splitDraft&&splitDraft.result.options.kind==='corner';$('layoutSplitApply').textContent=cornerRoom?'Add corner room':'Apply split';$('layoutRotate').textContent=cornerRoom?'Corner':'Rotate';$('layoutRotate').setAttribute('aria-label',cornerRoom?'Change room corner':'Rotate divider');
  $('layoutDrawingHelp').textContent=splitDraft?(cornerRoom?'Drag width and depth handles. Corner switches position.':'Drag the blue handles, then Apply split.'):draft?'Tap corners or drag from the last dot. Green guides snap the ends into line.':({radiator:'Aim above your finger. Release to place.',service:'Tap the drawing to place the symbol. Visual position only.',select:'Tap a space to name it. Pinch to zoom.',adjust:'Drag a blue handle to move its wall. Pinch to zoom.',outline:'Drag the corners to reshape this floor.',wall:'Manual wall: tap its start and end, or drag.',erase:'Tap a wall to remove it. Room labels are protected.'}[tool]);paint();
 }
 function paintRadiatorLift(f){
  var g=gesture;if(!g||g.type!=='radiator'||!g.touch||!g.client)return;
  var r=previewFloor&&(f.radiators||[]).find(function(r){return r.id===g.id;});
  if(!r){var old=scene.querySelector('[data-plan-radiator="'+g.id+'"]');if(old&&g.moved)old.setAttribute('opacity','0');return;}
  var s=scale(),geom=R.geometry(spaces(f),r);
  // The ordinary marker IS the preview, at exactly the geometry that release saves.
  // Only the selection halo/contact are transient; never draw a second offset radiator.
  // SVG interpolation below is validated numeric geometry only, never survey text.
  scene.insertAdjacentHTML('beforeend','<g data-radiator-drag-overlay="true" pointer-events="none" aria-hidden="true"><circle data-radiator-drop-target="true" cx="'+r.point[0]*8+'" cy="'+r.point[1]*8+'" r="'+2/s+'" fill="#16803d"/><g data-radiator-lift="true" transform="translate('+geom.x*8+' '+geom.y*8+')"><circle r="'+18/s+'" fill="none" stroke="#16803d" stroke-width="'+1.5/s+'"/></g></g>');
 }
 function closeSheet(){if(sheet.open)sheet.close();}
 function openSheet(title,html){closeSheet();$('layoutSheetTitle').textContent=title;$('layoutSheetBody').innerHTML=html;sheet.showModal();}
 $('layoutSheetClose').onclick=closeSheet;
 function reload(){
  if(field.value===lastRaw)return;lastRaw=field.value;legacy=false;loadError=false;
  try{var value=cached();legacy=value.version===1;state=legacy?M.empty():M.decode(value);status(legacy?'Old room-box sketch retained. Back up before replacing it.':'');}catch(error){state=M.empty();loadError=true;status('Saved layout could not be read. Export a backup before replacing it.');}
  selected=null;placingRadiator=null;placingService=null;if(tool==='radiator'||tool==='service')tool='select';draft=null;start=null;splitDraft=null;previewFloor=null;gesture=null;history=[];analyses.clear();closeSheet();render();
 }
 function save(){
  var old=field.value,previous=loadError?'':old,savedHistory=history.slice(),cell=selected;
  if((loadError||legacy)&&!win.confirm('Replace the old sketch with whole-floor plans? Export a JSON backup first if you want to keep it. Survey measurements are unchanged.')){lastRaw=null;reload();return false;}
  try{var clean=M.decode(state),raw=JSON.stringify(clean);if(loadError)history=[];if(raw!==old){history.push(previous);if(history.length>20)history.shift();}state=clean;field.value=raw;lastRaw=raw;loadError=false;legacy=false;win.update();render();status('Plan updated · measurements unchanged');return true;}
  catch(error){lastRaw=null;reload();history=savedHistory;selected=cell;render();status(error.message);return false;}
 }
 function fit(){view={x:0,y:0,w:640,h:480};paint();}
 function create(points){floor().outline=points;floor().walls=[];floor().labels=[];if(floor().radiators!==undefined)floor().radiators=[];if(floor().services!==undefined)floor().services=[];placingService=null;draft=null;start=null;tool='select';selected=M.spaces(floor())[0].anchor;closeSheet();fit();save();}
 function shape(value){if(floor().outline.length&&!win.confirm('Replace this floor drawing, its sketch labels, radiator markers and service symbols? Survey measurements are unchanged.'))return;closeSheet();if(value==='custom'){draft=[];start=null;tool='select';render();}else create(M.outline(value));}
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
 $('layoutDone').onclick=function(){tool='select';start=null;previewFloor=null;placingRadiator=null;placingService=null;gesture=null;render();};
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
 function finish(points){points=Array.isArray(points)?points:draft;if(!points||points.length<3)return;try{create(M.closeOutline(points));}catch(error){status(error.message);}}
 $('layoutFinishCustom').onclick=finish;$('layoutCancelCustom').onclick=function(){draft=null;start=null;render();};
 function radiatorOptions(id){
  var r=(floor().radiators||[]).find(function(r){return r.id===id;});if(!r)return;openSheet('Radiator position','<p>Visual position only. This does not change radiator size, quantity or heat-loss calculations.</p><div class="plan-sheet-actions"><button type="button" id="layoutRepositionRadiator">Reposition radiator</button><button type="button" id="layoutRemoveRadiator">Remove radiator marker</button></div>');
  $('layoutRepositionRadiator').onclick=function(){closeSheet();placingRadiator=id;tool='radiator';status('');render();svg.focus({preventScroll:true});};
  $('layoutRemoveRadiator').onclick=function(){floor().radiators=floor().radiators.filter(function(r){return r.id!==id;});if(save()){closeSheet();svg.focus({preventScroll:true});}};
 }
 function radiatorId(){var i=1,used=new Set((floor().radiators||[]).map(function(r){return r.id;}));while(used.has('r'+i))i++;return 'r'+i;}
 function serviceId(){var i=1,used=new Set((floor().services||[]).map(function(s){return s.id;}));while(used.has('s'+i))i++;return 's'+i;}
 $('layoutAddService').onclick=function(){
  openSheet('Add service symbol','<p>Choose a symbol, then tap its position. External meters can sit outside the floor outline.</p><div class="plan-sheet-actions">'+M.serviceTypes.map(function(t){return '<button type="button" data-add-service="'+t.type+'">'+esc(t.label)+'</button>';}).join('')+'</div>');
  sheet.querySelectorAll('[data-add-service]').forEach(function(b){b.onclick=function(){placingService={id:serviceId(),type:b.dataset.addService};tool='service';closeSheet();status('Place '+serviceInfo(placingService.type).label.toLowerCase()+'.');render();svg.focus({preventScroll:true});};});
 };
 function updateService(p,g){
  if(p.some(function(n){return !Number.isFinite(n);})||p[0]<0||p[0]>80||p[1]<0||p[1]>60){previewFloor=null;status('Drop inside the drawing. Position unchanged.');paint();return;}
  var next=clone(g.base),marker={id:g.id,type:g.serviceType,point:p.map(function(n){return Math.round(n*2)/2;})},exists=false;
  next.services=(next.services||[]).map(function(s){if(s.id!==g.id)return s;exists=true;return marker;});if(!exists)next.services.push(marker);previewFloor=next;paint();
 }
 function moveService(e,g){
  var client={x:e.clientX,y:e.clientY-(g.touch&&g.existing&&!g.tapMove?72:0)},box=svg.getBoundingClientRect();
  if(client.x<box.left||client.x>box.right||client.y<box.top||client.y>box.bottom){previewFloor=null;status('Drop inside the drawing. Position unchanged.');paint();return;}
  var q=new win.DOMPoint(client.x,client.y).matrixTransform(svg.getScreenCTM().inverse()),p=[q.x/8,q.y/8];
  if(!g.touch&&g.offset)p=[p[0]+g.offset[0],p[1]+g.offset[1]];updateService(p,g);
 }
 function serviceOptions(id){
  var s=(floor().services||[]).find(function(s){return s.id===id;});if(!s)return;
  openSheet(serviceInfo(s.type).label+' position','<p>Visual position only. Survey measurements and heat-loss calculations are unchanged.</p><div class="plan-sheet-actions"><button type="button" id="layoutRepositionService">Reposition symbol</button><button type="button" id="layoutRemoveService">Remove symbol</button></div>');
  $('layoutRepositionService').onclick=function(){placingService={id:s.id,type:s.type};tool='service';closeSheet();render();svg.focus({preventScroll:true});};
  $('layoutRemoveService').onclick=function(){floor().services=floor().services.filter(function(s){return s.id!==id;});if(save()){closeSheet();svg.focus({preventScroll:true});}};
 }
 function updateRadiator(p,g){
  try{var snapped=R.snap(spaces(g.base),p,{cell:g.room});if(snapped.distance*8*scale()>48)throw Error('Move closer to a wall to snap the radiator.');var next=clone(g.base),r={id:g.id,cell:snapped.cell,edge:snapped.edge,point:snapped.point};next.radiators=(next.radiators||[]).filter(function(r){return r.id!==g.id;}).concat([r]);previewFloor=next;status('Radiator position only · sizing unchanged');}
  catch(error){previewFloor=null;status(error.message);}paint();
 }
 function moveRadiator(e,g){
  g.client={x:e.clientX,y:e.clientY};
  var client={x:e.clientX,y:e.clientY-(g.touch?72:0)},box=svg.getBoundingClientRect();
  // Captured fingers may extend below the canvas to reach its bottom wall. Validate
  // the visible aiming position instead, never clamp an outside drop onto a wall.
  if(client.x<box.left||client.x>box.right||client.y<box.top||client.y>box.bottom){previewFloor=null;status('Drop inside the drawing. Placement unchanged.');paint();return;}
  var q=new win.DOMPoint(client.x,client.y).matrixTransform(svg.getScreenCTM().inverse()),p=g.touch?[q.x/8,q.y/8]:point(e);
  updateRadiator(g.touch?p:[p[0]+g.offset[0],p[1]+g.offset[1]],g);
 }
 function beginRadiator(e,id,palette){
  trackPointer(e);var base=clone(floor()),r=(base.radiators||[]).find(function(r){return r.id===id;}),p=point(e);tool='radiator';gesture={type:'radiator',base:base,id:id||radiatorId(),existing:!!r,palette:!!palette,moved:false,x:e.clientX,y:e.clientY,touch:e.pointerType==='touch',client:{x:e.clientX,y:e.clientY},offset:r?[r.point[0]-p[0],r.point[1]-p[1]]:[0,0]};svg.setPointerCapture(e.pointerId);render();if(r&&gesture.touch)moveRadiator(e,gesture);
 }
 $('layoutAddRadiator').addEventListener('pointerdown',function(e){if(e.button!==0||this.disabled)return;e.preventDefault();beginRadiator(e,null,true);});
 $('layoutAddRadiator').onclick=function(e){if(e.detail===0){var s=chosen()||spaces(floor())[0],id=radiatorId(),r=R.snap(spaces(floor()),[s.anchor%80+.5,Math.floor(s.anchor/80)+.5],{cell:s.anchor});updateRadiator(r.point,{id:id,base:clone(floor()),room:s.anchor});if(previewFloor){replaceFloor(previewFloor);previewFloor=null;save();var el=svg.querySelector('[data-plan-radiator="'+id+'"]');if(el)el.focus({preventScroll:true});}}};
 function point(e){var p=new win.DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return [Math.max(0,Math.min(80,Math.round(p.x/8))),Math.max(0,Math.min(60,Math.round(p.y/8)))];}
 function near(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])*8*scale()<=23;}
 function aligned(a,b){return Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1])?[b[0],a[1]]:[a[0],b[1]];}
 function snapCustom(anchor,p,points){
  var q=aligned(anchor,p),axis=q[1]===anchor[1]?0:1;if(points.length<3)return q;
  var first=points[0],candidate=q.slice();candidate[axis]=first[axis];
  if(Math.abs(q[axis]-first[axis])*8*scale()<=24&&(candidate[0]!==anchor[0]||candidate[1]!==anchor[1])){try{M.closeOutline(points.concat([candidate]));return candidate;}catch(error){}}
  return q;
 }
 function addWall(a,b){b=aligned(a,b);start=null;if(a[0]===b[0]&&a[1]===b[1]){render();return;}var i=1;while(floor().walls.some(function(w){return w.id==='w'+i;}))i++;floor().walls.push({id:'w'+i,a:a,b:b});save();}
 function zoom(factor,client){var before=svg.getScreenCTM(),p=new win.DOMPoint(client?client.x:svg.getBoundingClientRect().x+svg.clientWidth/2,client?client.y:svg.getBoundingClientRect().y+svg.clientHeight/2).matrixTransform(before.inverse()),w=Math.max(160,Math.min(960,view.w/factor)),ratio=w/view.w;view={x:p.x-(p.x-view.x)*ratio,y:p.y-(p.y-view.y)*ratio,w:w,h:w*.75};paint();}
 $('layoutZoomIn').onclick=function(){zoom(1.4);};$('layoutZoomOut').onclick=function(){zoom(1/1.4);};$('layoutFit').onclick=fit;
 function pinchInfo(){var a=Array.from(pointers.values()),p=a[0],q=a[1];return {distance:Math.hypot(p.x-q.x,p.y-q.y),x:(p.x+q.x)/2,y:(p.y+q.y)/2};}
 function cancelPointers(){Array.from(pointers.keys()).forEach(function(id){release({pointerId:id},true);});}
 function trackPointer(e){if(e.isPrimary&&!pointers.has(e.pointerId))cancelPointers();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});}
 svg.addEventListener('pointerdown',function(e){
  if(e.button!==0)return;trackPointer(e);svg.setPointerCapture(e.pointerId);
  if(pointers.size===2){previewFloor=null;var resetMarker=gesture&&(gesture.type==='radiator'||gesture.type==='service');if(resetMarker){tool='select';placingRadiator=null;placingService=null;}if(gesture&&gesture.type==='custom'){draft=gesture.before;start=null;status('');}gesture={type:'pinch',info:pinchInfo()};if(resetMarker)render();else paint();return;}
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
   else if(!near(p,last)){if(draft.length>=31){status('Maximum 31 drawn corners before closing.');return;}p=snapCustom(last,p,draft);if(p[0]!==last[0]||p[1]!==last[1])draft.push(p);last=p;}
   gesture={type:'custom',before:before,anchor:last.slice(),offset:[last[0]-p[0],last[1]-p[1]]};start={a:last.slice(),end:last.slice()};status('');render();return;
  }
  var service=target.closest('[data-plan-service]'),armed=tool==='service'&&placingService;
  if(armed||(service&&['select','adjust'].includes(tool))){
   var s=armed?placingService:floor().services.find(function(s){return s.id===service.dataset.planService;});
   gesture={type:'service',id:s.id,serviceType:s.type,base:clone(floor()),existing:(floor().services||[]).some(function(a){return a.id===s.id;}),tapMove:!!armed,moved:false,x:e.clientX,y:e.clientY,touch:e.pointerType==='touch',offset:armed?[0,0]:[s.point[0]-p[0],s.point[1]-p[1]]};tool='service';render();if(armed)moveService(e,gesture);return;
  }
  var radiator=target.closest('[data-plan-radiator]');if(radiator&&['select','adjust'].includes(tool)){var nearest=(floor().radiators||[]).map(function(r){var g=R.geometry(spaces(floor()),r);return {id:r.id,distance:Math.hypot(g.x-p[0],g.y-p[1])};}).sort(function(a,b){return a.distance-b.distance;})[0];beginRadiator(e,nearest.id,false);return;}
  if(tool==='radiator'){gesture={type:'radiator',id:placingRadiator||radiatorId(),tapMove:true,base:clone(floor()),offset:[0,0],x:e.clientX,y:e.clientY,touch:e.pointerType==='touch',client:{x:e.clientX,y:e.clientY}};moveRadiator(e,gesture);return;}
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
  else if(g.type==='service'){if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>6)g.moved=true;if(g.moved||g.tapMove)moveService(e,g);}
  else if(g.type==='radiator'){if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>6)g.moved=true;moveRadiator(e,g);}
  else if(g.type==='custom-close'){g.moved=Math.hypot(e.clientX-g.x,e.clientY-g.y)>8;}
  else if(g.type==='custom'&&start){var q=[Math.max(0,Math.min(80,p[0]+g.offset[0])),Math.max(0,Math.min(60,p[1]+g.offset[1]))];start.end=snapCustom(g.anchor,q,draft);start.close=draft.length>=3&&near(q,draft[0])&&start.end[0]===draft[0][0]&&start.end[1]===draft[0][1];if(start.close){try{M.closeOutline(draft.concat([start.end]));}catch(error){start.close=false;}}status(start.close?'Release to connect to the first dot.':'');paint();}
  else if(g.type==='manual'&&start){start.end=aligned(start.a,p);g.moved=Math.hypot(e.clientX-g.x,e.clientY-g.y)>6;paint();}
  else if(g.type==='tap'){if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>8)g.panned=true;if(g.panned){var s=scale();view.x=g.view.x-(e.clientX-g.x)/s;view.y=g.view.y-(e.clientY-g.y)/s;paint();}}
 });
 function release(e,cancelled){
  pointers.delete(e.pointerId);if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);var g=gesture;
  if(g&&g.type==='pinch'&&pointers.size){var p=Array.from(pointers.values())[0];gesture={type:'tap',space:null,erase:null,x:p.x,y:p.y,view:{...view},panned:true};return;}
  gesture=null;if(!g)return;
  if(cancelled){previewFloor=null;if(g.type==='radiator'||g.type==='service'){tool='select';placingRadiator=null;placingService=null;}if(g.type==='custom'){draft=g.before;status('');}if(g.type==='manual'||g.type==='custom')start=null;render();return;}
  if(g.type==='service'){if(g.existing&&!g.moved&&!g.tapMove){previewFloor=null;tool='select';render();serviceOptions(g.id);}else if(previewFloor){replaceFloor(previewFloor);previewFloor=null;placingService=null;tool='select';save();}else{if(g.existing){tool='select';placingService=null;}render();}}
  else if(g.type==='radiator'){if(g.existing&&!g.moved&&!g.tapMove){previewFloor=null;tool='select';render();radiatorOptions(g.id);}else if(previewFloor){replaceFloor(previewFloor);previewFloor=null;placingRadiator=null;tool='select';save();}else{if(g.existing)tool='select';render();}}
  else if(g.type==='custom-close'){if(!g.moved)finish();}
  else if(g.type==='custom'&&start){var end=start.end,last=draft[draft.length-1],close=start.close;start=null;if(close){finish(draft.concat([end]));return;}if(end[0]!==last[0]||end[1]!==last[1]){if(draft.length<31)draft.push(end.slice());else status('Maximum 31 drawn corners before closing.');}render();}
  else if((g.type==='wall'||g.type==='corner')&&previewFloor){replaceFloor(previewFloor);previewFloor=null;save();}
  else if(g.type==='manual'&&g.moved&&start)addWall(start.a,start.end);
  else if(g.type==='tap'&&!g.panned&&!splitDraft){if(g.erase){floor().walls=floor().walls.filter(function(w){return w.id!==g.erase;});save();}else if(tool==='select'||tool==='adjust'){var s=spaces(floor()).find(function(s){return s.id===g.space;});selected=s?s.anchor:null;tool='select';render();if(s)nameSpace();}}
 }
 svg.addEventListener('pointerup',function(e){release(e,false);});svg.addEventListener('pointercancel',function(e){release(e,true);});
 // A lost capture can send the final event outside the SVG. Cancel that unfinished
 // gesture before it can remain registered as a phantom second finger.
 function outsideRelease(e){if(pointers.has(e.pointerId))release(e,true);}
 doc.addEventListener('pointerup',outsideRelease);doc.addEventListener('pointercancel',outsideRelease);
 svg.addEventListener('lostpointercapture',function(e){if(!svg.hasPointerCapture(e.pointerId))outsideRelease(e);});
 win.addEventListener('blur',cancelPointers);doc.addEventListener('visibilitychange',function(){if(doc.hidden)cancelPointers();});
 svg.addEventListener('keydown',function(e){
  var moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},target=e.target.closest('[data-space]'),h=e.target.closest('[data-split-handle]'),w=e.target.closest('[data-move-wall]'),corner=e.target.closest('[data-layout-corner]');
  var service=e.target.closest('[data-plan-service]');
  if(tool==='service'&&placingService&&(e.key==='Enter'||e.key===' ')){
   e.preventDefault();var id=placingService.id,s=chosen()||spaces(floor())[0],old=(floor().services||[]).find(function(a){return a.id===id;});
   updateService(old?old.point:[s.anchor%80+.5,Math.floor(s.anchor/80)+.5],{id:id,serviceType:placingService.type,base:clone(floor())});
   replaceFloor(previewFloor);previewFloor=null;placingService=null;tool='select';save();var el=svg.querySelector('[data-plan-service="'+id+'"]');if(el)el.focus({preventScroll:true});return;
  }
  if(service&&(e.key==='Enter'||e.key===' ')){e.preventDefault();serviceOptions(service.dataset.planService);return;}
  if(service&&moves[e.key]){
   e.preventDefault();var id=service.dataset.planService,s=floor().services.find(function(s){return s.id===id;}),d=moves[e.key];
   updateService([s.point[0]+d[0],s.point[1]+d[1]],{id:id,serviceType:s.type,base:clone(floor())});if(previewFloor){replaceFloor(previewFloor);previewFloor=null;save();}var el=svg.querySelector('[data-plan-service="'+id+'"]');if(el)el.focus({preventScroll:true});return;
  }
  var radiator=e.target.closest('[data-plan-radiator]');if(radiator&&(e.key==='Enter'||e.key===' ')){e.preventDefault();radiatorOptions(radiator.dataset.planRadiator);return;}
  if(radiator&&moves[e.key]){e.preventDefault();var id=radiator.dataset.planRadiator,r=floor().radiators.find(function(r){return r.id===id;}),d=moves[e.key];updateRadiator([r.point[0]+d[0],r.point[1]+d[1]],{id:id,base:clone(floor()),room:r.cell});if(previewFloor){replaceFloor(previewFloor);previewFloor=null;save();}var el=svg.querySelector('[data-plan-radiator="'+id+'"]');if(el)el.focus({preventScroll:true});return;}
  if(draft&&draft.length>=3&&e.target.closest('[data-draft-point="0"]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();finish();return;}
  if(e.key==='Escape'){placingRadiator=null;placingService=null;splitDraft=null;previewFloor=null;gesture=null;start=null;draft=null;tool='select';render();return;}
  if(target&&(e.key==='Enter'||e.key===' ')){var s=spaces(floor()).find(function(s){return s.id===Number(target.dataset.space);});selected=s.anchor;render();nameSpace();e.preventDefault();}
  if(moves[e.key]&&(h||w||corner)){var d=moves[e.key],focus;
   try{if(h&&splitDraft){var id=h.dataset.splitHandle,handle=splitDraft.result.handles.find(function(a){return a.id===id;}),o={...splitDraft.result.options};o[id]=Math.max(handle.min,Math.min(handle.max,o[id]+d[handle.axis==='x'?0:1]));changeSplit(o);focus=svg.querySelector('[data-split-handle="'+id+'"]');}
    else if(w){var id=w.dataset.moveWall,wall=floor().walls.find(function(a){return a.id===id;}),axis=wall.a[0]===wall.b[0]?0:1;replaceFloor(M.moveWall(floor(),id,wall.a[axis]+d[axis]));save();focus=svg.querySelector('[data-move-wall="'+id+'"]');}
    else{var i=Number(corner.dataset.layoutCorner),p=floor().outline[i];floor().outline=G.vertex(floor().outline,i,[p[0]+d[0],p[1]+d[1]]);save();focus=svg.querySelector('[data-layout-corner="'+i+'"]');}if(focus)focus.focus({preventScroll:true});
   }catch(error){status(error.message);}e.preventDefault();
  }
 });
 $('layoutBack').onclick=function(){closeSheet();var tab=$(exitTab)||$('frontTab');if(tab)tab.click();win.requestAnimationFrame(function(){win.scrollTo(0,returnScroll);});};
 doc.querySelectorAll('.tab').forEach(function(tab){tab.addEventListener('click',function(){var entering=tab.id==='layoutTab';if(entering)returnScroll=win.scrollY;else exitTab=tab.id;doc.body.classList.toggle('house-layout-mode',entering);var skip=doc.querySelector('.skip-link');if(skip){skip.setAttribute('href',entering?'#houseLayoutCanvas':'#preview');skip.textContent=entering?'Skip to floor plan':'Skip to document preview';}if(entering){doc.body.classList.remove('hl-rads-focus-mode');reload();render();win.scrollTo(0,0);}else{closeSheet();if(tool==='radiator'||tool==='service')tool='select';placingRadiator=null;placingService=null;splitDraft=null;previewFloor=null;gesture=null;pointers.clear();}});});
 var frame=0;win.addEventListener('resize',function(){if(!frame&&doc.body.classList.contains('house-layout-mode'))frame=win.requestAnimationFrame(function(){frame=0;paint();});});
 var oldSet=win.setData;win.setData=function(data){var raw=data&&Object.prototype.hasOwnProperty.call(data,'house_layout')?data.house_layout:'';if(typeof raw!=='string')throw new Error('Invalid layout in this survey.');M.decode(raw);var old=field.value;field.value=raw;lastRaw=null;try{var value=oldSet.apply(this,arguments);reload();return value;}catch(error){field.value=old;lastRaw=null;reload();throw error;}};
 var oldUpdate=win.update;win.update=function(){reload();return oldUpdate.apply(this,arguments);};
 // PDF popups copy inline styles, not linked stylesheets.
 var printStyle=doc.createElement('style');printStyle.id='houseLayoutPrintStyles';printStyle.textContent=`
 .sheet-wrap.layout-sheet-wrap{background:#fff;color:#172b3a;box-sizing:border-box;max-width:760px;width:100%;margin:12px auto;padding:16px;aspect-ratio:210/297}
 .layout-floor-pair{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
 .layout-floor-figure{margin:0;min-width:0;text-align:center;break-inside:avoid}
 .layout-floor-figure h3{margin:0 0 8px;font:700 16px Arial,sans-serif;overflow-wrap:anywhere}
 .layout-floor-figure>svg{display:block;width:100%;max-width:640px;height:auto;margin:0 auto}
 .layout-sheet-wrap>p{font:12px Arial,sans-serif;color:#253b52}
 @page property-layout{size:A4 portrait;margin:10mm}
 @media print{
  .sheet-wrap.layout-sheet-wrap{page:property-layout!important;width:190mm!important;max-width:190mm!important;height:auto!important;min-height:0!important;aspect-ratio:auto!important;padding:0!important;margin:0!important;break-inside:avoid;page-break-inside:avoid}
  .layout-sheet-wrap>.sheet-title{margin:0 0 2mm!important;font:700 14pt/1 Arial,sans-serif!important}
  .layout-sheet-wrap>p{margin:0 0 3mm!important;font:8.5pt/1.2 Arial,sans-serif!important}
  .layout-floor-pair{grid-template-rows:repeat(2,126mm);gap:4mm}
  .layout-floor-figure{height:126mm;max-height:126mm}
  .layout-floor-figure h3{margin:0 0 1mm!important;font:700 11pt/1 Arial,sans-serif!important}
  .layout-floor-figure>svg{width:160mm!important;max-width:100%!important;height:120mm!important;margin:0 auto!important}
 }
 `;doc.head.appendChild(printStyle);
 function image(f,front){
  var hasServices=(f.services||[]).length>0,key=hasServices?'<g data-service-key="true" role="group" aria-label="Layout symbol key"><rect x="8" y="484" width="624" height="32" rx="5" fill="#f1f5f8"/><text x="16" y="504" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#253b52">Key</text>'+M.serviceTypes.map(function(t,i){var x=64+i*142;return '<g transform="translate('+x+' 501) scale(.55)">'+serviceGlyph(t.type)+'</g><text x="'+(x+14)+'" y="505" font-family="Arial,sans-serif" font-size="12" fill="#253b52">'+esc(t.label)+'</text>';}).join('')+'</g>':'';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 '+(hasServices?520:480)+'" width="640" height="'+(hasServices?520:480)+'" role="img" aria-label="'+esc(f.name)+' floor plan">'+drawing(f,false,front)+'<text x="16" y="20" font-family="Arial,sans-serif" font-size="12" fill="#253b52">'+esc(f.name)+'</text><text x="16" y="470" font-family="Arial,sans-serif" font-size="10" fill="#253b52">Not to scale</text>'+((f.radiators||[]).length?'<text x="624" y="470" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="#8c291a">Radiator symbols: visual positions only</text>':'')+key+'</svg>';
 }
 async function saveImage(){if(draft||!floor().outline.length)return;var f=M.decode(state).floors.find(function(f){return f.id===floorId;}),front=state.front,button=this,url;button.disabled=true;try{url=win.URL.createObjectURL(new win.Blob([image(f,front)],{type:'image/svg+xml;charset=utf-8'}));var img=new win.Image();img.src=url;await img.decode();var c=doc.createElement('canvas');c.width=1280;c.height=(f.services||[]).length?1040:960;var ctx=c.getContext('2d');if(!ctx)throw Error('Image export unavailable.');ctx.drawImage(img,0,0,c.width,c.height);var blob=await new Promise(function(resolve){c.toBlob(resolve,'image/png');});if(!blob)throw Error('Image export failed.');var a=doc.createElement('a'),u=win.URL.createObjectURL(blob);a.href=u;a.download='layout-'+(f.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'floor')+'.png';doc.body.appendChild(a);a.click();a.remove();win.setTimeout(function(){win.URL.revokeObjectURL(u);},1000);status('Floor-plan image downloaded.');}catch(error){status('Could not save the image. '+error.message);}finally{if(url)win.URL.revokeObjectURL(url);button.disabled=!floor().outline.length||!!draft;}}
 // Floor text is escaped; each SVG contains only escaped labels and validated geometry.
 function insertLayouts(container){if(!container)return;container.querySelectorAll('.layout-sheet-wrap').forEach(function(el){el.remove();});var plan;try{plan=cached();}catch(error){return;}if(plan.version!==2||!plan.includeReport)return;var anchor=Array.from(container.children).find(function(n){var h=n.querySelector('h2');return h&&['A12a','Customer Profile'].includes(h.textContent.trim());}),floors=plan.floors.filter(function(f){return f.outline.length;});for(var i=0;i<floors.length;i+=2){var section=doc.createElement('section');section.className='sheet-wrap layout-sheet-wrap';section.innerHTML='<h2 class="sheet-title">Room layouts</h2><p>Whole-floor visual guides. Not to scale; not used for heat-loss calculations.</p><div class="layout-floor-pair">'+floors.slice(i,i+2).map(function(f){return '<figure class="layout-floor-figure" data-layout-floor="'+esc(f.id)+'"><h3>'+esc(f.name)+'</h3>'+image(f,plan.front)+'</figure>';}).join('')+'</div>';container.insertBefore(section,anchor||null);}}
 var oldRender=win.renderPreview;win.renderPreview=function(){var value=oldRender.apply(this,arguments);insertLayouts($('preview'));return value;};var oldPrint=win.buildPrintHtml;win.buildPrintHtml=function(title,titles){var html=oldPrint.apply(this,arguments);if(!Array.from(titles||[]).includes('Front')||!Array.from(titles||[]).includes('Rads'))return html;var parsed=new win.DOMParser().parseFromString(html,'text/html');insertLayouts(parsed.querySelector('main'));var layoutStyle=parsed.createElement('style');layoutStyle.textContent=printStyle.textContent;parsed.head.appendChild(layoutStyle);return '<!doctype html>\n'+parsed.documentElement.outerHTML;};
 reload();win.update();
})(window);
