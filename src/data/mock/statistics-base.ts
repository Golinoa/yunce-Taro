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

export const CAMPUSES: MockCampus[] = [
  { id: 'campus-01', name: '总校', teacherIds: ['tch-001', 'tch-002', 'tch-003'] },
  { id: 'campus-02', name: '城东分校', teacherIds: ['tch-004', 'tch-005'] },
  { id: 'campus-03', name: '城西分校', teacherIds: ['tch-006', 'tch-007'] },
  { id: 'campus-04', name: '城北分校', teacherIds: ['tch-008'] },
];

// ============================================
// 教师数据
// ============================================

export const TEACHERS: MockTeacher[] = [
  { id: 'tch-001', name: '张老师', campusId: 'campus-01', monthlySalary: 12000 },
  { id: 'tch-002', name: '李老师', campusId: 'campus-01', monthlySalary: 10000 },
  { id: 'tch-003', name: '王老师', campusId: 'campus-01', monthlySalary: 9500 },
  { id: 'tch-004', name: '赵老师', campusId: 'campus-02', monthlySalary: 8500 },
  { id: 'tch-005', name: '刘老师', campusId: 'campus-02', monthlySalary: 8000 },
  { id: 'tch-006', name: '陈老师', campusId: 'campus-03', monthlySalary: 7500 },
  { id: 'tch-007', name: '周老师', campusId: 'campus-03', monthlySalary: 7000 },
  { id: 'tch-008', name: '吴老师', campusId: 'campus-04', monthlySalary: 6500 },
];

// ============================================
// 学员数据
// ============================================

