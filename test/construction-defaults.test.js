const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the actual controller helpers and table, not a copied normalizer.
const source = fs.readFileSync(require.resolve('../combined-heatloss.js'), 'utf8');
const table = source.match(/internalWall:\s*(\{[\s\S]*?\n    \}),\n    internalDoor/);
const start = source.indexOf('  function internalWallConstructionOptions() {');
const end = source.indexOf('  function internalWallSegmentsHtml', start);
assert.ok(table && start >= 0 && end > start);
const context = {};
vm.runInNewContext('var VALUES = { internalWall: ' + table[1] + ' };\n' + source.slice(start, end), context);

const materials = [
  ['aerated block', 0.82], ['breeze block', 2.76],
  ['single brick', 2.05], ['stud and plasterboard', 1.76]
];

test('shared internal-wall options are material-only labels with unchanged saved values', () => {
  const actual = Array.from(context.internalWallConstructionOptions(), o => ({ label: o.label, value: o.value }));
  assert.deepEqual(actual, materials.map(([material]) => ({ label: material, value: 'Heated room, ' + material })));
});

for (const [material, u] of materials) {
  test(`legacy property default preserves the ${material} material and U-value`, () => {
    const value = 'Heated room, ' + material;
    assert.equal(context.normaliseDefaultInternalWall(value), value);
    assert.equal(context.normaliseDefaultInternalWall('Unheated space, ' + material), value);
    assert.equal(context.VALUES.internalWall[value], u);
    assert.equal(context.VALUES.internalWall['Unheated space, ' + material], u);
    assert.equal(context.normaliseDefaultInternalWall(context.normaliseDefaultInternalWall('Unheated space, ' + material)), value);
  });
}

test('missing and retired no-wall defaults stay blank instead of guessing a material', () => {
  for (const value of ['', null, undefined, 'No internal wall included', 'None']) {
    assert.equal(context.normaliseDefaultInternalWall(value), '');
  }
});

test('unsupported default values cannot become a selectable guessed material', () => {
  for (const value of ['Unsupported material', 'Unheated space, mystery block', '<script>']) {
    assert.equal(context.normaliseDefaultInternalWall(value), '');
  }
});
