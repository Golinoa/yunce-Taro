/**
 * 图片资源优化工作流
 * 用法: npm run optimize:images
 *
 * 仅原地压缩 src/assets/images 下的 PNG/JPG（覆盖原文件）。
 * 不生成额外 webp/ 副产物；正式资源按需单独转 WebP 并改引用。
 */
import sharp from 'sharp';
import { readdir, stat, copyFile, unlink } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const IMG_DIR = join(ROOT, 'src', 'assets', 'images');

const PNG_QUALITY = 80;
const JPEG_QUALITY = 80;
const COMPRESSIBLE_EXTS = ['.png', '.jpg', '.jpeg'];

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
    const sharpInstance = sharp(filePath);
    if (ext === '.png') {
      await sharpInstance
        .png({ quality: PNG_QUALITY, compressionLevel: 9, effort: 10 })
        .toFile(tempPath);
    } else {
      await sharpInstance.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toFile(tempPath);
    }

    const newSize = (await stat(tempPath)).size;
    if (newSize < originalSize) {
      await copyFile(tempPath, filePath);
      const ratio = ((1 - newSize / originalSize) * 100).toFixed(1);
      console.log(
        `✓ ${filePath.replace(ROOT, '')}: ${formatSize(originalSize)} → ${formatSize(newSize)} (-${ratio}%)`,
      );
    } else {
      console.log(`- ${filePath.replace(ROOT, '')}: 无需压缩`);
    }
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
      await walkDir(fullPath);
    } else {
      await optimizeImage(fullPath);
    }
  }
}

console.log('开始优化图片资源...\n');
await walkDir(IMG_DIR);
console.log('\n图片优化完成！');
console.log('提示: 新增 PNG/JPG 放 src/assets/images/ 后运行 npm run optimize:images。');
