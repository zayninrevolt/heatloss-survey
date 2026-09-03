(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SurveyPersistence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CURRENT_SCHEMA_VERSION = 2;
  var STANDARD_ADJACENT_TEMPERATURES = ['10', '18', '21', '22', '23'];

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
    data._schemaVersion = 1;
    return data;
  }

  function roomLabel(roomKey) {
    return String(roomKey || '').split('_').map(function (part) {
      return part ? part.charAt(0).toUpperCase() + part.slice(1) : '';
    }).join(' ');
  }

  function numberedInternalWallType(value) {
    if (typeof value !== 'string') return value;
    if (value.indexOf('Unheated space, ') === 0) {
      return value.replace(/^Unheated space, /, 'Heated room, ');
    }
    return value;
  }

  function migrateNumberedInternalWalls(source, review) {
    var data = Object.assign({}, source);
    Object.keys(data).forEach(function (key) {
      var match = key.match(/^hl_(.+)_internal_wall_length$/);
      if (!match || !(Number(data[key]) > 0)) return;
      var roomKey = match[1];
      var countKey = 'hl_' + roomKey + '_internal_wall_count';
      var hasExplicitCount = data[countKey] != null &&
        String(data[countKey]).trim() !== '';
      if (hasExplicitCount) return;
      var segmentPrefix = 'hl_' + roomKey + '_internal_segment_';
      var hasNumberedLength = [1, 2, 3, 4].some(function (index) {
        return Number(data[segmentPrefix + index + '_length']) > 0;
      });
      if (hasNumberedLength) return;

      data['hl_' + roomKey + '_internal_wall_count'] = '1';
      data[segmentPrefix + '1_length'] = String(data[key]);
      var oldTemperature = data['hl_' + roomKey + '_internal_adjacent_temp'];
      if (oldTemperature != null && String(oldTemperature).trim() !== '') {
        data[segmentPrefix + '1_adjacent_temp'] = String(oldTemperature);
      }
      var typeKey = 'hl_' + roomKey + '_internal_wall_type';
      data[typeKey] = numberedInternalWallType(data[typeKey]);
      if (review) {
        review.push(roomLabel(roomKey) +
          ': legacy internal-wall total converted to Wall 1 for review.');
      }
    });

    Object.keys(data).forEach(function (key) {
      var match = key.match(/^hl_(.+)_internal_segment_(\d+)_adjacent_temp$/);
      if (!match) return;
      var value = String(data[key] == null ? '' : data[key]).trim();
      if (!value || STANDARD_ADJACENT_TEMPERATURES.includes(value)) return;
      data[key] = '';
      if (review) {
        review.push(roomLabel(match[1]) + ' Wall ' + match[2] + ' used ' + value +
          '°C, which is not a standard temperature; select 10, 18, 21, 22 or 23°C.');
      }
    });
    data._schemaVersion = CURRENT_SCHEMA_VERSION;
    return data;
  }

  var migrations = {
    0: migrateLegacyFields,
    1: migrateNumberedInternalWalls
  };

  function migrateSurvey(source, review) {
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
      data = migrations[version](data, review);
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

  function decodeWithReport(serialized) {
    if (!serialized) return { data: {}, review: [], migrated: [] };
    var parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
    if (!plainObject(parsed)) throw new TypeError('Saved survey must be an object.');
    var source = parsed;
    if (plainObject(parsed.data) && parsed.schemaVersion != null) {
      if (Number(parsed.schemaVersion) > CURRENT_SCHEMA_VERSION) {
        throw new Error('Saved survey schema is newer than this app supports.');
      }
      source = Object.assign({}, parsed.data);
      if (source._schemaVersion == null) {
        source._schemaVersion = Number(parsed.schemaVersion) || 0;
      }
    }
    var migrated = [];
    if (source.r_address && !source.site_address) migrated.push('address');
    if (!source.hl_radiator_temperature &&
        Number(source.hl_flow_temp || source.front_boiler_temp) > 0) {
      migrated.push('radiator temperature');
    }
    var review = [];
    return {
      data: migrateSurvey(source, review),
      review: review,
      migrated: migrated
    };
  }

  function decode(serialized) {
    return decodeWithReport(serialized).data;
  }

  return {
    CURRENT_SCHEMA_VERSION: CURRENT_SCHEMA_VERSION,
    decode: decode,
    decodeWithReport: decodeWithReport,
    encode: encode,
    migrateSurvey: migrateSurvey
  };
});
