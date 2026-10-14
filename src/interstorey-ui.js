/* UI for one canonical shared-interface list. No duplicated room-side inputs. */
(function(root){'use strict';
 var state=null;
 function read(){
  var field=document.getElementById('hl_interstorey_interfaces'),raw=field&&field.value,links;
  try{links=raw?JSON.parse(raw):[];}catch(e){throw Error('The saved shared-interface JSON is malformed; restore a valid interface record');}
  if(!Array.isArray(links)||links.length>100)throw Error('Shared interfaces must be a list of at most 100 records');
  links.forEach(function(link){if(!link||typeof link!=='object'||Array.isArray(link)||typeof link.upperRoom!=='string'||typeof link.lowerRoom!=='string'||typeof link.construction!=='string'||(link.area!==null&&typeof link.area!=='number'))throw Error('The saved shared-interface record is malformed; review the shared room, area and construction');});
  return links;
 }
 function install(options){state=options;if(document.body.dataset.ifWired)return;document.body.dataset.ifWired='yes';
  document.addEventListener('click',function(event){var add=event.target.closest('[data-if-add]'),remove=event.target.closest('[data-if-remove]');if(!add&&!remove)return;
   try{var links=read();if(add)links.push({upperRoom:add.dataset.ifAdd,lowerRoom:'',area:null,construction:''});else links.splice(Number(remove.dataset.ifRemove),1);write(links);}catch(e){showError(e);}
  });
  document.addEventListener('change',function(event){var field=event.target;if(!field.dataset.ifField)return;
   try{var links=read(),index=Number(field.closest('[data-if-row]').dataset.ifRow);if(!links[index])return;links[index][field.dataset.ifField]=field.dataset.ifField==='area'?(field.value.trim()===''?null:Number(field.value)):field.value;write(links);}catch(e){showError(e);}
  });
 }
 function showError(e){document.querySelectorAll('[data-if-host]').forEach(function(h){var p=h.querySelector('[data-if-error]');if(p)p.textContent=e.message;});}
 function write(links){document.getElementById('hl_interstorey_interfaces').value=JSON.stringify(links);state.update();}
 function refresh(){if(!state)return;var links;try{links=read();}catch(e){showError(e);return;}
  var rooms=(window.heatLossResultsV60&&window.heatLossResultsV60.rooms)||[],esc=state.escapeHtml;
  function label(key){var r=rooms.find(function(r){return r.key===key;});return r?r.roomName:String(key||'Select room');}
  document.querySelectorAll('[data-if-host]').forEach(function(host){
   var key=host.dataset.ifHost,room=rooms.find(function(r){return r.key===key;}),below=state.stringValue('hl_'+key+'_floor_type')==='Heated room below',above=state.stringValue('hl_'+key+'_loft_type')==='Heated room above';
   host.hidden=!below&&!above;
   var snapshot=JSON.stringify([links,rooms.map(function(r){return [r.key,r.roomName,r.indoor,r.floorArea];}),below,above]);
   if(host.dataset.ifSnapshot!==snapshot){
    var html='<p class="hl-help">Reference check only. Record each shared floor once in its upper room. The adjoining ceiling reads this same area and construction.</p><p data-if-error role="status"></p>';
    if(below){html+='<div data-if-upper="'+esc(key)+'">';links.forEach(function(link,index){if(link.upperRoom!==key)return;var prefix='if_'+key+'_'+index;
     html+='<div data-if-row="'+index+'" class="hl-fields-grid"><div class="field"><label for="'+prefix+'_lower">Room below</label><select id="'+prefix+'_lower" data-if-field="lowerRoom"><option value="">Select the actual adjoining room</option>';
     rooms.filter(function(r){return r.key!==key;}).forEach(function(r){html+='<option value="'+esc(r.key)+'"'+(link.lowerRoom===r.key?' selected':'')+'>'+esc(r.roomName)+'</option>';});
     html+='</select></div><div class="field"><label for="'+prefix+'_area">Measured shared area (m²)</label><input id="'+prefix+'_area" data-if-field="area" type="number" min="0" step="any" inputmode="decimal" value="'+esc(link.area==null?'':String(link.area))+'"></div><div class="field"><label for="'+prefix+'_construction">Intermediate-floor construction</label><select id="'+prefix+'_construction" data-if-field="construction">';
     [['','Select / unknown'],['Uninsulated','Uninsulated'],['100mm insulation','100 mm insulation']].forEach(function(item){html+='<option value="'+esc(item[0])+'"'+(item[0]===link.construction?' selected':'')+'>'+item[1]+'</option>';});
     html+='</select><small>CIBSE DHDG 2026 Table 2-45; do not assume insulation.</small></div><button type="button" data-if-remove="'+index+'">Remove shared interface</button></div>';
    });html+='</div><button type="button" data-if-add="'+esc(key)+'">Add room below</button>';}
    if(above){var incoming=links.filter(function(link){return link.lowerRoom===key;});html+='<p><b>Shared ceiling, read-only:</b> '+(incoming.length?incoming.map(function(link){return esc(label(link.upperRoom))+'; '+esc(link.area==null?'area not recorded':Number(link.area).toFixed(2)+' m²')+'; '+esc(link.construction||'construction not recorded')+' (edit in upper room)';}).join('<br>'):'No interface recorded. Add this room below its actual upper neighbour.')+'</p>';}
    // Every dynamic room name, identifier, area and construction above passes
    // through escapeHtml; only app-authored markup reaches innerHTML.
    host.innerHTML=html;host.dataset.ifSnapshot=snapshot;
   }
   var floorSum=0,ceilingSum=0;links.forEach(function(link){if(link.upperRoom===key)floorSum+=Number(link.area)||0;if(link.lowerRoom===key)ceilingSum+=Number(link.area)||0;});
   ['floor','roof'].forEach(function(side){var f=document.getElementById('hl_'+key+'_interstorey_'+side+'_remainder');if(!f)return;var area=room?room.floorArea:0;var remainder=area-(side==='floor'?floorSum:ceilingSum);f.closest('.field').hidden=!(side==='floor'?below:above)||!(remainder>1e-9);var help=f.closest('.field').querySelector('small');if(help)help.textContent='Unshared area: '+Math.max(0,remainder).toFixed(2)+' m². Record its exposed construction; it must not disappear from the building loss.';});
  });
 }
 root.InterStoreyUI={install:install,refresh:refresh,read:read};
})(typeof globalThis!=='undefined'?globalThis:this);
