/**
 * 课表加载纯逻辑单测：缓存跳过、月度区间、试听 key、开放班过滤
 */
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import type { Class } from '@/types/class';
import {
  buildMonthAuxDateRange,
  buildTrialBookingKeys,
  filterOpenClasses,
  shouldSkipOpenSlotLoad,
} from './schedule-loaders-logic';

function makeClass(overrides: Partial<Class> & Pick<Class, 'id' | 'name'>): Class {
  return {
    teacher_id: 't1',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    type: 'unlimited',
    status: 'active',
    used_lessons: 0,
    color: 'primary',
    student_count: 0,
    ...overrides,
  };
}

describe('filterOpenClasses', () => {
  it('仅保留 schedule_mode=open 的班级', () => {
    const classes = [
      makeClass({ id: 'c1', name: 'Open', schedule_mode: 'open' }),
      makeClass({ id: 'c2', name: 'Fixed', schedule_mode: 'fixed' }),
      makeClass({ id: 'c3', name: 'Unset' }),
    ];
    expect(filterOpenClasses(classes).map((c) => c.id)).toEqual(['c1']);
  });
});

describe('shouldSkipOpenSlotLoad', () => {
  const base = {
    viewMode: 'schedule' as const,
    scheduleSubMode: 'open' as const,
    dateStr: '2026-09-01',
    force: false,
    loadingDates: new Set<string>(),
    cachedDates: {} as Record<string, unknown>,
    errorDates: new Set<string>(),
  };

  it('非 schedule 或非 open 视图跳过', () => {
    expect(shouldSkipOpenSlotLoad({ ...base, viewMode: 'booking' })).toBe(true);
    expect(shouldSkipOpenSlotLoad({ ...base, scheduleSubMode: 'fixed' })).toBe(true);
  });

  it('加载中跳过', () => {
    expect(
      shouldSkipOpenSlotLoad({
        ...base,
        loadingDates: new Set(['2026-09-01']),
      }),
    ).toBe(true);
  });

  it('已缓存且非错误且非 force 时跳过', () => {
    expect(
      shouldSkipOpenSlotLoad({
        ...base,
        cachedDates: { '2026-09-01': {} },
      }),
    ).toBe(true);
  });

  it('force 时跳过缓存', () => {
    expect(
      shouldSkipOpenSlotLoad({
        ...base,
        force: true,
        cachedDates: { '2026-09-01': {} },
      }),
    ).toBe(false);
  });

  it('缓存日期在 errorDates 中时不跳过（允许重试）', () => {
    expect(
      shouldSkipOpenSlotLoad({
        ...base,
        cachedDates: { '2026-09-01': {} },
        errorDates: new Set(['2026-09-01']),
      }),
    ).toBe(false);
  });

  it('无缓存且非加载中时不跳过', () => {
    expect(shouldSkipOpenSlotLoad(base)).toBe(false);
  });
});

describe('buildMonthAuxDateRange', () => {
  it('所选月 ±7 天', () => {
    const selected = dayjs('2026-09-15');
    const range = buildMonthAuxDateRange(selected);
    expect(range.startDate).toBe('2026-08-25');
    expect(range.endDate).toBe('2026-10-07');
  });
});

describe('buildTrialBookingKeys', () => {
  it('pending/confirmed 且含 class_id、lesson_date 才纳入', () => {
    const keys = buildTrialBookingKeys([
      { class_id: 'c1', lesson_date: '2026-09-01', status: 'pending' },
      { class_id: 'c2', lesson_date: '2026-09-02', status: 'confirmed' },
      { class_id: 'c3', lesson_date: '2026-09-03', status: 'cancelled' },
      { class_id: null, lesson_date: '2026-09-04', status: 'pending' },
      { class_id: 'c5', lesson_date: null, status: 'pending' },
    ]);
    expect([...keys].sort()).toEqual(['c1|2026-09-01', 'c2|2026-09-02']);
  });
});
