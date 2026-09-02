import { describe, expect, it } from 'vitest';
import type { CoursePackage } from '@/types/course-package';
import {
  getPackageGiftHours,
  getPackagePurchasedHours,
  getPackageRefundableAmount,
  getPackageUsedHours,
} from './student-detail-package';

function makePkg(partial: Partial<CoursePackage>): CoursePackage {
  return {
    id: 'pkg-1',
    student_id: 'stu-1',
    name: '测试课包',
    total_hours: 20,
    remaining_hours: 10,
    gift_hours: 0,
    bonus_remaining: 0,
    fee_amount: 2000,
    status: 'active',
    ...partial,
  } as CoursePackage;
}

describe('student-detail-package', () => {
  it('gift hours capped by total', () => {
    expect(getPackageGiftHours(makePkg({ gift_hours: 5, total_hours: 20 }))).toBe(5);
    expect(getPackageGiftHours(makePkg({ gift_hours: 30, total_hours: 20 }))).toBe(20);
  });

  it('purchased = total - gift', () => {
    expect(getPackagePurchasedHours(makePkg({ total_hours: 20, gift_hours: 4 }))).toBe(16);
  });

  it('used = total - remaining', () => {
    expect(getPackageUsedHours(makePkg({ total_hours: 20, remaining_hours: 7 }))).toBe(13);
  });

  it('refundable excludes bonus remaining and prior refunds', () => {
    const pkg = makePkg({
      total_hours: 20,
      gift_hours: 0,
      remaining_hours: 10,
      bonus_remaining: 2,
      fee_amount: 2000,
    });
    expect(getPackageRefundableAmount(pkg, 0)).toBe(800);
    expect(getPackageRefundableAmount(pkg, 200)).toBe(600);
  });

  it('returns 0 when fee or purchased hours invalid', () => {
    expect(getPackageRefundableAmount(makePkg({ fee_amount: 0 }), 0)).toBe(0);
    expect(
      getPackageRefundableAmount(makePkg({ total_hours: 5, gift_hours: 5, fee_amount: 100 }), 0),
    ).toBe(0);
  });
});
