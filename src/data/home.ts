/**
 * 首页 Mock 数据接口
 * 模拟教师首页所需的全部数据
 */
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { Student } from '@/types/student';
import type { Teacher } from '@/types/teacher';

function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Mock 数据
// ============================================
const MOCK_TEACHER: Teacher = {
  id: 'teacher-001',
  user_id: 'teacher-001',
  invite_code: 'TC0001',
  profile: {
    id: 'teacher-001',
    name: '张老师',
    role: 'teacher',
    avatar_url: '',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const MOCK_STUDENTS: Student[] = [
  {
    id: 's1',
    name: '王小明',
    teacher_id: 'teacher-001',
    invite_code: 'ST001',
    avatar_url: '',
    gender: 'male',
    created_at: '',
    updated_at: '',
  },
  {
    id: 's2',
    name: '赵小红',
    teacher_id: 'teacher-001',
    invite_code: 'ST002',
    avatar_url: '',
    gender: 'female',
    created_at: '',
    updated_at: '',
  },
  {
    id: 's3',
    name: '李子轩',
    teacher_id: 'teacher-001',
    invite_code: 'ST003',
    avatar_url: '',
    gender: 'male',
    created_at: '',
    updated_at: '',
  },
  {
    id: 's4',
    name: '陈雨萱',
    teacher_id: 'teacher-001',
    invite_code: 'ST004',
    avatar_url: '',
    gender: 'female',
    created_at: '',
    updated_at: '',
  },
  {
    id: 's5',
    name: '刘浩然',
    teacher_id: 'teacher-001',
    invite_code: 'ST005',
    avatar_url: '',
    gender: 'male',
    created_at: '',
    updated_at: '',
  },
  {
    id: 's6',
    name: '杨思琪',
    teacher_id: 'teacher-001',
    invite_code: 'ST006',
    avatar_url: '',
    gender: 'female',
    created_at: '',
    updated_at: '',
  },
];

const MOCK_PACKAGES: CoursePackage[] = [
  {
    id: 'pkg1',
    teacher_id: 'teacher-001',
    student_id: 's1',
    name: '钢琴课',
    total_hours: 40,
    remaining_hours: 28,
    status: 'active',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'pkg2',
    teacher_id: 'teacher-001',
    student_id: 's2',
    name: '声乐课',
    total_hours: 20,
    remaining_hours: 12,
    status: 'active',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'pkg3',
    teacher_id: 'teacher-001',
    student_id: 's3',
    name: '钢琴课',
    total_hours: 30,
    remaining_hours: 18,
    status: 'active',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'pkg4',
    teacher_id: 'teacher-001',
    student_id: 's4',
    name: '乐理课',
    total_hours: 16,
    remaining_hours: 10,
    status: 'active',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'pkg5',
    teacher_id: 'teacher-001',
    student_id: 's5',
    name: '钢琴课',
    total_hours: 48,
    remaining_hours: 35,
    status: 'active',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'pkg6',
    teacher_id: 'teacher-001',
    student_id: 's6',
    name: '声乐课',
    total_hours: 24,
    remaining_hours: 16,
    status: 'active',
    created_at: '',
    updated_at: '',
  },
];

const today = new Date();
const dayOfWeek = today.getDay() || 7; // 1=周一, 7=周日

const MOCK_SCHEDULES: Schedule[] = [
  {
    id: 'sch1',
    teacher_id: 'teacher-001',
    student_id: 's1',
    day_of_week: dayOfWeek as any,
    start_time: '09:00',
    end_time: '10:00',
    color: 'primary',
    note: '钢琴课',
    created_at: '',
    updated_at: '',
    student: { name: '王小明' },
  },
  {
    id: 'sch2',
    teacher_id: 'teacher-001',
    student_id: 's2',
    day_of_week: dayOfWeek as any,
    start_time: '10:30',
    end_time: '11:30',
    color: 'accent',
    note: '声乐课',
    created_at: '',
    updated_at: '',
    student: { name: '赵小红' },
  },
  {
    id: 'sch3',
    teacher_id: 'teacher-001',
    student_id: 's3',
    day_of_week: dayOfWeek as any,
    start_time: '14:00',
    end_time: '15:00',
    color: 'info',
    note: '钢琴课',
    created_at: '',
    updated_at: '',
    student: { name: '李子轩' },
  },
  {
    id: 'sch4',
    teacher_id: 'teacher-001',
    student_id: 's4',
    day_of_week: dayOfWeek as any,
    start_time: '16:00',
    end_time: '17:00',
    color: 'lavender',
    note: '乐理课',
    created_at: '',
    updated_at: '',
    student: { name: '陈雨萱' },
  },
  {
    id: 'sch5',
    teacher_id: 'teacher-001',
    student_id: 's5',
    day_of_week: ((dayOfWeek % 7) + 1) as any,
    start_time: '09:00',
    end_time: '10:00',
    color: 'primary',
    note: '钢琴课',
    created_at: '',
    updated_at: '',
    student: { name: '刘浩然' },
  },
];

const MOCK_RECORDS: LessonRecord[] = [
  {
    id: 'r1',
    teacher_id: 'teacher-001',
    student_id: 's1',
    package_id: 'pkg1',
    lesson_date: '2025-06-06',
    hours_used: 1,
    content: '练习曲目：致爱丽丝',
    performance: '良好',
    homework: '继续练习右手部分',
    created_at: '',
    updated_at: '',
    course_package: { name: '钢琴课' },
    student: { name: '王小明' },
  },
  {
    id: 'r2',
    teacher_id: 'teacher-001',
    student_id: 's2',
    package_id: 'pkg2',
    lesson_date: '2025-06-06',
    hours_used: 1,
    content: '发声练习',
    performance: '进步明显',
    homework: '练习音阶',
    created_at: '',
    updated_at: '',
    course_package: { name: '声乐课' },
    student: { name: '赵小红' },
  },
  {
    id: 'r3',
    teacher_id: 'teacher-001',
    student_id: 's3',
    package_id: 'pkg3',
    lesson_date: '2025-06-05',
    hours_used: 1,
    content: '哈农练习',
    performance: '需加强',
    homework: '每天练习30分钟',
    created_at: '',
    updated_at: '',
    course_package: { name: '钢琴课' },
    student: { name: '李子轩' },
  },
  {
    id: 'r4',
    teacher_id: 'teacher-001',
    student_id: 's4',
    package_id: 'pkg4',
    lesson_date: '2025-06-05',
    hours_used: 1,
    content: '和弦理论',
    performance: '理解良好',
    homework: '完成练习题',
    created_at: '',
    updated_at: '',
    course_package: { name: '乐理课' },
    student: { name: '陈雨萱' },
  },
  {
    id: 'r5',
    teacher_id: 'teacher-001',
    student_id: 's5',
    package_id: 'pkg5',
    lesson_date: '2025-06-04',
    hours_used: 2,
    content: '车尔尼599',
    performance: '优秀',
    homework: '练习第12-15条',
    created_at: '',
    updated_at: '',
    course_package: { name: '钢琴课' },
    student: { name: '刘浩然' },
  },
];

// ============================================
// Mock API
// ============================================

/** 获取教师信息 */
export async function mockGetTeacher(userId: string): Promise<Teacher | null> {
  await delay(200);
  return MOCK_TEACHER.user_id === userId ? MOCK_TEACHER : null;
}

/** 获取教师的学生列表 */
export async function mockGetStudents(teacherId: string, limit?: number): Promise<Student[]> {
  await delay(300);
  const list = MOCK_STUDENTS.filter((s) => s.teacher_id === teacherId);
  return limit ? list.slice(0, limit) : list;
}

/** 获取今日排课 */
export async function mockGetTodaySchedules(teacherId: string): Promise<Schedule[]> {
  await delay(300);
  return MOCK_SCHEDULES.filter((s) => s.teacher_id === teacherId && s.day_of_week === dayOfWeek);
}

/** 获取最近消课记录 */
export async function mockGetRecentRecords(
  teacherId: string,
  limit: number = 5,
): Promise<LessonRecord[]> {
  await delay(300);
  return MOCK_RECORDS.filter((r) => r.teacher_id === teacherId).slice(0, limit);
}

/** 获取学生的课时套餐 */
export async function mockGetStudentPackages(studentId: string): Promise<CoursePackage[]> {
  await delay(200);
  return MOCK_PACKAGES.filter((p) => p.student_id === studentId);
}

/** 获取教师所有学生的剩余课时总数 */
export async function mockGetTotalRemainingHours(teacherId: string): Promise<number> {
  await delay(100);
  return MOCK_PACKAGES.filter((p) => p.teacher_id === teacherId).reduce(
    (sum, p) => sum + (p.remaining_hours || 0),
    0,
  );
}

/** 获取未读通知数 */
export async function mockGetUnreadCount(_userId: string): Promise<number> {
  await delay(100);
  return 3;
}

/** 获取今日已消课数 */
export async function mockGetTodayRecordCount(teacherId: string): Promise<number> {
  await delay(100);
  const todayStr = new Date().toISOString().split('T')[0];
  return MOCK_RECORDS.filter((r) => r.teacher_id === teacherId && r.lesson_date === todayStr)
    .length;
}

// ============================================
// 家长端 Mock 数据
// ============================================

/** 家长绑定的学生列表 */
const PARENT_STUDENTS: Student[] = [
  MOCK_STUDENTS[0], // 王小明
  MOCK_STUDENTS[1], // 赵小红
];

/** 获取家长绑定的学生列表 */
export async function mockGetStudentsByParent(_parentId: string): Promise<Student[]> {
  await delay(300);
  // 模拟：家长绑定了2个孩子
  return PARENT_STUDENTS;
}

/** 获取学生的排课 */
export async function mockGetSchedulesByStudent(studentId: string): Promise<Schedule[]> {
  await delay(300);
  return MOCK_SCHEDULES.filter((s) => s.student_id === studentId);
}

/** 获取学生的消课记录 */
export async function mockGetRecordsByStudent(
  studentId: string,
  limit: number = 10,
): Promise<LessonRecord[]> {
  await delay(300);
  return MOCK_RECORDS.filter((r) => r.student_id === studentId).slice(0, limit);
}

/** 获取学生的课时套餐列表 */
export async function mockGetPackagesByStudent(studentId: string): Promise<CoursePackage[]> {
  await delay(200);
  return MOCK_PACKAGES.filter((p) => p.student_id === studentId);
}
