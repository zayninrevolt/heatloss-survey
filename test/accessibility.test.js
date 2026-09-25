const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'combined-heatloss.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'combined-heatloss.js'), 'utf8');

test('provides a skip link and keeps the form heading hierarchy below the app H1', () => {
  assert.match(html, /<a class="skip-link" href="#preview">Skip to document preview<\/a>/);
  assert.match(html, /<main class="main" id="preview" tabindex="-1"><\/main>/);
  assert.match(html, /<h2>Front Sheet<\/h2>/);
  assert.match(html, /<h2>Radiator Sheet<\/h2>/);
});

test('traps modal keyboard focus and supports reduced motion', () => {
  assert.match(html, /function trapModalFocus\(event, panel\)/);
  assert.match(html, /installModalFocusTrap\(panel\);/);
  assert.match(html, /if \(e\.key === "Escape" && panel\?\.classList\.contains\("open"\)\) hidePdfOptions\(\);/);
  assert.match(html, /if \(e\.key === "Escape"\) \{\s*e\.preventDefault\(\);\s*hideSurveyPanelV57\(\);/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(app, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(app, /behavior: reduceMotion \? 'auto' : 'smooth'/);
});
