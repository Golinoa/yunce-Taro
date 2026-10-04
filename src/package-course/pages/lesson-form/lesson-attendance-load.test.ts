import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memberCardService, subjectService } from '@/services';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import {
  buildClassAttendanceState,
  buildTrialCheckinMap,
  filterApprovedLeaveStudentIds,
  isDateWithinRange,
  loadMemberCardMapsForStudents,
  mapRecordStatusToCheckin,
  resolveClassAttendanceMode,
} from './lesson-attendance-load';

vi.mock('@/services', () => ({
  leaveService: { getByTeacher: vi.fn(async () => []) },
  memberCardService: { getByStudent: vi.fn() },
  subjectService: { getById: vi.fn() },
}));

const student = (id: string) => ({ id }) as Student;

const card = (overrides: Partial<MemberCardDetail>): MemberCardDetail =>
  ({
    id: 'c1',
    status: 'active',
    cardTypeName: '课时卡',
    remainingCount: 8,
    remainingGiftCount: 0,
    ...overrides,
  }) as MemberCardDetail;

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

  it('同班同一天多节课：带 scheduleId 时只认本节记录（09:00 点完名不影响 14:00）', () => {
    const records = [
      {
        id: 'r-0900',
        student_id: 'a',
        class_id: 'c1',
        lesson_date: '2026-09-02',
        schedule_id: 's-0900',
        status: 'normal',
      },
    ] as never[];

    const morning = buildClassAttendanceState({
      classId: 'c1',
      lessonDate: '2026-09-02',
      studentIds: ['a'],
      records,
      scheduleId: 's-0900',
    });
    expect(morning.hasRecords).toBe(true);
    expect([...morning.checkedStudentIds]).toEqual(['a']);

    // 当天 14:00 那节不能被 09:00 的记录带成「已点名」
    const afternoon = buildClassAttendanceState({
      classId: 'c1',
      lessonDate: '2026-09-02',
      studentIds: ['a'],
      records,
      scheduleId: 's-1400',
    });
    expect(afternoon.hasRecords).toBe(false);
    expect([...afternoon.checkedStudentIds]).toEqual([]);

    // 拿不到 scheduleId（从班级列表进入）⇒ 不区分，保持原行为
    const unknownLesson = buildClassAttendanceState({
      classId: 'c1',
      lessonDate: '2026-09-02',
      studentIds: ['a'],
      records,
    });
    expect(unknownLesson.hasRecords).toBe(true);
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

  it('buildTrialCheckinMap 按预约状态映射：已签到 / 请假 / 其余未到', () => {
    const map = buildTrialCheckinMap({
      bookings: [
        { id: 'b1', status: 'completed' },
        { id: 'b2', status: 'cancelled' },
        { id: 'b3', status: 'no_show' },
        { id: 'b4', status: 'confirmed' },
        { id: 'b5' },
      ],
    });
    expect(map.b1).toBe('checked');
    expect(map.b2).toBe('leave');
    expect(map.b3).toBe('absent');
    expect(map.b4).toBe('absent');
    expect(map.b5).toBe('absent');
  });

  it('空学员 / 空记录：出勤状态与试听映射不抛错', () => {
    const emptyState = buildClassAttendanceState({
      classId: 'c1',
      lessonDate: '2026-09-02',
      studentIds: [],
      records: [
        { id: '1', student_id: 'a', class_id: 'c1', lesson_date: '2026-09-02', status: 'normal' },
      ] as never[],
    });
    expect(emptyState.hasRecords).toBe(false);
    expect(emptyState.checkedStudentIds.size).toBe(0);

    const noRecords = buildClassAttendanceState({
      classId: 'c1',
      lessonDate: '2026-09-02',
      studentIds: ['a'],
      records: [],
    });
    expect(noRecords.hasRecords).toBe(false);
    expect(noRecords.recordByStudentId.size).toBe(0);

    expect(
      buildTrialCheckinMap({
        bookings: [],
      }),
    ).toEqual({});
  });

  it('窗口外 / 已有记录 → view（拒绝进入可操作补录模式）', () => {
    const now = new Date('2026-09-02T12:00:00');
    // 超 30 天：仅查看，与课表「超时隐藏补录 / viewOnly」口径一致
    expect(
      resolveClassAttendanceMode({
        hasRecords: false,
        viewOnly: false,
        lessonDate: '2026-08-02',
        now,
      }),
    ).toBe('view');
    // 窗口边界日仍可 normal
    expect(
      resolveClassAttendanceMode({
        hasRecords: false,
        viewOnly: false,
        lessonDate: '2026-08-03',
        now,
      }),
    ).toBe('normal');
    // 已有点名记录即使在窗内也是 view（补录需显式切 supplement）
    expect(
      resolveClassAttendanceMode({
        hasRecords: true,
        viewOnly: false,
        lessonDate: '2026-09-01',
        now,
      }),
    ).toBe('view');
  });

  it('mapRecordStatusToCheckin：空状态与未知态', () => {
    expect(mapRecordStatusToCheckin(undefined)).toBe('absent');
    expect(mapRecordStatusToCheckin(null)).toBe('absent');
    expect(mapRecordStatusToCheckin('')).toBe('absent');
  });
});

