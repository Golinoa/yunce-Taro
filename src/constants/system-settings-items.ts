/**
 * 系统设置入口清单（真源，供页面与单测共用）
 */

export interface SystemSettingItemDef {
  title: string;
  route: string;
  adminOnly?: boolean;
  managerOnly?: boolean;
  hideForParent?: boolean;
}

export const SYSTEM_SETTING_ITEMS: SystemSettingItemDef[] = [
  {
    title: '操作日志',
    route: '/package-settings/pages/audit-log/index',
    hideForParent: true,
  },
  {
    title: '主题颜色',
    route: '/package-settings/pages/theme-settings/index',
  },
  {
    title: '约课规则',
    route: '/package-course/pages/booking-rule/index',
    managerOnly: true,
  },
  {
    title: '待办提醒',
    route: '/package-settings/pages/todo-settings/index',
    managerOnly: true,
  },
  {
    title: '角色称呼',
    route: '/package-settings/pages/role-titles/index',
    adminOnly: true,
  },
  {
    title: '角色权限',
    route: '/package-settings/pages/permission-settings/index',
    adminOnly: true,
  },
  {
    title: '定时备份',
    route: '',
    adminOnly: true,
  },
  {
    title: '用户协议',
    route: '/package-settings/pages/agreement/index',
  },
  {
    title: '重置新手引导',
    route: '__reset_onboarding__',
    adminOnly: true,
  },
];
