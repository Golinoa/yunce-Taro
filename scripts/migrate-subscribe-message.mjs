import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/subscribe-message.ts');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /import \{\r?\n  mockDismissPending,\r?\n  mockGetBootstrap,\r?\n  mockReportAuth,\r?\n\} from '@\/data\/subscribe-message';\r?\n/,
  `import { loadSubscribeMessageMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
`,
);

c = c.replace(
  /const USE_MOCK =\r?\n  typeof process !== 'undefined' && typeof process\.env !== 'undefined'\r?\n    \? process\.env\.VITE_USE_MOCK !== 'false'\r?\n    : true;\r?\n\r?\n/,
  '',
);
c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');

for (const fn of ['mockGetBootstrap', 'mockReportAuth', 'mockDismissPending']) {
  c = c.replace(
    new RegExp(`\\b${fn}\\(`, 'g'),
    `(await loadSubscribeMessageMock()).${fn}(`,
  );
}

fs.writeFileSync(file, c, 'utf8');
console.log('subscribe-message migrated');
