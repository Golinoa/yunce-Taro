import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/home.ts');
let c = fs.readFileSync(file, 'utf8');

if (c.includes('loadHomeMock')) {
  console.log('home already migrated');
  process.exit(0);
}

// Step 1: remove mock-database import before touching CLASSES symbol
c = c.replace(
  /import \{ CLASSES, COURSE_PACKAGES, LESSON_RECORDS, STUDENTS, TEACHERS \} from '@\/data\/mock-database';\r?\n/,
  '',
);

// Step 2: replace value imports from @/data/home, keep type imports
c = c.replace(
  /import \{\r?\n[\s\S]*?HOME_QUICK_ENTRIES,\r?\n\} from '@\/data\/home';\r?\n/,
  `import { HOME_QUICK_ENTRIES } from '@/constants/home-ui';
import { loadHomeMock, loadMockDatabase } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
`,
);

c = c.replace(
  /const USE_MOCK =\r?\n  typeof process !== 'undefined' && typeof process\.env !== 'undefined'\r?\n    \? process\.env\.VITE_USE_MOCK !== 'false'\r?\n    : true;\r?\n\r?\n/,
  '',
);

c = c.replace(
  'type RawHomeTeacher = NonNullable<Awaited<ReturnType<typeof mockGetTeacher>>>;',
  `type RawHomeTeacher = {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string;
  status?: string;
  totalHours?: number;
  monthHours?: number;
  pendingSalary?: number;
};
type HomeMockDb = Awaited<ReturnType<typeof loadMockDatabase>>;
let homeMockDb: HomeMockDb | null = null;

async function ensureHomeMockDb(): Promise<HomeMockDb> {
  homeMockDb ??= await loadMockDatabase();
  return homeMockDb;
}

function db(): HomeMockDb {
  if (!homeMockDb) throw new Error('home mock db not loaded');
  return homeMockDb;
}`,
);

c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');

// Step 3: replace DB symbols in function bodies only (not in import lines)
c = c.replace(/\bCLASSES\b/g, 'db().CLASSES');
c = c.replace(/\bTEACHERS\b/g, 'db().TEACHERS');
c = c.replace(/\bLESSON_RECORDS\b/g, 'db().LESSON_RECORDS');
c = c.replace(/\bCOURSE_PACKAGES\b/g, 'db().COURSE_PACKAGES');
c = c.replace(/\bSTUDENTS\b/g, 'db().STUDENTS');

const mockFns = [
  'mockGetTeacher',
  'mockGetStudents',
  'mockGetTodaySchedules',
  'mockGetRecentRecords',
  'mockGetStudentPackages',
  'mockGetTotalRemainingHours',
  'mockGetUnreadCount',
  'mockGetTodayRecordCount',
  'mockGetSchedulesByStudent',
  'mockGetStatsByPeriod',
  'mockGetRecentGroups',
  'mockGetOperationContent',
];
for (const fn of mockFns) {
  c = c.replace(new RegExp(`\\b${fn}\\(`, 'g'), `(await loadHomeMock()).${fn}(`);
}
c = c.replace(/mockHomeGetStudentsByParent\(/g, '(await loadHomeMock()).mockGetStudentsByParent(');
c = c.replace(/mockHomeGetRecordsByStudent\(/g, '(await loadHomeMock()).mockGetRecordsByStudent(');
c = c.replace(/mockHomeGetPackagesByStudent\(/g, '(await loadHomeMock()).mockGetPackagesByStudent(');

c = c.replace(
  /if \(isUseMock\(\)\) \{\r?\n      const teacher = await \(await loadHomeMock\(\)\)\.mockGetTeacher\(userId\);/,
  'if (isUseMock()) {\n      const { mockGetTeacher } = await loadHomeMock();\n      const teacher = await mockGetTeacher(userId);',
);
c = c.replace(
  /return \(await \(await loadHomeMock\(\)\)\.mockGetTodaySchedules\(teacherId, campusId\)\)\.map\(mapTodaySchedule\);/,
  'await ensureHomeMockDb();\n      const { mockGetTodaySchedules } = await loadHomeMock();\n      return (await mockGetTodaySchedules(teacherId, campusId)).map(mapTodaySchedule);',
);
c = c.replace(
  /return \(await \(await loadHomeMock\(\)\)\.mockGetRecentGroups\(teacherId, campusId\)\)\.map\(mapRecentGroup\);/,
  'await ensureHomeMockDb();\n      const { mockGetRecentGroups } = await loadHomeMock();\n      return (await mockGetRecentGroups(teacherId, campusId)).map(mapRecentGroup);',
);
c = c.replace(
  /return \(await loadHomeMock\(\)\)\.mockGetUnreadCount\(userId\);/,
  'const { mockGetUnreadCount } = await loadHomeMock();\n      return mockGetUnreadCount(userId);',
);

for (const name of [
  'getStudents',
  'getRecentRecords',
  'getStudentPackages',
  'getTotalRemainingHours',
  'getTodayRecordCount',
  'getStudentsByParent',
  'getSchedulesByStudent',
  'getRecordsByStudent',
  'getPackagesByStudent',
]) {
  c = c.replace(new RegExp(`${name}: \\(`), `${name}: async (`);
}

fs.writeFileSync(file, c, 'utf8');
console.log('home migrated');
