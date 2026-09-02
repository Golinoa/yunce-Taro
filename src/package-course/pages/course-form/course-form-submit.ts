/**
 * 课程表单提交载荷组装 / 分类切换提示（W2 拆页）
 */
import type { Class, ClassLevel } from '@/types/class';
import type { CheckinRole, CourseCategory, CourseTemplateFormData } from '@/types/course-template';
import { FORM_HEX_TO_CLASS_COLOR } from './course-form-constants';
import { durationToTimeRange } from './course-form-time';

export function getCategoryModeSwitchLosingFields(input: {
  isClassMode: boolean;
  teacherId: string;
  assistantId: string;
  studentIds: string[];
  experiencePrice: string;
  price: string;
  minOpenCount: string;
}): string[] {
  const losing: string[] = [];
  if (input.isClassMode && (input.teacherId || input.assistantId || input.studentIds.length > 0)) {
    losing.push('授课老师/助教/上课学员');
  }
  if (!input.isClassMode && (input.experiencePrice || input.price || input.minOpenCount)) {
    losing.push('价格/开课人数设置');
  }
  return losing;
}

export type BuildTemplateFormDataInput = {
  name: string;
  categoryId: string;
  category: CourseCategory;
  duration: string;
  capacity: string;
  color: string;
  subjectId: string;
  subjectName?: string;
  ageGroup: string;
  experiencePrice: string;
  price: string;
  minOpenCount: string;
  bookingDeadline: string;
  cancelQueueTime: string;
  nonCancelTime: string;
  autoCheckin: CourseTemplateFormData['autoCheckin'];
  studentSelfCheckin: CourseTemplateFormData['studentSelfCheckin'];
  allowCheckinRoles: CheckinRole[];
  level: string;
  description: string;
  backgroundImageUrl?: string;
  homeImageUrl?: string;
  isClassMode: boolean;
  teacherId: string;
  teacherName?: string;
  assistantId: string;
  assistantName?: string;
  studentIds: string[];
};

export function buildTemplateFormData(input: BuildTemplateFormDataInput): CourseTemplateFormData {
  return {
    name: input.name.trim(),
    categoryId: input.categoryId,
    category: input.category,
    duration: Number(input.duration),
    // 留空（前端空字符串）对应 0，表示「不限制人数」；填写时按正整数处理。
    capacity: input.capacity ? Number(input.capacity) : 0,
    color: input.color,
    subjectId: input.subjectId || undefined,
    subjectName: input.subjectName,
    ageGroup: input.ageGroup.startsWith('custom:')
      ? ('mix' as 'child' | 'teen' | 'adult' | 'mix')
      : (input.ageGroup as 'child' | 'teen' | 'adult' | 'mix'),
    customAgeGroup: input.ageGroup.startsWith('custom:')
      ? input.ageGroup.slice('custom:'.length)
      : undefined,
    // 按当前模式剥离：班课不提交价格类字段
    experiencePrice:
      !input.isClassMode && input.experiencePrice
        ? Math.round(Number(input.experiencePrice) * 100)
        : undefined,
    price: !input.isClassMode && input.price ? Math.round(Number(input.price) * 100) : undefined,
    minOpenCount: !input.isClassMode && input.minOpenCount ? Number(input.minOpenCount) : undefined,
    bookingDeadline: Number(input.bookingDeadline),
    cancelQueueTime: Number(input.cancelQueueTime),
    nonCancelTime: Number(input.nonCancelTime),
    autoCheckin: input.autoCheckin,
    studentSelfCheckin: input.studentSelfCheckin,
    allowCheckinRoles: input.allowCheckinRoles,
    level: input.level.startsWith('custom:')
      ? ('all' as 'all' | 'basic' | 'advanced' | 'expert')
      : (input.level as 'all' | 'basic' | 'advanced' | 'expert'),
    customLevel: input.level.startsWith('custom:')
      ? input.level.slice('custom:'.length)
      : undefined,
    description: input.description.trim() || undefined,
    backgroundImage: input.backgroundImageUrl,
    homeImage: input.homeImageUrl,
    // 按当前模式剥离：非班课不提交师生字段
    teacherId: input.isClassMode ? input.teacherId || undefined : undefined,
    teacherName: input.isClassMode && input.teacherId ? input.teacherName : undefined,
    assistantId: input.isClassMode ? input.assistantId || undefined : undefined,
    assistantName: input.isClassMode && input.assistantId ? input.assistantName : undefined,
    studentIds: input.isClassMode && input.studentIds.length > 0 ? input.studentIds : undefined,
  };
}

export type BuildClassPayloadInput = {
  name: string;
  color: string;
  teacherId: string;
  assistantId: string;
  categoryId: string;
  subjectId: string;
  level: string;
  description: string;
  minOpenCount: string;
  hoursPerLesson: string;
  feePerLesson: string;
  endClassEnabled: boolean;
  maxLessons: string;
  capacity: string;
  duration: string;
  studentIds: string[];
  campusId?: string;
  homeImageUrl?: string | null;
  backgroundImageUrl?: string | null;
};

export type ClassSavePayload = Partial<Class> & {
  capacity?: number;
  type: Class['type'];
  total_lessons?: number;
  start_time?: string;
  end_time?: string;
};

export function buildClassSavePayload(input: BuildClassPayloadInput): ClassSavePayload {
  const classColor = (FORM_HEX_TO_CLASS_COLOR[input.color] || 'primary') as Class['color'];
  const durationNum = Number(input.duration) || 60;
  const timeRange = durationToTimeRange(durationNum);
  return {
    name: input.name.trim(),
    color: classColor,
    teacher_id: input.teacherId,
    teachers: [input.teacherId, input.assistantId].filter(Boolean),
    category_id: input.categoryId || undefined,
    subject_id: input.subjectId || undefined,
    level: input.level.startsWith('custom:') ? 'all' : (input.level as ClassLevel),
    note: input.description.trim() || undefined,
    min_open_count: input.minOpenCount ? Number(input.minOpenCount) : undefined,
    hours_per_lesson: input.hoursPerLesson ? Number(input.hoursPerLesson) : 1,
    pricePerLesson: input.feePerLesson ? Number(input.feePerLesson) : 0,
    type: input.endClassEnabled ? 'limited' : 'unlimited',
    total_lessons: input.endClassEnabled ? Number(input.maxLessons) : undefined,
    capacity: input.capacity ? Number(input.capacity) : undefined,
    start_time: timeRange.start,
    end_time: timeRange.end,
    student_count: input.studentIds.length,
    status: 'active',
    campus_id: input.campusId || undefined,
    homeImage: input.homeImageUrl ?? null,
    backgroundImage: input.backgroundImageUrl ?? null,
  };
}