describe('loadMemberCardMapsForStudents：并发 + 同学科只查一次', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('同学科的多个学员：subjectService.getById 只调一次，结果与逐学员查一致', async () => {
    const getCards = vi.mocked(memberCardService.getByStudent);
    const getSubject = vi.mocked(subjectService.getById);
    getCards.mockImplementation(async () => [card({ id: 'c1', cardTypeSubjectId: 'sub-1' })]);
    getSubject.mockResolvedValue({ id: 'sub-1', name: '数学' } as never);

    const { memberCards, subjects } = await loadMemberCardMapsForStudents([
      student('s1'),
      student('s2'),
      student('s3'),
    ]);

    expect(getCards).toHaveBeenCalledTimes(3);
    expect(getSubject).toHaveBeenCalledTimes(1);
    expect(memberCards.get('s1')?.[0]?.id).toBe('c1');
    expect(subjects.get('s1')?.name).toBe('数学');
    expect(subjects.get('s3')?.name).toBe('数学');
  });

  it('无卡的学员：memberCards 落空数组；有卡但卡种无科目时 subjects 落 null', async () => {
    const getCards = vi.mocked(memberCardService.getByStudent);
    const getSubject = vi.mocked(subjectService.getById);
    getCards.mockImplementation(async (studentId: string) =>
      studentId === 'empty' ? [] : [card({ id: 'c1' })],
    );
    getSubject.mockClear();

    const { memberCards, subjects } = await loadMemberCardMapsForStudents([
      student('empty'),
      student('s1'),
    ]);

    expect(memberCards.get('empty')).toEqual([]);
    expect(subjects.get('empty')).toBeNull();
    expect(subjects.get('s1')).toBeNull();
    expect(getSubject).not.toHaveBeenCalled();
  });

  it('并发有上限：10 个学员不会同时打满 10 个请求', async () => {
    const getCards = vi.mocked(memberCardService.getByStudent);
    let running = 0;
    let peak = 0;
    getCards.mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return [] as MemberCardDetail[];
    });

    await loadMemberCardMapsForStudents(
      Array.from({ length: 10 }, (_, index) => student(`s${index}`)),
    );

    expect(getCards).toHaveBeenCalledTimes(10);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(6);
  });

  it('空学员列表不发任何请求', async () => {
    const getCards = vi.mocked(memberCardService.getByStudent);
    getCards.mockClear();

    const { memberCards, subjects } = await loadMemberCardMapsForStudents([]);

    expect(memberCards.size).toBe(0);
    expect(subjects.size).toBe(0);
    expect(getCards).not.toHaveBeenCalled();
  });
});
