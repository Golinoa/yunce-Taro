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
    } else if (entry.name.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 移除 Avatar 组件的 name 属性（支持多行）
  // 匹配 <Avatar ... name={...} ... />
  content = content.replace(/<Avatar([^>]*)\s+name=\{[^}]+\}([^>]*)\/>/g, '<Avatar$1$2/>');
  content = content.replace(/<Avatar([^>]*)\s+name="[^"]*"([^>]*)\/>/g, '<Avatar$1$2/>');

  // 多行 Avatar 组件：name 属性可能在单独一行
  content = content.replace(/<Avatar\b/g, '<Avatar');
  content = content.replace(/\n\s*name=\{[^}]+\}/g, '');
  content = content.replace(/\n\s*name="[^"]*"/g, '');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${path.relative(srcDir, filePath)}`);
  }
}

walk(srcDir);
