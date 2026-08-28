import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/student.ts');
let c = fs.readFileSync(file, 'utf8');

if (c.includes('loadStudentsMock')) {
  console.log('student already migrated');
  process.exit(0);
}

c = c.replace(
  /import \{\r?\n  CLASSES as DB_CLASSES,\r?\n  COURSE_PACKAGES as DB_PACKAGES,\r?\n  STUDENTS as DB_STUDENTS,\r?\n  TEACHERS as DB_TEACHERS,\r?\n  getScheduledClassIdSet,\r?\n\} from '@\/data\/mock-database';\r?\nimport \{[\s\S]*?\} from '@\/data\/students';\r?\n/,
  `import { loadMockDatabase, loadStudentsMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
`,
);

const helper = `type StudentsMockModule = Awaited<ReturnType<typeof loadStudentsMock>>;
type MockDbModule = Awaited<ReturnType<typeof loadMockDatabase>>;
let studentsMockModule: StudentsMockModule | undefined;
let mockDbModule: MockDbModule | undefined;

async function getStudentsMock(): Promise<StudentsMockModule> {
  studentsMockModule ??= await loadStudentsMock();
  return studentsMockModule;
}

async function ensureMockDb(): Promise<MockDbModule> {
  mockDbModule ??= await loadMockDatabase();
  return mockDbModule;
}

function getMockDb(): MockDbModule {
  if (!mockDbModule) throw new Error('mock database not loaded');
  return mockDbModule;
}

`;

c = c.replace('import type { Class }', `${helper}import type { Class }`);

c = c.replace(/\bDB_CLASSES\b/g, 'getMockDb().CLASSES');
c = c.replace(/\bDB_PACKAGES\b/g, 'getMockDb().COURSE_PACKAGES');
c = c.replace(/\bDB_STUDENTS\b/g, 'getMockDb().STUDENTS');
c = c.replace(/\bDB_TEACHERS\b/g, 'getMockDb().TEACHERS');
c = c.replace(/\bgetScheduledClassIdSet\(\)/g, 'getMockDb().getScheduledClassIdSet()');

c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');
c = c.replace(
  /const isUseMock\(\) =[\s\S]*?;\r?\n\r?\n/,
  '',
);
c = c.replace(
  /const USE_MOCK =[\s\S]*?;\r?\n\r?\n/,
  '',
);

c = c.replace(/\b(mock[A-Z][A-Za-z]*)\(/g, '(await getStudentsMock()).$1(');
c = c.replace(/\bpickBestPackage\(/g, '(await getStudentsMock()).pickBestPackage(');

c = c.replace(/export \{ formatDateCN \};\r?\n?/, "export { formatDateCN } from '@/utils/format';\n");

// inject ensureMockDb in mock branches
c = c.replace(
  /(\n    if \(isUseMock\(\)\) \{\r?\n)(    return \(await getStudentsMock\(\)\)\.)/g,
  '$1    await ensureMockDb();\n$2',
);

if (c.includes("from '@/data/students'") || c.includes("from '@/data/mock-database'")) {
  console.error('student migration incomplete');
  process.exit(1);
}

fs.writeFileSync(file, c, 'utf8');
console.log('student migrated');
