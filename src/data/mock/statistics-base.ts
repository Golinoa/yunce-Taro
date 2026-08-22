/**
 * Mock 数据基础 — 全局唯一数据源
 *
 * 设计原则：
 * 1. 所有业务数据从基础实体派生，保证逻辑一致性
 * 2. 学员消课 = 教师上课 = 校区业绩，三者互相对应
 * 3. 财务数据 = 收入/支出/利润，与运营数据关联
 * 4. 联调时只需替换此文件的数据源即可
 */

// ============================================
// 基础实体定义
// ============================================

/** 校区 */
import {
  CAMPUSES as DB_CAMPUSES,
  TEACHERS as DB_TEACHERS,
  STUDENTS as DB_STUDENTS,
  LESSON_RECORDS as DB_LESSON_RECORDS,
  CLASSES as DB_CLASSES,
  COURSE_PACKAGES as DB_PACKAGES,
  TEACHER_SALARY_RECORDS as DB_SALARY,
} from '@/data/mock-database';

export interface MockCampus {
  id: string;
  name: string;
  /** 教师列表 */
  teacherIds: string[];
}

/** 教师 */
export interface MockTeacher {
  id: string;
  name: string;
  campusId: string;
  /** 月薪（元） */
  monthlySalary: number;
}

/** 学员 */
export interface MockStudent {
  id: string;
  name: string;
  campusId: string;
  /** 入学日期 */
  enrollDate: string;
  /** 购买课时 */
  totalHours: number;
  /** 已消课时 */
  usedHours: number;
  /** 剩余课时 */
  remainingHours: number;
  /** 课包到期日 */
  expiryDate: string;
  /** 缴费金额 */
  feeAmount: number;
  /** 是否已缴费 */
  paid: boolean;
  /** 缴费日期 */
  payDate?: string;
  /** 最后上课日期 */
  lastLessonDate: string;
  /** 课程类型 */
  courseType: string;
}

/** 上课记录 */
export interface MockLessonRecord {
  id: string;
  studentId: string;
  teacherId: string;
  campusId: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 课时数 */
  hours: number;
  /** 课消金额（元） */
  amount: number;
}

// ============================================
// 校区数据
// ============================================

export const CAMPUSES: MockCampus[] = DB_CAMPUSES.map((c) => ({
  id: c.id,
  name: c.name,
  teacherIds: DB_TEACHERS.filter((t) => (t.campusIds || []).includes(c.id)).map((t) => t.id),
}));

export const TEACHERS: MockTeacher[] = DB_TEACHERS.map((t) => {
  const salary = DB_SALARY.filter((r) => r.teacherId === t.id);
  const last = salary[salary.length - 1];
  return {
    id: t.id,
    name: t.name,
    campusId: (t.campusIds || [])[0] || '',
    monthlySalary: last ? last.total : 0,
  };
});

export const STUDENTS: MockStudent[] = DB_STUDENTS.map((s) => {
  const totalHours = s.totalHours || 0;
  const remainingHours = s.remainingHours || 0;
  const usedHours = Math.max(totalHours - remainingHours, 0);
  const packages = DB_PACKAGES.filter((p) => p.studentId === s.id);
  const feeAmount = packages.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const lastRecord = DB_LESSON_RECORDS.filter((r) => r.studentId === s.id).sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];
  return {
    id: s.id,
    name: s.name,
    campusId: s.campusId,
    enrollDate: (s.createdAt || '').slice(0, 10),
    totalHours,
    usedHours,
    remainingHours,
    expiryDate: '',
    feeAmount,
    paid: true,
    payDate: (s.createdAt || '').slice(0, 10),
    lastLessonDate: lastRecord ? lastRecord.date : '',
    courseType:
      packages[0]?.type === 'term' ? '学期卡' : packages[0]?.type === 'monthly' ? '月卡' : '课时包',
  };
});

export const LESSON_RECORDS: MockLessonRecord[] = DB_LESSON_RECORDS.map((r) => {
  const cls = DB_CLASSES.find((c) => c.id === r.classId);
  return {
    id: r.id,
    studentId: r.studentId,
    teacherId: r.teacherId,
    campusId: r.campusId,
    date: r.date,
    hours: r.hours,
    amount: Math.round(r.hours * (cls?.pricePerLesson || 100)),
  };
});

// ============================================
// 派生计算函数 — 所有数据从基础实体计算
// ============================================

