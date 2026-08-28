/**
 * 重新生成纯 UI 常量文件（不含 mock），并迁移页面/组件引用
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
  console.log('[write]', rel);
}

function sliceConsts(source, mockMarker = '// ============================================\n// Mock') {
  const idx = source.indexOf(mockMarker);
  return (idx > 0 ? source.slice(0, idx) : source).trimEnd();
}

// ---- course-category-ui ----
{
  const src = read('src/data/course-category.ts');
  const body = sliceConsts(src)
    .replace(/^\/\*\*[\s\S]*?\*\/\n/, '')
    .replace(/import type \{[\s\S]*?\} from '@\/types\/course-category';/, '');
  write(
    'src/constants/course-category-ui.ts',
    `/** 课程分类 UI 常量（与 mock 数据分离） */
import type {
  CategoryAutoCheckinValue,
  CategoryTimeValue,
  CourseCategoryMode,
} from '@/types/course-category';

${body}
`,
  );
}

// ---- card-type-ui ----
{
  const src = read('src/data/card-type.ts');
  const body = sliceConsts(src)
    .replace(/^\/\*\*[\s\S]*?\*\/\n\n/, '')
    .replace(/import \{ DEFAULT_CATEGORY_IDS \} from '@\/data\/course-category';\n/, '')
    .replace(/import \{ SUBJECTS \} from '@\/data\/mock-database';\n/, '')
    .replace(/import type \{[\s\S]*?\} from '@\/types\/card-type';\n/, '');
  write(
    'src/constants/card-type-ui.ts',
    `/** 卡种 UI 常量（与 mock 数据分离） */
import type {
  CardTypeBookingMethod,
  CardTypeCategory,
  CardTypeKind,
  CardTypeScope,
  CardTypeStatus,
} from '@/types/card-type';

${body}
`,
  );
}

// ---- course-template-ui ----
{
  const src = read('src/data/course-template.ts');
  const body = sliceConsts(src)
    .replace(/^\/\*\*[\s\S]*?\*\/\n/, '')
    .replace(/import \{ DEFAULT_CATEGORY_IDS \} from '@\/data\/course-category';\n/, '')
    .replace(/import type \{[\s\S]*?\} from '@\/types\/course-template';\n/, '');
  write(
    'src/constants/course-template-ui.ts',
    `/** 课程模板 UI 常量（与 mock 数据分离） */
import type { CheckinRole, CourseCategory, CourseCategoryItem } from '@/types/course-template';

${body}
`,
  );
}

// ---- teacher-ui（仅常量池至 Mock 前） ----
{
  const src = read('src/data/teacher.ts');
  const start = src.indexOf('// ============================================\n// 常量池');
  const end = src.indexOf('// ============================================\n// Mock');
  const consts = src.slice(start, end).trim();
  write(
    'src/constants/teacher-ui.ts',
    `/** 教师/薪资 UI 常量（与 mock 数据分离） */
import type { TeacherIdentity } from '@/types/teacher';

${consts.replace(/^\/\/ =+\\n\/\/ 常量池\\n\/\/ =+\\n\\n/, '')}
`,
  );
}

// ---- campus-ui already OK; ensure no mock ----
// already written earlier

// ---- schedule-category：生产不依赖 mock ----
write(
  'src/utils/schedule-category.ts',
  `/**
 * 今日课表 / 排课卡片：解析课程分类展示名（生产包不依赖 mock-database）
 */
import { CATEGORY_MODE_LABEL } from '@/constants/course-category-ui';
import { isUseMock } from '@/utils/build-env';
import type { CourseCategoryMode } from '@/types/course-category';

/** 按班级关联的分类 ID 解析名称（生产环境依赖 API 返回的 categoryLabel） */
export function resolveCategoryLabelByClassId(classId?: string): string | undefined {
  if (!classId || !isUseMock()) return undefined;
  // mock 模式下由 schedule-category-mock 增强；此处保持无静态 mock 依赖
  return undefined;
}

/** 按分类 ID 直接解析（生产环境走 API） */
export function resolveCategoryLabelByCategoryId(_categoryId?: string): string | undefined {
  return undefined;
}

/** 无班级关联时，按模式回退到系统内置分类名 */
export function resolveCategoryLabelByMode(mode?: CourseCategoryMode): string | undefined {
  if (!mode) return undefined;
  return CATEGORY_MODE_LABEL[mode];
}
`,
);

// ---- batch import rewrites ----
const replacements = [
  // campus
  ["from '@/data/campus'", "from '@/constants/campus-ui'"],
  // teacher UI consts / domain
  [
    "import { createDefaultSalaryRule } from '@/data/teacher'",
    "import { createDefaultSalaryRule } from '@/domain/teacher-salary'",
  ],
  [
    "import { calcTotal } from '@/data/teacher'",
    "import { calcTotal } from '@/domain/teacher-salary'",
  ],
  ["from '@/data/teacher'", "from '@/constants/teacher-ui'"],
  // course-category
  ["from '@/data/course-category'", "from '@/constants/course-category-ui'"],
  // course-template
  ["from '@/data/course-template'", "from '@/constants/course-template-ui'"],
  // card-type
  ["from '@/data/card-type'", "from '@/constants/card-type-ui'"],
  // onboarding
  [
    "import { markStepVisited } from '@/data/onboarding'",
    "import { markStepVisited } from '@/utils/onboarding-storage'",
  ],
  // venue manager
  [
    "import { DEFAULT_VENUE_MANAGER_USER_ID } from '@/data/mock-database'",
    "import { DEFAULT_VENUE_MANAGER_USER_ID } from '@/constants/campus-ui'",
  ],
];

const targets = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'data' || ent.name === 'node_modules' || ent.name === 'mock-stub') continue;
      walk(p);
    } else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.test.ts')) {
      targets.push(p);
    }
  }
}
walk(path.join(root, 'src'));

let changed = 0;
for (const file of targets) {
  // skip regenerating constants themselves for data-path rewrites that could loop
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel.startsWith('src/data/')) continue;
  let c = fs.readFileSync(file, 'utf8');
  let next = c;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  if (next !== c) {
    fs.writeFileSync(file, next, 'utf8');
    changed++;
    console.log('[migrate]', rel);
  }
}
console.log('migrated files:', changed);
