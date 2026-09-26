/**
 * 出勤记录（`LessonRecord`）状态口径 —— **单一事实源**。
 *
 * 与后端 `lesson-record.service.ts` 的 `consumesPackage = NORMAL || MAKEUP` 对齐：
 * - `CANCELLED`：取消时会**回滚课时**（写账本 `lesson_restore`）；
 * - `LEAVE`：`hoursUsed` 恒为 0；
 * - `ABSENT`：不能关联课时套餐，走「欠课」(`LessonDebt`) 单独结算。
 *
 * ⚠️ 因此**不能**用「非已取消」当判据 —— 请假 / 缺勤同样不扣课时；若一律渲染成
 * `-X课时`，就会与「卡包」余额互相矛盾（R9 验收第 5 条）。
 *
 * ⚠️ 时间线的**显示口径**与「签到次数」的**统计口径必须共用本文件**，不得各写一份。
 */
import type { LessonRecord } from '@/types/lesson-record';

const CONSUMING_STATUSES = ['normal', 'makeup'] as const;

/** 不消耗课时的记录：用状态标签替代 `-X课时`（保留该行，不隐藏历史） */
export const RECORD_STATUS_LABEL: Record<string, string> = {
  cancelled: '已取消',
  absent: '缺勤',
  leave: '请假',
};

/** 该记录是否真实消耗课时（`status` 缺省视同 `normal`，与后端默认一致） */
export const isConsumingRecord = (record: Pick<LessonRecord, 'status'>): boolean =>
  CONSUMING_STATUSES.includes((record.status ?? 'normal') as (typeof CONSUMING_STATUSES)[number]);
