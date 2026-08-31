import type { FeeMethod, PackageType } from '@/types/course-package';

/** 页面主 Tab：课时充值 / 发会员卡 */
export type PageTab = 'recharge' | 'card';
/** 课时充值子模式：按课包 / 单独输入课时 */
export type RechargeMode = 'package' | 'direct';

export type PackageTypeIconInfo = {
  icon: string;
  colorClass: string;
  bgClass: string;
  label: string;
};

export type FeeMethodOption = { key: FeeMethod; label: string };

/**
 * 注意：本文件只导出「函数」，不要导出模块级数组/对象常量。
 * Taro/webpack 作用域提升后，模块级绑定会与 hook 内解构变量撞名，
 * 导致运行时把 usePackageForm 等覆盖成字符串，页面白屏。
 */
export function getQuickHours(): number[] {
  return [10, 16, 24, 36, 48];
}

export function getGiftOptions(): number[] {
  return [0, 1, 2, 4];
}

export function getFeeMethodOptions(): FeeMethodOption[] {
  return [
    { key: 'wechat', label: '微信' },
    { key: 'alipay', label: '支付宝' },
    { key: 'cash', label: '现金' },
    { key: 'transfer', label: '转账' },
    { key: 'other', label: '其他' },
  ];
}

export function getTypeIconMap(): Record<PackageType, PackageTypeIconInfo> {
  return {
    hour_package: {
      icon: '📚',
      colorClass: 'text-success',
      bgClass: 'bg-success-bg',
      label: '课时包',
    },
    term: { icon: '📅', colorClass: 'text-amber', bgClass: 'bg-warning-bg', label: '期课' },
    monthly: { icon: '🔄', colorClass: 'text-accent', bgClass: 'bg-accent-bg', label: '月卡' },
    trial: { icon: '🎁', colorClass: 'text-info', bgClass: 'bg-info-bg', label: '体验课' },
  };
}
