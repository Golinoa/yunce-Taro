import fs from 'fs';
import path from 'path';

const srcDir = 'd:\\Coding\\yunce\\yunceTaro\\src';

// 颜色 → UnoCSS 类名映射（只替换 className 中的硬编码）
const colorClassMap = {
  // 页面背景
  'bg-[#f6f7fb]': 'bg-page-bg',
  'bg-[#f6f8fc]': 'bg-page-bg',
  'bg-[#F6F7FB]': 'bg-page-bg',
  'bg-[#F6F8FC]': 'bg-page-bg',
  'bg-[#f3f2ed]': 'bg-page-bg-secondary',
  'bg-[#F3F2ED]': 'bg-page-bg-secondary',
  'bg-[#f8fafc]': 'bg-page-bg-tertiary',
  'bg-[#F8FAFC]': 'bg-page-bg-tertiary',

  // 文本
  'text-[#8b95a7]': 'text-foreground-tertiary',
  'text-[#8B95A7]': 'text-foreground-tertiary',
  'text-[#5b6475]': 'text-foreground-quaternary',
  'text-[#5B6475]': 'text-foreground-quaternary',
  'text-[#999999]': 'text-muted-foreground',
  'text-[#202939]': 'text-gray-800',
  'text-[#111827]': 'text-gray-900',
  'text-[#6b7280]': 'text-gray-500',
  'text-[#9ca3af]': 'text-gray-400',
  'text-[#4b5563]': 'text-gray-600',
  'text-[#374151]': 'text-gray-700',
  'text-[#1f2937]': 'text-gray-800',
  'text-[#030712]': 'text-gray-950',

  // 分割线/边框
  'border-[#e8e8e8]': 'border-divider',
  'border-[#E8E8E8]': 'border-divider',
  'border-[#eef2f7]': 'border-divider',
  'border-[#EEF2F7]': 'border-divider',
  'border-[#f3f2ed]': 'border-page-bg-secondary',
  'border-[#c0c0c0]': 'border-divider-strong',
  'border-[#C0C0C0]': 'border-divider-strong',
  'border-[#e0e0e0]': 'border-divider-light',
  'border-[#E0E0E0]': 'border-divider-light',

  // 背景
  'bg-[#e8e8e8]': 'bg-divider',
  'bg-[#E8E8E8]': 'bg-divider',
  'bg-[#c0c0c0]': 'bg-divider-strong',
  'bg-[#C0C0C0]': 'bg-divider-strong',
  'bg-[#e0e0e0]': 'bg-divider-light',
  'bg-[#E0E0E0]': 'bg-divider-light',

  // 线索橙
  'text-[#de7567]': 'text-lead-primary',
  'text-[#DE7567]': 'text-lead-primary',
  'text-[#ff8a4c]': 'text-lead-primary',
  'text-[#FF8A4C]': 'text-lead-primary',
  'text-[#f97361]': 'text-lead-primary-glow',
  'text-[#f97b6d]': 'text-lead-primary-glow',
  'bg-[#ff8a4c]': 'bg-lead-primary',
  'bg-[#FF8A4C]': 'bg-lead-primary',
  'bg-[#f97361]': 'bg-lead-primary-glow',
  'bg-[#f97b6d]': 'bg-lead-primary-glow',
  'bg-[#fff4f2]': 'bg-warning-bg-soft',
  'bg-[#fff7f5]': 'bg-warning-bg',
  'border-[#f5c6bf]': 'border-warning-border',

  // 成功绿
  'text-[#16a34a]': 'text-success',
  'text-[#10b981]': 'text-success',
  'bg-[#f4fffa]': 'bg-success-bg',
  'bg-[#edfdf3]': 'bg-success-bg-soft',
  'border-[#dff3e8]': 'border-success-border',

  // 危险
  'text-[#ef4444]': 'text-destructive',
  'text-[#EF4444]': 'text-destructive',
  'bg-[#fff0f0]': 'bg-error-bg',

  // 信息
  'bg-[#f4f7fb]': 'bg-info-bg',

  // 白色
  'bg-[#ffffff]': 'bg-white',
  'bg-[#FFFFFF]': 'bg-white',
  'bg-white': 'bg-white', // 已是 token

  // 常用灰
  'text-[#333333]': 'text-gray-800',
  'text-[#4a4a4a]': 'text-gray-700',
  'text-[#8a8a8a]': 'text-muted-foreground',
  'text-[#94a3b8]': 'text-gray-400',
  'text-[#98a2b3]': 'text-gray-400',

  // 页面背景补充
  'bg-[#f5f6f8]': 'bg-page-bg',
  'bg-[#F5F6F8]': 'bg-page-bg',
  'bg-[#f7f7f7]': 'bg-page-bg',
  'bg-[#F7F7F7]': 'bg-page-bg',
  'bg-[#f5f5f5]': 'bg-muted',
  'bg-[#F5F5F5]': 'bg-muted',
  'bg-[#fafafa]': 'bg-gray-50',
  'bg-[#FAFAFA]': 'bg-gray-50',

  // 边框/分割线补充
  'border-[#eceff3]': 'border-divider',
  'border-[#ECEFF3]': 'border-divider',
  'border-[#eef2f6]': 'border-divider',
  'border-[#EEF2F6]': 'border-divider',
  'border-[#f1f5f9]': 'border-gray-100',
  'border-[#F1F5F9]': 'border-gray-100',
  'border-[#e5e7eb]': 'border-gray-200',
  'border-[#E5E7EB]': 'border-gray-200',
  'border-[#c7ced9]': 'border-gray-300',
  'border-[#C7CED9]': 'border-gray-300',

  // 背景补充
  'bg-[#eceff3]': 'bg-divider',
  'bg-[#ECEFF3]': 'bg-divider',
  'bg-[#eef2f6]': 'bg-divider',
  'bg-[#EEF2F6]': 'bg-divider',
  'bg-[#f1f5f9]': 'bg-gray-100',
  'bg-[#F1F5F9]': 'bg-gray-100',
  'bg-[#e5e7eb]': 'bg-gray-200',
  'bg-[#E5E7EB]': 'bg-gray-200',
  'bg-[#c7ced9]': 'bg-gray-300',
  'bg-[#C7CED9]': 'bg-gray-300',

  // 成功绿补充
  'bg-[#e8f7ee]': 'bg-success-bg',
  'bg-[#E8F7EE]': 'bg-success-bg',
  'bg-[#e4fff1]': 'bg-success-bg',
  'bg-[#E4FFF1]': 'bg-success-bg',
  'bg-[#e1f5e8]': 'bg-success-border',
  'bg-[#E1F5E8]': 'bg-success-border',
  'bg-[#fbfffc]': 'bg-success-bg',
  'bg-[#FBFFFC]': 'bg-success-bg',
  'bg-[#e9fbf4]': 'bg-success-bg',
  'bg-[#E9FBF4]': 'bg-success-bg',
  'bg-[#f5faf8]': 'bg-success-bg',
  'bg-[#F5FAF8]': 'bg-success-bg',
  'border-[#e1f5e8]': 'border-success-border',
  'border-[#E1F5E8]': 'border-success-border',

  // 线索橙补充
  'border-[#f97361]': 'border-lead-primary-glow',
  'border-[#F97361]': 'border-lead-primary-glow',
  'bg-[#fff1ee]': 'bg-warning-bg-soft',
  'bg-[#FFF1EE]': 'bg-warning-bg-soft',
  'border-[#fca5a5]': 'border-error-border',
  'border-[#FCA5A5]': 'border-error-border',

  // Icon 颜色命名（color prop）
  'color="#16a34a"': 'color="success"',
  'color="#10b981"': 'color="success"',
  'color="#ef4444"': 'color="destructive"',
  'color="#EF4444"': 'color="destructive"',
  'color="#f97361"': 'color="lead-primary-glow"',
  'color="#f97b6d"': 'color="lead-primary-glow"',
  'color="#ff8a4c"': 'color="lead-primary-glow"',
  'color="#FF8A4C"': 'color="lead-primary-glow"',
  'color="#c7ced9"': 'color="gray-300"',
  'color="#C7CED9"': 'color="gray-300"',
  'color="#999999"': 'color="mutedForeground"',
};

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [oldStr, newStr] of Object.entries(colorClassMap)) {
    if (content.includes(oldStr)) {
      const regex = new RegExp(escapeRegExp(oldStr), 'g');
      content = content.replace(regex, newStr);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Replaced: ${path.relative(srcDir, filePath)}`);
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith('.tsx')) replaceInFile(fullPath);
  }
}

walk(srcDir);
console.log('Done');