export const STUDENTS: MockStudent[] = [
  {
    id: 'stu-001',
    name: '张小明',
    campusId: 'campus-01',
    enrollDate: '2025-09-01',
    totalHours: 60,
    usedHours: 58,
    remainingHours: 2,
    expiryDate: '2025-06-20',
    feeAmount: 7200,
    paid: true,
    payDate: '2025-09-01',
    lastLessonDate: '2025-06-15',
    courseType: '钢琴',
  },
  {
    id: 'stu-002',
    name: '李小红',
    campusId: 'campus-01',
    enrollDate: '2025-10-15',
    totalHours: 48,
    usedHours: 45,
    remainingHours: 3,
    expiryDate: '2025-07-15',
    feeAmount: 5760,
    paid: true,
    payDate: '2025-10-15',
    lastLessonDate: '2025-06-17',
    courseType: '舞蹈',
  },
  {
    id: 'stu-003',
    name: '王小刚',
    campusId: 'campus-01',
    enrollDate: '2025-11-01',
    totalHours: 36,
    usedHours: 32,
    remainingHours: 4,
    expiryDate: '2025-08-01',
    feeAmount: 4320,
    paid: true,
    payDate: '2025-11-01',
    lastLessonDate: '2025-06-14',
    courseType: '美术',
  },
  {
    id: 'stu-004',
    name: '赵小丽',
    campusId: 'campus-01',
    enrollDate: '2025-03-01',
    totalHours: 40,
    usedHours: 39,
    remainingHours: 1,
    expiryDate: '2025-06-30',
    feeAmount: 4800,
    paid: true,
    payDate: '2025-03-01',
    lastLessonDate: '2025-05-10',
    courseType: '钢琴',
  },
  {
    id: 'stu-005',
    name: '刘小华',
    campusId: 'campus-02',
    enrollDate: '2025-04-01',
    totalHours: 30,
    usedHours: 27,
    remainingHours: 3,
    expiryDate: '2025-07-01',
    feeAmount: 3600,
    paid: true,
    payDate: '2025-04-01',
    lastLessonDate: '2025-05-05',
    courseType: '声乐',
  },
  {
    id: 'stu-006',
    name: '陈小雨',
    campusId: 'campus-02',
    enrollDate: '2025-08-01',
    totalHours: 48,
    usedHours: 40,
    remainingHours: 8,
    expiryDate: '2025-06-22',
    feeAmount: 5760,
    paid: false,
    payDate: undefined,
    lastLessonDate: '2025-06-16',
    courseType: '舞蹈',
  },
  {
    id: 'stu-007',
    name: '周子轩',
    campusId: 'campus-03',
    enrollDate: '2025-05-01',
    totalHours: 36,
    usedHours: 24,
    remainingHours: 12,
    expiryDate: '2025-06-18',
    feeAmount: 4320,
    paid: true,
    payDate: '2025-05-01',
    lastLessonDate: '2025-06-12',
    courseType: '美术',
  },
  {
    id: 'stu-008',
    name: '吴思琪',
    campusId: 'campus-03',
    enrollDate: '2025-12-01',
    totalHours: 60,
    usedHours: 48,
    remainingHours: 12,
    expiryDate: '2025-09-01',
    feeAmount: 7200,
    paid: true,
    payDate: '2025-12-01',
    lastLessonDate: '2025-06-17',
    courseType: '声乐',
  },
  {
    id: 'stu-009',
    name: '孙浩然',
    campusId: 'campus-03',
    enrollDate: '2025-02-01',
    totalHours: 24,
    usedHours: 20,
    remainingHours: 4,
    expiryDate: '2025-08-01',
    feeAmount: 2880,
    paid: true,
    payDate: '2025-02-01',
    lastLessonDate: '2025-04-28',
    courseType: '美术',
  },
  {
    id: 'stu-010',
    name: '赵敏',
    campusId: 'campus-04',
    enrollDate: '2025-06-01',
    totalHours: 30,
    usedHours: 22,
    remainingHours: 8,
    expiryDate: '2025-09-01',
    feeAmount: 3600,
    paid: true,
    payDate: '2025-06-01',
    lastLessonDate: '2025-05-12',
    courseType: '舞蹈',
  },
  {
    id: 'stu-011',
    name: '黄思远',
    campusId: 'campus-01',
    enrollDate: '2026-01-05',
    totalHours: 48,
    usedHours: 36,
    remainingHours: 12,
    expiryDate: '2026-07-05',
    feeAmount: 5760,
    paid: true,
    payDate: '2026-01-05',
    lastLessonDate: '2026-06-16',
    courseType: '钢琴',
  },
  {
    id: 'stu-012',
    name: '林雨萱',
    campusId: 'campus-02',
    enrollDate: '2026-02-10',
    totalHours: 36,
    usedHours: 28,
    remainingHours: 8,
    expiryDate: '2026-08-10',
    feeAmount: 4320,
    paid: true,
    payDate: '2026-02-10',
    lastLessonDate: '2026-06-15',
    courseType: '舞蹈',
  },
  {
    id: 'stu-013',
    name: '杨子涵',
    campusId: 'campus-01',
    enrollDate: '2026-03-01',
    totalHours: 60,
    usedHours: 42,
    remainingHours: 18,
    expiryDate: '2026-09-01',
    feeAmount: 7200,
    paid: true,
    payDate: '2026-03-01',
    lastLessonDate: '2026-06-17',
    courseType: '钢琴',
  },
  {
    id: 'stu-014',
    name: '何雨轩',
    campusId: 'campus-04',
    enrollDate: '2026-04-15',
    totalHours: 24,
    usedHours: 16,
    remainingHours: 8,
    expiryDate: '2026-10-15',
    feeAmount: 2880,
    paid: true,
    payDate: '2026-04-15',
    lastLessonDate: '2026-06-14',
    courseType: '美术',
  },
  {
    id: 'stu-015',
    name: '徐梦琪',
    campusId: 'campus-03',
    enrollDate: '2026-05-01',
    totalHours: 48,
    usedHours: 30,
    remainingHours: 18,
    expiryDate: '2026-11-01',
    feeAmount: 5760,
    paid: true,
    payDate: '2026-05-01',
    lastLessonDate: '2026-06-16',
    courseType: '声乐',
  },
  {
    id: 'stu-016',
    name: '马天宇',
    campusId: 'campus-02',
    enrollDate: '2026-06-01',
    totalHours: 36,
    usedHours: 8,
    remainingHours: 28,
    expiryDate: '2026-12-01',
    feeAmount: 4320,
    paid: false,
    payDate: undefined,
    lastLessonDate: '2026-06-17',
    courseType: '舞蹈',
  },
  {
    id: 'stu-017',
    name: '郭欣怡',
    campusId: 'campus-01',
    enrollDate: '2026-06-05',
    totalHours: 60,
    usedHours: 4,
    remainingHours: 56,
    expiryDate: '2027-06-05',
    feeAmount: 7200,
    paid: true,
    payDate: '2026-06-05',
    lastLessonDate: '2026-06-17',
    courseType: '钢琴',
  },
  {
    id: 'stu-018',
    name: '罗子墨',
    campusId: 'campus-03',
    enrollDate: '2026-06-10',
    totalHours: 24,
    usedHours: 2,
    remainingHours: 22,
    expiryDate: '2026-12-10',
    feeAmount: 2880,
    paid: true,
    payDate: '2026-06-10',
    lastLessonDate: '2026-06-16',
    courseType: '美术',
  },
];

