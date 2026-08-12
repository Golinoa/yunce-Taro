import fs from 'fs';
import path from 'path';

const srcDir = 'd:\\Coding\\yunce\\yunceTaro\\src';
const colorRegex = /#([0-9A-Fa-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;

const files = [];
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (/\.(tsx|ts|scss)$/.test(entry.name)) files.push(fullPath);
  }
}
walk(srcDir);

const colorCounts = {};
const fileMatches = {};
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(colorRegex);
  if (matches) {
    const relative = path.relative(srcDir, file);
    fileMatches[relative] = (fileMatches[relative] || 0) + matches.length;
    for (const m of matches) colorCounts[m] = (colorCounts[m] || 0) + 1;
  }
}

const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
const sortedFiles = Object.entries(fileMatches).sort((a, b) => b[1] - a[1]);

console.log('=== 颜色值频率统计（前100）===');
for (const [color, count] of sortedColors.slice(0, 100)) {
  console.log(count.toString().padStart(3) + ' ' + color);
}

console.log('\n=== 涉及文件统计（前60）===');
for (const [file, count] of sortedFiles.slice(0, 60)) {
  console.log(count.toString().padStart(3) + ' ' + file);
}

console.log('\n总计: ' + Object.values(colorCounts).reduce((a, b) => a + b, 0) + ' 个颜色出现在 ' + Object.keys(fileMatches).length + ' 个文件中');
