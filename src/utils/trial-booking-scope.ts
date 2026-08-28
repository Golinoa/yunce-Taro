import type { LeadBooking, LeadBookingStatus } from '@/types/lead';
import type { Profile } from '@/types/profile';
import { isPrincipalOrAbove, isStaffRole, isTeachingRole } from '@/utils/auth';
import { isUseMock } from '@/utils/build-env';

/** 试听预约状态文案 */
export const LEAD_BOOKING_STATUS_LABEL: Record<LeadBookingStatus, string> = {
  pending: '待确认',
  confirmed: '已预约',
  cancelled: '已取消',
  completed: '已完成',
  no_show: '未到店',
};

export type TrialBookingListMode = 'records' | 'mine';

/**
 * 按角色过滤试听预约列表
 * - records：试听记录（校长看校区，老师看本人相关）
 * - mine：我的预约（仅与当前账号直接关联）
 */
export function filterLeadBookingsByScope(
  bookings: LeadBooking[],
  profile: Profile | null | undefined,
  campusId: string | undefined,
  mode: TrialBookingListMode,
): LeadBooking[] {
  if (!profile) return [];

  const userId = profile.id;
  const role = profile.currentContext?.role;

  if (!isStaffRole(role)) {
    return [];
  }

  if (mode === 'mine') {
    return bookings.filter((b) => b.teacher_id === userId || b.operator_id === userId);
  }

  if (isPrincipalOrAbove(role)) {
    if (campusId) {
      return bookings.filter((b) => b.campus_id === campusId);
    }
    return bookings;
  }

  if (isTeachingRole(role)) {
    return bookings.filter((b) => b.teacher_id === userId || b.operator_id === userId);
  }

  return [];
}

/** Mock 下校长/管理员按校区拉全量试听预约 */
export async function loadMockCampusLeadBookings(
  campusId?: string,
  params?: { startDate?: string; endDate?: string; status?: LeadBookingStatus },
): Promise<LeadBooking[]> {
  if (!isUseMock()) return [];
  const { mockListLeadBookingsByCampus } = await import('@/data/lead');
  return mockListLeadBookingsByCampus(campusId, params);
}

export function sortLeadBookingsDesc(list: LeadBooking[]): LeadBooking[] {
  return [...list].sort((a, b) => {
    const dateCmp = b.lesson_date.localeCompare(a.lesson_date);
    if (dateCmp !== 0) return dateCmp;
    return b.start_time.localeCompare(a.start_time);
  });
}