// ============================================
// 本月上课记录（2026年6月）
// 从学员+教师+校区关系派生，保证数据一致
// ============================================

export const LESSON_RECORDS: MockLessonRecord[] = [
  // 总校 - 张老师
  {
    id: 'lr-001',
    studentId: 'stu-001',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-01',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-002',
    studentId: 'stu-004',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-02',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-003',
    studentId: 'stu-011',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-03',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-004',
    studentId: 'stu-013',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-04',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-005',
    studentId: 'stu-017',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-05',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-006',
    studentId: 'stu-001',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-07',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-007',
    studentId: 'stu-011',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-09',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-008',
    studentId: 'stu-013',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-11',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-009',
    studentId: 'stu-017',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-13',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-010',
    studentId: 'stu-001',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-15',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-011',
    studentId: 'stu-011',
    teacherId: 'tch-001',
    campusId: 'campus-01',
    date: '2026-06-17',
    hours: 2,
    amount: 240,
  },
  // 总校 - 李老师
  {
    id: 'lr-012',
    studentId: 'stu-002',
    teacherId: 'tch-002',
    campusId: 'campus-01',
    date: '2026-06-01',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-013',
    studentId: 'stu-003',
    teacherId: 'tch-002',
    campusId: 'campus-01',
    date: '2026-06-03',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-014',
    studentId: 'stu-002',
    teacherId: 'tch-002',
    campusId: 'campus-01',
    date: '2026-06-05',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-015',
    studentId: 'stu-003',
    teacherId: 'tch-002',
    campusId: 'campus-01',
    date: '2026-06-07',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-016',
    studentId: 'stu-002',
    teacherId: 'tch-002',
    campusId: 'campus-01',
    date: '2026-06-09',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-017',
    studentId: 'stu-003',
    teacherId: 'tch-002',
    campusId: 'campus-01',
    date: '2026-06-11',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-018',
    studentId: 'stu-002',
    teacherId: 'tch-002',
    campusId: 'campus-01',
    date: '2026-06-13',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-019',
    studentId: 'stu-003',
    teacherId: 'tch-002',
    campusId: 'campus-01',
    date: '2026-06-15',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-020',
    studentId: 'stu-002',
    teacherId: 'tch-002',
    campusId: 'campus-01',
    date: '2026-06-17',
    hours: 2,
    amount: 240,
  },
  // 总校 - 王老师
  {
    id: 'lr-021',
    studentId: 'stu-013',
    teacherId: 'tch-003',
    campusId: 'campus-01',
    date: '2026-06-02',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-022',
    studentId: 'stu-011',
    teacherId: 'tch-003',
    campusId: 'campus-01',
    date: '2026-06-04',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-023',
    studentId: 'stu-017',
    teacherId: 'tch-003',
    campusId: 'campus-01',
    date: '2026-06-06',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-024',
    studentId: 'stu-013',
    teacherId: 'tch-003',
    campusId: 'campus-01',
    date: '2026-06-08',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-025',
    studentId: 'stu-011',
    teacherId: 'tch-003',
    campusId: 'campus-01',
    date: '2026-06-10',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-026',
    studentId: 'stu-017',
    teacherId: 'tch-003',
    campusId: 'campus-01',
    date: '2026-06-12',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-027',
    studentId: 'stu-013',
    teacherId: 'tch-003',
    campusId: 'campus-01',
    date: '2026-06-14',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-028',
    studentId: 'stu-011',
    teacherId: 'tch-003',
    campusId: 'campus-01',
    date: '2026-06-16',
    hours: 2,
    amount: 240,
  },
  // 城东 - 赵老师
  {
    id: 'lr-029',
    studentId: 'stu-005',
    teacherId: 'tch-004',
    campusId: 'campus-02',
    date: '2026-06-01',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-030',
    studentId: 'stu-012',
    teacherId: 'tch-004',
    campusId: 'campus-02',
    date: '2026-06-03',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-031',
    studentId: 'stu-005',
    teacherId: 'tch-004',
    campusId: 'campus-02',
    date: '2026-06-05',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-032',
    studentId: 'stu-012',
    teacherId: 'tch-004',
    campusId: 'campus-02',
    date: '2026-06-07',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-033',
    studentId: 'stu-005',
    teacherId: 'tch-004',
    campusId: 'campus-02',
    date: '2026-06-09',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-034',
    studentId: 'stu-012',
    teacherId: 'tch-004',
    campusId: 'campus-02',
    date: '2026-06-11',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-035',
    studentId: 'stu-005',
    teacherId: 'tch-004',
    campusId: 'campus-02',
    date: '2026-06-13',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-036',
    studentId: 'stu-012',
    teacherId: 'tch-004',
    campusId: 'campus-02',
    date: '2026-06-15',
    hours: 2,
    amount: 240,
  },
  // 城东 - 刘老师
  {
    id: 'lr-037',
    studentId: 'stu-006',
    teacherId: 'tch-005',
    campusId: 'campus-02',
    date: '2026-06-02',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-038',
    studentId: 'stu-016',
    teacherId: 'tch-005',
    campusId: 'campus-02',
    date: '2026-06-04',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-039',
    studentId: 'stu-006',
    teacherId: 'tch-005',
    campusId: 'campus-02',
    date: '2026-06-06',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-040',
    studentId: 'stu-016',
    teacherId: 'tch-005',
    campusId: 'campus-02',
    date: '2026-06-08',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-041',
    studentId: 'stu-006',
    teacherId: 'tch-005',
    campusId: 'campus-02',
    date: '2026-06-10',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-042',
    studentId: 'stu-016',
    teacherId: 'tch-005',
    campusId: 'campus-02',
    date: '2026-06-12',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-043',
    studentId: 'stu-006',
    teacherId: 'tch-005',
    campusId: 'campus-02',
    date: '2026-06-14',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-044',
    studentId: 'stu-016',
    teacherId: 'tch-005',
    campusId: 'campus-02',
    date: '2026-06-16',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-045',
    studentId: 'stu-006',
    teacherId: 'tch-005',
    campusId: 'campus-02',
    date: '2026-06-17',
    hours: 2,
    amount: 240,
  },
  // 城西 - 陈老师
  {
    id: 'lr-046',
    studentId: 'stu-007',
    teacherId: 'tch-006',
    campusId: 'campus-03',
    date: '2026-06-01',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-047',
    studentId: 'stu-008',
    teacherId: 'tch-006',
    campusId: 'campus-03',
    date: '2026-06-03',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-048',
    studentId: 'stu-015',
    teacherId: 'tch-006',
    campusId: 'campus-03',
    date: '2026-06-05',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-049',
    studentId: 'stu-007',
    teacherId: 'tch-006',
    campusId: 'campus-03',
    date: '2026-06-07',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-050',
    studentId: 'stu-008',
    teacherId: 'tch-006',
    campusId: 'campus-03',
    date: '2026-06-09',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-051',
    studentId: 'stu-015',
    teacherId: 'tch-006',
    campusId: 'campus-03',
    date: '2026-06-11',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-052',
    studentId: 'stu-008',
    teacherId: 'tch-006',
    campusId: 'campus-03',
    date: '2026-06-13',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-053',
    studentId: 'stu-015',
    teacherId: 'tch-006',
    campusId: 'campus-03',
    date: '2026-06-15',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-054',
    studentId: 'stu-008',
    teacherId: 'tch-006',
    campusId: 'campus-03',
    date: '2026-06-16',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-055',
    studentId: 'stu-018',
    teacherId: 'tch-006',
    campusId: 'campus-03',
    date: '2026-06-16',
    hours: 2,
    amount: 240,
  },
  // 城西 - 周老师
  {
    id: 'lr-056',
    studentId: 'stu-009',
    teacherId: 'tch-007',
    campusId: 'campus-03',
    date: '2026-06-02',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-057',
    studentId: 'stu-015',
    teacherId: 'tch-007',
    campusId: 'campus-03',
    date: '2026-06-04',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-058',
    studentId: 'stu-009',
    teacherId: 'tch-007',
    campusId: 'campus-03',
    date: '2026-06-06',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-059',
    studentId: 'stu-018',
    teacherId: 'tch-007',
    campusId: 'campus-03',
    date: '2026-06-08',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-060',
    studentId: 'stu-009',
    teacherId: 'tch-007',
    campusId: 'campus-03',
    date: '2026-06-10',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-061',
    studentId: 'stu-015',
    teacherId: 'tch-007',
    campusId: 'campus-03',
    date: '2026-06-12',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-062',
    studentId: 'stu-009',
    teacherId: 'tch-007',
    campusId: 'campus-03',
    date: '2026-06-14',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-063',
    studentId: 'stu-018',
    teacherId: 'tch-007',
    campusId: 'campus-03',
    date: '2026-06-16',
    hours: 2,
    amount: 240,
  },
  // 城北 - 吴老师
  {
    id: 'lr-064',
    studentId: 'stu-010',
    teacherId: 'tch-008',
    campusId: 'campus-04',
    date: '2026-06-01',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-065',
    studentId: 'stu-014',
    teacherId: 'tch-008',
    campusId: 'campus-04',
    date: '2026-06-03',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-066',
    studentId: 'stu-010',
    teacherId: 'tch-008',
    campusId: 'campus-04',
    date: '2026-06-05',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-067',
    studentId: 'stu-014',
    teacherId: 'tch-008',
    campusId: 'campus-04',
    date: '2026-06-07',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-068',
    studentId: 'stu-010',
    teacherId: 'tch-008',
    campusId: 'campus-04',
    date: '2026-06-09',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-069',
    studentId: 'stu-014',
    teacherId: 'tch-008',
    campusId: 'campus-04',
    date: '2026-06-11',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-070',
    studentId: 'stu-010',
    teacherId: 'tch-008',
    campusId: 'campus-04',
    date: '2026-06-13',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-071',
    studentId: 'stu-014',
    teacherId: 'tch-008',
    campusId: 'campus-04',
    date: '2026-06-15',
    hours: 2,
    amount: 240,
  },
  {
    id: 'lr-072',
    studentId: 'stu-014',
    teacherId: 'tch-008',
    campusId: 'campus-04',
    date: '2026-06-17',
    hours: 2,
    amount: 240,
  },
];

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
