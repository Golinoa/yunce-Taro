/**
 * 批量修复 mock 优化引入的 typecheck 问题
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
  console.log('[ok]', rel);
}

// ---------- home-ui ----------
const homeSrc = read('src/data/home.ts');
const homeEntries = homeSrc.match(/export const HOME_QUICK_ENTRIES: QuickEntry\[\] = \[[\s\S]*?\];/)?.[0];
if (!homeEntries) throw new Error('HOME_QUICK_ENTRIES not found');
write(
  'src/constants/home-ui.ts',
  `import { COURSE_MANAGEMENT_CLASS_TAB_URL } from '@/constants/course-category-ui';

export interface HomeQuickEntry {
  label: string;
  icon: string;
  color: string;
  url: string;
}

/** 首页快捷入口（生产 / Mock 共用） */
${homeEntries.replace('QuickEntry[]', 'HomeQuickEntry[]')}
`,
);

// ---------- campus-ui（仅 UI 常量，不含 mock） ----------
write(
  'src/constants/campus-ui.ts',
  `import type { CampusType, PartnerMode } from '@/types/campus';

/** 默认场地负责人 userId（真实环境由后端返回，此处仅作表单占位） */
export const DEFAULT_VENUE_MANAGER_USER_ID = 'user-principal-001';

export const CAMPUS_ICONS = [
  { icon: '🏢', gradient: 'linear-gradient(135deg, hsl(168 55% 58%), hsl(168 55% 75%))' },
  { icon: '🏫', gradient: 'linear-gradient(135deg, hsl(200 55% 65%), hsl(200 55% 80%))' },
  { icon: '🎓', gradient: 'linear-gradient(135deg, hsl(340 60% 78%), hsl(340 60% 88%))' },
  { icon: '🎨', gradient: 'linear-gradient(135deg, hsl(27 87% 67%), hsl(27 87% 82%))' },
] as const;

export const CAMPUS_TYPE_MAP: Record<
  CampusType,
  { label: string; tagBg: string; tagText: string; dotColor: string }
> = {
  main: {
    label: '总校区',
    tagBg: 'bg-primary-bg',
    tagText: 'text-primary',
    dotColor: 'bg-primary',
  },
  self: {
    label: '自营校区',
    tagBg: 'bg-primary-bg',
    tagText: 'text-primary',
    dotColor: 'bg-primary',
  },
  partner: { label: '合作校区', tagBg: 'bg-info-bg', tagText: 'text-info', dotColor: 'bg-info' },
};

export const PARTNER_MODE_MAP: Record<PartnerMode, string> = {
  hourly_share: '课时分成',
  venue_rental: '场地租赁',
};

export const HOLIDAY_STATUS_MAP = {
  rest: { label: '休息', bg: 'bg-destructive/10', text: 'text-destructive' },
  adjust: { label: '调课', bg: 'bg-primary-bg', text: 'text-primary' },
} as const;

export const SUBJECT_ICONS = [
  { icon: '🎹', color: '#5EC8A8', gradient: 'linear-gradient(135deg, #5EC8A8, #4AB893)' },
  { icon: '🎤', color: '#9B7ED8', gradient: 'linear-gradient(135deg, #9B7ED8, #7E63C9)' },
  { icon: '📘', color: '#6BA3D6', gradient: 'linear-gradient(135deg, #6BA3D6, #4B85BB)' },
  { icon: '💃', color: '#E89BB8', gradient: 'linear-gradient(135deg, #E89BB8, #D97CA2)' },
  { icon: '✍️', color: '#D4A24E', gradient: 'linear-gradient(135deg, #D4A24E, #B9852F)' },
  { icon: '🎨', color: '#E8864A', gradient: 'linear-gradient(135deg, #E8864A, #D66D2B)' },
  { icon: '🎸', color: '#6BA3D6', gradient: 'linear-gradient(135deg, #6BA3D6, #4D86BD)' },
  { icon: '🥁', color: '#F08A5D', gradient: 'linear-gradient(135deg, #F08A5D, #D96A38)' },
];
`,
);

// ---------- teacher-salary（仅 calcTotal + createDefaultSalaryRule） ----------
const teacherSrc = read('src/data/teacher.ts');
const calcStart = teacherSrc.indexOf('export function calcTotal');
const calcEnd = teacherSrc.indexOf('\nexport async function mockExecutePay', calcStart);
const ruleStart = teacherSrc.indexOf('export function createDefaultSalaryRule');
const ruleEnd = teacherSrc.indexOf('\n// ============================================\n// Mock 薪资模板', ruleStart);
write(
  'src/domain/teacher-salary.ts',
  `import type { TeacherUIModel, SalaryRuleConfig } from '@/types/teacher';

