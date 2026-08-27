/**
 * Service 层 — 首页相关 API
 *
 * 待办请走 `todoService`（唯一出口）。此处仅保留兼容薄封装。
 */
import type { RecentGroup, RecentStudent } from '@/components/home/RecentLessonList';
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
  mockGetRecentGroups,
  mockGetOperationContent,
  HOME_QUICK_ENTRIES,
} from '@/data/home';
import type {
  StatsPeriod,
  StatsData,
  QuickEntry,
  RecentGroupData,
  HomeOperationContentData,
  OperationActionConfigData,
  OperationActivityItemData,
  OperationBannerItemData,
} from '@/data/home';
import { CLASSES, COURSE_PACKAGES, LESSON_RECORDS, STUDENTS, TEACHERS } from '@/data/mock-database';
import type { TodoItem } from '@/types/home-todo';
import type { UserRole } from '@/types/profile';
import type { Schedule } from '@/types/schedule';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import {
  resolveCategoryLabelByClassId,
  resolveCategoryLabelByMode,
} from '@/utils/schedule-category';
import { get } from '@/utils/request';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

type RawHomeTeacher = NonNullable<Awaited<ReturnType<typeof mockGetTeacher>>>;
type RawHomeSchedule = Awaited<ReturnType<typeof mockGetTodaySchedules>>[number];

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
    room: item.room || undefined,
    category_label: item.subject || undefined,
    schedule_kind: 'schedule',
  };
}

