/**
 * Service 层 — 首页相关 API
 */
import type { RecentGroup, RecentStudent } from '@/components/home/RecentLessonList';
import type { TodoItem } from '@/components/home/TodoList';
import {
  mockGetTeacher,
  mockGetStudents,
  mockGetTodaySchedules,
  mockGetRecentRecords,
  mockGetStudentPackages,
  mockGetTotalRemainingHours,
  mockGetUnreadCount,
  mockGetTodayRecordCount,
  mockGetStudentsByParent as mockHomeGetStudentsByParent,
  mockGetSchedulesByStudent,
  mockGetRecordsByStudent as mockHomeGetRecordsByStudent,
  mockGetPackagesByStudent as mockHomeGetPackagesByStudent,
  mockGetStatsByPeriod,
  mockGetTodoItems,
  mockGetRecentGroups,
  mockGetOperationContent,
  HOME_QUICK_ENTRIES,
} from '@/data/home';
import type {
  StatsPeriod,
  StatsData,
  QuickEntry,
  TodoItemData,
  RecentGroupData,
  HomeOperationContentData,
  OperationActionConfigData,
  OperationActivityItemData,
  OperationBannerItemData,
} from '@/data/home';
import { CLASSES, COURSE_PACKAGES, LESSON_RECORDS, STUDENTS, TEACHERS } from '@/data/mock-database';
import type { UserRole } from '@/types/profile';
import type { Schedule } from '@/types/schedule';
import { get } from '@/utils/request';
import { statisticsService } from './statistics';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

type RawHomeTeacher = NonNullable<Awaited<ReturnType<typeof mockGetTeacher>>>;
type RawHomeSchedule = Awaited<ReturnType<typeof mockGetTodaySchedules>>[number];

interface BackendTeacherHomeResponse {
  recentRecords: Array<{
    content?: null | string;
    duration?: number;
    hoursUsed?: number;
    id: string;
    lessonDate: string;
    performance?: null | string;
    student?: {
      avatar?: null | string;
      id: string;
      name: string;
    } | null;
  }>;
  stats: {
    activePackageCount: number;
    studentCount: number;
    todayRecordCount: number;
    todayScheduleCount: number;
    totalRemainingHours: number;
    unreadNotificationCount: number;
  };
  students: Array<{
    avatar?: null | string;
    id: string;
    name: string;
    nickname?: null | string;
    remainingHours: number;
  }>;
  teacher: {
    avatar?: null | string;
    id: string;
    institution?: null | string;
    inviteCode?: null | string;
    name?: null | string;
    nickname?: null | string;
  };
  todaySchedules: Array<{
    class?: {
      id: string;
      name: string;
      subject?: null | string;
    } | null;
    color?: null | string;
    endTime: string;
    id: string;
    note?: null | string;
    startTime: string;
  }>;
}

interface BackendTeacherStatsResponse {
  lessonCount: number;
  packageCount: number;
  period: string;
  studentCount: number;
  totalHours: number;
}

interface BackendTeacherTodosResponse {
  expiringPackages: number;
  lowHourStudents: number;
  pendingLeaves: number;
}

interface BackendUnreadCountResponse {
  count: number;
}

interface BackendOperationActionConfig {
  appId?: null | string;
  path?: null | string;
  type?: null | string;
  url?: null | string;
}

interface BackendOperationDisplayConfig {
  badgeText?: null | string;
  theme?: null | string;
}

interface BackendOperationItem {
  actionConfig?: BackendOperationActionConfig | null;
  content?: null | string;
  coverImageUrl?: null | string;
  displayConfig?: BackendOperationDisplayConfig | null;
  id: string;
  imageUrl?: null | string;
  summary?: null | string;
  title?: null | string;
}

interface BackendHomeOperationResponse {
  placements?: {
    banners?: BackendOperationItem[] | null;
    cards?: BackendOperationItem[] | null;
    floatings?: BackendOperationItem[] | null;
    notices?: BackendOperationItem[] | null;
    popups?: BackendOperationItem[] | null;
  } | null;
  updatedAt?: null | string;
}

