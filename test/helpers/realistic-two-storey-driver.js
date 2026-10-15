'use strict';
const {prepare,setFields}=require('./reference-natural-driver');
// Synthetic rectangular rooms. Hall/stair footprint and landing are recorded per
// storey, not a claim to model an open stairwell void or arbitrary 3D geometry.
const roles=[
 {name:'Lounge',length:5,width:4,external:9,temp:21,ach:1.5,wall:'Cavity wall, insulated',wallU:0.55,window:'Double or triple glazed window, 2002 to 2021',windowU:2,windowArea:2.4,floor:'Suspended timber ground floor, 100mm insulation',floorU:0.3,floorAir:true,roof:'Heated room above',roofU:0,adjacent:18},
 {name:'Kitchen',length:4,width:3,external:7,temp:18,ach:2,wall:'Brick, open cavity, 100mm aerated block + 13mm plaster',wallU:0.87,window:'Double or triple glazed window, 2022+',windowU:1.4,windowArea:1.8,floor:'Uninsulated solid ground floor, DHDG example',floorU:0.85,roof:'Heated room above',roofU:0,adjacent:21},
 {name:'Hallway',length:3,width:2,external:5,temp:18,ach:2,wall:'Cavity wall, insulated',wallU:0.55,window:'No windows',windowU:0,windowArea:0,doorArea:1.8,floor:'Insulated solid ground floor',floorU:0.25,roof:'Heated room above',roofU:0,adjacent:21},
 {name:'Bed 1',length:5,width:4,external:9,temp:18,ach:1,wall:'Cavity wall, insulated',wallU:0.55,window:'Double or triple glazed window, 2002 to 2021',windowU:2,windowArea:2.4,floor:'Heated room below',floorU:0,roof:'Plasterboard with 200mm insulation',roofU:0.21,adjacent:18},
 {name:'Bed 2',length:4,width:3,external:7,temp:18,ach:1,wall:'Solid wall with 100mm internal or external insulation',wallU:0.32,window:'Double or triple glazed window, 2022+',windowU:1.4,windowArea:1.8,floor:'Heated room below',floorU:0,roof:'Plasterboard with 100mm insulation',roofU:0.4,adjacent:18},
 {name:'Bath',length:2,width:2,external:2,temp:22,ach:3,wall:'Cavity wall, insulated',wallU:0.55,window:'Double or triple glazed window, 2002 to 2021',windowU:2,windowArea:0.6,floor:'Heated room below',floorU:0,roof:'Plasterboard with 200mm insulation',roofU:0.21,adjacent:18},
 {name:'Landing',length:2,width:1,external:0,temp:18,ach:2,wall:'Cavity wall, insulated',wallU:0.55,window:'No windows',windowU:0,windowArea:0,floor:'Heated room below',floorU:0,roof:'Plasterboard with 200mm insulation',roofU:0.21,adjacent:18}
];
async function realisticSurvey(page){
 await prepare(page);
 const keys=await page.evaluate(names=>Object.fromEntries(names.map(name=>[name,roomKeyFromName(name)])),roles.map(r=>r.name));
 await setFields(page,{site_address:'Synthetic two-storey release survey, not a real property',site_surveyor:'Release verification',r_job:'SYNTHETIC-RELEASE',hl_property_age_band:'I',hl_build_year:'1997',hl_outdoor_temp:'-3',hl_ground_temp:'10',r_ceiling:'2.4',hl_radiator_temperature:'45',hl_bridge_method:'Age-based',hl_ventilation_storeys:'2',hl_dwelling_attachment:'Semi-detached'});
 for(const role of roles){
  const k=keys[role.name];
  await setFields(page,{
   ['rad_'+k+'_len']:String(role.length),['rad_'+k+'_wid']:String(role.width),['rad_'+k+'_outside']:role.external?'2':'0',
   ['hl_'+k+'_indoor_temp']:String(role.temp),['hl_'+k+'_external_wall_length']:String(role.external),['hl_'+k+'_wall_type']:role.wall,
   ['hl_'+k+'_window_type']:role.window,['hl_'+k+'_window_count']:role.windowArea?'1':'0',
   ['hl_'+k+'_window_1_length']:role.windowArea?String(role.windowArea):'0',['hl_'+k+'_window_1_width']:role.windowArea?'1':'0',
   ['hl_'+k+'_door_type']:role.doorArea?'External door, age bands A to J':'No external door',['hl_'+k+'_door_count']:role.doorArea?'1':'0',
   ['hl_'+k+'_door_1_length']:role.doorArea?'0.9':'0',['hl_'+k+'_door_1_width']:role.doorArea?'2':'0',
   ['hl_'+k+'_floor_type']:role.floor,['hl_'+k+'_loft_type']:role.roof,['hl_'+k+'_rooflight_type']:'No rooflights',['hl_'+k+'_rooflight_area']:'0',
   ['hl_'+k+'_ventilation_mode']:'Automatic',['hl_'+k+'_ventilation_device']:'No additional vent or flue',
   ['hl_'+k+'_internal_wall_type']:'Heated room, stud and plasterboard',['hl_'+k+'_internal_wall_count']:'1',
   ['hl_'+k+'_internal_segment_1_length']:String(2*(role.length+role.width)-role.external),['hl_'+k+'_internal_segment_1_adjacent_temp']:String(role.adjacent),
   ['hl_'+k+'_internal_door_count']:'1',
   ['rad_'+k+'_outcome']:'Assess existing radiator',['rad_'+k+'_ex_size']:'600(h) x 1000(w) K2'
  });
 }
 const links=[['Bed 1','Lounge',20],['Bed 2','Kitchen',12],['Bath','Hallway',4],['Landing','Hallway',2]].map(([u,l,area])=>({upperRoom:keys[u],lowerRoom:keys[l],area,construction:'100mm insulation'}));
 await setFields(page,{hl_interstorey_interfaces:JSON.stringify(links)});
 return {roles:roles.map(r=>({...r,key:keys[r.name]})),links};
}
module.exports={realisticSurvey};
