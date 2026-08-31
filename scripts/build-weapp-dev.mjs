/**
 * 微信小程序「测环境」构建：Mock 关 + API → https://dev.chancore.cn/api/app/v1
 *
 * 前置：本机 API + cloudflared tunnel run yunce-dev
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const API_BASE = 'https://dev.chancore.cn/api/app/v1';

function verifyDevDist() {
  const commonJsPath = path.join(root, 'dist/common.js');
  if (!fs.existsSync(commonJsPath)) {
    console.error('[build:weapp:dev] ERROR: dist/common.js 不存在');
    process.exit(1);
  }

  const content = fs.readFileSync(commonJsPath, 'utf8');
  if (!content.includes('dev.chancore.cn')) {
    console.error(
      '[build:weapp:dev] ERROR: 产物未包含 dev.chancore.cn，请关闭微信开发者工具后重试',
    );
    process.exit(1);
  }

  console.log('[build:weapp:dev] verified dev.chancore.cn in dist/common.js');
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
  await runNpm('build:weapp:clean');
  verifyDevDist();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
