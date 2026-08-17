/**
 * 试听线索 Mock 数据接口
 *
 * 提供线索 CRUD、预约、跟进、转化的 mock 实现，
 * 联调时 Service 层只需改一行切换为 API 调用。
 */
import dayjs from 'dayjs';
import { CLASSES, COURSE_PACKAGES, STUDENTS } from '@/data/mock-database';
import type {
  Lead,
  LeadBooking,
  LeadBookingDifficulty,
  LeadFollowUp,
  LeadConversion,
  LeadCardModel,
  LeadSummary,
  LeadFormData,
  LeadStatus,
  LeadFilterTab,
  TrialSlotConfig,
} from '@/types/lead';

// ============================================
// 延迟工具
// ============================================

function delay(ms = 60): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Mock 数据集
// ============================================

let leadIdCounter = 100;
let bookingIdCounter = 100;
let followUpIdCounter = 100;
let conversionIdCounter = 100;
let slotConfigIdCounter = 100;

function nextLeadId(): string {
  return `lead-${String(++leadIdCounter).padStart(4, '0')}`;
}

function nextTrialStudentId(): string {
  return `TS-${String(leadIdCounter).padStart(5, '0')}`;
}

function nextBookingId(): string {
  return `lb-${String(++bookingIdCounter).padStart(4, '0')}`;
}

function nextFollowUpId(): string {
  return `fu-${String(++followUpIdCounter).padStart(4, '0')}`;
}

function nextConversionId(): string {
  return `cv-${String(++conversionIdCounter).padStart(4, '0')}`;
}

function nextSlotConfigId(): string {
  return `tsc-${String(++slotConfigIdCounter).padStart(4, '0')}`;
}

/** 内存中的线索列表 */
const LEADS: Lead[] = [
  {
    id: 'lead-0001',
    trial_student_id: 'TS-00001',
    child_name: '张小明',
    child_nickname: '小明',
    child_gender: 'male',
    child_age: '7岁',
    parent_name: '张建国',
    parent_phone: '13800001111',
    first_invite_teacher_id: 'user-teacher-001',
    latest_invite_teacher_id: 'user-teacher-001',
    booking_teacher_id: 'user-teacher-001',
    owner_teacher_id: 'user-teacher-001',
    creator_teacher_id: 'user-teacher-001',
    campus_id: 'campus-center',
    source_type: 'share_link',
    source_course_id: 'course-piano-01',
    booking_course_id: 'course-piano-01',
    owner_lock_status: 'locked',
    owner_lock_reason: 'first_booking',
    status: 'booked',
    first_touch_at: '2026-06-20T10:00:00Z',
    booked_at: '2026-06-21T14:00:00Z',
    duplicate_hint: false,
    weak_bind_parent: true,
    notes: '家长对钢琴很感兴趣',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-21T14:00:00Z',
  },
  {
    id: 'lead-0002',
    trial_student_id: 'TS-00002',
    child_name: '李思涵',
    child_nickname: '思涵',
    child_gender: 'female',
    child_age: '5岁',
    parent_name: '李伟',
    parent_phone: '13900002222',
    creator_teacher_id: 'user-teacher-001',
    campus_id: 'campus-center',
    source_type: 'manual',
    owner_lock_status: 'weak',
    status: 'pending',
    first_touch_at: '2026-06-22T09:00:00Z',
    duplicate_hint: false,
    weak_bind_parent: false,
    notes: '电话沟通有意向，需安排试听',
    created_at: '2026-06-22T09:00:00Z',
    updated_at: '2026-06-22T09:00:00Z',
  },
  {
    id: 'lead-0003',
    trial_student_id: 'TS-00003',
    child_name: '王浩然',
    child_gender: 'male',
    child_age: '8岁',
    parent_name: '王丽华',
    parent_phone: '13700003333',
    first_invite_teacher_id: 'user-teacher-001',
    latest_invite_teacher_id: 'user-teacher-001',
    booking_teacher_id: 'user-teacher-001',
    owner_teacher_id: 'user-teacher-001',
    creator_teacher_id: 'user-teacher-001',
    campus_id: 'campus-east',
    source_type: 'qr',
    booking_course_id: 'course-art-01',
    owner_lock_status: 'locked',
    owner_lock_reason: 'first_booking',
    status: 'arrived',
    first_touch_at: '2026-06-18T16:00:00Z',
    booked_at: '2026-06-19T10:00:00Z',
    duplicate_hint: false,
    weak_bind_parent: true,
    notes: '试听完成，意向中等',
    created_at: '2026-06-18T16:00:00Z',
    updated_at: '2026-06-22T11:00:00Z',
  },
  {
    id: 'lead-0004',
    trial_student_id: 'TS-00004',
    child_name: '赵雨萱',
    child_nickname: '萱萱',
    child_gender: 'female',
    child_age: '6岁',
    parent_name: '赵明',
    parent_phone: '13600004444',
    first_invite_teacher_id: 'user-teacher-001',
    latest_invite_teacher_id: 'user-teacher-001',
    booking_teacher_id: 'user-teacher-001',
    owner_teacher_id: 'user-teacher-001',
    creator_teacher_id: 'user-teacher-001',
    campus_id: 'campus-center',
    source_type: 'share_link',
    booking_course_id: 'course-dance-01',
    owner_lock_status: 'locked',
    owner_lock_reason: 'first_booking',
    status: 'following',
    first_touch_at: '2026-06-15T08:00:00Z',
    booked_at: '2026-06-16T14:00:00Z',
    duplicate_hint: false,
    weak_bind_parent: true,
    notes: '试听后需要继续跟进，考虑中',
    created_at: '2026-06-15T08:00:00Z',
    updated_at: '2026-06-20T17:00:00Z',
  },
  {
    id: 'lead-0005',
    trial_student_id: 'TS-00005',
    child_name: '陈子轩',
    child_gender: 'male',
    child_age: '9岁',
    parent_name: '陈磊',
    parent_phone: '13500005555',
    first_invite_teacher_id: 'user-teacher-001',
    booking_teacher_id: 'user-teacher-001',
    owner_teacher_id: 'user-teacher-001',
    creator_teacher_id: 'user-teacher-001',
    campus_id: 'campus-center',
    source_type: 'manual',
    booking_course_id: 'course-calligraphy-01',
    owner_lock_status: 'locked',
    owner_lock_reason: 'first_booking',
    status: 'closed',
    first_touch_at: '2026-06-10T09:00:00Z',
    booked_at: '2026-06-11T10:00:00Z',
    duplicate_hint: false,
    weak_bind_parent: false,
    notes: '已转正式学员',
    created_at: '2026-06-10T09:00:00Z',
    updated_at: '2026-06-13T15:00:00Z',
  },
  {
    id: 'lead-0006',
    trial_student_id: 'TS-00006',
    child_name: '刘诗琪',
    child_gender: 'female',
    child_age: '4岁',
    creator_teacher_id: 'user-teacher-002',
    campus_id: 'campus-east',
    source_type: 'manual',
    owner_lock_status: 'weak',
    status: 'new',
    duplicate_hint: false,
    weak_bind_parent: false,
    notes: '新录入，待联系',
    created_at: '2026-06-22T15:00:00Z',
    updated_at: '2026-06-22T15:00:00Z',
  },
  {
    id: 'lead-0007',
    trial_student_id: 'TS-00007',
    child_name: '周子墨',
    child_nickname: '墨墨',
    child_gender: 'male',
    child_age: '6岁',
    parent_name: '周婷',
    parent_phone: '13800007777',
    first_invite_teacher_id: 'user-teacher-001',
    latest_invite_teacher_id: 'user-teacher-001',
    booking_teacher_id: 'user-teacher-001',
    owner_teacher_id: 'user-teacher-001',
    creator_teacher_id: 'user-teacher-001',
    campus_id: 'campus-center',
    source_type: 'qr',
    booking_course_id: 'course-piano-01',
    owner_lock_status: 'locked',
    owner_lock_reason: 'first_booking',
    status: 'not_arrived',
    first_touch_at: '2026-06-25T10:00:00Z',
    booked_at: '2026-06-26T09:00:00Z',
    duplicate_hint: false,
    weak_bind_parent: true,
    notes: '预约了试听但未到，需要再次邀约',
    created_at: '2026-06-25T10:00:00Z',
    updated_at: '2026-06-26T19:00:00Z',
  },
  {
    id: 'lead-0008',
    trial_student_id: 'TS-00008',
    child_name: '吴欣怡',
    child_gender: 'female',
    child_age: '7岁',
    parent_name: '吴强',
    parent_phone: '13900008888',
    first_invite_teacher_id: 'user-teacher-002',
    latest_invite_teacher_id: 'user-teacher-002',
    booking_teacher_id: 'user-teacher-002',
    owner_teacher_id: 'user-teacher-002',
    creator_teacher_id: 'user-teacher-002',
    campus_id: 'campus-east',
    source_type: 'share_link',
    booking_course_id: 'course-art-01',
    owner_lock_status: 'locked',
    owner_lock_reason: 'first_booking',
    status: 'closed',
    first_touch_at: '2026-06-12T14:00:00Z',
    booked_at: '2026-06-13T10:00:00Z',
    closed_reason: '家长选择其他机构',
    duplicate_hint: false,
    weak_bind_parent: false,
    notes: '已关闭，不再跟进',
    created_at: '2026-06-12T14:00:00Z',
    updated_at: '2026-06-18T11:00:00Z',
  },
  {
    id: 'lead-0009',
    trial_student_id: 'TS-00009',
    child_name: '郑宇航',
    child_gender: 'male',
    child_age: '10岁',
    parent_name: '郑伟',
    parent_phone: '13700009999',
    creator_teacher_id: 'user-teacher-001',
    campus_id: 'campus-center',
    source_type: 'manual',
    owner_lock_status: 'weak',
    status: 'pending',
    first_touch_at: '2026-06-28T09:30:00Z',
    duplicate_hint: false,
    weak_bind_parent: false,
    notes: '家长想先了解课程，待预约试听',
    created_at: '2026-06-28T09:30:00Z',
    updated_at: '2026-06-28T09:30:00Z',
  },
  {
    id: 'lead-0010',
    trial_student_id: 'TS-00010',
    child_name: '杨诗雨',
    child_nickname: '小雨',
    child_gender: 'female',
    child_age: '5岁',
    parent_name: '杨梅',
    parent_phone: '13600001010',
    first_invite_teacher_id: 'user-teacher-001',
    latest_invite_teacher_id: 'user-teacher-001',
    booking_teacher_id: 'user-teacher-001',
    owner_teacher_id: 'user-teacher-001',
    creator_teacher_id: 'user-teacher-001',
    campus_id: 'campus-center',
    source_type: 'share_link',
    booking_course_id: 'course-dance-01',
    owner_lock_status: 'locked',
    owner_lock_reason: 'first_booking',
    status: 'booked',
    first_touch_at: '2026-06-27T16:00:00Z',
    booked_at: '2026-06-28T11:00:00Z',
    duplicate_hint: false,
    weak_bind_parent: true,
    notes: '已预约今日舞蹈试听',
    created_at: '2026-06-27T16:00:00Z',
    updated_at: '2026-06-28T11:00:00Z',
  },
  {
    id: 'lead-0011',
    trial_student_id: 'TS-00011',
    child_name: '黄嘉乐',
    child_gender: 'male',
    child_age: '8岁',
    parent_name: '黄建军',
    parent_phone: '13500001111',
    first_invite_teacher_id: 'user-teacher-002',
    latest_invite_teacher_id: 'user-teacher-002',
    booking_teacher_id: 'user-teacher-002',
    owner_teacher_id: 'user-teacher-002',
    creator_teacher_id: 'user-teacher-002',
    campus_id: 'campus-east',
    source_type: 'manual',
    booking_course_id: 'course-calligraphy-01',
    owner_lock_status: 'locked',
    owner_lock_reason: 'first_booking',
    status: 'arrived',
    first_touch_at: '2026-06-24T10:00:00Z',
    booked_at: '2026-06-25T14:00:00Z',
    duplicate_hint: false,
    weak_bind_parent: true,
    notes: '试听书法课，意向较高',
    created_at: '2026-06-24T10:00:00Z',
    updated_at: '2026-06-25T16:00:00Z',
  },
  {
    id: 'lead-0012',
    trial_student_id: 'TS-00012',
    child_name: '许静雯',
    child_gender: 'female',
    child_age: '6岁',
    creator_teacher_id: 'user-teacher-001',
    campus_id: 'campus-center',
    source_type: 'qr',
    owner_lock_status: 'weak',
    status: 'following',
    first_touch_at: '2026-06-21T13:00:00Z',
    duplicate_hint: false,
    weak_bind_parent: false,
    notes: '已电话回访两次，家长还在考虑',
    created_at: '2026-06-21T13:00:00Z',
    updated_at: '2026-06-27T10:00:00Z',
  },
];

