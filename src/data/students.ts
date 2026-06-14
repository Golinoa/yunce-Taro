/**
 * 学生管理 Mock 数据接口
 * 模拟学生列表、详情、表单所需的全部数据
 */
import type { Class, ClassStudent } from '@/types/class';
import type { CoursePackage, CoursePackageTemplate } from '@/types/course-package';
import type { LeaveRequest } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import type { Notification } from '@/types/notification';
import type { Schedule } from '@/types/schedule';
import type { Student, StudentParent } from '@/types/student';
import type { Subject } from '@/types/subject';

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Mock 数据
// ============================================

// 科目数据
const MOCK_SUBJECTS: Subject[] = [
  { id: 'sub1', name: '钢琴', icon: '🎹', color: '#5EC8A8' },
  { id: 'sub2', name: '声乐', icon: '🎵', color: '#9b7ed8' },
  { id: 'sub3', name: '乐理', icon: '📖', color: '#6BA3D6' },
  { id: 'sub4', name: '舞蹈', icon: '💃', color: '#E89BB8' },
  { id: 'sub5', name: '书法', icon: '✏️', color: '#D4A24E' },
];

const MOCK_STUDENTS: Student[] = [
  {
    id: 's1',
    name: '王小明',
    teacher_id: 'teacher-001',
    invite_code: 'ST001',
    avatar_url: '',
    nickname: '小明',
    gender: 'male',
    birthday: '2015-03-12',
    phone: '13800001111',
    address: '朝阳区建国路88号',
    note: '钢琴兴趣班学员',
    fee_amount: 200,
    fee_method: 'wechat',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    course_packages: [
      {
        id: 'pkg1',
        name: '钢琴课',
        total_hours: 40,
        remaining_hours: 28,
        fee_amount: 200,
        fee_method: 'wechat',
        created_at: '2025-01-15T10:00:00Z',
      },
    ],
  },
  {
    id: 's2',
    name: '赵小红',
    teacher_id: 'teacher-001',
    invite_code: 'ST002',
    avatar_url: '',
    nickname: '小红',
    gender: 'female',
    birthday: '2016-07-22',
    phone: '13800002222',
    address: '海淀区中关村大街1号',
    note: '',
    fee_amount: 180,
    fee_method: 'cash',
    created_at: '2025-02-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    course_packages: [
      {
        id: 'pkg2',
        name: '声乐课',
        total_hours: 20,
        remaining_hours: 12,
        fee_amount: 180,
        fee_method: 'cash',
        created_at: '2025-02-01T10:00:00Z',
      },
    ],
  },
  {
    id: 's3',
    name: '李子轩',
    teacher_id: 'teacher-001',
    invite_code: 'ST003',
    avatar_url: '',
    nickname: '轩轩',
    gender: 'male',
    birthday: '2014-11-05',
    phone: '13800003333',
    note: '准备考级',
    fee_amount: 250,
    fee_method: 'transfer',
    created_at: '2025-02-15T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    course_packages: [
      {
        id: 'pkg3',
        name: '钢琴课',
        total_hours: 30,
        remaining_hours: 18,
        fee_amount: 250,
        fee_method: 'transfer',
        created_at: '2025-02-15T10:00:00Z',
      },
    ],
  },
  {
    id: 's4',
    name: '陈雨萱',
    teacher_id: 'teacher-001',
    invite_code: 'ST004',
    avatar_url: '',
    gender: 'female',
    birthday: '2017-01-18',
    phone: '13800004444',
    address: '西城区金融街10号',
    fee_amount: 150,
    fee_method: 'wechat',
    created_at: '2025-03-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    course_packages: [
      {
        id: 'pkg4',
        name: '乐理课',
        total_hours: 16,
        remaining_hours: 10,
        fee_amount: 150,
        fee_method: 'wechat',
        created_at: '2025-03-01T10:00:00Z',
      },
    ],
  },
  {
    id: 's5',
    name: '刘浩然',
    teacher_id: 'teacher-001',
    invite_code: 'ST005',
    avatar_url: '',
    nickname: '然然',
    gender: 'male',
    birthday: '2015-09-30',
    phone: '13800005555',
    note: '进度较快',
    fee_amount: 220,
    fee_method: 'alipay',
    created_at: '2025-03-15T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    course_packages: [
      {
        id: 'pkg5',
        name: '钢琴课',
        total_hours: 48,
        remaining_hours: 35,
        fee_amount: 220,
        fee_method: 'alipay',
        created_at: '2025-03-15T10:00:00Z',
      },
    ],
  },
  {
    id: 's6',
    name: '杨思琪',
    teacher_id: 'teacher-001',
    invite_code: 'ST006',
    avatar_url: '',
    gender: 'female',
    birthday: '2016-05-14',
    phone: '13800006666',
    address: '东城区东直门内大街',
    fee_amount: 180,
    fee_method: 'cash',
    created_at: '2025-04-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    course_packages: [
      {
        id: 'pkg6',
        name: '声乐课',
        total_hours: 24,
        remaining_hours: 16,
        fee_amount: 180,
        fee_method: 'cash',
        created_at: '2025-04-01T10:00:00Z',
      },
    ],
  },
];

