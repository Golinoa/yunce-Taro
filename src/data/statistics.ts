/**
 * 统计模块 Mock 数据
 * 使用统一数据源 src/data/mock-database.ts 和 src/data/mock/statistics-base.ts
 */
import Taro from '@tarojs/taro';
import { getAlertThreshold } from '@/utils/alert-config';
import {
  MONTHLY_STATS,
  CAMPUS_STATS,
  LESSON_RECORDS,
  TEACHERS,
  STUDENTS,
  COURSE_PACKAGES,
} from './mock-database';
import {
  filterLessonRecordsByActor,
  filterPackagesByActor,
  filterStudentsByActor,
} from './students';

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 运营预警「课时不足」默认值（用户口径 2026-08-22：5 课时）。
 * 运行时读取系统设置中保存的配置（见 utils/alert-config.ts），未配置时用本默认值。
 */
export const OPERATION_ALERT_THRESHOLD_HOURS = 5;

function getCurrentActorId(): string {
  try {
    const raw = Taro.getStorageSync('yunce-edu-user-profile');
    if (!raw) return '';
    const profile = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return profile?.id || '';
  } catch {
    return '';
  }
}

function getVisibleStudents() {
  const actorId = getCurrentActorId();
  return actorId ? filterStudentsByActor(actorId) : STUDENTS;
}

function getVisibleLessonRecords() {
  const actorId = getCurrentActorId();
  return actorId ? filterLessonRecordsByActor(actorId) : LESSON_RECORDS;
}

function getVisiblePackages() {
  const actorId = getCurrentActorId();
  return actorId ? filterPackagesByActor(actorId) : COURSE_PACKAGES;
}

// 转换为兼容旧接口的 ChartDataItem
interface ChartDataItem {
  label: string;
  value: number;
  unit: string;
}

/** 课时趋势（近12个月） */
export const MOCK_LESSON_TREND: ChartDataItem[] = MONTHLY_STATS.map((s) => ({
  label: `${s.month}月`,
  value: s.lessonHours,
  unit: '课时',
}));

/** 收入趋势（近12个月） */
export const MOCK_INCOME_TREND: ChartDataItem[] = MONTHLY_STATS.map((s) => ({
  label: `${s.month}月`,
  value: s.lessonAmount,
  unit: '元',
}));

/** 收费方式收入排行 */
export const MOCK_PAYMENT_RANK: ChartDataItem[] = [
  { label: '微信支付', value: 28600, unit: '元' },
  { label: '支付宝', value: 18400, unit: '元' },
  { label: '现金', value: 9800, unit: '元' },
  { label: '银行转账', value: 5200, unit: '元' },
  { label: '其他', value: 2600, unit: '元' },
];

/** 教师上课排行 */
export const MOCK_TEACHER_RANK: ChartDataItem[] = TEACHERS.map((t) => ({
  label: t.name,
  value: t.totalHours,
  unit: '课时',
})).sort((a, b) => b.value - a.value);

/** 校区业绩排行 */
export const MOCK_CAMPUS_RANK: ChartDataItem[] = CAMPUS_STATS.map((c) => {
  const campusNames: Record<string, string> = {
    'campus-center': '曦绘艺术',
    'campus-east': '城东校区',
    'campus-west': '城西校区',
  };
  return {
    label: campusNames[c.campusId] || c.campusId,
    value: c.monthAmount,
    unit: '元',
  };
}).sort((a, b) => b.value - a.value);

/** 家长端课时趋势 */
export const MOCK_PARENT_TREND: ChartDataItem[] = MONTHLY_STATS.slice(0, 6).map((s) => ({
  label: `${s.month}月`,
  value: s.lessonHours,
  unit: '课时',
}));

// 财务预警已改为实时计算（mockGetFinanceAlerts 遍历课包 expireDate），不再依赖静态常量。

export async function mockGetLessonTrend(): Promise<ChartDataItem[]> {
  await delay();
  const visibleRecords = getVisibleLessonRecords();
  if (!visibleRecords.length) return MOCK_LESSON_TREND;

  return MONTHLY_STATS.map((stat) => {
    const total = visibleRecords.reduce((sum, record) => {
      if (!record.date.startsWith(`${stat.year}-${String(stat.month).padStart(2, '0')}`)) {
        return sum;
      }
      return record.status === 'checked' ? sum + record.hours : sum;
    }, 0);
    return {
      label: `${stat.month}月`,
      value: total,
      unit: '课时',
    };
  });
}

export async function mockGetIncomeTrend(): Promise<ChartDataItem[]> {
  await delay();
  const visiblePackages = getVisiblePackages();
  if (!visiblePackages.length) return MOCK_INCOME_TREND;

  return MONTHLY_STATS.map((stat) => {
    const amount = visiblePackages.reduce((sum, pkg) => {
      if (!pkg.purchaseDate.startsWith(`${stat.year}-${String(stat.month).padStart(2, '0')}`)) {
        return sum;
      }
      return sum + pkg.totalAmount;
    }, 0);
    return {
      label: `${stat.month}月`,
      value: amount,
      unit: '元',
    };
  });
}

export async function mockGetParentTrend(): Promise<ChartDataItem[]> {
  await delay();
  return (await mockGetLessonTrend()).slice(-6);
}

