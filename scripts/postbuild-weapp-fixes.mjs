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
    const mockBuild = process.env.VITE_USE_MOCK === 'true';
    const msg = `[postbuild-weapp-fixes] main package exceeds 1.5MB limit (${formatKb(mainBytes)} > ${formatKb(MAIN_PACKAGE_LIMIT_BYTES)})`;
    if (mockBuild) {
      // Mock 包含完整 data 层，本地调试允许超限；真机上传/提审仍须用生产包
      console.warn(`${msg} — mock 构建仅告警，可继续用开发者工具打开 dist`);
    } else {
      console.error(`[postbuild-weapp-fixes] ERROR: ${msg}`);
      process.exitCode = 1;
    }
  }

  if (oversizedMedia.length > 0) {
    console.warn('[postbuild-weapp-fixes] WARN: media files exceed 200KB:');
    oversizedMedia.forEach((item) => {
      console.warn(`  - ${item.path}: ${formatKb(item.size)}`);
    });
  }
}

/**
 * 收集分包页面里对 sub-common / sub-vendors 的 require。
 */
function collectSubpackageChunkRequires() {
  const requireRe = /require\(["'](\.\.\/)+((?:sub-common\/[^"']+\.js)|sub-vendors\.js)["']\)/g;
  const pageJsFiles = collectFiles(distRoot).filter((filePath) => {
    const rel = path.relative(distRoot, filePath).replace(/\\/g, '/');
    return /^package-[^/]+\/pages\/.+\/index\.js$/.test(rel);
  });

  const requires = [];
  for (const filePath of pageJsFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    let match;
    requireRe.lastIndex = 0;
    while ((match = requireRe.exec(content)) !== null) {
      const requiredRel = match[0].match(/require\(["']([^"']+)["']\)/)?.[1];
      if (!requiredRel) continue;
      const resolved = path.normalize(path.join(path.dirname(filePath), requiredRel));
      requires.push({
        page: path.relative(distRoot, filePath).replace(/\\/g, '/'),
        require: requiredRel,
        expected: path.relative(distRoot, resolved).replace(/\\/g, '/'),
        resolved,
      });
    }
  }

  return { pageJsFiles, requires };
}

/**
 * Taro MiniSplitChunksPlugin 偶发只在部分分包写出同 hash 的 sub-common，
 * 其它分包页面仍 require 本地路径 → 运行时 module is not defined。
 * 从已写出的兄弟分包拷贝同名 chunk 补齐。
 */
function healMissingSubpackageChunks(requires) {
  const missing = requires.filter((item) => !fs.existsSync(item.resolved));
  if (missing.length === 0) return 0;

  const chunkIndex = new Map();
  for (const filePath of collectFiles(distRoot)) {
    const rel = path.relative(distRoot, filePath).replace(/\\/g, '/');
    const m = rel.match(/^package-[^/]+\/sub-common\/([^/]+\.js)$/);
    if (!m) continue;
    if (!chunkIndex.has(m[1])) chunkIndex.set(m[1], filePath);
  }

  let healed = 0;
  for (const item of missing) {
    const base = path.basename(item.resolved);
    const donor = chunkIndex.get(base);
    if (!donor || !item.require.includes('sub-common/')) {
      continue;
    }
    fs.mkdirSync(path.dirname(item.resolved), { recursive: true });
    fs.copyFileSync(donor, item.resolved);
    healed += 1;
    console.log(
      `[postbuild-weapp-fixes] healed ${item.expected} <- ${path.relative(distRoot, donor).replace(/\\/g, '/')}`,
    );
  }

  return healed;
}

/**
 * 校验分包页面 require 的 sub-common / sub-vendors 文件是否真实存在。
 * 这类「module is not defined」不会被 vitest 覆盖，必须在产物层拦截。
 */
function verifySubpackageChunkRequires() {
  const { pageJsFiles, requires } = collectSubpackageChunkRequires();
  healMissingSubpackageChunks(requires);

  const missing = requires.filter((item) => !fs.existsSync(item.resolved));
  if (missing.length > 0) {
    console.error('[postbuild-weapp-fixes] ERROR: missing subpackage chunk(s):');
    missing.forEach((item) => {
      console.error(`  - ${item.page} requires ${item.require} (missing ${item.expected})`);
    });
    process.exitCode = 1;
    return false;
  }

  console.log(
    `[postbuild-weapp-fixes] verified ${pageJsFiles.length} subpackage page(s) chunk requires`,
  );
  return true;
}

