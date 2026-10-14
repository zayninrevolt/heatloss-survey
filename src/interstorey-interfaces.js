/* Explicit shared interfaces for the experimental reference calculation only.
 * CIBSE DHDG 2026 Table 2-45: https://heatloss.elmhurstenergy.co.uk/docs/reference-sources/u-values
 * A physical interface is recorded once. Its measured area, construction and heat
 * flow direction yield the SAME effective U on both sides with opposite signs.
 */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.InterStoreyInterfaces=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 var CONSTRUCTIONS={'Uninsulated':{up:1.73,down:1.41},'100mm insulation':{up:0.32,down:0.31}};
 function resolve(input){
  if(!input||!Array.isArray(input.rooms)||!Array.isArray(input.interfaces)||input.interfaces.length>100)throw new RangeError('A room list and at most 100 shared interfaces are required');
  if(!Number.isInteger(input.storeys)||input.storeys<1)throw new RangeError('Recorded storeys are required');
  var byRoom=Object.create(null),roomMap=Object.create(null),edges=Object.create(null),pairs=Object.create(null);
  input.rooms.forEach(function(r){
   if(!r||!r.id||roomMap[r.id]||!Number.isFinite(r.indoor)||!Number.isFinite(r.floorArea)||r.floorArea<=0)throw new RangeError('Unique rooms with valid temperatures and measured areas are required');
   roomMap[r.id]=r;edges[r.id]=[];byRoom[r.id]={elements:[],floorCoveredArea:0,ceilingCoveredArea:0,floorRemainderArea:r.floorArea,ceilingRemainderArea:r.floorArea};
  });
  input.interfaces.forEach(function(link){
   var lower=link&&roomMap[link.lowerRoom],upper=link&&roomMap[link.upperRoom];
   if(!lower||!upper||lower===upper)throw new RangeError('Select different existing rooms above and below the interface');
   if(lower.loftType!=='Heated room above'||upper.floorType!=='Heated room below')throw new RangeError('The linked rooms must record a complementary heated floor and ceiling');
   if(!Object.prototype.hasOwnProperty.call(CONSTRUCTIONS,link.construction))throw new RangeError('Record the intermediate-floor insulation; unknown construction cannot be calculated');
   if(!Number.isFinite(link.area)||link.area<=0||link.area>lower.floorArea||link.area>upper.floorArea)throw new RangeError('Measured shared area must be positive and fit both rooms');
   var pair=link.lowerRoom+'|'+link.upperRoom;if(pairs[pair])throw new RangeError('Record each shared interface only once');pairs[pair]=true;
   edges[lower.id].push(upper.id);
  });
  var visiting=Object.create(null),depths=Object.create(null);
  function depth(id){if(visiting[id])throw new RangeError('Inter-storey links contain a cycle');if(depths[id])return depths[id];visiting[id]=true;var d=1;edges[id].forEach(function(next){d=Math.max(d,1+depth(next));});visiting[id]=false;depths[id]=d;return d;}
  input.rooms.forEach(function(r){if(depth(r.id)>input.storeys)throw new RangeError('Inter-storey link depth exceeds the recorded storeys');});
  var resolved=input.interfaces.map(function(link,index){
   var lower=input.rooms.find(function(r){return r.id===link.lowerRoom;}),upper=input.rooms.find(function(r){return r.id===link.upperRoom;});
   var construction=CONSTRUCTIONS[link.construction],u=lower.indoor>=upper.indoor?construction.up:construction.down;
   function add(room,other,name){return {name:name+'-'+index,grossArea:link.area,openingAreas:[],uValue:u,indoorTemperature:room.indoor,boundaryTemperature:other.indoor,propertyAgeBand:input.propertyAgeBand,bridgeCategory:'internal-default',heatedTransfer:true};}
   byRoom[lower.id].elements.push(add(lower,upper,'intermediate-ceiling'));byRoom[upper.id].elements.push(add(upper,lower,'intermediate-floor'));
   byRoom[lower.id].ceilingCoveredArea+=link.area;byRoom[upper.id].floorCoveredArea+=link.area;
   return Object.assign({},link,{uValue:u,lowerTemperature:lower.indoor,upperTemperature:upper.indoor});
  });
  input.rooms.forEach(function(r){
   var out=byRoom[r.id];
   if(out.floorCoveredArea>r.floorArea+1e-9||out.ceilingCoveredArea>r.floorArea+1e-9)throw new RangeError(r.roomName+': combined shared areas exceed the room area');
   if((r.floorType==='Heated room below'&&!out.floorCoveredArea)||(r.loftType==='Heated room above'&&!out.ceilingCoveredArea))throw new RangeError(r.roomName+': record the shared interface area, insulation and adjoining room');
   out.floorRemainderArea=Math.max(0,r.floorArea-out.floorCoveredArea);out.ceilingRemainderArea=Math.max(0,r.floorArea-out.ceilingCoveredArea);
  });
  return {methodId:'explicit-interstorey-v1',byRoom:byRoom,interfaces:resolved};
 }
 return {resolve:resolve,constructions:CONSTRUCTIONS};
});
