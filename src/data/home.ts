/**
 * 首页 Mock 数据接口
 * 使用统一数据源 src/data/mock-database.ts
 */
import {
  STUDENTS,
  CLASSES,
  COURSE_PACKAGES,
  SCHEDULES,
  LESSON_RECORDS,
  LEAVE_REQUESTS,
  MONTHLY_STATS,
  TEACHERS,
  USERS,
  CUR_YEAR,
  CUR_MONTH,
  CUR_DAY,
  type LessonRecord,
} from './mock-database';
import { COURSE_MANAGEMENT_CLASS_TAB_URL } from './course-category';
import {
  filterClassesByActor,
  filterLessonRecordsByActor,
  filterSchedulesByActor,
  filterStudentsByActor,
  getActorScope,
} from './students';

function delay(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** HH:mm → 当天分钟数（endTime 可超 1440，如 '24:30' = 1470，表示跨 0 点） */
function getMinutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

// 获取今日日期字符串（提前声明，避免使用前未定义）
const todayStr = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}-${String(CUR_DAY).padStart(2, '0')}`;

/** 统计时段类型 */
export type StatsPeriod = 'today' | 'week' | 'lastWeek' | 'month';

/** 统计数据 */
export interface StatsData {
  checkinCount: number;
  leaveCount: number;
  lessonHours: number;
  lessonAmount: number;
}

export interface QuickEntry {
  label: string;
  icon: string;
  color: string;
  url: string;
}

export interface TodoItemData {
  id: string;
  title: string;
  type: 'alert' | 'lesson' | 'recharge' | 'meeting' | 'salary' | 'checkin';
  time: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  /** checkin 待办专属：未点名排课的课节/班级/日期，用于跳转 lesson-form 补点名页 */
  scheduleId?: string;
  classId?: string;
  lessonDate?: string;
}

export interface RecentGroupData {
  id: string;
  name: string;
  date: string;
  count: number;
  status: 'normal' | 'warning';
}

export type OperationActionType = 'NONE' | 'PAGE' | 'TAB' | 'WEBVIEW' | 'ACTIVITY' | 'MINI_PROGRAM';

export interface OperationActionConfigData {
  type: OperationActionType;
  path?: string;
  url?: string;
  appId?: string;
  activityId?: string;
}

export interface OperationDisplayConfigData {
  badgeText?: string;
  theme?: 'dark' | 'light' | 'primary';
}

export interface OperationBannerItemData {
  id: string;
  title: string;
  imageUrl: string;
  summary?: string;
  content?: string;
  actionConfig?: OperationActionConfigData;
  displayConfig?: OperationDisplayConfigData;
}

export interface OperationActivityItemData {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  coverImageUrl?: string;
  actionConfig?: OperationActionConfigData;
  displayConfig?: OperationDisplayConfigData;
}

export interface HomeOperationContentData {
  placements: {
    banners: OperationBannerItemData[];
    cards: OperationActivityItemData[];
    floatings: OperationActivityItemData[];
    notices: OperationActivityItemData[];
    popups: OperationActivityItemData[];
  };
  updatedAt: string;
}

export const HOME_QUICK_ENTRIES: QuickEntry[] = [
  {
    label: '课时充值',
    icon: 'mdi-cash-plus',
    color: 'icon-glass-red',
    url: '/package-course/pages/package-form/index',
  },
  {
    label: '添加学员',
    icon: 'mdi-account-plus',
    color: 'icon-glass-orange',
    url: '/package-student/pages/student-form/index',
  },
  {
    label: '考勤记录',
    icon: 'mdi-clipboard-text',
    color: 'icon-glass-blue',
    url: '/package-teacher/pages/attendance/index',
  },
  {
    label: '试听记录',
    icon: 'mdi-clock-outline',
    color: 'icon-glass-purple',
    url: '/package-student/pages/student-form/index',
  },
  {
    label: '课时套餐',
    icon: 'mdi-package-variant',
    color: 'icon-glass-red',
    url: '/package-course/pages/course-packages/index',
  },
  {
    label: '班级管理',
    icon: 'mdi-school',
    color: 'icon-glass-blue',
    url: COURSE_MANAGEMENT_CLASS_TAB_URL,
  },
  {
    label: '教师管理',
    icon: 'mdi-account-supervisor',
    color: 'icon-glass-purple',
    url: '/package-teacher/pages/teacher-list/index',
  },
  {
    label: '校区设置',
    icon: 'mdi-map-marker',
    color: 'icon-glass-violet',
    url: '/package-settings/pages/campus-settings/index',
  },
];

const BASE_HOME_OPERATION_CONTENT: HomeOperationContentData = {
  placements: {
    // 广告位默认隐藏（联调后由后端控制是否展示）
    banners: [],
    // 运营卡片默认隐藏（联调后由后端控制是否展示）
    cards: [],
    // 悬浮入口默认隐藏（联调后由后端控制是否展示）
    floatings: [],
    // 校区公告功能暂未上线，默认隐藏
    notices: [],
    // 弹窗默认关闭（联调后由后端控制是否展示）
    popups: [],
  },
  updatedAt: `${todayStr} 09:00:00`,
};

function buildHomeOperationContent(role?: string | null): HomeOperationContentData {
  if (role === 'parent') {
    return {
      placements: {
        banners: [
          {
            id: 'banner-parent-lessons',
            title: '本周上课提醒',
            imageUrl:
              'https://dummyimage.com/750x320/8bc6ec/ffffff&text=%E6%9C%AC%E5%91%A8%E4%B8%8A%E8%AF%BE%E6%8F%90%E9%86%92',
            summary: '查看孩子本周排课与到课情况',
            actionConfig: {
              type: 'TAB',
              path: '/pages/schedule/index',
            },
          },
        ],
        cards: [],
        floatings: [],
        notices: [
          {
            id: 'notice-parent-lesson',
            title: '课前提醒',
            summary: '请提前 10 分钟到校，避免影响课堂秩序',
            actionConfig: {
              type: 'NONE',
            },
          },
        ],
        popups: [],
      },
      updatedAt: BASE_HOME_OPERATION_CONTENT.updatedAt,
    };
  }

  if (role === 'teacher') {
    // 教师端复用基础运营内容（已移除"今日教学提醒"）
    return {
      ...BASE_HOME_OPERATION_CONTENT,
      placements: {
        ...BASE_HOME_OPERATION_CONTENT.placements,
        popups: [],
      },
    };
  }

  return BASE_HOME_OPERATION_CONTENT;
}

// 计算今日消课记录
const todayLessons = LESSON_RECORDS.filter((r) => r.date === todayStr && r.status === 'checked');
const todayHours = todayLessons.reduce((sum, r) => sum + r.hours, 0);
const todayAmount = todayLessons.reduce((sum, r) => {
  const cls = CLASSES.find((c) => c.id === r.classId);
  return sum + (cls?.pricePerLesson || 0) * r.hours;
}, 0);

// 计算本周消课记录
const weekStart = new Date(CUR_YEAR, CUR_MONTH - 1, CUR_DAY);
weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
const weekEnd = new Date(weekStart);
weekEnd.setDate(weekEnd.getDate() + 7);

const weekLessons = LESSON_RECORDS.filter((r) => {
  const d = new Date(r.date);
  return d >= weekStart && d < weekEnd && r.status === 'checked';
});
const weekHours = weekLessons.reduce((sum, r) => sum + r.hours, 0);
const weekAmount = weekLessons.reduce((sum, r) => {
  const cls = CLASSES.find((c) => c.id === r.classId);
  return sum + (cls?.pricePerLesson || 0) * r.hours;
}, 0);

// 计算本月消课记录
const monthStart = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}-01`;
const monthLessons = LESSON_RECORDS.filter(
  (r) => r.date >= monthStart && r.date <= todayStr && r.status === 'checked',
);
const monthHours = monthLessons.reduce((sum, r) => sum + r.hours, 0);
const monthAmount = monthLessons.reduce((sum, r) => {
  const cls = CLASSES.find((c) => c.id === r.classId);
  return sum + (cls?.pricePerLesson || 0) * r.hours;
}, 0);

