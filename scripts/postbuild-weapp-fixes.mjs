import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distBaseWxmlPath = path.join(projectRoot, 'dist', 'base.wxml');

if (!fs.existsSync(distBaseWxmlPath)) {
  console.warn('[postbuild-weapp-fixes] dist/base.wxml not found, skip patch');
  process.exit(0);
}

const originalContent = fs.readFileSync(distBaseWxmlPath, 'utf8');

let nextContent = originalContent;

// Taro 4.1.9 生成的通用 scroll-view 模板会始终带 padding 属性占位，
// 微信开发者工具在 webview 模式下会持续提示该属性不受支持。
nextContent = nextContent.replace(/ padding="\{\{i\.p12\|\|\[0,0,0,0\]\}\}"/g, '');

// 当前项目中的 canvas 已统一迁到 Canvas 2D，同层渲染不再依赖旧版 canvas-id。
nextContent = nextContent.replace(/ canvas-id="\{\{i\.p0\}\}"/g, '');

if (nextContent === originalContent) {
  console.log('[postbuild-weapp-fixes] no changes needed');
  process.exit(0);
}

fs.writeFileSync(distBaseWxmlPath, nextContent, 'utf8');
console.log('[postbuild-weapp-fixes] patched dist/base.wxml');
