/**
 * 批量迁移简单 service：移除 @/data 静态 import，改用 loadXxxMock
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SERVICES = [
  ['src/services/card-type.ts', 'loadCardTypeMock', 'card-type'],
  ['src/services/course-category.ts', 'loadCourseCategoryMock', 'course-category'],
  ['src/services/course-template.ts', 'loadCourseTemplateMock', 'course-template'],
  ['src/services/member-card.ts', 'loadMemberCardMock', 'member-card'],
  ['src/services/lesson-debt.ts', 'loadLessonDebtMock', 'lesson-debt'],
  ['src/services/follow-record.ts', 'loadFollowRecordsMock', 'follow-records'],
  ['src/services/my-course.ts', 'loadMyCourseMock', 'my-course'],
  ['src/services/feedback.ts', 'loadFeedbackMock', 'feedback'],
  ['src/services/audit-log.ts', 'loadAuditLogMock', 'audit-log'],
  ['src/services/store-entry.ts', 'loadStoreEntryMock', 'store-entry'],
  ['src/services/class-booking.ts', 'loadClassBookingMock', 'class-booking'],
  ['src/services/organization.ts', 'loadOrganizationMock', 'organization'],
  ['src/services/campus-invite.ts', 'loadCampusInviteMock', 'campus-invite'],
  ['src/services/venue-booking.ts', 'loadVenueBookingMock', 'venue-booking'],
];

function migrate(rel, loaderFn, dataModule) {
  const file = path.join(root, rel);
  let c = fs.readFileSync(file, 'utf8');

  c = c.replace(
    new RegExp(`import \\{[\\s\\S]*?\\} from '@\\/data\\/${dataModule}';\\r?\\n`, 'g'),
    '',
  );
  c = c.replace(
    /const USE_MOCK =\r?\n  typeof process !== 'undefined' && typeof process\.env !== 'undefined'\r?\n    \? process\.env\.VITE_USE_MOCK !== 'false'\r?\n    : true;\r?\n\r?\n/g,
    '',
  );

  if (!c.includes("from '@/utils/mock-loaders'")) {
    const anchor = c.match(/import type \{[\s\S]*?\} from '@\/types\/[^']+';/);
    if (anchor) {
      c = c.replace(anchor[0], `${anchor[0]}\nimport { ${loaderFn} } from '@/utils/mock-loaders';\nimport { isUseMock } from '@/utils/build-env';`);
    } else {
      c = c.replace(
        /(\/\*\*[\s\S]*?\*\/\r?\n\r?\n)/,
        `$1import { ${loaderFn} } from '@/utils/mock-loaders';\nimport { isUseMock } from '@/utils/build-env';\n`,
      );
    }
  }

  c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');

  // if (!isUseMock()) { ... } \n return mockX(...);
  c = c.replace(
    /if \(!isUseMock\(\)\) \{([\s\S]*?)\}\r?\n(\s*)return (mock[A-Za-z]+)\(([^)]*)\);/g,
    (_, nonMockBody, indent, fn, args) => {
      const body = nonMockBody.trim();
      if (!body || body.startsWith('//')) {
        return `${indent}if (!isUseMock()) {\n${indent}  // TODO: real API\n${indent}}\n${indent}const { ${fn} } = await ${loaderFn}();\n${indent}return ${fn}(${args});`;
      }
      return `if (!isUseMock()) {${nonMockBody}}\n${indent}const { ${fn} } = await ${loaderFn}();\n${indent}return ${fn}(${args});`;
    },
  );

  c = c.replace(
    /if \(isUseMock\(\)\) return (mock[A-Za-z]+)\(([^;]*)\);/g,
    `if (isUseMock()) { const { $1 } = await ${loaderFn}(); return $1($2); }`,
  );

  c = c.replace(
    /if \(isUseMock\(\)\) \{\r?\n(\s*)return (mock[A-Za-z]+)\(([^)]*)\);\r?\n\s*\}/g,
    `if (isUseMock()) {\n    const { $2 } = await ${loaderFn}();\n    return $2($3);\n  }`,
  );

  if (c.match(new RegExp(`from '@\\/data\\/${dataModule}'`))) {
    console.error('[fail]', rel, 'still has static import');
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(file, c, 'utf8');
  console.log('[ok]', rel);
}

for (const [rel, loader, mod] of SERVICES) migrate(rel, loader, mod);
console.log('batch done');
