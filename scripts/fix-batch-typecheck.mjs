/**
 * 批量修复 mock 迁移遗留：常量文件、async、auth register
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

// --- home-ui ---
const homeSrc = read('src/data/home.ts');
const hq = homeSrc.match(/export const HOME_QUICK_ENTRIES: QuickEntry\[\] = \[[\s\S]*?\];/);
if (!hq) throw new Error('HOME_QUICK_ENTRIES not found');
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
${hq[0].replace('QuickEntry[]', 'HomeQuickEntry[]')}
`,
);

// --- campus-ui ---
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

// --- teacher-salary: keep only calcTotal + createDefaultSalaryRule ---
const domain = read('src/domain/teacher-salary.ts');
const calc = domain.match(/export function calcTotal[\s\S]*?^}/m);
const create = domain.match(/export function createDefaultSalaryRule[\s\S]*?^}/m);
if (!calc || !create) throw new Error('teacher-salary extract failed');
write(
  'src/domain/teacher-salary.ts',
  `import type { TeacherUIModel, SalaryRuleConfig } from '@/types/teacher';

${calc[0]}

${create[0]}
`,
);

// --- auth register mocks ---
let auth = read('src/services/auth.ts');
auth = auth.replace(
  /if \(isUseMock\(\)\) return mockRegisterStep1\(([^;]+)\);/,
  'if (isUseMock()) { const { mockRegisterStep1 } = await loadAuthMock(); return mockRegisterStep1($1); }',
);
auth = auth.replace(
  /if \(isUseMock\(\)\) \{\n    return mockRegisterStep1\(normalized, 'phone-register', undefined\);\n  \}/,
  `if (isUseMock()) {
    const { mockRegisterStep1ByPhone } = await loadAuthMock();
    return mockRegisterStep1ByPhone(normalized, password.trim());
  }`,
);
auth = auth.replace(
  /export async function registerStep1ByPhone\(phone: string\): Promise<RegisterStep1Result>/,
  'export async function registerStep1ByPhone(phone: string, password = \'\'): Promise<RegisterStep1Result>',
);
auth = auth.replace(
  /if \(isUseMock\(\)\) return mockRegisterStep2\(([^;]+)\);/,
  'if (isUseMock()) { const { mockRegisterStep2 } = await loadAuthMock(); return mockRegisterStep2($1); }',
);
auth = auth.replace(
  /if \(isUseMock\(\)\) return mockRegisterStep3\(([^;]+)\);/,
  'if (isUseMock()) { const { mockRegisterStep3 } = await loadAuthMock(); return mockRegisterStep3($1); }',
);
write('src/services/auth.ts', auth);

// --- audit-log ---
let audit = read('src/services/audit-log.ts');
audit = audit.replace(
  /return addAuditLog\(input\);/,
  'const { addAuditLog } = await loadAuditLogMock();\n    return addAuditLog(input);',
);
audit = audit.replace(
  /return queryAuditLogs\(safeQuery\);/,
  'const { queryAuditLogs } = await loadAuditLogMock();\n      return queryAuditLogs(safeQuery);',
);
write('src/services/audit-log.ts', audit);

// --- fix async on campus / student / data-center methods ---
function addAsyncToAwaitMethods(rel) {
  let c = read(rel);
  // object method: name: (args) => await  OR  name: (args) =>\n    (await
  c = c.replace(
    /^(\s{2})([a-zA-Z][a-zA-Z0-9]*):\s+(\([^)]*\))\s*=>\s*(?=\(await |await )/gm,
    '$1$2: async $3 => ',
  );
  // name: (args): Promise<...> => (await
  c = c.replace(
    /^(\s{2})([a-zA-Z][a-zA-Z0-9]*):\s+(\([^)]*\)):\s*(Promise<[^>]+>)\s*=>\s*(?=\(await |await )/gm,
    '$1$2: async $3: $4 => ',
  );
  // name: (args): Promise =>\n    (await
  c = c.replace(
    /^(\s{2})([a-zA-Z][a-zA-Z0-9]*):\s+(\([^)]*\)):\s*(Promise<[^>]+>)\s*=>\s*\n(\s+)\(await /gm,
    '$1$2: async $3: $4 =>\n$5(await ',
  );
  // name: (args) =>\n    (await
  c = c.replace(
    /^(\s{2})([a-zA-Z][a-zA-Z0-9]*):\s+(\([^)]*\))\s*=>\s*\n(\s+)\(await /gm,
    '$1$2: async $3 =>\n$4(await ',
  );
  // ternary: name: (): Promise =>\n    isUseMock() ? (await
  c = c.replace(
    /^(\s{2})([a-zA-Z][a-zA-Z0-9]*):\s+(\([^)]*\)):\s*(Promise<[^>]+>)\s*=>\s*\n(\s+)isUseMock\(\)/gm,
    '$1$2: async $3: $4 =>\n$5isUseMock()',
  );
  c = c.replace(
    /^(\s{2})([a-zA-Z][a-zA-Z0-9]*):\s+(\([^)]*\))\s*=>\s*\n(\s+)isUseMock\(\)/gm,
    '$1$2: async $3 =>\n$4isUseMock()',
  );
  write(rel, c);
}

addAsyncToAwaitMethods('src/services/campus.ts');
addAsyncToAwaitMethods('src/services/student.ts');
addAsyncToAwaitMethods('src/services/data-center.ts');

// --- statistics fallback return types ---
let stats = read('src/services/statistics.ts');
stats = stats.replace(
  /async function getLessonTrendFallback\(\): ChartDataItem\[\]/g,
  'async function getLessonTrendFallback(): Promise<ChartDataItem[]>',
);
stats = stats.replace(
  /async function getIncomeTrendFallback\(\): ChartDataItem\[\]/g,
  'async function getIncomeTrendFallback(): Promise<ChartDataItem[]>',
);
stats = stats.replace(
  /async function getLessonRankFallback\(\): \{ label: string; value: number; unit: string \}\[\]/g,
  'async function getLessonRankFallback(): Promise<{ label: string; value: number; unit: string }[]>',
);
stats = stats.replace(
  /async function getPaymentRankFallback\(\): \{ label: string; value: number; unit: string \}\[\]/g,
  'async function getPaymentRankFallback(): Promise<{ label: string; value: number; unit: string }[]>',
);
stats = stats.replace(
  /async function getParentTrendFallback\(\): ChartDataItem\[\]/g,
  'async function getParentTrendFallback(): Promise<ChartDataItem[]>',
);
stats = stats.replace(
  /async function getExpenseRatiosFallback\(\): \{ label: string; ratio: number; barClass: string \}\[\]/g,
  'async function getExpenseRatiosFallback(): Promise<{ label: string; ratio: number; barClass: string }[]>',
);
stats = stats.replace(
  /async function getOperationKpiFallback\(\): OperationKpiItem/g,
  'async function getOperationKpiFallback(): Promise<OperationKpiItem>',
);
stats = stats.replace(
  /async function getFinanceKpiFallback\(\): FinanceKpiItem/g,
  'async function getFinanceKpiFallback(): Promise<FinanceKpiItem>',
);
stats = stats.replace(
  /async function getTeacherRankFallback\(\): RankFallbackItem\[\]/g,
  'async function getTeacherRankFallback(): Promise<RankFallbackItem[]>',
);
stats = stats.replace(
  /async function getCampusRankFallback\(\): RankFallbackItem\[\]/g,
  'async function getCampusRankFallback(): Promise<RankFallbackItem[]>',
);
write('src/services/statistics.ts', stats);

console.log('batch fix done');
