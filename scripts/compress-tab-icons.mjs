/**
 * 主包瘦身：压缩 TabBar 图标（不动 banner / cover-home）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'src/assets/icons');

async function compressPng(filePath) {
  const before = fs.statSync(filePath).size;
  const buf = await sharp(filePath)
    .png({
      compressionLevel: 9,
      effort: 10,
      palette: true,
      colors: 32,
      quality: 70,
    })
    .toBuffer();
  if (buf.length < before) {
    fs.writeFileSync(filePath, buf);
    console.log(
      `[ok] ${path.relative(root, filePath)}: ${(before / 1024).toFixed(1)}KB → ${(buf.length / 1024).toFixed(1)}KB`,
    );
  } else {
    console.log(`[skip] ${path.relative(root, filePath)}: no gain`);
  }
}

async function main() {
  const files = fs.readdirSync(iconsDir).filter((f) => f.endsWith('.png'));
  for (const f of files) {
    await compressPng(path.join(iconsDir, f));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