// 计算上周数据
const lastWeekStart = new Date(weekStart);
lastWeekStart.setDate(lastWeekStart.getDate() - 7);
const lastWeekEnd = new Date(weekStart);

const lastWeekLessons = LESSON_RECORDS.filter((r) => {
  const d = new Date(r.date);
  return d >= lastWeekStart && d < lastWeekEnd && r.status === 'checked';
});
const lastWeekHours = lastWeekLessons.reduce((sum, r) => sum + r.hours, 0);
const lastWeekAmount = lastWeekLessons.reduce((sum, r) => {
  const cls = CLASSES.find((c) => c.id === r.classId);
  return sum + (cls?.pricePerLesson || 0) * r.hours;
}, 0);

function buildStatsFromRecords(records: LessonRecord[]): StatsData {
  const checkedRecords = records.filter((record) => record.status === 'checked');
  return {
    checkinCount: checkedRecords.length,
    leaveCount: records.filter((record) => record.status === 'leave').length,
    lessonHours: checkedRecords.reduce((sum, record) => sum + record.hours, 0),
    lessonAmount: checkedRecords.reduce((sum, record) => {
      const cls = CLASSES.find((item) => item.id === record.classId);
      return sum + (cls?.pricePerLesson || 0) * record.hours;
    }, 0),
  };
}

