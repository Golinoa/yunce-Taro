/**
 * 课表页派生数据：Tab / 过滤班级与排课 / 卡片映射 / 日历红点 / 批量选项（Q2-1）
 */
import dayjs from 'dayjs';
import { useCallback, useMemo } from 'react';
import { type CalendarDotType } from '@/components/CalendarWeekSelector';
import type { Class } from '@/types/class';
import type { CourseCategoryConfig } from '@/types/course-category';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import {
  buildScheduleCardsForDate,
  summarizeScheduleCards,
  type ScheduleCardItem,
  type ScheduleCardStudentAvatar,
} from '@/utils/schedule-card-build';
import { getWeekdayText } from '@/utils/schedule-card-status';
import { buildDangerActionMeta } from '@/utils/schedule-danger-meta';
import { parseTimeToMinutes } from '@/utils/schedule-guard';
import {
  buildScheduleTabs,
  filterClassesForTab,
  filterSchedulesForTab,
  resolveActiveCategoryIds,
  resolveDateDotType,
  resolveOpenDateDotType,
  type ScheduleTabItem,
  type ScheduleTabType,
} from './schedule-derived-logic';
import type { ScheduleBatchClassOption } from './ScheduleBatchSheets';
import type { ScheduleDangerActionState } from './use-schedule-danger-actions';

export type { ScheduleTabItem, ScheduleTabType };

export interface UseScheduleDerivedParams {
  categories: CourseCategoryConfig[];
  venueBookingEnabled: boolean;
  activeTabKey: string;
  classes: Class[];
  schedules: Schedule[];
  teachers: TeacherUIModel[];
  isParent: boolean;
  parentClassIds: Set<string>;
  selectedClassId: string;
  currentTime: dayjs.Dayjs;
  temporaryReschedules: TemporaryReschedule[];
  lessonRecords: LessonRecord[];
  classStudentAvatars: Record<string, ScheduleCardStudentAvatar[]>;
  trialBookingKeys: Set<string>;
  currentTeacherName: string;
  openSlotDates: Set<string>;
  batchSelectedClassIds: string[];
  dangerActionState: ScheduleDangerActionState;
  selectedDate: dayjs.Dayjs;
}