async function fetchTodaySchedulesFromApi(
  role?: UserRole | null,
  campusId?: string,
): Promise<HomeScheduleItem[]> {
  if (role === 'teacher') {
    const params = new URLSearchParams();
    if (campusId) params.set('campusId', campusId);
    const query = params.toString();
    const aggregate = await get<BackendTeacherHomeResponse>(
      `/home/teacher${query ? `?${query}` : ''}`,
    );
    return mapBackendTeacherHome(aggregate).schedules;
  }

  if (isPrincipalLikeRole(role)) {
    const data = await get<BackendTodayScheduleResponse>('/schedules/today');
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

function getTodayDateString(): string {
  // 必须与 mock 数据约定一致：mock 的 LESSON_RECORDS 日期用「本地日期」生成
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

function getScheduleStatus(
  schedule: RawHomeSchedule,
  attendedCount: number,
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

  // 跨 0 点排课（endTime 超过 24:00，如 23:30-24:30）：
  // 次日凌晨（当前时间早于开始时间，说明课从昨天开始），实际下课时间 = endMinutes - 1440
  if (endMinutes > 1440 && currentMinutes < startMinutes) {
    const realEndMinutes = endMinutes - 1440;
    if (currentMinutes < realEndMinutes) {
      // 次日 00:00 ~ 实际下课：课从昨天开始，仍在进行
      return 'active';
    }
    // 次日实际下课后（今日课表已过滤）或排课当天课前：按未上课处理
    return startMinutes - currentMinutes <= 5 ? 'urgent' : 'upcoming';
  }

  if (currentMinutes > endMinutes) {
    // 已下课：有学生但未点名 → 未点名提醒（用户口径 2026-08-23：禁止查看，须先点名）
    if (totalCount > 0 && attendedCount === 0) return 'unattended';
    return 'done';
  }
  if (currentMinutes >= startMinutes) {
    return 'active';
  }

  const diffMinutes = startMinutes - currentMinutes;
  return diffMinutes <= 5 ? 'urgent' : 'upcoming';
}

function mapTodayBookingSchedule(schedule: RawHomeSchedule): HomeScheduleItem {
  const teacherInfo = TEACHERS.find((item) => item.id === schedule.teacherId);
  const today = getTodayDateString();
  const trialStudentId = schedule.trialStudentId;
  const classId = schedule.classId;

  const matchRecord = (record: typeof LESSON_RECORDS[number]) => {
    if (record.date !== today || record.teacherId !== schedule.teacherId) return false;
    if (schedule.trialMode === 'private' && trialStudentId) {
      return record.studentId === trialStudentId;
    }
    if (classId) {
      return record.classId === classId;
    }
    return false;
  };

  const checkedRecords = LESSON_RECORDS.filter((r) => matchRecord(r) && r.status === 'checked');
  const absentRecords = LESSON_RECORDS.filter((r) => matchRecord(r) && r.status === 'absent');
  const leaveRecords = LESSON_RECORDS.filter((r) => matchRecord(r) && r.status === 'leave');
  const checkedCount = checkedRecords.length;
  const absentCount = absentRecords.length;
  const leaveCount = leaveRecords.length;
  const attendedCount = checkedCount + absentCount + leaveCount;

  let totalCount = 1;
  if (schedule.trialMode === 'group' && classId) {
    const classInfo = CLASSES.find((item) => item.id === classId);
    totalCount = classInfo?.studentCount ?? 1;
  }

  const displayName = schedule.displayName || '未命名课程';
  const categoryLabel =
    schedule.categoryLabel ||
    resolveCategoryLabelByClassId(classId) ||
    resolveCategoryLabelByMode(schedule.trialMode);

  return {
    id: schedule.id,
    booking_id: schedule.bookingId,
    trial_mode: schedule.trialMode,
    teacher_id: schedule.teacherId,
    class_id: classId || undefined,
    student_id: schedule.trialMode === 'private' ? trialStudentId : undefined,
    day_of_week: schedule.dayOfWeek,
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    room: schedule.room,
    color: schedule.color,
    status: getScheduleStatus(schedule, attendedCount, totalCount),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note: displayName,
    class_info: classId ? { name: displayName } : undefined,
    checked_count: checkedCount,
    absent_count: absentCount,
    leave_count: leaveCount,
    total_count: totalCount,
    teacher_name: teacherInfo?.name || '授课老师',
    has_trial_student: true,
    category_label: categoryLabel,
    schedule_kind: 'booking',
  };
}

function mapTodayVenueSchedule(schedule: RawHomeSchedule): HomeScheduleItem {
  const displayName = schedule.displayName || '场地预约';
  const isCheckedIn = schedule.status === 'done';
  const totalCount = 1;
  const checkedCount = isCheckedIn ? 1 : 0;

  return {
    id: schedule.id,
    venue_booking_id: schedule.venueBookingId,
    room_id: schedule.sourceRoomId,
    schedule_kind: 'venue',
    category_label: schedule.categoryLabel || '场地',
    teacher_id: schedule.teacherId,
    day_of_week: schedule.dayOfWeek,
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    room: schedule.room,
    color: schedule.color,
    status: getScheduleStatus(schedule, checkedCount, totalCount),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note: displayName,
    checked_count: checkedCount,
    total_count: totalCount,
    teacher_name: '场地负责人',
  };
}

function mapTodaySchedule(schedule: RawHomeSchedule): HomeScheduleItem {
  if (schedule.scheduleKind === 'venue') {
    return mapTodayVenueSchedule(schedule);
  }
  if (schedule.bookingId || schedule.scheduleKind === 'booking') {
    return mapTodayBookingSchedule(schedule);
  }

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
  const absentRecords = LESSON_RECORDS.filter(
    (record) =>
      record.classId === schedule.classId &&
      record.teacherId === schedule.teacherId &&
      record.date === today &&
      record.status === 'absent',
  );
  const leaveRecords = LESSON_RECORDS.filter(
    (record) =>
      record.classId === schedule.classId &&
      record.teacherId === schedule.teacherId &&
      record.date === today &&
      record.status === 'leave',
  );
  const checkedCount = checkedRecords.length;
  const absentCount = absentRecords.length;
  const leaveCount = leaveRecords.length;
  // 已点名 = 签到 + 未到 + 请假（老师点过名即可算已点名）
  const attendedCount = checkedCount + absentCount + leaveCount;
  const totalCount = classInfo?.studentCount ?? attendedCount;

  return {
    id: schedule.id,
    teacher_id: schedule.teacherId,
    class_id: schedule.classId,
    day_of_week: schedule.dayOfWeek,
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    room: schedule.room,
    color: schedule.color,
    status: getScheduleStatus(schedule, attendedCount, totalCount),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note: classInfo?.name || '未命名课程',
    class_info: classInfo ? { name: classInfo.name } : undefined,
    checked_count: checkedCount,
    absent_count: absentCount,
    leave_count: leaveCount,
    total_count: totalCount,
    teacher_name: teacherInfo?.name || '授课老师',
    category_label:
      resolveCategoryLabelByClassId(schedule.classId) ||
      schedule.categoryLabel,
    schedule_kind: 'schedule',
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
      checked_count: schedule.checkedCount ?? 0,
      total_count: schedule.totalCount ?? 0,
      teacher_name: schedule.teacherName || teacher.nickname || teacher.name || '授课老师',
      room: schedule.room || undefined,
      booking_id: schedule.bookingId || undefined,
      trial_mode:
        schedule.trialMode === 'private' || schedule.trialMode === 'group'
          ? schedule.trialMode
          : undefined,
      venue_booking_id: schedule.venueBookingId || undefined,
      room_id: schedule.sourceRoomId || undefined,
      category_label: schedule.categoryLabel || undefined,
      schedule_kind: schedule.scheduleKind || 'schedule',
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
    if (USE_MOCK) {
      const teacher = await mockGetTeacher(userId);
      return teacher ? mapTeacher(teacher) : null;
    }

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
  getStudents: (teacherId: string, limit?: number) => mockGetStudents(teacherId, limit),

  /** 获取今日排课（仅本人主讲或助教，不按课程分类过滤） */
  getTodaySchedules: async (
    teacherId: string,
    role?: UserRole | null,
    campusId?: string,
  ): Promise<HomeScheduleItem[]> => {
    if (USE_MOCK) {
      return (await mockGetTodaySchedules(teacherId, campusId)).map(mapTodaySchedule);
    }

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
  getRecentRecords: (teacherId: string, limit?: number, campusId?: string) =>
    mockGetRecentRecords(teacherId, limit, campusId),

  /** 获取学生的课时套餐 */
  getStudentPackages: (studentId: string) => mockGetStudentPackages(studentId),

  /** 获取教师所有学生的剩余课时总数 */
  getTotalRemainingHours: (teacherId: string) => mockGetTotalRemainingHours(teacherId),

  /** 获取未读通知数 */
  getUnreadCount: async (userId: string, role?: UserRole | null) => {
    if (USE_MOCK) {
      return mockGetUnreadCount(userId);
    }

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
  getTodayRecordCount: (teacherId: string, campusId?: string) =>
    mockGetTodayRecordCount(teacherId, campusId),

  /** 按时段获取统计数据 */
  getStatsByPeriod: async (teacherId: string, period: StatsPeriod, campusId?: string) => {
    if (!USE_MOCK) {
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
    }

    return mockGetStatsByPeriod(teacherId, period, campusId);
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
    teacherId: string,
    role?: UserRole | null,
    campusId?: string,
  ): Promise<HomeRecentGroup[]> => {
    if (USE_MOCK) {
      return (await mockGetRecentGroups(teacherId, campusId)).map(mapRecentGroup);
    }

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
  getStudentsByParent: (parentId: string) => mockHomeGetStudentsByParent(parentId),
  getSchedulesByStudent: (studentId: string) => mockGetSchedulesByStudent(studentId),
  getRecordsByStudent: (studentId: string, limit?: number) =>
    mockHomeGetRecordsByStudent(studentId, limit),
  getPackagesByStudent: (studentId: string) => mockHomeGetPackagesByStudent(studentId),
};
