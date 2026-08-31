/**
 * 教师端「教学台账」数据服务
 * mock 仅开发；生产接消课 by-month，工资取本人薪资流水（无则空态）
 */
import dayjs from 'dayjs';
import { lessonRecordService } from '@/services';
import { teacherService } from '@/services/teacher';
import type { LessonRecord } from '@/types/lesson-record';
import type { PayHistoryRecord } from '@/types/teacher';

import { logError } from '@/utils/logger';

export type TeacherMonthlyFlowTab =
  | 'attendance'
  | 'lessons'
  | 'salary'
  | 'bookings'
  | 'reviews';

export type TeacherSalaryStatus = 'draft' | 'paid';

export interface TeacherMonthlyFlowSummary {
  month: string;
  /** @deprecated 考勤下版再做，保留字段兼容旧调用 */
  attendanceCount: number;
  lessonHours: number;
  /** 兼容旧字段：等同 payableAmount */
  salaryAmount: number;
  /** 应发（明细合计） */
  payableAmount: number;
  /** 实发（已发放时等于应发，未发为 0） */
  paidAmount: number;
  salaryStatus: TeacherSalaryStatus;
  bookingCount: number;
  reviewCount: number;
}

export interface TeacherAttendanceItem {
  id: string;
  date: string;
  className: string;
  campusName: string;
  status: 'present' | 'late' | 'absent' | 'leave';
  timeRange: string;
}

export interface TeacherLessonItem {
  id: string;
  date: string;
  courseName: string;
  studentCount: number;
  hours: number;
  consumeAmount?: number;
}

export interface TeacherSalaryItem {
  id: string;
  title: string;
  /** 绝对值；扣款用 type=deduct 或 direction=deduct */
  amount: number;
  type: 'base' | 'lesson' | 'commission' | 'bonus' | 'deduct';
  direction?: 'earn' | 'deduct';
  date: string;
  remark?: string;
}

