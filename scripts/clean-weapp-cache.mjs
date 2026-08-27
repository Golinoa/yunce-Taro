/**
 * clean-weapp-cache.mjs
 *
 * 彻底清除微信小程序构建产物与 webpack 持久化缓存。
 *
 * ⚠️ 为什么需要它：
 *   config/index.ts 给 webpack 配置了持久化缓存
 *   cacheDirectory: node_modules/.cache/webpack/weapp（缓存名 yunce-weapp-cache）。
 *   该缓存在某些情况下不会随源码变化失效，即使 `rm -rf dist` 后重编，
 *   仍会把【旧代码】直接喂进产物，导致"代码改了但小程序里没生效"。
 *   遇到"改了没反应"，用 `npm run build:weapp:clean` 强制全量重编。
 */
import { rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const targets = [
  resolve(root, 'dist'),
  resolve(root, 'node_modules/.cache/webpack/weapp'),
];

for (const t of targets) {
  if (!existsSync(t)) {
    console.log(`[clean] skip (not exist): ${t}`);
    continue;
  }
  try {
    rmSync(t, { recursive: true, force: true });
    console.log(`[clean] removed: ${t}`);
  } catch (error) {
    const isDistLocked =
      t.endsWith('dist') &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EBUSY';
    if (isDistLocked) {
      console.warn('[clean] dist is locked (close WeChat DevTools preview?), skip removing dist');
      continue;
    }
    throw error;
  }
}
