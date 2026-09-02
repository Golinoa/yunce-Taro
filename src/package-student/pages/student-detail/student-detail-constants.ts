/**
 * 学员详情页常量与状态映射
 *
 * 使用场景：student-detail 页 Tab / 卡包子 Tab / 请假与会员卡展示文案。
 * 功能说明：集中字面量与样式 class，避免主文件堆常量。
 */
import type { LeaveStatus } from '@/types/leave-request';
import type { MemberCardStatus } from '@/types/member-card';

export type TabKey = 'profile' | 'consumption' | 'packages' | 'records' | 'follow';

export const STUDENT_DETAIL_TABS: { key: TabKey; label: string }[] = [
  { key: 'profile', label: '资料' },
  { key: 'consumption', label: '课程消耗' },
  { key: 'packages', label: '卡包' },
  { key: 'records', label: '出勤' },
  { key: 'follow', label: '跟进' },
];

export const STUDENT_DETAIL_TAB_INDEX_MAP: Record<TabKey, number> = {
  profile: 0,
  consumption: 1,
  packages: 2,
  records: 3,
  follow: 4,
};

export const STUDENT_DETAIL_SWIPER_DURATION = 280;

/** 请假状态映射 */
export const LEAVE_STATUS_MAP: Record<LeaveStatus, { label: string; className: string }> = {
  pending: { label: '待审批', className: 'bg-warning/15 text-warning' },
  approved: { label: '已通过', className: 'bg-primary-15 text-primary' },
  rejected: { label: '已拒绝', className: 'bg-destructive-10 text-destructive' },
};

/** 会员卡状态映射 */
export const MEMBER_CARD_STATUS_MAP: Record<MemberCardStatus, { label: string; color: string }> = {
  active: { label: '使用中', color: 'text-primary' },
  inactive: { label: '无效卡', color: 'text-muted-foreground' },
  usedUp: { label: '无效卡', color: 'text-muted-foreground' },
  notActivated: { label: '未开卡', color: 'text-warning' },
  frozen: { label: '暂停卡', color: 'text-warning' },
};

/** 会员卡高对比度背景色（用于卡包列表卡片） */
export const MEMBER_CARD_BG_MAP: Record<MemberCardStatus, string> = {
  active: 'bg-gradient-primary',
  notActivated: 'bg-class-info',
  frozen: 'bg-card-gray',
  inactive: 'bg-kpi-red',
  usedUp: 'bg-finance-dark',
};

/** 会员卡状态蒙层（在背景上加一层，强化视觉区分） */
export const MEMBER_CARD_OVERLAY_MAP: Record<MemberCardStatus, string> = {
  active: '',
  notActivated: '',
  frozen: 'bg-black/10',
  inactive: 'bg-black/10',
  usedUp: 'bg-black/15',
};

/** 卡包二级 Tab */
export type CardSubTabKey = 'active' | 'frozen' | 'notActivated' | 'inactive';

export const CARD_SUB_TABS: { key: CardSubTabKey; label: string }[] = [
  { key: 'active', label: '使用中' },
  { key: 'frozen', label: '暂停卡' },
  { key: 'notActivated', label: '未开卡' },
  { key: 'inactive', label: '无效卡' },
];

/** 课包状态映射（课程消耗展示用） */
export const PACKAGE_STATUS_MAP: Record<string, { label: string; className: string }> = {
  active: { label: '使用中', className: 'bg-primary-15 text-primary' },
  completed: { label: '已用完', className: 'bg-muted text-muted-foreground' },
  expired: { label: '已过期', className: 'bg-destructive-10 text-destructive' },
};
