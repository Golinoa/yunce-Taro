/**
 * 从 @/data/* 常量池提取 UI 常量到 @/constants/*（UTF-8）
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

function sliceUntilMockMarker(source, startMarker = '// ============================================\n// Mock') {
  const idx = source.indexOf(startMarker);
  return idx > 0 ? source.slice(0, idx).trimEnd() : source;
}

function extractExportBlock(source, exportName) {
  const start = source.indexOf(`export const ${exportName}`);
  if (start < 0) throw new Error(`export ${exportName} not found`);
  let depth = 0;
  let started = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '[' || ch === '{') {
      depth++;
      started = true;
    } else if (ch === ']' || ch === '}') {
      depth--;
      if (started && depth === 0) {
        return source.slice(start, i + 2).replace(/;\s*$/, '');
      }
    }
  }
  throw new Error(`unclosed export ${exportName}`);
}

function extractFunction(source, name) {
  const start = source.indexOf(`export function ${name}`);
  if (start < 0) throw new Error(`function ${name} not found`);
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next > 0 ? next : source.length).trim();
}

// restore HEAD constants that got corrupted
for (const f of [
  'src/constants/subscribe-presets.ts',
  'src/constants/subscribe-presets.test.ts',
  'src/constants/business-categories.ts',
  'src/constants/lead.ts',
]) {
  // use git show via reading restored - git restore these
}

// course-category-ui
const courseCat = sliceUntilMockMarker(read('src/data/course-category.ts'));
write(
  'src/constants/course-category-ui.ts',
  `${courseCat.replace(
    "import type {",
    "/** 课程分类 UI 常量（与 mock 数据分离） */\nimport type {",
  )}\n`,
);

// card-type-ui: constants only (before mock imports usage)
const cardTypeSrc = read('src/data/card-type.ts');
const cardTypeConstsEnd = cardTypeSrc.indexOf('// ============================================\n// Mock');
const cardTypeConsts = cardTypeSrc.slice(0, cardTypeConstsEnd).replace(
  "import { DEFAULT_CATEGORY_IDS } from '@/data/course-category';\nimport { SUBJECTS } from '@/data/mock-database';\n",
  '',
);
write(
  'src/constants/card-type-ui.ts',
  `${cardTypeConsts.replace(
    '/**\n * 卡种（会员卡模板）Mock 数据层',
    '/**\n * 卡种 UI 常量',
  ).replace(/联调时[\s\S]*?\*\/\n\n/, ' */\n\n')}`,
);

// campus-ui
const campusSrc = read('src/data/campus.ts');
const campusConsts = campusSrc.slice(0, campusSrc.indexOf('// ============================================\n// Mock'));
write(
  'src/constants/campus-ui.ts',
  `${campusConsts
    .replace('Mock 数据层', 'UI 常量')
    .replace(/联调[\s\S]*?\*\/\n\nimport type/, ' */\n\nimport type')
    .replace(/^import[\s\S]*?from '@\/types\/campus';\n\n/, "import type { CampusType, PartnerMode } from '@/types/campus';\n\n")}`,
);

// teacher-ui
const teacherSrc = read('src/data/teacher.ts');
const teacherConsts = teacherSrc.slice(0, teacherSrc.indexOf('// ============================================\n// Mock'));
write(
  'src/constants/teacher-ui.ts',
  `${teacherConsts
    .replace('Mock 数据层', 'UI 常量')
    .replace(/^import[\s\S]*?from '@\/types\/teacher';\n\n/, "import type { TeacherIdentity } from '@/types/teacher';\n\n")}`,
);

// course-template-ui
const tplSrc = read('src/data/course-template.ts');
const tplConsts = tplSrc.slice(0, tplSrc.indexOf('// ============================================\n// Mock'));
write(
  'src/constants/course-template-ui.ts',
  `${tplConsts
    .replace('Mock 数据层', 'UI 常量')
    .replace(/^import[\s\S]*?from '@\/types\/course-template';\n\n/, "import type { CheckinRole, CourseCategory, CourseCategoryItem } from '@/types/course-template';\n\n")}`,
);

// home-ui
const homeSrc = read('src/data/home.ts');
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
${extractExportBlock(homeSrc, 'HOME_QUICK_ENTRIES')};
`,
);

// teacher-salary domain
write(
  'src/domain/teacher-salary.ts',
  `import type { TeacherUIModel, SalaryRuleConfig } from '@/types/teacher';

${extractFunction(teacherSrc, 'calcTotal')}

${extractFunction(teacherSrc, 'createDefaultSalaryRule')}
`,
);

console.log('done');
