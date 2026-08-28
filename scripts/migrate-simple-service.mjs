/**
 * 将简单 service（仅 mock 函数 import）从静态 @/data 改为动态 loadXxxMock
 * 用法: node scripts/migrate-simple-service.mjs <file> <loaderFn> <dataModule>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [rel, loaderFn, dataModule] = process.argv.slice(2);
if (!rel || !loaderFn || !dataModule) {
  console.error('Usage: migrate-simple-service.mjs <file> <loaderFn> <dataModule>');
  process.exit(1);
}

const file = path.join(root, rel);
let c = fs.readFileSync(file, 'utf8');

// Remove static mock value imports from @/data/<module>
const mockImportRe = new RegExp(
  `import \\{[\\s\\S]*?\\} from '@\\/data\\/${dataModule.replace(/\./g, '\\.')}';\\r?\\n`,
);
c = c.replace(mockImportRe, '');

// Remove USE_MOCK constant
c = c.replace(
  /const USE_MOCK =\r?\n  typeof process !== 'undefined' && typeof process\.env !== 'undefined'\r?\n    \? process\.env\.VITE_USE_MOCK !== 'false'\r?\n    : true;\r?\n\r?\n/,
  '',
);

// Add loader imports after first block of imports (after last type import or first import group)
if (!c.includes(`from '@/utils/mock-loaders'`)) {
  c = c.replace(
    /(import type \{[\s\S]*?\} from '@\/types\/[^']+';)\r?\n/,
    `$1\nimport { ${loaderFn} } from '@/utils/mock-loaders';\nimport { isUseMock } from '@/utils/build-env';\n`,
  );
  if (!c.includes(`from '@/utils/mock-loaders'`)) {
    c = c.replace(
      /(import \{[\s\S]*?\} from '@\/[^']+';)\r?\n\r?\n/,
      `$1\nimport { ${loaderFn} } from '@/utils/mock-loaders';\nimport { isUseMock } from '@/utils/build-env';\n\n`,
    );
  }
}

c = c.replace(/\bUSE_MOCK\b/g, 'isUseMock()');

// Pattern: if (!isUseMock()) { ... } return mockFn(...);
c = c.replace(
  /if \(!isUseMock\(\)\) \{[\s\S]*?\}\r?\n\s*return (mock[A-Za-z]+)\(([^)]*)\);/g,
  (match, fn, args) => {
    const nonMock = match.match(/if \(!isUseMock\(\)\) \{([\s\S]*?)\}/)?.[1]?.trim();
    if (nonMock && nonMock.length > 0 && !nonMock.startsWith('//')) {
      // keep non-mock branch, add dynamic mock
      return match.replace(
        `\n    return ${fn}(${args});`,
        `\n    const { ${fn} } = await ${loaderFn}();\n    return ${fn}(${args});`,
      );
    }
    return `if (!isUseMock()) {\n      // TODO: real API\n    }\n    const { ${fn} } = await ${loaderFn}();\n    return ${fn}(${args});`;
  },
);

// Pattern: if (isUseMock()) return mockFn(...);
c = c.replace(
  /if \(isUseMock\(\)\) return (mock[A-Za-z]+)\(([^;]*)\);/g,
  `if (isUseMock()) { const { $1 } = await ${loaderFn}(); return $1($2); }`,
);

// Pattern: standalone return mockFn after isUseMock check in else-less form
c = c.replace(
  /(\n\s*)return (mock[A-Za-z]+)\(([^)]*)\);/g,
  (full, indent, fn, args) => {
    if (full.includes(`await ${loaderFn}`)) return full;
    return `${indent}const { ${fn} } = await ${loaderFn}();\n${indent}return ${fn}(${args});`;
  },
);

fs.writeFileSync(file, c, 'utf8');
console.log('[ok]', rel);