${teacherSrc.slice(calcStart, calcEnd).trim()}

${teacherSrc.slice(ruleStart, ruleEnd).trim()}
`,
);

// ---------- auth register mocks ----------
{
  let c = read('src/services/auth.ts');
  c = c.replace(
    /if \(isUseMock\(\)\) return mockRegisterStep1\(([^;]+)\);/,
    'if (isUseMock()) { const { mockRegisterStep1 } = await loadAuthMock(); return mockRegisterStep1($1); }',
  );
  c = c.replace(
    /if \(isUseMock\(\)\) \{\n    return mockRegisterStep1\(normalized, 'phone-register', undefined\);\n  \}/,
    `if (isUseMock()) {
    const { mockRegisterStep1ByPhone } = await loadAuthMock();
    return mockRegisterStep1ByPhone(normalized, password.trim());
  }`,
  );
  // ensure password param exists
  c = c.replace(
    /export async function registerStep1ByPhone\(phone: string\): Promise<RegisterStep1Result>/,
    'export async function registerStep1ByPhone(\n  phone: string,\n  password: string,\n): Promise<RegisterStep1Result>',
  );
  c = c.replace(
    /if \(isUseMock\(\)\) return mockRegisterStep2\(([^;]+)\);/,
    'if (isUseMock()) { const { mockRegisterStep2 } = await loadAuthMock(); return mockRegisterStep2($1); }',
  );
  c = c.replace(
    /if \(isUseMock\(\)\) return mockRegisterStep3\(([^;]+)\);/,
    'if (isUseMock()) { const { mockRegisterStep3 } = await loadAuthMock(); return mockRegisterStep3($1); }',
  );
  write('src/services/auth.ts', c);
}

// ---------- audit-log ----------
{
  let c = read('src/services/audit-log.ts');
  c = c.replace(
    'return addAuditLog(input);',
    'const { addAuditLog } = await loadAuditLogMock();\n    return addAuditLog(input);',
  );
  c = c.replace(
    'return queryAuditLogs(safeQuery);',
    'const { queryAuditLogs } = await loadAuditLogMock();\n      return queryAuditLogs(safeQuery);',
  );
  write('src/services/audit-log.ts', c);
}

// ---------- campus / student / data-center: add async to methods with await ----------
function addAsyncToAwaitMethods(rel) {
  let c = read(rel);
  // Pattern: name: (args) => await/expression with await
  c = c.replace(
    /^(\s{2}(?:[a-zA-Z][a-zA-Z0-9]*): )(?!async )(\([^)]*\)(?:: [^=]+)? =>[\s\S]*?await )/gm,
    (full, prefix, rest) => {
      // only if this method body contains await and isn't already async
      return `${prefix}async ${rest}`;
    },
  );
  // Also: name: async missing for one-liners like getById: async (id) => (await cm())...
  // Fix non-async arrow that starts with await on same or next line
  c = c.replace(
    /^(\s{2}[a-zA-Z][a-zA-Z0-9]*: )\(([^)]*)\)(: [^=]+)? =>(\s*\(await )/gm,
    '$1async ($2)$3 =>$4',
  );
  c = c.replace(
    /^(\s{2}[a-zA-Z][a-zA-Z0-9]*: )\(([^)]*)\)(: [^=]+)? =>(\s*await )/gm,
    '$1async ($2)$3 =>$4',
  );
  write(rel, c);
}

addAsyncToAwaitMethods('src/services/campus.ts');
addAsyncToAwaitMethods('src/services/student.ts');
addAsyncToAwaitMethods('src/services/data-center.ts');

// ---------- statistics fallbacks: Promise return types ----------
{
  let c = read('src/services/statistics.ts');
  const map = [
    ['getLessonTrendFallback(): ChartDataItem[]', 'getLessonTrendFallback(): Promise<ChartDataItem[]>'],
    ['getIncomeTrendFallback(): ChartDataItem[]', 'getIncomeTrendFallback(): Promise<ChartDataItem[]>'],
    [
      'getLessonRankFallback(): { label: string; value: number; unit: string }[]',
      'getLessonRankFallback(): Promise<{ label: string; value: number; unit: string }[]>',
    ],
    [
      'getPaymentRankFallback(): { label: string; value: number; unit: string }[]',
      'getPaymentRankFallback(): Promise<{ label: string; value: number; unit: string }[]>',
    ],
    ['getParentTrendFallback(): ChartDataItem[]', 'getParentTrendFallback(): Promise<ChartDataItem[]>'],
    [
      'getExpenseRatiosFallback(): { label: string; ratio: number; barClass: string }[]',
      'getExpenseRatiosFallback(): Promise<{ label: string; ratio: number; barClass: string }[]>',
    ],
    ['getOperationKpiFallback(): OperationKpiItem', 'getOperationKpiFallback(): Promise<OperationKpiItem>'],
    ['getFinanceKpiFallback(): FinanceKpiItem', 'getFinanceKpiFallback(): Promise<FinanceKpiItem>'],
    ['getTeacherRankFallback(): RankFallbackItem[]', 'getTeacherRankFallback(): Promise<RankFallbackItem[]>'],
    ['getCampusRankFallback(): RankFallbackItem[]', 'getCampusRankFallback(): Promise<RankFallbackItem[]>'],
  ];
  for (const [a, b] of map) c = c.replace(a, b);
  // ensure callers await getCompareFallback / getFinanceAnalysisComputedFallback inside service methods
  c = c.replace(
    /return getCompareFallback\(\);/g,
    'return await getCompareFallback();',
  );
  c = c.replace(
    /return getFinanceAnalysisComputedFallback\(\);/g,
    'return await getFinanceAnalysisComputedFallback();',
  );
  c = c.replace(
    /: getCompareFallback\(\)/g,
    ': await getCompareFallback()',
  );
  c = c.replace(
    /: getFinanceAnalysisComputedFallback\(\)/g,
    ': await getFinanceAnalysisComputedFallback()',
  );
  write('src/services/statistics.ts', c);
}

// ---------- data-center-mock types ----------
{
  let c = read('src/package-statistics/data/data-center-mock.ts');
  c = c.replace(
    /import type \{[\s\S]*?\} from '@\/data\/data-center';/,
    `import type {
  CardDataType,
  CardDetailType,
  FinanceDataType,
  FinanceDetailType,
  MemberDataType,
  MemberDetailType,
  SalaryDataType,
  SalaryDetailType,
  TransactionRecordType,
  VenueOverviewType,
  RevenueTrendType,
  ExpenseCategoryType,
  IncomeCategoryType,
} from '@/data/data-center';`,
  );
  c = c.replace(
    /export type \{[\s\S]*?\};/,
    `export type {
  CardDataType,
  CardDetailType,
  FinanceDataType,
  FinanceDetailType,
  MemberDataType,
  MemberDetailType,
  SalaryDataType,
  SalaryDetailType,
  TransactionRecordType,
  VenueOverviewType,
  RevenueTrendType,
  ExpenseCategoryType,
  IncomeCategoryType,
};`,
  );
  // fix mockCreateLedgerCategory signature to match service
  c = c.replace(
    /export async function mockCreateLedgerCategory\(_input: \{\n  name: string;\n  ledgerType: 'expense' \| 'income';\n\}\): Promise<\{ success: boolean \}> \{\n  return \{ success: true \};\n\}/,
    `export async function mockCreateLedgerCategory(input: {
  type: 'expense' | 'income';
  name: string;
}): Promise<ExpenseCategoryType | IncomeCategoryType> {
  return {
    id: \`custom-\${Date.now()}\`,
    name: input.name,
    icon: 'mdi-dots-vertical',
  };
}`,
  );
  write('src/package-statistics/data/data-center-mock.ts', c);
}

console.log('done');
