#!/usr/bin/env node
// Converts the CJS business-partner-data-min.js mock server file to a plain JSON array.
// Usage: node scripts/convert-data.cjs <path-to-business-partner-data-min.js>
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/convert-data.cjs <path-to-input-file>');
  process.exit(1);
}

let source = fs.readFileSync(inputPath, 'utf8');

// Strip moment dependency — it is only used for yearMonth which does not appear in data
source = source.replace(/const moment = require\(["']moment["']\);?\n?/, '');
source = source.replace(/const yearMonth = [^\n]+\n?/, '');

// Evaluate the CJS module in a sandboxed context
const mod = { exports: {} };
const fn = new Function('module', 'exports', 'require', source);
fn(mod, mod.exports, () => ({}));

const data = mod.exports.data;
if (!Array.isArray(data)) {
  console.error('Expected module.exports.data to be an array');
  process.exit(1);
}

const outDir = path.join(__dirname, '..', 'public', 'events', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'business-partners.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
console.log(`Wrote ${data.length} records to ${outPath}`);
