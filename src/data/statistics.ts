/**
 * 统计模块 Mock 数据
 * 使用统一数据源 src/data/mock-database.ts 和 src/data/mock/statistics-base.ts
 */
import Taro from '@tarojs/taro';
import type { AlertItem as StatisticsAlertItem } from '@/components/statistics/AlertSheet';
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

/** 预警项目类型 */
interface AlertItem extends StatisticsAlertItem {
  type: 'operation' | 'finance';
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
    'campus-center': '中心校区',
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

/** 运营预警数据 */
export const MOCK_OPERATION_ALERTS: AlertItem[] = [
  {
    id: 'op1',
    title: '课时不足预警',
    type: 'operation',
    level: 'warning',
    desc: '多名学员剩余课时偏低，建议优先跟进续费',
    count: 5,
    details: [
      { id: 'd1', name: '张小明', info: '剩余 8 课时', refId: 'stu-003' },
      { id: 'd2', name: '李子轩', info: '剩余 12 课时', refId: 'stu-001' },
    ],
  },
  {
    id: 'op2',
    title: '本周消课高峰',
    type: 'operation',
    level: 'primary',
    desc: '本周末部分时段消课集中，建议提前排班',
    count: 1,
    details: [{ id: 'd3', name: '周六 14:00-16:00', info: '预计消课 12 节' }],
  },
];

/** 财务预警数据 */
export const MOCK_FINANCE_ALERTS: AlertItem[] = [
  {
    id: 'fin1',
    title: '本月收入趋势',
    type: 'finance',
    level: 'primary',
    desc: '本月营收保持上升，可继续追踪高转化科目',
    count: 1,
    details: [{ id: 'd4', name: '较上月', info: '+12.5%' }],
  },
];

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
  const visibleStudents = getVisibleStudents()
    .filter((student) => student.remainingHours <= 12)
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

  return [
    {
      id: 'op-low-hours',
      title: '课时不足预警',
      type: 'operation' as const,
      level: 'warning' as const,
      desc: '以下学员剩余课时较低，建议尽快安排续费沟通',
      count: visibleStudents.length,
      details: visibleStudents.map((student) => ({
        id: `detail-${student.id}`,
        name: student.name,
        info: `剩余 ${student.remainingHours} 课时`,
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
    return MOCK_FINANCE_ALERTS;
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
