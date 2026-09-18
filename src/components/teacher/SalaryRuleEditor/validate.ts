import type { SalaryRuleConfig } from '@/types/teacher';
import type { CategoryLessonFeeErrors, SalaryRuleEditorErrors } from './types';

/** 纯校验：返回错误对象，不改状态 */
export function validateSalaryRule(value: SalaryRuleConfig): SalaryRuleEditorErrors {
  const next: SalaryRuleEditorErrors = {};

  if (value.baseMode === 'fixed') {
    const amount = Number(value.fixedBaseAmount);
    if (value.fixedBaseAmount !== '' && (Number.isNaN(amount) || amount < 0)) {
      next.fixedBaseAmount = '请输入正确的底薪金额';
    }
  }

  if (value.baseMode !== 'fixed') {
    value.baseTiers.forEach((t) => {
      const perf = Number(t.perfThreshold);
      const base = Number(t.baseAmount);
      if (t.perfThreshold !== '' && (Number.isNaN(perf) || perf < 0)) {
        next.baseTiers = next.baseTiers || {};
        next.baseTiers[t.id] = {
          ...(next.baseTiers[t.id] || {}),
          perfThreshold: '业绩门槛不能为负数',
        };
      }
      if (t.baseAmount !== '' && (Number.isNaN(base) || base < 0)) {
        next.baseTiers = next.baseTiers || {};
        next.baseTiers[t.id] = {
          ...(next.baseTiers[t.id] || {}),
          baseAmount: '底薪金额不能为负数',
        };
      }
    });
  }

  if (value.insurance.enabled) {
    const company = Number(value.insurance.companyAmount);
    const personal = Number(value.insurance.personalAmount);
    next.insurance = {};
    if (value.insurance.companyAmount !== '' && (Number.isNaN(company) || company < 0)) {
      next.insurance.companyAmount = '请输入正确的金额';
    }
    if (value.insurance.personalAmount !== '' && (Number.isNaN(personal) || personal < 0)) {
      next.insurance.personalAmount = '请输入正确的金额';
    }
    if (!next.insurance.companyAmount && !next.insurance.personalAmount) {
      delete (next as SalaryRuleEditorErrors).insurance;
    }
  }

  if (value.lessonFeeMode === 'unified') {
    const rate = Number(value.unifiedLessonRate);
    if (value.unifiedLessonRate !== '' && (Number.isNaN(rate) || rate < 0)) {
      next.unifiedLessonRate = '请输入正确的课时费';
    }
  }

  value.commissionTiers.forEach((t) => {
    const perf = Number(t.perfThreshold);
    const rate = Number(t.rate);
    if (t.perfThreshold !== '' && (Number.isNaN(perf) || perf < 0)) {
      next.commissionTiers = next.commissionTiers || {};
      next.commissionTiers[t.id] = {
        ...(next.commissionTiers[t.id] || {}),
        perfThreshold: '业绩门槛不能为负数',
      };
    }
    if (t.rate !== '' && (Number.isNaN(rate) || rate < 0)) {
      next.commissionTiers = next.commissionTiers || {};
      next.commissionTiers[t.id] = {
        ...(next.commissionTiers[t.id] || {}),
        rate: '提成比例不能为负数',
      };
    }
  });

  value.lessonTierGroups.forEach((g) => {
    if (!g.enabled) return;
    g.tiers.forEach((t) => {
      const threshold = Number(t.threshold);
      const rate = Number(t.rate);
      if (t.threshold !== '' && (Number.isNaN(threshold) || threshold < 0)) {
        next.lessonTiers = next.lessonTiers || {};
        next.lessonTiers[g.type] = next.lessonTiers[g.type] || {};
        next.lessonTiers[g.type]![t.id] = {
          ...(next.lessonTiers[g.type]![t.id] || {}),
          threshold: '门槛不能为负数',
        };
      }
      if (t.rate !== '' && (Number.isNaN(rate) || rate < 0)) {
        next.lessonTiers = next.lessonTiers || {};
        next.lessonTiers[g.type] = next.lessonTiers[g.type] || {};
        next.lessonTiers[g.type]![t.id] = {
          ...(next.lessonTiers[g.type]![t.id] || {}),
          rate: '数值不能为负数',
        };
      }
    });
  });

  if (value.lessonFeeMode === 'by_attendance' || value.lessonFeeMode === 'by_person_per_lesson') {
    const sortedTiers = [...value.attendanceTiers].sort(
      (a, b) => Number(a.minCount || 0) - Number(b.minCount || 0),
    );
    sortedTiers.forEach((t, index) => {
      const minCount = Number(t.minCount);
      const maxCount = Number(t.maxCount);
      const rate = Number(t.rate);
      next.attendanceTiers = next.attendanceTiers || {};
      const itemErrors = next.attendanceTiers[t.id] || {};
      if (t.minCount === '' || Number.isNaN(minCount) || minCount < 0) {
        itemErrors.minCount = '请输入非负人数下限';
      }
      if (t.maxCount !== '' && (Number.isNaN(maxCount) || maxCount < minCount)) {
        itemErrors.maxCount = '人数上限不能小于下限';
      }
      if (t.rate === '' || Number.isNaN(rate) || rate < 0) {
        itemErrors.rate = '请输入非负单价';
      }
      const previous = sortedTiers[index - 1];
      if (previous && previous.maxCount !== '' && Number(previous.maxCount) >= minCount) {
        itemErrors.minCount = '人数区间不能重叠';
      }
      if (Object.keys(itemErrors).length > 0) {
        next.attendanceTiers[t.id] = itemErrors;
      }
    });
    if (next.attendanceTiers && Object.keys(next.attendanceTiers).length === 0) {
      delete next.attendanceTiers;
    }
  }

  value.perfTiers.forEach((t) => {
    const threshold = Number(t.threshold);
    const rate = Number(t.rate);
    if (t.threshold !== '' && (Number.isNaN(threshold) || threshold < 0)) {
      next.perfTiers = next.perfTiers || {};
      next.perfTiers[t.id] = { ...(next.perfTiers[t.id] || {}), threshold: '不能为负数' };
    }
    if (t.rate !== '' && (Number.isNaN(rate) || rate < 0)) {
      next.perfTiers = next.perfTiers || {};
      next.perfTiers[t.id] = { ...(next.perfTiers[t.id] || {}), rate: '不能为负数' };
    }
  });

  value.categoryLessonFees.forEach((e) => {
    const itemErr: CategoryLessonFeeErrors = {};
    if (e.algorithm === 'fixed') {
      const fixed = Number(e.fixedRate);
      if (e.fixedRate !== '' && (Number.isNaN(fixed) || fixed < 0)) {
        itemErr.fixedRate = '不能为负数';
      }
    }
    if (e.algorithm === 'tier') {
      e.tiers.forEach((t) => {
        const threshold = Number(t.threshold);
        const rate = Number(t.rate);
        if (t.threshold !== '' && (Number.isNaN(threshold) || threshold < 0)) {
          itemErr.tiers = itemErr.tiers || {};
          itemErr.tiers[t.id] = { ...(itemErr.tiers[t.id] || {}), threshold: '不能为负数' };
        }
        if (t.rate !== '' && (Number.isNaN(rate) || rate < 0)) {
          itemErr.tiers = itemErr.tiers || {};
          itemErr.tiers[t.id] = { ...(itemErr.tiers[t.id] || {}), rate: '不能为负数' };
        }
      });
    }
    if (e.algorithm === 'perf') {
      e.perfTiers.forEach((t) => {
        const threshold = Number(t.threshold);
        const rate = Number(t.rate);
        if (t.threshold !== '' && (Number.isNaN(threshold) || threshold < 0)) {
          itemErr.perfTiers = itemErr.perfTiers || {};
          itemErr.perfTiers[t.id] = {
            ...(itemErr.perfTiers[t.id] || {}),
            threshold: '不能为负数',
          };
        }
        if (t.rate !== '' && (Number.isNaN(rate) || rate < 0)) {
          itemErr.perfTiers = itemErr.perfTiers || {};
          itemErr.perfTiers[t.id] = { ...(itemErr.perfTiers[t.id] || {}), rate: '不能为负数' };
        }
      });
    }
    if (itemErr.tiers && Object.keys(itemErr.tiers).length === 0) {
      delete itemErr.tiers;
    }
    if (itemErr.perfTiers && Object.keys(itemErr.perfTiers).length === 0) {
      delete itemErr.perfTiers;
    }
    if (Object.keys(itemErr).length > 0) {
      next.categoryLessonFees = next.categoryLessonFees || {};
      next.categoryLessonFees[e.id] = itemErr;
    }
  });

  value.categoryExtraFees.forEach((e) => {
    const rate = Number(e.rate);
    if (e.rate !== '' && (Number.isNaN(rate) || rate < 0)) {
      next.categoryExtraFees = next.categoryExtraFees || {};
      next.categoryExtraFees[e.id] = '补贴不能为负数';
    }
  });

  return next;
}

export function isSalaryRuleValid(errors: SalaryRuleEditorErrors): boolean {
  return Object.keys(errors).length === 0;
}