/**
 * Taro copy.patterns 在 dist 被微信开发者工具占用、或 clean 跳过删 dist 时，
 * 偶发漏拷静态资源 → 首页 3D 瓷片 / tabBar 图标空白。
 * 构建后强制同步白名单资源并校验存在。
 */
function ensureStaticAssetsCopied() {
  const projectRoot = path.resolve(distRoot, '..');
  const copies = [
    {
      fromDir: path.join(projectRoot, 'src/assets/icons'),
      toDir: path.join(distRoot, 'assets/icons'),
      allFiles: true,
    },
  ];

  const imageFiles = [
    'sgpk.png',
    'cover-home.webp',
    'support-repair-qr.webp',
    'qr-point-hand.png',
    'icon-book.webp',
    'icon-calendar-check.webp',
    'icon-crown.webp',
    'icon-customer-service.webp',
    'icon-lightning.webp',
    'icon-rocket.webp',
    'icon-users.webp',
    'icon-wallet-pink.webp',
    'icon-wallet-purple.webp',
    'icon-wallet-yen.webp',
  ];

  let copied = 0;
  const missing = [];

  const iconsFrom = path.join(projectRoot, 'src/assets/icons');
  const iconsTo = path.join(distRoot, 'assets/icons');
  fs.mkdirSync(iconsTo, { recursive: true });
  if (fs.existsSync(iconsFrom)) {
    for (const name of fs.readdirSync(iconsFrom)) {
      const src = path.join(iconsFrom, name);
      if (!fs.statSync(src).isFile()) continue;
      fs.copyFileSync(src, path.join(iconsTo, name));
      copied += 1;
    }
  } else {
    missing.push('src/assets/icons');
  }

  const imagesFrom = path.join(projectRoot, 'src/assets/images');
  const imagesTo = path.join(distRoot, 'assets/images');
  fs.mkdirSync(imagesTo, { recursive: true });
  for (const name of imageFiles) {
    const src = path.join(imagesFrom, name);
    const dest = path.join(imagesTo, name);
    if (!fs.existsSync(src)) {
      missing.push(`src/assets/images/${name}`);
      continue;
    }
    fs.copyFileSync(src, dest);
    copied += 1;
  }

  const wxFrom = path.join(projectRoot, 'src/package-settings/assets/wx.webp');
  const wxTo = path.join(distRoot, 'package-settings/assets/wx.webp');
  if (fs.existsSync(wxFrom)) {
    fs.mkdirSync(path.dirname(wxTo), { recursive: true });
    fs.copyFileSync(wxFrom, wxTo);
    copied += 1;
  }

  // 运行时路径硬校验（与 brand.ts MEDIA_IMAGE_BASE、app.config tabBar 对齐）
  const required = [
    'assets/icons/home_selected.png',
    'assets/icons/home_unselected.png',
    'assets/icons/schedule_selected.png',
    'assets/icons/schedule_unselected.png',
    'assets/icons/checkin_selected.png',
    'assets/icons/checkin_unselected.png',
    'assets/icons/profile_selected.png',
    'assets/icons/profile_unselected.png',
    'assets/images/icon-rocket.webp',
    'assets/images/icon-users.webp',
    'assets/images/icon-calendar-check.webp',
    'assets/images/sgpk.png',
  ];
  for (const rel of required) {
    const full = path.join(distRoot, rel);
    if (!fs.existsSync(full) || fs.statSync(full).size <= 0) {
      missing.push(`dist/${rel}`);
    }
  }

  if (missing.length > 0) {
    console.error('[postbuild-weapp-fixes] ERROR: static assets missing after copy:');
    missing.forEach((item) => console.error(`  - ${item}`));
    console.error(
      '[postbuild-weapp-fixes] 请关闭微信开发者工具后重跑 npm run build:weapp:dev（dist 被占用时 copy 会漏）',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[postbuild-weapp-fixes] ensured ${copied} static asset file(s) in dist/assets`);
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
verifySubpackageChunkRequires();
ensureStaticAssetsCopied();
auditPackageSize();
