/**
 * 开发模式编译微信小程序（默认生产联调：Mock 关 + 线上 API）
 * 测环境请用 npm run dev:weapp:dev
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const API_BASE = 'https://api.chancore.cn/api/app/v1';

const child = spawn(npmCmd, ['run', 'build:weapp', '--', '--watch'], {
  cwd: root,
  env: {
    ...process.env,
    VITE_USE_MOCK: 'false',
    TARO_API_BASE_URL: process.env.TARO_API_BASE_URL ?? API_BASE,
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