/** 不同时段的 Mock 统计数据 */
const MOCK_STATS_BY_PERIOD: Record<StatsPeriod, StatsData> = {
  today: {
    checkinCount: todayLessons.length,
    leaveCount: LESSON_RECORDS.filter((r) => r.date === todayStr && r.status === 'leave').length,
    lessonHours: todayHours,
    lessonAmount: todayAmount,
  },
  week: {
    checkinCount: weekLessons.length,
    leaveCount: LESSON_RECORDS.filter((r) => {
      const d = new Date(r.date);
      return d >= weekStart && d < weekEnd && r.status === 'leave';
    }).length,
    lessonHours: weekHours,
    lessonAmount: weekAmount,
  },
  lastWeek: {
    checkinCount: lastWeekLessons.length,
    leaveCount: LESSON_RECORDS.filter((r) => {
      const d = new Date(r.date);
      return d >= lastWeekStart && d < lastWeekEnd && r.status === 'leave';
    }).length,
    lessonHours: lastWeekHours,
    lessonAmount: lastWeekAmount,
  },
  month: {
    checkinCount: monthLessons.length,
    leaveCount: LESSON_RECORDS.filter(
      (r) => r.date >= monthStart && r.date <= todayStr && r.status === 'leave',
    ).length,
    lessonHours: monthHours,
    lessonAmount: monthAmount,
  },
};

/** 根据用户ID获取教师信息 */
export async function mockGetTeacher(userId: string) {
  await delay();
  const user = USERS.find((u) => u.id === userId);
  if (!user) return null;

  const teacher = TEACHERS.find((t) => t.userId === userId);
  if (!teacher) {
    const scope = getActorScope(userId);
    // 机构创建者(admin)/校长(principal) 无教师档案时，返回「所辖校区教师聚合」摘要，
    // 保证首页今日课表/待办等按管理员权限展示（2026-08-22 用户实测修复）。
    if (scope.role !== 'principal' && scope.role !== 'admin') return null;

    const visibleTeachers = TEACHERS.filter((item) =>
      item.campusIds.some((campusId) => scope.campusIds.includes(campusId)),
    );
    return {
      id: userId,
      userId,
      name: user.name,
      phone: user.phone,
      role: 'lead' as const,
      status: 'active' as const,
      avatar: user.avatar || '',
      totalHours: visibleTeachers.reduce((sum, item) => sum + item.totalHours, 0),
      monthHours: visibleTeachers.reduce((sum, item) => sum + item.monthHours, 0),
      pendingSalary: visibleTeachers.reduce((sum, item) => sum + item.pendingSalary, 0),
    };
  }

  return {
    id: teacher.id,
    userId: teacher.userId,
    name: teacher.name,
    phone: teacher.phone,
    role: teacher.role,
    status: teacher.status,
    avatar: user.avatar || '',
    totalHours: teacher.totalHours,
    monthHours: teacher.monthHours,
    pendingSalary: teacher.pendingSalary,
  };
}

