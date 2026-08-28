import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'src/services/statistics.ts');
let c = fs.readFileSync(file, 'utf8');

if (c.includes('loadStatisticsMock')) {
  console.log('statistics already migrated');
  process.exit(0);
}

c = c.replace(/import \{[\s\S]*?\} from '@\/data\/mock';\r?\n/, '');
c = c.replace(/import \{[\s\S]*?\} from '@\/data\/statistics';\r?\n/, '');
c = c.replace(
  /const USE_MOCK =[\s\S]*?;\r?\n\r?\n/,
  `import { loadStatisticsBaseMock, loadStatisticsMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';

let statsBaseMod: Awaited<ReturnType<typeof loadStatisticsBaseMock>> | undefined;
let statsMockMod: Awaited<ReturnType<typeof loadStatisticsMock>> | undefined;
async function sb() {
  statsBaseMod ??= await loadStatisticsBaseMock();
  return statsBaseMod;
}
async function sm() {
  statsMockMod ??= await loadStatisticsMock();
  return statsMockMod;
}

`,
);

c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');

const baseFns = [
  'computeOperationKpi',
  'computeFinanceKpi',
  'computeTrend',
  'computeStudentRank',
  'computeTeacherRank',
  'computeCampusRank',
  'computeCompare',
  'computeFinanceAnalysis',
];
for (const fn of baseFns) {
  c = c.replace(new RegExp(`\\b${fn}\\(`, 'g'), `(await sb()).${fn}(`);
}

const statFns = [
  'mockGetLessonTrend',
  'mockGetIncomeTrend',
  'mockGetLessonRank',
  'mockGetPaymentRank',
  'mockGetParentTrend',
  'mockGetExpenseRatios',
  'mockGetFinanceAlerts',
  'mockGetOperationAlerts',
];
for (const fn of statFns) {
  c = c.replace(new RegExp(`\\b${fn}\\(`, 'g'), `(await sm()).${fn}(`);
}
c = c.replace(/\bMOCK_PARENT_TREND\b/g, '(await sm()).MOCK_PARENT_TREND');
c = c.replace(/\bMOCK_PAYMENT_RANK\b/g, '(await sm()).MOCK_PAYMENT_RANK');

for (const fn of [
  'getLessonTrendFallback',
  'getIncomeTrendFallback',
  'getLessonRankFallback',
  'getPaymentRankFallback',
  'getParentTrendFallback',
  'getExpenseRatiosFallback',
  'getOperationKpiFallback',
  'getFinanceKpiFallback',
  'getTeacherRankFallback',
  'getCampusRankFallback',
  'getCompareFallback',
  'getFinanceAnalysisComputedFallback',
]) {
  c = c.replace(`function ${fn}(`, `async function ${fn}(`);
}

fs.writeFileSync(file, c, 'utf8');
console.log('statistics migrated');
