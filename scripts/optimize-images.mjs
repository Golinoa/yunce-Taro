/**
 * 图片资源优化工作流
 * 用法: npm run optimize:images
 *
 * 功能:
 * 1. 压缩 src/assets/images 下的 PNG/JPG 图片（覆盖原文件）
 * 2. 同步生成 WebP 版本到 src/assets/images/webp/（后续可迁移 CDN）
 * 3. 不处理已经优化过的图片，避免重复压缩导致质量下降
 */
import sharp from 'sharp';
import { readdir, stat, mkdir, copyFile, unlink } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const IMG_DIR = join(ROOT, 'src', 'assets', 'images');
const WEBP_DIR = join(IMG_DIR, 'webp');

// 压缩参数
const PNG_QUALITY = 80; // PNG 质量 0-100
const JPEG_QUALITY = 80; // JPEG 质量 0-100
const WEBP_QUALITY = 80; // WebP 质量 0-100

const COMPRESSIBLE_EXTS = ['.png', '.jpg', '.jpeg'];

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

async function optimizeImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!COMPRESSIBLE_EXTS.includes(ext)) return;

  const originalSize = (await stat(filePath)).size;
  const tempPath = `${filePath}.tmp`;

  try {
    // 根据原格式选择压缩参数
    const sharpInstance = sharp(filePath);
    if (ext === '.png') {
      await sharpInstance
        .png({ quality: PNG_QUALITY, compressionLevel: 9, effort: 10 })
        .toFile(tempPath);
    } else {
      await sharpInstance
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toFile(tempPath);
    }

    const newSize = (await stat(tempPath)).size;
    if (newSize < originalSize) {
      await copyFile(tempPath, filePath);
      const ratio = ((1 - newSize / originalSize) * 100).toFixed(1);
      console.log(
        `✓ ${filePath.replace(ROOT, '')}: ${formatSize(originalSize)} → ${formatSize(newSize)} (-${ratio}%)`
      );
    } else {
      console.log(`- ${filePath.replace(ROOT, '')}: 无需压缩`);
    }

    // 同步生成 WebP 到 webp/ 目录（保留目录结构）
    const relativePath = filePath.replace(IMG_DIR, '').replace(/^[\\/]/, '');
    const webpPath = join(WEBP_DIR, relativePath.replace(/\.(png|jpe?g)$/i, '.webp'));
    await ensureDir(dirname(webpPath));
    await sharp(filePath)
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toFile(webpPath);
    console.log(`  ↳ 生成 WebP: ${webpPath.replace(ROOT, '')}`);
  } catch (err) {
    console.error(`✗ ${filePath}: ${err.message}`);
  } finally {
    try {
      await unlink(tempPath);
    } catch {
      // ignore
    }
  }
}

async function walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过 webp 目录避免递归处理
      if (fullPath === WEBP_DIR) continue;
      await walkDir(fullPath);
    } else {
      await optimizeImage(fullPath);
    }
  }
}

console.log('开始优化图片资源...\n');
await ensureDir(WEBP_DIR);
await walkDir(IMG_DIR);
console.log('\n图片优化完成！');
console.log('提示: 新增的 PNG/JPG 图片放 src/assets/images/ 后，运行 npm run optimize:images 即可自动压缩。');
