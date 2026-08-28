/**
 * 迁移 teacher.ts / lead.ts 动态 mock
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function migrateTeacher() {
  const file = path.join(root, 'src/services/teacher.ts');
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/import \{[\s\S]*?\} from '@\/data\/teacher';\r?\n/, '');
  c = c.replace(
    /const USE_MOCK =[\s\S]*?;\r?\n\r?\n/,
    '',
  );
  if (!c.includes("loadTeacherMock")) {
    c = c.replace(
      "import dayjs from 'dayjs';",
      `import dayjs from 'dayjs';
import { createDefaultSalaryRule } from '@/domain/teacher-salary';
import { isUseMock } from '@/utils/build-env';
import { loadTeacherMock } from '@/utils/mock-loaders';`,
    );
  }
  c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');
  c = c.replace(
    /if \(isUseMock\(\)\) return (mock[A-Za-z]+)\(([^;]*)\);/g,
    'if (isUseMock()) { const { $1 } = await loadTeacherMock(); return $1($2); }',
  );
  c = c.replace(
    /if \(isUseMock\(\)\) \{\r?\n(\s*)return (mock[A-Za-z]+)\(([^)]*)\);\r?\n\s*\}/g,
    'if (isUseMock()) {\n    const { $2 } = await loadTeacherMock();\n    return $2($3);\n  }',
  );
  fs.writeFileSync(file, c, 'utf8');
  console.log('[ok] teacher.ts');
}

function migrateLead() {
  const file = path.join(root, 'src/services/lead.ts');
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/import \{[\s\S]*?\} from '@\/data\/lead';\r?\n/, '');
  c = c.replace(/const USE_MOCK =[\s\S]*?;\r?\n\r?\n/, '');
  if (!c.includes('loadLeadMock')) {
    c = c.replace(
      /import type \{ TrialCourseSlot \} from '@\/data\/lead';\r?\n/,
      `import type { TrialCourseSlot } from '@/data/lead';
import { isUseMock } from '@/utils/build-env';
import { loadLeadMock } from '@/utils/mock-loaders';
`,
    );
    if (!c.includes('loadLeadMock')) {
      c = c.replace(
        "import type { TrialCourseSlot } from '@/data/lead';",
        `import type { TrialCourseSlot } from '@/data/lead';
import { isUseMock } from '@/utils/build-env';
import { loadLeadMock } from '@/utils/mock-loaders';`,
      );
    }
  }
  c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');
  c = c.replace(
    /if \(isUseMock\(\)\) return (mock[A-Za-z]+)\(([^;]*)\);/g,
    'if (isUseMock()) { const { $1 } = await loadLeadMock(); return $1($2); }',
  );
  fs.writeFileSync(file, c, 'utf8');
  console.log('[ok] lead.ts');
}

migrateTeacher();
migrateLead();
