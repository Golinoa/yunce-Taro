/**
 * schedule-form 常量与类型（Q2-3）
 */
import type { Class } from '@/types/class';
import type { DayOfWeek } from '@/types/schedule';

export type AutoOpenType = NonNullable<Class['auto_open_type']>;
export type SchedulingMode = 'rule' | 'free';
export type RepeatMode = 'weekly' | 'biweekly' | 'alternate';
/**
 * 规则排课的结束方式。
 *
 * ⚠️ 2026-10-01 移除旧设计里的 `by_count`（按次数）：它只在表单上留了控件与一行备注，
 * 后端从来没有任何一列存它、排课也不受影响（选"10 次"实际永不结束），属"界面先做、
 * 后端未实现"的半成品。用户口径：直接把旧设计移除，保留「不结束 / 限日期」两种。
 */
export type EndMode = 'never' | 'by_date';

export interface TimeSlotPair {
  id: number;
  start: string;
  end: string;
}

export const AUTO_OPEN_OPTIONS: { key: AutoOpenType; label: string }[] = [
  { key: 'manual', label: '手动开班' },
  { key: 'full', label: '约满开班' },
  { key: 'time', label: '到时间自动开班' },
  { key: 'full_or_time', label: '约满或到时间' },
];

export const SLOT_MAX_COUNT_OPTIONS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '8',
  '10',
  '12',
  '15',
  '20',
] as const;

export const SCHEDULE_TYPE_OPTIONS = ['班课', '团课'] as const;

export const WEEKDAY_OPTIONS: { label: string; value: DayOfWeek }[] = [
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
  { label: '日', value: 7 },
];

export const REPEAT_OPTIONS: { label: string; value: RepeatMode }[] = [
  { label: '每周', value: 'weekly' },
  { label: '隔周', value: 'biweekly' },
  { label: '隔天', value: 'alternate' },
];

export const END_MODE_OPTIONS: { label: string; value: EndMode }[] = [
  { label: '不结束', value: 'never' },
  { label: '限日期', value: 'by_date' },
];
