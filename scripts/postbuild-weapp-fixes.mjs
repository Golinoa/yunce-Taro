import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distRoot = path.join(projectRoot, 'dist');
const distBaseWxmlPath = path.join(distRoot, 'base.wxml');

/**
 * 微信开发者工具对部分新页面会强依赖 index.wxss 存在；
 * Taro + UnoCSS 主包页可能不产出该文件，此处补空文件避免 ENOENT。
 */
function ensurePageWxssFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return 0;

  let created = 0;
  const walk = (dir) => {
    const indexJsPath = path.join(dir, 'index.js');
    const indexWxssPath = path.join(dir, 'index.wxss');
    if (fs.existsSync(indexJsPath) && !fs.existsSync(indexWxssPath)) {
      fs.writeFileSync(indexWxssPath, '', 'utf8');
      created += 1;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
      }
    }
  };

  walk(rootDir);
  return created;
}

if (!fs.existsSync(distBaseWxmlPath)) {
  console.warn('[postbuild-weapp-fixes] dist/base.wxml not found, skip patch');
  process.exit(0);
}

const wxssCreated =
  ensurePageWxssFiles(path.join(distRoot, 'pages')) +
  fs
    .readdirSync(distRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('package-'))
    .reduce((count, entry) => count + ensurePageWxssFiles(path.join(distRoot, entry.name, 'pages')), 0);

const originalContent = fs.readFileSync(distBaseWxmlPath, 'utf8');

let nextContent = originalContent;

// Taro 4.1.9 生成的通用 scroll-view 模板会始终带 padding 属性占位，
// 微信开发者工具在 webview 模式下会持续提示该属性不受支持。
nextContent = nextContent.replace(/ padding="\{\{i\.p12\|\|\[0,0,0,0\]\}\}"/g, '');

// 当前项目中的 canvas 已统一迁到 Canvas 2D，同层渲染不再依赖旧版 canvas-id。
nextContent = nextContent.replace(/ canvas-id="\{\{i\.p0\}\}"/g, '');

if (nextContent === originalContent) {
  if (wxssCreated > 0) {
    console.log(`[postbuild-weapp-fixes] created ${wxssCreated} empty page wxss file(s)`);
  } else {
    console.log('[postbuild-weapp-fixes] no changes needed');
  }
  process.exit(0);
}

fs.writeFileSync(distBaseWxmlPath, nextContent, 'utf8');
console.log('[postbuild-weapp-fixes] patched dist/base.wxml');
if (wxssCreated > 0) {
  console.log(`[postbuild-weapp-fixes] created ${wxssCreated} empty page wxss file(s)`);
}
