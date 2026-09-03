/**
 * 本地对齐 GitHub ci.yml：install → check → coverage → build:weapp:dev
 *
 * VERIFY_SOP_SKIP_INSTALL=1  跳过 npm ci（微信开发者工具占用 node_modules 时）
 * VERIFY_SOP_SKIP_BUILD=1    跳过构建（仅本地快扫；改了 src/ 发版不得跳过）
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const skipInstall = process.env.VERIFY_SOP_SKIP_INSTALL === '1';
const skipBuild = process.env.VERIFY_SOP_SKIP_BUILD === '1';

function run(label, command, args) {
  console.log(`\n==> ${label}: ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, HUSKY: '0' },
  });
  if (result.status !== 0) {
    console.error(`\n[verify:sop] FAILED at: ${label}`);
    process.exit(result.status ?? 1);
  }
}

if (!skipInstall) {
  run('install', 'npm', ['ci', '--legacy-peer-deps']);
} else {
  console.log('[verify:sop] skip install (VERIFY_SOP_SKIP_INSTALL=1)');
}

run('check', 'npm', ['run', 'check']);
run('coverage', 'npm', ['run', 'coverage']);

if (!skipBuild) {
  run('build:weapp:dev', 'npm', ['run', 'build:weapp:dev']);
} else {
  console.log('[verify:sop] skip build (VERIFY_SOP_SKIP_BUILD=1)');
}

console.log('\n[verify:sop] OK');
