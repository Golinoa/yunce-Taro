/**
 * 学员详情课包课时 / 退费纯计算
 *
 * 使用场景：课程消耗明细、退费弹窗可退金额。
 * 功能说明：无 React/Taro 依赖，便于单测锁定退费口径。
 */
import type { CoursePackage } from '@/types/course-package';

export function getPackageGiftHours(pkg: CoursePackage): number {
  return Math.max(0, Math.min(pkg.gift_hours || 0, pkg.total_hours || 0));
}

export function getPackagePurchasedHours(pkg: CoursePackage): number {
  return Math.max((pkg.total_hours || 0) - getPackageGiftHours(pkg), 0);
}

/** 课包已消耗课时 */
export function getPackageUsedHours(pkg: CoursePackage): number {
  return Math.max((pkg.total_hours || 0) - (pkg.remaining_hours || 0), 0);
}

export function roundToCurrency(amount: number): number {
  return Math.round(Math.max(amount, 0) * 100) / 100;
}

export function getPackageRefundSummary(pkg: CoursePackage, refundedAmount = 0) {
  const feeAmount = Number(pkg.fee_amount || 0);
  const purchasedHours = getPackagePurchasedHours(pkg);
  const bonusRemaining = Math.max(Number(pkg.bonus_remaining || 0), 0);
  const remainingHours = Math.max(Number(pkg.remaining_hours || 0), 0);
  const refundablePurchasedHoursBeforeRefund = Math.max(remainingHours - bonusRemaining, 0);

  if (feeAmount <= 0 || purchasedHours <= 0) {
    return {
      unitPrice: 0,
      purchasedHours,
      remainingHours,
      bonusRemaining,
      refundablePurchasedHoursBeforeRefund,
      refundedPurchasedHours: 0,
      refundablePurchasedHours: 0,
      refundableAmount: 0,
    };
  }

  const unitPrice = feeAmount / purchasedHours;
  const refundedPurchasedHours = refundedAmount > 0 ? refundedAmount / unitPrice : 0;
  const refundablePurchasedHours = Math.max(
    refundablePurchasedHoursBeforeRefund - refundedPurchasedHours,
    0,
  );

  return {
    unitPrice: roundToCurrency(unitPrice),
    purchasedHours,
    remainingHours,
    bonusRemaining,
    refundablePurchasedHoursBeforeRefund,
    refundedPurchasedHours,
    refundablePurchasedHours,
    refundableAmount: roundToCurrency(refundablePurchasedHours * unitPrice),
  };
}

export function getPackageRefundableAmount(pkg: CoursePackage, refundedAmount = 0): number {
  return getPackageRefundSummary(pkg, refundedAmount).refundableAmount;
}
