import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  buildScheduleCardsForDate,
  buildTrialLessonKey,
  buildTrialLessonScheduleKey,
  hasTrialBookingForLesson,
  summarizeScheduleCards,
} from '@/utils/schedule-card-build';

const NOW = dayjs('2026-09-02T09:00:00');

describe('schedule-card-build (Q2-1)', () => {
  it('按星期与调课移动构建卡片，并按状态排序', () => {
    const cards = buildScheduleCardsForDate({
      date: NOW,
      now: NOW,
      filteredSchedules: [
        {
          id: 's1',
          day_of_week: 3,
          start_time: '14:00',
          end_time: '15:00',
          class_id: 'c1',
          teacher_id: 't1',
          created_at: '',
          updated_at: '',
        },
        {
          id: 's2',
          day_of_week: 2,
          start_time: '10:00',
          end_time: '11:00',
          class_id: 'c2',
          teacher_id: 't1',
          created_at: '',
          updated_at: '',
        },
      ] as never[],
      scheduleById: {
        s3: {
          id: 's3',
          day_of_week: 1,
          start_time: '08:00',
          end_time: '09:00',
          class_id: 'c3',
          teacher_id: 't1',
          created_at: '',
          updated_at: '',
          note: '调入',
        },
      } as never,
      temporaryReschedules: [
        {
          schedule_id: 's1',
          source_date: '2026-09-02',
          target_date: '2026-09-03',
          start_time: '14:00',
          end_time: '15:00',
          class_id: 'c1',
          updated_at: '',
        },
        {
          schedule_id: 's3',
          source_date: '2026-09-01',
          target_date: '2026-09-02',
          start_time: '16:00',
          end_time: '17:00',
          class_id: 'c3',
          updated_at: '',
        },
      ] as never[],
      lessonRecords: [],
      selectedClassId: '',
      classById: {
        c3: {
          id: 'c3',
          name: '调入班',
          teacher_id: 't1',
          created_at: '',
          updated_at: '',
          type: 'limited',
          status: 'active',
          used_lessons: 0,
          color: 'primary',
          student_count: 2,
        },
      } as never,
      teacherById: {},
      classStudentAvatars: {},
      trialBookingKeys: new Set([buildTrialLessonKey('c3', '2026-09-02', '16:00')]),
      currentTeacherName: '老师',
    });

    expect(cards.map((c) => c.id)).toEqual(['s3']);
    expect(cards[0]?.startTime).toBe('16:00');
    expect(cards[0]?.isTemporaryAdjusted).toBe(true);
    expect(cards[0]?.hasTrialStudent).toBe(true);
    expect(cards[0]?.className).toBe('调入班');
  });

  it('summarizeScheduleCards', () => {
    expect(
      summarizeScheduleCards([
        { checkedCount: 1 } as never,
        { checkedCount: 0 } as never,
        { checkedCount: 2 } as never,
      ]),
    ).toEqual({ total: 3, checked: 2, unchecked: 1 });
  });
});

describe('试听角标只作用于「那一节课」', () => {
  it('同班同一天多节课：只标记被预约的时段', () => {
    const keys = [buildTrialLessonKey('c1', '2026-10-05', '09:00')];
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '09:00')).toBe(true);
    // 同一天 14:00 那节课不能因为 09:00 有预约就被标成试听
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '14:00')).toBe(false);
    // 别的日期当然不标
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-12', '09:00')).toBe(false);
    // 别的班级不标
    expect(hasTrialBookingForLesson(new Set(keys), 'c2', '2026-10-05', '09:00')).toBe(false);
  });

  it('时段写法差异（09:00:00 / 09:00）视为同一节', () => {
    const keys = [buildTrialLessonKey('c1', '2026-10-05', '09:00:00')];
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '09:00')).toBe(true);
  });

  it('历史预约缺时段时按整日兜底，不掉角标', () => {
    const keys = [buildTrialLessonKey('c1', '2026-10-05', '')];
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '14:00')).toBe(true);
  });

  it('排课编号优先：这节课被同日调课改了时段，预约仍认得它', () => {
    // 预约当时记的是 09:00 那一节（编号 s1）
    const keys = [buildTrialLessonScheduleKey('c1', '2026-10-05', 's1')];
    // 该节已被调到 11:00：只比时段会失配（＝用户反馈「调课后试听学员消失」）
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '11:00', 's1')).toBe(true);
  });

  it('排课编号优先：同班同天另一节不因时段相同被误标', () => {
    const keys = [buildTrialLessonScheduleKey('c1', '2026-10-05', 's1')];
    // s2 这一节编号不同 ⇒ 不是它的试听（用时段键也命中不了 14:00）
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '14:00', 's2')).toBe(false);
  });

  it('没有排课编号（老预约 / 班级列表入口）时回落比时段', () => {
    const keys = [buildTrialLessonKey('c1', '2026-10-05', '09:00')];
    // 目标无编号 ⇒ 只能按时段判定
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '09:00')).toBe(true);
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '14:00')).toBe(false);
  });
});