const MOCK_PARENTS: StudentParent[] = [
  {
    id: 'sp1',
    student_id: 's1',
    parent_id: 'parent-001',
    parent: { id: 'parent-001', name: '王大明', phone: '13900001111' },
    created_at: '2025-01-20T10:00:00Z',
  },
  {
    id: 'sp2',
    student_id: 's2',
    parent_id: 'parent-001',
    parent: { id: 'parent-001', name: '王大明', phone: '13900001111' },
    created_at: '2025-02-05T10:00:00Z',
  },
  {
    id: 'sp3',
    student_id: 's3',
    parent_id: 'parent-002',
    parent: { id: 'parent-002', name: '李建国', phone: '13900002222' },
    created_at: '2025-02-20T10:00:00Z',
  },
  {
    id: 'sp4',
    student_id: 's4',
    parent_id: 'parent-003',
    parent: { id: 'parent-003', name: '陈志强', phone: '13900003333' },
    created_at: '2025-03-05T10:00:00Z',
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
    subject_id: 'sub1',
    package_role: 'owner',
    package_tag: 'hour',
    fee_amount: 200,
    fee_method: 'wechat',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pkg1b',
    teacher_id: 'teacher-001',
    student_id: 's1',
    name: '家庭共享课包',
    total_hours: 60,
    remaining_hours: 42,
    status: 'active',
    subject_id: undefined,
    package_role: 'sharer',
    package_tag: 'hour',
    fee_amount: 300,
    fee_method: 'wechat',
    created_at: '2025-02-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pkg1c',
    teacher_id: 'teacher-001',
    student_id: 's1',
    name: '赠送课时',
    total_hours: 4,
    remaining_hours: 3,
    status: 'active',
    subject_id: undefined,
    package_role: 'owner',
    package_tag: 'gift',
    fee_amount: 0,
    fee_method: 'other',
    created_at: '2025-03-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pkg2',
    teacher_id: 'teacher-001',
    student_id: 's2',
    name: '声乐课',
    total_hours: 20,
    remaining_hours: 12,
    status: 'active',
    subject_id: 'sub2',
    package_role: 'owner',
    package_tag: 'hour',
    fee_amount: 180,
    fee_method: 'cash',
    created_at: '2025-02-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pkg2b',
    teacher_id: 'teacher-001',
    student_id: 's2',
    name: '通用课包',
    total_hours: 30,
    remaining_hours: 20,
    status: 'active',
    subject_id: undefined,
    package_role: 'owner',
    package_tag: 'hour',
    fee_amount: 150,
    fee_method: 'cash',
    created_at: '2025-03-15T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pkg3',
    teacher_id: 'teacher-001',
    student_id: 's3',
    name: '钢琴课',
    total_hours: 30,
    remaining_hours: 18,
    status: 'active',
    subject_id: 'sub1',
    package_role: 'owner',
    package_tag: 'hour',
    fee_amount: 250,
    fee_method: 'transfer',
    created_at: '2025-02-15T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pkg4',
    teacher_id: 'teacher-001',
    student_id: 's4',
    name: '乐理课',
    total_hours: 16,
    remaining_hours: 10,
    status: 'active',
    subject_id: 'sub3',
    package_role: 'owner',
    package_tag: 'hour',
    fee_amount: 150,
    fee_method: 'wechat',
    created_at: '2025-03-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pkg4b',
    teacher_id: 'teacher-001',
    student_id: 's4',
    name: '舞蹈课',
    total_hours: 20,
    remaining_hours: 15,
    status: 'active',
    subject_id: 'sub4',
    package_role: 'owner',
    package_tag: 'hour',
    fee_amount: 200,
    fee_method: 'wechat',
    created_at: '2025-04-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pkg5',
    teacher_id: 'teacher-001',
    student_id: 's5',
    name: '钢琴课',
    total_hours: 48,
    remaining_hours: 35,
    status: 'active',
    subject_id: 'sub1',
    package_role: 'owner',
    package_tag: 'hour',
    fee_amount: 220,
    fee_method: 'alipay',
    created_at: '2025-03-15T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pkg6',
    teacher_id: 'teacher-001',
    student_id: 's6',
    name: '声乐课',
    total_hours: 24,
    remaining_hours: 16,
    status: 'active',
    subject_id: 'sub2',
    package_role: 'owner',
    package_tag: 'hour',
    fee_amount: 180,
    fee_method: 'cash',
    created_at: '2025-04-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pkg6b',
    teacher_id: 'teacher-001',
    student_id: 's6',
    name: '书法课',
    total_hours: 10,
    remaining_hours: 2,
    status: 'active',
    subject_id: 'sub5',
    package_role: 'owner',
    package_tag: 'hour',
    fee_amount: 100,
    fee_method: 'cash',
    created_at: '2025-05-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
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
  {
    id: 'r6',
    teacher_id: 'teacher-001',
    student_id: 's1',
    package_id: 'pkg1',
    lesson_date: '2025-05-30',
    hours_used: 1,
    content: '音阶与琶音',
    performance: '良好',
    created_at: '',
    updated_at: '',
    course_package: { name: '钢琴课' },
    student: { name: '王小明' },
  },
  {
    id: 'r7',
    teacher_id: 'teacher-001',
    student_id: 's1',
    package_id: 'pkg1',
    lesson_date: '2025-05-23',
    hours_used: 1,
    content: '拜厄练习曲',
    performance: '进步中',
    homework: '慢速练习',
    created_at: '',
    updated_at: '',
    course_package: { name: '钢琴课' },
    student: { name: '王小明' },
  },
];

const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'lr1',
    parent_id: 'parent-001',
    student_id: 's1',
    teacher_id: 'teacher-001',
    type: 'leave',
    original_date: '2025-06-10',
    reason: '身体不适',
    status: 'pending',
    created_at: '2025-06-08T10:00:00Z',
    updated_at: '2025-06-08T10:00:00Z',
    student: { name: '王小明' },
  },
  {
    id: 'lr2',
    parent_id: 'parent-002',
    student_id: 's3',
    teacher_id: 'teacher-001',
    type: 'reschedule',
    original_date: '2025-06-12',
    new_date: '2025-06-14',
    reason: '学校活动冲突',
    status: 'approved',
    created_at: '2025-06-05T10:00:00Z',
    updated_at: '2025-06-06T10:00:00Z',
    student: { name: '李子轩' },
  },
];

