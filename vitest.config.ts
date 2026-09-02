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
      // 门禁统计：已进入回归防护的 data/constants；随套件补全逐步扩展
      include: [
        'src/data/teacher.ts',
        'src/data/lead.ts',
        'src/data/store-entry.ts',
        'src/constants/home-ui.ts',
        'src/constants/membership-plans.ts',
        'src/constants/membership-tips.ts',
        'src/package-course/pages/package-form/constants.ts',
        'src/components/InstallmentPanel/installment-utils.ts',
        'src/components/DatePickerSheet/date-picker-utils.ts',
        'src/utils/batch-operation.ts',
        'src/utils/upload-flow.ts',
        'src/utils/use-batch-render.ts',
        'src/utils/schedule-guard.ts',
        'src/utils/schedule-card-actions.ts',
        'src/utils/schedule-card-status.ts',
        'src/utils/store-entry-onboarding.ts',
        'src/utils/store-entry-submit.ts',
        'src/utils/auth-onboarding.ts',
        'src/utils/invite-staff-link.ts',
        'src/utils/invite-landing-view-state.ts',
        'src/utils/submit-lock.ts',
        'src/utils/notify-student-parents.ts',
        'src/services/auth-email.ts',
        'src/constants/store-entry-copy.ts',
      ],
      thresholds: {
        // 起步门槛：随回归套件补全逐步上调至 review 建议的 60%+
        // Q3-5：热路径 invite/auth-onboarding/submit-lock 已纳入门禁统计
        lines: 30,
      },
    },
  },
});
