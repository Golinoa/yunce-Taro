import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/services/student.ts');
let c = fs.readFileSync(file, 'utf8');

// Add async to object methods that use await getStudentsMock but lack async
c = c.replace(
  /^(\s{2}[a-zA-Z][a-zA-Z0-9]*: )(\([^)]*\) => \(await getStudentsMock\(\)\))/gm,
  '$1async $2',
);
c = c.replace(
  /^(\s{2}[a-zA-Z][a-zA-Z0-9]*: )(\([^)]*\) => \{\n[\s\S]*?await getStudentsMock\(\))/gm,
  (match, prefix, rest) => {
    if (match.includes('async (')) return match;
    return `${prefix}async ${rest}`;
  },
);

// Fix methods that return await getStudentsMock on same line with other patterns
c = c.replace(
  /^(\s{2}[a-zA-Z][a-zA-Z0-9]*: )(\([^)]*\) =>\n\s+isUseMock\(\)[\s\S]*?\(await getStudentsMock\(\)\))/gm,
  (match, prefix, rest) => {
    if (match.includes('async (')) return match;
    return `${prefix}async ${rest}`;
  },
);

// Specific: isUseMock() ternary with await on one line
c = c.replace(
  /^(\s{2}[a-zA-Z][a-zA-Z0-9]*: )(\([^)]*\) =>\n\s+isUseMock\(\))/gm,
  (match, prefix, rest) => {
    const blockEnd = c.indexOf('\n  },', c.indexOf(match));
    const block = c.slice(c.indexOf(match), blockEnd);
    if (block.includes('await ') && !match.includes('async (')) {
      return `${prefix}async ${rest}`;
    }
    return match;
  },
);

fs.writeFileSync(file, c, 'utf8');
console.log('student async fixes applied');
