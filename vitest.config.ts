/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest 配置（F-01：引入自动化测试框架）
 *
 * - 仅对 data/* 纯函数做单测（node 环境，无需 jsdom）
 * - @ 别名与 tsconfig 保持一致，指向 src
 * - coverage 仅统计已进入回归防护的 data 文件，并设门槛门禁
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.env.ts', './vitest.setup.ts'],
    // 禁用结果缓存写入，规避 Windows 沙箱 EPERM 拦截 results.json
    cache: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/data/teacher.ts', 'src/data/lead.ts', 'src/data/store-entry.ts'],
      thresholds: {
        // 起步门槛：随回归套件补全逐步上调至 review 建议的 60%+
        lines: 30,
      },
    },
  },
});
