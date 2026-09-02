import { describe, expect, it } from 'vitest';
import { createDefaultSalaryRule } from '@/domain/teacher-salary';
import type { SalaryRuleConfig } from '@/types/teacher';
import { isSalaryRuleValid, validateSalaryRule } from './validate';

function withRule(patch: Partial<SalaryRuleConfig>): SalaryRuleConfig {
  return { ...createDefaultSalaryRule(), ...patch };
}

describe('validateSalaryRule', () => {
  it('createDefaultSalaryRule 原样可过校验，且无 attendance/perf 空 key', () => {
    const errors = validateSalaryRule(createDefaultSalaryRule());
    expect(isSalaryRuleValid(errors)).toBe(true);
    expect(errors.attendanceTiers).toBeUndefined();
    expect(errors.perfTiers).toBeUndefined();
  });

  it('空占位（空串）在各阶梯字段均可过校验', () => {
    const rule = withRule({
      baseMode: 'personal_perf',
      fixedBaseAmount: '',
      baseTiers: [{ id: 'b1', perfThreshold: '', baseAmount: '' }],
      insurance: { enabled: true, companyAmount: '', personalAmount: '' },
      unifiedLessonRate: '',
      commissionTiers: [{ id: 'c1', perfThreshold: '', rate: '' }],
      attendanceTiers: [{ id: 'a1', minCount: '', maxCount: '', rate: '' }],
      perfTiers: [{ id: 'p1', threshold: '', rate: '' }],
      categoryExtraFees: [{ id: 'e1', name: '助教', rate: '', description: '' }],
    });
    const errors = validateSalaryRule(rule);
    expect(isSalaryRuleValid(errors)).toBe(true);
    expect(errors.insurance).toBeUndefined();
    expect(errors.baseTiers).toBeUndefined();
    expect(errors.commissionTiers).toBeUndefined();
  });

  it('分类 algorithm=tier / perf 仅空占位可过校验，无 categoryLessonFees 空污染', () => {
    const base = createDefaultSalaryRule();
    for (const algorithm of ['tier', 'perf'] as const) {
      const rule = {
        ...base,
        categoryLessonFees: base.categoryLessonFees.map((item, idx) =>
          idx === 0 ? { ...item, algorithm } : item,
        ),
      };
      const errors = validateSalaryRule(rule);
      expect(isSalaryRuleValid(errors)).toBe(true);
      expect(errors.categoryLessonFees).toBeUndefined();
    }
  });

  it('固定底薪：负数与非法字符串均报错；合法非负通过', () => {
    expect(validateSalaryRule(withRule({ fixedBaseAmount: -1 })).fixedBaseAmount).toBe(
      '请输入正确的底薪金额',
    );
    expect(
      validateSalaryRule(withRule({ fixedBaseAmount: 'abc' as unknown as number })).fixedBaseAmount,
    ).toBe('请输入正确的底薪金额');
    expect(validateSalaryRule(withRule({ fixedBaseAmount: 0 })).fixedBaseAmount).toBeUndefined();
  });

  it('非固定底薪：baseTiers 门槛/金额负数与 NaN 报错，可同阶梯组合', () => {
    const errors = validateSalaryRule(
      withRule({
        baseMode: 'personal_perf',
        baseTiers: [
          { id: 'b1', perfThreshold: -1, baseAmount: -2 },
          { id: 'b2', perfThreshold: 'x' as unknown as number, baseAmount: '' },
        ],
      }),
    );
    expect(errors.baseTiers?.b1?.perfThreshold).toBe('业绩门槛不能为负数');
    expect(errors.baseTiers?.b1?.baseAmount).toBe('底薪金额不能为负数');
    expect(errors.baseTiers?.b2?.perfThreshold).toBe('业绩门槛不能为负数');
    expect(errors.baseTiers?.b2?.baseAmount).toBeUndefined();
  });

  it('医社保：开启后 company/personal 非法报错；均合法则不残留 insurance 空对象', () => {
    const bothBad = validateSalaryRule(
      withRule({
        insurance: { enabled: true, companyAmount: -2, personalAmount: 'nan' as unknown as number },
      }),
    );
    expect(bothBad.insurance?.companyAmount).toBe('请输入正确的金额');
    expect(bothBad.insurance?.personalAmount).toBe('请输入正确的金额');

    const onlyPersonal = validateSalaryRule(
      withRule({
        insurance: { enabled: true, companyAmount: 100, personalAmount: -1 },
      }),
    );
    expect(onlyPersonal.insurance?.companyAmount).toBeUndefined();
    expect(onlyPersonal.insurance?.personalAmount).toBe('请输入正确的金额');

    const bothOk = validateSalaryRule(
      withRule({
        insurance: { enabled: true, companyAmount: 100, personalAmount: 50 },
      }),
    );
    expect(bothOk.insurance).toBeUndefined();
  });

  it('统一课时费非法时报错', () => {
    expect(validateSalaryRule(withRule({ unifiedLessonRate: -5 })).unifiedLessonRate).toBe(
      '请输入正确的课时费',
    );
    expect(
      validateSalaryRule(withRule({ unifiedLessonRate: 'bad' as unknown as number }))
        .unifiedLessonRate,
    ).toBe('请输入正确的课时费');
  });

  it('提成阶梯：门槛与比例均可独立/组合报错', () => {
    const errors = validateSalaryRule(
      withRule({
        commissionTiers: [
          { id: 'c1', perfThreshold: -1, rate: -5 },
          { id: 'c2', perfThreshold: '', rate: 'x' as unknown as number },
        ],
      }),
    );
    expect(errors.commissionTiers?.c1?.perfThreshold).toBe('业绩门槛不能为负数');
    expect(errors.commissionTiers?.c1?.rate).toBe('提成比例不能为负数');
    expect(errors.commissionTiers?.c2?.rate).toBe('提成比例不能为负数');
    expect(errors.commissionTiers?.c2?.perfThreshold).toBeUndefined();
  });

  it('课时阶梯组：disabled 跳过；enabled 时 threshold/rate 非法报错', () => {
    const base = createDefaultSalaryRule();
    const errors = validateSalaryRule(
      withRule({
        lessonTierGroups: [
          {
            ...base.lessonTierGroups[0],
            enabled: false,
            tiers: [{ id: 'skip', threshold: -1, rate: -1 }],
          },
          {
            ...base.lessonTierGroups[1],
            enabled: true,
            type: 'private',
            tiers: [{ id: 't-bad', threshold: -3, rate: 'x' as unknown as number }],
          },
        ],
      }),
    );
    expect(errors.lessonTiers?.group).toBeUndefined();
    expect(errors.lessonTiers?.private?.['t-bad']?.threshold).toBe('门槛不能为负数');
    expect(errors.lessonTiers?.private?.['t-bad']?.rate).toBe('数值不能为负数');
  });

  it('attendance：min/max/rate 非法区间报错', () => {
    const errors = validateSalaryRule(
      withRule({
        attendanceTiers: [
          { id: 'a1', minCount: -1, maxCount: -2, rate: -3 },
          { id: 'a2', minCount: '', maxCount: 'bad' as unknown as number, rate: '' },
        ],
      }),
    );
    expect(errors.attendanceTiers?.a1?.minCount).toBe('不能为负数');
    expect(errors.attendanceTiers?.a1?.maxCount).toBe('不能为负数');
    expect(errors.attendanceTiers?.a1?.rate).toBe('不能为负数');
    expect(errors.attendanceTiers?.a2?.maxCount).toBe('不能为负数');
  });

  it('perfTiers：门槛与比例非法报错', () => {
    const errors = validateSalaryRule(
      withRule({
        perfTiers: [{ id: 'p1', threshold: -1, rate: 'x' as unknown as number }],
      }),
    );
    expect(errors.perfTiers?.p1?.threshold).toBe('不能为负数');
    expect(errors.perfTiers?.p1?.rate).toBe('不能为负数');
  });

  it('分类课时费 fixed / tier / perf 非法字段与组合规则', () => {
    const base = createDefaultSalaryRule();
    const [first, second, third] = base.categoryLessonFees;
    const errors = validateSalaryRule(
      withRule({
        categoryLessonFees: [
          { ...first, algorithm: 'fixed', fixedRate: -10 },
          {
            ...second,
            algorithm: 'tier',
            tiers: [{ id: 'ct-bad', threshold: -1, rate: -2 }],
          },
          {
            ...third,
            algorithm: 'perf',
            perfTiers: [{ id: 'cp-bad', threshold: -4, rate: 'x' as unknown as number }],
          },
        ],
      }),
    );
    expect(errors.categoryLessonFees?.[first.id]?.fixedRate).toBe('不能为负数');
    expect(errors.categoryLessonFees?.[second.id]?.tiers?.['ct-bad']?.threshold).toBe('不能为负数');
    expect(errors.categoryLessonFees?.[second.id]?.tiers?.['ct-bad']?.rate).toBe('不能为负数');
    expect(errors.categoryLessonFees?.[third.id]?.perfTiers?.['cp-bad']?.threshold).toBe(
      '不能为负数',
    );
    expect(errors.categoryLessonFees?.[third.id]?.perfTiers?.['cp-bad']?.rate).toBe('不能为负数');
  });

  it('助教补贴为负时报错', () => {
    const base = createDefaultSalaryRule();
    const errors = validateSalaryRule(
      withRule({
        categoryExtraFees: [{ ...base.categoryExtraFees[0], rate: -1 }],
      }),
    );
    expect(errors.categoryExtraFees?.[base.categoryExtraFees[0].id]).toBe('补贴不能为负数');
  });

  it('多模块同时非法时错误对象可并存（组合规则）', () => {
    const base = createDefaultSalaryRule();
    const errors = validateSalaryRule(
      withRule({
        fixedBaseAmount: -1,
        unifiedLessonRate: -2,
        commissionTiers: [{ id: 'c1', perfThreshold: -1, rate: '' }],
        attendanceTiers: [{ id: 'a1', minCount: -1, maxCount: '', rate: '' }],
        categoryExtraFees: [{ ...base.categoryExtraFees[0], rate: -9 }],
      }),
    );
    expect(isSalaryRuleValid(errors)).toBe(false);
    expect(errors.fixedBaseAmount).toBeTruthy();
    expect(errors.unifiedLessonRate).toBeTruthy();
    expect(errors.commissionTiers?.c1?.perfThreshold).toBeTruthy();
    expect(errors.attendanceTiers?.a1?.minCount).toBeTruthy();
    expect(errors.categoryExtraFees?.[base.categoryExtraFees[0].id]).toBeTruthy();
  });
});
