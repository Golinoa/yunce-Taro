import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/todo.ts');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /import \{ COURSE_MANAGEMENT_CLASS_TAB_URL \} from '@\/data\/course-category';\r?\nimport \{ ensureMockCustomTodoSeedsForUser \} from '@\/data\/custom-todos';\r?\nimport \{ mockGetTodoItems \} from '@\/data\/home';\r?\n/,
  `import { COURSE_MANAGEMENT_CLASS_TAB_URL } from '@/constants/course-category-ui';
import { loadCustomTodosMock, loadHomeMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
`,
);

c = c.replace(
  /const USE_MOCK =\r?\n  typeof process !== 'undefined' && typeof process\.env !== 'undefined'\r?\n    \? process\.env\.VITE_USE_MOCK !== 'false'\r?\n    : true;\r?\n\r?\n/,
  '',
);
c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');

c = c.replace(
  /function ensureMockCustomTodoSeeds\(userId: string\): void \{\r?\n  if \(!userId \|\| !isUseMock\(\)\) return;\r?\n  ensureMockCustomTodoSeedsForUser\(userId\);\r?\n\}/,
  `async function ensureMockCustomTodoSeeds(userId: string): Promise<void> {
  if (!userId || !isUseMock()) return;
  const { ensureMockCustomTodoSeedsForUser } = await loadCustomTodosMock();
  ensureMockCustomTodoSeedsForUser(userId);
}`,
);

c = c.replace(
  /ensureMockCustomTodoSeeds\(userId\);/g,
  'await ensureMockCustomTodoSeeds(userId);',
);

c = c.replace(
  /const fixedTodos = \(await mockGetTodoItems\(teacherId \|\| '', campusId\)\)/,
  'const { mockGetTodoItems } = await loadHomeMock();\n  const fixedTodos = (await mockGetTodoItems(teacherId || \'\', campusId))',
);

fs.writeFileSync(file, c, 'utf8');
console.log('todo migrated');
