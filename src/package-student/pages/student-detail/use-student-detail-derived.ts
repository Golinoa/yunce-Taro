/**
 * 学员详情派生数据
 *
 * 使用场景：消耗汇总、会员卡汇总、退费候选、出勤时间线。
 * 功能说明：纯 useMemo / 月份展开状态，不发起请求。
 */
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildLessonConsumptionSections,
  type LessonConsumptionSection,
} from '@/components/lesson/LessonConsumptionList';
import type { CoursePackage, PackageTransaction } from '@/types/course-package';
import type { LeaveRequest } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import { getPackagePurchasedHours, getPackageRefundableAmount } from './student-detail-package';

export type TimelineItem =
  | { type: 'record'; id: string; date: string; data: LessonRecord }
  | { type: 'leave'; id: string; date: string; data: LeaveRequest };

export interface UseStudentDetailDerivedParams {
  student: Student | null;
  records: LessonRecord[];
  packages: CoursePackage[];
  packageTransactions: PackageTransaction[];
  leaves: LeaveRequest[];
  memberCards: MemberCardDetail[];
  selectedRefundPackageId: string;
}

export interface StudentDetailDerived {
  remainingHours: number;
  consumptionStats: {
    total: number;
    used: number;
    remaining: number;
    percent: number;
  };
  recentConsumptions: LessonRecord[];
  recentConsumptionSections: LessonConsumptionSection[];
  memberCardStats: {
    totalCount: number;
    usedCount: number;
    remainingCount: number;
    totalAmount: number;
    usedAmount: number;
    remainingAmount: number;
  };
  refundedAmountByPackage: Record<string, number>;
  refundablePackages: CoursePackage[];
  selectedRefundPackage: CoursePackage | null;
  selectedRefundMaxAmount: number;
  timelineGroups: Record<string, TimelineItem[]>;
  monthStats: Record<string, { checkIn: number; leave: number }>;
  expandedMonths: Set<string>;
  handleToggleMonth: (month: string) => void;
}

/** 计算学员详情各 Tab 所需的汇总与分组数据。 */
export function useStudentDetailDerived(
  params: UseStudentDetailDerivedParams,
): StudentDetailDerived {
  const {
    student,
    records,
    packages,
    packageTransactions,
    leaves,
    memberCards,
    selectedRefundPackageId,
  } = params;

  const remainingHours = useMemo(
    () => (student?.course_packages || []).reduce((s, p) => s + (p.remaining_hours || 0), 0),
    [student],
  );

  const consumptionStats = useMemo(() => {
    const total = packages.reduce((s, p) => s + (p.total_hours || 0), 0);
    const remaining = packages.reduce((s, p) => s + (p.remaining_hours || 0), 0);
    const used = Math.max(total - remaining, 0);
    const percent = total > 0 ? Math.round((used / total) * 100) : 0;
    return { total, used, remaining, percent };
  }, [packages]);

  const recentConsumptions = useMemo(() => {
    return records
      .filter((r) => (r.hours_used || 0) > 0 && r.status !== 'cancelled')
      .sort((a, b) => (dayjs(a.lesson_date).isAfter(dayjs(b.lesson_date)) ? -1 : 1))
      .slice(0, 8);
  }, [records]);

  const recentConsumptionSections = useMemo(
    () => buildLessonConsumptionSections(recentConsumptions),
    [recentConsumptions],
  );

  const memberCardStats = useMemo(() => {
    let totalCount = 0;
    let remainingCount = 0;
    let totalAmount = 0;
    let remainingAmount = 0;
    memberCards.forEach((card) => {
      if (card.cardTypeKind === 'count') {
        totalCount += card.cardTypeCount || 0;
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

  const refundedAmountByPackage = useMemo(() => {
    return packageTransactions.reduce<Record<string, number>>((acc, item) => {
      if (item.type !== 'refund' || !item.package_id) {
        return acc;
      }
      acc[item.package_id] =
        (acc[item.package_id] || 0) + Number(item.refund_amount || item.fee_amount || 0);
      return acc;
    }, {});
  }, [packageTransactions]);

  const refundablePackages = useMemo(
    () =>
      packages.filter((pkg) => {
        const purchasedHours = getPackagePurchasedHours(pkg);
        return (
          pkg.status === 'active' &&
          purchasedHours > 0 &&
          Number(pkg.fee_amount || 0) > 0 &&
          getPackageRefundableAmount(pkg, refundedAmountByPackage[pkg.id] || 0) > 0
        );
      }),
    [packages, refundedAmountByPackage],
  );

  const selectedRefundPackage = useMemo(
    () => refundablePackages.find((pkg) => pkg.id === selectedRefundPackageId) || null,
    [refundablePackages, selectedRefundPackageId],
  );

  const selectedRefundMaxAmount = useMemo(
    () =>
      selectedRefundPackage
        ? getPackageRefundableAmount(
            selectedRefundPackage,
            refundedAmountByPackage[selectedRefundPackage.id] || 0,
          )
        : 0,
    [refundedAmountByPackage, selectedRefundPackage],
  );

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
        if (item.type === 'record') checkIn += 1;
        else leave += 1;
      });
      stats[month] = { checkIn, leave };
    });
    return stats;
  }, [timelineGroups]);

  return {
    remainingHours,
    consumptionStats,
    recentConsumptions,
    recentConsumptionSections,
    memberCardStats,
    refundedAmountByPackage,
    refundablePackages,
    selectedRefundPackage,
    selectedRefundMaxAmount,
    timelineGroups,
    monthStats,
    expandedMonths,
    handleToggleMonth,
  };
}
