(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HeatLossCalculations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function nonNegative(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function estimatedWallLength(length, width, wallCount) {
    length = nonNegative(length);
    width = nonNegative(width);
    wallCount = Math.max(0, Math.round(nonNegative(wallCount)));
    var shorter = Math.min(length, width);
    var longer = Math.max(length, width);
    if (wallCount === 1) return shorter;
    if (wallCount === 2) return length + width;
    if (wallCount === 3) return length + width + longer;
    if (wallCount >= 4) return 2 * (length + width);
    return 0;
  }

  function remainingInternalWallLength(length, width, exposedWallLength) {
    var perimeter = 2 * (nonNegative(length) + nonNegative(width));
    exposedWallLength = nonNegative(exposedWallLength);
    if (perimeter <= 0 || exposedWallLength <= 0) return 0;
    return Math.max(0, perimeter - Math.min(perimeter, exposedWallLength));
  }

  function floorTemperatureDifference(floorType, indoor, outdoor, ground,
    adjacentTemperature) {
    floorType = String(floorType || '').toLowerCase();
    indoor = Number(indoor) || 0;
    outdoor = Number(outdoor) || 0;
    ground = Number(ground) || 0;
    if (floorType.includes('solid ground')) return Math.max(0, indoor - ground);
    if (floorType.includes('suspended timber ground') ||
        floorType.includes('exposed floor')) {
      return Math.max(0, indoor - outdoor);
    }
    if (floorType.includes('cellar') || floorType.includes('garage') ||
        floorType.includes('partially heated')) {
      if (adjacentTemperature !== '' &&
          Number.isFinite(Number(adjacentTemperature))) {
        return Math.max(0, indoor - Number(adjacentTemperature));
      }
      return Math.max(0, indoor - outdoor) * 0.5;
    }
    return 0;
  }

  function altitudeAdjustedTemperature(baseTemperature, propertyAltitude,
    stationAltitude) {
    baseTemperature = Number(baseTemperature);
    propertyAltitude = Number(propertyAltitude);
    stationAltitude = Number(stationAltitude) || 0;
    if (!Number.isFinite(baseTemperature) || !Number.isFinite(propertyAltitude)) {
      return null;
    }
    var steps = Math.max(0, Math.floor((propertyAltitude - stationAltitude) / 100));
    return {
      steps: steps,
      correction: steps * 0.6,
      temperature: baseTemperature - steps * 0.6
    };
  }

  function ventilationFlow(input) {
    input = input || {};
    var volume = nonNegative(input.volume);
    var baseAch = nonNegative(input.ach);
    var recoveryEfficiency = Math.min(100, nonNegative(input.recoveryEfficiency));
    var recoveryFactor = input.heatRecovery ? 1 - recoveryEfficiency / 100 : 1;
    return baseAch * volume * recoveryFactor +
      nonNegative(input.deviceFlowM3h) + nonNegative(input.pivFlowM3h);
  }

  function computeHeatLossValues(input) {
    input = input || {};
    var deltaT = nonNegative(input.deltaT);
    var internalDeltaT = nonNegative(input.internalDeltaT);
    var floorArea = nonNegative(input.floorArea);
    var volume = nonNegative(input.volume);
    var wallWatts = nonNegative(input.netWallArea) * nonNegative(input.wallU) * deltaT;
    var internalWallWatts = nonNegative(input.internalWallArea) *
      nonNegative(input.internalWallU) * internalDeltaT;
    var windowWatts = nonNegative(input.windowArea) * nonNegative(input.windowU) * deltaT;
    var doorWatts = nonNegative(input.doorArea) * nonNegative(input.doorU) * deltaT;
    var floorDeltaT = input.floorDeltaT == null ? deltaT : nonNegative(input.floorDeltaT);
    var floorWatts = floorArea * nonNegative(input.floorU) * floorDeltaT;
    var roofWatts = floorArea * nonNegative(input.roofU) * deltaT;
    var ventilationFlowM3h = input.ventilationFlowM3h == null
      ? nonNegative(input.ach) * volume
      : nonNegative(input.ventilationFlowM3h);
    var ventilationWatts = 0.33 * ventilationFlowM3h * deltaT;
    var externalFabric = wallWatts + windowWatts + doorWatts + floorWatts + roofWatts;
    var bridgeWatts = input.bridgeFactorWm2K == null
      ? externalFabric * nonNegative(input.bridgePercent) / 100
      : nonNegative(input.bridgeArea) * nonNegative(input.bridgeFactorWm2K) * deltaT;
    var fabricWatts = externalFabric + internalWallWatts + bridgeWatts;
    return {
      wallWatts: wallWatts,
      internalWallWatts: internalWallWatts,
      windowWatts: windowWatts,
      doorWatts: doorWatts,
      floorWatts: floorWatts,
      roofWatts: roofWatts,
      ventilationFlowM3h: ventilationFlowM3h,
      ventilationWatts: ventilationWatts,
      bridgeWatts: bridgeWatts,
      fabricWatts: fabricWatts,
      totalWatts: fabricWatts + ventilationWatts
    };
  }

  return {
    altitudeAdjustedTemperature: altitudeAdjustedTemperature,
    computeHeatLossValues: computeHeatLossValues,
    estimatedWallLength: estimatedWallLength,
    floorTemperatureDifference: floorTemperatureDifference,
    remainingInternalWallLength: remainingInternalWallLength,
    ventilationFlow: ventilationFlow
  };
});