const MOCK_CLASSES: Class[] = [
  {
    id: 'cls1',
    name: '钢琴基础班',
    teacher_id: 'teacher-001',
    note: '长期循环上课，不限制课时',
    created_at: '2025-01-10T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    type: 'unlimited',
    status: 'active',
    schedule: '每周二、四 14:00-15:30',
    weekdays: ['二', '四'],
    start_time: '14:00',
    end_time: '15:30',
    total_lessons: undefined,
    used_lessons: 24,
    teachers: ['teacher-001'],
    color: 'primary',
    student_count: 12,
  },
  {
    id: 'cls2',
    name: '舞蹈启蒙班',
    teacher_id: 'teacher-001',
    note: '长期循环上课',
    created_at: '2025-02-15T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    type: 'unlimited',
    status: 'active',
    schedule: '每周六 10:00-11:30',
    weekdays: ['六'],
    start_time: '10:00',
    end_time: '11:30',
    total_lessons: undefined,
    used_lessons: 18,
    teachers: ['teacher-001'],
    color: 'accent',
    student_count: 8,
  },
  {
    id: 'cls3',
    name: '暑期特训班',
    teacher_id: 'teacher-001',
    note: '暑期集中特训，共16课时',
    created_at: '2025-03-20T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    type: 'limited',
    status: 'active',
    schedule: '每周一、三、五 09:00-11:00',
    weekdays: ['一', '三', '五'],
    start_time: '09:00',
    end_time: '11:00',
    total_lessons: 16,
    used_lessons: 8,
    teachers: ['teacher-001'],
    start_date: '2025-07-01',
    end_date: '2025-08-15',
    color: 'amber',
    student_count: 20,
  },
  {
    id: 'cls4',
    name: '寒假集训班',
    teacher_id: 'teacher-001',
    note: '寒假集中训练，共10课时',
    created_at: '2025-04-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    type: 'limited',
    status: 'active',
    schedule: '每周二、四 10:00-12:00',
    weekdays: ['二', '四'],
    start_time: '10:00',
    end_time: '12:00',
    total_lessons: 10,
    used_lessons: 3,
    teachers: ['teacher-001'],
    start_date: '2026-01-15',
    end_date: '2026-02-10',
    color: 'info',
    student_count: 15,
  },
  {
    id: 'cls5',
    name: '暑假集训班',
    teacher_id: 'teacher-001',
    note: '已结课 - 共24课时全部完成',
    created_at: '2025-05-01T10:00:00Z',
    updated_at: '2025-08-20T10:00:00Z',
    type: 'ended',
    status: 'ended',
    schedule: '每周一、三、五 09:00-11:00',
    weekdays: ['一', '三', '五'],
    start_time: '09:00',
    end_time: '11:00',
    total_lessons: 24,
    used_lessons: 24,
    teachers: ['teacher-001'],
    start_date: '2025-07-01',
    end_date: '2025-08-15',
    color: 'purple',
    student_count: 20,
  },
];

const MOCK_CLASS_STUDENTS: ClassStudent[] = [
  { id: 'cs1', class_id: 'cls1', student_id: 's1', created_at: '2025-01-15T10:00:00Z' },
  { id: 'cs2', class_id: 'cls1', student_id: 's5', created_at: '2025-01-15T10:00:00Z' },
  { id: 'cs3', class_id: 'cls2', student_id: 's2', created_at: '2025-02-20T10:00:00Z' },
  { id: 'cs4', class_id: 'cls2', student_id: 's6', created_at: '2025-02-20T10:00:00Z' },
  { id: 'cs5', class_id: 'cls3', student_id: 's4', created_at: '2025-03-25T10:00:00Z' },
  { id: 'cs6', class_id: 'cls3', student_id: 's3', created_at: '2025-03-25T10:00:00Z' },
];

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    sender_id: 'teacher-001',
    receiver_id: 'parent-001',
    type: 'lesson_complete',
    title: '消课通知',
    content: '王小明于2025-06-07完成1课时钢琴课，剩余9课时',
    is_read: false,
    related_id: 'r1',
    created_at: '2025-06-07T10:30:00Z',
    sender: { name: '张老师' },
  },
  {
    id: 'n2',
    sender_id: 'teacher-001',
    receiver_id: 'parent-001',
    type: 'schedule_change',
    title: '排课变更',
    content: '王小明周一课程时间调整为10:00-11:30',
    is_read: false,
    related_id: 'sch1',
    created_at: '2025-06-06T15:00:00Z',
    sender: { name: '张老师' },
  },
  {
    id: 'n3',
    sender_id: 'teacher-001',
    receiver_id: 'parent-001',
    type: 'leave_response',
    title: '请假审批结果',
    content: '您提交的请假申请已同意',
    is_read: true,
    related_id: 'lr1',
    created_at: '2025-06-05T09:00:00Z',
    sender: { name: '张老师' },
  },
  {
    id: 'n4',
    sender_id: 'parent-001',
    receiver_id: 'teacher-001',
    type: 'leave_request',
    title: '请假申请',
    content: '家长为王小明提交了请假申请，原因：身体不适',
    is_read: false,
    related_id: 'lr1',
    created_at: '2025-06-08T10:00:00Z',
    sender: { name: '王爸爸' },
  },
  {
    id: 'n5',
    sender_id: 'teacher-001',
    receiver_id: 'parent-002',
    type: 'lesson_complete',
    title: '消课通知',
    content: '李子轩于2025-06-06完成1.5课时声乐课，剩余8课时',
    is_read: true,
    related_id: 'r2',
    created_at: '2025-06-06T16:00:00Z',
    sender: { name: '张老师' },
  },
  {
    id: 'n6',
    sender_id: 'teacher-001',
    receiver_id: 'teacher-001',
    type: 'general',
    title: '系统通知',
    content: '欢迎使用云课管理系统',
    is_read: true,
    created_at: '2025-01-01T00:00:00Z',
    sender: { name: '系统' },
  },
];

