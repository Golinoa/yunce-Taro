import { describe, expect, it } from 'vitest';
import {
  buildClassAttendanceState,
  buildTrialCheckinMap,
  filterApprovedLeaveStudentIds,
  isDateWithinRange,
  mapRecordStatusToCheckin,
  resolveClassAttendanceMode,
} from './lesson-attendance-load';

describe('lesson-attendance-load (Q2-2)', () => {
  it('isDateWithinRange 含端点', () => {
    expect(isDateWithinRange('2026-09-02', '2026-09-01', '2026-09-03')).toBe(true);
    expect(isDateWithinRange('2026-09-02', '2026-09-02')).toBe(true);
    expect(isDateWithinRange('2026-09-04', '2026-09-01', '2026-09-03')).toBe(false);
    expect(isDateWithinRange('2026-09-02', undefined)).toBe(false);
  });

  it('mapRecordStatusToCheckin', () => {
    expect(mapRecordStatusToCheckin('leave')).toBe('leave');
    expect(mapRecordStatusToCheckin('normal')).toBe('checked');
    expect(mapRecordStatusToCheckin('makeup')).toBe('checked');
    expect(mapRecordStatusToCheckin('absent')).toBe('absent');
    expect(mapRecordStatusToCheckin('cancelled')).toBe('absent');
  });

  it('filterApprovedLeaveStudentIds 只收审批且落在日期窗内', () => {
    const ids = filterApprovedLeaveStudentIds({
      lessonDate: '2026-09-02',
      students: [{ id: 's1' }, { id: 's2' }],
      leaves: [
        {
          status: 'approved',
          student_id: 's1',
          original_date: '2026-09-01',
          end_date: '2026-09-03',
        },
        { status: 'pending', student_id: 's2', original_date: '2026-09-02' },
        { status: 'approved', student_id: 's3', original_date: '2026-09-02' },
      ],
    });
    expect([...ids]).toEqual(['s1']);
  });

  it('buildClassAttendanceState 回填签到/请假与优先级记录', () => {
    const state = buildClassAttendanceState({
      classId: 'c1',
      lessonDate: '2026-09-02',
      studentIds: ['a', 'b'],
      records: [
        { id: '1', student_id: 'a', class_id: 'c1', lesson_date: '2026-09-02', status: 'leave' },
        { id: '2', student_id: 'b', class_id: 'c1', lesson_date: '2026-09-02', status: 'normal' },
        {
          id: '3',
          student_id: 'b',
          class_id: 'c1',
          lesson_date: '2026-09-02',
          status: 'cancelled',
        },
        { id: '4', student_id: 'x', class_id: 'c1', lesson_date: '2026-09-02', status: 'normal' },
      ] as never[],
    });
    expect(state.hasRecords).toBe(true);
    expect([...state.leaveStudentIds]).toEqual(['a']);
    expect([...state.checkedStudentIds]).toEqual(['b']);
    expect(state.recordByStudentId.get('b')?.id).toBe('2');
  });

  it('resolveClassAttendanceMode：已点名或超窗为 view', () => {
    const now = new Date('2026-09-02T12:00:00');
    expect(
      resolveClassAttendanceMode({
        hasRecords: true,
        viewOnly: false,
        lessonDate: '2026-09-01',
        now,
      }),
    ).toBe('view');
    expect(
      resolveClassAttendanceMode({
        hasRecords: false,
        viewOnly: false,
        lessonDate: '2026-09-01',
        now,
      }),
    ).toBe('normal');
    expect(
      resolveClassAttendanceMode({
        hasRecords: false,
        viewOnly: true,
        lessonDate: '2026-09-01',
        now,
      }),
    ).toBe('view');
    expect(
      resolveClassAttendanceMode({
        hasRecords: false,
        viewOnly: false,
        lessonDate: '2026-07-01',
        now,
      }),
    ).toBe('view');
  });

  it('buildTrialCheckinMap 无记录默认未到', () => {
    const map = buildTrialCheckinMap({
      classId: 'c1',
      lessonDate: '2026-09-02',
      bookings: [
        { id: 'b1', trial_student_id: 't1' },
        { id: 'b2', trial_student_id: 't2' },
      ],
      records: [
        {
          id: 'r1',
          student_id: 't1',
          class_id: 'c1',
          lesson_date: '2026-09-02',
          status: 'normal',
        },
      ] as never[],
    });
    expect(map.b1).toBe('checked');
    expect(map.b2).toBe('absent');
  });
});
