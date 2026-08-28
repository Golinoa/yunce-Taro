import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/auth.ts');
let c = fs.readFileSync(file, 'utf8');

// 1. Remove static mock imports
c = c.replace(/import \{\n[\s\S]*?\} from '@\/data\/auth';\n/, '');
c = c.replace(/import \{ TEST_ACCOUNTS, TEST_PASSWORD \} from '@\/data\/mock-database';\n/, '');
c = c.replace(
  /import type \{ TestAccount \} from '@\/data\/mock-database';\n/,
  `export interface TestAccount {
  username: string;
  label: string;
}

`,
);

// 2. Add lazy-loader imports
if (!c.includes("from '@/utils/mock-loaders'")) {
  c = c.replace(
    "import { get, post, put } from '@/utils/request';",
    `import { loadAuthMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
import { get, post, put } from '@/utils/request';`,
  );
}

// 3. Remove USE_MOCK constant (before replacing references)
c = c.replace(
  /const USE_MOCK =\n  typeof process !== 'undefined' && typeof process\.env !== 'undefined'\n    \? process\.env\.VITE_USE_MOCK !== 'false'\n    : true;\n\n/,
  '',
);

// 4. Replace remaining USE_MOCK references
c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');

// 5. Dynamic mock calls: single-line return
c = c.replace(
  /if \(isUseMock\(\)\) return (mock[A-Za-z]+)\(([^;]*)\);/g,
  'if (isUseMock()) { const { $1 } = await loadAuthMock(); return $1($2); }',
);

// 6. restoreRegisterDrafts (void, not return)
c = c.replace(
  /if \(isUseMock\(\)\) mockRestoreRegisterDrafts\(\);/,
  'if (isUseMock()) { void loadAuthMock().then(({ mockRestoreRegisterDrafts }) => mockRestoreRegisterDrafts()); }',
);

// 7. registerStep1ByPhone: add password param + use mockRegisterStep1ByPhone
c = c.replace(
  /export async function registerStep1ByPhone\(phone: string\): Promise<RegisterStep1Result> \{\n  const normalized = phone\.trim\(\);\n  if \(!\^1\[3-9\]\\d\{9\}\$\/\.test\(normalized\)\) \{\n    return \{ tempToken: null, error: \{ message: '请输入正确的手机号' \} \};\n  \}\n\n  if \(isUseMock\(\)\) \{\n    return mockRegisterStep1\(normalized, 'phone-register', undefined\);\n  \}/,
  `export async function registerStep1ByPhone(
  phone: string,
  password: string,
): Promise<RegisterStep1Result> {
  const normalized = phone.trim();
  if (!/^1[3-9]\\d{9}$/.test(normalized)) {
    return { tempToken: null, error: { message: '请输入正确的手机号' } };
  }

  if (isUseMock()) {
    const { mockRegisterStep1ByPhone } = await loadAuthMock();
    return mockRegisterStep1ByPhone(normalized, password.trim());
  }`,
);

// 8. testAccounts / testPassword exports
c = c.replace(
  /export const testAccounts: TestAccount\[\] = isUseMock\(\) \? TEST_ACCOUNTS : \[\];\nexport const testPassword = isUseMock\(\) \? TEST_PASSWORD : '';/,
  `export const testAccounts: TestAccount[] = [];
export const testPassword = '';

export async function getTestAccounts(): Promise<TestAccount[]> {
  if (!isUseMock()) return [];
  const { TEST_ACCOUNTS } = await import('@/data/mock-database');
  return TEST_ACCOUNTS;
}

export async function getTestPassword(): Promise<string> {
  if (!isUseMock()) return '';
  const { TEST_PASSWORD } = await import('@/data/mock-database');
  return TEST_PASSWORD;
}`,
);

if (c.includes("from '@/data/auth'") || c.includes('const isUseMock()')) {
  console.error('Migration incomplete – check auth.ts manually');
  process.exit(1);
}

fs.writeFileSync(file, c, 'utf8');
console.log('auth migrated OK');