/** 获取教师的学生列表 */
export async function mockGetStudents(teacherId: string, limit?: number) {
  await delay();
  let students = filterStudentsByActor(teacherId);
  if (limit) students = students.slice(0, limit);
  return students;
}

/** 获取今日排课（含昨日跨 0 点未完全下课的排课，用户口径 2026-08-24） */
export async function mockGetTodaySchedules(teacherId: string, campusId?: string) {
  await delay();
  const now = new Date();
  const todayWeekday = now.getDay() || 7; // 周日是0，转为7
  const yesterdayWeekday = todayWeekday === 1 ? 7 : todayWeekday - 1;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let schedules = filterSchedulesByActor(teacherId).filter((schedule) => {
    if (schedule.status !== 'scheduled') return false;
    if (schedule.dayOfWeek === todayWeekday) return true;
    // 昨日跨 0 点排课（endTime 超过 24:00，如 23:30-24:30）：次日未完全下课前继续显示
    if (schedule.dayOfWeek === yesterdayWeekday) {
      const endMinutes = getMinutesOfDay(schedule.endTime);
      if (endMinutes > 1440 && nowMinutes < endMinutes - 1440) {
        return true;
      }
    }
    return false;
  });
  // 机构创建者/跨校区管理者（accessScope=org）应看到全部校区课程（用户口径 2026-08-24），不做校区过滤
  const scope = getActorScope(teacherId);
  if (campusId && scope.accessScope !== 'org') {
    schedules = schedules.filter((schedule) => schedule.campusId === campusId);
  }
  return schedules;
}

/** 获取最近消课记录 */
export async function mockGetRecentRecords(teacherId: string, limit = 5, campusId?: string) {
  await delay();
  let records = filterLessonRecordsByActor(teacherId)
    .filter((r) => r.status === 'checked')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (campusId) {
    records = records.filter((record) => record.campusId === campusId);
  }
  return records.slice(0, limit);
}

/** 获取学生的课时套餐 */
export async function mockGetStudentPackages(studentId: string) {
  await delay();
  return COURSE_PACKAGES.filter((pkg) => pkg.studentId === studentId);
}

/** 获取教师所有学生的剩余课时总数 */
export async function mockGetTotalRemainingHours(teacherId: string) {
  await delay();
  return filterStudentsByActor(teacherId).reduce((sum, s) => sum + s.remainingHours, 0);
}

/** 获取未读通知数 */
export async function mockGetUnreadCount(_userId: string) {
  await delay();
  // 暂时返回模拟值
  return 3;
}

/** 获取今日已消课数 */
export async function mockGetTodayRecordCount(teacherId: string, campusId?: string) {
  await delay();
  let records = filterLessonRecordsByActor(teacherId);
  if (campusId) {
    records = records.filter((record) => record.campusId === campusId);
  }
  const visibleRecordIds = new Set(records.map((record) => record.id));
  return todayLessons.filter((record) => visibleRecordIds.has(record.id)).length;
}

