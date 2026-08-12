/**
 * 综合硬编码颜色 Token 化替换脚本（v3 - 保守版）
 *
 * 替换策略（仅按行处理，确保安全）：
 *   1. 仅替换"CSS 属性赋值"上下文（key: '#xxx'）
 *   2. 跳过数组元素、注释、JSDoc、UnoCSS 任意值
 *   3. 替换 rgba() 数字（任何上下文）
 *
 * 跳过文件：theme.ts、navigation-bar.ts、data/course-template.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

const colorMap = {
  '#3b6ef5': 'hexColors.primary',
  '#2563eb': 'hexColors.primaryDark',
  '#6b95f5': 'hexColors.primaryGlow',
  '#ef4444': 'hexColors.destructive',
  '#ef4544': 'hexColors.destructive',
  '#e46767': 'extendedHexColors.mintError',
  '#d94040': 'extendedHexColors.avatarRose',
  '#f59e0b': 'hexColors.warning',
  '#fbbf24': 'extendedHexColors.badgeOrangeBorder',
  '#f97768': 'hexColors.rolePrincipal',
  '#10b981': 'hexColors.success',
  '#16a34a': 'hexColors.success',
  '#22b8cf': 'hexColors.info',
  '#0ea5e9': 'hexColors.info',
  '#3b82f6': 'extendedHexColors.badgeBlueText',
  '#60a5fa': 'extendedHexColors.badgeBlueBorder',
  '#8b5cf6': 'hexColors.accent',
  '#a78bfa': 'hexColors.accentGlow',
  '#7c3aed': 'hexColors.accentDark',
  '#5ec8a8': 'extendedHexColors.avatarMint',
  '#4ab893': 'extendedHexColors.avatarMintDark',
  '#7dd8bc': 'extendedHexColors.avatarMintLight',
  '#f5faf8': 'extendedHexColors.mintBackground',
  '#d5e8e0': 'extendedHexColors.mintBorderStrong',
  '#f4fffa': 'extendedHexColors.successBg',
  '#e89bb8': 'extendedHexColors.avatarPink',
  '#d97ca2': 'extendedHexColors.avatarPinkDark',
  '#f0b3c7': 'extendedHexColors.avatarPinkLight',
  '#ec4899': 'extendedHexColors.avatarRose',
  '#f43f5e': 'extendedHexColors.avatarRose',
  '#6ba3d6': 'extendedHexColors.avatarBlue',
  '#4b85bb': 'extendedHexColors.avatarBlueDark',
  '#93c5e8': 'extendedHexColors.avatarBlueLight',
  '#4d86bd': 'extendedHexColors.avatarBlueDeep',
  '#4dabf7': 'extendedHexColors.avatarBlueLight',
  '#6bb5d4': 'extendedHexColors.avatarBlue',
  '#6aa8ff': 'extendedHexColors.statBlue',
  '#3a8ee6': 'extendedHexColors.scheduleBlueText',
  '#edf4ff': 'extendedHexColors.scheduleBlueLight',
  '#eaf6ff': 'extendedHexColors.scheduleBlueBg',
  '#eef4ff': 'extendedHexColors.scheduleBlueLight',
  '#eaf1ff': 'extendedHexColors.scheduleBlueLight',
  '#e8ecf3': 'extendedHexColors.scheduleBlueBorder',
  '#f9fafb': 'extendedHexColors.scheduleBlueBgg',
  '#9b7ed8': 'extendedHexColors.avatarPurple',
  '#7e63c9': 'extendedHexColors.avatarPurpleDark',
  '#845ef7': 'extendedHexColors.avatarPurple',
  '#6366f1': 'extendedHexColors.avatarIndigo',
  '#c28cff': 'extendedHexColors.statPurple',
  '#9775fa': 'extendedHexColors.avatarPurple',
  '#e64980': 'extendedHexColors.avatarPink',
  '#d4a24e': 'extendedHexColors.avatarAmber',
  '#b9852f': 'extendedHexColors.avatarAmberDark',
  '#e8864a': 'extendedHexColors.avatarOrange',
  '#d66d2b': 'extendedHexColors.avatarOrangeDark',
  '#f5c6a0': 'extendedHexColors.avatarOrangeLight',
  '#e8c468': 'extendedHexColors.avatarAmber',
  '#ff8a4c': 'extendedHexColors.leadPrimary',
  '#e67a3e': 'extendedHexColors.leadPrimaryDark',
  '#f97361': 'extendedHexColors.leadPrimaryGlow',
  '#ff7e67': 'extendedHexColors.avatarCoralDeep',
  '#f08a5d': 'extendedHexColors.avatarCoralDeep',
  '#d96a38': 'extendedHexColors.avatarCoralDeepDark',
  '#ff6b6b': 'extendedHexColors.avatarCoral',
  '#ffa94d': 'extendedHexColors.avatarOrange',
  '#ff922b': 'extendedHexColors.avatarOrange',
  '#fcc419': 'extendedHexColors.avatarAmber',
  '#f97316': 'extendedHexColors.avatarOrange',
  '#f06595': 'extendedHexColors.avatarPink',
  '#fa5252': 'extendedHexColors.avatarCoral',
  '#51cf66': 'hexColors.success',
  '#06b6d4': 'hexColors.info',
  '#38d5f0': 'hexColors.info',
  '#f0a0a0': 'extendedHexColors.avatarCoral',
  '#7bc8e8': 'extendedHexColors.avatarCyan',
  '#b8d45e': 'extendedHexColors.avatarLime',
  '#84cc16': 'hexColors.success',
  '#14b8a6': 'hexColors.success',
  '#fff7ed': 'extendedHexColors.badgeOrangeBg',
  '#eff6ff': 'extendedHexColors.badgeBlueBg',
  '#f3f4f6': 'extendedHexColors.badgeGrayBg',
  '#9ca3af': 'extendedHexColors.gray400',
  '#f8fbff': 'extendedHexColors.cardGradientBlueStart',
  '#eef5ff': 'extendedHexColors.cardGradientBlueEnd',
  '#fff8f8': 'extendedHexColors.cardGradientRedStart',
  '#fff1f1': 'extendedHexColors.cardGradientRedEnd',
  '#fde2e2': 'extendedHexColors.cardRedBorder',
  '#dceafe': 'extendedHexColors.scheduleBlueBg',
  '#e0a54e': 'extendedHexColors.statAmber',
  '#65c08b': 'extendedHexColors.statGreen',
  '#33b07a': 'extendedHexColors.scheduleGreenText',
  '#ebf9f1': 'extendedHexColors.scheduleGreenBg',
  '#fff3e8': 'extendedHexColors.scheduleOrangeBg',
  '#df8b3b': 'extendedHexColors.scheduleOrangeText',
  '#f1f1f1': 'extendedHexColors.scheduleGrayBg',
  '#8f8f8f': 'extendedHexColors.scheduleGrayText',
  '#111827': 'extendedHexColors.gray900',
  '#1f2937': 'extendedHexColors.gray800',
  '#374151': 'extendedHexColors.gray700',
  '#4b5563': 'extendedHexColors.gray600',
  '#6b7280': 'extendedHexColors.gray500',
  '#d1d5db': 'extendedHexColors.gray300',
  '#e5e7eb': 'extendedHexColors.gray200',
  '#f0f2f5': 'extendedHexColors.gray100',
  '#fafafa': 'extendedHexColors.gray50',
  '#f5f5f5': 'extendedHexColors.muted',
  '#f0f0f0': 'extendedHexColors.muted',
  '#f7f7f7': 'extendedHexColors.pageBgTertiary',
  '#f8f8f8': 'extendedHexColors.pageBgTertiary',
  '#f3f2ed': 'extendedHexColors.pageBgSecondary',
  '#f0ede9': 'extendedHexColors.border',
  '#f6f8fc': 'extendedHexColors.pageBg',
  '#ededed': 'extendedHexColors.border',
  '#e0e0e0': 'extendedHexColors.dividerLight',
  '#e6e6e6': 'extendedHexColors.divider',
  '#bfbfbf': 'extendedHexColors.dividerStrong',
  '#c7c2bd': 'extendedHexColors.dividerStrong',
  '#e9e5e1': 'extendedHexColors.dividerLight',
  '#efebe7': 'extendedHexColors.divider',
  '#94a3b8': 'extendedHexColors.gray400',
  '#c8ced8': 'extendedHexColors.divider',
  '#c7ced9': 'extendedHexColors.divider',
  '#b7bfcc': 'extendedHexColors.dividerStrong',
  '#bbbbbb': 'extendedHexColors.dividerStrong',
  '#666666': 'extendedHexColors.foregroundQuaternary',
  '#333333': 'extendedHexColors.gray800',
  '#333': 'extendedHexColors.gray800',
  '#555555': 'extendedHexColors.foregroundQuaternary',
  '#8b95a7': 'extendedHexColors.foregroundTertiary',
  '#8a8a8a': 'extendedHexColors.foregroundTertiary',
  '#5b6475': 'extendedHexColors.foregroundQuaternary',
  '#efefef': 'extendedHexColors.dividerLight',
  '#cccccc': 'extendedHexColors.dividerStrong',
  '#fff6f4': 'extendedHexColors.warningBg',
  '#edfdf3': 'extendedHexColors.successBgSoft',
  '#dff3e8': 'extendedHexColors.successBorder',
  '#fff7f5': 'extendedHexColors.warningBg',
  '#fff4f2': 'extendedHexColors.warningBgSoft',
  '#f5c6bf': 'extendedHexColors.warningBorder',
  '#fff0f0': 'extendedHexColors.errorBg',
  '#f5d0d0': 'extendedHexColors.errorBorder',
  '#f4f7fb': 'extendedHexColors.infoBg',
};

const colorValues = Object.keys(colorMap);

const skipFiles = new Set([
  'data/course-template.ts',
  'utils/navigation-bar.ts',
  'theme.ts',
]);

const rgbaRegex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;

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

/**
 * 判断行是否是 "属性赋值" 上下文（key: '#xxx' 或 key: "#xxx"）
 *
 * 启发式：行内包含 `:` (排除箭头函数/三元) 且后面跟着引号字符串
 * 不替换的情况：
 *   - 行首是 *（JSDoc 内部）
 *   - 行首是 //（注释）
 *   - 字符串前紧跟 [ 或 , （数组元素）
 *   - 字符串前紧跟 // 或 *（注释内）
 */