/** 内存中的预约列表 */
const LEAD_BOOKINGS: LeadBooking[] = [
  {
    id: 'lb-0001',
    lead_id: 'lead-0001',
    trial_student_id: 'TS-00001',
    trial_mode: 'group',
    class_id: 'cls-001',
    class_name: '钢琴入门A班',
    course_id: 'course-piano-01',
    course_name: '钢琴启蒙班',
    subject_name: '钢琴',
    campus_id: 'campus-center',
    campus_name: '中心校区',
    teacher_id: 'user-teacher-001',
    teacher_name: '张老师',
    lesson_date: dayjs().format('YYYY-MM-DD'),
    start_time: '14:00',
    end_time: '15:30',
    room: '琴房A1',
    status: 'confirmed',
    difficulty: 'basic',
    booking_type: 'self',
    created_at: '2026-06-21T14:00:00Z',
    updated_at: '2026-06-21T14:00:00Z',
  },
  {
    id: 'lb-0002',
    lead_id: 'lead-0003',
    trial_student_id: 'TS-00003',
    trial_mode: 'group',
    class_id: 'cls-004',
    class_name: '声乐初级班',
    course_id: 'course-art-01',
    course_name: '创意美术班',
    subject_name: '声乐',
    campus_id: 'campus-center',
    campus_name: '中心校区',
    teacher_id: 'user-teacher-002',
    teacher_name: '李老师',
    lesson_date: dayjs().format('YYYY-MM-DD'),
    start_time: '15:00',
    end_time: '16:30',
    room: '画室B2',
    status: 'completed',
    difficulty: 'all',
    booking_type: 'self',
    created_at: '2026-06-19T10:00:00Z',
    updated_at: '2026-06-20T15:30:00Z',
  },
  {
    id: 'lb-0003',
    lead_id: 'lead-0004',
    trial_student_id: 'TS-00004',
    trial_mode: 'private',
    course_id: 'course-dance-01',
    course_name: '少儿舞蹈班',
    subject_name: '舞蹈',
    campus_id: 'campus-center',
    campus_name: '中心校区',
    teacher_id: 'user-teacher-001',
    teacher_name: '张老师',
    lesson_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    start_time: '16:00',
    end_time: '17:00',
    room: '舞蹈室C1',
    status: 'completed',
    difficulty: 'advanced',
    booking_type: 'proxy',
    operator_id: 'user-teacher-001',
    created_at: '2026-06-16T14:00:00Z',
    updated_at: '2026-06-17T17:00:00Z',
  },
  {
    id: 'lb-0004',
    lead_id: 'lead-0005',
    trial_student_id: 'TS-00005',
    trial_mode: 'group',
    class_id: 'cls-003',
    class_name: '乐理基础班',
    course_id: 'course-calligraphy-01',
    course_name: '书法入门班',
    subject_name: '乐理',
    campus_id: 'campus-center',
    campus_name: '中心校区',
    teacher_id: 'user-teacher-001',
    teacher_name: '张老师',
    lesson_date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
    start_time: '10:00',
    end_time: '11:30',
    room: '书法室D1',
    status: 'completed',
    difficulty: 'intermediate',
    booking_type: 'proxy',
    operator_id: 'user-teacher-001',
    created_at: '2026-06-11T10:00:00Z',
    updated_at: '2026-06-12T10:00:00Z',
  },
  {
    id: 'lb-0005',
    lead_id: 'lead-0007',
    trial_student_id: 'TS-00007',
    trial_mode: 'group',
    class_id: 'cls-001',
    class_name: '钢琴入门A班',
    course_id: 'course-piano-01',
    course_name: '钢琴启蒙班',
    subject_name: '钢琴',
    campus_id: 'campus-center',
    campus_name: '中心校区',
    teacher_id: 'user-teacher-001',
    teacher_name: '张老师',
    lesson_date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    start_time: '14:00',
    end_time: '15:30',
    room: '琴房A1',
    status: 'no_show',
    difficulty: 'basic',
    booking_type: 'self',
    created_at: '2026-06-26T09:00:00Z',
    updated_at: '2026-06-26T19:00:00Z',
  },
  {
    id: 'lb-0006',
    lead_id: 'lead-0010',
    trial_student_id: 'TS-00010',
    trial_mode: 'private',
    course_id: 'course-dance-01',
    course_name: '少儿舞蹈班',
    subject_name: '舞蹈',
    campus_id: 'campus-center',
    campus_name: '中心校区',
    teacher_id: 'user-teacher-001',
    teacher_name: '王老师',
    lesson_date: dayjs().format('YYYY-MM-DD'),
    start_time: '16:00',
    end_time: '17:00',
    room: '舞蹈室C1',
    status: 'confirmed',
    difficulty: 'advanced',
    booking_type: 'proxy',
    operator_id: 'user-teacher-001',
    created_at: '2026-06-28T11:00:00Z',
    updated_at: '2026-06-28T11:00:00Z',
  },
  {
    id: 'lb-0007',
    lead_id: 'lead-0011',
    trial_student_id: 'TS-00011',
    trial_mode: 'group',
    class_id: 'cls-004',
    class_name: '声乐初级班',
    course_id: 'course-calligraphy-01',
    course_name: '书法入门班',
    subject_name: '声乐',
    campus_id: 'campus-center',
    campus_name: '中心校区',
    teacher_id: 'user-teacher-002',
    teacher_name: '李老师',
    lesson_date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    start_time: '15:00',
    end_time: '16:30',
    room: '书法室D2',
    status: 'completed',
    difficulty: 'intermediate',
    booking_type: 'self',
    created_at: '2026-06-25T10:00:00Z',
    updated_at: '2026-06-25T16:00:00Z',
  },
];

