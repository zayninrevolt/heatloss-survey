(function(win){
 'use strict';
 var doc=win.document,M=win.FloorPlanModel,G=win.HouseLayoutModel,field=doc.getElementById('house_layout');
 if(!field||!M||doc.getElementById('houseLayoutCanvas'))return;
 var state=M.empty(),floorId='ground',selected=null,lastRaw=null,loadError=false,legacy=false,history=[],tool='select',draft=null,start=null,drag=null,analyses=new Map(),readRaw=null,readValue=null;
 var host=doc.getElementById('layoutForm');
 // Static UI only; survey text is assigned via textContent or escaped SVG.
 host.innerHTML='<div class="card house-layout-controls"><h2>Floor plan</h2><p>One joined-up drawing per floor. Visual only; measurements stay unchanged.</p>'+
 '<div class="field"><label for="layoutFloor">Floor</label><select id="layoutFloor"></select></div><button type="button" id="layoutAddFloor">Add floor</button>'+
 '<fieldset><legend>1. Whole-floor outline</legend><div class="field"><label for="layoutShape">Floor outline</label><select id="layoutShape"><option value="Rectangle">Rectangle</option><option value="L">L-shaped floor</option><option value="custom">Custom outline</option></select></div><button type="button" id="layoutCreateOutline">Create floor outline</button></fieldset>'+
 '<fieldset><legend>2. Divide into rooms</legend><div class="layout-edit-actions"><button type="button" data-plan-tool="select">Select space</button><button type="button" data-plan-tool="wall">Draw internal wall</button><button type="button" data-plan-tool="erase">Remove wall</button><button type="button" data-plan-tool="outline">Edit floor outline</button></div><p id="layoutToolHelp">Select a space inside the floor.</p></fieldset>'+
 '<fieldset><legend>3. Label the selected space</legend><p id="layoutSelection">No space selected</p><div class="field"><label for="layoutRoom">Room from survey</label><select id="layoutRoom"></select></div><button type="button" id="layoutAssign">Label selected space</button><button type="button" id="layoutRemove">Remove room label</button></fieldset>'+
 '<div id="layoutDraftActions" hidden><button type="button" id="layoutFinishCustom">Finish floor outline</button><button type="button" id="layoutCancelCustom">Cancel drawing</button></div><button type="button" id="layoutUndo">Undo sketch edit</button>'+
 '<div class="field"><label for="layoutFront">Front of property</label><select id="layoutFront"><option value="bottom">Bottom of drawing</option><option value="top">Top of drawing</option><option value="left">Left of drawing</option><option value="right">Right of drawing</option></select></div>'+
 '<label class="layout-report-option"><input type="checkbox" id="layoutInclude"> Include layout in report</label><button type="button" id="layoutSaveImage">Save layout image</button><p id="layoutStatus" role="status" aria-live="polite"></p></div>';
 var panel=doc.createElement('section');panel.id='houseLayoutCanvas';panel.setAttribute('role','main');panel.tabIndex=-1;panel.setAttribute('aria-labelledby','layoutCanvasTitle');
 panel.innerHTML='<h2 id="layoutCanvasTitle">Floor plan</h2><p id="layoutDrawingHelp">Not to scale. Draw one floor outline, add internal walls, then select and label each space.</p><svg id="houseLayoutSvg" viewBox="0 0 640 480" role="group" aria-label="Whole-floor plan drawing" aria-describedby="layoutDrawingHelp" tabindex="0"></svg>';
 doc.querySelector('.app').appendChild(panel);var svg=doc.getElementById('houseLayoutSvg');
 function $(id){return doc.getElementById(id);}function status(t){$('layoutStatus').textContent=t;}
 function esc(v){return String(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function names(){return new Map(win.allRoomNames().map(function(n){return [win.roomKeyFromName(n),n];}));}
 function floor(){return state.floors.find(function(f){return f.id===floorId;})||state.floors[0];}
 function spaces(f){var token=JSON.stringify(f),saved=analyses.get(f.id);if(!saved||saved.token!==token){saved={token:token,value:M.spaces(f)};analyses.set(f.id,saved);}return saved.value;}
 function chosen(){return spaces(floor()).find(function(s){return s.cells.includes(selected);});}
 function cached(){if(readRaw!==field.value){var value=M.decode(field.value);readRaw=field.value;readValue=value;}return readValue;}
 function option(el,value,text,disabled){var o=doc.createElement('option');o.value=value;o.textContent=text;o.disabled=!!disabled;el.appendChild(o);}
 function marker(front){var opposite={top:'bottom',bottom:'top',left:'right',right:'left'},positions={top:[320,18],bottom:[320,468],left:[14,240],right:[626,240]};return [['Front',front],['Back',opposite[front]]].map(function(item){var p=positions[item[1]],rotation=item[1]==='left'?-90:item[1]==='right'?90:0;return '<text x="'+p[0]+'" y="'+p[1]+'" transform="rotate('+rotation+' '+p.join(' ')+')" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="14" fill="#253b52">'+item[0]+'</text>';}).join('');}
 function labelText(label){return names().get(label.key)||label.label+' (not in survey)';}
 function drawing(f,editing,front){
  var colors=['#e3ecf6','#e2ede7','#f4ebd8','#f3e5ed','#eae5f5'],body='<rect width="640" height="480" fill="white"/>'+marker(front),font=editing?Math.max(16,Math.min(22,12*640/(svg.clientWidth||640))):16;
  spaces(f).forEach(function(s,i){var label=s.label?labelText(s.label):'',active=editing&&s.cells.includes(selected),a=s.anchor,x=(a%80+.5)*8,y=(Math.floor(a/80)+.5)*8;
   body+='<g'+(editing?' data-space="'+s.id+'" tabindex="0" role="button" aria-label="'+esc(label||'Unlabelled space '+(i+1))+'"':'')+'><path d="'+s.path+'" fill="'+(active?'#ffe3bd':label?colors[i%colors.length]:'#f4f6f8')+'"/>';
   if(label)body+='<text x="'+x+'" y="'+y+'" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="'+font+'" font-weight="700" fill="#243544" pointer-events="none">'+esc(label)+'</text>';
   body+='</g>';
  });
  f.walls.forEach(function(w){var attrs='x1="'+w.a[0]*8+'" y1="'+w.a[1]*8+'" x2="'+w.b[0]*8+'" y2="'+w.b[1]*8+'"';body+='<g'+(editing?' data-wall="'+esc(w.id)+'"':'')+'><line '+attrs+' stroke="#243544" stroke-width="4" pointer-events="none"/>'+(editing&&tool==='erase'?'<line '+attrs+' stroke="transparent" stroke-width="'+44*640/(svg.clientWidth||640)+'" pointer-events="stroke"/>':'')+'</g>';});
  if(f.outline.length)body+='<polygon data-floor-outline="true" points="'+f.outline.map(function(p){return p[0]*8+','+p[1]*8;}).join(' ')+'" fill="none" stroke="#243544" stroke-width="6" stroke-linejoin="round" pointer-events="none"/>';
  return body;
 }
 function paint(){
  // Geometry is validated and every text/attribute label is escaped before SVG insertion.
  svg.innerHTML=drawing(floor(),true,state.front);
  if(tool==='outline'&&!draft){var r=22*640/(svg.clientWidth||640);svg.insertAdjacentHTML('beforeend',floor().outline.map(function(p,i){return '<g data-layout-corner="'+i+'" role="button" tabindex="0" aria-label="Reshape floor corner '+(i+1)+'"><circle cx="'+p[0]*8+'" cy="'+p[1]*8+'" r="'+r+'" fill="transparent" pointer-events="all"/><circle cx="'+p[0]*8+'" cy="'+p[1]*8+'" r="7" fill="white" stroke="#2563eb" stroke-width="2" pointer-events="none"/></g>';}).join(''));}
  if(draft)svg.insertAdjacentHTML('beforeend','<polyline points="'+draft.map(function(p){return p[0]*8+','+p[1]*8;}).join(' ')+'" fill="#dbeafe" fill-opacity=".5" stroke="#2563eb" stroke-width="3" stroke-dasharray="6 3" pointer-events="none"/>');
  if(start&&start.end)svg.insertAdjacentHTML('beforeend','<line x1="'+start.a[0]*8+'" y1="'+start.a[1]*8+'" x2="'+start.end[0]*8+'" y2="'+start.end[1]*8+'" stroke="#dc7b20" stroke-width="4" stroke-dasharray="6 3" pointer-events="none"/>');
 }
 function render(){
  floorId=floor().id;var f=floor(),s=chosen(),select=$('layoutFloor');select.replaceChildren();state.floors.forEach(function(f){option(select,f.id,f.name);});select.value=floorId;select.disabled=!!draft;
  $('layoutAddFloor').disabled=!!draft||state.floors.length>=8;$('layoutCreateOutline').textContent=f.outline.length?'Replace floor outline':'Create floor outline';
  var room=$('layoutRoom'),previous=s&&s.label?s.label.key:room.value,used=new Set();state.floors.forEach(function(f){f.labels.forEach(function(l){if(!s||!s.label||l.key!==s.label.key)used.add(l.key);});});
  room.replaceChildren();names().forEach(function(n,k){option(room,k,n+(used.has(k)?' (already labelled)':''),used.has(k));});var available=Array.from(room.options).filter(function(o){return !o.disabled;});room.value=available.some(function(o){return o.value===previous;})?previous:available.length?available[0].value:'';
  $('layoutAssign').disabled=!s||!available.length||!!draft;$('layoutRemove').disabled=!s||!s.label||!!draft;
  $('layoutSelection').textContent=s?'Selected: '+(s.label?labelText(s.label):'unlabelled space'):'No space selected';
  $('layoutFront').value=state.front;$('layoutInclude').checked=state.includeReport;$('layoutSaveImage').disabled=!f.outline.length||!!draft;
  $('layoutUndo').disabled=draft?!draft.length:!history.length;$('layoutDraftActions').hidden=!draft;$('layoutFinishCustom').disabled=!draft||draft.length<3;
  $('layoutCanvasTitle').textContent=f.name+' plan';doc.querySelectorAll('[data-plan-tool]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.planTool===tool));b.disabled=!!draft||(!f.outline.length&&b.dataset.planTool!=='select');});
  $('layoutToolHelp').textContent=draft?'Tap the outside corners, then Finish floor outline.':{select:'Select a space inside the floor, then choose its survey room.',wall:'Tap or drag from one wall to another. Walls snap horizontally or vertically.',erase:'Tap an internal wall to remove it. Two labelled rooms cannot be merged.',outline:'Drag a round corner. Arrow keys reshape the focused corner.'}[tool];paint();
 }
 function reload(){
  if(field.value===lastRaw)return;lastRaw=field.value;legacy=false;loadError=false;
  try{var value=cached();legacy=value.version===1;state=legacy?M.empty():M.decode(value);status(legacy?'Old room-box sketch retained. Create a whole-floor outline to replace it.':'');}catch(error){state=M.empty();loadError=true;status('Saved layout could not be read. Export a backup before replacing it.');}
  selected=null;draft=null;start=null;drag=null;history=[];analyses.clear();render();
 }
 function save(){
  var old=field.value,previous=loadError?'':old,savedHistory=history.slice(),cell=selected;
  if((loadError||legacy)&&!win.confirm('Replace the old sketch with whole-floor plans? Export a JSON backup first if you want to keep it. Survey measurements are unchanged.')){lastRaw=null;reload();return false;}
  try{var clean=M.decode(state),raw=JSON.stringify(clean);if(loadError)history=[];if(raw!==old){history.push(previous);if(history.length>20)history.shift();}state=clean;field.value=raw;lastRaw=raw;loadError=false;legacy=false;win.update();render();status('Floor plan updated. Measurements unchanged.');return true;}
  catch(error){lastRaw=null;reload();history=savedHistory;selected=cell;render();status(error.message);return false;}
 }
 function create(points){floor().outline=points;floor().walls=[];floor().labels=[];selected=null;draft=null;start=null;tool='select';save();}
 $('layoutCreateOutline').addEventListener('click',function(){if(floor().outline.length&&!win.confirm('Replace this floor drawing and its sketch labels? Survey measurements are unchanged.'))return;if($('layoutShape').value==='custom'){draft=[];start=null;tool='select';render();}else create(M.outline($('layoutShape').value));});
 $('layoutFloor').addEventListener('change',function(e){floorId=e.target.value;selected=null;start=null;tool='select';render();});
 $('layoutAddFloor').addEventListener('click',function(){if(state.floors.length>=8||draft)return;var n=win.prompt('Name the new floor, for example Loft or Basement.','');if(n===null)return;n=n.trim();if(!n||n.length>40||state.floors.some(function(f){return f.name.toLowerCase()===n.toLowerCase();})){status('Choose a unique floor name, up to 40 characters.');return;}var i=state.floors.length+1;while(state.floors.some(function(f){return f.id==='floor'+i;}))i++;floorId='floor'+i;state.floors.push(M.blank(floorId,n));selected=null;save();});
 doc.querySelectorAll('[data-plan-tool]').forEach(function(b){b.addEventListener('click',function(){tool=b.dataset.planTool;start=null;render();});});
 $('layoutAssign').addEventListener('click',function(){var s=chosen(),key=$('layoutRoom').value;if(!s||!names().has(key))return;floor().labels=floor().labels.filter(function(l){return !s.cells.includes(l.cell);});floor().labels.push({key:key,label:names().get(key),cell:selected});save();});
 $('layoutRemove').addEventListener('click',function(){var s=chosen();if(!s)return;floor().labels=floor().labels.filter(function(l){return !s.cells.includes(l.cell);});save();});
 $('layoutFront').addEventListener('change',function(e){state.front=e.target.value;save();});$('layoutInclude').addEventListener('change',function(e){state.includeReport=e.target.checked;save();});
 $('layoutUndo').addEventListener('click',function(){if(draft){draft.pop();render();return;}if(!history.length)return;var raw=history.pop(),keep=history.slice();field.value=raw;lastRaw=null;reload();history=keep;win.update();render();status('Sketch edit undone. Measurements unchanged.');});
 function finish(){if(!draft||draft.length<3)return;var points=draft.map(function(p){return p.slice();}),first=points[0],last=points[points.length-1];if(first[0]!==last[0]&&first[1]!==last[1])points.push([last[0],first[1]]);try{var copy=M.decode(state);copy.floors.find(function(f){return f.id===floorId;}).outline=points;var test=copy.floors.find(function(f){return f.id===floorId;});test.walls=[];test.labels=[];M.decode(copy);create(points);}catch(error){status(error.message);}}
 $('layoutFinishCustom').addEventListener('click',finish);$('layoutCancelCustom').addEventListener('click',function(){draft=null;start=null;render();});
 function point(e){var p=new win.DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return [Math.max(0,Math.min(80,Math.round(p.x/8))),Math.max(0,Math.min(60,Math.round(p.y/8)))];}
 function aligned(a,b){return Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1])?[b[0],a[1]]:[a[0],b[1]];}
 function addWall(a,b){b=aligned(a,b);start=null;if(a[0]===b[0]&&a[1]===b[1]){render();return;}var i=1;while(floor().walls.some(function(w){return w.id==='w'+i;}))i++;floor().walls.push({id:'w'+i,a:a,b:b});save();}
 svg.addEventListener('pointerdown',function(e){if(e.button!==0)return;var p=point(e);e.preventDefault();
  if(draft){if(draft.length>=3&&p[0]===draft[0][0]&&p[1]===draft[0][1])finish();else if(draft.length<31){draft.push(draft.length?aligned(draft[draft.length-1],p):p);render();}else status('Maximum 32 outline corners.');return;}
  if(tool==='wall'){if(start){addWall(start.a,p);return;}start={a:p,end:p,moved:false};svg.setPointerCapture(e.pointerId);paint();return;}
  var handle=e.target.closest('[data-layout-corner]');if(tool==='outline'&&handle){drag={index:Number(handle.dataset.layoutCorner),points:floor().outline.map(function(p){return p.slice();})};svg.setPointerCapture(e.pointerId);return;}
  var wall=e.target.closest('[data-wall]');if(tool==='erase'){if(wall){floor().walls=floor().walls.filter(function(w){return w.id!==wall.dataset.wall;});save();}return;}
  var target=e.target.closest('[data-space]'),space=target?spaces(floor()).find(function(s){return s.id===Number(target.dataset.space);}):null;selected=space?space.anchor:null;render();svg.focus({preventScroll:true});
 });
 svg.addEventListener('pointermove',function(e){
  if(start){start.end=aligned(start.a,point(e));if(e.buttons===1&&(start.a[0]!==start.end[0]||start.a[1]!==start.end[1]))start.moved=true;paint();}
  if(drag){try{var points=G.vertex(drag.points,drag.index,point(e)),copy={...floor(),outline:points};M.spaces(copy);floor().outline=points;paint();}catch(error){status(error.message);}}
 });
 svg.addEventListener('pointerup',function(e){if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);if(drag){drag=null;save();}else if(start&&start.moved){addWall(start.a,start.end);}});
 svg.addEventListener('pointercancel',function(){if(drag)floor().outline=drag.points;drag=null;start=null;render();});
 svg.addEventListener('keydown',function(e){if(e.key==='Escape'){if(drag)floor().outline=drag.points;drag=null;start=null;draft=null;render();return;}var target=e.target.closest('[data-space]'),handle=e.target.closest('[data-layout-corner]'),moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(target&&(e.key==='Enter'||e.key===' ')){var s=spaces(floor()).find(function(s){return s.id===Number(target.dataset.space);});if(s){selected=s.anchor;render();svg.focus();}e.preventDefault();}
  if(handle&&moves[e.key]){var i=Number(handle.dataset.layoutCorner),d=moves[e.key],p=floor().outline[i];try{floor().outline=G.vertex(floor().outline,i,[p[0]+d[0],p[1]+d[1]]);save();var focus=svg.querySelector('[data-layout-corner="'+i+'"]');if(focus)focus.focus({preventScroll:true});}catch(error){status(error.message);}e.preventDefault();}
 });
 doc.querySelectorAll('.tab').forEach(function(tab){tab.addEventListener('click',function(){doc.body.classList.toggle('house-layout-mode',tab.id==='layoutTab');var skip=doc.querySelector('.skip-link');if(skip){skip.setAttribute('href',tab.id==='layoutTab'?'#houseLayoutCanvas':'#preview');skip.textContent=tab.id==='layoutTab'?'Skip to room layout':'Skip to document preview';}if(tab.id==='layoutTab'){doc.body.classList.remove('hl-rads-focus-mode');reload();render();}});});
 var frame=0;win.addEventListener('resize',function(){if(!frame&&doc.body.classList.contains('house-layout-mode'))frame=win.requestAnimationFrame(function(){frame=0;paint();});});
 var oldSet=win.setData;win.setData=function(data){var raw=data&&Object.prototype.hasOwnProperty.call(data,'house_layout')?data.house_layout:'';if(typeof raw!=='string')throw new Error('Invalid layout in this survey.');M.decode(raw);var old=field.value;field.value=raw;lastRaw=null;try{var value=oldSet.apply(this,arguments);reload();return value;}catch(error){field.value=old;lastRaw=null;reload();throw error;}};
 var oldUpdate=win.update;win.update=function(){reload();return oldUpdate.apply(this,arguments);};
 // PDF popups copy inline styles, not linked stylesheets.
 var printStyle=doc.createElement('style');printStyle.id='houseLayoutPrintStyles';printStyle.textContent='.layout-sheet-wrap{background:#fff;color:#172b3a}.layout-sheet-wrap>svg{display:block;width:100%;height:auto}.layout-sheet-wrap>p{font:12px Arial,sans-serif;color:#253b52}@media print{.layout-sheet-wrap{break-inside:avoid;page-break-inside:avoid}.layout-sheet-wrap>svg{display:block;width:220mm!important;height:165mm!important;margin:0 auto}.layout-sheet-wrap>h2{margin:0 0 3mm!important;font:700 14pt Arial,sans-serif!important}.layout-sheet-wrap>p{margin:0 0 3mm!important;font:9pt Arial,sans-serif!important}}';doc.head.appendChild(printStyle);
 function image(f,front){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480" role="img" aria-label="'+esc(f.name)+' floor plan">'+drawing(f,false,front)+'<text x="16" y="20" font-family="Arial,sans-serif" font-size="12" fill="#253b52">'+esc(f.name)+'</text><text x="16" y="470" font-family="Arial,sans-serif" font-size="10" fill="#253b52">Not to scale</text></svg>';}
 $('layoutSaveImage').addEventListener('click',async function(){if(draft||!floor().outline.length)return;var f=M.decode(state).floors.find(function(f){return f.id===floorId;}),front=state.front,button=this,url;button.disabled=true;try{url=win.URL.createObjectURL(new win.Blob([image(f,front)],{type:'image/svg+xml;charset=utf-8'}));var img=new win.Image();img.src=url;await img.decode();var c=doc.createElement('canvas');c.width=1280;c.height=960;var ctx=c.getContext('2d');if(!ctx)throw Error('Image export unavailable.');ctx.drawImage(img,0,0,c.width,c.height);var blob=await new Promise(function(resolve){c.toBlob(resolve,'image/png');});if(!blob)throw Error('Image export failed.');var a=doc.createElement('a'),u=win.URL.createObjectURL(blob);a.href=u;a.download='layout-'+(f.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'floor')+'.png';doc.body.appendChild(a);a.click();a.remove();win.setTimeout(function(){win.URL.revokeObjectURL(u);},1000);status('Floor-plan image downloaded.');}catch(error){status('Could not save the image. '+error.message);}finally{if(url)win.URL.revokeObjectURL(url);button.disabled=!floor().outline.length||!!draft;}});
 function insertLayouts(container){if(!container)return;container.querySelectorAll('.layout-sheet-wrap').forEach(function(el){el.remove();});var plan;try{plan=cached();}catch(error){return;}if(plan.version!==2||!plan.includeReport)return;var anchor=Array.from(container.children).find(function(n){var h=n.querySelector('h2');return h&&['A12a','Customer Profile'].includes(h.textContent.trim());});plan.floors.filter(function(f){return f.outline.length;}).forEach(function(f){var section=doc.createElement('section');section.className='sheet-wrap layout-sheet-wrap';/* Validated geometry and escaped labels only. */section.innerHTML='<h2 class="sheet-title">Room layout: '+esc(f.name)+'</h2><p>Whole-floor visual guide. Not to scale; not used for heat-loss calculations.</p>'+image(f,plan.front);container.insertBefore(section,anchor||null);});}
 var oldRender=win.renderPreview;win.renderPreview=function(){var value=oldRender.apply(this,arguments);insertLayouts($('preview'));return value;};var oldPrint=win.buildPrintHtml;win.buildPrintHtml=function(title,titles){var html=oldPrint.apply(this,arguments);if(!Array.from(titles||[]).includes('Front')||!Array.from(titles||[]).includes('Rads'))return html;var parsed=new win.DOMParser().parseFromString(html,'text/html');insertLayouts(parsed.querySelector('main'));return '<!doctype html>\n'+parsed.documentElement.outerHTML;};
 reload();win.update();
})(window);
