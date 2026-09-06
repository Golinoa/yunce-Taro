/** 教师/薪资 UI 常量（与 mock 数据分离） */
import type { TeacherIdentity } from '@/types/teacher';

/** 头像颜色池 */
export const AVATAR_COLORS = [
  '#5EC8A8',
  '#E89BB8',
  '#6BA3D6',
  '#D4A24E',
  '#9B7ED8',
  '#F0A0A0',
  '#7BC8E8',
  '#B8D45E',
];

/** 校区列表 */
export const CAMPUS_OPTIONS = [
  { label: '全部校区', value: 'all' },
  { label: '曦绘艺术', value: 'center' },
  { label: '南区分校', value: 'south' },
  { label: '东区分校', value: 'east' },
];

/** 科目列表 */
export const SUBJECT_OPTIONS = [
  { label: '全部科目', value: 'all' },
  { label: '钢琴', value: 'piano' },
  { label: '声乐', value: 'vocal' },
  { label: '乐理', value: 'theory' },
  { label: '书法', value: 'calligraphy' },
  { label: '美术', value: 'art' },
  { label: '吉他', value: 'guitar' },
  { label: '舞蹈', value: 'dance' },
  { label: '架子鼓', value: 'drum' },
  { label: '小提琴', value: 'violin' },
];

/** 角色选项 */
export const ROLE_OPTIONS = [
  { label: '全部岗位', value: 'all' },
  { label: '主讲', value: 'lead' },
  { label: '助教', value: 'assist' },
  { label: '兼职', value: 'parttime' },
];

/** 状态选项 */
export const STATUS_OPTIONS = [
  { label: '在职', value: 'active' },
  { label: '已离职', value: 'resigned' },
  { label: '全部状态', value: 'all' },
];

/** 员工身份预设选项（店长=校区管理岗 Org ADMIN，≠ 机构 OWNER「管理员」） */
export const TEACHER_IDENTITY_OPTIONS = [
  { label: '店长', value: 'principal' },
  { label: '老师', value: 'teacher' },
  { label: '助教', value: 'assistant' },
  { label: '前台', value: 'reception' },
];

/** 性别选项 */
export const GENDER_OPTIONS = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '保密', value: 'other' },
];

/** 身份标签色（bg 用 UnoCSS rules 定义的安全类名，text 色需在 Text 元素上单独设置） */
export const IDENTITY_TAG_MAP: Record<TeacherIdentity, { bg: string; text: string }> = {
  principal: { bg: 'bg-warning-bg', text: 'text-warning' },
  teacher: { bg: 'bg-success-bg', text: 'text-success' },
  assistant: { bg: 'bg-info-bg', text: 'text-info' },
  reception: { bg: 'bg-primary-10', text: 'text-primary' },
};