/** 生成独立试听时段配置 — 覆盖未来多天、多位老师，用于预约页交互效果验证 */
function buildTrialSlotConfigs(): TrialSlotConfig[] {
  const today = dayjs();
  const configs: TrialSlotConfig[] = [];

  const teachers = [
    {
      teacherId: 'teacher-001',
      teacherName: '王老师',
      campusId: 'campus-center',
      campusName: '中心校区',
      courseId: 'course-piano-01',
      courseName: '钢琴启蒙班',
      subjectName: '钢琴',
    },
    {
      teacherId: 'teacher-002',
      teacherName: '李老师',
      campusId: 'campus-center',
      campusName: '中心校区',
      courseId: 'course-vocal-01',
      courseName: '声乐小组课',
      subjectName: '声乐',
    },
    {
      teacherId: 'teacher-003',
      teacherName: '张老师',
      campusId: 'campus-center',
      campusName: '中心校区',
      courseId: 'course-piano-02',
      courseName: '钢琴进阶班',
      subjectName: '钢琴',
    },
    {
      teacherId: 'teacher-004',
      teacherName: '陈老师',
      campusId: 'campus-center',
      campusName: '中心校区',
      courseId: 'course-calligraphy-01',
      courseName: '书法入门班',
      subjectName: '书法',
    },
    {
      teacherId: 'teacher-006',
      teacherName: '周老师',
      campusId: 'campus-center',
      campusName: '中心校区',
      courseId: 'course-guitar-01',
      courseName: '吉他入门班',
      subjectName: '吉他',
    },
    {
      teacherId: 'teacher-007',
      teacherName: '吴老师',
      campusId: 'campus-center',
      campusName: '中心校区',
      courseId: 'course-dance-01',
      courseName: '少儿舞蹈班',
      subjectName: '舞蹈',
    },
    {
      teacherId: 'teacher-009',
      teacherName: '刘老师',
      campusId: 'campus-center',
      campusName: '中心校区',
      courseId: 'course-violin-01',
      courseName: '小提琴启蒙班',
      subjectName: '小提琴',
    },
    {
      teacherId: 'teacher-011',
      teacherName: '郑老师',
      campusId: 'campus-center',
      campusName: '中心校区',
      courseId: 'course-piano-03',
      courseName: '钢琴考级班',
      subjectName: '钢琴',
    },
    {
      teacherId: 'teacher-013',
      teacherName: '何老师',
      campusId: 'campus-center',
      campusName: '中心校区',
      courseId: 'course-art-01',
      courseName: '美术创意课',
      subjectName: '美术',
    },
    {
      teacherId: 'teacher-020',
      teacherName: '曹老师',
      campusId: 'campus-center',
      campusName: '中心校区',
      courseId: 'course-piano-04',
      courseName: '钢琴基础班',
      subjectName: '钢琴',
    },
  ];

  const timeSlots = [
    { start: '09:00', end: '10:00' },
    { start: '10:30', end: '11:30' },
    { start: '14:00', end: '15:00' },
    { start: '16:00', end: '17:00' },
    { start: '18:00', end: '19:00' },
  ];

  teachers.forEach((teacher, index) => {
    // 每位老师在未来 0-6 天内分布，确保不同日期切换都能看到老师
    const offsetDays = index % 5;
    const baseDate = today.add(offsetDays, 'day');

    // 每位老师生成 1-2 个时段
    const slotCount = index % 2 === 0 ? 2 : 1;
    for (let i = 0; i < slotCount; i++) {
      const time = timeSlots[(index + i) % timeSlots.length];
      const maxCount = [2, 3, 4][index % 3];
      const currentCount = i === 0 ? Math.min(1, maxCount - 1) : 0;
      configs.push({
        id: `tsc-gen-${index}-${i}`,
        course_id: teacher.courseId,
        course_name: teacher.courseName,
        subject_name: teacher.subjectName,
        campus_id: teacher.campusId,
        campus_name: teacher.campusName,
        teacher_id: teacher.teacherId,
        teacher_name: teacher.teacherName,
        lesson_date: baseDate.add(i === 1 ? 1 : 0, 'day').format('YYYY-MM-DD'),
        start_time: time.start,
        end_time: time.end,
        room: `${teacher.subjectName}教室${String.fromCharCode(65 + (index % 5))}${(index % 3) + 1}`,
        max_count: maxCount,
        current_count: currentCount,
        status: 'active',
        creator_teacher_id: 'user-teacher-001',
        creator_teacher_name: '王老师',
        created_at: today.subtract(1, 'day').toISOString(),
        updated_at: today.toISOString(),
      });
    }
  });

  // 额外为今天增加几个热门时段，确保首次进入页面就能看到老师
  configs.push(
    {
      id: 'tsc-today-001',
      course_id: 'course-piano-01',
      course_name: '钢琴启蒙班',
      subject_name: '钢琴',
      campus_id: 'campus-center',
      campus_name: '中心校区',
      teacher_id: 'teacher-001',
      teacher_name: '王老师',
      lesson_date: today.format('YYYY-MM-DD'),
      start_time: '09:00',
      end_time: '10:00',
      room: '琴房A1',
      max_count: 3,
      current_count: 1,
      status: 'active',
      creator_teacher_id: 'user-teacher-001',
      creator_teacher_name: '王老师',
      created_at: today.subtract(2, 'day').toISOString(),
      updated_at: today.toISOString(),
    },
    {
      id: 'tsc-today-002',
      course_id: 'course-vocal-01',
      course_name: '声乐小组课',
      subject_name: '声乐',
      campus_id: 'campus-center',
      campus_name: '中心校区',
      teacher_id: 'teacher-002',
      teacher_name: '李老师',
      lesson_date: today.format('YYYY-MM-DD'),
      start_time: '14:00',
      end_time: '15:00',
      room: '声乐室B1',
      max_count: 4,
      current_count: 2,
      status: 'active',
      creator_teacher_id: 'user-teacher-001',
      creator_teacher_name: '王老师',
      created_at: today.subtract(1, 'day').toISOString(),
      updated_at: today.toISOString(),
    },
    {
      id: 'tsc-today-003',
      course_id: 'course-piano-02',
      course_name: '钢琴进阶班',
      subject_name: '钢琴',
      campus_id: 'campus-center',
      campus_name: '中心校区',
      teacher_id: 'teacher-003',
      teacher_name: '张老师',
      lesson_date: today.format('YYYY-MM-DD'),
      start_time: '16:00',
      end_time: '17:00',
      room: '琴房A3',
      max_count: 2,
      current_count: 0,
      status: 'active',
      creator_teacher_id: 'user-teacher-001',
      creator_teacher_name: '王老师',
      created_at: today.subtract(1, 'day').toISOString(),
      updated_at: today.toISOString(),
    },
  );

  return configs;
}