export function useScheduleDerived(params: UseScheduleDerivedParams) {
  const {
    categories,
    venueBookingEnabled,
    activeTabKey,
    classes,
    schedules,
    teachers,
    isParent,
    parentClassIds,
    selectedClassId,
    currentTime,
    temporaryReschedules,
    lessonRecords,
    classStudentAvatars,
    trialBookingKeys,
    currentTeacherName,
    openSlotDates,
    batchSelectedClassIds,
    dangerActionState,
    selectedDate,
  } = params;

  /** 根据课程分类生成顶部 Tab：基础模式 Tab + 场地 + 独立展示分类，统一按 sortOrder 排序 */
  const tabs = useMemo<ScheduleTabItem[]>(
    () => buildScheduleTabs(categories, venueBookingEnabled),
    [categories, venueBookingEnabled],
  );

  const activeTab = useMemo(
    () => tabs.find((item) => item.key === activeTabKey) || tabs[0],
    [tabs, activeTabKey],
  );

  /** 当前 Tab 应包含的分类 ID 集合 */
  const activeCategoryIds = useMemo(
    () => resolveActiveCategoryIds(activeTab, categories),
    [activeTab, categories],
  );

  /** 按当前 Tab 过滤后的班级列表 */
  const filteredClasses = useMemo(
    () =>
      filterClassesForTab({
        activeTab,
        activeCategoryIds,
        classes,
        isParent,
        parentClassIds,
      }),
    [activeTab, activeCategoryIds, classes, isParent, parentClassIds],
  );

  /** 按当前 Tab 过滤后的排课规则（停课班级不展开课表） */
  const filteredSchedules = useMemo(
    () => filterSchedulesForTab(activeTab, filteredClasses, schedules),
    [activeTab, filteredClasses, schedules],
  );

  const pausedClasses = useMemo(
    () => filteredClasses.filter((item) => item.status === 'paused'),
    [filteredClasses],
  );

  const classById = useMemo(
    () =>
      filteredClasses.reduce<Record<string, Class>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [filteredClasses],
  );

  const teacherById = useMemo(
    () =>
      teachers.reduce<Record<string, TeacherUIModel>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [teachers],
  );

  const scheduleById = useMemo(
    () =>
      filteredSchedules.reduce<Record<string, Schedule>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [filteredSchedules],
  );

  const scheduleMapByClass = useMemo(
    () =>
      filteredSchedules.reduce<Record<string, Schedule[]>>((acc, item) => {
        if (!item.class_id) {
          return acc;
        }
        if (!acc[item.class_id]) {
          acc[item.class_id] = [];
        }
        acc[item.class_id].push(item);
        return acc;
      }, {}),
    [filteredSchedules],
  );

  const buildCardsForDate = useCallback(
    (date: dayjs.Dayjs): ScheduleCardItem[] =>
      buildScheduleCardsForDate({
        date,
        now: currentTime,
        filteredSchedules,
        scheduleById,
        temporaryReschedules,
        lessonRecords,
        selectedClassId,
        classById,
        teacherById,
        classStudentAvatars,
        trialBookingKeys,
        currentTeacherName,
      }),
    [
      classById,
      classStudentAvatars,
      currentTime,
      currentTeacherName,
      lessonRecords,
      scheduleById,
      filteredSchedules,
      selectedClassId,
      teacherById,
      trialBookingKeys,
      temporaryReschedules,
    ],
  );

  const calendarWeekdaySet = useMemo(() => {
    return new Set(
      filteredSchedules
        .filter((item) => !selectedClassId || item.class_id === selectedClassId)
        .map((item) => item.day_of_week),
    );
  }, [filteredSchedules, selectedClassId]);

  const getDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType =>
      resolveDateDotType({
        date,
        currentTime,
        filteredSchedules,
        selectedClassId,
        temporaryReschedules,
        calendarWeekdaySet,
      }),
    [calendarWeekdaySet, currentTime, filteredSchedules, selectedClassId, temporaryReschedules],
  );

  const getOpenDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType =>
      resolveOpenDateDotType(date, currentTime, openSlotDates),
    [currentTime, openSlotDates],
  );

  const batchClassOptions = useMemo((): ScheduleBatchClassOption[] => {
    return filteredClasses
      .filter((item) => item.status === 'active')
      .map((item) => {
        const relatedSchedules = [...(scheduleMapByClass[item.id] || [])].sort(
          (left, right) =>
            parseTimeToMinutes(left.start_time) - parseTimeToMinutes(right.start_time),
        );
        const scheduleSummary =
          item.schedule ||
          (relatedSchedules.length > 0
            ? relatedSchedules
                .slice(0, 2)
                .map(
                  (schedule) =>
                    `${getWeekdayText(schedule.day_of_week)} ${schedule.start_time}-${schedule.end_time}`,
                )
                .join(' / ')
            : '未设置排课');

        return {
          id: item.id,
          name: item.name,
          studentCount: item.student_count,
          scheduleSummary,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  }, [filteredClasses, scheduleMapByClass]);

  const selectedBatchClasses = useMemo(
    () => batchClassOptions.filter((item) => batchSelectedClassIds.includes(item.id)),
    [batchClassOptions, batchSelectedClassIds],
  );

  const dangerActionMeta = useMemo(
    () =>
      buildDangerActionMeta({
        type: dangerActionState.type,
        item: dangerActionState.item,
        lessonDate: selectedDate.format('YYYY-MM-DD'),
        batchCount: selectedBatchClasses.length,
      }),
    [dangerActionState.item, dangerActionState.type, selectedBatchClasses.length, selectedDate],
  );

  const renderDateCards = useCallback(
    (date: dayjs.Dayjs) => {
      const cards = buildCardsForDate(date);
      return { cards, summary: summarizeScheduleCards(cards) };
    },
    [buildCardsForDate],
  );

  return {
    tabs,
    activeTab,
    filteredClasses,
    filteredSchedules,
    pausedClasses,
    classById,
    teacherById,
    scheduleById,
    buildCardsForDate,
    getDateDotType,
    getOpenDateDotType,
    batchClassOptions,
    selectedBatchClasses,
    dangerActionMeta,
    renderDateCards,
  };
}
