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

/** 试听模式 → 显示文本 + 样式 */
export const TRIAL_MODE_META: Record<TrialMode, { label: string; badgeClassName: string }> = {
  group: { label: '团课试听', badgeClassName: 'bg-primary/10 text-primary' },
  private: { label: '私教试听', badgeClassName: 'bg-accent/10 text-accent' },
};
