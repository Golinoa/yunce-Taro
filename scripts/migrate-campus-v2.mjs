import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/campus.ts');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/import \{[\s\S]*?\} from '@\/data\/campus';\r?\n/, '');
c = c.replace(
  /const USE_MOCK =\r?\n  typeof process !== 'undefined' && typeof process\.env !== 'undefined'\r?\n    \? process\.env\.VITE_USE_MOCK !== 'false'\r?\n    : true;\r?\n\r?\n/,
  '',
);

if (!c.includes('loadCampusMock')) {
  c = c.replace(
    "import type {",
    `import { loadCampusMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
import type {`,
  );
}

c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');
c = c.replace(
  /if \(isUseMock\(\)\) \{\r?\n(\s*)return (mock[A-Za-z]+)\(([^)]*)\);\r?\n\s*\}/g,
  'if (isUseMock()) {\n$1const { $2 } = await loadCampusMock();\n$1return $2($3);\n  }',
);
c = c.replace(
  /return (mock[A-Za-z]+)\(([^)]*)\);/g,
  'const { $1 } = await loadCampusMock();\n    return $1($2);',
);

fs.writeFileSync(file, c, 'utf8');
console.log('campus migrated');
