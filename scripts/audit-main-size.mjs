import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.join(process.cwd(), 'dist');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

const main = walk(distRoot).filter((f) => !path.relative(distRoot, f).replace(/\\/g, '/').startsWith('package-'));
main.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
let total = 0;
for (const file of main) {
  total += fs.statSync(file).size;
}
console.log(`MAIN TOTAL ${(total / 1024).toFixed(1)}KB\n`);
for (const file of main.slice(0, 25)) {
  console.log(`${(fs.statSync(file) / 1024).toFixed(1).padStart(8)}KB  ${path.relative(distRoot, file).replace(/\\/g, '/')}`);
}
