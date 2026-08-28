/**
 * 修正简单 service：mock 分支仅在 isUseMock() 时执行
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = fs
  .readdirSync(path.join(root, 'src/services'))
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

for (const f of files) {
  const file = path.join(root, 'src/services', f);
  let c = fs.readFileSync(file, 'utf8');
  if (!c.includes('await load') || !c.includes('Mock()')) continue;

  const next = c.replace(
    /if \(!isUseMock\(\)\) \{\r?\n\s*\/\/ TODO: real API\r?\n\s*\}\r?\n(\s*)const \{ (mock[A-Za-z]+) \} = await (load[A-Za-z]+Mock)\(\);\r?\n\1return \2\(/g,
    'if (!isUseMock()) {\n$1  // TODO: real API\n$1  throw new Error(\'API 暂未接通\');\n$1}\n$1const { $2 } = await $3();\n$1return $2(',
  );

  if (next !== c) {
    fs.writeFileSync(file, next, 'utf8');
    console.log('[fixed mock guard]', f);
  }
}
