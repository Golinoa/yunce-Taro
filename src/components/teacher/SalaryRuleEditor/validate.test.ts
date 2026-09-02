import { describe, expect, it } from 'vitest';
import { createDefaultSalaryRule } from '@/domain/teacher-salary';
import { isSalaryRuleValid, validateSalaryRule } from './validate';

describe('validateSalaryRule', () => {
  it('createDefaultSalaryRule 原样可过校验，且无 attendance/perf 空 key', () => {
    const errors = validateSalaryRule(createDefaultSalaryRule());
    expect(isSalaryRuleValid(errors)).toBe(true);
    expect(errors.attendanceTiers).toBeUndefined();
    expect(errors.perfTiers).toBeUndefined();
  });

  it('分类 algorithm=tier 仅空占位可过校验，无 categoryLessonFees 空污染', () => {
    const base = createDefaultSalaryRule();
    const rule = {
      ...base,
      categoryLessonFees: base.categoryLessonFees.map((item, idx) =>
        idx === 0 ? { ...item, algorithm: 'tier' as const } : item,
      ),
    };
    const errors = validateSalaryRule(rule);
    expect(isSalaryRuleValid(errors)).toBe(true);
    expect(errors.categoryLessonFees).toBeUndefined();
  });

  it('分类 algorithm=perf 仅空占位可过校验，无 categoryLessonFees 空污染', () => {
    const base = createDefaultSalaryRule();
    const rule = {
      ...base,
      categoryLessonFees: base.categoryLessonFees.map((item, idx) =>
        idx === 0 ? { ...item, algorithm: 'perf' as const } : item,
      ),
    };
    const errors = validateSalaryRule(rule);
    expect(isSalaryRuleValid(errors)).toBe(true);
    expect(errors.categoryLessonFees).toBeUndefined();
  });

  it('固定底薪为负数时报错', () => {
    const rule = {
      ...createDefaultSalaryRule(),
      fixedBaseAmount: -1,
    };
    const errors = validateSalaryRule(rule);
    expect(errors.fixedBaseAmount).toBe('请输入正确的底薪金额');
  });

  it('医社保开启且金额为负时报错', () => {
    const rule = {
      ...createDefaultSalaryRule(),
      insurance: { enabled: true, companyAmount: -2, personalAmount: '' as const },
    };
    const errors = validateSalaryRule(rule);
    expect(errors.insurance?.companyAmount).toBe('请输入正确的金额');
  });

  it('提成阶梯比例为负时报错', () => {
    const rule = {
      ...createDefaultSalaryRule(),
      commissionMode: 'personal_perf' as const,
      commissionTiers: [{ id: 'c1', perfThreshold: 100, rate: -5 }],
    };
    const errors = validateSalaryRule(rule);
    expect(errors.commissionTiers?.c1?.rate).toBe('提成比例不能为负数');
  });

  it('分类单独设置固定单价为负时报错', () => {
    const base = createDefaultSalaryRule();
    const rule = {
      ...base,
      categoryLessonFees: [
        {
          ...base.categoryLessonFees[0],
          algorithm: 'fixed' as const,
          fixedRate: -10,
        },
      ],
    };
    const errors = validateSalaryRule(rule);
    expect(errors.categoryLessonFees?.[base.categoryLessonFees[0].id]?.fixedRate).toBe(
      '不能为负数',
    );
  });

  it('助教补贴为负时报错', () => {
    const base = createDefaultSalaryRule();
    const rule = {
      ...base,
      categoryExtraFees: [{ ...base.categoryExtraFees[0], rate: -1 }],
    };
    const errors = validateSalaryRule(rule);
    expect(errors.categoryExtraFees?.[base.categoryExtraFees[0].id]).toBe('补贴不能为负数');
  });

  it('attendance 占位填负数时报错', () => {
    const base = createDefaultSalaryRule();
    const rule = {
      ...base,
      attendanceTiers: [{ id: 'a1', minCount: -1, maxCount: '', rate: '' }],
    };
    const errors = validateSalaryRule(rule);
    expect(errors.attendanceTiers?.a1?.minCount).toBe('不能为负数');
  });
});