/** 计算运营KPI */
export function computeOperationKpi() {
  const totalStudents = STUDENTS.length;
  const newStudents = STUDENTS.filter((s) => s.enrollDate >= '2026-06-01').length;
  const totalHours = LESSON_RECORDS.reduce((sum, r) => sum + r.hours, 0);
  const totalLessons = LESSON_RECORDS.length;
  const totalRemaining = STUDENTS.reduce((sum, s) => sum + s.remainingHours, 0);

  return {
    students: totalStudents,
    studentsTrend: `+${newStudents}`,
    studentsNote: `本月新增 +${newStudents}`,
    hours: totalHours,
    hoursTrend: '+8.2%',
    count: totalLessons,
    countTrend: '+12.5%',
    newSign: newStudents,
    newSignNote: `¥${STUDENTS.filter((s) => s.enrollDate >= '2026-06-01')
      .reduce((sum, s) => sum + s.feeAmount, 0)
      .toLocaleString()} 新签金额`,
    remain: totalRemaining,
    remainNote: `可消约${(totalRemaining / totalHours).toFixed(1)}个月`,
  };
}

/** 计算财务KPI */
export function computeFinanceKpi() {
  const totalRevenue = STUDENTS.filter(
    (s) => s.paid && s.payDate && s.payDate >= '2026-06-01',
  ).reduce((sum, s) => sum + s.feeAmount, 0);
  const lessonAmount = LESSON_RECORDS.reduce((sum, r) => sum + r.amount, 0);
  const newSignStudents = STUDENTS.filter((s) => s.enrollDate >= '2026-06-01');
  const newSignAmount = newSignStudents.reduce((sum, s) => sum + s.feeAmount, 0);
  const unpaidStudents = STUDENTS.filter((s) => !s.paid);
  const unpaidAmount = unpaidStudents.reduce((sum, s) => sum + s.feeAmount, 0);
  const feeCount =
    STUDENTS.filter((s) => s.paid && s.payDate && s.payDate >= '2026-06-01').length +
    unpaidStudents.length;
  const avgPrice = feeCount > 0 ? Math.round(totalRevenue / feeCount) : 0;

  // 收支利润概览数据
  const totalSalary = TEACHERS.reduce((sum, t) => sum + t.monthlySalary, 0);
  const rent = 28000; // 场地租金
  const utilities = Math.round(totalSalary * 0.096); // 水电
  const marketing = Math.round(totalSalary * 0.08); // 营销
  const other = Math.round(totalSalary * 0.07); // 其他
  const totalExpense = totalSalary + rent + utilities + marketing + other;
  const netProfit = totalRevenue - totalExpense;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    revenue: `¥${totalRevenue.toLocaleString()}`,
    revenueBadge: '+12.3%',
    bills: `${feeCount}笔收费`,
    avg: `客均 ¥${avgPrice.toLocaleString()}`,
    lessonAmount: `¥${lessonAmount.toLocaleString()}`,
    lessonTrend: '+8.7%',
    newAmount: `¥${newSignAmount.toLocaleString()}`,
    newNote: `${newSignStudents.length}位新学员`,
    pending: `¥${unpaidAmount.toLocaleString()}`,
    pendingNote: unpaidStudents.length > 0 ? `${unpaidStudents.length}笔待收` : '无待收',
    totalRevenue: `¥${totalRevenue.toLocaleString()}`,
    totalExpense: `¥${totalExpense.toLocaleString()}`,
    netProfit: `¥${netProfit.toLocaleString()}`,
    profitMargin: `${profitMargin.toFixed(1)}%`,
  };
}

/** 计算学员消课排行 */
export function computeStudentRank() {
  const map = new Map<string, { name: string; hours: number }>();
  LESSON_RECORDS.forEach((r) => {
    const student = STUDENTS.find((s) => s.id === r.studentId);
    if (!student) return;
    const prev = map.get(r.studentId) || { name: student.name, hours: 0 };
    prev.hours += r.hours;
    map.set(r.studentId, prev);
  });
  return [...map.values()]
    .sort((a, b) => b.hours - a.hours)
    .map((item) => ({ label: item.name, value: item.hours, unit: '课时' }));
}

/** 计算教师上课排行 */
export function computeTeacherRank() {
  const map = new Map<string, { name: string; hours: number }>();
  LESSON_RECORDS.forEach((r) => {
    const teacher = TEACHERS.find((t) => t.id === r.teacherId);
    if (!teacher) return;
    const prev = map.get(r.teacherId) || { name: teacher.name, hours: 0 };
    prev.hours += r.hours;
    map.set(r.teacherId, prev);
  });
  return [...map.values()]
    .sort((a, b) => b.hours - a.hours)
    .map((item) => ({ label: item.name, value: item.hours, unit: '课时' }));
}

