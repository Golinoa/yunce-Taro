#!/usr/bin/env node
/**
 * verify-pages-complete.mjs
 *
 * POST-build hard gate for FLAKY-B12-01.
 *
 * The Taro dev build (MiniSplitChunksPlugin) non-deterministically omits a
 * page's `index.js` from `dist`, while `app.json`/`app.config.ts` still
 * declares the page → white screen on real device.
 *
 * This script enumerates EVERY page declared in the source app config(s):
 *   - top-level `pages`
 *   - each subpackage's `pages` (from `subPackages` / `subpackages`)
 * and asserts that `dist/<pagePath>/index.js` exists. If any declared page
 * is missing its built `index.js`, the build is considered broken and the
 * process exits with code 1.
 *
 * Run after `taro build --type weapp`:
 *   node ./scripts/verify-pages-complete.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'src');
const distDir = path.join(repoRoot, 'dist');

/**
 * Evaluate a `*.config.ts` / `*.config.js` file into a plain JS object.
 *
 * `app.config.ts` from Taro is essentially a pure JS object literal wrapped in
 * `defineAppConfig({ ... })`. There are no type annotations or imports in our
 * configs, so we can safely evaluate the object literal after stubbing the
 * `defineAppConfig` helper.
 */
function evalConfigFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');

  if (filePath.endsWith('.json')) {
    return JSON.parse(raw);
  }

  // Extract the object passed to `defineAppConfig(...)`.
  const callMatch = raw.match(/defineAppConfig\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$/m);
  const body = callMatch ? callMatch[1] : raw;

  // Provide a no-op `defineAppConfig` in case the marker regex fell through.
  const defineAppConfig = (cfg) => cfg;
  // eslint-disable-next-line no-new-func
  const factory = new Function('defineAppConfig', `return (${body});`);
  return factory(defineAppConfig);
}

/** Collect candidate config source files. */
function findConfigFiles() {
  const files = [];

  const mainTs = path.join(srcDir, 'app.config.ts');
  const mainJs = path.join(srcDir, 'app.config.js');
  const mainJson = path.join(srcDir, 'app.json');
  if (fs.existsSync(mainTs)) files.push(mainTs);
  if (fs.existsSync(mainJs)) files.push(mainJs);
  if (fs.existsSync(mainJson)) files.push(mainJson);

  // src/package-*/app.config.ts (and .js)
  if (fs.existsSync(srcDir)) {
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('package-')) continue;
      const pkgTs = path.join(srcDir, entry.name, 'app.config.ts');
      const pkgJs = path.join(srcDir, entry.name, 'app.config.js');
      if (fs.existsSync(pkgTs)) files.push(pkgTs);
      if (fs.existsSync(pkgJs)) files.push(pkgJs);
    }
  }

  return files;
}

/** Enumerate all declared page paths from a single parsed config object. */
function pagesFromConfig(cfg, { isRoot = false } = {}) {
  const pages = [];

  const topPages = Array.isArray(cfg.pages) ? cfg.pages : [];
  for (const p of topPages) {
    pages.push(isRoot ? p : p);
  }

  const subPackages = cfg.subPackages || cfg.subpackages || [];
  for (const sp of subPackages) {
    const root = (sp.root || '').replace(/\/+$/, '');
    const spPages = Array.isArray(sp.pages) ? sp.pages : [];
    for (const p of spPages) {
      pages.push(root ? `${root}/${p}` : p);
    }
  }

  return pages;
}

function main() {
  const configFiles = findConfigFiles();
  if (configFiles.length === 0) {
    console.error('[verify-pages-complete] No app.config.{ts,js} or app.json found under src/.');
    process.exit(1);
  }

  const declared = new Set();
  for (const file of configFiles) {
    let cfg;
    try {
      cfg = evalConfigFile(file);
    } catch (err) {
      console.error(`[verify-pages-complete] Failed to parse ${path.relative(repoRoot, file)}: ${err.message}`);
      process.exit(1);
    }
    for (const p of pagesFromConfig(cfg, { isRoot: path.basename(file) === 'app.json' })) {
      declared.add(p);
    }
  }

  const allPages = [...declared];
  const missing = [];

  for (const pagePath of allPages) {
    const indexJs = path.join(distDir, `${pagePath}.js`);
    if (!fs.existsSync(indexJs)) {
      missing.push(pagePath);
    }
  }

  const total = allPages.length;
  const missingCount = missing.length;

  console.log(`[verify-pages-complete] ${total} declared pages, ${missingCount} missing`);

  if (missingCount > 0) {
    console.error('[verify-pages-complete] FAIL: the following declared pages are missing dist/<page>/index.js:');
    for (const m of missing.sort()) {
      console.error(`  - ${m}  (expected: dist/${m}.js)`);
    }
    process.exit(1);
  }

  console.log('[verify-pages-complete] PASS: every declared page has its dist/<page>/index.js.');
  process.exit(0);
}

main();
