/* Reference natural-ventilation design comparison, not an equipment-sizing route.
 * Uses the separately benchmarked element and room/zone ventilation modules.
 * Limit: no mechanical ventilation, ATDs, combustion or inter-room air flows;
 * element boundaries and U-values must be explicit. Ground U-value derivation
 * and whole-method standards validation remain separate engineering tasks.
 */
(function (root, factory) {
  var api = typeof module === 'object' && module.exports
    ? factory(require('./mcs-fabric.js'), require('./mcs-ventilation.js'))
    : factory(root.McsFabricCalculations, root.McsVentilation);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReferenceNaturalDesign = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (fabric, ventilation) {
  'use strict';
  function calculate(input) {
    if (!input || !Array.isArray(input.rooms) || !input.rooms.length) {
      throw new RangeError('Complete reference rooms are required');
    }
    if (!fabric || !ventilation) throw new RangeError('Reference modules must be loaded first');
    var flow = ventilation.calculateNaturalZone(input);
    var rooms = input.rooms.map(function (room, index) {
      if (!Array.isArray(room.elements) || !room.elements.length) {
        throw new RangeError('Each reference room needs explicit fabric elements');
      }
      var names = {};
      var elements = room.elements.map(function (element) {
        if (!element.name || names[element.name]) throw new RangeError('Element names must be unique');
        names[element.name] = true;
        var result = fabric.calculateElement(element);
        return Object.assign({ name: element.name, heatedTransfer: element.heatedTransfer === true }, result);
      });
      var fabricWatts = elements.reduce(function (sum, element) { return sum + element.totalWatts; }, 0);
      var propertyFabricWatts = elements.reduce(function (sum, element) {
        return sum + (element.heatedTransfer ? 0 : element.totalWatts);
      }, 0);
      var roomFlow = flow.rooms[index];
      return {
        id: room.id, elements: elements, fabricWatts: fabricWatts,
        propertyFabricWatts: propertyFabricWatts, ventilation: roomFlow,
        roomDemandWatts: fabricWatts + roomFlow.roomVentilationWatts,
        buildingContributionWatts: propertyFabricWatts + roomFlow.zoneVentilationWatts
      };
    });
    return {
      methodId: 'reference-natural-design-v1',
      scope: 'Benchmarked natural ventilation and explicit per-element fabric; not complete MCS design validation',
      equipmentSizingEnabled: false,
      rooms: rooms, ventilation: flow,
      buildingWatts: rooms.reduce(function (sum, room) { return sum + room.buildingContributionWatts; }, 0),
      emitterDemandWatts: rooms.reduce(function (sum, room) { return sum + room.roomDemandWatts; }, 0)
    };
  }
  return { calculate: calculate };
});
