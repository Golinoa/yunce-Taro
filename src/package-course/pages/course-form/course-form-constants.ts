/**
 * 课程表单常量 / 类型（W2 拆页）
 */
import type { CheckinRole } from '@/types/course-template';

/** 班级色 key → 课程模板色值（统一色板 classColorHex，班级模式回填用） */
export const CLASS_COLOR_TO_FORM_HEX: Record<string, string> = {
  primary: '#5EC8A8',
  red: '#E57373',
  amber: '#D4A24E',
  purple: '#9B7ED8',
  info: '#6BA3D6',
  teal: '#4FC3B7',
};

/** 课程模板色值 → 班级色 key（班级模式保存回班级用） */
export const FORM_HEX_TO_CLASS_COLOR: Record<string, string> = {
  '#5EC8A8': 'primary',
  '#E57373': 'red',
  '#D4A24E': 'amber',
  '#9B7ED8': 'purple',
  '#6BA3D6': 'info',
  '#4FC3B7': 'teal',
};

/** 表单字段错误 */
export interface FormErrors {
  name?: string;
  categoryId?: string;
  subjectId?: string;
  duration?: string;
  capacity?: string;
  maxLessons?: string;
  experiencePrice?: string;
  price?: string;
}

export type PickerType =
  | 'category'
  | 'subject'
  | 'teacher'
  | 'assistant'
  | 'ageGroup'
  | 'deadline'
  | 'cancelQueue'
  | 'nonCancel'
  | 'selfCheckin'
  | 'level'
  | 'autoCheckin';

/** Tooltip 提示文案 */
export const TOOLTIPS: Record<string, string> = {
  price:
    '该课程的单次约课收费价格，用于非会员通过小程序按次付费场景，该价格也是次卡、储值卡计算单节耗卡价格的依据。',
  color: '用于在课表中区分不同课程，建议不同课程使用不同颜色。',
  selfCheckin: '开启后，学员签到时需在场馆附近一定距离内才能操作，防止未到店签到。',
  autoCheckin: '开启后，系统会在课程结束后自动为已预约学员完成签到。',
  allowCheckinRoles:
    '未勾选的角色在该课程的签到台仅可查看，不能签到/取消签到；被关闭签到的角色代约时不会自动签到。',
};

/** 课程模式展示名（class=班课 / group=团课 / private=私教） */
export const COURSE_MODE_LABELS: Record<string, string> = {
  class: '班课',
  group: '团课',
  private: '私教',
};

export type AutoCheckinValue = 'follow_category' | 'allow' | 'forbid';
export type StudentSelfCheckinValue = 'follow_category' | 'allow' | 'forbid';

export type CourseFormDirtySnapshot = {
  name: string;
  categoryId: string;
  duration: string;
  capacity: string;
  /** 结束班级开关（班课保存载荷字段，须参与未保存检测） */
  endClassEnabled: boolean;
  /** 上限课时（与 endClassEnabled 联动） */
  maxLessons: string;
  color: string;
  subjectId: string;
  ageGroup: string;
  customAgeGroups: string[];
  experiencePrice: string;
  price: string;
  minOpenCount: string;
  bookingDeadline: string;
  cancelQueueTime: string;
  nonCancelTime: string;
  autoCheckin: AutoCheckinValue;
  studentSelfCheckin: StudentSelfCheckinValue;
  allowCheckinRoles: CheckinRole[];
  level: string;
  customLevels: string[];
  description: string;
  backgroundImage: string;
  homeImage: string;
  teacherId: string;
  assistantId: string;
  studentIds: string[];
  hoursPerLesson: string;
  feePerLesson: string;
};

/** 序列化表单快照，供未保存离开检测比较 */
export function buildCourseFormDirtyKey(snapshot: CourseFormDirtySnapshot): string {
  return JSON.stringify(snapshot);
}
