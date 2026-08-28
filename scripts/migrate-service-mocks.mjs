/**
 * 迁移 teacher / lead service 的 mock 静态 import
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
  console.log('[migrated]', rel);
}

function migrateTeacher() {
  let c = read('src/services/teacher.ts');
  c = c.replace(
    /import \{[\s\S]*?\} from '@\/data\/teacher';\n/,
    `import { loadTeacherMock } from '@/mock/loaders';\nimport { createDefaultSalaryRule } from '@/domain/teacher-salary';\n`,
  );
  c = c.replace(
    /if \(isUseMock\(\)\) return (mock[A-Za-z]+)\(([^;]*)\);/g,
    'if (isUseMock()) { const { $1 } = await loadTeacherMock(); return $1($2); }',
  );
  write('src/services/teacher.ts', c);
}

function migrateLead() {
  let c = read('src/services/lead.ts');
  c = c.replace(/import \{[\s\S]*?\} from '@\/data\/lead';\n/, `import { loadLeadMock } from '@/mock/loaders';\n`);
  c = c.replace(
    /if \(isUseMock\(\)\) return (mock[A-Za-z]+)\(([^;]*)\);/g,
    'if (isUseMock()) { const { $1 } = await loadLeadMock(); return $1($2); }',
  );
  write('src/services/lead.ts', c);
}

migrateTeacher();
migrateLead();
console.log('done');
