/**
 * 班级开放预约 Mock 数据接口
 *
 * 提供开放预约时段、预约记录、自动开班的 mock 实现。
 * 数据使用 snake_case 与前端类型对齐，写入 SCHEDULES/LESSON_RECORDS 时做字段映射。
 */
import dayjs from 'dayjs';
import { CLASSES, LESSON_RECORDS, SCHEDULES, STUDENTS, TEACHERS } from '@/data/mock-database';
import type { ClassBookingSlot } from '@/types/class';
import type { ClassBookingRecord } from '@/types/class-booking';

function delay(ms = 60): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Mock 数据集
// ============================================

let slotIdCounter = 100;
let recordIdCounter = 100;

function nextSlotId(): string {
  return `cbs-${String(++slotIdCounter).padStart(4, '0')}`;
}

function nextRecordId(): string {
  return `cbr-${String(++recordIdCounter).padStart(4, '0')}`;
}

function nextScheduleId(): string {
  return `sch-open-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function nextLessonRecordId(): string {
  return `lr-open-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

const BASE_DATE = dayjs('2026-06-22');

/** 生成 mock 已预约学员头像列表 */
function buildBookingStudents(count: number): { id: string; name: string; avatar: string }[] {
  const seeds = [
    'Amy',
    'Bob',
    'Cathy',
    'David',
    'Ella',
    'Frank',
    'Gina',
    'Henry',
    'Ivy',
    'Jack',
    'Katie',
    'Leo',
    'Mia',
    'Noah',
    'Olivia',
    'Peter',
    'Quinn',
    'Rose',
    'Sam',
    'Tina',
  ];
  return Array.from({ length: count }, (_, index) => ({
    id: `open-stu-${String(index + 1).padStart(3, '0')}`,
    name: `学员${index + 1}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${seeds[index % seeds.length]}&size=128`,
  }));
}

export const CLASS_BOOKING_SLOTS: ClassBookingSlot[] = [
  // cls-004 声乐初级班：周一、周五 15:00-16:30，约满开班（min 5 / max 6）
  {
    id: 'cbs-0001',
    class_id: 'cls-004',
    class_name: '声乐初级班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: BASE_DATE.format('YYYY-MM-DD'),
    start_time: '15:00',
    end_time: '16:30',
    max_count: 6,
    current_count: 3,
    status: 'active',
    booking_students: buildBookingStudents(3),
    auto_open_type: 'full',
    room: '声乐教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0002',
    class_id: 'cls-004',
    class_name: '声乐初级班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: BASE_DATE.add(4, 'day').format('YYYY-MM-DD'),
    start_time: '15:00',
    end_time: '16:30',
    max_count: 6,
    current_count: 6,
    status: 'full',
    booking_students: buildBookingStudents(6),
    auto_open_type: 'full',
    room: '声乐教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // cls-005 童声合唱团：周三、周六 09:00-10:30，到时间自动开班
  {
    id: 'cbs-0003',
    class_id: 'cls-005',
    class_name: '童声合唱团',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: BASE_DATE.add(1, 'day').format('YYYY-MM-DD'),
    start_time: '09:00',
    end_time: '10:30',
    max_count: 12,
    current_count: 4,
    status: 'rest',
    booking_students: buildBookingStudents(4),
    auto_open_type: 'time',
    room: '合唱教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0004',
    class_id: 'cls-005',
    class_name: '童声合唱团',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: BASE_DATE.add(4, 'day').format('YYYY-MM-DD'),
    start_time: '09:00',
    end_time: '10:30',
    max_count: 12,
    current_count: 12,
    status: 'full',
    booking_students: buildBookingStudents(12),
    auto_open_type: 'time',
    room: '合唱教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // cls-004 声乐初级班：更多日期时段
  {
    id: 'cbs-0005',
    class_id: 'cls-004',
    class_name: '声乐初级班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: BASE_DATE.add(7, 'day').format('YYYY-MM-DD'),
    start_time: '15:00',
    end_time: '16:30',
    max_count: 6,
    current_count: 2,
    status: 'active',
    booking_students: buildBookingStudents(2),
    auto_open_type: 'full',
    room: '声乐教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0006',
    class_id: 'cls-004',
    class_name: '声乐初级班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: BASE_DATE.add(11, 'day').format('YYYY-MM-DD'),
    start_time: '15:00',
    end_time: '16:30',
    max_count: 6,
    current_count: 0,
    status: 'rest',
    auto_open_type: 'full',
    room: '声乐教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // cls-005 童声合唱团：更多日期时段
  {
    id: 'cbs-0007',
    class_id: 'cls-005',
    class_name: '童声合唱团',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: BASE_DATE.add(2, 'day').format('YYYY-MM-DD'),
    start_time: '09:00',
    end_time: '10:30',
    max_count: 12,
    current_count: 5,
    status: 'active',
    booking_students: buildBookingStudents(5),
    auto_open_type: 'time',
    room: '合唱教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0008',
    class_id: 'cls-005',
    class_name: '童声合唱团',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: BASE_DATE.add(6, 'day').format('YYYY-MM-DD'),
    start_time: '09:00',
    end_time: '10:30',
    max_count: 12,
    current_count: 12,
    status: 'full',
    booking_students: buildBookingStudents(12),
    auto_open_type: 'time',
    room: '合唱教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // cls-011 钢琴启蒙体验班：约满或到时间自动开班
  {
    id: 'cbs-0009',
    class_id: 'cls-011',
    class_name: '钢琴启蒙体验班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-001',
    teacher_name: '张老师',
    lesson_date: BASE_DATE.add(1, 'day').format('YYYY-MM-DD'),
    start_time: '16:00',
    end_time: '17:00',
    max_count: 4,
    current_count: 1,
    status: 'active',
    booking_students: buildBookingStudents(1),
    auto_open_type: 'full_or_time',
    room: '钢琴教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0010',
    class_id: 'cls-011',
    class_name: '钢琴启蒙体验班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-001',
    teacher_name: '张老师',
    lesson_date: BASE_DATE.add(3, 'day').format('YYYY-MM-DD'),
    start_time: '16:00',
    end_time: '17:00',
    max_count: 4,
    current_count: 2,
    status: 'active',
    booking_students: buildBookingStudents(2),
    auto_open_type: 'full_or_time',
    room: '钢琴教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0011',
    class_id: 'cls-011',
    class_name: '钢琴启蒙体验班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-001',
    teacher_name: '张老师',
    lesson_date: BASE_DATE.add(8, 'day').format('YYYY-MM-DD'),
    start_time: '16:00',
    end_time: '17:00',
    max_count: 4,
    current_count: 4,
    status: 'full',
    booking_students: buildBookingStudents(4),
    auto_open_type: 'full_or_time',
    room: '钢琴教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // ============================================
  // 7 月多日数据（覆盖当前运行日期 2026-07-19 及前后）
  // ============================================
  // cls-004 声乐初级班：7 月 20、22、24、27 日
  {
    id: 'cbs-0101',
    class_id: 'cls-004',
    class_name: '声乐初级班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: '2026-07-20',
    start_time: '15:00',
    end_time: '16:30',
    max_count: 6,
    current_count: 3,
    status: 'active',
    booking_students: buildBookingStudents(3),
    auto_open_type: 'full',
    room: '声乐教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0102',
    class_id: 'cls-004',
    class_name: '声乐初级班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: '2026-07-22',
    start_time: '15:00',
    end_time: '16:30',
    max_count: 6,
    current_count: 6,
    status: 'full',
    booking_students: buildBookingStudents(6),
    auto_open_type: 'full',
    room: '声乐教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0103',
    class_id: 'cls-004',
    class_name: '声乐初级班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: '2026-07-24',
    start_time: '15:00',
    end_time: '16:30',
    max_count: 6,
    current_count: 1,
    status: 'active',
    booking_students: buildBookingStudents(1),
    auto_open_type: 'full',
    room: '声乐教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0104',
    class_id: 'cls-004',
    class_name: '声乐初级班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: '2026-07-27',
    start_time: '15:00',
    end_time: '16:30',
    max_count: 6,
    current_count: 0,
    status: 'rest',
    auto_open_type: 'full',
    room: '声乐教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // cls-005 童声合唱团：7 月 19、21、23、26 日
  {
    id: 'cbs-0105',
    class_id: 'cls-005',
    class_name: '童声合唱团',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: '2026-07-19',
    start_time: '09:00',
    end_time: '10:30',
    max_count: 12,
    current_count: 10,
    status: 'active',
    booking_students: buildBookingStudents(10),
    auto_open_type: 'time',
    room: '合唱教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0106',
    class_id: 'cls-005',
    class_name: '童声合唱团',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: '2026-07-21',
    start_time: '09:00',
    end_time: '10:30',
    max_count: 12,
    current_count: 12,
    status: 'full',
    booking_students: buildBookingStudents(12),
    auto_open_type: 'time',
    room: '合唱教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0107',
    class_id: 'cls-005',
    class_name: '童声合唱团',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: '2026-07-23',
    start_time: '09:00',
    end_time: '10:30',
    max_count: 12,
    current_count: 7,
    status: 'active',
    booking_students: buildBookingStudents(7),
    auto_open_type: 'time',
    room: '合唱教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0108',
    class_id: 'cls-005',
    class_name: '童声合唱团',
    campus_id: 'campus-center',
    teacher_id: 'teacher-002',
    teacher_name: '李老师',
    lesson_date: '2026-07-26',
    start_time: '09:00',
    end_time: '10:30',
    max_count: 12,
    current_count: 0,
    status: 'rest',
    auto_open_type: 'time',
    room: '合唱教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // cls-011 钢琴启蒙体验班：7 月 19、22、24、29 日
  {
    id: 'cbs-0109',
    class_id: 'cls-011',
    class_name: '钢琴启蒙体验班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-001',
    teacher_name: '张老师',
    lesson_date: '2026-07-19',
    start_time: '16:00',
    end_time: '17:00',
    max_count: 4,
    current_count: 2,
    status: 'active',
    booking_students: buildBookingStudents(2),
    auto_open_type: 'full_or_time',
    room: '钢琴教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0110',
    class_id: 'cls-011',
    class_name: '钢琴启蒙体验班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-001',
    teacher_name: '张老师',
    lesson_date: '2026-07-22',
    start_time: '16:00',
    end_time: '17:00',
    max_count: 4,
    current_count: 4,
    status: 'full',
    booking_students: buildBookingStudents(4),
    auto_open_type: 'full_or_time',
    room: '钢琴教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0111',
    class_id: 'cls-011',
    class_name: '钢琴启蒙体验班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-001',
    teacher_name: '张老师',
    lesson_date: '2026-07-24',
    start_time: '16:00',
    end_time: '17:00',
    max_count: 4,
    current_count: 1,
    status: 'active',
    booking_students: buildBookingStudents(1),
    auto_open_type: 'full_or_time',
    room: '钢琴教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbs-0112',
    class_id: 'cls-011',
    class_name: '钢琴启蒙体验班',
    campus_id: 'campus-center',
    teacher_id: 'teacher-001',
    teacher_name: '张老师',
    lesson_date: '2026-07-29',
    start_time: '16:00',
    end_time: '17:00',
    max_count: 4,
    current_count: 0,
    status: 'rest',
    auto_open_type: 'full_or_time',
    room: '钢琴教室',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
];

export const CLASS_BOOKING_RECORDS: ClassBookingRecord[] = [
  // cls-004 周五已满时段的 6 条预约记录
  {
    id: 'cbr-0001',
    slot_id: 'cbs-0002',
    class_id: 'cls-004',
    student_id: 'student-001',
    student_name: '张小明',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0002',
    slot_id: 'cbs-0002',
    class_id: 'cls-004',
    student_id: 'student-002',
    student_name: '李小红',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0003',
    slot_id: 'cbs-0002',
    class_id: 'cls-004',
    student_id: 'student-003',
    student_name: '王大力',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0004',
    slot_id: 'cbs-0002',
    class_id: 'cls-004',
    student_id: 'student-004',
    student_name: '赵小芳',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0005',
    slot_id: 'cbs-0002',
    class_id: 'cls-004',
    student_id: 'student-005',
    student_name: '陈小云',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0006',
    slot_id: 'cbs-0002',
    class_id: 'cls-004',
    student_id: 'student-006',
    student_name: '刘小雨',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // cls-005 周六已满时段 12 条预约记录
  {
    id: 'cbr-0007',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-001',
    student_name: '张小明',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0008',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-002',
    student_name: '李小红',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0009',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-003',
    student_name: '王大力',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0010',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-004',
    student_name: '赵小芳',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0011',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-005',
    student_name: '陈小云',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0012',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-006',
    student_name: '刘小雨',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0013',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-007',
    student_name: '周小杰',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0014',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-008',
    student_name: '吴小敏',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0015',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-009',
    student_name: '郑小伟',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0016',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-010',
    student_name: '孙小静',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0017',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-011',
    student_name: '钱小波',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0018',
    slot_id: 'cbs-0008',
    class_id: 'cls-005',
    student_id: 'student-012',
    student_name: '冯小慧',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // cls-011 钢琴启蒙体验班 已满时段 4 条预约记录
  {
    id: 'cbr-0019',
    slot_id: 'cbs-0011',
    class_id: 'cls-011',
    student_id: 'student-013',
    student_name: '朱小文',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0020',
    slot_id: 'cbs-0011',
    class_id: 'cls-011',
    student_id: 'student-014',
    student_name: '唐小宁',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0021',
    slot_id: 'cbs-0011',
    class_id: 'cls-011',
    student_id: 'student-015',
    student_name: '韩小磊',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0022',
    slot_id: 'cbs-0011',
    class_id: 'cls-011',
    student_id: 'student-016',
    student_name: '曹小萌',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // 7 月新增已满时段记录
  // cls-004 7 月 22 日 6 人
  {
    id: 'cbr-0101',
    slot_id: 'cbs-0102',
    class_id: 'cls-004',
    student_id: 'student-001',
    student_name: '张小明',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0102',
    slot_id: 'cbs-0102',
    class_id: 'cls-004',
    student_id: 'student-002',
    student_name: '李小红',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0103',
    slot_id: 'cbs-0102',
    class_id: 'cls-004',
    student_id: 'student-003',
    student_name: '王大力',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0104',
    slot_id: 'cbs-0102',
    class_id: 'cls-004',
    student_id: 'student-004',
    student_name: '赵小芳',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0105',
    slot_id: 'cbs-0102',
    class_id: 'cls-004',
    student_id: 'student-005',
    student_name: '陈小云',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0106',
    slot_id: 'cbs-0102',
    class_id: 'cls-004',
    student_id: 'student-006',
    student_name: '刘小雨',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // cls-005 7 月 21 日 12 人
  {
    id: 'cbr-0107',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-001',
    student_name: '张小明',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0108',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-002',
    student_name: '李小红',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0109',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-003',
    student_name: '王大力',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0110',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-004',
    student_name: '赵小芳',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0111',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-005',
    student_name: '陈小云',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0112',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-006',
    student_name: '刘小雨',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0113',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-007',
    student_name: '周小杰',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0114',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-008',
    student_name: '吴小敏',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0115',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-009',
    student_name: '郑小伟',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0116',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-010',
    student_name: '孙小静',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0117',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-011',
    student_name: '钱小波',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0118',
    slot_id: 'cbs-0106',
    class_id: 'cls-005',
    student_id: 'student-012',
    student_name: '冯小慧',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  // cls-011 7 月 22 日 4 人
  {
    id: 'cbr-0119',
    slot_id: 'cbs-0110',
    class_id: 'cls-011',
    student_id: 'student-013',
    student_name: '朱小文',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0120',
    slot_id: 'cbs-0110',
    class_id: 'cls-011',
    student_id: 'student-014',
    student_name: '唐小宁',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0121',
    slot_id: 'cbs-0110',
    class_id: 'cls-011',
    student_id: 'student-015',
    student_name: '韩小磊',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'cbr-0122',
    slot_id: 'cbs-0110',
    class_id: 'cls-011',
    student_id: 'student-016',
    student_name: '曹小萌',
    status: 'confirmed',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
];

// ============================================
// 工具函数
// ============================================

function getClassInfo(classId: string) {
  const cls = CLASSES.find((item) => item.id === classId);
  if (!cls) return null;
  const teacher = TEACHERS.find((item) => item.id === cls.teacherId);
  return {
    ...cls,
    teacherName: teacher?.name || '未分配老师',
  };
}

function getEffectiveAutoOpenType(
  slot: ClassBookingSlot,
  cls: ReturnType<typeof getClassInfo>,
): NonNullable<ClassBookingSlot['auto_open_type']> {
  return slot.auto_open_type || cls?.autoOpenType || 'manual';
}

function getEffectiveMinOpenCount(
  slot: ClassBookingSlot,
  cls: ReturnType<typeof getClassInfo>,
): number {
  if (slot.max_count > 0) {
    return cls?.minOpenCount ?? slot.max_count;
  }
  return cls?.minOpenCount ?? 1;
}

function shouldAutoOpen(
  slot: ClassBookingSlot,
  cls: ReturnType<typeof getClassInfo>,
  now: dayjs.Dayjs,
): boolean {
  if (slot.status !== 'active' && slot.status !== 'full') return false;
  if (slot.opened_schedule_id) return false;

  const type = getEffectiveAutoOpenType(slot, cls);
  if (type === 'manual') return false;

  const dateStr = slot.lesson_date;
  const slotStart = dayjs(`${dateStr} ${slot.start_time}`);

  const fullMatch =
    (type === 'full' || type === 'full_or_time') &&
    slot.current_count >= getEffectiveMinOpenCount(slot, cls);
  const timeMatch =
    (type === 'time' || type === 'full_or_time') && now.valueOf() >= slotStart.valueOf();

  return fullMatch || timeMatch;
}

function createScheduleFromSlot(
  slot: ClassBookingSlot,
  cls: ReturnType<typeof getClassInfo>,
): string {
  const scheduleId = nextScheduleId();
  const lessonDate = dayjs(slot.lesson_date);
  const dayOfWeek = ((lessonDate.day() + 6) % 7) + 1;

  SCHEDULES.unshift({
    id: scheduleId,
    classId: slot.class_id,
    teacherId: slot.teacher_id || cls?.teacherId || '',
    campusId: slot.campus_id || cls?.campusId || '',
    dayOfWeek: dayOfWeek as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    startTime: slot.start_time,
    endTime: slot.end_time,
    room: slot.room || cls?.schedule || '',
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  });

  return scheduleId;
}

function createLessonRecordsFromSlot(slot: ClassBookingSlot, _scheduleId: string): void {
  const confirmedRecords = CLASS_BOOKING_RECORDS.filter(
    (record) => record.slot_id === slot.id && record.status === 'confirmed',
  );

  if (confirmedRecords.length === 0) {
    // 无预约记录时生成占位记录，保证排课页卡片可见
    LESSON_RECORDS.unshift({
      id: nextLessonRecordId(),
      studentId: '',
      classId: slot.class_id,
      teacherId: slot.teacher_id,
      campusId: slot.campus_id,
      date: slot.lesson_date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      hours: 0,
      status: 'checked',
      note: '到时间自动开班占位记录',
      createdAt: new Date().toISOString(),
    });
    return;
  }

  confirmedRecords.forEach((record) => {
    const student = STUDENTS.find((item) => item.id === record.student_id);
    LESSON_RECORDS.unshift({
      id: nextLessonRecordId(),
      studentId: record.student_id,
      classId: slot.class_id,
      teacherId: slot.teacher_id,
      campusId: slot.campus_id,
      date: slot.lesson_date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      hours: 0,
      status: 'checked',
      note: `约满开班：${record.student_name || student?.name || '学员'}`,
      createdAt: new Date().toISOString(),
    });
  });
}

// ============================================
// Mock 数据接口
// ============================================

export async function mockGetSlotsByClass(
  classId: string,
  lessonDate: string,
): Promise<ClassBookingSlot[]> {
  await delay();
  return CLASS_BOOKING_SLOTS.filter(
    (slot) => slot.class_id === classId && slot.lesson_date === lessonDate,
  );
}

/** 获取指定班级集合存在开放预约时段的日期列表 */
export async function mockGetOpenSlotDates(classIds: string[]): Promise<string[]> {
  await delay();
  const dateSet = new Set<string>();
  CLASS_BOOKING_SLOTS.filter((slot) => classIds.includes(slot.class_id)).forEach((slot) => {
    dateSet.add(slot.lesson_date);
  });
  return Array.from(dateSet).sort();
}

export async function mockSaveClassDaySlots(
  classId: string,
  lessonDate: string,
  slots: Omit<ClassBookingSlot, 'id'>[],
): Promise<ClassBookingSlot[]> {
  await delay();

  // 删除该班该日已有 slots
  const keptSlots = CLASS_BOOKING_SLOTS.filter(
    (slot) => !(slot.class_id === classId && slot.lesson_date === lessonDate),
  );

  const savedSlots: ClassBookingSlot[] = slots.map((slot) => ({
    ...slot,
    id: nextSlotId(),
    class_id: classId,
    lesson_date: lessonDate,
    created_at: slot.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  CLASS_BOOKING_SLOTS.length = 0;
  CLASS_BOOKING_SLOTS.push(...keptSlots, ...savedSlots);

  return savedSlots;
}

export async function mockDeleteSlot(id: string): Promise<void> {
  await delay();
  const index = CLASS_BOOKING_SLOTS.findIndex((slot) => slot.id === id);
  if (index >= 0) {
    CLASS_BOOKING_SLOTS.splice(index, 1);
  }
}

export async function mockGetSlotById(id: string): Promise<ClassBookingSlot | null> {
  await delay();
  return CLASS_BOOKING_SLOTS.find((slot) => slot.id === id) || null;
}

export async function mockUpdateSlot(
  id: string,
  payload: Partial<
    Pick<
      ClassBookingSlot,
      'teacher_id' | 'room' | 'lesson_date' | 'start_time' | 'end_time' | 'max_count'
    >
  >,
): Promise<ClassBookingSlot> {
  await delay();
  const slot = CLASS_BOOKING_SLOTS.find((item) => item.id === id);
  if (!slot) {
    throw new Error('时段不存在');
  }

  if (payload.teacher_id !== undefined) {
    slot.teacher_id = payload.teacher_id;
    const teacher = TEACHERS.find((item) => item.id === payload.teacher_id);
    slot.teacher_name = teacher?.name || slot.teacher_name;
  }
  if (payload.room !== undefined) slot.room = payload.room;
  if (payload.lesson_date !== undefined) slot.lesson_date = payload.lesson_date;
  if (payload.start_time !== undefined) slot.start_time = payload.start_time;
  if (payload.end_time !== undefined) slot.end_time = payload.end_time;
  if (payload.max_count !== undefined) slot.max_count = payload.max_count;

  slot.updated_at = new Date().toISOString();
  return slot;
}

export async function mockGetRecordsBySlot(slotId: string): Promise<ClassBookingRecord[]> {
  await delay();
  return CLASS_BOOKING_RECORDS.filter((record) => record.slot_id === slotId);
}

export async function mockAddBookingRecord(
  slotId: string,
  studentId: string,
): Promise<ClassBookingRecord> {
  await delay();
  const slot = CLASS_BOOKING_SLOTS.find((item) => item.id === slotId);
  if (!slot) {
    throw new Error('Slot not found');
  }

  const student = STUDENTS.find((item) => item.id === studentId);
  const record: ClassBookingRecord = {
    id: nextRecordId(),
    slot_id: slotId,
    class_id: slot.class_id,
    student_id: studentId,
    student_name: student?.name || '未知学员',
    status: 'confirmed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  CLASS_BOOKING_RECORDS.unshift(record);
  slot.current_count += 1;
  if (slot.current_count >= slot.max_count) {
    slot.status = 'full';
  }
  slot.updated_at = new Date().toISOString();

  return record;
}

export async function mockRemoveBookingRecord(recordId: string): Promise<void> {
  await delay();
  const index = CLASS_BOOKING_RECORDS.findIndex((record) => record.id === recordId);
  if (index < 0) return;

  const record = CLASS_BOOKING_RECORDS[index];
  const slot = CLASS_BOOKING_SLOTS.find((item) => item.id === record.slot_id);

  CLASS_BOOKING_RECORDS.splice(index, 1);

  if (slot && record.status === 'confirmed') {
    slot.current_count = Math.max(0, slot.current_count - 1);
    if (slot.status === 'full' && slot.current_count < slot.max_count) {
      slot.status = 'active';
    }
    slot.updated_at = new Date().toISOString();
  }
}

/** 检查并自动开班，返回已开班的 scheduleId 列表 */
export async function mockAutoOpenSlotsIfNeeded(
  classId: string,
  lessonDate: string,
): Promise<string[]> {
  await delay();
  const cls = getClassInfo(classId);
  if (!cls || cls.scheduleMode !== 'open') return [];

  const now = dayjs();
  const slots = CLASS_BOOKING_SLOTS.filter(
    (slot) => slot.class_id === classId && slot.lesson_date === lessonDate,
  );

  const openedIds: string[] = [];

  slots.forEach((slot) => {
    if (shouldAutoOpen(slot, cls, now)) {
      const scheduleId = createScheduleFromSlot(slot, cls);
      createLessonRecordsFromSlot(slot, scheduleId);
      slot.opened_schedule_id = scheduleId;
      slot.updated_at = new Date().toISOString();
      openedIds.push(scheduleId);
    }
  });

  return openedIds;
}

/** 更新时段状态（active/rest/full） */
export async function mockUpdateSlotStatus(
  slotId: string,
  status: 'active' | 'rest' | 'full',
): Promise<void> {
  await delay();
  const slot = CLASS_BOOKING_SLOTS.find((s) => s.id === slotId);
  if (!slot) {
    throw new Error('时段不存在');
  }
  slot.status = status;
  slot.updated_at = new Date().toISOString();
}