export interface HomeTeacherSummary {
  id: string;
  name: string;
  avatar?: string;
  role: RawHomeTeacher['role'];
  status: RawHomeTeacher['status'];
  totalHours: number;
  monthHours: number;
  pendingSalary: number;
}

export type HomeTodoItem = TodoItem;
export type HomeRecentGroup = RecentGroup;
export type HomeScheduleItem = Schedule;
export type HomeOperationContent = HomeOperationContentData;
export type OperationActionConfig = OperationActionConfigData;
export type OperationActivityItem = OperationActivityItemData;
export type OperationBannerItem = OperationBannerItemData;

export type { StatsPeriod, StatsData, QuickEntry };

const TODO_CONFIG_MAP: Record<
  TodoItemData['type'],
  { icon: string; iconBg: TodoItem['iconBg']; url?: string }
> = {
  alert: {
    icon: 'mdi-alert-circle-outline',
    iconBg: 'alert',
  },
  lesson: {
    icon: 'mdi-book-open-variant',
    iconBg: 'checkin',
    url: '/package-course/pages/classes/index',
  },
  recharge: {
    icon: 'mdi-cash-plus',
    iconBg: 'hours',
    url: '/package-course/pages/recharge-records/index',
  },
  meeting: {
    icon: 'mdi-calendar-check-outline',
    iconBg: 'leave',
  },
};

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function formatRecentDateLabel(date: string): string {
  if (!date) {
    return '暂无';
  }
  return date === getTodayDateString() ? '今天' : date;
}

