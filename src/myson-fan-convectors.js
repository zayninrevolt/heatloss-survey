/* Normal fan speed, 340 litre/hour water flow.
 * Myson Complete Heating Solutions, February 2025, pp.149 and 155:
 * https://www.myson.co.uk/media/23hlaofg/fan-convectors.pdf
 * Only published delta-T30/50 outputs are used. Between them the app interpolates
 * linearly. Outside them it refuses to invent a temperature exponent or assume
 * that the water-temperature fan-start sensor will operate. The 1.06 in Myson's
 * table is a water-FLOW correction at 455 l/h, not a temperature exponent.
 */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.MysonFanConvectors=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var models=[
    {type:'Myson Kickspace',height:101,width:496,wattsAtDt30:566,wattsAtDt50:896,size:'Myson Kickspace 500'},
    {type:'Myson Kickspace',height:101,width:550,wattsAtDt30:729,wattsAtDt50:1278,size:'Myson Kickspace 600'},
    {type:'Myson Kickspace',height:101,width:603,wattsAtDt30:1077,wattsAtDt50:1707,size:'Myson Kickspace 800'},
    {type:'Myson Hi-Line RC',height:277,width:554,wattsAtDt30:541,wattsAtDt50:930,size:'Myson Hi-Line RC 7-4'},
    {type:'Myson Hi-Line RC',height:277,width:682,wattsAtDt30:937,wattsAtDt50:1610,size:'Myson Hi-Line RC 10-6'},
    {type:'Myson Hi-Line RC',height:277,width:887,wattsAtDt30:1431,wattsAtDt50:2459,size:'Myson Hi-Line RC 15-10'},
    {type:'Myson Hi-Line RC',height:277,width:1171,wattsAtDt30:2018,wattsAtDt50:3468,size:'Myson Hi-Line RC 20-14'},
    {type:'Myson Hi-Line LV',height:277,width:554,wattsAtDt30:541,wattsAtDt50:930,bathroomOnly:true,size:'Myson Hi-Line LV 7-4'}
  ];
  function output(size,deltaT){
    var model=models.find(function(row){return row.size===size;});
    var temperature=Number(deltaT);
    if(!model || !Number.isFinite(temperature) || temperature<30 || temperature>50) return null;
    return model.wattsAtDt30+(model.wattsAtDt50-model.wattsAtDt30)*(temperature-30)/20;
  }
  return {models:models,output:output};
});
