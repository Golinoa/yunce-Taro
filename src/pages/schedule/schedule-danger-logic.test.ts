/**
 * 课表危险操作纯逻辑单测：恢复取消、消课合并、开放时段休息、批量解散
 */
import { describe, expect, it } from 'vitest';
import type { Class, ClassBookingSlot } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import {
  applyOpenSlotRestStatus,
  filterCancelledRecordsForRestore,
  filterClassesAfterBatchDelete,
  filterSchedulesAfterBatchDelete,
  mergeLessonRecordsForDate,
  removeCancelledRecordsForDate,
  resolveBatchDeleteToast,
} from './schedule-danger-logic';

function makeLessonRecord(
  overrides: Partial<LessonRecord> & Pick<LessonRecord, 'id' | 'student_id' | 'lesson_date'>,
): LessonRecord {
  return {
    teacher_id: 't1',
    package_id: 'p1',
    hours_used: 0,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    ...overrides,
  };
}

function makeSlot(
  overrides: Partial<ClassBookingSlot> & Pick<ClassBookingSlot, 'id' | 'class_id' | 'lesson_date'>,
): ClassBookingSlot {
  return {
    campus_id: 'camp1',
    teacher_id: 't1',
    start_time: '09:00',
    end_time: '10:00',
    max_count: 10,
    current_count: 0,
    status: 'active',
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    ...overrides,
  };
}

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

function makeSchedule(overrides: Partial<Schedule> & Pick<Schedule, 'id'>): Schedule {
  return {
    teacher_id: 't1',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '10:00',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

describe('filterCancelledRecordsForRestore', () => {
  it('仅返回同班同日 cancelled 记录', () => {
    const records = [
      makeLessonRecord({
        id: 'r1',
        student_id: 's1',
        lesson_date: '2026-09-01',
        class_id: 'c1',
        status: 'cancelled',
      }),
      makeLessonRecord({
        id: 'r2',
        student_id: 's2',
        lesson_date: '2026-09-01',
        class_id: 'c1',
        status: 'normal',
      }),
      makeLessonRecord({
        id: 'r3',
        student_id: 's3',
        lesson_date: '2026-09-02',
        class_id: 'c1',
        status: 'cancelled',
      }),
    ];
    const result = filterCancelledRecordsForRestore(records, 'c1', '2026-09-01');
    expect(result.map((r) => r.id)).toEqual(['r1']);
  });
});

describe('removeCancelledRecordsForDate', () => {
  it('移除同班同日 cancelled，保留其它', () => {
    const records = [
      makeLessonRecord({
        id: 'r1',
        student_id: 's1',
        lesson_date: '2026-09-01',
        class_id: 'c1',
        status: 'cancelled',
      }),
      makeLessonRecord({
        id: 'r2',
        student_id: 's2',
        lesson_date: '2026-09-01',
        class_id: 'c2',
        status: 'cancelled',
      }),
    ];
    const next = removeCancelledRecordsForDate(records, 'c1', '2026-09-01');
    expect(next.map((r) => r.id)).toEqual(['r2']);
  });
});

describe('mergeLessonRecordsForDate', () => {
  it('替换同班同日旧记录并追加新建', () => {
    const prev = [
      makeLessonRecord({
        id: 'old',
        student_id: 's1',
        lesson_date: '2026-09-01',
        class_id: 'c1',
        status: 'normal',
      }),
      makeLessonRecord({
        id: 'other-day',
        student_id: 's2',
        lesson_date: '2026-09-02',
        class_id: 'c1',
      }),
    ];
    const created = [
      makeLessonRecord({
        id: 'new1',
        student_id: 's1',
        lesson_date: '2026-09-01',
        class_id: 'c1',
        status: 'cancelled',
      }),
    ];
    const next = mergeLessonRecordsForDate(prev, 'c1', '2026-09-01', created);
    expect(next.map((r) => r.id)).toEqual(['other-day', 'new1']);
  });
});

describe('applyOpenSlotRestStatus', () => {
  it('将指定 slot 标记为 rest', () => {
    const slot = makeSlot({ id: 'slot1', class_id: 'c1', lesson_date: '2026-09-01' });
    const prev = {
      '2026-09-01': {
        c1: [slot, makeSlot({ id: 'slot2', class_id: 'c1', lesson_date: '2026-09-01' })],
      },
    };
    const next = applyOpenSlotRestStatus(prev, slot);
    expect(next['2026-09-01'].c1[0].status).toBe('rest');
    expect(next['2026-09-01'].c1[1].status).toBe('active');
    expect(prev['2026-09-01'].c1[0].status).toBe('active');
  });

  it('日期或班级不存在时不修改', () => {
    const slot = makeSlot({ id: 'slot1', class_id: 'c-missing', lesson_date: '2026-09-01' });
    const prev = { '2026-09-02': { c1: [] } };
    expect(applyOpenSlotRestStatus(prev, slot)).toEqual(prev);
  });

  it('缺 dateKey：原样返回（无该 lesson_date 键）', () => {
    const slot = makeSlot({ id: 'slot1', class_id: 'c1', lesson_date: '2026-09-01' });
    const prev: Record<string, Record<string, ClassBookingSlot[]>> = {};
    const next = applyOpenSlotRestStatus(prev, slot);
    expect(next).toEqual({});
    expect(Object.keys(next)).toEqual([]);
  });

  it('有 dateKey 但缺 classSlots：不改其它班，目标班仍无条目', () => {
    const other = makeSlot({ id: 'slot-other', class_id: 'c2', lesson_date: '2026-09-01' });
    const prev = {
      '2026-09-01': {
        c2: [other],
      },
    };
    const slot = makeSlot({ id: 'slot1', class_id: 'c1', lesson_date: '2026-09-01' });
    const next = applyOpenSlotRestStatus(prev, slot);
    expect(next['2026-09-01'].c1).toBeUndefined();
    expect(next['2026-09-01'].c2[0].status).toBe('active');
    expect(prev['2026-09-01'].c2[0].status).toBe('active');
  });
});

describe('filterClassesAfterBatchDelete / filterSchedulesAfterBatchDelete', () => {
  it('剔除成功解散的班级及相关排课', () => {
    const classes = [makeClass({ id: 'c1', name: 'A' }), makeClass({ id: 'c2', name: 'B' })];
    const schedules = [
      makeSchedule({ id: 's1', class_id: 'c1' }),
      makeSchedule({ id: 's2', class_id: 'c2' }),
    ];
    expect(filterClassesAfterBatchDelete(classes, ['c1']).map((c) => c.id)).toEqual(['c2']);
    expect(filterSchedulesAfterBatchDelete(schedules, ['c1']).map((s) => s.id)).toEqual(['s2']);
  });
});

describe('resolveBatchDeleteToast', () => {
  it('全部成功', () => {
    expect(resolveBatchDeleteToast(3, 0)).toEqual({
      title: '已删除 3 个班级',
      icon: 'success',
    });
  });

  it('全部失败', () => {
    expect(resolveBatchDeleteToast(0, 2)).toEqual({
      title: '删除失败，请重试',
      icon: 'none',
    });
  });

  it('部分成功', () => {
    expect(resolveBatchDeleteToast(2, 1)).toEqual({
      title: '2个已删除，1个失败',
      icon: 'none',
      duration: 3000,
    });
  });

  it('failedCount=0 时即使 successCount=0 也走全成文案', () => {
    expect(resolveBatchDeleteToast(0, 0)).toEqual({
      title: '已删除 0 个班级',
      icon: 'success',
    });
  });
});
