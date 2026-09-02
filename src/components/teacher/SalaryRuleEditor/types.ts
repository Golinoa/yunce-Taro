import type { SalaryRuleConfig } from '@/types/teacher';

export interface SalaryRuleEditorProps {
  value: SalaryRuleConfig;
  onChange: (next: SalaryRuleConfig) => void;
  /** 是否显示底部上方的"薪资模板"按钮（员工页显示，模板页不） */
  showTemplateButton?: boolean;
  /** 点击"薪资模板"按钮 */
  onPickTemplate?: () => void;
  /** 是否显示内置保存按钮，页面统一承载时可设为 false */
  showSaveButton?: boolean;
  /** 保存按钮文字 */
  saveText?: string;
  /** 点击保存 */
  onSave?: () => void;
  /** 保存中状态 */
  saving?: boolean;
  /** 页面标题（员工工资设置页显示在顶部） */
  pageTitle?: string;
  /** 是否用 Card 包裹规则配置区域，默认 true；员工工资设置页需要与套用模板共用一个 Card 时可设为 false */
  wrapInCard?: boolean;
}

export interface CategoryLessonFeeErrors {
  fixedRate?: string;
  tiers?: Record<string, { threshold?: string; rate?: string }>;
  perfTiers?: Record<string, { threshold?: string; rate?: string }>;
}

export interface SalaryRuleEditorErrors {
  fixedBaseAmount?: string;
  insurance?: { companyAmount?: string; personalAmount?: string };
  unifiedLessonRate?: string;
  baseTiers?: Record<string, { perfThreshold?: string; baseAmount?: string }>;
  commissionTiers?: Record<string, { perfThreshold?: string; rate?: string }>;
  lessonTiers?: Partial<
    Record<'group' | 'private', Record<string, { threshold?: string; rate?: string }>>
  >;
  attendanceTiers?: Record<string, { minCount?: string; maxCount?: string; rate?: string }>;
  perfTiers?: Record<string, { threshold?: string; rate?: string }>;
  categoryExtraFees?: Record<string, string>;
  categoryLessonFees?: Record<string, CategoryLessonFeeErrors>;
}
