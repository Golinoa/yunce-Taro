import fs from 'node:fs';
import path from 'node:path';

const srcRoot = path.join(process.cwd(), 'src');
const iconsPath = path.join(srcRoot, 'components/Icon/icons.ts');
const iconsSrc = fs.readFileSync(iconsPath, 'utf8');
const names = [...iconsSrc.matchAll(/'(mdi-[^']+)'/g)].map((m) => m[1]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist'].includes(entry.name)) walk(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const used = new Set();
for (const file of walk(srcRoot)) {
  if (file.includes('icons.ts')) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const name of names) {
    if (content.includes(name)) used.add(name);
  }
}

const unused = names.filter((n) => !used.has(n));
console.log(`total ${names.length}, used ${used.size}, unused ${unused.length}`);
for (const name of unused) console.log(name);
