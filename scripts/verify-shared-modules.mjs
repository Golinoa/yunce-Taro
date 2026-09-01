#!/usr/bin/env node
/**
 * 共享模块校验脚本（P-01）
 *
 * 背景：跨分包共享模块必须被主包 app.tsx 引用，否则 Taro MiniSplitChunksPlugin
 * 会将它们提取到 <subpackage>/sub-common/，导致微信运行时 module not defined。
 *
 * 本脚本在 build:weapp 之后执行：
 * - SHARED_LIST 为「允许进主包的跨分包共享模块」唯一真源，与 src/app.tsx 顶部 import 对齐；
 * - 任一模块未在 app.tsx 引用（人为漏挂/注释）→ 报错并阻断构建，给出模块名。
 *
 * 验收：人为注释掉 app.tsx 中一个共享 import 后执行本脚本，退出码非 0 且输出缺失模块名。
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_TSX_PATH = resolve(__dirname, '../src/app.tsx');

/** 唯一真源：允许进主包的跨分包共享模块（新增共享模块时同步维护两处：此处 + app.tsx） */
const SHARED_LIST = [
  '@/constants/lead',
  '@/constants/brand',
  '@/components/lead/LeadCard',
  '@/components/lead/LeadStatusBadge',
  '@/components/lead/ConvertSheet',
  '@/components/lead/FollowUpSheet',
  '@/components/Card',
  '@/components/CardHeader',
  '@/components/FormRow',
  '@/components/InlineSelector',
  '@/components/InlineDropdown',
  '@/components/ChipPicker',
  '@/components/SegmentedControl',
  '@/components/InstallmentPanel',
  '@/components/QuestionHint',
  '@/components/reschedule/WorkflowHeaderCard',
  '@/components/schedule/ScheduleBookingSwitch',
  '@/components/schedule/ScheduleCardMenu',
  '@/components/lead/TrialBookingSkeleton',
  '@/components/lead/TrialBookingView',
  '@/components/lead/BookTrialByClassSheet',
  '@/components/campus/CampusSwitcher',
  '@/components/campus/CampusTrigger',
  '@/stores/campus',
  '@/stores/subscribe-auth',
  '@/services/member-card',
  '@/services/card-type',
  '@/services/student',
  '@/services/follow-record',
  '@/components/student/StudentAvatar',
  '@/components/student/StudentListCard',
  '@/components/teacher/SalaryEditSheet',
  '@/components/PageContainer',
];

const appTsx = readFileSync(APP_TSX_PATH, 'utf-8');
// 匹配裸 import（import '@/xxx';）与具名 import（import { x } from '@/xxx'）
const imported = [
  ...appTsx.matchAll(/(?:from|import)\s+'(@\/[^']+)'/g),
].map((match) => match[1]);

const missing = SHARED_LIST.filter((modulePath) => !imported.includes(modulePath));

if (missing.length > 0) {
  console.error('[共享模块校验失败] 以下模块未在 app.tsx 引用，将导致线上 module not defined：');
  missing.forEach((modulePath) => console.error(`  - ${modulePath}`));
  console.error('修复：在 src/app.tsx 顶部恢复对应 import 语句（与 SHARED_LIST 对齐）。');
  process.exit(1);
}

console.log(`[共享模块校验通过] ${SHARED_LIST.length} 个跨分包共享模块已在主包 app.tsx 引用`);
