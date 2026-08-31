/**
 * 「我的预约」聚合 Service
 * 并行拉取试听 / 场地 / 班课开放约 / 团课·私教约课，映射为 MyBookingCard。
 */
import dayjs from 'dayjs';
import { classBookingService } from '@/services/class-booking';
import { leadService } from '@/services/lead';
import { venueBookingService } from '@/services/venue-booking';
import type { LeadBooking } from '@/types/lead';
import type {
  MyBookingCard,
  MyBookingDateRange,
  MyBookingSourceType,
  MyBookingStatus,
} from '@/types/my-booking';
import type { Profile } from '@/types/profile';
import type { VenueBookingRecord } from '@/types/venue-booking';
import { readAllParentBookings, type ParentBookingItem } from '@/utils/parent-bookings';
import {
  BOOKING_RELATION_LABEL,
  canAccessMyBookings,
  filterMyBookingCardsByPermission,
  isClassSlotRelated,
  isLeadBookingRelated,
  isParentBookingRelated,
  isSourceTypeAllowed,
  isVenueBookingRelated,
  resolveLeadRelationKind,
  resolvePrimaryFetchActorId,
  resolveRelatedActorIds,
  resolveVenueRelationKind,
} from '@/utils/related-booking-scope';

function mapLeadStatus(status: LeadBooking['status']): MyBookingStatus {
  return status;
}

function mapVenueStatus(status: VenueBookingRecord['status']): MyBookingStatus {
  if (status === 'checked_in') return 'completed';
  if (status === 'pending') return 'pending';
  if (status === 'cancelled') return 'cancelled';
  return 'confirmed';
}

function mapClassRecordStatus(
  status: 'pending' | 'confirmed' | 'cancelled',
  lessonDate: string,
): MyBookingStatus {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'pending') return 'pending';
  if (lessonDate < dayjs().format('YYYY-MM-DD')) return 'completed';
  return 'confirmed';
}

function mapParentStatus(status: ParentBookingItem['status']): MyBookingStatus {
  switch (status) {
    case 'booked':
      return 'confirmed';
    case 'waitlist':
      return 'pending';
    case 'completed':
      return 'completed';
    case 'leave':
    case 'expired':
    case 'cancelled':
      return 'cancelled';
    default:
      return 'confirmed';
  }
}

function mapLeadToCard(booking: LeadBooking, actorIds: string[]): MyBookingCard | null {
  if (!isLeadBookingRelated(booking, actorIds)) return null;
  const kind = resolveLeadRelationKind(booking, actorIds);
  if (!kind) return null;
  const sourceType: MyBookingSourceType =
    booking.trial_mode === 'private' ? 'trial_private' : 'trial_group';
  return {
    id: `lead:${booking.id}`,
    sourceType,
    title: booking.child_name || '试听学员',
    subtitle:
      booking.trial_mode === 'private'
        ? booking.course_name || '一对一试听'
        : booking.class_name || booking.course_name || '跟班试听',
    date: booking.lesson_date,
    start: booking.start_time,
    end: booking.end_time,
    status: mapLeadStatus(booking.status),
    relationKind: kind,
    relationLabel: BOOKING_RELATION_LABEL[kind],
    phone: booking.parent_phone,
    navigatePayload: {
      bookingId: booking.id,
      leadId: booking.lead_id,
      classId: booking.class_id,
      lessonDate: booking.lesson_date,
      trialMode: booking.trial_mode,
    },
  };
}

function mapVenueToCard(
  record: VenueBookingRecord,
  actorIds: string[],
  roomName: string,
): MyBookingCard | null {
  if (!isVenueBookingRelated(record, actorIds)) return null;
  const kind = resolveVenueRelationKind(record, actorIds);
  if (!kind) return null;
  return {
    id: `venue:${record.id}`,
    sourceType: 'venue',
    title: record.userName || '预约人',
    subtitle: roomName || '场地',
    date: record.date,
    start: record.startTime,
    end: record.endTime,
    status: mapVenueStatus(record.status),
    relationKind: kind,
    relationLabel: BOOKING_RELATION_LABEL[kind],
    navigatePayload: {
      bookingId: record.id,
      roomId: record.roomId,
      lessonDate: record.date,
    },
  };
}

function parseTimeRange(timeRange: string): { start: string; end: string } {
  const [start = '', end = ''] = timeRange.split('-').map((s) => s.trim());
  return { start, end };
}

function mapParentToCard(item: ParentBookingItem): MyBookingCard {
  const { start, end } = parseTimeRange(item.timeRange || '');
  const sourceType: MyBookingSourceType = item.courseType === 'oneOnOne' ? 'private' : 'group';
  return {
    id: `parent:${item.id}`,
    sourceType,
    title: item.studentName || '学员',
    subtitle: item.courseName || (sourceType === 'private' ? '私教课' : '团课'),
    date: item.lessonDate,
    start,
    end,
    status: mapParentStatus(item.status),
    relationKind: 'class_teacher',
    relationLabel: BOOKING_RELATION_LABEL.class_teacher,
    navigatePayload: {
      bookingId: item.id,
      parentBookingId: item.id,
      classId: item.classId,
      lessonDate: item.lessonDate,
    },
  };
}

