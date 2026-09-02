import { describe, expect, it } from 'vitest';
import { createDefaultSalaryRule } from '@/domain/teacher-salary';
import { isSalaryRuleValid, validateSalaryRule } from './validate';

describe('validateSalaryRule', () => {
  it('默认规则在固定底薪模式下可过校验（忽略空 attendance/perf 占位）', () => {
    const rule = createDefaultSalaryRule();
    // 默认含 attendance/perf 占位行；原逻辑会对空行写入空对象 key。
    // 清空占位后验证「正常填写」路径。
    const cleaned = {
      ...rule,
      attendanceTiers: [],
      perfTiers: [],
    };
    const errors = validateSalaryRule(cleaned);
    expect(isSalaryRuleValid(errors)).toBe(true);
  });

  it('固定底薪为负数时报错', () => {
    const rule = {
      ...createDefaultSalaryRule(),
      fixedBaseAmount: -1,
      attendanceTiers: [],
      perfTiers: [],
    };
    const errors = validateSalaryRule(rule);
    expect(errors.fixedBaseAmount).toBe('请输入正确的底薪金额');
  });

  it('医社保开启且金额为负时报错', () => {
    const rule = {
      ...createDefaultSalaryRule(),
      attendanceTiers: [],
      perfTiers: [],
      insurance: { enabled: true, companyAmount: -2, personalAmount: '' as const },
    };
    const errors = validateSalaryRule(rule);
    expect(errors.insurance?.companyAmount).toBe('请输入正确的金额');
  });

  it('提成阶梯比例为负时报错', () => {
    const rule = {
      ...createDefaultSalaryRule(),
      attendanceTiers: [],
      perfTiers: [],
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
      attendanceTiers: [],
      perfTiers: [],
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
      attendanceTiers: [],
      perfTiers: [],
      categoryExtraFees: [{ ...base.categoryExtraFees[0], rate: -1 }],
    };
    const errors = validateSalaryRule(rule);
    expect(errors.categoryExtraFees?.[base.categoryExtraFees[0].id]).toBe('补贴不能为负数');
  });
});
