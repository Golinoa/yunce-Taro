/**
 * 从 src/data 扫描 export，生成生产包用的空 stub（供 webpack 替换 mock 模块）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stubDir = path.join(root, 'src', 'mock-stub');
const dataDir = path.join(root, 'src', 'data');

/** 生产构建时整文件替换为 stub 的 mock 模块（相对 src/data） */
const MOCK_MODULES = [
  'mock-database',
  'auth',
  'home',
  'students',
  'lead',
  'class-booking',
  'course-template',
  'course-category',
  'follow-records',
  'my-course',
  'member-card',
  'statistics',
  'organization',
  'campus-invite',
  'store-entry',
  'subscribe-message',
  'feedback',
  'audit-log',
  'venue-booking',
  'campus',
  'teacher',
  'card-type',
  'lesson-debt',
  'custom-todos',
  'onboarding',
  'data-center',
  'mock/index',
  'mock/statistics-base',
];

const EXTRA_MODULES = [
  {
    rel: 'package-statistics/data/data-center-mock.ts',
    out: 'data-center-mock.ts',
  },
];

function extractExports(content) {
  const fns = [];
  const asyncFns = [];
  const consts = [];
  const types = [];

  for (const m of content.matchAll(/export async function (\w+)/g)) asyncFns.push(m[1]);
  for (const m of content.matchAll(/export function (\w+)/g)) fns.push(m[1]);
  for (const m of content.matchAll(/export const (\w+)/g)) consts.push(m[1]);
  for (const m of content.matchAll(/export type (\w+)/g)) types.push(m[1]);
  for (const m of content.matchAll(/export interface (\w+)/g)) types.push(m[1]);
  // export { a, b as c } / 多行 re-export（按函数 stub）
  for (const m of content.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && /^[\w$]+$/.test(name) && !asyncFns.includes(name) && !fns.includes(name)) {
        asyncFns.push(name);
      }
    }
  }

  return { fns, asyncFns, consts, types };
}

function stubBody({ fns, asyncFns, consts }) {
  const lines = [
    '/** AUTO-GENERATED — 生产构建占位，勿手动编辑。生成：npm run generate:mock-stubs */',
    '/* eslint-disable @typescript-eslint/no-explicit-any */',
    '',
  ];

  for (const name of consts) {
    if (name === 'TEST_PASSWORD') {
      lines.push(`export const ${name} = '';`);
    } else if (/^(NOW|CUR_)/.test(name)) {
      lines.push(`export const ${name} = new Date();`);
    } else if (name.endsWith('_MAP') || name.includes('MAP') || name.includes('OPTIONS') || name.includes('LABEL')) {
      lines.push(`export const ${name}: Record<string, unknown> = {};`);
    } else {
      lines.push(`export const ${name}: unknown[] = [];`);
    }
  }

  for (const name of [...asyncFns, ...fns]) {
    lines.push(`export async function ${name}(..._args: any[]): Promise<any> { return null; }`);
  }

  lines.push('');
  return lines.join('\n');
}

function generateStub(sourcePath, outName) {
  if (!fs.existsSync(sourcePath)) {
    console.warn(`[skip] missing ${sourcePath}`);
    return;
  }
  const content = fs.readFileSync(sourcePath, 'utf8');
  const exports = extractExports(content);
  const outPath = path.join(stubDir, outName);
  fs.writeFileSync(outPath, stubBody(exports), 'utf8');
  console.log(`[stub] ${outName} (${exports.asyncFns.length + exports.fns.length} fn, ${exports.consts.length} const)`);
}

fs.mkdirSync(stubDir, { recursive: true });

for (const mod of MOCK_MODULES) {
  const rel = mod.includes('/') ? `${mod}.ts` : `${mod}.ts`;
  const sourcePath = path.join(dataDir, rel.replace(/^mock\//, 'mock/'));
  const outName = mod.replace(/\//g, '-') + '.ts';
  generateStub(path.join(dataDir, `${mod}.ts`), outName);
}

for (const { rel, out } of EXTRA_MODULES) {
  generateStub(path.join(root, 'src', rel), out);
}

// schedule-category mock helper
fs.writeFileSync(
  path.join(stubDir, 'schedule-category-mock.ts'),
  `/** AUTO-GENERATED stub */
export function resolveCategoryLabelByClassIdImpl(_classId: string): string | undefined {
  return undefined;
}
export function resolveCategoryLabelByCategoryIdImpl(_categoryId: string): string | undefined {
  return undefined;
}
`,
  'utf8',
);

console.log('[generate-mock-stubs] done');
