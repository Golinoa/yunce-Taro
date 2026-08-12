import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith('.config.ts') || entry.name.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const hasHexColors = content.includes('hexColors.');
  const hasExtendedHexColors = content.includes('extendedHexColors.');

  const importMatch = content.match(/import\s*\{[^}]+\}\s*from\s*'@\/theme';\n?/);
  if (!importMatch) return;

  let newImport = '';
  if (hasHexColors && hasExtendedHexColors) {
    newImport = "import { extendedHexColors, hexColors } from '@/theme';\n";
  } else if (hasHexColors) {
    newImport = "import { hexColors } from '@/theme';\n";
  } else if (hasExtendedHexColors) {
    newImport = "import { extendedHexColors } from '@/theme';\n";
  } else {
    // 没有使用任何 token，删除 import
    newImport = '';
  }

  if (newImport !== importMatch[0]) {
    content = content.replace(importMatch[0], newImport);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed import: ${path.relative(srcDir, filePath)}`);
  }
}

walk(srcDir);