/** 内存中的独立试听时段配置 */
const TRIAL_SLOT_CONFIGS: TrialSlotConfig[] = buildTrialSlotConfigs();

/**
 * 基于时段配置派生对应的模拟预约记录，保证记录 Tab 与日历下老师列表数据联动。
 * - 为 current_count > 0 的时段生成对应数量的预约记录
 * - teacher_id 与时段保持一致（如 teacher-001），确保切换日期能匹配到当日记录
 */
function buildTrialBookingsFromSlots(): LeadBooking[] {
  const bookings: LeadBooking[] = [];
  const today = dayjs();
  // 模拟学员池
  const mockStudents = [
    { childName: '张小明', parentName: '张建国', parentPhone: '13800001111' },
    { childName: '李思涵', parentName: '李伟', parentPhone: '13900002222' },
    { childName: '王浩然', parentName: '王丽华', parentPhone: '13700003333' },
    { childName: '赵雨萱', parentName: '赵明', parentPhone: '13600004444' },
    { childName: '陈子轩', parentName: '陈磊', parentPhone: '13500005555' },
    { childName: '刘诗琪', parentName: '刘芳', parentPhone: '13800006666' },
    { childName: '周子墨', parentName: '周婷', parentPhone: '13800007777' },
    { childName: '吴欣怡', parentName: '吴强', parentPhone: '13900008888' },
  ];

  let derivedBookingIdCounter = 1000;
  TRIAL_SLOT_CONFIGS.forEach((slot) => {
    // 只为今日及以后的时段生成预约记录
    if (slot.lesson_date < today.format('YYYY-MM-DD')) return;
    const count = slot.current_count;
    for (let i = 0; i < count; i++) {
      const student = mockStudents[(derivedBookingIdCounter + i) % mockStudents.length];
      const isToday = slot.lesson_date === today.format('YYYY-MM-DD');
      // 今日已结束 → completed；未来或今日未结束 → confirmed
      let status: LeadBooking['status'] = 'confirmed';
      if (isToday) {
        const end = dayjs(`${slot.lesson_date} ${slot.end_time}`);
        if (end.isBefore(dayjs())) status = 'completed';
      }
      bookings.push({
        id: `lb-derived-${++derivedBookingIdCounter}`,
        lead_id: `lead-derived-${derivedBookingIdCounter}`,
        trial_student_id: `TS-derived-${derivedBookingIdCounter}`,
        trial_mode: 'private',
        course_id: slot.course_id,
        course_name: slot.course_name,
        subject_name: slot.subject_name,
        campus_id: slot.campus_id,
        campus_name: slot.campus_name,
        teacher_id: slot.teacher_id,
        teacher_name: slot.teacher_name,
        child_name: student.childName,
        parent_name: student.parentName,
        parent_phone: student.parentPhone,
        lesson_date: slot.lesson_date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        room: slot.room,
        status,
        booking_type: 'self',
        // operator_id 设为登录用户，确保 getLeadBookingsByTeacher(currentUserId) 能查到
        operator_id: 'user-teacher-001',
        created_at: today.subtract(1, 'day').toISOString(),
        updated_at: today.toISOString(),
      });
    }
  });

  return bookings;
}

/** 追加派生的预约记录到内存列表 */
LEAD_BOOKINGS.push(...buildTrialBookingsFromSlots());

