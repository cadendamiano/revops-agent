#!/usr/bin/env node
/**
 * Preflight: fail fast with a helpful message before any dev/build work.
 * Checks node_modules, .env.local, and required env vars.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REQUIRED_KEYS = [];
const OPTIONAL_KEYS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY'];

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

function fail(msg) {
  console.error(red('[preflight] ' + msg));
  process.exit(1);
}

function warn(msg) {
  console.warn(yellow('[preflight] ' + msg));
}

function ok(msg) {
  console.log(green('[preflight] ' + msg));
}

function parseEnvFile(file) {
  const out = {};
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
  fail('node_modules/ is missing. Run `npm install` first.');
}

const envPath = path.join(ROOT, '.env.local');
const examplePath = path.join(ROOT, '.env.local.example');
if (!fs.existsSync(envPath)) {
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    warn('.env.local was missing; copied from .env.local.example. Fill in real values, then re-run.');
  } else {
    fail('.env.local is missing and no .env.local.example to copy from.');
  }
  process.exit(1);
}

const env = parseEnvFile(envPath);
const isPlaceholder = (v) => !v || /^(your[-_ ]?|sk-ant-\.\.\.|\.\.\.|changeme|todo)/i.test(v);
const missing = REQUIRED_KEYS.filter((k) => isPlaceholder(env[k]));
const missingOptional = OPTIONAL_KEYS.filter((k) => isPlaceholder(env[k]));

if (missing.length) {
  fail(`Missing/placeholder values in .env.local: ${missing.join(', ')}`);
}
if (missingOptional.length) {
  warn(`Optional keys not set: ${missingOptional.join(', ')} — features that use them will fail when invoked.`);
}

ok('environment looks good.');
