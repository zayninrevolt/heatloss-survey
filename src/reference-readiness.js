(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReferenceMethodReadiness = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var AIRTIGHTNESS_METHODS = [
    'Standard default',
    'Measured 50 Pa permeability',
    'Design infiltration ACH'
  ];

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function positive(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0;
  }

  function present(value) {
    return text(value) !== '';
  }

  function evaluate(input) {
    input = input || {};
    var missing = [];
    var airtightnessMethod = text(input.airtightnessMethod);

    if (!present(input.designStation)) missing.push('outdoor design reference');
    if (!present(input.groundStation)) missing.push('ground-temperature reference');
    if (!present(input.dwellingAttachment)) missing.push('dwelling attachment');
    if (!present(input.ventilationStoreys)) missing.push('ventilation-zone storeys');
    if (!present(input.shelteredSides)) missing.push('sheltered external sides');
    if (AIRTIGHTNESS_METHODS.indexOf(airtightnessMethod) < 0) {
      missing.push('airtightness evidence method');
    } else if (airtightnessMethod === 'Measured 50 Pa permeability') {
      if (!positive(input.measuredAirPermeability50)) {
        missing.push('measured 50 Pa air permeability');
      }
      if (!positive(input.measuredEnvelopeArea)) missing.push('air-test envelope area');
      if (!positive(input.measuredEnvelopeVolume)) missing.push('air-test envelope volume');
    } else if (airtightnessMethod === 'Design infiltration ACH' &&
      !positive(input.designInfiltrationAch)) {
      missing.push('justified design infiltration ACH');
    }

    var inputsComplete = missing.length === 0;
    return {
      inputsComplete: inputsComplete,
      missing: missing,
      readyForSizing: false,
      statusText: inputsComplete
        ? 'Reference inputs complete. The BS EN 12831 reference route remains in validation and is not used for boiler sizing.'
        : 'Reference inputs incomplete: ' + missing.join(', ') + '. The route is not used for boiler sizing.'
    };
  }

  return {
    AIRTIGHTNESS_METHODS: AIRTIGHTNESS_METHODS,
    evaluate: evaluate
  };
});