/** 内存中的跟进记录 */
const LEAD_FOLLOW_UPS: LeadFollowUp[] = [
  {
    id: 'fu-0001',
    lead_id: 'lead-0003',
    action: 'phone_call',
    intent_level: 'medium',
    content: '试听后电话回访，家长表示孩子喜欢但需再考虑',
    next_follow_up_at: '2026-06-25T10:00:00Z',
    operator_id: 'user-teacher-001',
    operator_name: '王老师',
    created_at: '2026-06-22T11:00:00Z',
  },
  {
    id: 'fu-0002',
    lead_id: 'lead-0004',
    action: 'wechat',
    intent_level: 'medium',
    content: '微信沟通，家长说还在比较其他机构',
    next_follow_up_at: '2026-06-24T15:00:00Z',
    operator_id: 'user-teacher-001',
    operator_name: '王老师',
    created_at: '2026-06-20T17:00:00Z',
  },
  {
    id: 'fu-0003',
    lead_id: 'lead-0004',
    action: 'push_convert',
    intent_level: 'medium',
    content: '发送课包优惠信息，引导报名',
    operator_id: 'user-teacher-001',
    operator_name: '王老师',
    created_at: '2026-06-21T10:00:00Z',
  },
  {
    id: 'fu-0004',
    lead_id: 'lead-0007',
    action: 're_invite',
    intent_level: 'medium',
    content: '试听未到，已电话重新邀约下周时间',
    next_follow_up_at: '2026-06-30T10:00:00Z',
    operator_id: 'user-teacher-001',
    operator_name: '王老师',
    created_at: '2026-06-27T10:00:00Z',
  },
  {
    id: 'fu-0005',
    lead_id: 'lead-0008',
    action: 'phone_call',
    intent_level: 'low',
    content: '家长明确选择其他机构，关闭线索',
    operator_id: 'user-teacher-002',
    operator_name: '李老师',
    created_at: '2026-06-18T11:00:00Z',
  },
  {
    id: 'fu-0006',
    lead_id: 'lead-0009',
    action: 'wechat',
    intent_level: 'high',
    content: '家长咨询课程体系和收费标准，意向较高',
    next_follow_up_at: '2026-06-30T14:00:00Z',
    operator_id: 'user-teacher-001',
    operator_name: '王老师',
    created_at: '2026-06-28T16:00:00Z',
  },
  {
    id: 'fu-0007',
    lead_id: 'lead-0011',
    action: 'phone_call',
    intent_level: 'high',
    content: '试听后家长很满意，正在考虑报名课包',
    next_follow_up_at: '2026-06-28T18:00:00Z',
    operator_id: 'user-teacher-002',
    operator_name: '李老师',
    created_at: '2026-06-25T17:00:00Z',
  },
  {
    id: 'fu-0008',
    lead_id: 'lead-0012',
    action: 'phone_call',
    intent_level: 'medium',
    content: '第一次回访，家长表示孩子有兴趣但时间不合适',
    next_follow_up_at: '2026-06-24T10:00:00Z',
    operator_id: 'user-teacher-001',
    operator_name: '王老师',
    created_at: '2026-06-22T10:00:00Z',
  },
  {
    id: 'fu-0009',
    lead_id: 'lead-0012',
    action: 'wechat',
    intent_level: 'low',
    content: '第二次回访，家长还在犹豫，暂未确定试听时间',
    operator_id: 'user-teacher-001',
    operator_name: '王老师',
    created_at: '2026-06-25T11:00:00Z',
  },
];

/** 内存中的转化记录 */
const LEAD_CONVERSIONS: LeadConversion[] = [
  {
    id: 'cv-0001',
    lead_id: 'lead-0005',
    conversion_type: 'new_student',
    student_id: 'student-005',
    operator_id: 'user-teacher-001',
    note: '试听后当场报名书法课包',
    created_at: '2026-06-13T15:00:00Z',
  },
];

// ============================================
// 线索 CRUD
// ============================================

/** 获取老师的线索列表 */
export async function mockGetLeadsByTeacher(teacherId: string): Promise<Lead[]> {
  await delay();
  return LEADS.filter(
    (l) => l.owner_teacher_id === teacherId || l.creator_teacher_id === teacherId,
  );
}

/** 获取线索详情 */
export async function mockGetLeadById(leadId: string): Promise<Lead | null> {
  await delay();
  return LEADS.find((l) => l.id === leadId) || null;
}

/** 获取线索卡片列表 */
export async function mockGetLeadCardsByTeacher(
  teacherId: string,
  filterTab?: LeadFilterTab,
): Promise<LeadCardModel[]> {
  await delay();
  let leads = LEADS.filter(
    (l) => l.owner_teacher_id === teacherId || l.creator_teacher_id === teacherId,
  );

  if (filterTab && filterTab !== 'all') {
    leads = leads.filter((l) => {
      switch (filterTab) {
        // 待跟进：包含未开始、待预约、持续跟进、未到店的线索
        case 'following':
          return ['new', 'pending', 'following', 'not_arrived'].includes(l.status);
        // 已预约：包含已预约和已到店的线索
        case 'booked':
          return ['booked', 'arrived'].includes(l.status);
        // 已流失：包含关闭和已转化的线索（转化后成为正式学员，不再在线索池内展示）
        case 'closed':
          return ['closed', 'converted'].includes(l.status);
        default:
          return true;
      }
    });
  }

  // 查找最近跟进时间
  return leads.map((l) => {
    const followUps = LEAD_FOLLOW_UPS.filter((f) => f.lead_id === l.id);
    const latestFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : undefined;
    const booking = LEAD_BOOKINGS.find((b) => b.lead_id === l.id && b.status !== 'cancelled');

    return {
      id: l.id,
      trial_student_id: l.trial_student_id,
      child_name: l.child_name,
      child_nickname: l.child_nickname,
      parent_phone: l.parent_phone,
      parent_name: l.parent_name,
      status: l.status,
      source_type: l.source_type,
      booking_course_name: booking?.course_name,
      owner_teacher_name: l.owner_teacher_id === teacherId ? '我' : undefined,
      owner_lock_status: l.owner_lock_status,
      latest_follow_up_at: latestFollowUp?.created_at,
      next_follow_up_at: latestFollowUp?.next_follow_up_at,
      created_at: l.created_at,
    } as LeadCardModel;
  });
}

/** 获取线索统计摘要 */
export async function mockGetLeadSummary(teacherId: string): Promise<LeadSummary> {
  await delay();
  const leads = LEADS.filter(
    (l) => l.owner_teacher_id === teacherId || l.creator_teacher_id === teacherId,
  );
  const today = dayjs().format('YYYY-MM-DD');
  return {
    total: leads.length,
    following: leads.filter((l) =>
      ['new', 'pending', 'following', 'not_arrived'].includes(l.status),
    ).length,
    booked: leads.filter((l) => ['booked', 'arrived'].includes(l.status)).length,
    closed: leads.filter((l) => ['closed', 'converted'].includes(l.status)).length,
    today_trial: leads.filter((l) =>
      LEAD_BOOKINGS.some(
        (b) => b.lead_id === l.id && b.status !== 'cancelled' && b.lesson_date === today,
      ),
    ).length,
    pending: leads.filter((l) => ['new', 'pending'].includes(l.status)).length,
    converted: leads.filter((l) => l.status === 'converted').length,
  };
}

/** 创建线索 */
export async function mockCreateLead(data: LeadFormData, teacherId: string): Promise<Lead> {
  await delay();

  // 去重检测
  const duplicateHint = LEADS.some(
    (l) =>
      l.child_name === data.child_name &&
      l.parent_phone === data.parent_phone &&
      l.campus_id === data.campus_id &&
      !['converted', 'closed'].includes(l.status),
  );

  const now = dayjs().toISOString();
  const lead: Lead = {
    id: nextLeadId(),
    trial_student_id: nextTrialStudentId(),
    child_name: data.child_name,
    child_nickname: data.child_nickname,
    child_gender: data.child_gender,
    child_age: data.child_age,
    parent_name: data.parent_name,
    parent_phone: data.parent_phone,
    creator_teacher_id: teacherId,
    owner_teacher_id: teacherId,
    campus_id: data.campus_id,
    source_type: 'manual',
    source_course_id: data.source_course_id,
    owner_lock_status: 'weak',
    status: 'new',
    first_touch_at: now,
    duplicate_hint: duplicateHint,
    weak_bind_parent: false,
    notes: data.notes,
    created_at: now,
    updated_at: now,
  };

  LEADS.push(lead);
  return lead;
}

