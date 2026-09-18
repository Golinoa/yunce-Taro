import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.join(process.cwd(), 'dist');

/**
 * 主包体积审计（B4 · 计划 v2 修订 #12：prod 构建此前不跑体积门禁）
 * - 建议值 MAIN_PACKAGE_LIMIT_BYTES（默认 1.5MB）：超限仅告警（项目自设建议值，非硬限）
 * - 硬限 2MB（微信单包上限）：超限 exit 1，构建失败
 */
const WARN_BYTES = Number(process.env.MAIN_PACKAGE_LIMIT_BYTES ?? 1.5 * 1024 * 1024);
const HARD_BYTES = 2 * 1024 * 1024;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

const main = walk(distRoot).filter(
  (f) => !path.relative(distRoot, f).replace(/\\/g, '/').startsWith('package-'),
);
main.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
let total = 0;
for (const file of main) {
  total += fs.statSync(file).size;
}
console.log(`MAIN TOTAL ${(total / 1024).toFixed(1)}KB\n`);
for (const file of main.slice(0, 25)) {
  const kb = fs.statSync(file).size / 1024;
  console.log(
    `${kb.toFixed(1).padStart(8)}KB  ${path.relative(distRoot, file).replace(/\\/g, '/')}`,
  );
}

if (total > HARD_BYTES) {
  console.error(
    `\n[audit-main-size] FAIL: 主包 ${(total / 1024).toFixed(1)}KB 超过微信硬限 2048KB`,
  );
  process.exit(1);
} else if (total > WARN_BYTES) {
  console.warn(
    `\n[audit-main-size] WARN: 主包 ${(total / 1024).toFixed(1)}KB 超过建议值 ${Math.round(WARN_BYTES / 1024)}KB（建议值非硬限，仅告警）`,
  );
} else {
  console.log('\n[audit-main-size] OK: 主包体积在建议值内');
}
