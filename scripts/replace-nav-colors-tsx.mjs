import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

const colorMap = {
  "'#3B6EF5'": 'hexColors.primary',
  "'#FFFFFF'": 'hexColors.card',
  "'#ffffff'": 'hexColors.card',
  "'#F6F8FC'": 'extendedHexColors.pageBg',
  "'#FAFDFB'": 'extendedHexColors.mintNavBackground',
};

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 只处理包含 definePageConfig 的文件
  if (!content.includes('definePageConfig')) return;

  for (const [color, token] of Object.entries(colorMap)) {
    const regex = new RegExp(`navigationBarBackgroundColor:\\s*${color}`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `navigationBarBackgroundColor: ${token}`);
      changed = true;
    }
  }

  if (changed) {
    // 添加 import（如果还没有）
    if (!content.includes("from '@/theme'")) {
      const importLine = "import { extendedHexColors, hexColors } from '@/theme';\n";
      content = importLine + content;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${path.relative(srcDir, filePath)}`);
  }
}

walk(srcDir);
