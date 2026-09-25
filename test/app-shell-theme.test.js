const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appShellCss = fs.readFileSync(path.join(root, 'combined-heatloss.css'), 'utf8');

test('uses the shared warm dark app-shell palette while keeping survey sheet text black', () => {
  assert.match(appShellCss, /--app-bg:\s*#171512;/);
  assert.match(appShellCss, /--app-panel:\s*#24201c;/);
  assert.match(appShellCss, /--app-accent:\s*#f3a477;/);
  assert.match(appShellCss, /--app-success:\s*#83c5a3;/);
  assert.match(appShellCss, /\.app-shell-theme\s+\.sidebar\s*\{/);
  assert.match(appShellCss, /body\.app-shell-theme \.sheet-wrap,\nbody\.app-shell-theme \.sheet,\nbody\.app-shell-theme \.sheet-title\s*\{\s*color: #111 !important;/);
});

test('keeps the printed survey document palette unchanged', () => {
  assert.match(html, /\.sheet \.input\s*\{\s*background: #ffff66 !important;/);
  assert.match(html, /\.sheet \.gold\s*\{\s*background: #ffc000 !important;/);
  assert.match(html, /\.sheet \.black\s*\{\s*background: #000 !important;/);
  assert.match(html, /\.sheet \.black\s*\{\s*background: #000 !important;\s*color: #fff !important;/);
});
