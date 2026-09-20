/**
 * 本机实时联调：Mock 关 + API 指向 Windows/WSL 可访问的本机后端
 *
 * 前置：
 * 1. curl http://127.0.0.1:3000/health 返回 ok
 * 2. 微信开发者工具允许本地调试请求
 *
 * 注意：package.json 的 build:weapp 是 `taro && postbuild`，npm 追加的 --watch
 * 会落到 postbuild 上导致 watch 立刻退出，故此处直接调 taro --watch。
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const DEFAULT_DEV_API_BASE = 'http://127.0.0.1:3000/api/app/v1';
const API_BASE = process.env.TARO_API_BASE_URL ?? DEFAULT_DEV_API_BASE;

console.log(`[dev:weapp:dev] VITE_USE_MOCK=false`);
console.log(`[dev:weapp:dev] TARO_API_BASE_URL=${API_BASE}`);
console.log(`[dev:weapp:dev] 请确认测试环境可访问: ${API_BASE.replace(/\/api\/app\/v1$/, '')}/health`);

let postbuildRunning = false;
let postbuildQueued = false;

function runPostbuild() {
  if (postbuildRunning) {
    postbuildQueued = true;
    return;
  }
  postbuildRunning = true;
  const child = spawn(npmCmd, ['exec', '--', 'node', 'scripts/postbuild-weapp-fixes.mjs'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('exit', () => {
    postbuildRunning = false;
    if (postbuildQueued) {
      postbuildQueued = false;
      runPostbuild();
    }
  });
}

const child = spawn(npxCmd, ['taro', 'build', '--type', 'weapp', '--watch'], {
  cwd: root,
  env: {
    ...process.env,
    // watch 默认 development 会触发 PureExpressionDependency 编译错误
    NODE_ENV: process.env.NODE_ENV ?? 'production',
    VITE_USE_MOCK: 'false',
    TARO_API_BASE_URL: process.env.TARO_API_BASE_URL ?? API_BASE,
    TARO_ENABLE_LOCAL_DEBUG: process.env.TARO_ENABLE_LOCAL_DEBUG ?? 'true',
  },
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});

let stdoutBuf = '';
const onChunk = (chunk, stream) => {
  const text = chunk.toString();
  stream.write(chunk);
  stdoutBuf += text;
  if (stdoutBuf.includes('Compiled successfully')) {
    stdoutBuf = '';
    runPostbuild();
  }
  // 防止缓冲无限增长
  if (stdoutBuf.length > 200_000) {
    stdoutBuf = stdoutBuf.slice(-50_000);
  }
};

child.stdout?.on('data', (c) => onChunk(c, process.stdout));
child.stderr?.on('data', (c) => onChunk(c, process.stderr));

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