/** 按时段获取统计数据 */
export async function mockGetStatsByPeriod(
  teacherId: string,
  period: StatsPeriod,
  campusId?: string,
) {
  await delay();
  let visibleRecords = filterLessonRecordsByActor(teacherId);
  if (campusId) {
    visibleRecords = visibleRecords.filter((record) => record.campusId === campusId);
  }
  const filteredRecords = visibleRecords.filter((record) => {
    const date = new Date(record.date);
    if (period === 'today') {
      return record.date === todayStr;
    }
    if (period === 'week') {
      return date >= weekStart && date < weekEnd;
    }
    if (period === 'lastWeek') {
      return date >= lastWeekStart && date < lastWeekEnd;
    }
    return record.date >= monthStart && record.date <= todayStr;
  });

  return buildStatsFromRecords(filteredRecords);
}

/** 获取待办事项列表 */
export async function mockGetTodoItems(
  teacherId: string,
  campusId?: string,
): Promise<TodoItemData[]> {
  await delay();
  let students = filterStudentsByActor(teacherId);
  let classes = filterClassesByActor(teacherId);
  if (campusId) {
    students = students.filter((student) => student.campusId === campusId);
    classes = classes.filter((cls) => cls.campusId === campusId);
  }
  const scope = getActorScope(teacherId);
  const lowHoursStudent = [...students]
    .sort((a, b) => a.remainingHours - b.remainingHours)
    .find((student) => student.remainingHours <= 12);
  const nextClass = [...classes].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

  return [
    // 发薪日提醒：提前 pushDaysBefore 天提醒（使用真实日期，与 mock 时间基准无关）
    (() => {
      const payDay = 15; // mock 默认发薪日
      const pushDaysBefore = 1; // mock 默认提前1天
      const realNow = new Date();
      const realMonth = realNow.getMonth() + 1;
      const realDay = realNow.getDate();
      const remindDay = payDay - pushDaysBefore;
      // 当月提醒（发薪日前 pushDaysBefore 天）
      if (realDay >= remindDay && realDay < payDay) {
        return {
          id: 'todo-salary-remind',
          title: `${realMonth}月工资即将发放`,
          type: 'salary' as const,
          time: `${payDay}日`,
          priority: 'high' as const,
          completed: false,
        };
      }
      // 发薪日当天
      if (realDay === payDay) {
        return {
          id: 'todo-salary-today',
          title: `今日发放${realMonth}月工资`,
          type: 'salary' as const,
          time: '今天',
          priority: 'high' as const,
          completed: false,
        };
      }
      return null;
    })(),
    nextClass
      ? {
          id: `todo-lesson-${nextClass.id}`,
          title: `${nextClass.name}备课确认`,
          type: 'lesson',
          time: nextClass.startTime,
          priority: 'high',
          completed: false,
        }
      : null,
    lowHoursStudent
      ? {
          id: `todo-recharge-${lowHoursStudent.id}`,
          title: `${lowHoursStudent.name}课时续费提醒`,
          type: 'recharge',
          time: '15:00',
          priority: 'medium',
          completed: false,
        }
      : null,
    {
      id: `todo-meeting-${teacherId}`,
      title: scope.role === 'principal' ? '校区经营复盘' : '本周教学复盘',
      type: 'meeting',
      time: '18:00',
      priority: 'low',
      completed: scope.role !== 'principal',
    },
    // 未点名降级待办（用户口径 2026-08-23）：昨日下课未点名的课 → 次日进待办提醒补点名
    (() => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
      const yesterdayWeekday = yesterday.getDay() || 7;
      const unattended = SCHEDULES.find((s) => {
        if (s.dayOfWeek !== yesterdayWeekday || s.status === 'cancelled' || !s.classId) {
          return false;
        }
        // 跨 0 点排课（endTime > 24:00，如 23:30-24:30）：实际下课在「今天」凌晨，
        // 昨天只是开始上课 → 不属于「昨日未点名」，由今日课表承担（今日课表按开始/结束任一天在今天展示）
        if (getMinutesOfDay(s.endTime) > 1440) {
          return false;
        }
        const cls = CLASSES.find((c) => c.id === s.classId);
        if (!cls || !cls.studentCount) return false;
        const hasRecord = LESSON_RECORDS.some(
          (r) =>
            r.classId === s.classId &&
            r.date === yesterdayStr &&
            (r.status === 'checked' || r.status === 'absent' || r.status === 'leave'),
        );
        return !hasRecord;
      });
      if (!unattended) return null;
      const cls = CLASSES.find((c) => c.id === unattended.classId);
      return {
        id: `todo-unattended-${unattended.id}-${yesterdayStr}`,
        title: `「${cls?.name || '班级'}」昨日未点名`,
        type: 'checkin' as const,
        time: '待补点名',
        priority: 'high' as const,
        completed: false,
        scheduleId: unattended.id,
        classId: unattended.classId,
        lessonDate: yesterdayStr,
      };
    })(),
  ].filter(Boolean) as TodoItemData[];
}