/** 通过邀约链接创建线索（家长注册后自动触发） */
export async function mockCreateLeadFromInvite(params: {
  parentUserId: string;
  parentName?: string;
  parentPhone?: string;
  childName: string;
  childNickname?: string;
  teacherId: string;
  campusId: string;
  sourceType: 'share_link' | 'qr';
  sourceCourseId?: string;
}): Promise<Lead> {
  await delay();

  // 去重：同家长 + 同孩子名 + 同校区
  const existing = LEADS.find(
    (l) =>
      l.parent_user_id === params.parentUserId &&
      l.child_name === params.childName &&
      l.campus_id === params.campusId &&
      !['converted', 'closed'].includes(l.status),
  );

  if (existing) {
    // 更新最近邀约老师
    existing.latest_invite_teacher_id = params.teacherId;
    existing.updated_at = dayjs().toISOString();
    return existing;
  }

  const now = dayjs().toISOString();
  const lead: Lead = {
    id: nextLeadId(),
    trial_student_id: nextTrialStudentId(),
    child_name: params.childName,
    child_nickname: params.childNickname,
    parent_user_id: params.parentUserId,
    parent_name: params.parentName,
    parent_phone: params.parentPhone,
    first_invite_teacher_id: params.teacherId,
    latest_invite_teacher_id: params.teacherId,
    owner_teacher_id: params.teacherId,
    creator_teacher_id: params.teacherId,
    campus_id: params.campusId,
    source_type: params.sourceType,
    source_course_id: params.sourceCourseId,
    owner_lock_status: 'weak',
    status: 'pending',
    first_touch_at: now,
    duplicate_hint: false,
    weak_bind_parent: true,
    created_at: now,
    updated_at: now,
  };

  LEADS.push(lead);
  return lead;
}

/** 更新线索状态 */
export async function mockUpdateLeadStatus(
  leadId: string,
  status: LeadStatus,
  extra?: { closed_reason?: string },
): Promise<Lead | null> {
  await delay();
  const lead = LEADS.find((l) => l.id === leadId);
  if (!lead) return null;

  lead.status = status;
  lead.updated_at = dayjs().toISOString();

  if (status === 'converted') {
    lead.converted_at = dayjs().toISOString();
  }
  if (extra?.closed_reason) {
    lead.closed_reason = extra.closed_reason;
  }

  return lead;
}

/** 更新线索信息 */
export async function mockUpdateLead(leadId: string, data: Partial<Lead>): Promise<Lead | null> {
  await delay();
  const lead = LEADS.find((l) => l.id === leadId);
  if (!lead) return null;

  Object.assign(lead, data, { updated_at: dayjs().toISOString() });
  return lead;
}

/** 删除线索 */
export async function mockDeleteLead(leadId: string): Promise<boolean> {
  await delay();
  const idx = LEADS.findIndex((l) => l.id === leadId);
  if (idx < 0) return false;
  LEADS.splice(idx, 1);
  return true;
}

/** 更新试听预约 */
export async function mockUpdateLeadBooking(
  bookingId: string,
  data: {
    lessonDate?: string;
    startTime?: string;
    endTime?: string;
    courseName?: string;
    childName?: string;
    note?: string;
    teacherId?: string;
    difficulty?: LeadBookingDifficulty;
    room?: string;
    trialMode?: LeadBooking['trial_mode'];
  },
): Promise<LeadBooking | null> {
  await delay();
  const booking = LEAD_BOOKINGS.find((b) => b.id === bookingId);
  if (!booking) return null;

  if (data.lessonDate !== undefined) booking.lesson_date = data.lessonDate;
  if (data.startTime !== undefined) booking.start_time = data.startTime;
  if (data.endTime !== undefined) booking.end_time = data.endTime;
  if (data.courseName !== undefined) booking.course_name = data.courseName;
  if (data.childName !== undefined) booking.child_name = data.childName;
  if (data.note !== undefined) booking.note = data.note;
  if (data.teacherId !== undefined) booking.teacher_id = data.teacherId;
  if (data.difficulty !== undefined) booking.difficulty = data.difficulty;
  if (data.room !== undefined) booking.room = data.room;
  if (data.trialMode !== undefined) booking.trial_mode = data.trialMode;
  booking.updated_at = dayjs().toISOString();

  return booking;
}

// ============================================
// 试听预约
// ============================================

/** 创建试听预约 */
export async function mockCreateLeadBooking(params: {
  leadId: string;
  trialMode?: 'group' | 'private';
  referenceScheduleId?: string;
  timeOffsetMinutes?: number;
  classId?: string;
  className?: string;
  courseId: string;
  courseName: string;
  subjectId?: string;
  subjectName?: string;
  campusId: string;
  campusName?: string;
  teacherId: string;
  teacherName?: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  room?: string;
  bookingType: 'self' | 'proxy';
  operatorId?: string;
  note?: string;
}): Promise<LeadBooking> {
  await delay();

  const lead = LEADS.find((l) => l.id === params.leadId);
  const now = dayjs().toISOString();

  const booking: LeadBooking = {
    id: nextBookingId(),
    lead_id: params.leadId,
    trial_student_id: lead?.trial_student_id || '',
    trial_mode: params.trialMode || 'group',
    reference_schedule_id: params.referenceScheduleId,
    time_offset_minutes: params.timeOffsetMinutes,
    class_id: params.classId,
    class_name: params.className,
    course_id: params.courseId,
    course_name: params.courseName,
    subject_id: params.subjectId,
    subject_name: params.subjectName,
    campus_id: params.campusId,
    campus_name: params.campusName,
    teacher_id: params.teacherId,
    teacher_name: params.teacherName,
    lesson_date: params.lessonDate,
    start_time: params.startTime,
    end_time: params.endTime,
    room: params.room,
    status: 'confirmed',
    booking_type: params.bookingType,
    operator_id: params.operatorId,
    note: params.note,
    created_at: now,
    updated_at: now,
  };

  LEAD_BOOKINGS.push(booking);

  // 私教模式下更新独立试听时段的当前人数
  if (params.trialMode === 'private') {
    const slotConfig = TRIAL_SLOT_CONFIGS.find(
      (s) =>
        s.course_id === params.courseId &&
        s.lesson_date === params.lessonDate &&
        s.start_time === params.startTime,
    );
    if (slotConfig) {
      slotConfig.current_count = Math.min(slotConfig.current_count + 1, slotConfig.max_count);
    }
  }

  // 更新线索状态
  if (lead) {
    lead.status = 'booked';
    lead.booked_at = now;
    lead.booking_course_id = params.courseId;
    lead.updated_at = now;

    // 首次预约锁定归属
    if (!lead.booking_teacher_id) {
      lead.booking_teacher_id =
        params.bookingType === 'proxy' ? params.operatorId : lead.latest_invite_teacher_id;
      lead.owner_teacher_id = lead.booking_teacher_id;
      lead.owner_lock_status = 'locked';
      lead.owner_lock_reason = 'first_booking';
    }
  }

  return booking;
}

/** 根据班级快速预约试听（课表卡片入口） */
export async function mockBookTrialByClass(params: {
  leadId: string;
  classId: string;
  className?: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  teacherId?: string;
  teacherName?: string;
  operatorId?: string;
  note?: string;
}): Promise<LeadBooking> {
  await delay();

  const cls = CLASSES.find((c) => c.id === params.classId);
  const lead = LEADS.find((l) => l.id === params.leadId);

  return mockCreateLeadBooking({
    leadId: params.leadId,
    trialMode: 'group',
    referenceScheduleId: params.classId,
    classId: params.classId,
    className: params.className || cls?.name || '未命名班级',
    courseId: 'course-default',
    courseName: '体验课',
    campusId: cls?.campusId || lead?.campus_id || 'campus-center',
    // teacherId 使用 operatorId（用户ID），保证与 getLeadBookingsByTeacher 的查询参数一致
    teacherId:
      params.operatorId || params.teacherId || cls?.teacherId || lead?.owner_teacher_id || '',
    teacherName: params.teacherName,
    lessonDate: params.lessonDate,
    startTime: params.startTime,
    endTime: params.endTime,
    bookingType: 'proxy',
    operatorId: params.operatorId,
    note: params.note,
  });
}

