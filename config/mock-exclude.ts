import path from 'node:path';
import webpack from 'webpack';
import type Chain from 'webpack-chain';

/** 生产构建（VITE_USE_MOCK=false）时将 mock 数据模块替换为轻量 stub */
export function applyMockExcludeWebpack(chain: Chain, useMock: string): void {
  if (useMock === 'true') {
    return;
  }

  const stubDir = path.resolve(__dirname, '../src/mock-stub');

  const replacements: Array<{ test: RegExp; stub: string }> = [
    { test: /[\\/]src[\\/]data[\\/]mock-database\.ts$/, stub: 'mock-database.ts' },
    { test: /[\\/]src[\\/]data[\\/]auth\.ts$/, stub: 'auth.ts' },
    { test: /[\\/]src[\\/]data[\\/]home\.ts$/, stub: 'home.ts' },
    { test: /[\\/]src[\\/]data[\\/]students\.ts$/, stub: 'students.ts' },
    { test: /[\\/]src[\\/]data[\\/]lead\.ts$/, stub: 'lead.ts' },
    { test: /[\\/]src[\\/]data[\\/]class-booking\.ts$/, stub: 'class-booking.ts' },
    { test: /[\\/]src[\\/]data[\\/]course-template\.ts$/, stub: 'course-template.ts' },
    { test: /[\\/]src[\\/]data[\\/]course-category\.ts$/, stub: 'course-category.ts' },
    { test: /[\\/]src[\\/]data[\\/]follow-records\.ts$/, stub: 'follow-records.ts' },
    { test: /[\\/]src[\\/]data[\\/]my-course\.ts$/, stub: 'my-course.ts' },
    { test: /[\\/]src[\\/]data[\\/]member-card\.ts$/, stub: 'member-card.ts' },
    { test: /[\\/]src[\\/]data[\\/]statistics\.ts$/, stub: 'statistics.ts' },
    { test: /[\\/]src[\\/]data[\\/]organization\.ts$/, stub: 'organization.ts' },
    { test: /[\\/]src[\\/]data[\\/]campus-invite\.ts$/, stub: 'campus-invite.ts' },
    { test: /[\\/]src[\\/]data[\\/]store-entry\.ts$/, stub: 'store-entry.ts' },
    { test: /[\\/]src[\\/]data[\\/]subscribe-message\.ts$/, stub: 'subscribe-message.ts' },
    { test: /[\\/]src[\\/]data[\\/]feedback\.ts$/, stub: 'feedback.ts' },
    { test: /[\\/]src[\\/]data[\\/]audit-log\.ts$/, stub: 'audit-log.ts' },
    { test: /[\\/]src[\\/]data[\\/]venue-booking\.ts$/, stub: 'venue-booking.ts' },
    { test: /[\\/]src[\\/]data[\\/]campus\.ts$/, stub: 'campus.ts' },
    { test: /[\\/]src[\\/]data[\\/]teacher\.ts$/, stub: 'teacher.ts' },
    { test: /[\\/]src[\\/]data[\\/]card-type\.ts$/, stub: 'card-type.ts' },
    { test: /[\\/]src[\\/]data[\\/]lesson-debt\.ts$/, stub: 'lesson-debt.ts' },
    { test: /[\\/]src[\\/]data[\\/]custom-todos\.ts$/, stub: 'custom-todos.ts' },
    { test: /[\\/]src[\\/]data[\\/]onboarding\.ts$/, stub: 'onboarding.ts' },
    { test: /[\\/]src[\\/]data[\\/]data-center\.ts$/, stub: 'data-center.ts' },
    { test: /[\\/]src[\\/]data[\\/]mock[\\/]index\.ts$/, stub: 'mock-index.ts' },
    { test: /[\\/]src[\\/]data[\\/]mock[\\/]statistics-base\.ts$/, stub: 'mock-statistics-base.ts' },
    {
      test: /[\\/]package-statistics[\\/]data[\\/]data-center-mock\.ts$/,
      stub: 'data-center-mock.ts',
    },
    {
      test: /[\\/]src[\\/]utils[\\/]schedule-category-mock\.ts$/,
      stub: 'schedule-category-mock.ts',
    },
  ];

  replacements.forEach(({ test, stub }, index) => {
    const stubPath = path.join(stubDir, stub);
    chain.plugin(`mock-exclude-${index}`).use(webpack.NormalModuleReplacementPlugin, [test, stubPath]);
  });

  console.log('[mock-exclude] production build will replace mock data modules with stubs');
}