export interface TeacherBookingItem {
  id: string;
  date: string;
  timeRange: string;
  studentName: string;
  courseName: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

export interface TeacherReviewItem {
  id: string;
  date: string;
  studentName: string;
  courseName: string;
  rating: number;
  content: string;
}

export interface TeacherMonthlyFlowBundle {
  summary: TeacherMonthlyFlowSummary;
  attendance: TeacherAttendanceItem[];
  lessons: TeacherLessonItem[];
  salary: TeacherSalaryItem[];
  bookings: TeacherBookingItem[];
  reviews: TeacherReviewItem[];
}

const ATTENDANCE_STATUS_LABEL: Record<TeacherAttendanceItem['status'], string> = {
  present: '正常',
  late: '迟到',
  absent: '缺勤',
  leave: '请假',
};

const SALARY_TYPE_LABEL: Record<TeacherSalaryItem['type'], string> = {
  base: '底薪',
  lesson: '课时费',
  commission: '提成',
  bonus: '奖励',
  deduct: '扣款',
};

const BOOKING_STATUS_LABEL: Record<TeacherBookingItem['status'], string> = {
  upcoming: '待上课',
  completed: '已完成',
  cancelled: '已取消',
};

export { ATTENDANCE_STATUS_LABEL, SALARY_TYPE_LABEL, BOOKING_STATUS_LABEL };

function salaryLineSigned(item: TeacherSalaryItem): number {
  const isDeduct = item.direction === 'deduct' || item.type === 'deduct';
  const abs = Math.abs(item.amount);
  return isDeduct ? -abs : abs;
}

function emptyBundle(month: string): TeacherMonthlyFlowBundle {
  return {
    summary: {
      month,
      attendanceCount: 0,
      lessonHours: 0,
      salaryAmount: 0,
      payableAmount: 0,
      paidAmount: 0,
      salaryStatus: 'draft',
      bookingCount: 0,
      reviewCount: 0,
    },
    attendance: [],
    lessons: [],
    salary: [],
    bookings: [],
    reviews: [],
  };
}

function buildMockBundle(month: string): TeacherMonthlyFlowBundle {
  const base = dayjs(`${month}-01`);
  const d = (day: number) => base.date(day).format('MM-DD');
  const currentMonth = dayjs().format('YYYY-MM');
  const salaryStatus: TeacherSalaryStatus =
    month === currentMonth || month === dayjs().subtract(1, 'month').format('YYYY-MM')
      ? 'paid'
      : 'draft';

  const lessons: TeacherLessonItem[] = [
    {
      id: 'les-1',
      date: d(3),
      courseName: '少儿体能',
      studentCount: 8,
      hours: 2,
      consumeAmount: 320,
    },
    {
      id: 'les-2',
      date: d(5),
      courseName: '游泳启蒙',
      studentCount: 6,
      hours: 1.5,
      consumeAmount: 240,
    },
  ];

  const salary: TeacherSalaryItem[] = [
    { id: 'sal-1', title: '基本工资', amount: 4000, type: 'base', direction: 'earn', date: d(1) },
    {
      id: 'sal-2',
      title: '课时费结算',
      amount: 1860,
      type: 'lesson',
      direction: 'earn',
      date: d(28),
      remark: '本月课时 3.5 节',
    },
  ];

  const lessonHours = lessons.reduce((sum, item) => sum + item.hours, 0);
  const payableAmount = salary.reduce((sum, item) => sum + salaryLineSigned(item), 0);
  const paidAmount = salaryStatus === 'paid' ? payableAmount : 0;

  return {
    summary: {
      month,
      attendanceCount: 0,
      lessonHours,
      salaryAmount: payableAmount,
      payableAmount,
      paidAmount,
      salaryStatus,
      bookingCount: 0,
      reviewCount: 0,
    },
    attendance: [],
    lessons,
    salary,
    bookings: [],
    reviews: [],
  };
}

function mapLessonRecords(records: LessonRecord[]): TeacherLessonItem[] {
  const groups = new Map<string, TeacherLessonItem>();

  for (const record of records) {
    if (record.status === 'cancelled') continue;
    const date = record.lesson_date?.slice(0, 10) || '';
    const courseName = record.class_name || record.course_package?.name || '消课';
    const key = `${date}|${courseName}|${record.class_id || ''}`;
    const hours = Number(record.hours_used) || 0;
    const existing = groups.get(key);
    if (existing) {
      existing.studentCount += 1;
      existing.hours += hours;
      if (record.fee_amount) {
        existing.consumeAmount = (existing.consumeAmount || 0) + Number(record.fee_amount);
      }
    } else {
      groups.set(key, {
        id: record.id,
        date: date.slice(5) || date,
        courseName,
        studentCount: 1,
        hours,
        consumeAmount: record.fee_amount ? Number(record.fee_amount) : undefined,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
}

async function buildLiveBundle(month: string, teacherId: string): Promise<TeacherMonthlyFlowBundle> {
  const bundle = emptyBundle(month);
  if (!teacherId) return bundle;

  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  if (!year || !monthNum) return bundle;

  try {
    const records = await lessonRecordService.getByTeacherAndMonth(teacherId, year, monthNum);
    bundle.lessons = mapLessonRecords(records);
    bundle.summary.lessonHours = bundle.lessons.reduce((sum, item) => sum + item.hours, 0);
  } catch (error) {
    logError('teacherMonthlyFlow.lessons', error);
  }

  try {
    const teacher = await teacherService.getById(teacherId);
    const payHistory = teacher?.payHistory as PayHistoryRecord[] | undefined;
    if (Array.isArray(payHistory)) {
      const monthRows = payHistory.filter((row) => String(row.month ?? '').slice(0, 7) === month);
      bundle.salary = monthRows.map((row, index) => {
        const amount = Math.abs(Number(row.amount ?? 0));
        const status = String(row.status ?? 'pending');
        return {
          id: `salary-${month}-${index}`,
          title: String(row.remark || '本月工资'),
          amount,
          type: 'base' as const,
          direction: 'earn' as const,
          date: String(row.paidAt || `${month}-01`).slice(5, 10),
          remark: status === 'paid' ? '已发放' : status === 'confirmed' ? '已确认' : '待确认',
        };
      });
      const payableAmount = bundle.salary.reduce((sum, item) => sum + salaryLineSigned(item), 0);
      const paid = monthRows.some((row) => row.status === 'paid');
      bundle.summary.payableAmount = payableAmount;
      bundle.summary.salaryAmount = payableAmount;
      bundle.summary.salaryStatus = paid ? 'paid' : 'draft';
      bundle.summary.paidAmount = paid ? payableAmount : 0;
    }
  } catch (error) {
    logError('teacherMonthlyFlow.salary', error);
  }

  return bundle;
}

export const teacherMonthlyFlowService = {
  /** 获取指定月份的月流水聚合数据 */
  getMonthlyFlow: async (month: string, teacherId?: string): Promise<TeacherMonthlyFlowBundle> => {
        if (!teacherId) return emptyBundle(month);
    return buildLiveBundle(month, teacherId);
  },
};

export { salaryLineSigned };
