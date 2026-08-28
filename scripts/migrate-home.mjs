import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/home.ts');
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('ensureHomeMockDb')) {
  c = c.replace(
    'type HomeMockDb = Awaited<ReturnType<typeof loadMockDatabase>>;',
    `type HomeMockDb = Awaited<ReturnType<typeof loadMockDatabase>>;
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
}

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
  'mockGetStudentsByParent',
  'mockGetSchedulesByStudent',
  'mockGetRecordsByStudent',
  'mockGetPackagesByStudent',
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

// ensure db loaded before mapping schedules
c = c.replace(
  /return \(await \(await loadHomeMock\(\)\)\.mockGetTodaySchedules\(teacherId, campusId\)\)\.map\(mapTodaySchedule\);/,
  'await ensureHomeMockDb();\n      return (await (await loadHomeMock()).mockGetTodaySchedules(teacherId, campusId)).map(mapTodaySchedule);',
);
c = c.replace(
  /return \(await \(await loadHomeMock\(\)\)\.mockGetRecentGroups\(teacherId, campusId\)\)\.map\(mapRecentGroup\);/,
  'await ensureHomeMockDb();\n      return (await (await loadHomeMock()).mockGetRecentGroups(teacherId, campusId)).map(mapRecentGroup);',
);

// async wrappers for direct mock returns
c = c.replace(
  /getStudents: \(teacherId: string, limit\?: number\) => \(await loadHomeMock\(\)\)\.mockGetStudents\(teacherId, limit\),/,
  'getStudents: async (teacherId: string, limit?: number) => (await loadHomeMock()).mockGetStudents(teacherId, limit),',
);
c = c.replace(
  /getRecentRecords: \(teacherId: string, limit\?: number, campusId\?: string\) =>\n    \(await loadHomeMock\(\)\)\.mockGetRecentRecords/,
  'getRecentRecords: async (teacherId: string, limit?: number, campusId?: string) =>\n    (await loadHomeMock()).mockGetRecentRecords',
);
c = c.replace(
  /getStudentPackages: \(studentId: string\) => \(await loadHomeMock\(\)\)\.mockGetStudentPackages/,
  'getStudentPackages: async (studentId: string) => (await loadHomeMock()).mockGetStudentPackages',
);
c = c.replace(
  /getTotalRemainingHours: \(teacherId: string\) => \(await loadHomeMock\(\)\)\.mockGetTotalRemainingHours/,
  'getTotalRemainingHours: async (teacherId: string) => (await loadHomeMock()).mockGetTotalRemainingHours',
);
c = c.replace(
  /getTodayRecordCount: \(teacherId: string, campusId\?: string\) =>\n    \(await loadHomeMock\(\)\)\.mockGetTodayRecordCount/,
  'getTodayRecordCount: async (teacherId: string, campusId?: string) =>\n    (await loadHomeMock()).mockGetTodayRecordCount',
);
c = c.replace(
  /getStudentsByParent: \(parentId: string\) => \(await loadHomeMock\(\)\)\.mockGetStudentsByParent/,
  'getStudentsByParent: async (parentId: string) => (await loadHomeMock()).mockGetStudentsByParent',
);
c = c.replace(
  /getSchedulesByStudent: \(studentId: string\) => \(await loadHomeMock\(\)\)\.mockGetSchedulesByStudent/,
  'getSchedulesByStudent: async (studentId: string) => (await loadHomeMock()).mockGetSchedulesByStudent',
);
c = c.replace(
  /getRecordsByStudent: \(studentId: string, limit\?: number\) =>\n    \(await loadHomeMock\(\)\)\.mockGetRecordsByStudent/,
  'getRecordsByStudent: async (studentId: string, limit?: number) =>\n    (await loadHomeMock()).mockGetRecordsByStudent',
);
c = c.replace(
  /getPackagesByStudent: \(studentId: string\) => \(await loadHomeMock\(\)\)\.mockGetPackagesByStudent/,
  'getPackagesByStudent: async (studentId: string) => (await loadHomeMock()).mockGetPackagesByStudent',
);

fs.writeFileSync(file, c, 'utf8');
console.log('home migrated');
