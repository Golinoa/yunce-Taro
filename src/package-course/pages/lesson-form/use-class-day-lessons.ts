/**
 * 解析「这个班当天有哪几节课」，用于**没有节次信息**的入口进点名页时定位到具体那一节。
 *
 * ## 为什么需要它
 *
 * 一节课的身份 = `(排课编号, 日期)`。课表卡片入口会带上排课编号，但下面这些入口不会：
 * - 首页「快速消课」（完全不带参数，选完班才知道是哪个班）
 * - 预约页 / 线索详情（只带 classId + 日期）
 *
 * 同一个班同一天可以排多节课（例如 09:00 与 14:00 各一条规则）。不指明是哪一节，
 * 已点名状态、重复点名保护、补课/试听名单合并就只能"不区分"——给 09:00 点完名，
 * 14:00 那节进去会显示成已点名（且学员状态取自 09:00 的记录）。
 *
 * ## 口径
 *
 * - 只查**当天**的课次，数据来自后端 `/schedules/today?date=`（服务端已做
 *   规则 + 临时调课叠加 + 节假日停课推导），**不在这里自己再推导一遍**；
 * - 该班当天 **1 节** ⇒ 自动带（不打扰老师）；
 * - **≥2 节** ⇒ 必须让老师选（`needsPick`，未选不允许提交）；
 * - **0 节**（跨校区 / 不是本人排的课）⇒ 保持原行为（不带编号，按班级+日期+时段兜底，
 *   宁可多显示，不能吞学员）。
 */
import { useEffect, useMemo, useState } from 'react';
import { scheduleService, type ScheduleDayLesson } from '@/services/schedule';
import { logError } from '@/utils/logger';
import { resolveLessonSelection } from './class-day-lesson-logic';

export interface UseClassDayLessonsParams {
  /** 只在班级模式、已选定班级、且有日期时才查 */
  enabled: boolean;
  classId: string;
  lessonDate: string;
  /** URL 已带节次（课表卡片入口）⇒ 不再查、不再让用户选 */
  scheduleIdParam: string;
}

export interface UseClassDayLessonsResult {
  /** 该班当天的课次（按时段升序） */
  classLessons: ScheduleDayLesson[];
  loading: boolean;
  pickedScheduleId: string;
  setPickedScheduleId: (scheduleId: string) => void;
  /** 真正用于「哪一节」判定的排课编号；拿不到＝空串 */
  effectiveScheduleId: string;
  /** 已定位那一节的展示时段 `09:00-10:00`；未定位＝空串 */
  effectiveLessonTime: string;
  /** 该班当天有多节课且尚未选择 ⇒ 拦提交 */
  needsPick: boolean;
}

export function useClassDayLessons({
  enabled,
  classId,
  lessonDate,
  scheduleIdParam,
}: UseClassDayLessonsParams): UseClassDayLessonsResult {
  const [lessons, setLessons] = useState<ScheduleDayLesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickedScheduleId, setPickedScheduleId] = useState('');

  const needLookup = enabled && Boolean(classId) && Boolean(lessonDate) && !scheduleIdParam;

  useEffect(() => {
    if (!needLookup) {
      setLessons([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    scheduleService
      .getDayLessons(lessonDate)
      .then((list) => {
        if (!cancelled) setLessons(list);
      })
      .catch((err) => {
        // 查不到就退回"不带编号"的老行为，不要因为这一步把点名页卡住
        if (!cancelled) setLessons([]);
        logError('lesson-form/class-day-lessons', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needLookup, lessonDate]);

  // 换班 / 换日期后，之前选的那一节已不成立
  useEffect(() => {
    setPickedScheduleId('');
  }, [classId, lessonDate]);

  const classLessons = useMemo(
    () =>
      lessons
        .filter((item) => item.classId === classId)
        .sort((a, b) => (a.startTime < b.startTime ? -1 : 1)),
    [lessons, classId],
  );

  // 「选哪一节」的判定收在纯函数里（可单测），这里只负责取数与状态
  const selection = useMemo(
    () =>
      resolveLessonSelection({
        scheduleIdParam,
        pickedScheduleId,
        classLessons,
        needLookup,
      }),
    [scheduleIdParam, pickedScheduleId, classLessons, needLookup],
  );

  return {
    classLessons,
    loading,
    pickedScheduleId,
    setPickedScheduleId,
    ...selection,
  };
}
