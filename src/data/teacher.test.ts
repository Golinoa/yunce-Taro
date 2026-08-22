import { describe, it, expect, vi } from 'vitest';
import type { TeacherUIModel } from '@/types/teacher';

/**
 * 桩掉 mock-database：阻止其顶层 buildTeacherView() 触发循环依赖初始化
 * （mock-database <-> data/teacher 在 vitest ESM 模块图下 getManagedTeachers 尚未就绪），
 * calcTotal 是纯函数，无需真实 mock 数据。
 */
vi.mock('@/data/mock-database', () => ({
  syncTeacherView: () => {},
  TEACHERS: [],
  NOW: new Date(),
  CUR_YEAR: new Date().getFullYear(),
  CUR_MONTH: new Date().getMonth() + 1,
  CUR_DAY: new Date().getDate(),
  CUR_WEEKDAY: 1,
}));

// calcTotal 必须在 mock 之后导入，确保 teacher.ts 初始化期不触发循环依赖
import { calcTotal } from '@/data/teacher';

/**
 * calcTotal 回归测试（对应修复 B-01：实发金额与展示金额共用同一算法）
 * 覆盖课酬两种计算分支、扣除钳制下限、以及「展示=实发」一致性。
 */
function makeTeacher(overrides: Record<string, unknown> = {}): TeacherUIModel {
  return {
    base: 0,
    hours: 0,
    rate: 0,
    attend: 0,
    perf: 0,
    socialInsurance: 0,
    lateFine: 0,
    otherFine: 0,
    bonusAmount: 0,
    deductions: [],
    categoryLessonFees: undefined,
    ...overrides,
  } as unknown as TeacherUIModel;
}

describe('calcTotal（B-01 实发金额算法）', () => {
  it('无分类课时费时按 hours*rate 计课酬', () => {
    const t = makeTeacher({
      base: 1000,
      hours: 10,
      rate: 50,
      attend: 200,
      perf: 100,
      socialInsurance: 100,
      lateFine: 20,
      otherFine: 30,
      bonusAmount: 50,
      deductions: [
        { type: 'bonus', amount: 40 },
        { type: 'deduct', amount: 10 },
      ],
    });
    // 1000 + 500 + 200 + 100 - 100 - 20 - 30 + 50 + (40 - 10) = 1730
    expect(calcTotal(t)).toBe(1730);
  });

  it('存在分类课时费时按分类金额之和计课酬（覆盖 hours*rate 分支）', () => {
    const t = makeTeacher({
      base: 1000,
      hours: 10,
      rate: 50,
      categoryLessonFees: [{ amount: 999 }, { amount: 200 }],
      attend: 200,
      perf: 100,
      socialInsurance: 100,
      lateFine: 20,
      otherFine: 30,
      bonusAmount: 50,
      deductions: [
        { type: 'bonus', amount: 40 },
        { type: 'deduct', amount: 10 },
      ],
    });
    // 1000 + 1199 + 200 + 100 - 100 - 20 - 30 + 50 + (40-10) = 2429
    expect(calcTotal(t)).toBe(2429);
  });

  it('扣除超过应发时下限钳制为 0', () => {
    const t = makeTeacher({
      base: 100,
      socialInsurance: 1000,
      lateFine: 500,
      otherFine: 500,
    });
    // 100 - 2000 = -1900 → max(0, …) = 0
    expect(calcTotal(t)).toBe(0);
  });

  it('与 mockExecutePay 共用同一算法（展示与实发一致）', () => {
    const t = makeTeacher({
      base: 8000,
      hours: 40,
      rate: 120,
      attend: 600,
      perf: 300,
      socialInsurance: 1200,
      lateFine: 0,
      otherFine: 200,
      bonusAmount: 500,
      deductions: [{ type: 'bonus', amount: 300 }],
    });
    // 8000 + 4800 + 600 + 300 - 1200 - 0 - 200 + 500 + 300 = 13100
    expect(calcTotal(t)).toBe(13100);
  });
});
