import { LEAD_BOOKING_STATUS_META } from '@/constants/lead';
import type { MyBookingSourceType, MyBookingStatus } from '@/types/my-booking';

/** 状态筛选项（默认选中 confirmed / 已预约） */
export const MY_BOOKING_STATUS_TABS: { key: 'all' | MyBookingStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待确认' },
  { key: 'confirmed', label: '已预约' },
  { key: 'completed', label: '已完成' },
  { key: 'no_show', label: '未到' },
  { key: 'cancelled', label: '已取消' },
];

/** 复用试听状态实色标签 */
export const MY_BOOKING_STATUS_META = LEAD_BOOKING_STATUS_META;

/** 类型标签文案（灰底 pill） */
export const MY_BOOKING_TYPE_LABEL: Record<MyBookingSourceType, string> = {
  trial_group: '试听·跟班',
  trial_private: '试听·一对一',
  class_open: '团课',
  group: '团课',
  private: '私教',
  venue: '场地',
};

export const MY_BOOKING_TYPE_BADGE_CLASS = 'rounded-full bg-muted px-[12rpx] py-[4rpx]';
