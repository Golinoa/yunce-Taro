/**
 * Service 层 — 首页相关 API
 *
 * 待办请走 `todoService`（唯一出口）。此处仅保留兼容薄封装。
 */
import type { RecentGroup } from '@/components/home/RecentLessonList';
import {
  HOME_QUICK_ENTRIES,
  PARENT_HOME_QUICK_ENTRIES,
  TEACHER_HOME_QUICK_ENTRIES,
} from '@/constants/home-ui';
import { scheduleService, studentService } from '@/services/student';
import type { TodoItem } from '@/types/home-todo';
import type {
  StatsPeriod,
  StatsData,
  QuickEntry,
} from '@/types/home-ui';
import type { UserRole } from '@/types/profile';
import type { Schedule, ScheduleColor } from '@/types/schedule';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { isPrincipalOrAbove, isTeachingRole } from '@/utils/auth';
import { get } from '@/utils/request';

type RawHomeTeacher = {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string;
  status?: string;
  totalHours?: number;
  monthHours?: number;
  pendingSalary?: number;
};

/** 合法卡片颜色集合（与 ScheduleColor 对齐），非法值落 undefined 防止脏数据透传 */
const SCHEDULE_COLORS: readonly ScheduleColor[] = [
  'primary',
  'red',
  'amber',
  'purple',
  'info',
  'teal',
];

function toScheduleColor(color?: string): ScheduleColor | undefined {
  if (!color) return undefined;
  return (SCHEDULE_COLORS as readonly string[]).includes(color)
    ? (color as ScheduleColor)
    : undefined;
}

interface BackendTodayScheduleItem {
  classId: string;
  className?: null | string;
  color?: null | string;
  endTime: string;
  id: string;
  note?: null | string;
  room?: null | string;
  startTime: string;
  subject?: null | string;
  teacherName?: null | string;
}

interface BackendTodayScheduleResponse {
  date: string;
  dayOfWeek: number;
  schedules: BackendTodayScheduleItem[];
}

function isStaffHomeRole(role?: UserRole | null): boolean {
  return role === 'teacher' || role === 'principal' || role === 'admin' || role === 'assistant';
}

function isPrincipalLikeRole(role?: UserRole | null): boolean {
  return role === 'principal' || role === 'admin';
}

function buildStaffTeacherSummary(userId: string): HomeTeacherSummary {
  return {
    id: userId,
    name: '机构',
    role: 'lead',
    status: 'active',
    totalHours: 0,
    monthHours: 0,
    pendingSalary: 0,
  };
}

function mapTodayScheduleItem(item: BackendTodayScheduleItem): HomeScheduleItem {
  return {
    id: item.id,
    teacher_id: '',
    class_id: item.classId,
    day_of_week: (new Date().getDay() || 7) as Schedule['day_of_week'],
    start_time: item.startTime,
    end_time: item.endTime,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note: item.note || item.className || '未命名课程',
    class_info: item.className ? { name: item.className } : undefined,
    status: mapBackendScheduleStatus(item.startTime, item.endTime),
    checked_count: 0,
    total_count: 0,
    teacher_name: item.teacherName || undefined,
    room: item.room || undefined,
    category_label: item.subject || undefined,
    schedule_kind: 'schedule',
  };
}

async function fetchTodaySchedulesFromApi(
  role?: UserRole | null,
  campusId?: string,
): Promise<HomeScheduleItem[]> {
  if (isTeachingRole(role)) {
    const params = new URLSearchParams();
    if (campusId) params.set('campusId', campusId);
    const query = params.toString();
    const aggregate = await get<BackendTeacherHomeResponse>(
      `/home/teacher${query ? `?${query}` : ''}`,
    );
    return mapBackendTeacherHome(aggregate).schedules;
  }

  if (isPrincipalOrAbove(role)) {
    const params = new URLSearchParams();
    if (campusId) params.set('campusId', campusId);
    const query = params.toString();
    const data = await get<BackendTodayScheduleResponse>(
      `/schedules/today${query ? `?${query}` : ''}`,
    );
    return (data.schedules || []).map(mapTodayScheduleItem);
  }

  return [];
}

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
    bookingId?: string | null;
    categoryLabel?: string | null;
    checkedCount?: number;
    class?: {
      id: string;
      name: string;
      subject?: null | string;
    } | null;
    color?: null | string;
    endTime: string;
    id: string;
    note?: null | string;
    room?: null | string;
    scheduleKind?: 'schedule' | 'booking' | 'venue' | null;
    sourceRoomId?: string | null;
    startTime: string;
    teacherName?: string | null;
    totalCount?: number;
    trialMode?: string | null;
    venueBookingId?: string | null;
  }>;
}

