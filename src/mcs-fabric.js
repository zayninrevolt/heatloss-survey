(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.McsFabricCalculations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // MCS online thermal-bridging reference; not a complete heat-load method.
  // https://heatloadcalculator.mcscertified.com/docs/reference-sources/thermal-bridging
  // Categories describe the U-value input route, not just the element location.
  function defaultBridgeFactor(propertyAgeBand, category) {
    if (!['external-default', 'internal-default', 'known-u'].includes(category)) {
      throw new RangeError('Unsupported thermal-bridge category');
    }
    if (!/^[A-M]$/.test(propertyAgeBand)) {
      throw new RangeError('A recognised main-property age band is required for default bridging');
    }
    if (category === 'external-default') {
      return 'ABCDEFGHI'.includes(propertyAgeBand) ? 0.15 : propertyAgeBand === 'J' ? 0.11 : 0.08;
    }
    return 'ABCDEFGHIJK'.includes(propertyAgeBand) ? 0.10 : 0.05;
  }

  function finiteNumber(value, name, minimum) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
      throw new RangeError(name + ' must be a finite number' +
        (minimum === 0 ? ' greater than or equal to zero' : ''));
    }
    return value;
  }

  function calculateElement(input) {
    var grossArea = finiteNumber(input.grossArea, 'Gross area', 0);
    var uValue = finiteNumber(input.uValue, 'U-value', 0);
    var indoor = finiteNumber(input.indoorTemperature, 'Indoor temperature', -Infinity);
    var boundary = finiteNumber(input.boundaryTemperature, 'Boundary temperature', -Infinity);
    if (!Array.isArray(input.openingAreas)) throw new TypeError('Opening areas must be an array');
    var openingArea = input.openingAreas.reduce(function (sum, area) {
      return sum + finiteNumber(area, 'Opening area', 0);
    }, 0);
    if (openingArea > grossArea) throw new RangeError('Opening areas exceed gross element area');
    var netArea = grossArea - openingArea;
    var hasExplicitBridge = Object.prototype.hasOwnProperty.call(input, 'bridgeFactor');
    if (hasExplicitBridge && input.bridgeCategory !== 'known-u') {
      throw new RangeError('An explicit bridge factor requires the known-u category');
    }
    var bridgeFactor = hasExplicitBridge
      ? finiteNumber(input.bridgeFactor, 'Bridge factor', 0)
      : defaultBridgeFactor(input.propertyAgeBand, input.bridgeCategory);
    var deltaT = indoor - boundary;
    var baseWatts = netArea * uValue * deltaT;
    var bridgeWatts = netArea * bridgeFactor * deltaT;
    return {
      methodId: 'mcs-reference-fabric-v1',
      netArea: netArea,
      deltaT: deltaT,
      bridgeFactor: bridgeFactor,
      bridgeSource: hasExplicitBridge ? 'explicit' : 'age-default',
      effectiveU: uValue + bridgeFactor,
      baseWatts: baseWatts,
      bridgeWatts: bridgeWatts,
      totalWatts: baseWatts + bridgeWatts
    };
  }

  return { defaultBridgeFactor: defaultBridgeFactor, calculateElement: calculateElement };
});