function getMinutesOfDay(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function mapTeacher(data: RawHomeTeacher): HomeTeacherSummary {
  return {
    id: data.id,
    name: data.name,
    avatar: data.avatar,
    role: data.role,
    status: data.status,
    totalHours: data.totalHours,
    monthHours: data.monthHours,
    pendingSalary: data.pendingSalary,
  };
}

function mapTodoItem(item: TodoItemData): HomeTodoItem {
  const config = TODO_CONFIG_MAP[item.type];
  const desc =
    item.type === 'alert'
      ? `${item.time} 查看预警详情`
      : item.type === 'lesson'
        ? `${item.time} 前完成备课确认`
        : item.type === 'recharge'
          ? `${item.time} 跟进续费提醒`
          : `${item.time} 查看安排`;

  return {
    id: item.id,
    title: item.title,
    desc,
    icon: config.icon,
    iconBg: config.iconBg,
    url: config.url,
  };
}

function getCurrentAlertQueryParams(viewType: 'operation' | 'finance') {
  const now = new Date();
  return {
    viewType,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    filterMode: 'month' as const,
  };
}

function mapAlertToHomeTodoItem(alert: {
  id: string;
  level: 'danger' | 'warning' | 'primary';
  title: string;
  desc: string;
  count: number;
}): HomeTodoItem {
  return {
    id: `todo-alert-${alert.id}`,
    title: alert.count > 1 ? `${alert.title} (${alert.count})` : alert.title,
    desc: alert.desc,
    icon:
      alert.level === 'primary'
        ? 'mdi-information-outline'
        : alert.level === 'danger'
          ? 'mdi-alert-circle'
          : 'mdi-alert-circle-outline',
    iconBg: 'alert',
    url: `/package-statistics/pages/alert-detail/index?alertId=${encodeURIComponent(alert.id)}`,
  };
}

function mapBackendTodoItems(data: BackendTeacherTodosResponse): HomeTodoItem[] {
  const items: HomeTodoItem[] = [];

  if (data.pendingLeaves > 0) {
    items.push({
      id: 'todo-pending-leaves',
      title: `${data.pendingLeaves}条请假待处理`,
      desc: '请及时处理待审批请假',
      icon: 'mdi-calendar-check-outline',
      iconBg: 'leave',
    });
  }

  if (data.expiringPackages > 0) {
    items.push({
      id: 'todo-expiring-packages',
      title: `${data.expiringPackages}个课包即将到期`,
      desc: '请及时跟进续费提醒',
      icon: 'mdi-cash-plus',
      iconBg: 'hours',
      url: '/package-course/pages/recharge-records/index',
    });
  }

  if (data.lowHourStudents > 0) {
    items.push({
      id: 'todo-low-hour-students',
      title: `${data.lowHourStudents}位学员剩余课时不足`,
      desc: '请尽快安排续费或提醒',
      icon: 'mdi-book-open-variant',
      iconBg: 'checkin',
      url: '/package-course/pages/classes/index',
    });
  }

  return items;
}

function getScheduleStatus(
  schedule: RawHomeSchedule,
  checkedCount: number,
  totalCount: number,
): NonNullable<Schedule['status']> {
  if (schedule.status === 'done') {
    return 'done';
  }
  if (schedule.status === 'cancelled') {
    return 'ended';
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = getMinutesOfDay(schedule.startTime);
  const endMinutes = getMinutesOfDay(schedule.endTime);

  if (currentMinutes > endMinutes) {
    return checkedCount > 0 || totalCount === 0 ? 'done' : 'ended';
  }
  if (currentMinutes >= startMinutes) {
    return checkedCount > 0 ? 'active' : 'urgent';
  }

  const diffMinutes = startMinutes - currentMinutes;
  return diffMinutes <= 5 ? 'urgent' : 'upcoming';
}

function mapTodaySchedule(schedule: RawHomeSchedule): HomeScheduleItem {
  const classInfo = CLASSES.find((item) => item.id === schedule.classId);
  const teacherInfo = TEACHERS.find((item) => item.id === schedule.teacherId);
  const today = getTodayDateString();
  const checkedRecords = LESSON_RECORDS.filter(
    (record) =>
      record.classId === schedule.classId &&
      record.teacherId === schedule.teacherId &&
      record.date === today &&
      record.status === 'checked',
  );
  const checkedCount = checkedRecords.length;
  const totalCount = classInfo?.studentCount ?? checkedCount;

  return {
    id: schedule.id,
    teacher_id: schedule.teacherId,
    class_id: schedule.classId,
    day_of_week: schedule.dayOfWeek,
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    room: schedule.room,
    status: getScheduleStatus(schedule, checkedCount, totalCount),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note: classInfo?.name || '未命名课程',
    class_info: classInfo ? { name: classInfo.name } : undefined,
    checked_count: checkedCount,
    total_count: totalCount,
    teacher_name: teacherInfo?.name || '授课老师',
  };
}

function mapBackendScheduleStatus(
  startTime: string,
  endTime: string,
): NonNullable<Schedule['status']> {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = getMinutesOfDay(startTime);
  const endMinutes = getMinutesOfDay(endTime);

  if (currentMinutes > endMinutes) {
    return 'ended';
  }

  if (currentMinutes >= startMinutes) {
    return 'active';
  }

  return startMinutes - currentMinutes <= 5 ? 'urgent' : 'upcoming';
}

function mapBackendTeacherHome(aggregate: BackendTeacherHomeResponse) {
  const teacher = aggregate.teacher;

  return {
    recentGroups: aggregate.recentRecords.slice(0, 5).map((record) => ({
      id: record.id,
      className: record.student?.name || '最近消课',
      meta: `${formatRecentDateLabel(record.lessonDate)} · 1人消课`,
      totalHours: Number(record.hoursUsed ?? record.duration ?? 0),
      students: [
        {
          name: record.student?.name || '学员',
          avatar: record.student?.name?.slice(0, 1) || '学',
          hoursUsed: Number(record.hoursUsed ?? record.duration ?? 0),
          remainingHours: 0,
          totalHours: 0,
          time: record.lessonDate,
        },
      ],
    })),
    schedules: aggregate.todaySchedules.map((schedule) => ({
      id: schedule.id,
      teacher_id: teacher.id,
      class_id: schedule.class?.id,
      day_of_week: (new Date().getDay() || 7) as Schedule['day_of_week'],
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      note: schedule.note || schedule.class?.name || '未命名课程',
      class_info: schedule.class ? { name: schedule.class.name } : undefined,
      status: mapBackendScheduleStatus(schedule.startTime, schedule.endTime),
      checked_count: 0,
      total_count: 0,
      teacher_name: teacher.nickname || teacher.name || '授课老师',
      room: schedule.color || undefined,
    })),
    teacher: {
      id: teacher.id,
      name: teacher.nickname || teacher.name || '未命名老师',
      avatar: teacher.avatar || undefined,
      role: 'lead' as const,
      status: 'active' as const,
      totalHours: aggregate.stats.totalRemainingHours,
      monthHours: aggregate.stats.todayRecordCount,
      pendingSalary: 0,
    },
    unreadCount: aggregate.stats.unreadNotificationCount,
  };
}

function mapRecentStudent(
  studentId: string,
  recordDate: string,
  classId: string,
  fallbackStartTime: string,
  fallbackEndTime: string,
): RecentStudent | null {
  const student = STUDENTS.find((item) => item.id === studentId);
  if (!student) {
    return null;
  }

  const pkg =
    COURSE_PACKAGES.find((item) => item.studentId === studentId && item.classId === classId) ||
    COURSE_PACKAGES.find((item) => item.studentId === studentId);
  const latestRecord = LESSON_RECORDS.find(
    (item) => item.studentId === studentId && item.classId === classId && item.date === recordDate,
  );
  const remainingHours = pkg?.remainingHours ?? student.remainingHours;
  const totalHours = pkg?.totalHours ?? student.totalHours;
  const tag = remainingHours <= 8 ? '需续费' : remainingHours <= 16 ? '即将到期' : undefined;

  return {
    name: student.name,
    avatar: student.name.slice(0, 1),
    hoursUsed: latestRecord?.hours ?? 0,
    remainingHours,
    totalHours,
    time: `${latestRecord?.startTime || fallbackStartTime}-${latestRecord?.endTime || fallbackEndTime}`,
    tag,
  };
}

function mapRecentGroup(group: RecentGroupData): HomeRecentGroup {
  const classInfo = CLASSES.find((item) => item.id === group.id);
  const latestRecords = LESSON_RECORDS.filter(
    (record) =>
      record.classId === group.id && record.date === group.date && record.status === 'checked',
  );
  const fallbackStartTime = classInfo?.startTime || '--:--';
  const fallbackEndTime = classInfo?.endTime || '--:--';

  return {
    id: group.id,
    className: group.name,
    meta: `${formatRecentDateLabel(group.date)} · ${group.count}人消课`,
    totalHours: latestRecords.reduce((sum, item) => sum + item.hours, 0),
    students: latestRecords
      .map((record) =>
        mapRecentStudent(
          record.studentId,
          group.date,
          group.id,
          fallbackStartTime,
          fallbackEndTime,
        ),
      )
      .filter((item): item is RecentStudent => Boolean(item)),
  };
}

function normalizeOperationActionType(type?: null | string): OperationActionConfig['type'] {
  switch ((type || '').toUpperCase()) {
    case 'PAGE':
    case 'TAB':
    case 'WEBVIEW':
    case 'ACTIVITY':
    case 'MINI_PROGRAM':
      return type!.toUpperCase() as OperationActionConfig['type'];
    default:
      return 'NONE';
  }
}

function mapOperationActionConfig(
  actionConfig?: BackendOperationActionConfig | null,
): OperationActionConfig | undefined {
  if (!actionConfig) {
    return undefined;
  }

  return {
    type: normalizeOperationActionType(actionConfig.type),
    path: actionConfig.path || undefined,
    url: actionConfig.url || undefined,
    appId: actionConfig.appId || undefined,
  };
}

function mapOperationActivityItem(item: BackendOperationItem): OperationActivityItem {
  return {
    id: item.id,
    title: item.title || '未命名运营位',
    summary: item.summary || undefined,
    content: item.content || undefined,
    coverImageUrl: item.coverImageUrl || undefined,
    actionConfig: mapOperationActionConfig(item.actionConfig),
    displayConfig: item.displayConfig
      ? {
          badgeText: item.displayConfig.badgeText || undefined,
          theme:
            item.displayConfig.theme === 'dark' ||
            item.displayConfig.theme === 'light' ||
            item.displayConfig.theme === 'primary'
              ? item.displayConfig.theme
              : undefined,
        }
      : undefined,
  };
}

function mapOperationBannerItem(item: BackendOperationItem): OperationBannerItem | null {
  if (!item.imageUrl) {
    return null;
  }

  return {
    id: item.id,
    title: item.title || '未命名 Banner',
    imageUrl: item.imageUrl,
    summary: item.summary || undefined,
    content: item.content || undefined,
    actionConfig: mapOperationActionConfig(item.actionConfig),
    displayConfig: item.displayConfig
      ? {
          badgeText: item.displayConfig.badgeText || undefined,
          theme:
            item.displayConfig.theme === 'dark' ||
            item.displayConfig.theme === 'light' ||
            item.displayConfig.theme === 'primary'
              ? item.displayConfig.theme
              : undefined,
        }
      : undefined,
  };
}

function mapBackendOperationContent(data: BackendHomeOperationResponse): HomeOperationContent {
  const placements = data.placements || {};

  return {
    placements: {
      banners: (placements.banners || [])
        .map(mapOperationBannerItem)
        .filter((item): item is OperationBannerItem => Boolean(item)),
      cards: (placements.cards || []).map(mapOperationActivityItem),
      floatings: (placements.floatings || []).map(mapOperationActivityItem),
      notices: (placements.notices || []).map(mapOperationActivityItem),
      popups: (placements.popups || []).map(mapOperationActivityItem),
    },
    updatedAt: data.updatedAt || '',
  };
}

export const homeService = {
  /** 获取教师信息 */
  getTeacher: async (
    userId: string,
    role?: UserRole | null,
  ): Promise<HomeTeacherSummary | null> => {
    if (!USE_MOCK && role === 'teacher') {
      try {
        const aggregate = await get<BackendTeacherHomeResponse>('/home/teacher');
        return mapBackendTeacherHome(aggregate).teacher;
      } catch {
        return null;
      }
    }

    const teacher = await mockGetTeacher(userId);
    return teacher ? mapTeacher(teacher) : null;
  },

  /** 获取教师的学生列表 */
  getStudents: (teacherId: string, limit?: number) => mockGetStudents(teacherId, limit),

  /** 获取今日排课 */
  getTodaySchedules: async (
    teacherId: string,
    role?: UserRole | null,
  ): Promise<HomeScheduleItem[]> => {
    if (!USE_MOCK && role === 'teacher') {
      try {
        const aggregate = await get<BackendTeacherHomeResponse>('/home/teacher');
        return mapBackendTeacherHome(aggregate).schedules;
      } catch {
        return [];
      }
    }

    return (await mockGetTodaySchedules(teacherId)).map(mapTodaySchedule);
  },

  /** 获取最近消课记录 */
  getRecentRecords: (teacherId: string, limit?: number) => mockGetRecentRecords(teacherId, limit),

  /** 获取学生的课时套餐 */
  getStudentPackages: (studentId: string) => mockGetStudentPackages(studentId),

  /** 获取教师所有学生的剩余课时总数 */
  getTotalRemainingHours: (teacherId: string) => mockGetTotalRemainingHours(teacherId),

  /** 获取未读通知数 */
  getUnreadCount: async (userId: string, role?: UserRole | null) => {
    if (!USE_MOCK && (role === 'teacher' || role === 'parent')) {
      try {
        const data = await get<BackendUnreadCountResponse>('/home/notifications/unread-count');
        return data.count;
      } catch {
        return 0;
      }
    }

    return mockGetUnreadCount(userId);
  },

  /** 获取今日已消课数 */
  getTodayRecordCount: (teacherId: string) => mockGetTodayRecordCount(teacherId),

  /** 按时段获取统计数据 */
  getStatsByPeriod: async (teacherId: string, period: StatsPeriod) => {
    if (!USE_MOCK) {
      const backendPeriod = period === 'today' ? 'week' : period === 'lastWeek' ? 'week' : period;
      try {
        const data = await get<BackendTeacherStatsResponse>(
          `/home/teacher/stats?period=${backendPeriod}`,
        );
        return {
          checkinCount: data.lessonCount,
          leaveCount: 0,
          lessonHours: data.totalHours,
          lessonAmount: 0,
        };
      } catch {
        return {
          checkinCount: 0,
          leaveCount: 0,
          lessonHours: 0,
          lessonAmount: 0,
        };
      }
    }

    return mockGetStatsByPeriod(teacherId, period);
  },

  /** 获取首页快捷入口配置 */
  getQuickEntries: (role?: UserRole | null): QuickEntry[] => {
    if (role === 'parent') {
      return [];
    }
    return HOME_QUICK_ENTRIES;
  },

  /** 获取首页运营位内容 */
  getOperationContent: async (role?: UserRole | null): Promise<HomeOperationContent> => {
    if (!USE_MOCK) {
      try {
        const data = await get<BackendHomeOperationResponse>('/home/operations');
        return mapBackendOperationContent(data);
      } catch {
        return {
          placements: {
            banners: [],
            cards: [],
            floatings: [],
            notices: [],
            popups: [],
          },
          updatedAt: '',
        };
      }
    }

    return mockGetOperationContent(role);
  },

  /** 获取待办事项列表 */
  getTodoItems: async (teacherId: string, role?: UserRole | null): Promise<HomeTodoItem[]> => {
    const [operationAlertList, financeAlertList] = await Promise.all([
      statisticsService.getAlerts(getCurrentAlertQueryParams('operation')).catch(() => []),
      statisticsService.getAlerts(getCurrentAlertQueryParams('finance')).catch(() => []),
    ]);
    const alertTodoItems = [...operationAlertList, ...financeAlertList].map(mapAlertToHomeTodoItem);

    if (!USE_MOCK && role === 'teacher') {
      try {
        const data = await get<BackendTeacherTodosResponse>('/home/teacher/todos');
        return [...alertTodoItems, ...mapBackendTodoItems(data)];
      } catch {
        return alertTodoItems;
      }
    }

    return [...alertTodoItems, ...(await mockGetTodoItems(teacherId)).map(mapTodoItem)];
  },

  /** 获取最近消课记录 */
  getRecentGroups: async (
    teacherId: string,
    role?: UserRole | null,
  ): Promise<HomeRecentGroup[]> => {
    if (!USE_MOCK && role === 'teacher') {
      try {
        const aggregate = await get<BackendTeacherHomeResponse>('/home/teacher');
        return mapBackendTeacherHome(aggregate).recentGroups;
      } catch {
        return [];
      }
    }

    return (await mockGetRecentGroups(teacherId)).map(mapRecentGroup);
  },

  // 家长端
  getStudentsByParent: (parentId: string) => mockHomeGetStudentsByParent(parentId),
  getSchedulesByStudent: (studentId: string) => mockGetSchedulesByStudent(studentId),
  getRecordsByStudent: (studentId: string, limit?: number) =>
    mockHomeGetRecordsByStudent(studentId, limit),
  getPackagesByStudent: (studentId: string) => mockHomeGetPackagesByStudent(studentId),
};
