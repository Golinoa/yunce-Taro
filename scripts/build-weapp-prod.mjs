/**
 * 微信小程序生产联调包（强制关闭 Mock + 写入线上 API）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const API_BASE = 'https://api.chancore.cn/api/app/v1';

function verifyProdDist() {
  const commonJsPath = path.join(root, 'dist/common.js');
  if (!fs.existsSync(commonJsPath)) {
    console.error('[build:weapp:prod] ERROR: dist/common.js 不存在');
    process.exit(1);
  }

  const content = fs.readFileSync(commonJsPath, 'utf8');
  if (!content.includes('api.chancore.cn')) {
    console.error(
      '[build:weapp:prod] ERROR: 产物未包含 api.chancore.cn，请关闭微信开发者工具后执行 npm run build:weapp:prod',
    );
    process.exit(1);
  }

  console.log('[build:weapp:prod] verified api.chancore.cn in dist/common.js');
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
  await runNpm('build:weapp:clean');
  verifyProdDist();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