/** 时间线：未来升序 + 过去降序 */
export function sortMyBookingsNearToFar(list: MyBookingCard[]): MyBookingCard[] {
  const today = dayjs().format('YYYY-MM-DD');
  const future: MyBookingCard[] = [];
  const past: MyBookingCard[] = [];

  list.forEach((item) => {
    if (item.date >= today) future.push(item);
    else past.push(item);
  });

  future.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.start.localeCompare(b.start);
  });
  past.sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return b.start.localeCompare(a.start);
  });

  return [...future, ...past];
}

function collectParentBookings(
  profile: Profile,
  dateRange: MyBookingDateRange,
): ParentBookingItem[] {
  const fromStorage = readAllParentBookings().filter((item) =>
    isParentBookingRelated(item, profile),
  );
  const fromSeed: ParentBookingItem[] = [];

  const map = new Map<string, ParentBookingItem>();
  [...fromSeed, ...fromStorage].forEach((item) => {
    if (item.lessonDate < dateRange.startDate) return;
    if (item.lessonDate > dateRange.endDate) return;
    map.set(item.id, item);
  });
  return [...map.values()];
}

export async function getMyRelatedBookings(
  profile: Profile | null | undefined,
  dateRange: MyBookingDateRange,
): Promise<MyBookingCard[]> {
  if (!canAccessMyBookings(profile) || !profile) return [];

  const actorIds = resolveRelatedActorIds(profile);
  const primaryId = resolvePrimaryFetchActorId(profile);
  const fetchIds = [...new Set([primaryId, profile.id, ...actorIds].filter(Boolean))];
  if (fetchIds.length === 0) return [];

  const allowLeads = isSourceTypeAllowed(profile, 'trial_private');
  const allowClasses = isSourceTypeAllowed(profile, 'class_open');

  const [leadBatches, venueList, classPairs] = await Promise.all([
    allowLeads
      ? Promise.all(
          fetchIds.map((id) =>
            leadService.getLeadBookingsByTeacher(id, dateRange).catch(() => [] as LeadBooking[]),
          ),
        )
      : Promise.resolve([] as LeadBooking[][]),
    allowClasses
      ? venueBookingService
          .listRelatedBookings(fetchIds, dateRange)
          .catch(() => [] as VenueBookingRecord[])
      : Promise.resolve([] as VenueBookingRecord[]),
    allowClasses
      ? classBookingService
          .listRelatedBookings(fetchIds, dateRange)
          .catch(() => [] as Awaited<ReturnType<typeof classBookingService.listRelatedBookings>>)
      : Promise.resolve([] as Awaited<ReturnType<typeof classBookingService.listRelatedBookings>>),
  ]);

  const cards: MyBookingCard[] = [];

  if (allowLeads) {
    const leadMap = new Map<string, LeadBooking>();
    leadBatches.flat().forEach((b) => leadMap.set(b.id, b));
    leadMap.forEach((booking) => {
      const card = mapLeadToCard(booking, actorIds);
      if (card) cards.push(card);
    });
  }

  if (allowClasses) {
    const roomIds = [...new Set(venueList.map((r) => r.roomId))];
    const roomEntries = await Promise.all(
      roomIds.map(async (roomId) => {
        try {
          const venue = await venueBookingService.getBookableVenueById(roomId);
          return [roomId, venue?.name || '场地'] as const;
        } catch {
          return [roomId, '场地'] as const;
        }
      }),
    );
    const roomNameMap = new Map(roomEntries);
    venueList.forEach((record) => {
      const card = mapVenueToCard(record, actorIds, roomNameMap.get(record.roomId) || '场地');
      if (card) cards.push(card);
    });

    classPairs.forEach(({ record, slot }) => {
      if (!isClassSlotRelated(slot, actorIds)) return;
      cards.push({
        id: `class:${record.id}`,
        sourceType: 'class_open',
        title: record.student_name || '学员',
        subtitle: slot.class_name || '团课',
        date: slot.lesson_date,
        start: slot.start_time,
        end: slot.end_time,
        status: mapClassRecordStatus(record.status, slot.lesson_date),
        relationKind: 'class_teacher',
        relationLabel: BOOKING_RELATION_LABEL.class_teacher,
        navigatePayload: {
          bookingId: record.id,
          classId: record.class_id,
          lessonDate: slot.lesson_date,
        },
      });
    });

    collectParentBookings(profile, dateRange).forEach((item) => {
      cards.push(mapParentToCard(item));
    });
  }

  return sortMyBookingsNearToFar(filterMyBookingCardsByPermission(cards, profile));
}

export const myBookingService = {
  getMyRelatedBookings,
  sortMyBookingsNearToFar,
};
