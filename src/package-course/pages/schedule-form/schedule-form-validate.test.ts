import { describe, expect, it } from 'vitest';
import type { DayOfWeek } from '@/types/schedule';
import {
  formatRescheduleTimeLabel,
  getLimitedClassRemaining,
  getScheduleFormSubmitBlockedReason,
  validateRescheduleSaveInput,
} from './schedule-form-validate';
import {
  buildScheduleRuleNote,
  buildScheduleSaveSuccessTitle,
  buildScheduleSaveTargets,
  mergeScheduleConflictResults,
} from './schedule-form-save';

describe('schedule-form-validate (Q2-3)', () => {
  const base = {
    currentUserId: 'u1',
    mode: 'class' as const,
    classId: 'c1',
    selectedTeachingTeacherId: 't1',
    isGroupMode: false,
    slotMaxCount: 4,
    minOpenCount: 2,
    timeSlots: [{ start: '10:00', end: '11:00' }],
    schedulingMode: 'rule' as const,
    startDate: '2026-09-02',
    repeatMode: 'weekly',
    selectedDays: [3] as DayOfWeek[],
    endMode: 'never' as const,
    endDate: '',
    endCount: 1,
    freeDates: [] as string[],
    selectedClass: null as null,
  };

  it('必填与时间校验', () => {
    expect(getScheduleFormSubmitBlockedReason({ ...base, currentUserId: '' })).toBe(
      '未获取到登录信息',
    );
    expect(getScheduleFormSubmitBlockedReason({ ...base, mode: 'student' })).toBe(
      '真实联调仅支持班级排课',
    );
    expect(getScheduleFormSubmitBlockedReason({ ...base, classId: '' })).toBe('请选择班级');
    expect(
      getScheduleFormSubmitBlockedReason({ ...base, selectedTeachingTeacherId: '' }),
    ).toBe('请选择主讲老师');
    expect(getScheduleFormSubmitBlockedReason({ ...base, timeSlots: [] })).toBe(
      '请添加上课时间',
    );
    expect(
      getScheduleFormSubmitBlockedReason({
        ...base,
        timeSlots: [{ start: '11:00', end: '10:00' }],
      }),
    ).toBe('结束时间需晚于开始时间');
    expect(getScheduleFormSubmitBlockedReason(base)).toBe('');
  });

  it('团课人数与 limited 课时限制', () => {
    expect(
      getScheduleFormSubmitBlockedReason({
        ...base,
        isGroupMode: true,
        minOpenCount: 5,
        slotMaxCount: 4,
      }),
    ).toBe('最少开班人数不能大于每时段可约人数');

    expect(getLimitedClassRemaining({ total_lessons: 10, used_lessons: 8 })).toBe(2);
    expect(
      getScheduleFormSubmitBlockedReason({
        ...base,
        endMode: 'never',
        selectedClass: { type: 'limited', total_lessons: 10, used_lessons: 10 },
      }),
    ).toBe('该班级课时已用完，无法继续排课');
    expect(
      getScheduleFormSubmitBlockedReason({
        ...base,
        endMode: 'by_count',
        endCount: 5,
        selectedClass: { type: 'limited', total_lessons: 10, used_lessons: 8 },
      }),
    ).toContain('按次数不能超过剩余课时');
  });

  it('validateRescheduleSaveInput', () => {
    expect(
      validateRescheduleSaveInput({
        originalSchedule: null,
        sourceLessonDate: '2026-09-02',
        targetDate: '2026-09-03',
        startTime: '10:00',
        endTime: '11:00',
      }),
    ).toBe('未找到原课程信息');
    expect(
      validateRescheduleSaveInput({
        originalSchedule: { start_time: '10:00', end_time: '11:00' },
        sourceLessonDate: '2026-09-02',
        targetDate: '2026-09-02',
        startTime: '10:00',
        endTime: '11:00',
      }),
    ).toBe('请至少调整日期或时间');
    expect(
      validateRescheduleSaveInput({
        originalSchedule: { start_time: '10:00', end_time: '11:00' },
        sourceLessonDate: '2026-09-02',
        targetDate: '2026-09-03',
        startTime: '10:00',
        endTime: '11:00',
      }),
    ).toBeNull();
    expect(formatRescheduleTimeLabel('2026-09-02', '10:00', '11:00')).toContain('09月02日');
  });
});

describe('schedule-form-save helpers (Q2-3)', () => {
  it('buildScheduleSaveTargets rule/free', () => {
    expect(
      buildScheduleSaveTargets({
        schedulingMode: 'rule',
        repeatMode: 'weekly',
        startDate: '2026-09-02',
        selectedDays: [3, 5] as DayOfWeek[],
        freeDates: [],
        timeSlots: [
          { start: '10:00', end: '11:00' },
          { start: '14:00', end: '15:00' },
        ],
      }),
    ).toHaveLength(4);

    expect(
      buildScheduleSaveTargets({
        schedulingMode: 'free',
        repeatMode: 'weekly',
        startDate: '',
        selectedDays: [] as DayOfWeek[],
        freeDates: ['2026-09-02', '2026-09-03'],
        timeSlots: [{ start: '10:00', end: '11:00' }],
      }).map((t) => t.dateHint),
    ).toEqual(['2026-09-02', '2026-09-03']);
  });

  it('buildScheduleRuleNote / merge conflicts / success title', () => {
    const note = buildScheduleRuleNote({
      note: '备注',
      isGroupMode: false,
      autoOpenType: 'manual',
      slotMaxCount: 4,
      minOpenCount: 2,
      schedulingMode: 'rule',
      repeatMode: 'weekly',
      startDate: '2026-09-02',
      endMode: 'never',
      endDate: '',
      endCount: 1,
      scheduleOnHoliday: false,
      consumedHours: 1,
    });
    expect(note).toContain('备注');
    expect(note).toContain('类型:班课');

    const merged = mergeScheduleConflictResults([
      {
        hasConflict: true,
        conflictSummary: '',
        conflicts: [
          { id: 'a', conflictTypes: ['time', 'teacher'] },
          { id: 'b', conflictTypes: ['room'] },
        ],
      } as never,
      {
        hasConflict: true,
        conflictSummary: '',
        conflicts: [{ id: 'a', conflictTypes: ['time'] }],
      } as never,
    ]);
    expect(merged.hasConflict).toBe(true);
    expect(merged.conflicts).toHaveLength(2);
    expect(merged.conflictSummary).toContain('时间冲突');
    expect(merged.conflictSummary).toContain('教室冲突');

    expect(buildScheduleSaveSuccessTitle({ isEdit: true, targetCount: 3 })).toBe('保存成功');
    expect(buildScheduleSaveSuccessTitle({ isEdit: false, targetCount: 3 })).toBe(
      '已添加 3 条排课',
    );
  });
});
