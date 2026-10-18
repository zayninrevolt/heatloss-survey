'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cover = require('../src/report-cover');
const jpeg = 'data:image/jpeg;base64,/9j/AAAA';

test('cover photo allowlist rejects remote URLs, active formats, attributes and oversized data', () => {
  assert.equal(cover.isSafePhoto(jpeg), true);
  for (const value of [null, {}, '', 'https://example.invalid/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=',
    jpeg + '" onerror="alert(1)', 'data:image/jpeg;base64,AAAA', jpeg + 'A'.repeat(cover.MAX_PHOTO_LENGTH)]) {
    assert.equal(cover.isSafePhoto(value), false);
  }
});

test('cover is optional for existing surveys and missing or unsafe photos', () => {
  assert.equal(cover.render({}), '');
  assert.equal(cover.render({ property_photo: '' }), '');
  assert.equal(cover.render({ property_photo: 'https://example.invalid/image.jpg' }), '');
});

test('cover escapes user data and uses the existing property details', () => {
  const html = cover.render({ property_photo: jpeg, site_address: '<script>alert(1)</script>\n12 Test Road',
    site_company: 'Company <script>bad()</script>', site_surveyor: 'A & B "Surveyor"', site_postcode: '<img src=x onerror=alert(1)>', site_date: '2026-10-17' });
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Company &lt;script&gt;bad()&lt;/script&gt;'));
  assert.ok(html.includes('A &amp; B &quot;Surveyor&quot;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('17/10/2026'));
  assert.equal((html.match(/<img /g) || []).length, 1);
});

test('legacy property metadata and incomplete cover details remain readable', () => {
  const html = cover.render({ property_photo: jpeg, front_address: 'Old address', front_surveyor: 'Old surveyor', front_date: '2026-01-02' });
  assert.ok(html.includes('Old address')); assert.ok(html.includes('Old surveyor')); assert.ok(html.includes('02/01/2026'));
  const empty = cover.render({ property_photo: jpeg });
  assert.ok(empty.includes('Property address not entered')); assert.ok(empty.includes('Not entered'));
});