/** 批量创建代约预约（会员+线索混合） */
export async function mockBatchCreateProxyBookings(params: {
  memberIds: string[];
  leadIds: string[];
  /** 会员消耗的课包映射：memberId -> packageId */
  memberPackages?: Record<string, string>;
  teacherId: string;
  teacherName?: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  courseId: string;
  courseName: string;
  campusId: string;
  trialMode?: 'group' | 'private';
  operatorId?: string;
  note?: string;
}): Promise<LeadBooking[]> {
  await delay();
  const bookings: LeadBooking[] = [];

  // 线索：直接创建预约
  for (const leadId of params.leadIds) {
    const booking = await mockCreateLeadBooking({
      leadId,
      trialMode: params.trialMode,
      courseId: params.courseId,
      courseName: params.courseName,
      campusId: params.campusId,
      teacherId: params.teacherId,
      teacherName: params.teacherName,
      lessonDate: params.lessonDate,
      startTime: params.startTime,
      endTime: params.endTime,
      bookingType: 'proxy',
      operatorId: params.operatorId,
      note: params.note,
    });
    bookings.push(booking);
  }

  // 会员：若该学生尚未有关联线索则自动创建一条临时线索，再创建预约
  for (const studentId of params.memberIds) {
    const student = STUDENTS.find((s) => s.id === studentId);
    if (!student) continue;

    const existingLead = LEADS.find(
      (l) =>
        l.child_name === student.name &&
        (l.owner_teacher_id === params.teacherId || l.creator_teacher_id === params.teacherId),
    );

    const lead: Lead = existingLead || {
      id: nextLeadId(),
      trial_student_id: nextTrialStudentId(),
      child_name: student.name,
      child_gender: student.gender === 'other' ? undefined : student.gender,
      child_age: student.birthday
        ? String(dayjs().diff(dayjs(student.birthday), 'year'))
        : undefined,
      parent_phone: student.phone,
      first_invite_teacher_id: params.teacherId,
      latest_invite_teacher_id: params.teacherId,
      owner_teacher_id: params.teacherId,
      creator_teacher_id: params.teacherId,
      campus_id: params.campusId || student.campusId,
      source_type: 'manual',
      source_channel: 'member_proxy_booking',
      owner_lock_status: 'locked',
      status: 'booked',
      duplicate_hint: false,
      weak_bind_parent: true,
      booked_at: dayjs().toISOString(),
      created_at: dayjs().toISOString(),
      updated_at: dayjs().toISOString(),
    };

    if (!existingLead) {
      LEADS.push(lead);
    } else {
      lead.status = 'booked';
      lead.booked_at = dayjs().toISOString();
      lead.updated_at = dayjs().toISOString();
    }

    // 消耗选中的课包（Mock 模式下直接扣减剩余课时）
    const packageId = params.memberPackages?.[studentId];
    if (packageId) {
      const pkg = COURSE_PACKAGES.find((p) => p.id === packageId);
      if (pkg && pkg.remainingHours > 0) {
        pkg.remainingHours -= 1;
        pkg.usedHours += 1;
      }
    }

    const booking = await mockCreateLeadBooking({
      leadId: lead.id,
      trialMode: params.trialMode,
      courseId: params.courseId,
      courseName: params.courseName,
      campusId: params.campusId,
      teacherId: params.teacherId,
      teacherName: params.teacherName,
      lessonDate: params.lessonDate,
      startTime: params.startTime,
      endTime: params.endTime,
      bookingType: 'proxy',
      operatorId: params.operatorId,
      note: params.note,
    });
    bookings.push(booking);
  }

  return bookings;
}

/** 获取线索的预约列表 */
export async function mockGetLeadBookings(leadId: string): Promise<LeadBooking[]> {
  await delay();
  return LEAD_BOOKINGS.filter((b) => b.lead_id === leadId);
}

/** 获取老师的所有试听预约 */
export async function mockGetLeadBookingsByTeacher(
  teacherId: string,
  params?: { startDate?: string; endDate?: string; status?: LeadBooking['status'] },
): Promise<LeadBooking[]> {
  await delay();
  return LEAD_BOOKINGS.filter((b) => {
    // 匹配登录用户 ID（user-teacher-xxx）或时段老师 ID（teacher-xxx）
    if (b.teacher_id !== teacherId && b.operator_id !== teacherId) return false;
    if (params?.startDate && b.lesson_date < params.startDate) return false;
    if (params?.endDate && b.lesson_date > params.endDate) return false;
    if (params?.status && b.status !== params.status) return false;
    return true;
  });
}

/** 取消试听预约 */
export async function mockCancelLeadBooking(bookingId: string): Promise<LeadBooking | null> {
  await delay();
  const booking = LEAD_BOOKINGS.find((b) => b.id === bookingId);
  if (!booking) return null;

  booking.status = 'cancelled';
  booking.updated_at = dayjs().toISOString();

  // 减少对应时段的已预约人数
  const slot = TRIAL_SLOT_CONFIGS.find(
    (s) =>
      s.teacher_id === booking.teacher_id &&
      s.lesson_date === booking.lesson_date &&
      s.start_time === booking.start_time &&
      s.end_time === booking.end_time,
  );
  if (slot && slot.current_count > 0) {
    slot.current_count -= 1;
    slot.updated_at = dayjs().toISOString();
  }

  // 更新线索状态为待预约
  const lead = LEADS.find((l) => l.id === booking.lead_id);
  if (lead && lead.status === 'booked') {
    // 检查是否还有其他有效预约
    const hasOtherBooking = LEAD_BOOKINGS.some(
      (b) => b.lead_id === lead.id && b.id !== bookingId && b.status === 'confirmed',
    );
    if (!hasOtherBooking) {
      lead.status = 'pending';
      lead.updated_at = dayjs().toISOString();
    }
  }

  return booking;
}

/** 恢复已取消的试听预约 */
export async function mockRestoreLeadBooking(bookingId: string): Promise<LeadBooking | null> {
  await delay();
  const booking = LEAD_BOOKINGS.find((b) => b.id === bookingId);
  if (!booking) return null;
  if (booking.status !== 'cancelled') return booking;

  booking.status = 'confirmed';
  booking.updated_at = dayjs().toISOString();

  // 恢复对应时段的已预约人数
  const slot = TRIAL_SLOT_CONFIGS.find(
    (s) =>
      s.teacher_id === booking.teacher_id &&
      s.lesson_date === booking.lesson_date &&
      s.start_time === booking.start_time &&
      s.end_time === booking.end_time,
  );
  if (slot) {
    slot.current_count += 1;
    slot.updated_at = dayjs().toISOString();
  }

  // 恢复线索状态为已预约
  const lead = LEADS.find((l) => l.id === booking.lead_id);
  if (lead && ['pending', 'following', 'not_arrived'].includes(lead.status)) {
    lead.status = 'booked';
    lead.updated_at = dayjs().toISOString();
  }

  return booking;
}

// ============================================
// 跟进记录
// ============================================

/** 获取线索的跟进记录 */
export async function mockGetLeadFollowUps(leadId: string): Promise<LeadFollowUp[]> {
  await delay();
  return LEAD_FOLLOW_UPS.filter((f) => f.lead_id === leadId);
}

