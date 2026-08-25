/**
 * 开发模式编译微信小程序（强制开启 Mock）
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const child = spawn(npmCmd, ['run', 'build:weapp', '--', '--watch'], {
  cwd: root,
  env: {
    ...process.env,
    VITE_USE_MOCK: 'true',
    TARO_ALLOW_MOCK_PROD: '1',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
