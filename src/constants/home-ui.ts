import { HOME_TILE_IMAGE_BASE } from '@/constants/brand';

export interface HomeQuickEntry {
  label: string;
  /** mdi 回退图标 */
  icon: string;
  /** 3D 瓷片图（优先展示）；为空则走 mdi 渐变 */
  image?: string;
  color: string;
  url: string;
}

/**
 * 瓷片 3D 图 URL（主包本地 PNG，144px 量化 128 色，三张合计约 11.8KB）。
 * 基址为空或文件缺失 → 返回空串 → 消费方按「无图」处理并回退 mdi 渐变图标。
 *
 * 说明：**只有顶部三张大瓷片用图**；金刚区 8 个入口已统一改为 mdi 渐变图标
 * （与「添加学员」同款，见 KingKongSection 的 grid 分支）。
 */
const tileImage = (file: string): string =>
  HOME_TILE_IMAGE_BASE ? `${HOME_TILE_IMAGE_BASE}/${file}` : '';

/** 顶部三张大瓷片的 3D 图标（与 KingKongSection 的 TRIPLE_CARD_CONFIG 对应） */
export const HOME_TILE_3D = {
  calendarCheck: tileImage('icon-calendar-check.png'),
  rocket: tileImage('icon-rocket.png'),
  users: tileImage('icon-users.png'),
} as const;

/** 家长端首页金刚区（生产 / Mock 共用） */
export const PARENT_HOME_QUICK_ENTRIES: HomeQuickEntry[] = [
  {
    label: '请假',
    icon: 'mdi-calendar-blank-outline',
    color: 'icon-glass-red',
    url: '/package-course/pages/leave-request/index',
  },
  {
    label: '我要约课',
    icon: 'mdi-calendar-check',
    color: 'icon-glass-orange',
    url: '/pages/schedule/index',
  },
  {
    label: '我的课表',
    icon: 'mdi-calendar-clock',
    color: 'icon-glass-blue',
    url: '#parent-schedule',
  },
  {
    label: '我的课时',
    icon: 'mdi-clock-outline',
    color: 'icon-glass-purple',
    url: '#parent-hours',
  },
  {
    label: '上课记录',
    icon: 'mdi-clipboard-text',
    color: 'icon-glass-red',
    url: '/package-course/pages/records/index',
  },
  {
    label: '课后作业',
    icon: 'mdi-notebook-edit-outline',
    color: 'icon-glass-blue',
    url: '/package-course/pages/parent-lesson-notes/index?type=homework',
  },
  {
    label: '课堂点评',
    icon: 'mdi-message-text-outline',
    color: 'icon-glass-purple',
    url: '/package-course/pages/parent-lesson-notes/index?type=comments',
  },
  {
    label: '成长档案',
    icon: 'mdi-account-child',
    color: 'icon-glass-violet',
    url: '/package-student/pages/children/index',
  },
];

/** 教师/助教首页金刚区：教学主路径（今日课/待办/消课已在 Tab） */
export const TEACHER_HOME_QUICK_ENTRIES: HomeQuickEntry[] = [
  {
    label: '学员',
    icon: 'mdi-account-group',
    color: 'icon-glass-orange',
    url: '/package-student/pages/students/index',
  },
  {
    label: '添加学员',
    icon: 'mdi-account-plus',
    color: 'icon-glass-red',
    url: '/package-student/pages/student-form/index',
  },
  {
    label: '上课记录',
    icon: 'mdi-clipboard-text',
    color: 'icon-glass-blue',
    url: '/package-course/pages/records/index',
  },
  {
    label: '意向学员',
    icon: 'mdi-account-heart',
    color: 'icon-glass-violet',
    url: '/package-lead/pages/my-invite/index',
  },
  {
    label: '试听记录',
    icon: 'mdi-clock-outline',
    color: 'icon-glass-purple',
    url: '/package-lead/pages/trial-records/index',
  },
  {
    label: '续费提醒',
    icon: 'mdi-alarm',
    color: 'icon-glass-blue',
    url: '/package-student/pages/renewal-reminder/index',
  },
];

/** 校长/管理员首页快捷入口（含教务工具） */
export const HOME_QUICK_ENTRIES: HomeQuickEntry[] = [
  {
    label: '课时充值',
    icon: 'mdi-cash-plus',
    color: 'icon-glass-red',
    url: '/package-course/pages/package-form/index',
  },
  {
    label: '添加学员',
    icon: 'mdi-account-plus',
    color: 'icon-glass-orange',
    url: '/package-student/pages/student-form/index',
  },
  {
    label: '上课记录',
    icon: 'mdi-clipboard-text',
    color: 'icon-glass-blue',
    url: '/package-course/pages/records/index',
  },
  {
    label: '试听记录',
    icon: 'mdi-clock-outline',
    color: 'icon-glass-purple',
    url: '/package-lead/pages/trial-records/index',
  },
  {
    label: '充值记录',
    icon: 'mdi-history',
    color: 'icon-glass-red',
    url: '/package-course/pages/recharge-records/index',
  },
  {
    label: '考勤异常',
    icon: 'mdi-shield-alert',
    color: 'icon-glass-blue',
    url: '/package-student/pages/attendance-anomaly/index',
  },
  {
    label: '续费提醒',
    icon: 'mdi-alarm',
    color: 'icon-glass-purple',
    url: '/package-student/pages/renewal-reminder/index',
  },
  {
    label: '意向学员',
    icon: 'mdi-account-heart',
    color: 'icon-glass-violet',
    url: '/package-lead/pages/my-invite/index',
  },
];