const MOCK_SCHEDULES: Schedule[] = [
  {
    id: 'sch1',
    teacher_id: 'teacher-001',
    student_id: 's1',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '10:30',
    color: 'primary',
    note: '钢琴课',
    reminder_minutes: 15,
    created_at: '2025-01-10T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    student: { name: '王小明' },
  },
  {
    id: 'sch2',
    teacher_id: 'teacher-001',
    class_id: 'cls1',
    day_of_week: 3,
    start_time: '14:00',
    end_time: '15:30',
    color: 'info',
    note: '启蒙班集体课',
    reminder_minutes: 30,
    created_at: '2025-02-10T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    class_info: { name: '钢琴启蒙班' },
  },
  {
    id: 'sch3',
    teacher_id: 'teacher-001',
    student_id: 's2',
    day_of_week: 5,
    start_time: '10:00',
    end_time: '11:00',
    color: 'accent',
    note: '声乐课',
    reminder_minutes: 0,
    created_at: '2025-03-10T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    student: { name: '张小花' },
  },
];

// ============================================
// Mock API
// ============================================

/** 获取教师的学生列表 */
export async function mockGetStudentsByTeacher(teacherId: string): Promise<Student[]> {
  await delay();
  return MOCK_STUDENTS.filter((s) => s.teacher_id === teacherId);
}

/** 获取家长绑定的学生列表 */
export async function mockGetStudentsByParent(parentId: string): Promise<Student[]> {
  await delay();
  const bindings = MOCK_PARENTS.filter((b) => b.parent_id === parentId);
  return MOCK_STUDENTS.filter((s) => bindings.some((b) => b.student_id === s.id));
}

/** 获取学生详情 */
export async function mockGetStudentById(studentId: string): Promise<Student | null> {
  await delay();
  return MOCK_STUDENTS.find((s) => s.id === studentId) || null;
}

/** 获取学生的消课记录 */
export async function mockGetRecordsByStudent(studentId: string): Promise<LessonRecord[]> {
  await delay();
  return MOCK_RECORDS.filter((r) => r.student_id === studentId);
}

/** 获取教师的消课记录（通过遍历学生） */
export async function mockGetLessonRecordsByTeacher(teacherId: string): Promise<LessonRecord[]> {
  await delay();
  const teacherStudents = MOCK_STUDENTS.filter((s) => s.teacher_id === teacherId);
  const studentIds = new Set(teacherStudents.map((s) => s.id));
  return MOCK_RECORDS.filter((r) => studentIds.has(r.student_id));
}

/**
 * 按月份获取教师的消课记录（与原版 getLessonRecordsByTeacherAndMonth 对齐）
 * 服务端式过滤：直接返回目标月份的数据，减少数据传输量
 */
export async function mockGetLessonRecordsByTeacherAndMonth(
  teacherId: string,
  year: number,
  month: number,
): Promise<LessonRecord[]> {
  await delay(50); // 精确查询延迟更低
  const teacherStudents = MOCK_STUDENTS.filter((s) => s.teacher_id === teacherId);
  const studentIds = new Set(teacherStudents.map((s) => s.id));
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return MOCK_RECORDS.filter(
    (r) => studentIds.has(r.student_id) && r.lesson_date >= startStr && r.lesson_date < endStr,
  );
}

/**
 * 按日期范围获取教师的消课记录（与原版 getLessonRecordsByTeacherAndRange 对齐）
 * 服务端式过滤：直接返回目标范围的数据
 */
export async function mockGetLessonRecordsByTeacherAndRange(
  teacherId: string,
  startDate: string,
  endDate: string,
): Promise<LessonRecord[]> {
  await delay(50); // 精确查询延迟更低
  const teacherStudents = MOCK_STUDENTS.filter((s) => s.teacher_id === teacherId);
  const studentIds = new Set(teacherStudents.map((s) => s.id));
  return MOCK_RECORDS.filter(
    (r) => studentIds.has(r.student_id) && r.lesson_date >= startDate && r.lesson_date <= endDate,
  );
}

/** 获取学生的消课记录（别名） */
export async function mockGetLessonRecordsByStudent(studentId: string): Promise<LessonRecord[]> {
  await delay();
  return MOCK_RECORDS.filter((r) => r.student_id === studentId);
}

/** 获取学生的课时套餐 */
export async function mockGetPackagesByStudent(studentId: string): Promise<CoursePackage[]> {
  await delay();
  return MOCK_PACKAGES.filter((p) => p.student_id === studentId);
}

/** 获取套餐详情 */
export async function mockGetPackageById(packageId: string): Promise<CoursePackage | null> {
  await delay();
  return MOCK_PACKAGES.find((p) => p.id === packageId) || null;
}