/** 计算校区业绩排行 */
export function computeCampusRank() {
  const map = new Map<string, { name: string; amount: number }>();
  LESSON_RECORDS.forEach((r) => {
    const campus = CAMPUSES.find((c) => c.id === r.campusId);
    if (!campus) return;
    const prev = map.get(r.campusId) || { name: campus.name, amount: 0 };
    prev.amount += r.amount;
    map.set(r.campusId, prev);
  });
  return [...map.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({ label: item.name, value: item.amount, unit: '元' }));
}

/** 计算环比/同比数据 */
export function computeCompare() {
  return {
    mom: '+12.3%',
    momValue: '上月 ¥6,920',
    yoy: '+28.5%',
    yoyValue: '去年 ¥6,100',
  };
}

/** 计算财务分析数据 */
export function computeFinanceAnalysis() {
  const totalRevenue =
    LESSON_RECORDS.reduce((sum, r) => sum + r.amount, 0) +
    STUDENTS.filter((s) => s.enrollDate >= '2026-06-01').reduce((sum, s) => sum + s.feeAmount, 0);
  const lessonAmount = LESSON_RECORDS.reduce((sum, r) => sum + r.amount, 0);
  const newSignAmount = STUDENTS.filter((s) => s.enrollDate >= '2026-06-01').reduce(
    (sum, s) => sum + s.feeAmount,
    0,
  );
  const totalSalary = TEACHERS.reduce((sum, t) => sum + t.monthlySalary, 0);
  const rent = 28000; // 场地租金
  const utilities = Math.round(totalSalary * 0.096); // 水电
  const marketing = Math.round(totalSalary * 0.08); // 营销
  const other = Math.round(totalSalary * 0.07); // 其他
  const totalExpense = totalSalary + rent + utilities + marketing + other;
  const netProfit = totalRevenue - totalExpense;

  return {
    totalRevenue: `¥${totalRevenue.toLocaleString()}`,
    totalExpense: `¥${totalExpense.toLocaleString()}`,
    netProfit: `¥${netProfit.toLocaleString()}`,
    profitMargin: `${((netProfit / totalRevenue) * 100).toFixed(1)}%`,
    expenseTrend: '+5.2%',
    incomeComposition: [
      {
        label: '课消收入',
        amount: `¥${lessonAmount.toLocaleString()}`,
        percent: Math.round((lessonAmount / totalRevenue) * 1000) / 10,
        barClass: 'bg-progress-primary',
      },
      {
        label: '新签收入',
        amount: `¥${newSignAmount.toLocaleString()}`,
        percent: Math.round((newSignAmount / totalRevenue) * 1000) / 10,
        barClass: 'bg-progress-purple',
      },
    ],
    expenseComposition: [
      {
        label: '教师薪资',
        amount: `¥${totalSalary.toLocaleString()}`,
        percent: Math.round((totalSalary / totalExpense) * 1000) / 10,
        barClass: 'bg-progress-primary',
      },
      {
        label: '场地租金',
        amount: `¥${rent.toLocaleString()}`,
        percent: Math.round((rent / totalExpense) * 1000) / 10,
        barClass: 'bg-progress-purple',
      },
      {
        label: '水电物业',
        amount: `¥${utilities.toLocaleString()}`,
        percent: Math.round((utilities / totalExpense) * 1000) / 10,
        barClass: 'bg-info',
      },
      {
        label: '营销推广',
        amount: `¥${marketing.toLocaleString()}`,
        percent: Math.round((marketing / totalExpense) * 1000) / 10,
        barClass: 'bg-success',
      },
      {
        label: '其他支出',
        amount: `¥${other.toLocaleString()}`,
        percent: Math.round((other / totalExpense) * 1000) / 10,
        barClass: 'bg-muted-foreground',
      },
    ],
    compare: computeCompare(),
  };
}

/** 12个月趋势数据 */
export function computeTrend() {
  // 基于当前数据量模拟12个月趋势
  const currentHours = LESSON_RECORDS.reduce((sum, r) => sum + r.hours, 0);
  const currentAmount = LESSON_RECORDS.reduce((sum, r) => sum + r.amount, 0);
  const months = [
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
  ];
  // 模拟波动系数
  const hourFactors = [0.55, 0.78, 0.62, 0.48, 0.72, 0.88, 0.4, 0.32, 0.95, 0.76, 1.1, 1.0];
  const amountFactors = [0.5, 0.7, 0.55, 0.45, 0.65, 0.82, 0.38, 0.28, 0.88, 0.68, 1.02, 1.0];

  return {
    lessonTrend: months.map((label, i) => ({
      label,
      value: Math.round(currentHours * hourFactors[i]),
      unit: '课时',
    })),
    incomeTrend: months.map((label, i) => ({
      label,
      value: Math.round(currentAmount * amountFactors[i]),
      unit: '元',
    })),
  };
}
