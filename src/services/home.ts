/**
 * Service 层 — 首页相关 API
 */
import dayjs from 'dayjs';
import type { RecentGroup, RecentStudent } from '@/components/home/RecentLessonList';
import type { TodoCompletion, TodoItem, TodoLevel } from '@/types/home-todo';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import type { AlertItem } from '@/components/statistics/AlertSheet';
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
import { COURSE_MANAGEMENT_CLASS_TAB_URL } from '@/data/course-category';
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
import { notWired } from '@/utils/not-wired';
import { get, put } from '@/utils/request';
import { getTodoReadAt, isTodoRead, markTodoRead, rechargeAlertTodoId } from '@/utils/todo-read';
import { getTodoCompletion, saveTodoCompletion } from '@/utils/todo-completion';
import {
  getTodoQuadrantOverride,
  saveTodoQuadrantOverride,
} from '@/utils/todo-quadrant-override';
import { resolveSystemTodoDisplayDay } from '@/utils/todo-timeline';
import {
  addCustomTodo,
  completeCustomTodo,
  getCustomTodos,
  isCustomTodoId,
  mapCustomTodoToHomeItem,
  removeCustomTodo,
  reopenCustomTodo,
  sortCustomTodos,
  sortCustomTodosByMode,
  updateCustomTodoQuadrant,
  type AddCustomTodoInput,
  type CustomTodoRecord,
} from '@/utils/custom-todos';
import { filterTodosBySettings, type TodoItemCategory } from '@/utils/todo-settings';
import {
  buildStudentRechargeTodoDesc,
  buildStudentRechargeTodoTitle,
  normalizeStudentRechargeTodoDesc,
} from '@/utils/student-recharge-todo';
import { ensureMockCustomTodoSeedsForUser } from '@/data/custom-todos';
import { statisticsService } from './statistics';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

function ensureMockCustomTodoSeeds(userId: string): void {
  if (!USE_MOCK || !userId) return;
  ensureMockCustomTodoSeedsForUser(userId);
}

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
  /**
   * 用户重分配的事态等级（象限）覆盖表。
   * 后端实现 PUT 象限后，应在本接口一并返回，便于多端同步。
   */
  quadrantOverrides?: Record<string, TodoQuadrant> | null;
}

/** PUT /home/teacher/todos/:todoId/quadrant 请求体 */
export interface UpdateTodoQuadrantRequest {
  quadrant: TodoQuadrant;
}

