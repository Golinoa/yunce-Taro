/**
 * 主包瘦身：删除未被引用的 MDI 图标路径（保留动态引用可能用到的集合）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsPath = path.join(root, 'src/components/Icon/icons.ts');

/** 动态/配置引用，即使静态扫描未命中也保留 */
const KEEP = new Set([
  // KingKong / Empty 动态兜底常见名
  'mdi-home',
  'mdi-home-outline',
  'mdi-loading',
  'mdi-wechat',
]);

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walk(p, files);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      files.push(p);
    }
  }
  return files;
}

const src = fs.readFileSync(iconsPath, 'utf8');
const names = [...src.matchAll(/'(mdi-[^']+)'/g)].map((m) => m[1]);
const files = walk(path.join(root, 'src')).filter(
  (f) => !f.replace(/\\/g, '/').endsWith('components/Icon/icons.ts'),
);
const blob = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const unused = names.filter((n) => !KEEP.has(n) && !blob.includes(n));
console.log(`defined=${names.length} unused=${unused.length}`);

// Parse entries: 'mdi-xxx': 'path' or 'mdi-xxx':\n  'path',
let next = src;
let removed = 0;
for (const name of unused) {
  const re = new RegExp(
    `\\s*'${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*(?:'[^']*'|\\n\\s*'[^']*'),?`,
    'g',
  );
  const before = next.length;
  next = next.replace(re, '');
  if (next.length < before) {
    removed += 1;
  } else {
    console.warn(`[warn] failed to remove ${name}`);
  }
}

// tidy double blank lines
next = next.replace(/\n{3,}/g, '\n\n');
fs.writeFileSync(iconsPath, next);
console.log(`removed ${removed} icons; file ${(src.length / 1024).toFixed(1)}KB → ${(next.length / 1024).toFixed(1)}KB`);
