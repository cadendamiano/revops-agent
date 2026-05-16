#!/usr/bin/env node
/**
 * Copy chart library dist files from node_modules into public/vendor/ so that
 * HtmlArtifact can load them from the local Next.js server instead of a CDN.
 * This ensures charts render even when the demo machine has no internet access.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'public', 'vendor');

const COPIES = [
  ['echarts/dist/echarts.min.js', 'echarts.min.js'],
  ['d3/dist/d3.min.js', 'd3.min.js'],
  ['chart.js/dist/chart.umd.min.js', 'chart.umd.js'],
];

if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });

let copied = 0;
for (const [src, dest] of COPIES) {
  const srcPath = path.join(ROOT, 'node_modules', src);
  const destPath = path.join(DEST, dest);
  if (!fs.existsSync(srcPath)) {
    console.error(`[copy-vendors] missing: ${srcPath} — run npm install first`);
    process.exit(1);
  }
  fs.copyFileSync(srcPath, destPath);
  const kb = Math.round(fs.statSync(destPath).size / 1024);
  console.log(`[copy-vendors] ${dest} (${kb} KB)`);
  copied++;
}
console.log(`[copy-vendors] done — ${copied} files written to public/vendor/`);
