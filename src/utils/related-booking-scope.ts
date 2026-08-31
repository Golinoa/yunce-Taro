/**
 * 「与我相关」预约 — 权限与关联过滤（可复用）
 *
 * 口径（第一期写死，第二期可配置）：
 * - 试听：授课老师 / 代约人 / 线索归属老师
 * - 团课开放约：时段授课老师
 * - 私教/团课家长约：约课老师
 * - 场地：场地负责人或预约操作人
 *
 * 「我的预约」始终按关联过滤（校长也不看全校区），与「试听记录」的校区视角区分。
 */
import type { ClassBookingSlot } from '@/types/class';
import type { LeadBooking } from '@/types/lead';
import type { MyBookingCard, MyBookingSourceType } from '@/types/my-booking';
import { canAccessModule } from '@/types/permission';
import type { Profile } from '@/types/profile';
import type { VenueBookingRecord } from '@/types/venue-booking';
import { isStaffRole } from '@/utils/auth';
import type { ParentBookingItem } from '@/utils/parent-bookings';

/** 关联角色（决定 relationLabel 与操作权限） */
export type BookingRelationKind =
  | 'teacher'
  | 'operator'
  | 'owner'
  | 'venue_manager'
  | 'venue_booker'
  | 'class_teacher';

export const BOOKING_RELATION_LABEL: Record<BookingRelationKind, string> = {
  teacher: '授课',
  operator: '代约',
  owner: '归属老师',
  venue_manager: '场地负责人',
  venue_booker: '预约人',
  class_teacher: '授课',
};

/** 生产/Mock 统一：收集可用于匹配预约关联字段的账号 ID */
export function getProfileActorIds(profile: Profile | null | undefined): string[] {
  if (!profile) return [];
  const ids = new Set<string>();
  if (profile.id) ids.add(profile.id);
  if (profile.currentContext?.identityId) ids.add(profile.currentContext.identityId);
  if (profile.teacher_profile?.id) ids.add(profile.teacher_profile.id);
  return [...ids];
}

/** 老师端查预约时优先用 Teacher.id，其次 Auth 用户 ID */
export function resolveTeachingActorId(profile: Profile | null | undefined): string {
  if (!profile) return '';
  return profile.teacher_profile?.id || profile.id || '';
}

/** 是否可进入「我的预约」页（机构端 + 线索/班级模块） */
export function canAccessMyBookings(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  const role = profile.currentContext?.role;
  if (!isStaffRole(role)) return false;
  return canAccessModule(profile, 'leads') || canAccessModule(profile, 'classes');
}

/** 解析可用于匹配预约关联字段的全部 actorId */
export function resolveRelatedActorIds(profile: Profile | null | undefined): string[] {
  if (!profile) return [];
  const ids = new Set(getProfileActorIds(profile));
  const teachingId = resolveTeachingActorId(profile);
  if (teachingId) ids.add(teachingId);
  if (profile.id) ids.add(profile.id);
  return [...ids].filter(Boolean);
}

/** 拉数用的主 ID（优先 Teacher 档案） */
export function resolvePrimaryFetchActorId(profile: Profile | null | undefined): string {
  return resolveTeachingActorId(profile) || profile?.id || '';
}

export function isLeadBookingRelated(
  booking: Pick<LeadBooking, 'teacher_id' | 'operator_id' | 'owner_teacher_id'>,
  actorIds: string[],
): boolean {
  if (actorIds.length === 0) return false;
  return (
    actorIds.includes(booking.teacher_id) ||
    (booking.operator_id ? actorIds.includes(booking.operator_id) : false) ||
    (booking.owner_teacher_id ? actorIds.includes(booking.owner_teacher_id) : false)
  );
}

export function resolveLeadRelationKind(
  booking: Pick<LeadBooking, 'teacher_id' | 'operator_id' | 'owner_teacher_id'>,
  actorIds: string[],
): BookingRelationKind | null {
  if (actorIds.includes(booking.teacher_id)) return 'teacher';
  if (booking.operator_id && actorIds.includes(booking.operator_id)) return 'operator';
  if (booking.owner_teacher_id && actorIds.includes(booking.owner_teacher_id)) return 'owner';
  return null;
}

export function isVenueBookingRelated(
  record: Pick<VenueBookingRecord, 'userId' | 'managerUserId'>,
  actorIds: string[],
  managerFallbackId?: string,
): boolean {
  if (actorIds.length === 0) return false;
  const managerId = record.managerUserId || managerFallbackId || '';
  return (managerId ? actorIds.includes(managerId) : false) || actorIds.includes(record.userId);
}

export function resolveVenueRelationKind(
  record: Pick<VenueBookingRecord, 'userId' | 'managerUserId'>,
  actorIds: string[],
  managerFallbackId?: string,
): BookingRelationKind | null {
  const managerId = record.managerUserId || managerFallbackId || '';
  if (managerId && actorIds.includes(managerId)) return 'venue_manager';
  if (actorIds.includes(record.userId)) return 'venue_booker';
  return null;
}

export function isClassSlotRelated(
  slot: Pick<ClassBookingSlot, 'teacher_id'>,
  actorIds: string[],
): boolean {
  return actorIds.length > 0 && actorIds.includes(slot.teacher_id);
}

export function isParentBookingRelated(
  item: Pick<ParentBookingItem, 'teacherName'>,
  profile: Profile | null | undefined,
): boolean {
  const name = profile?.name?.trim();
  if (!name) return false;
  return item.teacherName === name;
}

/** 按模块权限裁剪可见来源 */
export function isSourceTypeAllowed(
  profile: Profile | null | undefined,
  sourceType: MyBookingSourceType,
): boolean {
  if (!profile) return false;
  if (sourceType === 'trial_group' || sourceType === 'trial_private') {
    return canAccessModule(profile, 'leads');
  }
  return canAccessModule(profile, 'classes');
}

export function filterMyBookingCardsByPermission(
  cards: MyBookingCard[],
  profile: Profile | null | undefined,
): MyBookingCard[] {
  if (!canAccessMyBookings(profile)) return [];
  return cards.filter((card) => isSourceTypeAllowed(profile, card.sourceType));
}

export interface MyBookingActionFlags {
  canCheckIn: boolean;
  canCancel: boolean;
  canVenueCheckIn: boolean;
  checkInLabel?: string;
}

/** 卡片操作权限（状态 + 关联角色 + 模块） */
export function resolveMyBookingActions(
  profile: Profile | null | undefined,
  card: MyBookingCard,
): MyBookingActionFlags {
  const empty: MyBookingActionFlags = {
    canCheckIn: false,
    canCancel: false,
    canVenueCheckIn: false,
  };
  if (!profile || !canAccessMyBookings(profile)) return empty;
  if (!isSourceTypeAllowed(profile, card.sourceType)) return empty;

  const relation = card.relationKind;
  const active = card.status === 'pending' || card.status === 'confirmed';

  if (card.sourceType === 'trial_private' || card.sourceType === 'trial_group') {
    const isTeacherOrOperator = relation === 'teacher' || relation === 'operator';
    const canMutate =
      relation === 'teacher' || relation === 'operator' || relation === 'owner';
    return {
      canCheckIn: active && isTeacherOrOperator,
      canCancel: active && canMutate,
      canVenueCheckIn: false,
      checkInLabel: card.sourceType === 'trial_group' ? '点名' : '签到',
    };
  }

  if (card.sourceType === 'venue') {
    return {
      canCheckIn: false,
      canCancel: false,
      canVenueCheckIn: active && relation === 'venue_manager',
      checkInLabel: '核销',
    };
  }

  return empty;
}
