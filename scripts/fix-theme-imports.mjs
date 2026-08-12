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
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 只处理包含 from '@/theme' 导入的文件
  const importMatch = content.match(/import\s*\{[^}]+\}\s*from\s*'@\/theme';\n?/);
  if (!importMatch) return;

  const hasHexColors = content.includes('hexColors.');
  const hasExtendedHexColors = content.includes('extendedHexColors.');

  let newImport = '';
  if (hasHexColors && hasExtendedHexColors) {
    newImport = "import { extendedHexColors, hexColors } from '@/theme';\n";
  } else if (hasHexColors) {
    newImport = "import { hexColors } from '@/theme';\n";
  } else if (hasExtendedHexColors) {
    newImport = "import { extendedHexColors } from '@/theme';\n";
  } else {
    // 没有使用任何 token，仅当导入内容确实只有这两个时才删除
    const importContent = importMatch[0];
    const onlyThese = /^import\s*\{\s*(extendedHexColors|hexColors)\s*(,\s*(extendedHexColors|hexColors))?\s*\}\s*from\s*'@\/theme';\s*$/;
    if (onlyThese.test(importContent.trim())) {
      newImport = '';
    } else {
      // 包含其他导出（如 getThemeHexColors），不修改
      return;
    }
  }

  if (newImport !== importMatch[0]) {
    content = content.replace(importMatch[0], newImport);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${path.relative(srcDir, filePath)}`);
  }
}

walk(srcDir);
