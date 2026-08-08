(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SurveyPersistence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CURRENT_SCHEMA_VERSION = 1;

  function plainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function migrateLegacyFields(source) {
    var data = Object.assign({}, source);
    if (data.r_address && !data.site_address) data.site_address = data.r_address;
    if (!data.hl_radiator_temperature) {
      var oldTemperature = Number(data.hl_flow_temp || data.front_boiler_temp);
      if (Number.isFinite(oldTemperature) && oldTemperature > 0) {
        data.hl_radiator_temperature = String(oldTemperature <= 60 ? 55 :
          oldTemperature <= 70 ? 65 : 75);
      }
    }
    Object.keys(data).forEach(function (key) {
      var match = key.match(/^hl_(.+)_window_type$/);
      if (match && data[key] === 'Double glazing') {
        data[key] = 'Older standard double glazing';
      }
      match = key.match(/^hl_(.+)_floor_type$/);
      if (match && data[key] === 'Uninsulated ground or exposed floor') {
        data[key] = 'Uninsulated solid ground floor';
      } else if (match && data[key] === 'Insulated ground floor') {
        data[key] = 'Insulated solid ground floor';
      }
      match = key.match(/^hl_(.+)_internal_wall_type$/);
      if (match) {
        var internalWalls = {
          'None': 'No internal wall included',
          'Single brick wall': 'Unheated space, single brick',
          'Stud and plasterboard': 'Unheated space, stud and plasterboard'
        };
        if (internalWalls[data[key]]) data[key] = internalWalls[data[key]];
      }
    });
    data._schemaVersion = CURRENT_SCHEMA_VERSION;
    return data;
  }

  var migrations = {
    0: migrateLegacyFields
  };

  function migrateSurvey(source) {
    if (!plainObject(source)) throw new TypeError('Survey data must be an object.');
    var data = Object.assign({}, source);
    var version = Number(data._schemaVersion) || 0;
    if (version > CURRENT_SCHEMA_VERSION) {
      throw new Error('This survey was created by a newer app version.');
    }
    while (version < CURRENT_SCHEMA_VERSION) {
      if (typeof migrations[version] !== 'function') {
        throw new Error('No migration is available for survey schema ' + version + '.');
      }
      data = migrations[version](data);
      version = Number(data._schemaVersion);
    }
    return data;
  }

  function encode(data) {
    return JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: migrateSurvey(data)
    });
  }

  function decode(serialized) {
    if (!serialized) return {};
    var parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
    if (!plainObject(parsed)) throw new TypeError('Saved survey must be an object.');
    if (plainObject(parsed.data) && parsed.schemaVersion != null) {
      if (Number(parsed.schemaVersion) > CURRENT_SCHEMA_VERSION) {
        throw new Error('Saved survey schema is newer than this app supports.');
      }
      return migrateSurvey(parsed.data);
    }
    return migrateSurvey(parsed);
  }

  return {
    CURRENT_SCHEMA_VERSION: CURRENT_SCHEMA_VERSION,
    decode: decode,
    encode: encode,
    migrateSurvey: migrateSurvey
  };
});
