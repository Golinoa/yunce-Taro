/**
 * 微信小程序本地开发构建：Mock 关 + API → 联调环境
 *
 * API 基址：https://dev.chancore.cn/api/app/v1（联调环境，health 探针：https://dev.chancore.cn/health 返回 200）
 * ⚠️ 用户口径（2026-09-24）：禁止用 http://127.0.0.1:3000 本机地址打包；联调域名是 dev（非 devops）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const DEFAULT_DEV_API_BASE = 'https://dev.chancore.cn/api/app/v1';
const API_BASE = process.env.TARO_API_BASE_URL ?? DEFAULT_DEV_API_BASE;
/** 邀约 H5 落地页网址前缀（`<前缀>/invite/<码>`）；可换域名，默认与 API 同站点根 */
const DEFAULT_DEV_LANDING_BASE = API_BASE.replace(/\/api\/.*$/, '');
const LANDING_BASE = process.env.TARO_H5_LANDING_BASE_URL ?? DEFAULT_DEV_LANDING_BASE;

function verifyDevDist() {
  const commonJsPath = path.join(root, 'dist/common.js');
  if (!fs.existsSync(commonJsPath)) {
    console.error('[build:weapp:dev] ERROR: dist/common.js 不存在');
    process.exit(1);
  }

  const content = fs.readFileSync(commonJsPath, 'utf8');
  if (!content.includes(API_BASE)) {
    console.error(`[build:weapp:dev] ERROR: 产物未包含 ${API_BASE}，请关闭微信开发者工具后重试`);
    process.exit(1);
  }

  console.log(`[build:weapp:dev] verified ${API_BASE} in dist/common.js`);
}

function runNpm(script, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCmd, ['run', script, ...extraArgs], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VITE_USE_MOCK: 'false',
        TARO_API_BASE_URL: API_BASE,
        TARO_H5_LANDING_BASE_URL: LANDING_BASE,
        TARO_ENABLE_LOCAL_DEBUG: 'true',
      },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code ?? 1}`));
    });
  });
}

async function main() {
  console.log(`[build:weapp:dev] TARO_API_BASE_URL=${API_BASE}`);
  console.log(`[build:weapp:dev] TARO_H5_LANDING_BASE_URL=${LANDING_BASE}`);
  await runNpm('build:weapp:clean');
  verifyDevDist();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
