'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const persistence = require('../src/persistence.js');

test('migrates an unversioned survey without mutating the source', () => {
  const legacy = {
    r_address: '1 Test Street',
    hl_flow_temp: '60',
    hl_lounge_window_type: 'Double glazing',
    hl_lounge_floor_type: 'Insulated ground floor',
    hl_lounge_internal_wall_type: 'Single brick wall'
  };
  const migrated = persistence.migrateSurvey(legacy);
  assert.equal(legacy._schemaVersion, undefined);
  assert.deepEqual(migrated, {
    ...legacy,
    site_address: '1 Test Street',
    hl_radiator_temperature: '55',
    hl_lounge_window_type: 'Older standard double glazing',
    hl_lounge_floor_type: 'Insulated solid ground floor',
    hl_lounge_internal_wall_type: 'Unheated space, single brick',
    _schemaVersion: 1
  });
});

test('migration is idempotent', () => {
  const once = persistence.migrateSurvey({ front_boiler_temp: 75 });
  assert.deepEqual(persistence.migrateSurvey(once), once);
});

test('current survey data round-trips through a versioned envelope', () => {
  const source = { site_address: '2 Example Road', rad_lounge_len: '4.2' };
  const encoded = persistence.encode(source);
  const envelope = JSON.parse(encoded);
  assert.equal(envelope.schemaVersion, persistence.CURRENT_SCHEMA_VERSION);
  assert.deepEqual(persistence.decode(encoded), {
    ...source,
    _schemaVersion: persistence.CURRENT_SCHEMA_VERSION
  });
});

test('legacy flat JSON remains readable', () => {
  assert.equal(persistence.decode('{"r_address":"Legacy"}').site_address, 'Legacy');
});

test('malformed, non-object, and future data fail explicitly', () => {
  assert.throws(() => persistence.decode('{bad json'));
  assert.throws(() => persistence.decode('[]'), /must be an object/);
  assert.throws(() => persistence.decode({ _schemaVersion: 99 }), /newer app version/);
  assert.throws(() => persistence.decode({ schemaVersion: 99, data: {} }),
    /newer than this app supports/);
});
