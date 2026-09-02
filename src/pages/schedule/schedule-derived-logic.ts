/**
 * 课表派生纯逻辑（供 use-schedule-derived 与单测共用）
 * 使用场景：Tab 生成、班级/排课过滤、日历红点判定——无 React / 无副作用。
 */
import type { CalendarDotType } from '@/components/CalendarWeekSelector';
import type { Class } from '@/types/class';
import type { CourseCategoryConfig, CourseCategoryMode } from '@/types/course-category';
import type { Schedule } from '@/types/schedule';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import type { Dayjs } from 'dayjs';

export type ScheduleTabType = 'category' | 'venue';

export interface ScheduleTabItem {
  key: string;
  type: ScheduleTabType;
  label: string;
  mode?: CourseCategoryMode;
  categoryId?: string;
  sortOrder: number;
}

const BASE_MODE_LABEL: Record<CourseCategoryMode, string> = {
  class: '班课',
  group: '团课',
  private: '私教',
};

/** 根据课程分类生成顶部 Tab：基础模式 Tab + 场地 + 独立展示分类，按 sortOrder 排序。 */
export function buildScheduleTabs(
  categories: CourseCategoryConfig[],
  venueBookingEnabled: boolean,
): ScheduleTabItem[] {
  const result: ScheduleTabItem[] = [];
  const modes: CourseCategoryMode[] = ['class', 'group', 'private'];

  modes.forEach((mode) => {
    const mergedCategories = categories.filter((c) => c.mode === mode && !c.independentDisplay);
    if (mergedCategories.length === 0) return;
    const systemCategory = mergedCategories.find((c) => c.isSystem);
    const minSortOrder = Math.min(...mergedCategories.map((c) => c.sortOrder));
    result.push({
      key: `mode-${mode}`,
      type: 'category',
      label: systemCategory?.name || BASE_MODE_LABEL[mode],
      mode,
      sortOrder: minSortOrder,
    });
  });

  if (venueBookingEnabled) {
    result.push({ key: 'venue', type: 'venue', label: '场地', sortOrder: 4 });
  }

  categories
    .filter((c) => c.independentDisplay)
    .forEach((category) => {
      result.push({
        key: `category-${category.id}`,
        type: 'category',
        label: category.name,
        mode: category.mode,
        categoryId: category.id,
        sortOrder: category.sortOrder,
      });
    });

  return result.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 当前 Tab 应包含的分类 ID 集合；场地 Tab 返回空集。 */
export function resolveActiveCategoryIds(
  activeTab: ScheduleTabItem | undefined,
  categories: CourseCategoryConfig[],
): Set<string> {
  if (!activeTab || activeTab.type === 'venue') return new Set<string>();
  if (activeTab.categoryId) return new Set<string>([activeTab.categoryId]);
  return new Set<string>(
    categories.filter((c) => c.mode === activeTab.mode && !c.independentDisplay).map((c) => c.id),
  );
}

export interface FilterClassesForTabParams {
  activeTab: ScheduleTabItem | undefined;
  activeCategoryIds: Set<string>;
  classes: Class[];
  isParent: boolean;
  parentClassIds: Set<string>;
}

/** 按当前 Tab 过滤班级（含家长可见范围与无 category_id 的兼容分支）。 */
export function filterClassesForTab(params: FilterClassesForTabParams): Class[] {
  const { activeTab, activeCategoryIds, classes, isParent, parentClassIds } = params;
  if (!activeTab || activeTab.type === 'venue') return [];
  return classes.filter((cls) => {
    if (cls.category_id) {
      if (!activeCategoryIds.has(cls.category_id)) return false;
    } else if (activeTab.mode === 'group') {
      if (cls.schedule_mode !== 'open') return false;
    } else if (activeTab.mode === 'class') {
      if (cls.schedule_mode && cls.schedule_mode !== 'fixed') return false;
    } else {
      return false;
    }
    if (isParent && (activeTab.mode === 'class' || activeTab.mode === 'group')) {
      return parentClassIds.has(cls.id);
    }
    return true;
  });
}

/** 按当前 Tab 过滤排课规则；停课班级不展开课表。 */
export function filterSchedulesForTab(
  activeTab: ScheduleTabItem | undefined,
  filteredClasses: Class[],
  schedules: Schedule[],
): Schedule[] {
  if (!activeTab || activeTab.type === 'venue') return [];
  const classIds = new Set(filteredClasses.map((item) => item.id));
  const pausedIds = new Set(
    filteredClasses.filter((item) => item.status === 'paused').map((item) => item.id),
  );
  return schedules.filter((item) => {
    if (!item.class_id) return true;
    if (!classIds.has(item.class_id)) return false;
    if (pausedIds.has(item.class_id)) return false;
    return true;
  });
}

export interface ResolveDateDotTypeParams {
  date: Dayjs;
  currentTime: Dayjs;
  filteredSchedules: Schedule[];
  selectedClassId: string;
  temporaryReschedules: TemporaryReschedule[];
  calendarWeekdaySet: Set<Schedule['day_of_week']>;
}

/** 固定排课日历红点：无课 none / 过去 past / 否则 active。 */
export function resolveDateDotType(params: ResolveDateDotTypeParams): CalendarDotType {
  const {
    date,
    currentTime,
    filteredSchedules,
    selectedClassId,
    temporaryReschedules,
    calendarWeekdaySet,
  } = params;
  const weekday = (date.day() || 7) as Schedule['day_of_week'];
  const dateStr = date.format('YYYY-MM-DD');
  const movedOutScheduleIdSet = new Set(
    temporaryReschedules
      .filter((item) => item.source_date === dateStr)
      .map((item) => item.schedule_id),
  );
  const fixedCount = filteredSchedules.filter(
    (item) =>
      item.day_of_week === weekday &&
      (!selectedClassId || item.class_id === selectedClassId) &&
      !movedOutScheduleIdSet.has(item.id),
  ).length;
  const movedInCount = temporaryReschedules.filter(
    (item) =>
      item.target_date === dateStr && (!selectedClassId || item.class_id === selectedClassId),
  ).length;

  if (!calendarWeekdaySet.has(weekday) && movedInCount === 0) return 'none';
  if (fixedCount + movedInCount === 0) return 'none';
  return date.isBefore(currentTime, 'day') ? 'past' : 'active';
}

/** 开放预约日历红点。 */
export function resolveOpenDateDotType(
  date: Dayjs,
  currentTime: Dayjs,
  openSlotDates: Set<string>,
): CalendarDotType {
  const dateStr = date.format('YYYY-MM-DD');
  if (!openSlotDates.has(dateStr)) return 'none';
  return date.isBefore(currentTime, 'day') ? 'past' : 'active';
}
