/**
 * 重新生成纯 UI 常量（CRLF 安全切片），并修复 schedule-category
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content.replace(/\n/g, '\r\n'), 'utf8');
  console.log('[write]', rel);
}

/** 切到「// Mock」区块之前（含分隔线） */
function sliceBeforeMock(source) {
  const re = /\n\/\/ =+\n\/\/ Mock[^\n]*\n\/\/ =+\n/;
  const m = re.exec(source);
  if (!m) throw new Error('Mock marker not found');
  return source.slice(0, m.index).trimEnd();
}

function extractConstPool(source) {
  const startRe = /\/\/ =+\n\/\/ 常量池\n\/\/ =+\n\n/;
  const m = startRe.exec(source);
  if (!m) throw new Error('常量池 marker not found');
  const from = m.index + m[0].length;
  const beforeMock = sliceBeforeMock(source);
  return beforeMock.slice(from).trimEnd();
}

// ---- course-category-ui ----
{
  const body = extractConstPool(read('src/data/course-category.ts'));
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
  const body = extractConstPool(read('src/data/card-type.ts'));
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
  const body = extractConstPool(read('src/data/course-template.ts'));
  write(
    'src/constants/course-template-ui.ts',
    `/** 课程模板 UI 常量（与 mock 数据分离） */
import type { CheckinRole, CourseCategory, CourseCategoryItem } from '@/types/course-template';

${body}
`,
  );
}

// ---- teacher-ui：仅选项常量至 IDENTITY_TAG_MAP（不含 mock 辅助） ----
{
  const src = read('src/data/teacher.ts');
  const start = src.indexOf('/** 头像颜色池 */');
  const end = src.indexOf('\nconst DEFAULT_IDENTITY_MAP');
  if (start < 0 || end < 0) throw new Error('teacher UI slice markers not found');
  const body = src.slice(start, end).trimEnd();
  write(
    'src/constants/teacher-ui.ts',
    `/** 教师/薪资 UI 常量（与 mock 数据分离） */
import type { TeacherIdentity } from '@/types/teacher';

${body}
`,
  );
}

// ---- schedule-category：prod 无 mock DB；mock 经 schedule-category-mock（可被 stub） ----
write(
  'src/utils/schedule-category.ts',
  `/**
 * 今日课表 / 排课卡片：解析课程分类展示名
 * 用户可自建分类（仍映射 class/group/private 模式），展示应以分类名称为准。
 * 生产构建将 schedule-category-mock 替换为 stub，避免打入 mock-database。
 */
import { CATEGORY_MODE_LABEL } from '@/constants/course-category-ui';
import type { CourseCategoryMode } from '@/types/course-category';
import {
  resolveCategoryLabelByCategoryIdImpl,
  resolveCategoryLabelByClassIdImpl,
} from '@/utils/schedule-category-mock';

/** 按班级关联的分类 ID 解析名称（支持用户自定义分类） */
export function resolveCategoryLabelByClassId(classId?: string): string | undefined {
  if (!classId) return undefined;
  return resolveCategoryLabelByClassIdImpl(classId);
}

/** 按分类 ID 直接解析 */
export function resolveCategoryLabelByCategoryId(categoryId?: string): string | undefined {
  if (!categoryId) return undefined;
  return resolveCategoryLabelByCategoryIdImpl(categoryId);
}

/** 无班级关联时，按模式回退到系统内置分类名 */
export function resolveCategoryLabelByMode(mode?: CourseCategoryMode): string | undefined {
  if (!mode) return undefined;
  return CATEGORY_MODE_LABEL[mode];
}
`,
);

write(
  'src/utils/schedule-category-mock.ts',
  `/**
 * Mock 专用：课表分类名解析（生产构建时由 webpack 替换为 stub）
 */
import { listCourseCategoriesSync } from '@/data/course-category';
import { CLASSES } from '@/data/mock-database';

export function resolveCategoryLabelByClassIdImpl(classId: string): string | undefined {
  const cls = CLASSES.find((item) => item.id === classId);
  if (!cls?.categoryId) return undefined;
  return listCourseCategoriesSync().find((item) => item.id === cls.categoryId)?.name;
}

export function resolveCategoryLabelByCategoryIdImpl(categoryId: string): string | undefined {
  return listCourseCategoriesSync().find((item) => item.id === categoryId)?.name;
}
`,
);

console.log('done');