/** PUT /home/teacher/todos/:todoId/quadrant 响应 data */
export interface UpdateTodoQuadrantResponse {
  todoId: string;
  quadrant: TodoQuadrant;
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

/** Mock/后端待办 type → 跳转 URL */
const TODO_TYPE_URL: Partial<Record<TodoItemData['type'], string>> = {
  recharge: '/package-course/pages/recharge-records/index',
  salary: '/package-teacher/pages/salary-payment/index',
  checkin: COURSE_MANAGEMENT_CLASS_TAB_URL,
  lead: '/package-lead/pages/my-invite/index',
};

/** Mock/后端待办 type → 待办提醒设置分类 */
const TODO_TYPE_CATEGORY: Record<TodoItemData['type'], TodoItemCategory> = {
  checkin: 'attendanceCheckin',
  recharge: 'studentRecharge',
  salary: 'salaryRemind',
  meeting: 'meetingRemind',
  alert: 'studentRecharge',
  lead: 'leadFollowUp',
};

/** Mock/后端待办 type → 事态等级（左侧色条） */
const TODO_TYPE_LEVEL: Record<TodoItemData['type'], TodoLevel> = {
  checkin: 'urgent',
  recharge: 'normal',
  salary: 'high',
  meeting: 'low',
  alert: 'normal',
  lead: 'normal',
};

const TODO_PRIORITY_LEVEL: Record<TodoItemData['priority'], TodoLevel> = {
  high: 'high',
  medium: 'normal',
  low: 'low',
};

const TODO_TYPE_QUADRANT: Record<TodoItemData['type'], TodoQuadrant> = {
  alert: 'q1',
  checkin: 'q1',
  salary: 'q2',
  recharge: 'q2',
  lead: 'q3',
  meeting: 'q4',
};

function buildRemindAtFromTodoTime(time: string): string {
  const today = dayjs().format('YYYY-MM-DD');
  if (/^\d{1,2}:\d{2}$/.test(time)) {
    const [hourText, minuteText] = time.split(':');
    const hour = hourText.padStart(2, '0');
    const minute = minuteText.padStart(2, '0');
    return dayjs(`${today} ${hour}:${minute}:00`).toISOString();
  }
  if (time === '今天') {
    return dayjs().hour(12).minute(0).second(0).millisecond(0).toISOString();
  }
  return dayjs().add(2, 'hour').startOf('minute').toISOString();
}

function mapAlertLevelToTodoLevel(level: 'danger' | 'warning' | 'primary'): TodoLevel {
  if (level === 'danger') return 'urgent';
  if (level === 'warning') return 'high';
  return 'normal';
}

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

function enrichTodoItem(todo: HomeTodoItem, userId?: string): HomeTodoItem {
  const stored = getTodoCompletion(todo.id);
  const legacyReadAt = isTodoRead(todo.id) ? getTodoReadAt(todo.id) : undefined;
  const completion: TodoCompletion | undefined =
    stored ||
    (legacyReadAt
      ? {
          completedAt: legacyReadAt,
          completedBy: 'legacy',
          completedByName: '已处理',
        }
      : todo.completion);

  const pushedAt = todo.pushedAt || todo.remindAt || new Date().toISOString();
  const displayDay =
    todo.displayDay ||
    (todo.sourceType === 'system' || (!todo.sourceType && !todo.remindAt && todo.pushedAt)
      ? resolveSystemTodoDisplayDay(pushedAt, completion?.completedAt)
      : todo.remindAt
        ? dayjs(todo.remindAt).format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD'));

  const quadrantOverride = userId ? getTodoQuadrantOverride(userId, todo.id) : null;

  return {
    ...todo,
    sourceType: todo.sourceType || (todo.pushedAt ? 'system' : undefined),
    pushedAt: todo.sourceType === 'system' || todo.pushedAt ? pushedAt : todo.pushedAt,
    displayDay,
    completion,
    completed: Boolean(completion || todo.completed),
    ...(quadrantOverride ? { quadrant: quadrantOverride } : {}),
  };
}

function mapTodoItem(item: TodoItemData): HomeTodoItem {
  const desc =
    item.type === 'alert'
      ? `${item.time} 查看预警详情`
      : item.type === 'recharge'
        ? buildStudentRechargeTodoDesc(item.remainingHours)
        : item.type === 'salary'
          ? `${item.time} 前往薪资管理`
          : item.type === 'checkin'
            ? `${item.time}，点击进入补点名`
            : item.type === 'lead'
              ? `${item.time} 查看线索跟进`
              : `${item.time} 查看安排`;

  const url =
    item.type === 'checkin' && item.scheduleId
      ? `/package-course/pages/lesson-form/index?scheduleId=${encodeURIComponent(item.scheduleId)}` +
        `&classId=${encodeURIComponent(item.classId || '')}` +
        `&lessonDate=${encodeURIComponent(item.lessonDate || '')}` +
        `&hasTrialStudent=0`
      : TODO_TYPE_URL[item.type];

  return {
    id: item.id,
    title: item.title,
    desc,
    url,
    level: TODO_PRIORITY_LEVEL[item.priority] ?? TODO_TYPE_LEVEL[item.type],
    category: TODO_TYPE_CATEGORY[item.type],
    remindAt: buildRemindAtFromTodoTime(item.time),
    quadrant: TODO_TYPE_QUADRANT[item.type],
    remindEnabled: true,
    completed: item.completed,
    sourceType: 'system',
    sharedScope: item.type === 'recharge' ? 'campus_ops' : 'private',
    pushedAt: buildRemindAtFromTodoTime(item.time),
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
    url: `/package-statistics/pages/alert-detail/index?alertId=${encodeURIComponent(alert.id)}`,
    level: mapAlertLevelToTodoLevel(alert.level),
    category: 'financePackage',
  };
}

/**
 * 运营预警（课时不足）→ 学员级待办（用户口径 2026-08-23）：
 * 每个应预警学员一条「课时续费提醒」，手动点已读后不再出现（不重复推送）。
 * 已读记录存储于 utils/todo-read（mock），联调后迁移后端。
 */
function mapOperationAlertToStudentTodos(alert: {
  id: string;
  level: 'danger' | 'warning' | 'primary';
  title: string;
  desc: string;
  count: number;
  details: { name: string; info: string; refId?: string }[];
}): HomeTodoItem[] {
  const todos: HomeTodoItem[] = [];
  for (const detail of alert.details) {
    if (!detail.refId) continue;
    const todoId = rechargeAlertTodoId(detail.refId);
    const pushedAt = new Date().toISOString();
    todos.push({
      id: todoId,
      title: buildStudentRechargeTodoTitle(detail.name),
      desc: normalizeStudentRechargeTodoDesc(detail.info),
      level: detail.info.includes('已用尽') ? 'urgent' : mapAlertLevelToTodoLevel(alert.level),
      category: 'studentRecharge',
      sourceType: 'system',
      sharedScope: 'campus_ops',
      pushedAt,
      remindAt: pushedAt,
      remindEnabled: true,
    });
  }
  return todos;
}

function mapBackendTodoItems(data: BackendTeacherTodosResponse): HomeTodoItem[] {
  const items: HomeTodoItem[] = [];

  if (data.pendingLeaves > 0) {
    items.push({
      id: 'todo-pending-leaves',
      title: `${data.pendingLeaves}条请假待处理`,
      desc: '请及时处理待审批请假',
      level: 'high',
      category: 'leavePending',
    });
  }

  if (data.expiringPackages > 0) {
    items.push({
      id: 'todo-expiring-packages',
      title: `${data.expiringPackages}个课包即将到期`,
      desc: '请及时跟进续费提醒',
      url: '/package-course/pages/recharge-records/index',
      level: 'high',
      category: 'financePackage',
    });
  }

  if (data.lowHourStudents > 0) {
    items.push({
      id: 'todo-low-hour-students',
      title: `${data.lowHourStudents}位学员剩余课时不足`,
      desc: '请尽快安排续费或提醒',
      url: COURSE_MANAGEMENT_CLASS_TAB_URL,
      level: 'normal',
      category: 'studentRecharge',
    });
  }

  return items;
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

async function completeHomeTodo(
  todoId: string,
  payload: { userId: string; userName: string; note?: string },
): Promise<void> {
  const completion: TodoCompletion = {
    completedAt: new Date().toISOString(),
    completedBy: payload.userId,
    completedByName: payload.userName,
    note: payload.note?.trim() || undefined,
  };

  if (isCustomTodoId(todoId)) {
    completeCustomTodo(payload.userId, todoId, payload.note);
    return;
  }
  if (!USE_MOCK) notWired('home.completeTodo');
  saveTodoCompletion(todoId, completion);
  markTodoRead(todoId);
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
    campusId?: string,
  ): Promise<HomeScheduleItem[]> => {
    if (!USE_MOCK && role === 'teacher') {
      try {
        const params = new URLSearchParams();
        if (campusId) params.set('campusId', campusId);
        const query = params.toString();
        const aggregate = await get<BackendTeacherHomeResponse>(
          `/home/teacher${query ? `?${query}` : ''}`,
        );
        return mapBackendTeacherHome(aggregate).schedules;
      } catch {
        return [];
      }
    }

    return (await mockGetTodaySchedules(teacherId, campusId)).map(mapTodaySchedule);
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

  /** 获取待办事项列表 */
  getTodoItems: async (
    teacherId: string,
    role?: UserRole | null,
    campusId?: string,
    userId?: string,
    userName?: string,
  ): Promise<HomeTodoItem[]> => {
    if (userId) ensureMockCustomTodoSeeds(userId);
    const customTodoItems = userId
      ? sortCustomTodos(getCustomTodos(userId)).map((record) =>
          enrichTodoItem(mapCustomTodoToHomeItem(record, userName), userId),
        )
      : [];

    const canShared = role === 'admin' || role === 'principal' || role === 'teacher';

    const [operationAlertList, financeAlertList] = await Promise.all([
      statisticsService.getAlerts(getCurrentAlertQueryParams('operation')).catch((): AlertItem[] => []),
      statisticsService.getAlerts(getCurrentAlertQueryParams('finance')).catch((): AlertItem[] => []),
    ]);
    const operationTodos = operationAlertList
      .flatMap(mapOperationAlertToStudentTodos)
      .filter((todo) => canShared || todo.sharedScope !== 'campus_ops');
    const financeTodos = financeAlertList
      .filter((alert) => alert.id !== 'fin-stable')
      .map(mapAlertToHomeTodoItem)
      .map((todo) =>
        enrichTodoItem({ ...todo, sourceType: 'system', pushedAt: new Date().toISOString() }, userId),
      );
    const alertTodoItems = [...operationTodos, ...financeTodos].map((todo) =>
      enrichTodoItem(todo, userId),
    );

    if (!USE_MOCK && role === 'teacher') {
      try {
        const params = new URLSearchParams();
        if (campusId) params.set('campusId', campusId);
        const query = params.toString();
        const data = await get<BackendTeacherTodosResponse>(
          `/home/teacher/todos${query ? `?${query}` : ''}`,
        );
        // 服务端象限覆盖写入本地缓存，enrich 时与 Mock 路径一致
        if (userId && data.quadrantOverrides) {
          Object.entries(data.quadrantOverrides).forEach(([id, q]) => {
            if (q === 'q1' || q === 'q2' || q === 'q3' || q === 'q4') {
              saveTodoQuadrantOverride(userId, id, q);
            }
          });
        }
        return filterTodosBySettings([
          ...customTodoItems,
          ...alertTodoItems,
          ...mapBackendTodoItems(data).map((todo) =>
            enrichTodoItem(
              { ...todo, sourceType: 'system', pushedAt: new Date().toISOString() },
              userId,
            ),
          ),
        ]);
      } catch {
        return filterTodosBySettings([...customTodoItems, ...alertTodoItems]);
      }
    }

    const fixedTodos = (await mockGetTodoItems(teacherId, campusId))
      .map(mapTodoItem)
      .map((todo) => enrichTodoItem(todo, userId));
    return filterTodosBySettings([...customTodoItems, ...alertTodoItems, ...fixedTodos]);
  },

  /** 添加用户自定义待办 */
  addCustomTodo: async (userId: string, input: AddCustomTodoInput): Promise<HomeTodoItem> => {
    if (!USE_MOCK) notWired('home.addCustomTodo');
    const record = addCustomTodo(userId, input);
    return mapCustomTodoToHomeItem(record);
  },

  /** 「我的待办」列表：当前用户全部自定义待办（含已完成） */
  listCustomTodos: async (userId: string): Promise<CustomTodoRecord[]> => {
    if (!USE_MOCK) notWired('home.listCustomTodos');
    if (!userId) return [];
    ensureMockCustomTodoSeeds(userId);
    // 「我的待办」默认按截止日期；页面侧还可再按用户选择重排
    return sortCustomTodosByMode(getCustomTodos(userId), 'deadline');
  },

  /** 删除自定义待办 */
  removeCustomTodo: async (userId: string, todoId: string): Promise<boolean> => {
    if (!USE_MOCK) notWired('home.removeCustomTodo');
    return removeCustomTodo(userId, todoId);
  },

  /** 将已完成的自定义待办重新打开为未完成 */
  reopenCustomTodo: async (userId: string, todoId: string): Promise<boolean> => {
    if (!USE_MOCK) notWired('home.reopenCustomTodo');
    return reopenCustomTodo(userId, todoId);
  },

  /**
   * 更新待办四象限（事态等级）
   *
   * 链路：四象限看板拖拽 → 本方法 → Mock 本地 / 真实 PUT → enrich 读覆盖表。
   * 后端契约见 `docs/todo/07-todo-quadrant-api-contract.md`。
   */
  updateTodoQuadrant: async (
    userId: string,
    todoId: string,
    quadrant: TodoQuadrant,
  ): Promise<boolean> => {
    if (!userId || !todoId) return false;

    if (USE_MOCK) {
      if (isCustomTodoId(todoId)) {
        if (!updateCustomTodoQuadrant(userId, todoId, quadrant)) return false;
      }
      saveTodoQuadrantOverride(userId, todoId, quadrant);
      return true;
    }

    try {
      await put<UpdateTodoQuadrantResponse>(
        `/home/teacher/todos/${encodeURIComponent(todoId)}/quadrant`,
        { quadrant } satisfies UpdateTodoQuadrantRequest,
      );
    } catch {
      return false;
    }

    if (isCustomTodoId(todoId)) {
      updateCustomTodoQuadrant(userId, todoId, quadrant);
    }
    saveTodoQuadrantOverride(userId, todoId, quadrant);
    return true;
  },

  /**
   * @deprecated 使用 updateTodoQuadrant（行为相同）
   */
  updateCustomTodoQuadrant: async (
    userId: string,
    todoId: string,
    quadrant: TodoQuadrant,
  ): Promise<boolean> => {
    return homeService.updateTodoQuadrant(userId, todoId, quadrant);
  },

  completeTodo: completeHomeTodo,

  /** @deprecated 使用 completeTodo */
  markTodoRead: async (
    todoId: string,
    userId?: string,
    userName?: string,
    note?: string,
  ): Promise<void> => {
    if (userId && userName) {
      await completeHomeTodo(todoId, { userId, userName, note });
      return;
    }
    if (isCustomTodoId(todoId) && userId) {
      completeCustomTodo(userId, todoId);
      return;
    }
    if (!USE_MOCK) notWired('home.markTodoRead');
    markTodoRead(todoId);
  },

  /** 获取最近消课记录 */
  getRecentGroups: async (
    teacherId: string,
    role?: UserRole | null,
    campusId?: string,
  ): Promise<HomeRecentGroup[]> => {
    if (!USE_MOCK && role === 'teacher') {
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

    return (await mockGetRecentGroups(teacherId, campusId)).map(mapRecentGroup);
  },

  // 家长端
  getStudentsByParent: (parentId: string) => mockHomeGetStudentsByParent(parentId),
  getSchedulesByStudent: (studentId: string) => mockGetSchedulesByStudent(studentId),
  getRecordsByStudent: (studentId: string, limit?: number) =>
    mockHomeGetRecordsByStudent(studentId, limit),
  getPackagesByStudent: (studentId: string) => mockHomeGetPackagesByStudent(studentId),
};
