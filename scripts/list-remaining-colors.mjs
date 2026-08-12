import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

// 颜色匹配：hex / rgb / rgba / hsl / hsla
const colorRegex = /#([0-9A-Fa-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/gi;

// 系统文件或无需处理的文件
const skipFiles = [
  'theme.ts',
  'app.scss',
  'styles/variables.scss',
  'styles/compat.scss',
];

// 跳过明确是 mock 数据集中定义的文件（可选）
const skipPatterns = [/node_modules/];

function shouldSkip(relativePath) {
  if (skipFiles.some((f) => relativePath.includes(f))) return true;
  return skipPatterns.some((p) => p.test(relativePath));
}

function extractContext(line, match, window = 60) {
  const start = Math.max(0, line.indexOf(match) - window);
  const end = Math.min(line.length, line.indexOf(match) + match.length + window);
  return line.slice(start, end).trim();
}

function walk(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
    } else if (/\.(tsx|ts|scss)$/.test(entry.name)) {
      const relative = path.relative(srcDir, fullPath);
      if (shouldSkip(relative)) continue;

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      const fileResults = [];

      lines.forEach((line, idx) => {
        const matches = line.match(colorRegex);
        if (matches) {
          matches.forEach((match) => {
            fileResults.push({
              line: idx + 1,
              color: match,
              context: extractContext(line, match),
            });
          });
        }
      });

      if (fileResults.length > 0) {
        results.push({
          file: relative,
          count: fileResults.length,
          matches: fileResults,
        });
      }
    }
  }
  return results;
}

const results = walk(srcDir).sort((a, b) => b.count - a.count);

for (const r of results) {
  console.log(`\n## ${r.file} (${r.count})`);
  for (const m of r.matches) {
    console.log(`  L${m.line}: ${m.color}`);
    console.log(`      ${m.context}`);
  }
}