/** 获取最近消课记录 */
export async function mockGetRecentGroups(
  teacherId: string,
  campusId?: string,
): Promise<RecentGroupData[]> {
  await delay();
  let visibleClasses = filterClassesByActor(teacherId);
  if (campusId) {
    visibleClasses = visibleClasses.filter((cls) => cls.campusId === campusId);
  }
  const visibleClassIds = new Set(visibleClasses.map((cls) => cls.id));
  const groups = CLASSES.filter((cls) => visibleClassIds.has(cls.id))
    .map((cls) => {
      const recentChecked = LESSON_RECORDS.filter(
        (record) => record.classId === cls.id && record.status === 'checked',
      );
      const lastDate = recentChecked
        .map((record) => record.date)
        .sort((a, b) => b.localeCompare(a))[0];
      const count = recentChecked.filter((record) => record.date === lastDate).length;
      return {
        id: cls.id,
        name: cls.name,
        date: lastDate || '',
        count,
        status:
          count < Math.max(1, Math.floor(cls.studentCount / 2))
            ? ('warning' as const)
            : ('normal' as const),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);

  return groups;
}

/** 获取家长的学生列表 */
export async function mockGetStudentsByParent(parentId: string) {
  await delay();
  return STUDENTS.filter((s) => s.parentId === parentId);
}

/** 获取学生的排课 */
export async function mockGetSchedulesByStudent(studentId: string) {
  await delay();
  // 找到学生的班级，然后找到排课
  const student = STUDENTS.find((s) => s.id === studentId);
  if (!student) return [];

  return SCHEDULES.filter((s) => student.classIds.includes(s.classId || ''));
}

/** 获取学生的消课记录 */
export async function mockGetRecordsByStudent(studentId: string, limit?: number) {
  await delay();
  let records = LESSON_RECORDS.filter((r) => r.studentId === studentId);
  if (limit) records = records.slice(0, limit);
  return records;
}

/** 获取学生的课时套餐 */
export async function mockGetPackagesByStudent(studentId: string) {
  await delay();
  return COURSE_PACKAGES.filter((pkg) => pkg.studentId === studentId);
}

export async function mockGetHomeStats(period: StatsPeriod): Promise<StatsData> {
  await delay();
  return MOCK_STATS_BY_PERIOD[period];
}

export async function mockGetTodaySchedule(): Promise<typeof SCHEDULES> {
  await delay();
  const todayWeekday = new Date().getDay() || 7;
  return SCHEDULES.filter((s) => s.dayOfWeek === todayWeekday && s.status === 'scheduled');
}

export async function mockGetPendingLeaves(): Promise<number> {
  await delay();
  return LEAVE_REQUESTS.filter((r) => r.status === 'pending').length;
}

export async function mockGetQuickEntries(): Promise<QuickEntry[]> {
  await delay();
  return HOME_QUICK_ENTRIES;
}

export async function mockGetOperationContent(
  role?: string | null,
): Promise<HomeOperationContentData> {
  await delay();
  return buildHomeOperationContent(role);
}

// 导出统计数据供其他地方使用
export { MONTHLY_STATS, LESSON_RECORDS, LESSON_RECORDS as getLessonRecords };
