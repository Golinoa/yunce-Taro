import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/auth.ts');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /if \(USE_MOCK\) return (mock[A-Za-z]+)\(([^;]*)\);/g,
  'if (isUseMock()) { const { $1 } = await loadAuthMock(); return $1($2); }',
);
c = c.replace(
  /if \(USE_MOCK\) mockRestoreRegisterDrafts\(\);/,
  'if (isUseMock()) { void loadAuthMock().then(({ mockRestoreRegisterDrafts }) => mockRestoreRegisterDrafts()); }',
);
c = c.replace(/if \(USE_MOCK\) \{\n    return \{ error: null \};\n  \}/, 'if (isUseMock()) {\n    return { error: null };\n  }');
c = c.replace(
  /export async function registerStep1ByPhone\(phone: string\): Promise<RegisterStep1Result> \{\r?\n  const normalized = phone\.trim\(\);\r?\n  if \(!\^1\[3-9\]\\d\{9\}\$\/\.test\(normalized\)\) \{\r?\n    return \{ tempToken: null, error: \{ message: '请输入正确的手机号' \} \};\r?\n  \}\r?\n\r?\n  if \(USE_MOCK\) \{\r?\n    return mockRegisterStep1\(normalized, 'phone-register', undefined\);\r?\n  \}/,
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
c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');
c = c.replace(
  /export const testAccounts: TestAccount\[\] = isUseMock\(\) \? TEST_ACCOUNTS : \[\];\r?\nexport const testPassword = isUseMock\(\) \? TEST_PASSWORD : '';/,
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

fs.writeFileSync(file, c, 'utf8');
if (c.includes('USE_MOCK') || c.includes("from '@/data/auth'")) {
  console.error('auth migration incomplete – manual fix needed');
  process.exit(1);
}
console.log('auth ok');