export async function mockGetLessonRank(): Promise<ChartDataItem[]> {
  await delay();
  const visibleRecords = getVisibleLessonRecords();
  const visibleStudents = new Map(getVisibleStudents().map((student) => [student.id, student]));
  if (!visibleRecords.length || !visibleStudents.size) {
    return MOCK_PARENT_TREND;
  }

  // 学员课时消耗排行
  const studentHours: Record<string, number> = {};
  visibleRecords.forEach((r) => {
    if (r.status === 'checked') {
      studentHours[r.studentId] = (studentHours[r.studentId] || 0) + r.hours;
    }
  });
  return Object.entries(studentHours)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id, hours]) => {
      const student = visibleStudents.get(id);
      return { label: student?.name || id, value: hours, unit: '课时' };
    });
}

export async function mockGetPaymentRank(): Promise<ChartDataItem[]> {
  await delay();
  const visiblePackages = getVisiblePackages();
  if (!visiblePackages.length) return MOCK_PAYMENT_RANK;

  const paymentMap: Record<string, number> = {};
  visiblePackages.forEach((pkg) => {
    paymentMap[pkg.paymentMethod] = (paymentMap[pkg.paymentMethod] || 0) + pkg.totalAmount;
  });

  return Object.entries(paymentMap)
    .map(([label, value]) => ({
      label,
      value,
      unit: '元',
    }))
    .sort((a, b) => b.value - a.value);
}

export async function mockGetTeacherRank(): Promise<ChartDataItem[]> {
  await delay();
  return MOCK_TEACHER_RANK;
}

export async function mockGetCampusRank(): Promise<ChartDataItem[]> {
  await delay();
  return MOCK_CAMPUS_RANK;
}

export async function mockGetMonthlyStats(): Promise<typeof MONTHLY_STATS> {
  await delay();
  return MONTHLY_STATS;
}

export async function mockGetExpenseRatios() {
  await delay();
  return [
    { label: '教师薪资', ratio: 0.6, barClass: 'primary' },
    { label: '场地租金', ratio: 0.25, barClass: 'orange' },
    { label: '教材物料', ratio: 0.1, barClass: 'blue' },
    { label: '其他', ratio: 0.05, barClass: 'gray' },
  ];
}

export async function mockGetOperationAlerts() {
  await delay();
  const threshold = getAlertThreshold();
  const visibleStudents = getVisibleStudents()
    // 预警规则（用户口径 2026-08-22 确认）：
    // ① 常规提醒：剩余课时 ≤ 阈值（可配置，默认 5）→ 提醒续费；
    // ② 强制提醒：剩余 0 课时（最后一节课已用完）→ 无论阈值设多少，都必须提醒一次。
    .filter((student) => student.remainingHours <= threshold || student.remainingHours <= 0)
    .sort((a, b) => a.remainingHours - b.remainingHours)
    .slice(0, 5);

  if (!visibleStudents.length) {
    return [
      {
        id: 'op-stable',
        title: '运营状态稳定',
        type: 'operation' as const,
        level: 'primary' as const,
        desc: '当前无紧急运营预警，可持续关注续费与转化',
        count: 1,
        details: [{ id: 'stable-1', name: '当前无课时紧急预警', info: '可继续跟进转化与续费' }],
      },
    ];
  }

  const hasExhausted = visibleStudents.some((s) => s.remainingHours <= 0);

  return [
    {
      id: 'op-low-hours',
      title: hasExhausted ? '课时不足/已用尽预警' : '课时不足预警',
      type: 'operation' as const,
      level: 'warning' as const,
      desc: hasExhausted
        ? '以下学员课时不足或已用尽，请尽快安排续费沟通'
        : '以下学员剩余课时较低，建议尽快安排续费沟通',
      count: visibleStudents.length,
      details: visibleStudents.map((student) => ({
        id: `detail-${student.id}`,
        name: student.name,
        info:
          student.remainingHours <= 0
            ? '课时已用尽，请尽快续费'
            : `剩余 ${student.remainingHours} 课时`,
        refId: student.id,
      })),
    },
  ];
}

export async function mockGetFinanceAlerts() {
  await delay();
  const expiringPackages = getVisiblePackages()
    .filter((pkg) => pkg.expireDate)
    .sort((a, b) => (a.expireDate || '').localeCompare(b.expireDate || ''))
    .slice(0, 3);

  if (!expiringPackages.length) {
    return [
      {
        id: 'fin-stable',
        title: '财务状态稳定',
        type: 'finance' as const,
        level: 'primary' as const,
        desc: '当前无临近到期课包，可继续关注续费与转化',
        count: 1,
        details: [{ id: 'stable-1', name: '无课包紧急到期预警', info: '可继续跟进转化与续费' }],
      },
    ];
  }

  return [
    {
      id: 'fin-expire',
      title: '近期到期课包',
      type: 'finance' as const,
      level: 'primary' as const,
      desc: '以下课包即将到期，可提前发起续费提醒',
      count: expiringPackages.length,
      details: expiringPackages.map((pkg) => ({
        id: `pkg-${pkg.id}`,
        name: pkg.name,
        info: pkg.expireDate || '无到期时间',
      })),
    },
  ];
}
