import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/data-center.ts');
let c = fs.readFileSync(file, 'utf8');

if (c.includes('loadDataCenterMock')) {
  console.log('data-center already migrated');
  process.exit(0);
}

c = c.replace(/import \{[\s\S]*?\} from '@\/data\/data-center';\r?\n(?=import type)/, '');
c = c.replace(/const USE_MOCK =[\s\S]*?;\r?\n\r?\n/, '');
c = c.replace(
  "} from '@/data/data-center';",
  `} from '@/data/data-center';
import { loadDataCenterMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';

let dcMockMod: Awaited<ReturnType<typeof loadDataCenterMock>> | undefined;
async function dc() {
  dcMockMod ??= await loadDataCenterMock();
  return dcMockMod;
}
`,
);

c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');

const mockFns = [
  'mockGetVenueOverview',
  'mockGetRevenueTrend',
  'mockGetFinanceData',
  'mockGetMemberData',
  'mockGetCardData',
  'mockGetSalaryData',
  'mockGetFinanceDetail',
  'mockGetMemberDetail',
  'mockGetCardDetail',
  'mockGetSalaryDetail',
  'mockGetExpenseCategories',
  'mockGetIncomeCategories',
  'mockCreateTransaction',
];
for (const fn of mockFns) {
  c = c.replace(new RegExp(`\\b${fn}\\(`, 'g'), `(await dc()).${fn}(`);
}

fs.writeFileSync(file, c, 'utf8');
console.log('data-center migrated');
