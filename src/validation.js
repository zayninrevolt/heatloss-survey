(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SurveyValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function outside(value, minimum, maximum) {
    value = Number(value);
    return Number.isFinite(value) && (value < minimum || value > maximum);
  }

  function validateRoom(input) {
    input = input || {};
    var warnings = [];
    if (input.started) {
      if (outside(input.length, 0.5, 30)) warnings.push('Room length is outside the expected 0.5–30 m range');
      if (outside(input.width, 0.5, 30)) warnings.push('Room width is outside the expected 0.5–30 m range');
      if (outside(input.height, 1.8, 6)) warnings.push('Ceiling height is outside the expected 1.8–6 m range');
    }
    if (outside(input.indoor, 5, 30)) warnings.push('Indoor design temperature is outside the expected 5–30°C range');
    if (outside(input.outdoor, -30, 20)) warnings.push('Outdoor design temperature is outside the expected −30–20°C range');
    if (Number(input.outdoor) >= Number(input.indoor)) {
      warnings.push('Outdoor design temperature should be lower than the room temperature');
    }
    if (outside(input.ground, -5, 25)) warnings.push('Ground temperature is outside the expected −5–25°C range');
    (input.uValues || []).forEach(function (entry) {
      if (entry.value > 0 && outside(entry.value, 0.05, 5)) {
        warnings.push(entry.label + ' U-value is outside the expected 0.05–5 W/m²K range');
      }
    });
    if (input.manualAch !== null && input.manualAch !== undefined &&
        outside(input.manualAch, 0, 5)) {
      warnings.push('Manual air-change rate is outside the expected 0–5 ACH range');
    }
    (input.radiatorOutputsKw || []).forEach(function (value) {
      if (Number(value) > 0 && outside(value, 0.05, 20)) {
        warnings.push('Existing radiator output is outside the expected 0.05–20 kW range');
      }
    });
    return warnings;
  }

  return { validateRoom: validateRoom };
});
