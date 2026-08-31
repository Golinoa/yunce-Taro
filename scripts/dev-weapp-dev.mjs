/**
 * 本机真实联调：Mock 关 + API 指向 Cloudflare Tunnel（dev.chancore.cn → 本机 :3000）
 *
 * 前置：
 * 1. 后端 start.cmd / npm run dev，curl http://127.0.0.1:3000/health 返回 ok
 * 2. cloudflared tunnel run yunce-dev（窗口保持开着）
 * 3. curl -4 https://dev.chancore.cn/health 返回 ok
 * 4. 微信公众平台 request 合法域名含 dev.chancore.cn
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const API_BASE = 'https://dev.chancore.cn/api/app/v1';

console.log(`[dev:weapp:dev] VITE_USE_MOCK=false`);
console.log(`[dev:weapp:dev] TARO_API_BASE_URL=${API_BASE}`);
console.log(`[dev:weapp:dev] 请确认已运行: cloudflared tunnel run yunce-dev`);

const child = spawn(npmCmd, ['run', 'build:weapp', '--', '--watch'], {
  cwd: root,
  env: {
    ...process.env,
    VITE_USE_MOCK: 'false',
    TARO_API_BASE_URL: process.env.TARO_API_BASE_URL ?? API_BASE,
    TARO_ENABLE_LOCAL_DEBUG: process.env.TARO_ENABLE_LOCAL_DEBUG ?? 'true',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
