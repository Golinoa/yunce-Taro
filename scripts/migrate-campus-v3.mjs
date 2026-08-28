import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/campus.ts');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/import \{[\s\S]*?\} from '@\/data\/campus';\r?\n/, '');
c = c.replace(
  /const USE_MOCK =\r?\n  typeof process !== 'undefined' && typeof process\.env !== 'undefined'\r?\n    \? process\.env\.VITE_USE_MOCK !== 'false'\r?\n    : true;\r?\n\r?\n/,
  `let campusMockMod: Awaited<ReturnType<typeof loadCampusMock>> | undefined;
async function cm() {
  campusMockMod ??= await loadCampusMock();
  return campusMockMod;
}

`,
);

c = c.replace(
  "import type {",
  `import { loadCampusMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
import type {`,
);

c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');
c = c.replace(/\bmock([A-Z][A-Za-z]*)\(/g, '(await cm()).mock$1(');

fs.writeFileSync(file, c, 'utf8');
console.log('campus v3 ok');
