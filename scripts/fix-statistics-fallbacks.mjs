import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'src/services/statistics.ts');
let c = fs.readFileSync(file, 'utf8');

// Sync static fallbacks for useMemo consumers (no mock import)
c = c.replace(
  /\/\/ ============================================\n\/\/ 同步 Fallback 数据[\s\S]*?async function getFinanceAnalysisComputedFallback\(\) \{\n  return \(await sb\(\)\)\.computeFinanceAnalysis\(\);\n\}\n/,
  `// ============================================
// 同步 Fallback（空默认，供 useMemo 同步消费；mock 数据走下方 async Service 方法）
// ============================================

function getLessonTrendFallback(): ChartDataItem[] {
  return [];
}

function getIncomeTrendFallback(): ChartDataItem[] {
  return [];
}

function getLessonRankFallback(): { label: string; value: number; unit: string }[] {
  return [];
}

function getPaymentRankFallback(): { label: string; value: number; unit: string }[] {
  return [];
}

function getParentTrendFallback(): ChartDataItem[] {
  return [];
}

function getExpenseRatiosFallback(): { label: string; ratio: number; barClass: string }[] {
  return [];
}

async function getOperationAlertsFallback(): Promise<AlertItem[]> {
  return (await (await sm()).mockGetOperationAlerts()).map(normalizeAlertItem);
}

async function getFinanceAlertsFallback(): Promise<AlertItem[]> {
  return (await (await sm()).mockGetFinanceAlerts()).map(normalizeAlertItem);
}

function getOperationKpiFallback(): OperationKpiItem {
  return {
    revenue: '¥0',
    revenueBadge: '+0%',
    bills: '0笔收费',
    avg: '客均 ¥0',
    lessonAmount: '¥0',
    lessonTrend: '+0%',
    newAmount: '¥0',
    newNote: '0位新学员',
    pending: '¥0',
    pendingNote: '无待收',
    totalRevenue: '¥0',
    totalExpense: '¥0',
    netProfit: '¥0',
    profitMargin: '0%',
  } as OperationKpiItem;
}

function getFinanceKpiFallback(): FinanceKpiItem {
  return {
    revenue: '¥0',
    revenueBadge: '+0%',
    bills: '0笔收费',
    avg: '客均 ¥0',
    lessonAmount: '¥0',
    lessonTrend: '+0%',
    newAmount: '¥0',
    newNote: '0位新学员',
    pending: '¥0',
    pendingNote: '无待收',
    totalRevenue: '¥0',
    totalExpense: '¥0',
    netProfit: '¥0',
    profitMargin: '0%',
  } as FinanceKpiItem;
}

function getTeacherRankFallback(): RankFallbackItem[] {
  return [];
}

function getCampusRankFallback(): RankFallbackItem[] {
  return [];
}

function getCompareFallback() {
  return { mom: '+0%', momValue: '上月 ¥0', yoy: '+0%', yoyValue: '去年 ¥0' };
}

function getFinanceAnalysisComputedFallback() {
  return {
    totalRevenue: '¥0',
    totalExpense: '¥0',
    netProfit: '¥0',
    profitMargin: '0%',
    expenseTrend: '+0%',
    incomeComposition: [] as { label: string; amount: string; percent: number; barClass: string }[],
    expenseComposition: [] as { label: string; amount: string; percent: number; barClass: string }[],
    compare: getCompareFallback(),
  };
}

`,
);

// Make service methods with await properly async
c = c.replace(
  /getLessonTrend: \(params\?:/g,
  'getLessonTrend: async (params?:',
);
c = c.replace(
  /getIncomeTrend: \(params\?:/g,
  'getIncomeTrend: async (params?:',
);
c = c.replace(
  /getParentTrend: \(params\?:/g,
  'getParentTrend: async (params?:',
);
c = c.replace(
  /getLessonRank: \(params\?:/g,
  'getLessonRank: async (params?:',
);
c = c.replace(
  /getPaymentRank: \(params\?:/g,
  'getPaymentRank: async (params?:',
);
c = c.replace(
  /getExpenseRatios: \(params\?:/g,
  'getExpenseRatios: async (params?:',
);
c = c.replace(
  /getAlerts: \(params: AlertQueryParams\): Promise<AlertItem\[\]> => \{/,
  'getAlerts: async (params: AlertQueryParams): Promise<AlertItem[]> => {',
);

fs.writeFileSync(file, c, 'utf8');
console.log('statistics fixed');
