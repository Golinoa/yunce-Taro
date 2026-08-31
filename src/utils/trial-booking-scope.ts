/**
 * 试听预约列表范围工具
 * actorId / 关联判定的真源见 related-booking-scope（多业务复用）
 */
import type { LeadBooking, LeadBookingStatus, TrialMode } from '@/types/lead';
import type { Profile } from '@/types/profile';
import { isPrincipalOrAbove, isStaffRole, isTeachingRole } from '@/utils/auth';
import { isUseMock } from '@/utils/build-env';
import {
  getProfileActorIds,
  isLeadBookingRelated,
  resolveTeachingActorId,
} from '@/utils/related-booking-scope';

export { getProfileActorIds, resolveTeachingActorId };

/** 试听预约状态文案 */
export const LEAD_BOOKING_STATUS_LABEL: Record<LeadBookingStatus, string> = {
  pending: '待确认',
  confirmed: '已预约',
  cancelled: '已取消',
  completed: '已完成',
  no_show: '未到店',
};

/** 状态标签样式（背景 / 文字） */
export function getLeadBookingStatusTone(status: LeadBookingStatus): {
  bg: string;
  text: string;
} {
  switch (status) {
    case 'confirmed':
      return { bg: 'bg-primary/10', text: 'text-primary' };
    case 'completed':
      return { bg: 'bg-success-bg', text: 'text-success' };
    case 'cancelled':
      return { bg: 'bg-muted', text: 'text-muted-foreground' };
    case 'no_show':
      return { bg: 'bg-destructive/10', text: 'text-destructive' };
    case 'pending':
    default:
      return { bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

/** 试听形态文案：跟班 / 半跟班 / 独立时段 */
export function getTrialFollowLabel(
  booking: Pick<LeadBooking, 'trial_mode' | 'time_offset_minutes'>,
): string {
  if (booking.trial_mode === 'private') return '独立时段';
  const offset = booking.time_offset_minutes ?? 0;
  if (offset === 0) return '跟班试听';
  if (offset < 0) return `半跟班 · 提前${Math.abs(offset)}分`;
  return `半跟班 · 延后${offset}分`;
}

export function getTrialModeShortLabel(mode: TrialMode): string {
  return mode === 'group' ? '班课试听' : '私教试听';
}

export type TrialBookingListMode = 'records' | 'mine';

/**
 * 按角色过滤试听预约列表
 * - records：试听记录（校长看校区，老师看本人相关）
 * - mine：我的预约（试听老师 / 代约人 / 线索归属老师）
 */
export function filterLeadBookingsByScope(
  bookings: LeadBooking[],
  profile: Profile | null | undefined,
  campusId: string | undefined,
  mode: TrialBookingListMode,
): LeadBooking[] {
  if (!profile) return [];

  const actorIds = getProfileActorIds(profile);
  const role = profile.currentContext?.role;

  if (!isStaffRole(role)) {
    return [];
  }

  if (mode === 'mine') {
    return bookings.filter((b) => isLeadBookingRelated(b, actorIds));
  }

  if (isPrincipalOrAbove(role)) {
    if (campusId) {
      return bookings.filter((b) => b.campus_id === campusId);
    }
    return bookings;
  }

  if (isTeachingRole(role)) {
    return bookings.filter((b) => isLeadBookingRelated(b, actorIds));
  }

  return [];
}

/** Mock 下校长/管理员按校区拉全量试听预约 */
export async function loadMockCampusLeadBookings(
  campusId?: string,
  params?: { startDate?: string; endDate?: string; status?: LeadBookingStatus },
): Promise<LeadBooking[]> {
  if (!isUseMock()) return [];
  const { loadLeadMock } = await import('@/utils/mock-loaders');
  const { mockListLeadBookingsByCampus } = await loadLeadMock();
  return mockListLeadBookingsByCampus(campusId, params);
}

export function sortLeadBookingsDesc(list: LeadBooking[]): LeadBooking[] {
  return [...list].sort((a, b) => {
    const dateCmp = b.lesson_date.localeCompare(a.lesson_date);
    if (dateCmp !== 0) return dateCmp;
    return b.start_time.localeCompare(a.start_time);
  });
}
