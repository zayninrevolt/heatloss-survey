/* Simple standards-informed heat-pump design review, phase 1.
 *
 * Scope: the ONE part of the published BS EN 12831-1:2017 ventilation model we could
 * verify from an accessible source, plus honest reporting of what is NOT implemented.
 * Sources (see references/mcs-reference-method.md):
 *   - exposure coefficient table (zone height bands x shielding x exposed facades):
 *     BS EN 12831 Table B.8, transcribed from
 *     https://www.h2xengineering.com/blogs/bs-en-12831-1-2017-heat-loss-calculation-standard/
 *   - room-vs-zone diversity, room minimum and the maximum-of rule, and the
 *     standard's own statement that the class of zone volume flow coefficient is
 *     order 0,05 to 0,1 m3/h per m3/h: BS EN 12831, as reproduced in
 *     https://reposit.haw-hamburg.de/bitstream/20.500.12738/14214/1/Bachelorarbeit_Karolina%20Brack_Final_geschw%C3%A4rzt.pdf
 *   - q50 default 12 m3/(h.m2), 0.5 ACH room minimum, mechanical rates, device
 *     rates: https://heatloadcalculator.mcscertified.com/docs/reference-sources/ventilation-rates
 *
 * This module deliberately does NOT produce a compliance claim and never silently
 * substitutes an invented coefficient: an unverified exposure class throws.
 *
 * What is still missing to complete the ventilation model, and why it is not guessed
 * here: the zone-level infiltration flow qv,env,z (the q50-to-ambient conversion for a
 * whole zone) and the Table B.9 room leakage coefficient. Only the equation structure
 * is published; the coefficient values and the q50-to-ambient reduction are not, so
 * this module resolves and reports the Table B.8 exposure factor but does not feed it
 * into a fabricated flow.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DesignReview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var METHOD_ID = 'design-review-v1';
  var PERMEABILITY_TO_AMBIENT_DIVISOR = 20;
  var DEFAULT_PERMEABILITY_50 = 12;
  var MINIMUM_ROOM_ACH = 0.5;

  // Table B.8. Bands are upper-inclusive; the first column applies to a
  // single-exposed-facade zone and ignores shielding entirely.
  var EXPOSURE_TABLE = [
    { maxHeight: 5, oneFacade: 0.03, intensive: 0.03, normal: 0.05, none: 0.07 },
    { maxHeight: 10, oneFacade: 0.05, intensive: 0.05, normal: 0.05, none: 0.07 },
    { maxHeight: 20, oneFacade: 0.08, intensive: 0.08, normal: 0.08, none: 0.08 },
    { maxHeight: Infinity, oneFacade: 0.11, intensive: 0.11, normal: 0.11, none: 0.11 }
  ];
  var HIGH_ZONE_FACTOR = 0.09;
  var HIGH_ZONE_BASE_HEIGHT = 50;

  function positiveNumber(value, name) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new RangeError(name + ' must be a positive number');
    }
    return number;
  }

  function nonNegativeNumber(value, name) {
    var number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new RangeError(name + ' must be zero or a positive number');
    }
    return number;
  }

  // NOTE: `shielding` here is BS EN 12831 Table B.8 *shielding*, not the three
  // relative shelter levels (intensive/normal/none) that src/mcs-ventilation.js
  // applies to the whole-building flow. They share words, so keep them apart.
  function exposureCoefficient(input) {
    input = input || {};
    var zoneHeight = positiveNumber(input.zoneHeight, 'Ventilation-zone height');
    var exposedFacades = Math.round(positiveNumber(input.exposedFacades,
      'Number of exposed facades'));
    // Table B.8 is published for a single exposed facade or for a zone with more
    // than one; 2 or 3 exposed sides use the "more than one" column.
    var singleFacade = exposedFacades === 1;
    var baseHeight = nonNegativeNumber(input.baseHeight, 'Ventilation-zone base height');
    var shielding = String(input.shielding || 'normal').toLowerCase();
    if (!['intensive', 'normal', 'none'].includes(shielding)) {
      throw new RangeError('A recognised shielding class is required');
    }
    if (!singleFacade && baseHeight > HIGH_ZONE_BASE_HEIGHT && zoneHeight <= 20) {
      return HIGH_ZONE_FACTOR;
    }
    var band = EXPOSURE_TABLE.find(function (entry) { return zoneHeight <= entry.maxHeight; });
    return singleFacade ? band.oneFacade : band[shielding];
  }

  function governingFlow(input) {
    input = input || {};
    var roomVolume = positiveNumber(input.roomVolume, 'Room volume');
    var hasExternalEnvelope = input.hasExternalEnvelope !== false;
    var minimumFlowM3h = hasExternalEnvelope ? MINIMUM_ROOM_ACH * roomVolume : 0;
    var roomLeakageM3h = nonNegativeNumber(input.roomLeakageM3h, 'Room leakage flow');
    var deviceFlowM3h = input.deviceFlowM3h == null
      ? 0 : nonNegativeNumber(input.deviceFlowM3h, 'Device flow');
    // BS EN 12831 sums the governing flow and this room's share of the zone
    // infiltration pressure flow in the same maximum expression.
    var governing = Math.max(roomLeakageM3h, minimumFlowM3h);
    return {
      methodId: METHOD_ID,
      minimumFlowM3h: minimumFlowM3h,
      governingFlowM3h: governing,
      deviceFlowM3h: deviceFlowM3h,
      // The 0.34 W.h/(m3.K) coefficient is the standard's own rho x cp.
      designWattsPerKelvin: 0.34 * (governing + deviceFlowM3h),
      minimumGoverned: minimumFlowM3h > roomLeakageM3h
    };
  }

  function exposedFacadesForAttachment(attachment) {
    var value = String(attachment || '').toLowerCase();
    if (!value) throw new RangeError('A dwelling attachment is required to count exposed facades');
    if (value.indexOf('enclosed mid') === 0 || value.indexOf('enclosed mid-terrace flat') === 0) return 1;
    if (value.indexOf('enclosed') === 0) return 2;
    if (value.indexOf('mid terrace') === 0 || value.indexOf('mid-terrace') === 0) return 2;
    if (value.indexOf('end terrace') === 0 || value.indexOf('end-terrace') === 0) return 3;
    if (value.indexOf('semi') === 0) return 3;
    if (value.indexOf('detached') === 0) return 4;
    throw new RangeError('Unrecognised dwelling attachment');
  }

  function shieldingKey(selectValue) {
    var value = String(selectValue || '').toLowerCase();
    if (value.indexOf('intensive') >= 0) return 'intensive';
    if (value.indexOf('no shielding') >= 0 || value.indexOf('none') >= 0) return 'none';
    if (value.indexOf('normal') >= 0) return 'normal';
    throw new RangeError('A recognised shielding class is required');
  }

  function zoneImbalance(input) {
    input = input || {};
    var exposedFacades = Math.round(positiveNumber(input.exposedFacades,
      'Number of exposed facades'));
    return exposedFacades > 1 ? 2 : 1;
  }

  return {
    methodId: METHOD_ID,
    permeabilityToAmbientDivisor: PERMEABILITY_TO_AMBIENT_DIVISOR,
    defaultPermeability50: DEFAULT_PERMEABILITY_50,
    exposureCoefficient: exposureCoefficient,
    exposedFacadesForAttachment: exposedFacadesForAttachment,
    shieldingKey: shieldingKey,
    zoneImbalance: zoneImbalance,
    governingFlow: governingFlow
  };
});