/** 创建课时套餐 */
export async function mockCreatePackage(
  data: Omit<CoursePackage, 'id' | 'created_at' | 'updated_at'>,
): Promise<CoursePackage> {
  await delay();
  const newPkg: CoursePackage = {
    ...data,
    id: `pkg${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_PACKAGES.push(newPkg);
  // 同步到学生关联数据
  const student = MOCK_STUDENTS.find((s) => s.id === data.student_id);
  if (student) {
    if (!student.course_packages) student.course_packages = [];
    student.course_packages.push({
      id: newPkg.id,
      name: newPkg.name,
      total_hours: newPkg.total_hours,
      remaining_hours: newPkg.remaining_hours,
      status: newPkg.status,
      created_at: newPkg.created_at,
    });
  }
  return newPkg;
}

/** 更新课时套餐 */
export async function mockUpdatePackage(
  packageId: string,
  data: Partial<CoursePackage>,
): Promise<CoursePackage> {
  await delay();
  const idx = MOCK_PACKAGES.findIndex((p) => p.id === packageId);
  if (idx < 0) throw new Error('套餐不存在');
  MOCK_PACKAGES[idx] = { ...MOCK_PACKAGES[idx], ...data, updated_at: new Date().toISOString() };
  // 同步到学生关联数据
  const pkg = MOCK_PACKAGES[idx];
  const student = MOCK_STUDENTS.find((s) => s.id === pkg.student_id);
  if (student && student.course_packages) {
    const cpIdx = student.course_packages.findIndex((cp) => cp.id === packageId);
    if (cpIdx >= 0) {
      student.course_packages[cpIdx] = {
        id: pkg.id,
        name: pkg.name,
        total_hours: pkg.total_hours,
        remaining_hours: pkg.remaining_hours,
        status: pkg.status,
        created_at: pkg.created_at,
      };
    }
  }
  return MOCK_PACKAGES[idx];
}

/** 获取学生的请假记录 */
export async function mockGetLeavesByStudent(studentId: string): Promise<LeaveRequest[]> {
  await delay();
  return MOCK_LEAVE_REQUESTS.filter((l) => l.student_id === studentId);
}

/** 获取教师的请假列表 */
export async function mockGetLeavesByTeacher(teacherId: string): Promise<LeaveRequest[]> {
  await delay();
  return MOCK_LEAVE_REQUESTS.filter((l) => l.teacher_id === teacherId);
}

/** 创建请假申请 */
export async function mockCreateLeaveRequest(
  data: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>,
): Promise<LeaveRequest> {
  await delay();
  const newLeave: LeaveRequest = {
    ...data,
    id: `lr${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_LEAVE_REQUESTS.push(newLeave);
  return newLeave;
}

/** 审批请假（更新状态） */
export async function mockUpdateLeaveRequestStatus(
  leaveId: string,
  status: 'approved' | 'rejected',
): Promise<LeaveRequest> {
  await delay();
  const idx = MOCK_LEAVE_REQUESTS.findIndex((l) => l.id === leaveId);
  if (idx < 0) throw new Error('申请不存在');
  MOCK_LEAVE_REQUESTS[idx] = {
    ...MOCK_LEAVE_REQUESTS[idx],
    status,
    updated_at: new Date().toISOString(),
  };
  return MOCK_LEAVE_REQUESTS[idx];
}

/** 获取学生的绑定家长列表 */
export async function mockGetParentsByStudent(studentId: string): Promise<StudentParent[]> {
  await delay();
  return MOCK_PARENTS.filter((p) => p.student_id === studentId);
}

/** 创建学生 */
export async function mockCreateStudent(
  data: Omit<Student, 'id' | 'created_at' | 'updated_at'>,
): Promise<Student> {
  await delay();
  const newStudent: Student = {
    ...data,
    id: `s${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_STUDENTS.push(newStudent);
  return newStudent;
}

/** 更新学生 */
export async function mockUpdateStudent(
  studentId: string,
  data: Partial<Student>,
): Promise<Student> {
  await delay();
  const idx = MOCK_STUDENTS.findIndex((s) => s.id === studentId);
  if (idx < 0) throw new Error('学生不存在');
  MOCK_STUDENTS[idx] = { ...MOCK_STUDENTS[idx], ...data, updated_at: new Date().toISOString() };
  return MOCK_STUDENTS[idx];
}

/** 删除学生 */
export async function mockDeleteStudent(studentId: string): Promise<void> {
  await delay();
  const idx = MOCK_STUDENTS.findIndex((s) => s.id === studentId);
  if (idx >= 0) MOCK_STUDENTS.splice(idx, 1);
}

/** 重名检测 */
export async function mockCheckDuplicateName(
  teacherId: string,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  await delay(100);
  return MOCK_STUDENTS.some(
    (s) => s.teacher_id === teacherId && s.name === name && s.id !== excludeId,
  );
}

/** 解绑家长 */
export async function mockRemoveParentFromStudent(bindingId: string): Promise<void> {
  await delay();
  const idx = MOCK_PARENTS.findIndex((p) => p.id === bindingId);
  if (idx >= 0) MOCK_PARENTS.splice(idx, 1);
}

/** 通过邀请码查找学生 */
export async function mockFindStudentByInviteCode(code: string): Promise<Student | null> {
  await delay();
  return MOCK_STUDENTS.find((s) => s.invite_code === code.toUpperCase()) || null;
}

/** 绑定家长到学生 */
export async function mockBindParentToStudent(
  studentId: string,
  parentId: string,
): Promise<StudentParent> {
  await delay();
  // 检查是否已绑定
  const exists = MOCK_PARENTS.some((p) => p.student_id === studentId && p.parent_id === parentId);
  if (exists) throw new Error('该学生已绑定，无需重复操作');
  const binding: StudentParent = {
    id: `sp${Date.now()}`,
    student_id: studentId,
    parent_id: parentId,
    created_at: new Date().toISOString(),
  };
  MOCK_PARENTS.push(binding);
  return binding;
}

/** 格式化日期为中文 */
export function formatDateCN(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ============================================
// 消课表单 Mock 接口
// ============================================

/** 创建消课记录 */
export async function mockCreateLessonRecord(
  data: Omit<LessonRecord, 'id' | 'created_at' | 'updated_at'>,
): Promise<LessonRecord> {
  await delay();
  const newRecord: LessonRecord = {
    ...data,
    id: `r${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_RECORDS.push(newRecord);
  return newRecord;
}

/** 扣减套餐课时 */
export async function mockDeductPackageHours(
  packageId: string,
  hours: number,
): Promise<CoursePackage> {
  await delay();
  const idx = MOCK_PACKAGES.findIndex((p) => p.id === packageId);
  if (idx < 0) throw new Error('套餐不存在');
  const pkg = MOCK_PACKAGES[idx];
  const remaining = pkg.remaining_hours - hours;
  MOCK_PACKAGES[idx] = {
    ...pkg,
    remaining_hours: remaining,
    status: remaining <= 0 ? 'completed' : 'active',
    updated_at: new Date().toISOString(),
  };
  // 同步更新学生关联数据
  const student = MOCK_STUDENTS.find((s) => s.id === pkg.student_id);
  if (student && student.course_packages) {
    const cpIdx = student.course_packages.findIndex((cp) => cp.id === packageId);
    if (cpIdx >= 0) {
      student.course_packages[cpIdx].remaining_hours = remaining;
    }
  }
  return MOCK_PACKAGES[idx];
}

/** 获取单条消课记录 */
export async function mockGetLessonRecordById(recordId: string): Promise<LessonRecord | null> {
  await delay();
  return MOCK_RECORDS.find((r) => r.id === recordId) || null;
}

/** 删除消课记录 */
export async function mockDeleteLessonRecord(recordId: string): Promise<void> {
  await delay();
  const idx = MOCK_RECORDS.findIndex((r) => r.id === recordId);
  if (idx >= 0) MOCK_RECORDS.splice(idx, 1);
}

/** 发送通知给家长（Mock） */
export async function mockSendNotification(_data: {
  sender_id: string;
  receiver_id: string;
  title: string;
  content: string;
  related_id?: string;
}): Promise<void> {
  await delay(100);
  // Mock: 通知发送成功
}

// ============================================
// 班级 Mock 接口
// ============================================

/** 获取教师的班级列表 */
export async function mockGetClassesByTeacher(teacherId: string): Promise<Class[]> {
  await delay();
  return MOCK_CLASSES.filter((c) => c.teacher_id === teacherId);
}

/** 获取班级的学生数量 */
export async function mockGetClassStudentCount(classId: string): Promise<number> {
  await delay(100);
  return MOCK_CLASS_STUDENTS.filter((cs) => cs.class_id === classId).length;
}

/** 获取班级详情 */
export async function mockGetClassById(classId: string): Promise<Class | null> {
  await delay();
  return MOCK_CLASSES.find((c) => c.id === classId) || null;
}

/** 获取班级的学生列表 */
export async function mockGetStudentsByClass(classId: string): Promise<Student[]> {
  await delay();
  const studentIds = MOCK_CLASS_STUDENTS.filter((cs) => cs.class_id === classId).map(
    (cs) => cs.student_id,
  );
  return MOCK_STUDENTS.filter((s) => studentIds.includes(s.id));
}

/** 创建班级 */
export async function mockCreateClass(
  data: Omit<Class, 'id' | 'created_at' | 'updated_at'>,
): Promise<Class> {
  await delay();
  const newClass: Class = {
    ...data,
    id: `cls${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_CLASSES.push(newClass);
  return newClass;
}

/** 删除班级 */
export async function mockDeleteClass(classId: string): Promise<void> {
  await delay();
  const idx = MOCK_CLASSES.findIndex((c) => c.id === classId);
  if (idx >= 0) MOCK_CLASSES.splice(idx, 1);
  // 同时删除班级-学生关联
  for (let i = MOCK_CLASS_STUDENTS.length - 1; i >= 0; i--) {
    if (MOCK_CLASS_STUDENTS[i].class_id === classId) MOCK_CLASS_STUDENTS.splice(i, 1);
  }
}

/** 从班级移除学生 */
export async function mockRemoveStudentFromClass(
  classId: string,
  studentId: string,
): Promise<void> {
  await delay();
  const idx = MOCK_CLASS_STUDENTS.findIndex(
    (cs) => cs.class_id === classId && cs.student_id === studentId,
  );
  if (idx >= 0) MOCK_CLASS_STUDENTS.splice(idx, 1);
}

/** 添加学生到班级 */
export async function mockAddStudentsToClass(classId: string, studentIds: string[]): Promise<void> {
  await delay();
  for (const sid of studentIds) {
    const exists = MOCK_CLASS_STUDENTS.some(
      (cs) => cs.class_id === classId && cs.student_id === sid,
    );
    if (!exists) {
      MOCK_CLASS_STUDENTS.push({
        id: `cs${Date.now()}_${sid}`,
        class_id: classId,
        student_id: sid,
        created_at: new Date().toISOString(),
      });
    }
  }
}

/** 更新班级信息 */
export async function mockUpdateClass(classId: string, data: Partial<Class>): Promise<Class> {
  await delay();
  const idx = MOCK_CLASSES.findIndex((c) => c.id === classId);
  if (idx < 0) throw new Error('班级不存在');
  MOCK_CLASSES[idx] = { ...MOCK_CLASSES[idx], ...data, updated_at: new Date().toISOString() };
  return MOCK_CLASSES[idx];
}

/** 学生调班 */
export async function mockTransferStudent(
  classId: string,
  targetClassId: string,
  studentId: string,
): Promise<void> {
  await delay();
  // 从原班级移除
  const idx = MOCK_CLASS_STUDENTS.findIndex(
    (cs) => cs.class_id === classId && cs.student_id === studentId,
  );
  if (idx >= 0) MOCK_CLASS_STUDENTS.splice(idx, 1);
  // 添加到目标班级
  const exists = MOCK_CLASS_STUDENTS.some(
    (cs) => cs.class_id === targetClassId && cs.student_id === studentId,
  );
  if (!exists) {
    MOCK_CLASS_STUDENTS.push({
      id: `cs${Date.now()}_${studentId}`,
      class_id: targetClassId,
      student_id: studentId,
      created_at: new Date().toISOString(),
    });
  }
  // 更新学生数量
  const srcClass = MOCK_CLASSES.find((c) => c.id === classId);
  if (srcClass)
    srcClass.student_count = MOCK_CLASS_STUDENTS.filter((cs) => cs.class_id === classId).length;
  const tgtClass = MOCK_CLASSES.find((c) => c.id === targetClassId);
  if (tgtClass)
    tgtClass.student_count = MOCK_CLASS_STUDENTS.filter(
      (cs) => cs.class_id === targetClassId,
    ).length;
}

/** 结课 */
export async function mockEndClass(classId: string): Promise<Class> {
  await delay();
  const idx = MOCK_CLASSES.findIndex((c) => c.id === classId);
  if (idx < 0) throw new Error('班级不存在');
  MOCK_CLASSES[idx] = {
    ...MOCK_CLASSES[idx],
    type: 'ended',
    status: 'ended',
    color: 'purple',
    used_lessons: MOCK_CLASSES[idx].total_lessons || MOCK_CLASSES[idx].used_lessons,
    updated_at: new Date().toISOString(),
  };
  return MOCK_CLASSES[idx];
}

// ============================================
// 排课 Mock 接口
// ============================================

/** 获取教师的排课列表 */
export async function mockGetSchedulesByTeacher(teacherId: string): Promise<Schedule[]> {
  await delay();
  return MOCK_SCHEDULES.filter((s) => s.teacher_id === teacherId);
}

/** 获取排课详情 */
export async function mockGetScheduleById(scheduleId: string): Promise<Schedule | null> {
  await delay();
  return MOCK_SCHEDULES.find((s) => s.id === scheduleId) || null;
}

/** 创建排课 */
export async function mockCreateSchedule(
  data: Omit<Schedule, 'id' | 'created_at' | 'updated_at'>,
): Promise<Schedule> {
  await delay();
  const newSchedule: Schedule = {
    ...data,
    id: `sch${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_SCHEDULES.push(newSchedule);
  return newSchedule;
}

/** 更新排课 */
export async function mockUpdateSchedule(
  scheduleId: string,
  data: Partial<Schedule>,
): Promise<Schedule> {
  await delay();
  const idx = MOCK_SCHEDULES.findIndex((s) => s.id === scheduleId);
  if (idx < 0) throw new Error('排课不存在');
  MOCK_SCHEDULES[idx] = { ...MOCK_SCHEDULES[idx], ...data, updated_at: new Date().toISOString() };
  return MOCK_SCHEDULES[idx];
}

/** 删除排课 */
export async function mockDeleteSchedule(scheduleId: string): Promise<void> {
  await delay();
  const idx = MOCK_SCHEDULES.findIndex((s) => s.id === scheduleId);
  if (idx >= 0) MOCK_SCHEDULES.splice(idx, 1);
}

/** 冲突检测：同教师同时间段是否已有排课 */
export async function mockCheckScheduleConflict(
  teacherId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeId?: string,
): Promise<boolean> {
  await delay(100);
  return MOCK_SCHEDULES.some(
    (s) =>
      s.teacher_id === teacherId &&
      s.day_of_week === dayOfWeek &&
      s.id !== excludeId &&
      s.start_time < endTime &&
      s.end_time > startTime,
  );
}

// ============================================
// 通知 Mock 接口
// ============================================

/** 获取用户的通知列表 */
export async function mockGetNotificationsByReceiver(receiverId: string): Promise<Notification[]> {
  await delay();
  return MOCK_NOTIFICATIONS.filter((n) => n.receiver_id === receiverId).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/** 标记通知为已读 */
export async function mockMarkNotificationAsRead(notificationId: string): Promise<void> {
  await delay(100);
  const idx = MOCK_NOTIFICATIONS.findIndex((n) => n.id === notificationId);
  if (idx >= 0) MOCK_NOTIFICATIONS[idx].is_read = true;
}

/** 全部标记已读 */
export async function mockMarkAllNotificationsAsRead(receiverId: string): Promise<void> {
  await delay(100);
  MOCK_NOTIFICATIONS.forEach((n) => {
    if (n.receiver_id === receiverId) n.is_read = true;
  });
}

// ============================================
// 课程包模板 Mock 数据
// ============================================
const MOCK_PACKAGE_TEMPLATES: CoursePackageTemplate[] = [
  {
    id: 'cpt1',
    teacher_id: 'teacher-001',
    name: '暑假特训课包',
    type: 'term',
    price: 3200,
    lesson_count: 16,
    duration: 90,
    valid_days: 45,
    description: '暑假集中特训，16课时，45天有效',
    created_at: '2025-06-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'cpt2',
    teacher_id: 'teacher-001',
    name: '钢琴基础课包',
    type: 'hour_package',
    price: 2400,
    lesson_count: 12,
    duration: 60,
    valid_days: 180,
    description: '钢琴入门12课时，6个月有效',
    created_at: '2025-05-15T10:00:00Z',
    updated_at: '2025-05-15T10:00:00Z',
  },
  {
    id: 'cpt3',
    teacher_id: 'teacher-001',
    name: '体验课',
    type: 'trial',
    price: 200,
    lesson_count: 1,
    duration: 60,
    valid_days: 7,
    description: '新生体验课，7天内有效',
    created_at: '2025-05-20T10:00:00Z',
    updated_at: '2025-05-20T10:00:00Z',
  },
  {
    id: 'cpt4',
    teacher_id: 'teacher-001',
    name: '寒假集训课包',
    type: 'term',
    price: 2800,
    lesson_count: 14,
    duration: 90,
    valid_days: 30,
    description: '寒假集中特训，14课时，30天有效',
    created_at: '2025-06-05T10:00:00Z',
    updated_at: '2025-06-05T10:00:00Z',
  },
  {
    id: 'cpt5',
    teacher_id: 'teacher-001',
    name: '舞蹈月卡',
    type: 'monthly',
    price: 800,
    lesson_count: 0,
    duration: 90,
    valid_days: 30,
    description: '当月不限课时',
    created_at: '2025-06-10T10:00:00Z',
    updated_at: '2025-06-10T10:00:00Z',
  },
  {
    id: 'cpt6',
    teacher_id: 'teacher-001',
    name: '舞蹈月卡（限课时）',
    type: 'monthly',
    price: 600,
    lesson_count: 8,
    duration: 90,
    valid_days: 30,
    description: '30天内8课时',
    created_at: '2025-06-10T10:00:00Z',
    updated_at: '2025-06-10T10:00:00Z',
  },
];

/** 获取教师的课程包模板列表 */
export async function mockGetPackageTemplates(teacherId: string): Promise<CoursePackageTemplate[]> {
  await delay(100);
  return MOCK_PACKAGE_TEMPLATES.filter((t) => t.teacher_id === teacherId);
}

/** 创建课程包模板 */
export async function mockCreatePackageTemplate(
  data: Omit<CoursePackageTemplate, 'id' | 'created_at' | 'updated_at'>,
): Promise<CoursePackageTemplate> {
  await delay(100);
  const now = new Date().toISOString();
  const tpl: CoursePackageTemplate = {
    ...data,
    id: `cpt${Date.now()}`,
    created_at: now,
    updated_at: now,
  };
  MOCK_PACKAGE_TEMPLATES.push(tpl);
  return tpl;
}

/** 更新课程包模板 */
export async function mockUpdatePackageTemplate(
  templateId: string,
  data: Partial<CoursePackageTemplate>,
): Promise<CoursePackageTemplate> {
  await delay(100);
  const idx = MOCK_PACKAGE_TEMPLATES.findIndex((t) => t.id === templateId);
  if (idx < 0) throw new Error('模板不存在');
  MOCK_PACKAGE_TEMPLATES[idx] = {
    ...MOCK_PACKAGE_TEMPLATES[idx],
    ...data,
    updated_at: new Date().toISOString(),
  };
  return MOCK_PACKAGE_TEMPLATES[idx];
}

/** 删除课程包模板 */
export async function mockDeletePackageTemplate(templateId: string): Promise<void> {
  await delay(100);
  const idx = MOCK_PACKAGE_TEMPLATES.findIndex((t) => t.id === templateId);
  if (idx >= 0) MOCK_PACKAGE_TEMPLATES.splice(idx, 1);
}

// ============================================
// 科目与课包自动匹配 API
// ============================================

/** 获取科目列表 */
export async function mockGetSubjects(): Promise<Subject[]> {
  await delay(50);
  return MOCK_SUBJECTS;
}

/** 根据ID获取科目 */
export async function mockGetSubjectById(subjectId: string): Promise<Subject | null> {
  await delay(50);
  return MOCK_SUBJECTS.find((s) => s.id === subjectId) || null;
}

/** 获取学生的活跃课包（含科目关联） */
export async function mockGetActivePackagesByStudent(studentId: string): Promise<CoursePackage[]> {
  await delay();
  return MOCK_PACKAGES.filter((p) => p.student_id === studentId && p.status === 'active');
}

/** 自动匹配最优课包 */
export function pickBestPackage(
  packages: CoursePackage[],
  hoursNeeded: number,
  subjectId?: string,
): CoursePackage | null {
  if (packages.length === 0) return null;

  // 优先级1：科目匹配 + 余额充足
  if (subjectId) {
    const match = packages.find(
      (p) => p.subject_id === subjectId && p.remaining_hours >= hoursNeeded,
    );
    if (match) return match;
  }

  // 优先级2：通用课包 + 余额充足
  const general = packages.find((p) => !p.subject_id && p.remaining_hours >= hoursNeeded);
  if (general) return general;

  // 优先级3：任意有余额课包
  const any = packages.find((p) => p.remaining_hours >= hoursNeeded);
  if (any) return any;

  // 优先级4：第一个课包（欠课状态）
  return packages[0];
}
