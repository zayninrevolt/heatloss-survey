'use strict';
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');

// Inspection helper for Chromium's own test-generated PDFs, not a general PDF
// reader. Reject unexpected shapes rather than silently accepting an empty PDF.
function chromiumPdfPages(buffer) {
  const text = buffer.toString('latin1');
  assert.ok(text.startsWith('%PDF-'), 'Expected a generated PDF');
  const objects = new Map();
  for (const match of text.matchAll(/(?:^|\n)(\d+) 0 obj\s*([\s\S]*?)endobj/g)) {
    objects.set(Number(match[1]), match[2]);
  }
  const pages = [];
  for (const body of objects.values()) {
    if (!/\/Type\s*\/Page\b/.test(body)) continue;
    const contents = /\/Contents\s+(\d+) 0 R/.exec(body);
    assert.ok(contents, 'Expected a single Chromium page content stream');
    const stream = objects.get(Number(contents[1]));
    assert.ok(stream, 'Missing page content stream');
    const length = /\/Length\s+(\d+)/.exec(stream);
    const start = /stream\r?\n/.exec(stream);
    assert.ok(length && start, 'Expected a length-delimited stream');
    const encoded = Buffer.from(stream.slice(start.index + start[0].length,
      start.index + start[0].length + Number(length[1])), 'latin1');
    const operators = (/\/Filter\s*\/FlateDecode/.test(stream)
      ? inflateSync(encoded) : encoded).toString('latin1');
    const textRuns = [...operators.matchAll(/\bBT\b/g)].length;
    const textCodes = [...operators.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
      .reduce((sum, match) => sum + match[1].length / 4, 0);
    const box = /\/MediaBox\s*\[([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\]/.exec(body);
    assert.ok(box, 'Expected a page size');
    pages.push({ textRuns, textCodes, width: Number(box[3]) - Number(box[1]),
      height: Number(box[4]) - Number(box[2]) });
  }
  assert.ok(pages.length, 'Expected at least one PDF page');
  assert.ok(pages.some(page => page.textCodes > 100), 'Expected actual report content');
  return pages;
}
module.exports = { chromiumPdfPages };
