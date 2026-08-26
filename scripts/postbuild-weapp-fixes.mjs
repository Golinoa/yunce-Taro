import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distRoot = path.join(projectRoot, 'dist');
const distBaseWxmlPath = path.join(distRoot, 'base.wxml');
const distAppJsonPath = path.join(distRoot, 'app.json');

/** 微信代码质量：主包建议 < 1.5MB（1536KB） */
const MAIN_PACKAGE_LIMIT_BYTES = Math.floor(1.5 * 1024 * 1024);
/** 单张图片/音频建议 < 200KB */
const MEDIA_LIMIT_BYTES = 200 * 1024;

const MEDIA_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.mp3',
  '.wav',
  '.aac',
  '.m4a',
]);

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

function isMainPackageFile(filePath) {
  const relative = path.relative(distRoot, filePath).replace(/\\/g, '/');
  return !relative.startsWith('package-');
}

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  };
  walk(dir);
  return files;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

/**
 * 确保 app.json 含 lazyCodeLoading（微信「代码质量-按需注入」检测项）。
 */
function ensureLazyCodeLoading() {
  if (!fs.existsSync(distAppJsonPath)) {
    console.warn('[postbuild-weapp-fixes] dist/app.json not found, skip lazyCodeLoading patch');
    return false;
  }

  const appJson = JSON.parse(fs.readFileSync(distAppJsonPath, 'utf8'));
  if (appJson.lazyCodeLoading === 'requiredComponents') {
    return false;
  }

  appJson.lazyCodeLoading = 'requiredComponents';
  fs.writeFileSync(distAppJsonPath, `${JSON.stringify(appJson)}\n`, 'utf8');
  console.log('[postbuild-weapp-fixes] injected lazyCodeLoading=requiredComponents into dist/app.json');
  return true;
}

/**
 * 删除 dist 内不应参与上传/扫描的冗余文件。
 */
function cleanupDistArtifacts() {
  let removed = 0;
  for (const filePath of collectFiles(distRoot)) {
    const name = path.basename(filePath);
    const shouldRemove =
      name.endsWith('.LICENSE.txt') ||
      name.endsWith('.map') ||
      name === 'project.config.json' ||
      name === 'project.private.config.json';

    if (shouldRemove) {
      fs.unlinkSync(filePath);
      removed += 1;
    }
  }

  if (removed > 0) {
    console.log(`[postbuild-weapp-fixes] removed ${removed} non-package artifact(s) from dist`);
  }
}

/**
 * 审计主包体积与媒体资源，输出与微信「代码质量」对齐的报告。
 */
function auditPackageSize() {
  const allFiles = collectFiles(distRoot);
  let mainBytes = 0;
  const oversizedMedia = [];

  for (const filePath of allFiles) {
    const stat = fs.statSync(filePath);
    if (isMainPackageFile(filePath)) {
      mainBytes += stat.size;
    }

    const ext = path.extname(filePath).toLowerCase();
    if (MEDIA_EXTENSIONS.has(ext) && stat.size > MEDIA_LIMIT_BYTES) {
      oversizedMedia.push({
        path: path.relative(distRoot, filePath).replace(/\\/g, '/'),
        size: stat.size,
      });
    }
  }

  console.log(
    `[postbuild-weapp-fixes] main package: ${formatKb(mainBytes)} / ${formatKb(MAIN_PACKAGE_LIMIT_BYTES)}`,
  );

  if (mainBytes > MAIN_PACKAGE_LIMIT_BYTES) {
    console.warn(
      `[postbuild-weapp-fixes] WARN: main package exceeds 1.5MB recommendation (${formatKb(mainBytes)})`,
    );
  }

  if (oversizedMedia.length > 0) {
    console.warn('[postbuild-weapp-fixes] WARN: media files exceed 200KB:');
    oversizedMedia.forEach((item) => {
      console.warn(`  - ${item.path}: ${formatKb(item.size)}`);
    });
  }
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

if (nextContent !== originalContent) {
  fs.writeFileSync(distBaseWxmlPath, nextContent, 'utf8');
  console.log('[postbuild-weapp-fixes] patched dist/base.wxml');
}

if (wxssCreated > 0) {
  console.log(`[postbuild-weapp-fixes] created ${wxssCreated} empty page wxss file(s)`);
}

ensureLazyCodeLoading();
cleanupDistArtifacts();
auditPackageSize();