/**
 * 用户口径 2026-10-01（真实投诉）：「我删了一条排课规则，**历史日期下已经上过课的卡片也消失了**」。
 * 卡片是由规则推导的 ⇒ 规则一没，所有日期的卡片全没了；而记录没有时段列，重建不出卡片。
 * ⇒ 删除 = 软停止（`STOPPED` + `stoppedAt`），读取端按「日期 ≤ stoppedAt」收窄：**停之前的历史照旧，停之后不再出课**。
 */
describe('schedule-card-build · 已删除/停止规则的日期收窄', () => {
  // 2026-09-24 / 10-01 / 10-08 都是周四（day_of_week=4）
  const stoppedRule = {
    id: 's1',
    day_of_week: 4,
    start_time: '14:00',
    end_time: '15:00',
    class_id: 'c1',
    teacher_id: 't1',
    created_at: '',
    updated_at: '',
    rule_status: 'STOPPED',
    stopped_at: '2026-10-01T09:30:00.000Z',
  };

  const buildFor = (dateStr: string) =>
    buildScheduleCardsForDate({
      date: dayjs(dateStr),
      now: dayjs('2026-10-20T09:00:00'),
      filteredSchedules: [stoppedRule] as never[],
      scheduleById: {} as never,
      temporaryReschedules: [],
      lessonRecords: [],
      selectedClassId: '',
      classById: {} as never,
      teacherById: {} as never,
      classStudentAvatars: {},
      trialBookingKeys: new Set<string>(),
      currentTeacherName: '张老师',
    });

  it('停止日之前的历史日期照旧出卡片（历史不能消失）', () => {
    expect(buildFor('2026-09-24').map((card) => card.id)).toEqual(['s1']);
  });

  it('停止当天仍算出课（按天比较，与后端 d <= stoppedAt 一致）', () => {
    expect(buildFor('2026-10-01').map((card) => card.id)).toEqual(['s1']);
  });

  it('停止之后不再出卡片（以后不该再有课）', () => {
    expect(buildFor('2026-10-08')).toEqual([]);
  });

  it('ACTIVE 规则不受影响', () => {
    const activeRule = { ...stoppedRule, rule_status: 'ACTIVE', stopped_at: undefined };
    const cards = buildScheduleCardsForDate({
      date: dayjs('2026-10-08'),
      now: dayjs('2026-10-20T09:00:00'),
      filteredSchedules: [activeRule] as never[],
      scheduleById: {} as never,
      temporaryReschedules: [],
      lessonRecords: [],
      selectedClassId: '',
      classById: {} as never,
      teacherById: {} as never,
      classStudentAvatars: {},
      trialBookingKeys: new Set<string>(),
      currentTeacherName: '张老师',
    });
    expect(cards.map((card) => card.id)).toEqual(['s1']);
  });

  /**
   * 用户最可能紧接着做的动作：删掉旧规则 → 用排课表单重建一条（表单「开始日期」默认 = 今天）。
   * 期望：历史日期只有**老规则**那一张卡片（新规则不该回填历史），未来日期只有**新规则**那张。
   */
  it('删了再重建：历史不重复、未来只有新规则', () => {
    const oldStopped = {
      ...stoppedRule,
      id: 'old',
      rule_status: 'STOPPED',
      stopped_at: '2026-10-01T09:30:00.000Z',
    };
    const rebuilt = {
      ...stoppedRule,
      id: 'new',
      rule_status: 'ACTIVE',
      stopped_at: undefined,
      start_date: '2026-10-01',
    };

    const build = (dateStr: string) =>
      buildScheduleCardsForDate({
        date: dayjs(dateStr),
        now: dayjs('2026-10-20T09:00:00'),
        filteredSchedules: [oldStopped, rebuilt] as never[],
        scheduleById: {} as never,
        temporaryReschedules: [],
        lessonRecords: [],
        selectedClassId: '',
        classById: {} as never,
        teacherById: {} as never,
        classStudentAvatars: {},
        trialBookingKeys: new Set<string>(),
        currentTeacherName: '张老师',
      });

    // 历史日期：只有老规则（新规则的开始日期在今天之后才生效）
    expect(build('2026-09-24').map((card) => card.id)).toEqual(['old']);
    // 未来日期：只有新规则（老规则已停止）
    expect(build('2026-10-08').map((card) => card.id)).toEqual(['new']);
  });
});
