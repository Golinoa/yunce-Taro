/**
 * 学员详情派生数据
 *
 * 使用场景：消耗汇总、会员卡汇总、退费候选、出勤时间线。
 * 功能说明：纯 useMemo / 月份展开状态，不发起请求。
 */
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LeaveRequest } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import type { MemberCardDetail } from '@/types/member-card';
import { getMemberCardTotalCount } from '@/utils/member-card-hours';
import { isConsumingRecord } from './student-detail-record-status';

export type TimelineItem =
  | { type: 'record'; id: string; date: string; data: LessonRecord }
  | { type: 'leave'; id: string; date: string; data: LeaveRequest };

export interface UseStudentDetailDerivedParams {
  records: LessonRecord[];
  leaves: LeaveRequest[];
  memberCards: MemberCardDetail[];
}

export interface StudentDetailDerived {
  memberCardStats: {
    totalCount: number;
    usedCount: number;
    remainingCount: number;
    totalAmount: number;
    usedAmount: number;
    remainingAmount: number;
  };
  timelineGroups: Record<string, TimelineItem[]>;
  monthStats: Record<string, { checkIn: number; leave: number }>;
  expandedMonths: Set<string>;
  handleToggleMonth: (month: string) => void;
}

/** 计算学员详情各 Tab 所需的汇总与分组数据。 */
export function useStudentDetailDerived(
  params: UseStudentDetailDerivedParams,
): StudentDetailDerived {
  const { records, leaves, memberCards } = params;

  const memberCardStats = useMemo(() => {
    let totalCount = 0;
    let remainingCount = 0;
    let totalAmount = 0;
    let remainingAmount = 0;
    memberCards.forEach((card) => {
      if (card.cardTypeKind === 'count') {
        // 总课时统一口径（含赠课，见 utils/member-card-hours.ts）
        totalCount += getMemberCardTotalCount(card) ?? 0;
        remainingCount += card.remainingCount || 0;
      }
      if (card.cardTypeKind === 'stored') {
        totalAmount += card.purchasePrice || 0;
        remainingAmount += card.remainingAmount || 0;
      }
    });
    return {
      totalCount,
      usedCount: totalCount - remainingCount,
      remainingCount,
      totalAmount,
      usedAmount: totalAmount - remainingAmount,
      remainingAmount,
    };
  }, [memberCards]);

  const timelineGroups = useMemo(() => {
    const items: TimelineItem[] = [
      ...records.map((record) => ({
        type: 'record' as const,
        id: record.id,
        date: record.lesson_date,
        data: record,
      })),
      ...leaves.map((leave) => ({
        type: 'leave' as const,
        id: leave.id,
        date: leave.original_date,
        data: leave,
      })),
    ].sort((a, b) => (dayjs(a.date).isAfter(dayjs(b.date)) ? -1 : 1));

    const groups: Record<string, TimelineItem[]> = {};
    items.forEach((item) => {
      const monthKey = dayjs(item.date).format('YYYY年M月');
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(item);
    });
    return groups;
  }, [records, leaves]);

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const expandedMonthsInitRef = useRef(false);
  useEffect(() => {
    if (expandedMonthsInitRef.current) return;
    const monthKeys = Object.keys(timelineGroups);
    if (monthKeys.length > 0) {
      expandedMonthsInitRef.current = true;
      setExpandedMonths(new Set([monthKeys[0]]));
    }
  }, [timelineGroups]);

  const handleToggleMonth = useCallback((month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  }, []);

  const monthStats = useMemo(() => {
    const stats: Record<string, { checkIn: number; leave: number }> = {};
    Object.entries(timelineGroups).forEach(([month, items]) => {
      let checkIn = 0;
      let leave = 0;
      items.forEach((item) => {
        if (item.type === 'record') {
          // 只有**真实消耗课时**的记录才算签到；
          // 口径见 student-detail-record-status.ts（单一事实源，勿在此内联重写判据）
          if (isConsumingRecord(item.data)) checkIn += 1;
        } else {
          leave += 1;
        }
      });
      stats[month] = { checkIn, leave };
    });
    return stats;
  }, [timelineGroups]);

  return {
    memberCardStats,
    timelineGroups,
    monthStats,
    expandedMonths,
    handleToggleMonth,
  };
}
