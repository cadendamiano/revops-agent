#!/usr/bin/env node
/**
 * Stage Next.js standalone output into electron-next/ for packaging.
 *
 * After `next build` with `output: 'standalone'`, Next emits:
 *   .next/standalone/        — minimal server bundle (server.js + traced node_modules)
 *   .next/static/            — built static assets
 *   public/                  — original public dir (not auto-copied into standalone)
 *
 * We mirror these into a single tree at electron-next/ that the Electron
 * main process spawns as `node electron-next/server.js`.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC_STANDALONE = path.join(ROOT, '.next', 'standalone');
const SRC_STATIC = path.join(ROOT, '.next', 'static');
const SRC_PUBLIC = path.join(ROOT, 'public');
const DEST = path.join(ROOT, 'electron-next');

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isSymbolicLink()) {
      const link = fs.readlinkSync(s);
      try { fs.symlinkSync(link, d); }
      catch { fs.copyFileSync(s, d); }
    } else fs.copyFileSync(s, d);
  }
}

function main() {
  if (!fs.existsSync(SRC_STANDALONE)) {
    console.error('[copy-standalone] .next/standalone not found — run `next build` first.');
    process.exit(1);
  }

  rmrf(DEST);
  console.log('[copy-standalone] copying standalone bundle…');
  copyDir(SRC_STANDALONE, DEST);

  console.log('[copy-standalone] copying .next/static…');
  copyDir(SRC_STATIC, path.join(DEST, '.next', 'static'));

  if (fs.existsSync(SRC_PUBLIC)) {
    console.log('[copy-standalone] copying public/…');
    copyDir(SRC_PUBLIC, path.join(DEST, 'public'));
  }

  console.log('[copy-standalone] done →', DEST);
}

main();