function processFile(filePath) {
  const relative = path.relative(srcDir, filePath).replace(/\\/g, '/');
  if (skipFiles.has(relative)) return;

  const original = fs.readFileSync(filePath, 'utf8');
  let content = original;
  const replacedKeys = new Set();

  // 1. 字符串字面量替换：只在 "key: 'value'" 或 "key: `value`" 形式
  //    匹配 key: 后接引号字符串中含硬编码颜色的部分
  //    注意：此匹配必须在 **非数组上下文** 中

  // 先按行扫描，每行判断是否属于属性赋值
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 跳过 JSDoc 和注释行
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
    // 匹配模式：xxx: '...' 或 xxx: "..." 或 xxx: `...`
    const lineRegex = /:\s*(['"`])([^'"`]*#[0-9a-fA-F]{3,8}[^'"`]*)\1/g;
    let m;
    const newLineParts = [];
    let lastEnd = 0;
    while ((m = lineRegex.exec(line)) !== null) {
      const [, quote, value] = m;
      const matchStart = m.index;
      // match 的格式 ": 'value'"，所以字符串引号位置 = matchStart + ": ".length = matchStart + 2
      // 但 quote 实际是第 matchStart + 2 个字符（":" 后 1 字符是空格，2 字符是引号）
      // 实际: 字符串引号在 line[matchStart + 2] 之前的位置（也就是 line[matchStart + 1] 之前的位置）
      // 需要检查字符串引号前一个字符是否为 [
      const quoteIdx = line.indexOf(quote, matchStart);
      // 检查 value 内部是否包含 UnoCSS 任意值模式 [#xxx] 或 [任意颜色]
      // 例如 'bg-[#fff7ed]' 包含 [xxx] 任意值
      if (/\[[^\]]*#[0-9a-fA-F]{3,8}[^\]]*\]/.test(value)) {
        newLineParts.push(line.slice(lastEnd, lineRegex.lastIndex));
        lastEnd = lineRegex.lastIndex;
        continue;
      }
      // 找到引号前最近一个非空白字符
      const beforeQuote = line.slice(0, quoteIdx).trimEnd();
      const charBeforeQuote = beforeQuote.slice(-1);
      // 如果字符串前面紧跟 [ ，则视为 UnoCSS 任意值，不替换
      if (charBeforeQuote === '[') {
        newLineParts.push(line.slice(lastEnd, lineRegex.lastIndex));
        lastEnd = lineRegex.lastIndex;
        continue;
      }
      const hexMatch = value.match(/(#[0-9a-fA-F]{3,8})/);
      if (!hexMatch) {
        newLineParts.push(line.slice(lastEnd, lineRegex.lastIndex));
        lastEnd = lineRegex.lastIndex;
        continue;
      }
      const token = colorMap[hexMatch[1].toLowerCase()];
      if (!token) {
        newLineParts.push(line.slice(lastEnd, lineRegex.lastIndex));
        lastEnd = lineRegex.lastIndex;
        continue;
      }
      const newValue = value.replace(/(#[0-9a-fA-F]{3,8})/g, (mm) => {
        const k = mm.toLowerCase();
        const t = colorMap[k];
        if (!t) return mm;
        replacedKeys.add(t);
        return t;
      });
      const replacement = `: ${quote}${newValue}${quote}`;
      newLineParts.push(line.slice(lastEnd, matchStart));
      newLineParts.push(replacement);
      lastEnd = lineRegex.lastIndex;
    }
    if (lastEnd > 0) {
      newLineParts.push(line.slice(lastEnd));
      lines[i] = newLineParts.join('');
    }
  }
  content = lines.join('\n');

  // 2. rgba 替换
  content = content.replace(rgbaRegex, (match, r, g, b, a) => {
    const hex = '#' + [parseInt(r), parseInt(g), parseInt(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('');
    const token = colorMap[hex.toLowerCase()];
    if (!token) return match;
    replacedKeys.add(token);
    if (a === undefined || a === '1') {
      return `${token}`;
    }
    return `${token} / ${parseFloat(a)}`;
  });

  if (content === original) return;

  // 按需补充 import
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*'@\/theme';\n?/;
  const existingImport = content.match(importRegex);
  const baseNames = new Set();
  for (const token of replacedKeys) {
    const [base] = token.split('.');
    baseNames.add(base);
  }

  if (existingImport) {
    const existingNames = new Set(
      existingImport[1].split(',').map((s) => s.trim()).filter(Boolean)
    );
    for (const n of baseNames) existingNames.add(n);
    const newImport = `import { ${Array.from(existingNames).sort().join(', ')} } from '@/theme';\n`;
    content = content.replace(importRegex, newImport);
  } else {
    const importLine = `import { ${Array.from(baseNames).sort().join(', ')} } from '@/theme';\n`;
    const lines2 = content.split('\n');
    let insertIdx = 0;
    let inTypeBlock = false;
    for (let i = 0; i < lines2.length; i++) {
      const ln = lines2[i];
      if (ln.match(/^import\s+type\s*\{/)) {
        inTypeBlock = true;
        continue;
      }
      if (inTypeBlock) {
        if (ln.includes('} from')) {
          inTypeBlock = false;
          insertIdx = i + 1;
        }
        continue;
      }
      if (ln.match(/^import\s/)) {
        insertIdx = i + 1;
        break;
      }
    }
    lines2.splice(insertIdx, 0, importLine.trimEnd());
    content = lines2.join('\n');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated: ${relative} (${replacedKeys.size} tokens)`);
}

walk(srcDir);
console.log('Done.');