interface BackendTeacherStatsResponse {
  lessonCount: number;
  packageCount: number;
  period: string;
  studentCount: number;
  totalHours: number;
}

interface BackendUnreadCountResponse {
  count: number;
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

export interface ParentHomePackageCard {
  id: string;
  name: string;
  remainingHours: number;
  usedHours: number;
  totalHours: number;
  studentId: string;
}

export interface ParentHomeStudent {
  id: string;
  name: string;
  avatar?: string | null;
  remainingHours: number;
  packages: ParentHomePackageCard[];
}

export interface ParentHomeData {
  students: ParentHomeStudent[];
  todaySchedules: HomeScheduleItem[];
  packages: ParentHomePackageCard[];
  unreadCount: number;
}

interface BackendParentHomeResponse {
  parent?: {
    id: string;
    nickname?: string | null;
    name?: string | null;
    avatar?: string | null;
    relation?: string | null;
  };
  stats?: {
    studentCount?: number;
    totalRemainingHours?: number;
    unreadNotificationCount?: number;
    todayScheduleCount?: number;
  };
  students?: Array<{
    id: string;
    name: string;
    avatar?: string | null;
    nickname?: string | null;
    remainingHours: number;
    packages?: Array<{
      id: string;
      name: string;
      totalHours: number;
      usedHours: number;
      remainingHours: number;
      validEnd?: string | null;
    }>;
  }>;
  todaySchedules?: Array<{
    id: string;
    startTime: string;
    endTime: string;
    class?: { id: string; name: string; subject?: string | null } | null;
    note?: string | null;
    color?: string | null;
    teacherName?: string | null;
  }>;
  recentRecords?: Array<{
    id: string;
    lessonDate: string;
    duration?: number;
    hoursUsed?: number;
    content?: string | null;
    performance?: string | null;
    student?: { id: string; name: string } | null;
  }>;
}

function mapBackendParentHome(data: BackendParentHomeResponse): ParentHomeData {
  const students: ParentHomeStudent[] = (data.students || []).map((s) => ({
    id: s.id,
    name: s.name,
    avatar: s.avatar,
    remainingHours: s.remainingHours,
    packages: (s.packages || []).map((p) => ({
      id: p.id,
      name: p.name,
      remainingHours: p.remainingHours,
      usedHours: p.usedHours,
      totalHours: p.totalHours,
      studentId: s.id,
    })),
  }));

  const packageCards = students
    .flatMap((s) => s.packages)
    .filter((p) => p.remainingHours > 0)
    .sort((a, b) => a.remainingHours - b.remainingHours);

  const allPackages = students.flatMap((s) => s.packages);
  const today = (new Date().getDay() || 7) as Schedule['day_of_week'];

  return {
    students,
    todaySchedules: (data.todaySchedules || []).map((s) => ({
      id: s.id,
      teacher_id: '',
      class_id: s.class?.id,
      day_of_week: today,
      start_time: s.startTime,
      end_time: s.endTime,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      note: s.note || s.class?.name || '未命名课程',
      class_info: s.class ? { name: s.class.name } : undefined,
      status: mapBackendScheduleStatus(s.startTime, s.endTime),
      teacher_name: s.teacherName || undefined,
      category_label: s.class?.subject || undefined,
      color: toScheduleColor(s.color || undefined),
      schedule_kind: 'schedule',
      checked_count: 0,
      total_count: 0,
    })),
    packages: (packageCards.length > 0 ? packageCards : allPackages).slice(0, 2),
    unreadCount: data.stats?.unreadNotificationCount ?? 0,
  };
}

export type { StatsPeriod, StatsData, QuickEntry };

function getTodayDateString(): string {
  // 必须与 mock 数据约定一致：mock 的 db().LESSON_RECORDS 日期用「本地日期」生成
  // （mock-database 的 NOW/CUR_DAY 均为本地时区）。此前用 toISOString()（UTC），
  // 在 GMT+8 环境下本地日期比 UTC 早一天，导致：
  //   - 当天点名记录匹配不上 → attendedCount=0 → 已下课班级被错判为「未点名(unattended)」，
  //     「已完成(done)」卡片消失；
  //   - 本地「昨天」的记录被当成「今天」，污染当日点名统计。
  // 改用本地日期，保证首页今日课表状态判定与 mock 数据自洽。
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

function mapBackendScheduleStatus(
  startTime: string,
  endTime: string,
): NonNullable<Schedule['status']> {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = getMinutesOfDay(startTime);
  const endMinutes = getMinutesOfDay(endTime);

  if (currentMinutes > endMinutes) {
    // 后端接口已结束状态由后端决定（点名信息在 record），前端无法区分 done/unattended，
    // 默认按已结束展示 done，避免误判；具体是否点名由详情接口返回
    return 'done';
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
    schedules: aggregate.todaySchedules.map((schedule) => {
      // 后端 trialMode 为自由字符串，收窄为契约允许的字面量后落库
      const trialMode: 'group' | 'private' | undefined =
        schedule.trialMode === 'private' || schedule.trialMode === 'group'
          ? schedule.trialMode
          : undefined;
      return {
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
        checked_count: schedule.checkedCount ?? 0,
        total_count: schedule.totalCount ?? 0,
        teacher_name: schedule.teacherName || teacher.nickname || teacher.name || '授课老师',
        room: schedule.room || undefined,
        booking_id: schedule.bookingId || undefined,
        trial_mode: trialMode,
        venue_booking_id: schedule.venueBookingId || undefined,
        room_id: schedule.sourceRoomId || undefined,
        category_label: schedule.categoryLabel || undefined,
        schedule_kind: schedule.scheduleKind || 'schedule',
      };
    }),
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


export const homeService = {
  /** 获取教师信息 */
  getTeacher: async (
    userId: string,
    role?: UserRole | null,
  ): Promise<HomeTeacherSummary | null> => {
    if (role === 'teacher') {
      try {
        const aggregate = await get<BackendTeacherHomeResponse>('/home/teacher');
        return mapBackendTeacherHome(aggregate).teacher;
      } catch {
        return null;
      }
    }

    if (isPrincipalLikeRole(role) || role === 'assistant') {
      return buildStaffTeacherSummary(userId);
    }

    return null;
  },

  /** 获取教师的学生列表 */
  getStudents: async (_teacherId: string, _limit?: number) => {
    // 首页学员列表请走 studentService；此处保留兼容空实现
    return [];
  },

  /** 获取今日排课（校长/管理员看校区全员，老师/助教看本人相关） */
  getTodaySchedules: async (
    _teacherId: string,
    role?: UserRole | null,
    campusId?: string,
  ): Promise<HomeScheduleItem[]> => {
    if (!isStaffHomeRole(role)) {
      return [];
    }

    try {
      return await fetchTodaySchedulesFromApi(role, campusId);
    } catch {
      return [];
    }
  },

  /** 获取最近消课记录 */
  getRecentRecords: async (_teacherId: string, _limit?: number, _campusId?: string) => [],

  /** 获取学生的课时套餐 */
  getStudentPackages: async (_studentId: string) => [],

  /** 获取教师所有学生的剩余课时总数 */
  getTotalRemainingHours: async (_teacherId: string) => 0,

  /** 获取未读通知数 */
  getUnreadCount: async (_userId: string, role?: UserRole | null) => {
    if (role === 'teacher' || role === 'parent' || isPrincipalLikeRole(role)) {
      try {
        const data = await get<BackendUnreadCountResponse>('/home/notifications/unread-count');
        return data.count;
      } catch {
        return 0;
      }
    }

    return 0;
  },

  /** 获取今日已消课数 */
  getTodayRecordCount: async (_teacherId: string, _campusId?: string) => 0,

  /** 按时段获取统计数据 */
  getStatsByPeriod: async (_teacherId: string, period: StatsPeriod, campusId?: string) => {
    const backendPeriod = period === 'today' ? 'week' : period === 'lastWeek' ? 'week' : period;
    try {
      const params = new URLSearchParams({ period: backendPeriod });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendTeacherStatsResponse>(
        `/home/teacher/stats?${params.toString()}`,
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
  },

  /** 获取首页快捷入口配置 */
  getQuickEntries: (role?: UserRole | null): QuickEntry[] => {
    if (role === 'parent') {
      return PARENT_HOME_QUICK_ENTRIES;
    }
    if (role === 'teacher' || role === 'assistant') {
      return TEACHER_HOME_QUICK_ENTRIES;
    }
    return HOME_QUICK_ENTRIES;
  },

  /**
   * 家长端首页聚合：今日课表 + 课包概览 + 孩子列表
   * 对接 GET /home/parent；Mock 用本地学员/排课/课包拼装
   */
  getParent: async (_profileId: string): Promise<ParentHomeData | null> => {
    try {
      const data = await get<BackendParentHomeResponse>('/home/parent');
      return mapBackendParentHome(data);
    } catch {
      return null;
    }
  },

  /** 获取首页运营位内容 */
  
  /**
   * @deprecated 请使用 todoService.getList({ view: 'home', ... })
   */
  getTodoItems: async (
    teacherId: string,
    role?: UserRole | null,
    campusId?: string,
    userId?: string,
    userName?: string,
  ): Promise<HomeTodoItem[]> => {
    if (!userId) return [];
    const { todoService } = await import('./todo');
    return todoService.getList({
      view: 'home',
      teacherId,
      role,
      campusId,
      userId,
      userName,
    });
  },

  /** @deprecated 使用 todoService.add */
  addCustomTodo: async (
    userId: string,
    input: import('@/utils/custom-todos').AddCustomTodoInput,
  ): Promise<HomeTodoItem> => {
    const { todoService } = await import('./todo');
    return todoService.add(userId, input);
  },

  /** @deprecated 使用 todoService.getList({ view: 'all' }) */
  listMyTodos: async (
    userId: string,
    teacherId: string,
    role?: UserRole | null,
    campusId?: string,
    userName?: string,
  ): Promise<HomeTodoItem[]> => {
    const { todoService } = await import('./todo');
    return todoService.getList({
      view: 'all',
      teacherId,
      role,
      campusId,
      userId,
      userName,
    });
  },

  /** @deprecated 使用 todoService.listCustomRecords */
  listCustomTodos: async (userId: string) => {
    const { todoService } = await import('./todo');
    return todoService.listCustomRecords(userId);
  },

  /** @deprecated 使用 todoService.remove */
  removeCustomTodo: async (userId: string, todoId: string): Promise<boolean> => {
    const { todoService } = await import('./todo');
    return todoService.remove(userId, todoId);
  },

  /** @deprecated 使用 todoService.reopen */
  reopenCustomTodo: async (userId: string, todoId: string): Promise<boolean> => {
    const { todoService } = await import('./todo');
    return todoService.reopen(userId, todoId);
  },

  /** @deprecated 使用 todoService.reopen */
  reopenTodo: async (userId: string, todoId: string): Promise<boolean> => {
    const { todoService } = await import('./todo');
    return todoService.reopen(userId, todoId);
  },

  /** @deprecated 使用 todoService.updateQuadrant */
  updateTodoQuadrant: async (
    userId: string,
    todoId: string,
    quadrant: TodoQuadrant,
  ): Promise<boolean> => {
    const { todoService } = await import('./todo');
    return todoService.updateQuadrant(userId, todoId, quadrant);
  },

  /** @deprecated 使用 todoService.updateQuadrant */
  updateCustomTodoQuadrant: async (
    userId: string,
    todoId: string,
    quadrant: TodoQuadrant,
  ): Promise<boolean> => {
    const { todoService } = await import('./todo');
    return todoService.updateQuadrant(userId, todoId, quadrant);
  },

  /** @deprecated 使用 todoService.complete */
  completeTodo: async (
    todoId: string,
    payload: { userId: string; userName: string; note?: string },
  ): Promise<void> => {
    const { todoService } = await import('./todo');
    return todoService.complete(todoId, payload);
  },

  /** @deprecated 使用 todoService.complete */
  markTodoRead: async (
    todoId: string,
    userId?: string,
    userName?: string,
    note?: string,
  ): Promise<void> => {
    const { todoService } = await import('./todo');
    if (!userId) return;
    await todoService.complete(todoId, { userId, userName: userName || '我', note });
  },

  /** 获取最近消课记录 */
  getRecentGroups: async (
    _teacherId: string,
    role?: UserRole | null,
    campusId?: string,
  ): Promise<HomeRecentGroup[]> => {
    if (role === 'teacher') {
      try {
        const params = new URLSearchParams();
        if (campusId) params.set('campusId', campusId);
        const query = params.toString();
        const aggregate = await get<BackendTeacherHomeResponse>(
          `/home/teacher${query ? `?${query}` : ''}`,
        );
        return mapBackendTeacherHome(aggregate).recentGroups;
      } catch {
        return [];
      }
    }

    return [];
  },

  // 家长端
  getStudentsByParent: async (_parentId: string) => [],
  getSchedulesByStudent: async (studentId: string) => {
    const student = await studentService.getById(studentId);
    const classIds = student?.class_ids || [];
    return scheduleService.listForParent(classIds);
  },
  getRecordsByStudent: async (_studentId: string, _limit?: number) => [],
  getPackagesByStudent: async (
    _studentId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      status?: string;
      remainingHours?: number;
      totalHours?: number;
      subjectId?: string;
    }>
  > => [],
};
