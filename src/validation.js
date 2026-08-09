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

  function finiteValue(value) {
    if (value === null || value === undefined ||
        (typeof value === 'string' && value.trim() === '')) return null;
    value = Number(value);
    return Number.isFinite(value) ? value : null;
  }

  function fieldId(label) {
    return String(label || 'value').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function validateRoomDetails(input) {
    input = input || {};
    var issues = [];

    function add(field, code, severity, message) {
      issues.push({ field: field, code: code, severity: severity, message: message });
    }

    function requiredRange(field, label, value, minimum, maximum, rangeMessage) {
      var number = finiteValue(value);
      if (number === null) {
        add(field, 'required', 'error', label + ' is required and must be a finite number');
      } else if (number < minimum || number > maximum) {
        add(field, 'range', 'error', rangeMessage);
      }
      return number;
    }

    var indoor = finiteValue(input.indoor);
    var outdoor = finiteValue(input.outdoor);

    if (input.started) {
      requiredRange('length', 'Room length', input.length, 0.5, 30,
        'Room length is outside the expected 0.5–30 m range');
      requiredRange('width', 'Room width', input.width, 0.5, 30,
        'Room width is outside the expected 0.5–30 m range');
      requiredRange('height', 'Ceiling height', input.height, 1.8, 6,
        'Ceiling height is outside the expected 1.8–6 m range');
      indoor = requiredRange('indoor', 'Indoor design temperature', input.indoor, 5, 30,
        'Indoor design temperature is outside the expected 5–30°C range');
      outdoor = requiredRange('outdoor', 'Outdoor design temperature', input.outdoor, -30, 20,
        'Outdoor design temperature is outside the expected −30–20°C range');
    } else {
      if (outside(input.indoor, 5, 30)) {
        add('indoor', 'range', 'warning',
          'Indoor design temperature is outside the expected 5–30°C range');
      }
      if (outside(input.outdoor, -30, 20)) {
        add('outdoor', 'range', 'warning',
          'Outdoor design temperature is outside the expected −30–20°C range');
      }
    }

    if (indoor !== null && outdoor !== null && outdoor >= indoor) {
      add('outdoor', 'temperature-order', input.started ? 'error' : 'warning',
        'Outdoor design temperature should be lower than the room temperature');
    }

    if (input.groundRequired) {
      requiredRange('ground', 'Ground temperature', input.ground, -5, 25,
        'Ground temperature is outside the expected −5–25°C range');
    } else if (outside(input.ground, -5, 25)) {
      add('ground', 'range', 'warning',
        'Ground temperature is outside the expected −5–25°C range');
    }

    (input.uValues || []).forEach(function (entry) {
      var number = finiteValue(entry.value);
      var field = fieldId(entry.label) + '-u-value';
      if (entry.required && (number === null || number <= 0)) {
        add(field, 'required', 'error',
          entry.label + ' U-value is required and must be greater than zero');
      } else if (number !== null && number > 0 && outside(number, 0.05, 5)) {
        add(field, 'range', entry.required ? 'error' : 'warning',
          entry.label + ' U-value is outside the expected 0.05–5 W/m²K range');
      }
    });

    if (input.ventilationRequired) {
      requiredRange('ventilation-ach', 'Air-change rate', input.ventilationAch, 0, 5,
        'Air-change rate is outside the expected 0–5 ACH range');
    } else if (input.manualAch !== null && input.manualAch !== undefined &&
        outside(input.manualAch, 0, 5)) {
      add('manual-ach', 'range', 'warning',
        'Manual air-change rate is outside the expected 0–5 ACH range');
    }

    (input.radiatorOutputsKw || []).forEach(function (value) {
      if (Number(value) > 0 && outside(value, 0.05, 20)) {
        add('radiator-output', 'range', 'warning',
          'Existing radiator output is outside the expected 0.05–20 kW range');
      }
    });
    return issues;
  }

  function validateRoom(input) {
    return validateRoomDetails(input).map(function (issue) { return issue.message; });
  }

  function canRecommendRadiator(inputOrIssues) {
    var issues = Array.isArray(inputOrIssues)
      ? inputOrIssues
      : validateRoomDetails(inputOrIssues);
    return !issues.some(function (issue) { return issue.severity === 'error'; });
  }

  return {
    canRecommendRadiator: canRecommendRadiator,
    validateRoom: validateRoom,
    validateRoomDetails: validateRoomDetails
  };
});