/** 创建跟进记录 */
export async function mockCreateFollowUp(params: {
  leadId: string;
  action: LeadFollowUp['action'];
  intentLevel?: LeadFollowUp['intent_level'];
  content: string;
  nextFollowUpAt?: string;
  operatorId: string;
  operatorName?: string;
}): Promise<LeadFollowUp> {
  await delay();

  const followUp: LeadFollowUp = {
    id: nextFollowUpId(),
    lead_id: params.leadId,
    action: params.action,
    intent_level: params.intentLevel,
    content: params.content,
    next_follow_up_at: params.nextFollowUpAt,
    operator_id: params.operatorId,
    operator_name: params.operatorName,
    created_at: dayjs().toISOString(),
  };

  LEAD_FOLLOW_UPS.push(followUp);

  // 如果线索状态是 arrived/not_arrived，更新为 following
  const lead = LEADS.find((l) => l.id === params.leadId);
  if (lead && ['arrived', 'not_arrived'].includes(lead.status)) {
    lead.status = 'following';
    lead.updated_at = dayjs().toISOString();
  }

  return followUp;
}

// ============================================
// 转化记录
// ============================================

/** 获取线索的转化记录 */
export async function mockGetLeadConversions(leadId: string): Promise<LeadConversion[]> {
  await delay();
  return LEAD_CONVERSIONS.filter((c) => c.lead_id === leadId);
}

/** 创建转化记录（转正式学员） */
export async function mockCreateConversion(params: {
  leadId: string;
  conversionType: LeadConversion['conversion_type'];
  studentId: string;
  mergeToStudentId?: string;
  operatorId: string;
  note?: string;
}): Promise<LeadConversion> {
  await delay();

  const conversion: LeadConversion = {
    id: nextConversionId(),
    lead_id: params.leadId,
    conversion_type: params.conversionType,
    student_id: params.studentId,
    merge_to_student_id: params.mergeToStudentId,
    operator_id: params.operatorId,
    note: params.note,
    created_at: dayjs().toISOString(),
  };

  LEAD_CONVERSIONS.push(conversion);

  // 更新线索状态为已转化
  const lead = LEADS.find((l) => l.id === params.leadId);
  if (lead) {
    lead.status = 'converted';
    lead.converted_at = dayjs().toISOString();
    lead.updated_at = dayjs().toISOString();
  }

  return conversion;
}

// ============================================
// 可预约课程（试听专用）
// ============================================

/** 试听可预约课程 */
export interface TrialCourseSlot {
  id: string;
  courseId: string;
  courseName: string;
  subjectId?: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  campusId: string;
  campusName: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  room?: string;
  availableSlots: number;
  totalSlots: number;
}

// ============================================
// 独立试听时段配置 CRUD
// ============================================

/** 获取独立试听时段列表（老师查看自己创建的 + 管理员查看全部） */
export async function mockGetTrialSlotConfigs(
  teacherId?: string,
  campusId?: string,
): Promise<TrialSlotConfig[]> {
  await delay();

  let slots = TRIAL_SLOT_CONFIGS.filter((s) => s.status === 'active');

  if (teacherId) {
    slots = slots.filter((s) => s.creator_teacher_id === teacherId || s.teacher_id === teacherId);
  }

  if (campusId) {
    slots = slots.filter((s) => s.campus_id === campusId);
  }

  return slots.sort((a, b) => a.lesson_date.localeCompare(b.lesson_date));
}

/** 获取独立试听时段详情 */
export async function mockGetTrialSlotConfigById(id: string): Promise<TrialSlotConfig | null> {
  await delay();
  return TRIAL_SLOT_CONFIGS.find((s) => s.id === id) || null;
}

/** 创建独立试听时段 */
export async function mockCreateTrialSlotConfig(
  data: Omit<TrialSlotConfig, 'id' | 'current_count' | 'created_at' | 'updated_at'>,
): Promise<TrialSlotConfig> {
  await delay();

  const now = dayjs().toISOString();
  const config: TrialSlotConfig = {
    ...data,
    id: nextSlotConfigId(),
    current_count: 0,
    created_at: now,
    updated_at: now,
  };

  TRIAL_SLOT_CONFIGS.push(config);
  return config;
}

/** 更新独立试听时段 */
export async function mockUpdateTrialSlotConfig(
  id: string,
  data: Partial<TrialSlotConfig>,
): Promise<TrialSlotConfig | null> {
  await delay();

  const config = TRIAL_SLOT_CONFIGS.find((s) => s.id === id);
  if (!config) return null;

  Object.assign(config, data, { updated_at: dayjs().toISOString() });
  return config;
}

/** 删除独立试听时段 */
export async function mockDeleteTrialSlotConfig(id: string): Promise<boolean> {
  await delay();

  const idx = TRIAL_SLOT_CONFIGS.findIndex((s) => s.id === id);
  if (idx < 0) return false;

  TRIAL_SLOT_CONFIGS.splice(idx, 1);
  return true;
}

/** 获取试听可预约课程列表 */
export async function mockGetTrialCourseSlots(campusId?: string): Promise<TrialCourseSlot[]> {
  await delay();

  const today = dayjs();
  const slots: TrialCourseSlot[] = [];

  // 生成未来7天的可约时段
  for (let i = 1; i <= 7; i++) {
    const date = today.add(i, 'day');
    const dateStr = date.format('YYYY-MM-DD');
    const dayOfWeek = date.day() || 7;

    // 模拟每天有几个时段可约
    if (dayOfWeek <= 5) {
      slots.push(
        {
          id: `slot-piano-${dateStr}`,
          courseId: 'course-piano-01',
          courseName: '钢琴启蒙班',
          subjectId: 'subject-piano',
          subjectName: '钢琴',
          teacherId: 'user-teacher-001',
          teacherName: '王老师',
          campusId: 'campus-center',
          campusName: '中心校区',
          lessonDate: dateStr,
          startTime: '10:00',
          endTime: '11:00',
          room: '琴房A1',
          availableSlots: 3,
          totalSlots: 6,
        },
        {
          id: `slot-art-${dateStr}`,
          courseId: 'course-art-01',
          courseName: '创意美术班',
          subjectId: 'subject-art',
          subjectName: '美术',
          teacherId: 'user-teacher-002',
          teacherName: '李老师',
          campusId: 'campus-east',
          campusName: '东校区',
          lessonDate: dateStr,
          startTime: '14:00',
          endTime: '15:30',
          room: '画室B2',
          availableSlots: 5,
          totalSlots: 10,
        },
        {
          id: `slot-dance-${dateStr}`,
          courseId: 'course-dance-01',
          courseName: '少儿舞蹈班',
          subjectId: 'subject-dance',
          subjectName: '舞蹈',
          teacherId: 'user-teacher-003',
          teacherName: '赵老师',
          campusId: 'campus-center',
          campusName: '中心校区',
          lessonDate: dateStr,
          startTime: '16:00',
          endTime: '17:00',
          room: '舞蹈室C1',
          availableSlots: 2,
          totalSlots: 8,
        },
      );
    } else {
      slots.push({
        id: `slot-calligraphy-${dateStr}`,
        courseId: 'course-calligraphy-01',
        courseName: '书法入门班',
        subjectId: 'subject-calligraphy',
        subjectName: '书法',
        teacherId: 'user-teacher-001',
        teacherName: '王老师',
        campusId: 'campus-center',
        campusName: '中心校区',
        lessonDate: dateStr,
        startTime: '09:00',
        endTime: '10:30',
        room: '书法室D1',
        availableSlots: 4,
        totalSlots: 8,
      });
    }
  }

  if (campusId) {
    return slots.filter((s) => {
      if (campusId === 'campus-center') return s.campusName === '中心校区';
      if (campusId === 'campus-east') return s.campusName === '东校区';
      return true;
    });
  }

  return slots;
}
