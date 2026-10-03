/**
 * 「计入消课展示」统一口径的契约测试
 *
 * 真源：`src/utils/lesson-record-cancel.ts` 的 `isCountedLessonRecord` /
 * `filterCountedLessonRecords`。
 *
 * 背景（2026-10-03）：`record.status !== 'cancelled'` 此前散落在 10+ 处各写一份，
 * 且首页 mapper 把 status 硬编码成 `'normal'` ⇒ 同一���已取消记录
 * 在「上课记录」被过滤、在「最近消课」照常渲染 ⇒ 两个页面数据不统一。
 * 这份测试锁住口径，防止再退化。
 */
import { describe, expect, it } from 'vitest';
import type { LessonRecord } from '@/types/lesson-record';
import { filterCountedLessonRecords, isCountedLessonRecord } from './lesson-record-cancel';

const make = (over: Partial<LessonRecord>): LessonRecord =>
  ({
    id: 'r1',
    student_id: 's1',
    lesson_date: '2026-10-03',
    hours_used: 1,
    status: 'normal',
    ...over,
  }) as LessonRecord;

describe('isCountedLessonRecord —— 取消的不计入消课', () => {
  it('已取消 ⇒ 不计入', () => {
    expect(isCountedLessonRecord(make({ status: 'cancelled' }))).toBe(false);
  });

  it.each(['normal', 'makeup', 'leave', 'absent'] as const)('%s ⇒ 计入', (status) => {
    expect(isCountedLessonRecord(make({ status }))).toBe(true);
  });

  it('⚠️ normal 但 hours_used=0（点名未计消课/试听挂账）⇒ 仍计入，不能误滤', () => {
    expect(isCountedLessonRecord(make({ status: 'normal', hours_used: 0 }))).toBe(true);
  });

  it('status 缺失（老数据）⇒ 视为 normal 计入', () => {
    expect(isCountedLessonRecord(make({ status: undefined }))).toBe(true);
  });
});

describe('filterCountedLessonRecords', () => {
  it('滤掉取消的、保留其余，且保持原顺序', () => {
    const list = [
      make({ id: 'a', lesson_date: '2026-10-05', status: 'cancelled', hours_used: 0 }),
      make({ id: 'b', lesson_date: '2026-10-03', status: 'normal', hours_used: 1 }),
      make({ id: 'c', lesson_date: '2026-10-01', status: 'cancelled', hours_used: 0 }),
      make({ id: 'd', lesson_date: '2026-09-28', status: 'normal', hours_used: 2 }),
    ];
    const result = filterCountedLessonRecords(list);
    expect(result.map((r) => r.id)).toEqual(['b', 'd']);
  });

  it('全部取消 ⇒ 返回空数组（上层据此不渲染空分组）', () => {
    const list = [make({ id: 'a', status: 'cancelled' }), make({ id: 'b', status: 'cancelled' })];
    expect(filterCountedLessonRecords(list)).toEqual([]);
  });

  it('不修改入参（纯函数）', () => {
    const list = [make({ id: 'a', status: 'cancelled' }), make({ id: 'b' })];
    const snapshot = JSON.stringify(list);
    filterCountedLessonRecords(list);
    expect(JSON.stringify(list)).toBe(snapshot);
  });
});
