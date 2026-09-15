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
    _schemaVersion: persistence.CURRENT_SCHEMA_VERSION,
    _calcMethodVersion: persistence.CURRENT_CALC_METHOD_VERSION
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
    _schemaVersion: persistence.CURRENT_SCHEMA_VERSION,
    _calcMethodVersion: persistence.CURRENT_CALC_METHOD_VERSION
  });
});

test('legacy flat JSON remains readable', () => {
  assert.equal(persistence.decode('{"r_address":"Legacy"}').site_address, 'Legacy');
});

test('converts one legacy aggregate wall into one reviewable numbered wall', () => {
  const migrated = persistence.decodeWithReport({
    schemaVersion: 1,
    data: {
      hl_lounge_internal_wall_type: 'Unheated space, single brick',
      hl_lounge_internal_wall_length: '15',
      hl_lounge_internal_adjacent_temp: '18'
    }
  });

  assert.equal(migrated.data.hl_lounge_internal_wall_count, '1');
  assert.equal(migrated.data.hl_lounge_internal_segment_1_length, '15');
  assert.equal(migrated.data.hl_lounge_internal_segment_1_adjacent_temp, '18');
  assert.equal(migrated.data.hl_lounge_internal_wall_type, 'Heated room, single brick');
  assert.match(migrated.review.join(' '), /Lounge.*converted.*Wall 1/i);
});

test('respects an explicit zero wall count when legacy totals remain', () => {
  const migrated = persistence.decodeWithReport({
    schemaVersion: 1,
    data: {
      hl_lounge_internal_wall_count: '0',
      hl_lounge_internal_wall_length: '15',
      hl_lounge_internal_adjacent_temp: '18'
    }
  });

  assert.equal(migrated.data.hl_lounge_internal_wall_count, '0');
  assert.equal(migrated.data.hl_lounge_internal_segment_1_length, undefined);
  assert.doesNotMatch(migrated.review.join(' '), /converted/i);
});

test('leaves unsupported legacy wall temperatures blank and reports them', () => {
  const migrated = persistence.decodeWithReport({
    schemaVersion: 1,
    data: {
      hl_lounge_internal_wall_count: '1',
      hl_lounge_internal_segment_1_length: '15',
      hl_lounge_internal_segment_1_adjacent_temp: '20'
    }
  });

  assert.equal(migrated.data.hl_lounge_internal_segment_1_length, '15');
  assert.equal(migrated.data.hl_lounge_internal_segment_1_adjacent_temp, '');
  assert.match(migrated.review.join(' '), /Lounge.*Wall 1.*20°C.*standard temperature/i);
});

test('malformed, non-object, and future data fail explicitly', () => {
  assert.throws(() => persistence.decode('{bad json'));
  assert.throws(() => persistence.decode('[]'), /must be an object/);
  assert.throws(() => persistence.decode({ _schemaVersion: 99 }), /newer app version/);
  assert.throws(() => persistence.decode({ schemaVersion: 99, data: {} }),
    /newer than this app supports/);
});

test('a survey saved before the calculation fixes is stamped and flagged for review', () => {
  const migrated = persistence.decodeWithReport({
    schemaVersion: 2,
    data: { hl_lounge_area: '20', hl_lounge_height: '2.4' }
  });

  assert.equal(migrated.data._calcMethodVersion, persistence.CURRENT_CALC_METHOD_VERSION);
  assert.match(migrated.review.join(' '), /saved before the calculation fixes/i);
  assert.match(migrated.review.join(' '), /recheck/i);
});

test('a survey already on the current calculation method is not flagged', () => {
  const alreadyStamped = persistence.encode({
    hl_lounge_area: '20',
    hl_lounge_height: '2.4',
    _calcMethodVersion: persistence.CURRENT_CALC_METHOD_VERSION
  });

  const reloaded = persistence.decodeWithReport(alreadyStamped);
  assert.equal(reloaded.data._calcMethodVersion, persistence.CURRENT_CALC_METHOD_VERSION);
  assert.doesNotMatch(reloaded.review.join(' '), /calculation fixes/i);
});

test('a brand new survey records the calculation method without warning', () => {
  const reloaded = persistence.decodeWithReport(
    persistence.encode({ hl_lounge_area: '20' })
  );

  assert.equal(reloaded.data._calcMethodVersion, persistence.CURRENT_CALC_METHOD_VERSION);
  assert.equal(reloaded.review.length, 0);
});
