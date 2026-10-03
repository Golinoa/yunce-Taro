/**
 * 收费方式选项（发会员卡 / 追加次数 共用）。
 *
 * 口径（2026-10-03 用户拍板）：固定五项，**不做输入框自由填写**，
 * 默认选中「其他」，避免出现「转账 / 挂账 / 欠条」这类看不懂也不便统计的说法。
 *
 * ⚠️ value 需与后端 `MemberCardAdjustment.feeMethod` / 账本枚举保持一致，
 *    记录页 `FEE_METHOD_LABEL` 也据此映射（见 package-course/pages/recharge-records）。
 */
export const PAYMENT_METHOD_OPTIONS = [
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
  { value: 'bank_card', label: '银行卡' },
  { value: 'cash', label: '现金' },
  { value: 'other', label: '其他' },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHOD_OPTIONS)[number]['value'];

/** 默认收费方式：其他 */
export const DEFAULT_PAYMENT_METHOD: PaymentMethodValue = 'other';

const VALUE_SET = new Set<string>(PAYMENT_METHOD_OPTIONS.map((item) => item.value));

export const isPaymentMethodValue = (raw: string): raw is PaymentMethodValue => VALUE_SET.has(raw);

/** 展示文案：未知值兜底为「其他」，不把内部枚举裸露给用户 */
export const paymentMethodLabel = (raw?: string | null): string =>
  PAYMENT_METHOD_OPTIONS.find((item) => item.value === raw)?.label ?? '其他';
