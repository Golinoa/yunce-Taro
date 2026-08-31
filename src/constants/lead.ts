/**
 * 线索业务常量
 *
 * 这些常量被多个分包共享，必须放在主包可访问的位置。
 * 原先放在 types/lead.ts 中，但 types 文件被多个分包引用时可能导致 webpack
 * 将其误拆分进某个分包，从而引发分包加载时 "Cannot read properties of undefined" 错误。
 */
import type {
  FollowUpAction,
  IntentLevel,
  LeadBooking,
  LeadBookingStatus,
  LeadFilterTab,
  LeadSourceType,
  LeadStatus,
  TrialMode,
} from '@/types/lead';

/** 线索状态 → 显示文本 + 样式 */
export const LEAD_STATUS_META: Record<LeadStatus, { label: string; badgeClassName: string }> = {
  new: { label: '新建', badgeClassName: 'bg-[#eef0f2] text-[#8a8a8a]' },
  pending: { label: '待预约', badgeClassName: 'bg-[#fff3e5] text-[#f59e0b]' },
  booked: { label: '已预约', badgeClassName: 'bg-[#eaf6ff] text-[#3a8ee6]' },
  arrived: { label: '已到店', badgeClassName: 'bg-[#e9fbf4] text-[#10b981]' },
  not_arrived: { label: '未到店', badgeClassName: 'bg-[#fff0f1] text-[#ef4444]' },
  following: { label: '待跟进', badgeClassName: 'bg-[#f2edff] text-[#8b5cf6]' },
  converted: { label: '已转化', badgeClassName: 'bg-[#e9fbf4] text-[#10b981]' },
  closed: { label: '已关闭', badgeClassName: 'bg-[#eef0f2] text-[#8a8a8a]' },
};

/** 线索来源 → 显示文本 */
export const LEAD_SOURCE_META: Record<LeadSourceType, { label: string }> = {
  share_link: { label: '分享链接' },
  qr: { label: '扫码' },
  manual: { label: '手动录入' },
};

/** 线索筛选 Tab 选项（与卡片展示分类保持一致） */
export const LEAD_FILTER_TAB_OPTIONS: Array<{ key: LeadFilterTab; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'following', label: '待跟进' },
  { key: 'booked', label: '已预约' },
  { key: 'closed', label: '已流失' },
];

/** 跟进动作 → 显示文本 */
export const FOLLOW_UP_ACTION_META: Record<FollowUpAction, { label: string }> = {
  phone_call: { label: '电话回访' },
  wechat: { label: '微信追踪' },
  re_invite: { label: '再次邀约' },
  push_convert: { label: '转化推进' },
  other: { label: '其他' },
};

/** 意向等级 → 显示文本 + 样式 */
export const INTENT_LEVEL_META: Record<IntentLevel, { label: string; badgeClassName: string }> = {
  high: { label: '高意向', badgeClassName: 'bg-[#e9fbf4] text-[#10b981]' },
  medium: { label: '中意向', badgeClassName: 'bg-[#fff3e5] text-[#f59e0b]' },
  low: { label: '低意向', badgeClassName: 'bg-[#eef0f2] text-[#8a8a8a]' },
  none: { label: '无意向', badgeClassName: 'bg-[#fff0f1] text-[#ef4444]' },
};

/** 试听模式 → 显示文本 + 样式（与试听记录卡片口径对齐） */
export const TRIAL_MODE_META: Record<TrialMode, { label: string; badgeClassName: string }> = {
  group: { label: '跟班试听', badgeClassName: 'bg-muted text-muted-foreground' },
  private: { label: '一对一', badgeClassName: 'bg-muted text-muted-foreground' },
};

/**
 * 试听预约状态标签（线索详情 / 试听记录共用）
 * 实色底 + 边框，避免小程序主题 token 导致文字不可见
 */
export const LEAD_BOOKING_STATUS_META: Record<
  LeadBookingStatus,
  { label: string; className: string }
> = {
  pending: {
    label: '待确认',
    className: 'bg-[#f3f4f6] text-[#6b7280] border border-[#d1d5db]',
  },
  confirmed: {
    label: '已预约',
    className: 'bg-[#eff6ff] text-[#2563eb] border border-[#93c5fd]',
  },
  completed: {
    label: '已完成',
    className: 'bg-[#ecfdf5] text-[#059669] border border-[#6ee7b7]',
  },
  no_show: {
    label: '未到店',
    className: 'bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5]',
  },
  cancelled: {
    label: '已取消',
    className: 'bg-[#f3f4f6] text-[#6b7280] border border-[#d1d5db]',
  },
};

/** 试听模式标签 pill 样式（线索详情 / 试听记录共用） */
export const LEAD_BOOKING_MODE_BADGE_CLASS = 'rounded-full bg-muted px-[12rpx] py-[4rpx]';

/** 仅两种形态：一对一 / 跟班试听 */
export function getLeadBookingModeLabel(
  item: Pick<LeadBooking, 'trial_mode'>,
): string {
  return item.trial_mode === 'private' ? '一对一' : '跟班试听';
}
