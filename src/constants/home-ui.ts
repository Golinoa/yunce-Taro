import { COURSE_MANAGEMENT_CLASS_TAB_URL } from '@/constants/course-category-ui';

export interface HomeQuickEntry {
  label: string;
  icon: string;
  color: string;
  url: string;
}

/** 首页快捷入口（生产 / Mock 共用） */
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
    label: '考勤记录',
    icon: 'mdi-clipboard-text',
    color: 'icon-glass-blue',
    url: '/package-teacher/pages/attendance/index',
  },
  {
    label: '试听记录',
    icon: 'mdi-clock-outline',
    color: 'icon-glass-purple',
    url: '/package-lead/pages/trial-records/index',
  },
  {
    label: '充值记录',
    icon: 'mdi-cash-multiple',
    color: 'icon-glass-red',
    url: '/package-course/pages/recharge-records/index',
  },
  {
    label: '班级管理',
    icon: 'mdi-school',
    color: 'icon-glass-blue',
    url: COURSE_MANAGEMENT_CLASS_TAB_URL,
  },
  {
    label: '教师管理',
    icon: 'mdi-account-supervisor',
    color: 'icon-glass-purple',
    url: '/package-teacher/pages/teacher-list/index',
  },
  {
    label: '校区设置',
    icon: 'mdi-map-marker',
    color: 'icon-glass-violet',
    url: '/package-settings/pages/campus-settings/index',
  },
];
