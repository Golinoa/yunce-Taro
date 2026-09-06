import { MEDIA_IMAGE_BASE } from '@/constants/brand';

export interface HomeQuickEntry {
  label: string;
  /** mdi 回退图标 */
  icon: string;
  /** 3D 瓷片图（优先展示） */
  image?: string;
  color: string;
  url: string;
}

/** 首页瓷片区 3D 图标（src/assets/images/icon-*.webp） */
export const HOME_TILE_3D = {
  book: `${MEDIA_IMAGE_BASE}/icon-book.webp`,
  calendarCheck: `${MEDIA_IMAGE_BASE}/icon-calendar-check.webp`,
  crown: `${MEDIA_IMAGE_BASE}/icon-crown.webp`,
  customerService: `${MEDIA_IMAGE_BASE}/icon-customer-service.webp`,
  lightning: `${MEDIA_IMAGE_BASE}/icon-lightning.webp`,
  rocket: `${MEDIA_IMAGE_BASE}/icon-rocket.webp`,
  users: `${MEDIA_IMAGE_BASE}/icon-users.webp`,
  walletPink: `${MEDIA_IMAGE_BASE}/icon-wallet-pink.webp`,
  walletPurple: `${MEDIA_IMAGE_BASE}/icon-wallet-purple.webp`,
  walletYen: `${MEDIA_IMAGE_BASE}/icon-wallet-yen.webp`,
} as const;

/** 家长端首页金刚区（生产 / Mock 共用） */
export const PARENT_HOME_QUICK_ENTRIES: HomeQuickEntry[] = [
  {
    label: '请假',
    icon: 'mdi-calendar-blank-outline',
    image: HOME_TILE_3D.lightning,
    color: 'icon-glass-red',
    url: '/package-course/pages/leave-request/index',
  },
  {
    label: '我要约课',
    icon: 'mdi-calendar-check',
    image: HOME_TILE_3D.rocket,
    color: 'icon-glass-orange',
    url: '/pages/schedule/index',
  },
  {
    label: '我的课表',
    icon: 'mdi-calendar-clock',
    image: HOME_TILE_3D.calendarCheck,
    color: 'icon-glass-blue',
    url: '#parent-schedule',
  },
  {
    label: '我的课时',
    icon: 'mdi-clock-outline',
    image: HOME_TILE_3D.walletYen,
    color: 'icon-glass-purple',
    url: '#parent-hours',
  },
  {
    label: '上课记录',
    icon: 'mdi-clipboard-text',
    image: HOME_TILE_3D.book,
    color: 'icon-glass-red',
    url: '/package-course/pages/records/index',
  },
  {
    label: '课后作业',
    icon: 'mdi-notebook-edit-outline',
    image: HOME_TILE_3D.walletPurple,
    color: 'icon-glass-blue',
    url: '/package-course/pages/parent-lesson-notes/index?type=homework',
  },
  {
    label: '课堂点评',
    icon: 'mdi-message-text-outline',
    image: HOME_TILE_3D.customerService,
    color: 'icon-glass-purple',
    url: '/package-course/pages/parent-lesson-notes/index?type=comments',
  },
  {
    label: '成长档案',
    icon: 'mdi-account-child',
    image: HOME_TILE_3D.crown,
    color: 'icon-glass-violet',
    url: '/package-student/pages/children/index',
  },
];

/** 教师/助教首页金刚区：教学主路径（今日课/待办/消课已在 Tab） */
export const TEACHER_HOME_QUICK_ENTRIES: HomeQuickEntry[] = [
  {
    label: '学员',
    icon: 'mdi-account-group',
    image: HOME_TILE_3D.users,
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
    image: HOME_TILE_3D.book,
    color: 'icon-glass-blue',
    url: '/package-course/pages/records/index',
  },
  {
    label: '意向学员',
    icon: 'mdi-account-heart',
    image: HOME_TILE_3D.customerService,
    color: 'icon-glass-violet',
    url: '/package-lead/pages/my-invite/index',
  },
  {
    label: '试听记录',
    icon: 'mdi-clock-outline',
    image: HOME_TILE_3D.calendarCheck,
    color: 'icon-glass-purple',
    url: '/package-lead/pages/trial-records/index',
  },
  {
    label: '续费提醒',
    icon: 'mdi-alarm',
    image: HOME_TILE_3D.walletPink,
    color: 'icon-glass-blue',
    url: '/package-student/pages/renewal-reminder/index',
  },
];

/** 校长/管理员首页快捷入口（含教务工具） */
export const HOME_QUICK_ENTRIES: HomeQuickEntry[] = [
  {
    label: '课时充值',
    icon: 'mdi-cash-plus',
    image: HOME_TILE_3D.walletYen,
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
    image: HOME_TILE_3D.book,
    color: 'icon-glass-blue',
    url: '/package-course/pages/records/index',
  },
  {
    label: '试听记录',
    icon: 'mdi-clock-outline',
    image: HOME_TILE_3D.calendarCheck,
    color: 'icon-glass-purple',
    url: '/package-lead/pages/trial-records/index',
  },
  {
    label: '充值记录',
    icon: 'mdi-history',
    image: HOME_TILE_3D.walletPurple,
    color: 'icon-glass-red',
    url: '/package-course/pages/recharge-records/index',
  },
  {
    label: '考勤异常',
    icon: 'mdi-shield-alert',
    image: HOME_TILE_3D.lightning,
    color: 'icon-glass-blue',
    url: '/package-student/pages/attendance-anomaly/index',
  },
  {
    label: '续费提醒',
    icon: 'mdi-alarm',
    image: HOME_TILE_3D.walletPink,
    color: 'icon-glass-purple',
    url: '/package-student/pages/renewal-reminder/index',
  },
  {
    label: '意向学员',
    icon: 'mdi-account-heart',
    image: HOME_TILE_3D.users,
    color: 'icon-glass-violet',
    url: '/package-lead/pages/my-invite/index',
  },
];
