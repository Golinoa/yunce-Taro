/**
 * SalaryRuleEditor - 薪资规则配置编辑器（核心组件）
 *
 * 适用于：
 *  - 员工工资设置详情页
 *  - 薪资模板新建 / 编辑页
 *
 * 配置项覆盖：
 *  底薪（固定/按个人/按全店业绩）+ 医社保 + 课时费
 *  （统一/按课程设置/按上课人数/按月课量阶梯/按业绩阶梯）
 *  + 按课程分类单独设置 + 担任助教补贴 + 提成（无/个人/全店业绩）
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import FormRow from '@/components/FormRow';
import Icon from '@/components/Icon';
import Switch from '@/components/Switch';
import { courseCategoryService } from '@/services/course-category';
import { courseTemplateService } from '@/services/course-template';
import type { CourseCategoryConfig } from '@/types/course-category';
import type { CourseTemplate } from '@/types/course-template';
import type {
  AttendanceTier,
  BaseSalaryMode,
  CalcMethod,
  CategoryFeeAlgorithm,
  CategoryLessonFee,
  CommissionMode,
  CommissionTier,
  CourseFeeItem,
  CourseGroupFee,
  CourseGroupType,
  FeeBasis,
  InsuranceConfig,
  LessonFeeMode,
  LessonTierGroup,
  PerfPayoutMode,
  PerfTier,
  SalaryRuleConfig,
  BaseSalaryTier,
} from '@/types/teacher';
import EditorSection from './EditorSection';
import GradientRow from './GradientRow';

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

// ====================== 选项 ======================
const BASE_MODE_OPTIONS: { label: string; value: BaseSalaryMode }[] = [
  { label: '固定金额无责底薪', value: 'fixed' },
  { label: '按个人业绩计算', value: 'personal_perf' },
  { label: '按全店业绩计算', value: 'shop_perf' },
];

const INSURANCE_OPTIONS = [
  { label: '不缴纳医社保', value: 'off' },
  { label: '缴纳医社保', value: 'on' },
];

const LESSON_FEE_MODE_OPTIONS: { label: string; value: LessonFeeMode }[] = [
  { label: '统一课时费', value: 'unified' },
  { label: '按课程设置', value: 'by_course' },
  { label: '按上课人数', value: 'by_attendance' },
  { label: '按月课量阶梯', value: 'by_monthly_tier' },
  { label: '按业绩阶梯', value: 'by_perf_tier' },
];

const COMMISSION_MODE_OPTIONS: { label: string; value: CommissionMode }[] = [
  { label: '无提成', value: 'none' },
  { label: '按个人业绩计算', value: 'personal_perf' },
  { label: '按全店业绩计算', value: 'shop_perf' },
];

const FEE_BASIS_OPTIONS: { label: string; value: FeeBasis }[] = [
  { label: '按课时数(元/节)', value: 'hours' },
  { label: '按上课业绩(%)', value: 'perf' },
];

const CALC_METHOD_OPTIONS: { label: string; value: CalcMethod }[] = [
  { label: '全部按最高档', value: 'tier_unified' },
  { label: '分段累加', value: 'tier_progressive' },
];

const CATEGORY_ALGORITHM_OPTIONS: { label: string; value: CategoryFeeAlgorithm }[] = [
  { label: '跟随默认', value: 'default' },
  { label: '固定单价', value: 'fixed' },
  { label: '课量阶梯', value: 'tier' },
  { label: '业绩阶梯', value: 'perf' },
];

const PERF_PAYOUT_OPTIONS: { label: string; value: PerfPayoutMode }[] = [
  { label: '消课金额×比例%', value: 'revenue_share' },
  { label: '固定元/节', value: 'fixed' },
];

/** 各配置项的问号提示文案 */
const HINTS: Record<string, string> = {
  base: '选择固定金额时只需填写底薪；选择业绩模式时可按业绩区间设置阶梯底薪。',
  insurance: '开启后将从工资中扣除个人缴交部分，公司缴交部分计入用工成本。',
  lessonFee:
    '统一课时费：所有课程同一标准。按课程设置：不同课程单独定价。按上课人数：按每节课实际到课人数落档。按月课量阶梯：按当月累计课量落档。按业绩阶梯：按当月个人卖卡业绩定档。',
  attendance: '按单节课实际到课人数落档计费，例如 1-5 人 80 元/节、6-10 人 100 元/节。',
  perfTier:
    '按当月个人卖卡业绩达到的最高档结算课时费，到档发放可选择「消课金额×比例」或「固定元/节」。',
  categoryLessonFee:
    '给某个课程分类单独指定课时费算法（如团课分类固定单价、私教分类按业绩阶梯），未单独设置的分类仍按上方默认方式计。业绩阶梯按当月个人卖卡业绩定档，到档发放可选「消课金额×比例」或「固定元/节」。',
  categoryExtra: '员工以助教身份带的课，每节额外发的固定金额；不影响主教身份课时费。',
  commission: '选择业绩提成后，可按业绩区间设置不同提成比例。',
};

/** 模式标签映射 */
const CATEGORY_MODE_LABEL: Record<CourseGroupType, string> = {
  class: '班课',
  group: '团课',
  private: '私教',
  custom: '自定义',
};

// ====================== 校验类型 ======================
interface CategoryLessonFeeErrors {
  fixedRate?: string;
  tiers?: Record<string, { threshold?: string; rate?: string }>;
  perfTiers?: Record<string, { threshold?: string; rate?: string }>;
}

interface SalaryRuleEditorErrors {
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

// ====================== 辅助：修改局部 ======================
function uid() {
  return `r${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** 把课程分类模式映射为分组类型 */
function toGroupType(mode: string): CourseGroupType {
  if (mode === 'class' || mode === 'group' || mode === 'private') return mode;
  return 'custom';
}

/** 根据分类和课程模板构建/补全「按课程设置」分组 */
function buildCourseGroupFees(
  categories: CourseCategoryConfig[],
  templates: CourseTemplate[],
  existing: CourseGroupFee[],
): CourseGroupFee[] {
  return categories.map((cat) => {
    const existingGroup = existing.find((g) => g.categoryId === cat.id);
    const groupType = toGroupType(cat.mode);
    const catTemplates = templates.filter((t) => t.categoryId === cat.id);
    const existingCourses = existingGroup?.courses || [];

    const courses: CourseFeeItem[] = catTemplates.map((t) => {
      const existingCourse = existingCourses.find((c) => c.courseId === t.id);
      return {
        id: existingCourse?.id || uid(),
        courseId: t.id,
        courseName: t.name,
        useRevenueShare: existingCourse?.useRevenueShare ?? false,
        rate: existingCourse?.rate ?? '',
      };
    });

    return {
      categoryId: cat.id,
      groupType,
      groupName: cat.name,
      useRevenueShare: existingGroup?.useRevenueShare ?? false,
      courses,
    };
  });
}

/** 创建单个分类的默认单独设置 */
function createDefaultCategoryLessonFee(cat: CourseCategoryConfig): CategoryLessonFee {
  return {
    id: uid(),
    categoryId: cat.id,
    name: cat.name,
    groupType: toGroupType(cat.mode),
    algorithm: 'default',
    fixedRate: '',
    tiers: [{ id: uid(), threshold: '', rate: '' }],
    feeBasis: 'hours',
    calcMethod: 'tier_unified',
    perfTiers: [{ id: uid(), threshold: '', rate: '' }],
    perfPayoutMode: 'revenue_share',
  };
}

/** 根据分类构建/补全「按课程分类单独设置」 */
function buildCategoryLessonFees(
  categories: CourseCategoryConfig[],
  existing: CategoryLessonFee[],
): CategoryLessonFee[] {
  return categories.map((cat) => {
    const existingItem = existing.find((e) => e.categoryId === cat.id);
    if (existingItem) {
      return {
        ...existingItem,
        name: cat.name,
        groupType: toGroupType(cat.mode),
      };
    }
    return createDefaultCategoryLessonFee(cat);
  });
}

const SalaryRuleEditor: React.FC<SalaryRuleEditorProps> = ({
  value,
  onChange,
  showTemplateButton = false,
  onPickTemplate,
  showSaveButton = true,
  saveText = '保存',
  onSave,
  saving = false,
  pageTitle,
  wrapInCard = true,
}) => {
  const [errors, setErrors] = useState<SalaryRuleEditorErrors>({});
  const [categories, setCategories] = useState<CourseCategoryConfig[]>([]);
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [categorySectionExpanded, setCategorySectionExpanded] = useState(false);
  const syncedRef = useRef(false);

  const RuleWrapper = wrapInCard ? Card : View;

  const patch = useCallback(
    (partial: Partial<SalaryRuleConfig>) => onChange({ ...value, ...partial }),
    [value, onChange],
  );

  // 加载课程分类与课程模板
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, tpls] = await Promise.all([
          courseCategoryService.getList(),
          courseTemplateService.getList(),
        ]);
        if (cancelled) return;
        setCategories(cats);
        setTemplates(tpls);
        setCoursesLoaded(true);
      } catch {
        // 静默失败，保持空列表
        setCoursesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 数据加载完成后，补全/同步 courseGroupFees 与 categoryLessonFees
  useEffect(() => {
    if (!coursesLoaded || syncedRef.current) return;
    syncedRef.current = true;

    const nextCourseGroupFees = buildCourseGroupFees(categories, templates, value.courseGroupFees);
    const nextCategoryLessonFees = buildCategoryLessonFees(categories, value.categoryLessonFees);

    const courseGroupChanged =
      nextCourseGroupFees.length !== value.courseGroupFees.length ||
      nextCourseGroupFees.some((g, idx) => {
        const old = value.courseGroupFees[idx];
        return (
          !old ||
          g.categoryId !== old.categoryId ||
          g.courses.length !== old.courses.length ||
          g.courses.some((c, cidx) => {
            const oldC = old.courses[cidx];
            return !oldC || c.courseId !== oldC.courseId;
          })
        );
      });

    const categoryLessonChanged =
      nextCategoryLessonFees.length !== value.categoryLessonFees.length ||
      nextCategoryLessonFees.some((item, idx) => {
        const old = value.categoryLessonFees[idx];
        return !old || item.categoryId !== old.categoryId;
      });

    if (courseGroupChanged || categoryLessonChanged) {
      patch({
        courseGroupFees: nextCourseGroupFees,
        categoryLessonFees: nextCategoryLessonFees,
      });
    }
  }, [
    coursesLoaded,
    categories,
    templates,
    value.courseGroupFees,
    value.categoryLessonFees,
    patch,
  ]);

  // ================= 校验 =================
  const validate = useCallback((): boolean => {
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

    value.attendanceTiers.forEach((t) => {
      const minCount = Number(t.minCount);
      const maxCount = Number(t.maxCount);
      const rate = Number(t.rate);
      next.attendanceTiers = next.attendanceTiers || {};
      if (t.minCount !== '' && (Number.isNaN(minCount) || minCount < 0)) {
        next.attendanceTiers[t.id] = {
          ...(next.attendanceTiers[t.id] || {}),
          minCount: '不能为负数',
        };
      }
      if (t.maxCount !== '' && (Number.isNaN(maxCount) || maxCount < 0)) {
        next.attendanceTiers[t.id] = {
          ...(next.attendanceTiers[t.id] || {}),
          maxCount: '不能为负数',
        };
      }
      if (t.rate !== '' && (Number.isNaN(rate) || rate < 0)) {
        next.attendanceTiers[t.id] = { ...(next.attendanceTiers[t.id] || {}), rate: '不能为负数' };
      }
    });

    value.perfTiers.forEach((t) => {
      const threshold = Number(t.threshold);
      const rate = Number(t.rate);
      next.perfTiers = next.perfTiers || {};
      if (t.threshold !== '' && (Number.isNaN(threshold) || threshold < 0)) {
        next.perfTiers[t.id] = { ...(next.perfTiers[t.id] || {}), threshold: '不能为负数' };
      }
      if (t.rate !== '' && (Number.isNaN(rate) || rate < 0)) {
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
          itemErr.tiers = itemErr.tiers || {};
          if (t.threshold !== '' && (Number.isNaN(threshold) || threshold < 0)) {
            itemErr.tiers[t.id] = { ...(itemErr.tiers[t.id] || {}), threshold: '不能为负数' };
          }
          if (t.rate !== '' && (Number.isNaN(rate) || rate < 0)) {
            itemErr.tiers[t.id] = { ...(itemErr.tiers[t.id] || {}), rate: '不能为负数' };
          }
        });
      }
      if (e.algorithm === 'perf') {
        e.perfTiers.forEach((t) => {
          const threshold = Number(t.threshold);
          const rate = Number(t.rate);
          itemErr.perfTiers = itemErr.perfTiers || {};
          if (t.threshold !== '' && (Number.isNaN(threshold) || threshold < 0)) {
            itemErr.perfTiers[t.id] = {
              ...(itemErr.perfTiers[t.id] || {}),
              threshold: '不能为负数',
            };
          }
          if (t.rate !== '' && (Number.isNaN(rate) || rate < 0)) {
            itemErr.perfTiers[t.id] = { ...(itemErr.perfTiers[t.id] || {}), rate: '不能为负数' };
          }
        });
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

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [value]);

  const handleSave = useCallback(() => {
    if (!validate()) {
      Taro.showToast({ title: '请检查表单填写', icon: 'none' });
      return;
    }
    onSave?.();
  }, [validate, onSave]);

  // ================= 底薪 =================
  const handleBaseModeChange = useCallback(
    (v: string) => {
      const mode = v as BaseSalaryMode;
      patch({
        baseMode: mode,
        baseTiers:
          mode === 'fixed'
            ? []
            : value.baseTiers.length > 0
              ? value.baseTiers
              : [{ id: uid(), perfThreshold: '', baseAmount: '' }],
      });
    },
    [patch, value.baseTiers],
  );

  const updateBaseTier = useCallback(
    (id: string, key: 'perfThreshold' | 'baseAmount', raw: string) => {
      patch({
        baseTiers: value.baseTiers.map((t) =>
          t.id === id ? { ...t, [key]: raw === '' ? '' : Number(raw) } : t,
        ) as BaseSalaryTier[],
      });
    },
    [patch, value.baseTiers],
  );

  const deleteBaseTier = useCallback(
    (id: string) => {
      patch({ baseTiers: value.baseTiers.filter((t) => t.id !== id) });
    },
    [patch, value.baseTiers],
  );

  const addBaseTier = useCallback(() => {
    patch({
      baseTiers: [...value.baseTiers, { id: uid(), perfThreshold: '', baseAmount: '' }],
    });
  }, [patch, value.baseTiers]);

  // ================= 医社保 =================
  const handleInsuranceToggle = useCallback(
    (v: string) => {
      const enabled = v === 'on';
      patch({
        insurance: { ...value.insurance, enabled } as InsuranceConfig,
      });
    },
    [patch, value.insurance],
  );

  // ================= 课时费 模式切换 =================
  const handleLessonModeChange = useCallback(
    (v: string) => {
      patch({ lessonFeeMode: v as LessonFeeMode });
    },
    [patch],
  );

  // ================= 课时费：按课程设置 =================
  const toggleCourseShare = useCallback(
    (categoryId: string, on: boolean) => {
      patch({
        courseGroupFees: value.courseGroupFees.map((g) =>
          g.categoryId === categoryId ? { ...g, useRevenueShare: on } : g,
        ),
      });
    },
    [patch, value.courseGroupFees],
  );

  const updateCourseRate = useCallback(
    (categoryId: string, courseId: string, raw: string) => {
      patch({
        courseGroupFees: value.courseGroupFees.map((g) =>
          g.categoryId === categoryId
            ? {
                ...g,
                courses: g.courses.map((c) =>
                  c.courseId === courseId ? { ...c, rate: raw === '' ? '' : Number(raw) } : c,
                ),
              }
            : g,
        ),
      });
    },
    [patch, value.courseGroupFees],
  );

  const toggleCourseItemShare = useCallback(
    (categoryId: string, courseId: string, on: boolean) => {
      patch({
        courseGroupFees: value.courseGroupFees.map((g) =>
          g.categoryId === categoryId
            ? {
                ...g,
                courses: g.courses.map((c) =>
                  c.courseId === courseId ? { ...c, useRevenueShare: on } : c,
                ),
              }
            : g,
        ),
      });
    },
    [patch, value.courseGroupFees],
  );

  // ================= 课时费：按上课人数 =================
  const updateAttendanceTier = useCallback(
    (id: string, key: 'minCount' | 'maxCount' | 'rate', raw: string) => {
      patch({
        attendanceTiers: value.attendanceTiers.map((t) =>
          t.id === id ? { ...t, [key]: raw === '' ? '' : Number(raw) } : t,
        ) as AttendanceTier[],
      });
    },
    [patch, value.attendanceTiers],
  );

  const deleteAttendanceTier = useCallback(
    (id: string) => {
      patch({ attendanceTiers: value.attendanceTiers.filter((t) => t.id !== id) });
    },
    [patch, value.attendanceTiers],
  );

  const addAttendanceTier = useCallback(() => {
    patch({
      attendanceTiers: [
        ...value.attendanceTiers,
        { id: uid(), minCount: '', maxCount: '', rate: '' },
      ],
    });
  }, [patch, value.attendanceTiers]);

  // ================= 课时费：按月课量阶梯 =================
  const toggleTierGroup = useCallback(
    (type: 'group' | 'private', on: boolean) => {
      patch({
        lessonTierGroups: value.lessonTierGroups.map((g) =>
          g.type === type ? { ...g, enabled: on } : g,
        ),
      });
    },
    [patch, value.lessonTierGroups],
  );

  const changeTierGroupBasis = useCallback(
    (type: 'group' | 'private', basis: FeeBasis) => {
      patch({
        lessonTierGroups: value.lessonTierGroups.map((g) =>
          g.type === type ? { ...g, feeBasis: basis } : g,
        ),
      });
    },
    [patch, value.lessonTierGroups],
  );

  const changeTierGroupCalc = useCallback(
    (type: 'group' | 'private', method: CalcMethod) => {
      patch({
        lessonTierGroups: value.lessonTierGroups.map((g) =>
          g.type === type ? { ...g, calcMethod: method } : g,
        ),
      });
    },
    [patch, value.lessonTierGroups],
  );

  const updateTierRow = useCallback(
    (groupType: 'group' | 'private', tierId: string, key: 'threshold' | 'rate', raw: string) => {
      patch({
        lessonTierGroups: value.lessonTierGroups.map((g) =>
          g.type === groupType
            ? {
                ...g,
                tiers: g.tiers.map((t) =>
                  t.id === tierId ? { ...t, [key]: raw === '' ? '' : Number(raw) } : t,
                ),
              }
            : g,
        ) as LessonTierGroup[],
      });
    },
    [patch, value.lessonTierGroups],
  );

  const deleteTierRow = useCallback(
    (groupType: 'group' | 'private', tierId: string) => {
      patch({
        lessonTierGroups: value.lessonTierGroups.map((g) =>
          g.type === groupType ? { ...g, tiers: g.tiers.filter((t) => t.id !== tierId) } : g,
        ),
      });
    },
    [patch, value.lessonTierGroups],
  );

  const addTierRow = useCallback(
    (groupType: 'group' | 'private') => {
      patch({
        lessonTierGroups: value.lessonTierGroups.map((g) =>
          g.type === groupType
            ? { ...g, tiers: [...g.tiers, { id: uid(), threshold: '', rate: '' }] }
            : g,
        ),
      });
    },
    [patch, value.lessonTierGroups],
  );

  // ================= 课时费：按业绩阶梯 =================
  const updatePerfTier = useCallback(
    (id: string, key: 'threshold' | 'rate', raw: string) => {
      patch({
        perfTiers: value.perfTiers.map((t) =>
          t.id === id ? { ...t, [key]: raw === '' ? '' : Number(raw) } : t,
        ) as PerfTier[],
      });
    },
    [patch, value.perfTiers],
  );

  const deletePerfTier = useCallback(
    (id: string) => {
      patch({ perfTiers: value.perfTiers.filter((t) => t.id !== id) });
    },
    [patch, value.perfTiers],
  );

  const addPerfTier = useCallback(() => {
    patch({ perfTiers: [...value.perfTiers, { id: uid(), threshold: '', rate: '' }] });
  }, [patch, value.perfTiers]);

  // ================= 按课程分类单独设置 =================
  const updateCategoryLessonAlgorithm = useCallback(
    (id: string, algorithm: CategoryFeeAlgorithm) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id ? { ...item, algorithm } : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  const updateCategoryLessonFixedRate = useCallback(
    (id: string, raw: string) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id ? { ...item, fixedRate: raw === '' ? '' : Number(raw) } : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  const updateCategoryLessonBasis = useCallback(
    (id: string, basis: FeeBasis) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id ? { ...item, feeBasis: basis } : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  const updateCategoryLessonCalc = useCallback(
    (id: string, method: CalcMethod) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id ? { ...item, calcMethod: method } : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  const updateCategoryLessonPerfPayout = useCallback(
    (id: string, mode: PerfPayoutMode) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id ? { ...item, perfPayoutMode: mode } : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  const updateCategoryLessonTier = useCallback(
    (id: string, tierId: string, key: 'threshold' | 'rate', raw: string) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id
            ? {
                ...item,
                tiers: item.tiers.map((t) =>
                  t.id === tierId ? { ...t, [key]: raw === '' ? '' : Number(raw) } : t,
                ),
              }
            : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  const addCategoryLessonTier = useCallback(
    (id: string) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id
            ? { ...item, tiers: [...item.tiers, { id: uid(), threshold: '', rate: '' }] }
            : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  const deleteCategoryLessonTier = useCallback(
    (id: string, tierId: string) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id ? { ...item, tiers: item.tiers.filter((t) => t.id !== tierId) } : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  const updateCategoryLessonPerfTier = useCallback(
    (id: string, tierId: string, key: 'threshold' | 'rate', raw: string) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id
            ? {
                ...item,
                perfTiers: item.perfTiers.map((t) =>
                  t.id === tierId ? { ...t, [key]: raw === '' ? '' : Number(raw) } : t,
                ),
              }
            : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  const addCategoryLessonPerfTier = useCallback(
    (id: string) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id
            ? { ...item, perfTiers: [...item.perfTiers, { id: uid(), threshold: '', rate: '' }] }
            : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  const deleteCategoryLessonPerfTier = useCallback(
    (id: string, tierId: string) => {
      patch({
        categoryLessonFees: value.categoryLessonFees.map((item) =>
          item.id === id
            ? { ...item, perfTiers: item.perfTiers.filter((t) => t.id !== tierId) }
            : item,
        ),
      });
    },
    [patch, value.categoryLessonFees],
  );

  // ================= 分类单独设置（助教等） =================
  const updateCategoryFee = useCallback(
    (id: string, raw: string) => {
      patch({
        categoryExtraFees: value.categoryExtraFees.map((e) =>
          e.id === id ? { ...e, rate: raw === '' ? '' : Number(raw) } : e,
        ),
      });
    },
    [patch, value.categoryExtraFees],
  );

  // ================= 提成设置 =================
  const handleCommissionMode = useCallback(
    (v: string) => {
      const mode = v as CommissionMode;
      patch({
        commissionMode: mode,
        commissionTiers:
          mode === 'none'
            ? []
            : value.commissionTiers.length > 0
              ? value.commissionTiers
              : [{ id: uid(), perfThreshold: '', rate: '' }],
      });
    },
    [patch, value.commissionTiers],
  );

  const updateCommissionTier = useCallback(
    (id: string, key: 'perfThreshold' | 'rate', raw: string) => {
      patch({
        commissionTiers: value.commissionTiers.map((t) =>
          t.id === id ? { ...t, [key]: raw === '' ? '' : Number(raw) } : t,
        ) as CommissionTier[],
      });
    },
    [patch, value.commissionTiers],
  );

  const deleteCommissionTier = useCallback(
    (id: string) => {
      patch({ commissionTiers: value.commissionTiers.filter((t) => t.id !== id) });
    },
    [patch, value.commissionTiers],
  );

  const addCommissionTier = useCallback(() => {
    patch({
      commissionTiers: [...value.commissionTiers, { id: uid(), perfThreshold: '', rate: '' }],
    });
  }, [patch, value.commissionTiers]);

  // ================= 统计已单独设置的分类数 =================
  const customizedCategoryCount = useMemo(
    () => value.categoryLessonFees.filter((item) => item.algorithm !== 'default').length,
    [value.categoryLessonFees],
  );

  return (
    <View className="flex flex-col">
      {/* 0. 页面标题（员工工资设置页） */}
      {pageTitle && (
        <View className="px-[32rpx] pt-[24rpx] pb-[12rpx]">
          <Text className="text-[40rpx] font-bold text-foreground">{pageTitle}</Text>
        </View>
      )}

      {/* 规则配置卡片 */}
      <RuleWrapper className={cn('flex flex-col gap-[24rpx]', wrapInCard && 'p-[32rpx]')}>
        {/* 1. 底薪设置 */}
        <EditorSection
          title="底薪设置"
          hint={HINTS.base}
          selectorOptions={BASE_MODE_OPTIONS as { label: string; value: string }[]}
          selectorValue={value.baseMode}
          onSelectorChange={handleBaseModeChange}
        >
          {value.baseMode === 'fixed' ? (
            <FormRow
              label="固定工资"
              editable
              inputType="digit"
              placeholder="0"
              suffix="元"
              value={String(value.fixedBaseAmount ?? '')}
              onInput={(e) => {
                const raw = e.detail.value;
                patch({ fixedBaseAmount: raw === '' ? '' : Number(raw) });
              }}
              error={errors.fixedBaseAmount}
            />
          ) : (
            <View>
              <Text className="text-[28rpx] font-bold text-primary mb-[8rpx] block">阶梯设置</Text>
              {value.baseTiers.map((t, idx) => (
                <GradientRow
                  key={t.id}
                  fields={[
                    {
                      key: 'perfThreshold',
                      label: '业绩达到：',
                      suffix: '元,',
                      error: errors.baseTiers?.[t.id]?.perfThreshold,
                    },
                    {
                      key: 'baseAmount',
                      label: '底薪为：',
                      suffix: '元',
                      error: errors.baseTiers?.[t.id]?.baseAmount,
                    },
                  ]}
                  values={{
                    perfThreshold: String(t.perfThreshold ?? ''),
                    baseAmount: String(t.baseAmount ?? ''),
                  }}
                  onChange={(k, raw) =>
                    updateBaseTier(t.id, k as 'perfThreshold' | 'baseAmount', raw)
                  }
                  showDelete={value.baseTiers.length > 1 || idx > 0}
                  onDelete={() => deleteBaseTier(t.id)}
                />
              ))}
              <GradientRow asAddButton onAdd={addBaseTier} />
            </View>
          )}
        </EditorSection>

        {/* 2. 医社保 */}
        <EditorSection
          title="医社保"
          hint={HINTS.insurance}
          selectorOptions={INSURANCE_OPTIONS}
          selectorValue={value.insurance.enabled ? 'on' : 'off'}
          onSelectorChange={handleInsuranceToggle}
        >
          {value.insurance.enabled && (
            <View className="flex flex-col gap-[12rpx]">
              <FormRow
                label="公司缴交金额"
                editable
                inputType="digit"
                placeholder="0"
                suffix="元"
                value={String(value.insurance.companyAmount ?? '')}
                onInput={(e) => {
                  const raw = e.detail.value;
                  patch({
                    insurance: {
                      ...value.insurance,
                      companyAmount: raw === '' ? '' : Number(raw),
                    },
                  });
                }}
                error={errors.insurance?.companyAmount}
              />
              <FormRow
                label="个人缴交金额"
                editable
                inputType="digit"
                placeholder="0"
                suffix="元"
                value={String(value.insurance.personalAmount ?? '')}
                onInput={(e) => {
                  const raw = e.detail.value;
                  patch({
                    insurance: {
                      ...value.insurance,
                      personalAmount: raw === '' ? '' : Number(raw),
                    },
                  });
                }}
                error={errors.insurance?.personalAmount}
              />
            </View>
          )}
        </EditorSection>

        {/* 3. 课时费 */}
        <EditorSection
          title="课时费"
          hint={HINTS.lessonFee}
          selectorOptions={LESSON_FEE_MODE_OPTIONS as { label: string; value: string }[]}
          selectorValue={value.lessonFeeMode}
          onSelectorChange={handleLessonModeChange}
        >
          {value.lessonFeeMode === 'unified' && (
            <View>
              <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
                所有课程按同一固定金额计算课时费。
              </Text>
              <FormRow
                label="统一课时费"
                editable
                inputType="digit"
                placeholder="0"
                suffix="元/课时"
                value={String(value.unifiedLessonRate ?? '')}
                onInput={(e) => {
                  const raw = e.detail.value;
                  patch({ unifiedLessonRate: raw === '' ? '' : Number(raw) });
                }}
                error={errors.unifiedLessonRate}
              />
            </View>
          )}

          {value.lessonFeeMode === 'by_course' && (
            <CourseGroupFeeEditor
              groups={value.courseGroupFees}
              errors={errors}
              onToggleShare={toggleCourseShare}
              onToggleItemShare={toggleCourseItemShare}
              onUpdateRate={updateCourseRate}
            />
          )}

          {value.lessonFeeMode === 'by_attendance' && (
            <AttendanceTierEditor
              tiers={value.attendanceTiers}
              errors={errors.attendanceTiers}
              onChange={updateAttendanceTier}
              onDelete={deleteAttendanceTier}
              onAdd={addAttendanceTier}
            />
          )}

          {value.lessonFeeMode === 'by_monthly_tier' && (
            <View className="flex flex-col">
              <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
                按当月累计课时数或上课业绩落档计费，团课、私教各设一套梯度。
              </Text>
              {value.lessonTierGroups.map((g) => (
                <TierGroupCard
                  key={g.type}
                  group={g}
                  errors={errors.lessonTiers?.[g.type]}
                  onToggle={(on) => toggleTierGroup(g.type, on)}
                  onBasis={(b) => changeTierGroupBasis(g.type, b)}
                  onCalc={(c) => changeTierGroupCalc(g.type, c)}
                  onTierChange={(tierId, key, raw) => updateTierRow(g.type, tierId, key, raw)}
                  onTierDelete={(tierId) => deleteTierRow(g.type, tierId)}
                  onAddTier={() => addTierRow(g.type)}
                />
              ))}
            </View>
          )}

          {value.lessonFeeMode === 'by_perf_tier' && (
            <PerfTierEditor
              tiers={value.perfTiers}
              errors={errors.perfTiers}
              hint={HINTS.perfTier}
              onChange={updatePerfTier}
              onDelete={deletePerfTier}
              onAdd={addPerfTier}
            />
          )}
        </EditorSection>

        {/* 4. 按课程分类单独设置 */}
        <EditorSection
          title="按课程分类单独设置"
          hint={HINTS.categoryLessonFee}
          showDivider={false}
          collapsible
          expanded={categorySectionExpanded}
          onToggle={() => setCategorySectionExpanded((prev) => !prev)}
        >
          <View className="flex flex-col gap-[16rpx]">
            {customizedCategoryCount > 0 && (
              <Text className="text-[24rpx] text-primary font-medium">
                {customizedCategoryCount}个分类已单独设置
              </Text>
            )}
            {value.categoryLessonFees.map((item) => (
              <CategoryLessonFeeCard
                key={item.id}
                item={item}
                errors={errors.categoryLessonFees?.[item.id]}
                onAlgorithmChange={updateCategoryLessonAlgorithm}
                onFixedRateChange={updateCategoryLessonFixedRate}
                onBasisChange={updateCategoryLessonBasis}
                onCalcChange={updateCategoryLessonCalc}
                onPerfPayoutChange={updateCategoryLessonPerfPayout}
                onTierChange={updateCategoryLessonTier}
                onAddTier={addCategoryLessonTier}
                onDeleteTier={deleteCategoryLessonTier}
                onPerfTierChange={updateCategoryLessonPerfTier}
                onAddPerfTier={addCategoryLessonPerfTier}
                onDeletePerfTier={deleteCategoryLessonPerfTier}
              />
            ))}
          </View>
        </EditorSection>

        {/* 5. 担任助教 */}
        <EditorSection title="担任助教" hint={HINTS.categoryExtra} showDivider={false}>
          <View className="flex flex-col gap-[16rpx]">
            {value.categoryExtraFees.map((e) => (
              <FormRow
                key={e.id}
                label={e.name}
                editable
                inputType="digit"
                placeholder="0"
                suffix="元/节"
                value={String(e.rate ?? '')}
                onInput={(event) => {
                  const raw = event.detail.value;
                  updateCategoryFee(e.id, raw);
                }}
                error={errors.categoryExtraFees?.[e.id]}
              />
            ))}
          </View>
        </EditorSection>

        {/* 6. 提成设置 */}
        <EditorSection
          title="提成设置"
          hint={HINTS.commission}
          selectorOptions={COMMISSION_MODE_OPTIONS as { label: string; value: string }[]}
          selectorValue={value.commissionMode}
          onSelectorChange={handleCommissionMode}
          showDivider={false}
        >
          {value.commissionMode !== 'none' && (
            <View className="mt-[4rpx]">
              {value.commissionTiers.map((t, idx) => (
                <GradientRow
                  key={t.id}
                  fields={[
                    {
                      key: 'perfThreshold',
                      label: '业绩达到：',
                      suffix: '元,',
                      error: errors.commissionTiers?.[t.id]?.perfThreshold,
                    },
                    {
                      key: 'rate',
                      label: '提成比例：',
                      suffix: '%',
                      error: errors.commissionTiers?.[t.id]?.rate,
                    },
                  ]}
                  values={{
                    perfThreshold: String(t.perfThreshold ?? ''),
                    rate: String(t.rate ?? ''),
                  }}
                  onChange={(k, raw) =>
                    updateCommissionTier(t.id, k as 'perfThreshold' | 'rate', raw)
                  }
                  showDelete={value.commissionTiers.length > 1 || idx > 0}
                  onDelete={() => deleteCommissionTier(t.id)}
                />
              ))}
              <GradientRow asAddButton onAdd={addCommissionTier} />
            </View>
          )}
        </EditorSection>
      </RuleWrapper>

      {/* 7. 可选"薪资模板"按钮（员工设置页用） */}
      {showTemplateButton && (
        <View
          className="mx-[32rpx] mb-[20rpx] py-[22rpx] rounded-[20rpx] border-[2rpx] border-primary bg-white flex items-center justify-center press-bg"
          onClick={() => onPickTemplate?.()}
        >
          <Text className="text-[30rpx] font-semibold text-primary leading-none">薪资模板</Text>
        </View>
      )}

      {/* 8. 保存按钮 */}
      {showSaveButton && (
        <View className="mx-[32rpx] mb-[40rpx]">
          <View
            className={cn(
              'w-full py-[28rpx] rounded-full text-center shadow-card press-scale',
              saving ? 'bg-muted text-muted-foreground' : 'bg-primary text-white',
            )}
            onClick={saving ? undefined : handleSave}
          >
            <Text className="text-[32rpx] font-bold leading-none">
              {saving ? '保存中...' : saveText}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

// ====================== 局部组件 ======================

interface CourseGroupFeeEditorProps {
  groups: CourseGroupFee[];
  errors: SalaryRuleEditorErrors;
  onToggleShare: (categoryId: string, on: boolean) => void;
  onToggleItemShare: (categoryId: string, courseId: string, on: boolean) => void;
  onUpdateRate: (categoryId: string, courseId: string, raw: string) => void;
}

const CourseGroupFeeEditor: React.FC<CourseGroupFeeEditorProps> = ({
  groups,
  onToggleShare,
  onToggleItemShare,
  onUpdateRate,
}) => {
  if (groups.length === 0) {
    return (
      <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
        暂无课程分类，请先前往课程设置添加分类和课程。
      </Text>
    );
  }

  return (
    <View className="flex flex-col gap-[8rpx]">
      <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
        读取课程设置中的分类与课程，为每门课程单独设置课时费；开启「课时分成」则按该节课业绩比例结算。
      </Text>
      {groups.map((g) => (
        <View key={g.categoryId} className="mb-[16rpx]">
          {/* 分类行 */}
          <View className="flex items-center justify-between mb-[8rpx]">
            <View className="flex items-center gap-[12rpx]">
              <Text className="text-[28rpx] font-semibold text-foreground">{g.groupName}</Text>
              <View className="px-[12rpx] py-[4rpx] rounded-[8rpx] bg-muted text-muted-foreground text-[20rpx]">
                {CATEGORY_MODE_LABEL[g.groupType]}
              </View>
            </View>
            <View className="flex items-center gap-[8rpx]">
              <Text className="text-[24rpx] text-muted-foreground">课时分成</Text>
              <Switch
                checked={g.useRevenueShare}
                onChange={(on) => onToggleShare(g.categoryId, on)}
              />
            </View>
          </View>
          {/* 课程列表 */}
          {g.courses.length === 0 ? (
            <Text className="text-[24rpx] text-muted-foreground py-[12rpx]">该分类下暂无课程</Text>
          ) : (
            <View className="flex flex-col">
              {g.courses.map((c) => (
                <View
                  key={c.id}
                  className="flex items-center py-[12rpx] gap-[16rpx] border-b border-border last:border-b-0"
                >
                  <Text className="text-[28rpx] text-foreground flex-1 min-w-0 truncate">
                    {c.courseName}
                  </Text>
                  <View className="flex items-center gap-[8rpx]">
                    <Switch
                      checked={c.useRevenueShare}
                      onChange={(on) => onToggleItemShare(g.categoryId, c.courseId, on)}
                    />
                  </View>
                  <FormInput
                    variant="ghost"
                    type="digit"
                    placeholder="0"
                    suffix={
                      <Text className="text-[26rpx] text-muted-foreground ml-[4rpx]">
                        {c.useRevenueShare || g.useRevenueShare ? '%' : '元/课时'}
                      </Text>
                    }
                    value={String(c.rate ?? '')}
                    onInput={(e) => {
                      onUpdateRate(g.categoryId, c.courseId, e.detail.value);
                    }}
                    inputClassName="w-[180rpx] h-[72rpx] bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-right"
                    className="mb-0"
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

interface AttendanceTierEditorProps {
  tiers: AttendanceTier[];
  errors?: Record<string, { minCount?: string; maxCount?: string; rate?: string }>;
  onChange: (id: string, key: 'minCount' | 'maxCount' | 'rate', raw: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const AttendanceTierEditor: React.FC<AttendanceTierEditorProps> = ({
  tiers,
  errors,
  onChange,
  onDelete,
  onAdd,
}) => {
  return (
    <View className="flex flex-col">
      <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
        按单节课实际到课人数设置课时费，例如 1-5 人 80 元/节、6-10 人 100 元/节。
      </Text>
      {tiers.map((t, idx) => (
        <View key={t.id} className="flex flex-col mt-[16rpx]">
          <View className="flex items-center gap-[12rpx]">
            <Text className="text-[28rpx] text-foreground whitespace-nowrap">人数</Text>
            <FormInput
              variant="ghost"
              type="number"
              placeholder="0"
              value={String(t.minCount ?? '')}
              onInput={(e) => onChange(t.id, 'minCount', e.detail.value)}
              inputClassName="w-[120rpx] h-[72rpx] bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-right"
              className="mb-0"
            />
            <Text className="text-[28rpx] text-muted-foreground whitespace-nowrap">至</Text>
            <FormInput
              variant="ghost"
              type="number"
              placeholder="不限"
              value={String(t.maxCount ?? '')}
              onInput={(e) => onChange(t.id, 'maxCount', e.detail.value)}
              inputClassName="w-[120rpx] h-[72rpx] bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-right"
              className="mb-0"
            />
            <Text className="text-[28rpx] text-foreground whitespace-nowrap">人，每节</Text>
            <FormInput
              variant="ghost"
              type="digit"
              placeholder="0"
              suffix={<Text className="text-[26rpx] text-muted-foreground ml-[4rpx]">元</Text>}
              value={String(t.rate ?? '')}
              onInput={(e) => onChange(t.id, 'rate', e.detail.value)}
              inputClassName="w-[160rpx] h-[72rpx] bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-right"
              className="mb-0"
            />
            <View
              className={cn(
                'w-[56rpx] h-[56rpx] rounded-full flex items-center justify-center shrink-0',
                tiers.length > 1 || idx > 0 ? 'press-bg' : 'opacity-0 pointer-events-none',
              )}
              onClick={() => {
                if (tiers.length > 1 || idx > 0) onDelete(t.id);
              }}
            >
              <Icon name="mdi-delete-outline" size={24} className="text-muted-foreground" />
            </View>
          </View>
          {(errors?.[t.id]?.minCount || errors?.[t.id]?.maxCount || errors?.[t.id]?.rate) && (
            <Text className="mt-[8rpx] text-[24rpx] text-error">
              {errors[t.id]?.minCount || errors[t.id]?.maxCount || errors[t.id]?.rate}
            </Text>
          )}
        </View>
      ))}
      <GradientRow asAddButton onAdd={onAdd} />
    </View>
  );
};

interface PerfTierEditorProps {
  tiers: PerfTier[];
  errors?: Record<string, { threshold?: string; rate?: string }>;
  hint?: string;
  onChange: (id: string, key: 'threshold' | 'rate', raw: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const PerfTierEditor: React.FC<PerfTierEditorProps> = ({
  tiers,
  errors,
  hint,
  onChange,
  onDelete,
  onAdd,
}) => {
  return (
    <View className="flex flex-col">
      {hint && (
        <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
          {hint}
        </Text>
      )}
      {tiers.map((t, idx) => (
        <GradientRow
          key={t.id}
          fields={[
            {
              key: 'threshold',
              label: '业绩达到：',
              suffix: '元,',
              error: errors?.[t.id]?.threshold,
            },
            {
              key: 'rate',
              label: '课时费：',
              suffix: '%',
              error: errors?.[t.id]?.rate,
            },
          ]}
          values={{
            threshold: String(t.threshold ?? ''),
            rate: String(t.rate ?? ''),
          }}
          onChange={(k, raw) => onChange(t.id, k as 'threshold' | 'rate', raw)}
          showDelete={tiers.length > 1 || idx > 0}
          onDelete={() => onDelete(t.id)}
        />
      ))}
      <GradientRow asAddButton onAdd={onAdd} />
    </View>
  );
};

interface TierGroupCardProps {
  group: LessonTierGroup;
  errors?: Record<string, { threshold?: string; rate?: string }>;
  onToggle: (on: boolean) => void;
  onBasis: (basis: FeeBasis) => void;
  onCalc: (calc: CalcMethod) => void;
  onTierChange: (tierId: string, key: 'threshold' | 'rate', raw: string) => void;
  onTierDelete: (tierId: string) => void;
  onAddTier: () => void;
}

const TierGroupCard: React.FC<TierGroupCardProps> = ({
  group,
  errors,
  onToggle,
  onBasis,
  onCalc,
  onTierChange,
  onTierDelete,
  onAddTier,
}) => {
  const isHours = group.feeBasis === 'hours';
  return (
    <View className="rounded-[24rpx] bg-muted/40 p-[20rpx] mb-[16rpx]">
      {/* 组头：名称 + 开关 */}
      <View className="flex items-center justify-between mb-[12rpx]">
        <Text className="text-[28rpx] font-semibold text-foreground">{group.name}</Text>
        <Switch checked={group.enabled} onChange={onToggle} />
      </View>
      {group.enabled && (
        <View>
          <BasisCalcTabs
            basis={group.feeBasis}
            calc={group.calcMethod}
            onBasis={onBasis}
            onCalc={onCalc}
          />
          {group.tiers.map((t, idx) => (
            <GradientRow
              key={t.id}
              fields={
                isHours
                  ? [
                      {
                        key: 'threshold',
                        label: '满',
                        suffix: '节起,',
                        error: errors?.[t.id]?.threshold,
                      },
                      { key: 'rate', label: '', suffix: '元/节', error: errors?.[t.id]?.rate },
                    ]
                  : [
                      {
                        key: 'threshold',
                        label: '满',
                        suffix: '元业绩起,',
                        error: errors?.[t.id]?.threshold,
                      },
                      { key: 'rate', label: '', suffix: '%', error: errors?.[t.id]?.rate },
                    ]
              }
              values={{ threshold: String(t.threshold ?? ''), rate: String(t.rate ?? '') }}
              onChange={(key, raw) => onTierChange(t.id, key as 'threshold' | 'rate', raw)}
              showDelete={group.tiers.length > 1 || idx > 0}
              onDelete={() => onTierDelete(t.id)}
            />
          ))}
          <GradientRow asAddButton onAdd={onAddTier} />
        </View>
      )}
    </View>
  );
};

interface BasisCalcTabsProps {
  basis: FeeBasis;
  calc: CalcMethod;
  onBasis: (basis: FeeBasis) => void;
  onCalc: (calc: CalcMethod) => void;
}

const BasisCalcTabs: React.FC<BasisCalcTabsProps> = ({ basis, calc, onBasis, onCalc }) => (
  <View className="mt-[8rpx]">
    {/* 计费口径 */}
    <View className="flex items-center justify-between mb-[12rpx]">
      <Text className="text-[26rpx] text-muted-foreground shrink-0 mr-[16rpx]">计费口径：</Text>
      <View className="flex flex-1 gap-[12rpx]">
        {FEE_BASIS_OPTIONS.map((o) => {
          const active = o.value === basis;
          return (
            <View
              key={o.value}
              className={cn(
                'flex-1 py-[12rpx] text-center rounded-[14rpx] text-[24rpx] font-medium',
                active ? 'bg-primary text-white shadow-sm' : 'bg-muted text-muted-foreground',
              )}
              onClick={() => onBasis(o.value)}
            >
              {o.label}
            </View>
          );
        })}
      </View>
    </View>
    {/* 计算方式 */}
    <View className="flex items-center justify-between">
      <Text className="text-[26rpx] text-muted-foreground shrink-0 mr-[16rpx]">计算方式：</Text>
      <View className="flex flex-1 gap-[12rpx]">
        {CALC_METHOD_OPTIONS.map((o) => {
          const active = o.value === calc;
          return (
            <View
              key={o.value}
              className={cn(
                'flex-1 py-[12rpx] text-center rounded-[14rpx] text-[24rpx] font-medium',
                active ? 'bg-primary text-white shadow-sm' : 'bg-muted text-muted-foreground',
              )}
              onClick={() => onCalc(o.value)}
            >
              {o.label}
            </View>
          );
        })}
      </View>
    </View>
    {/* 解释文案 */}
    <View className="mt-[8rpx]">
      <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
        {calc === 'tier_unified'
          ? '全部按最高档：当月所有课时统一按最终达到的梯度标准结算。'
          : '分段累加：不同区间分别按各自档位标准计算，再相加。'}
      </Text>
    </View>
  </View>
);

interface CategoryLessonFeeCardProps {
  item: CategoryLessonFee;
  errors?: {
    fixedRate?: string;
    tiers?: Record<string, { threshold?: string; rate?: string }>;
    perfTiers?: Record<string, { threshold?: string; rate?: string }>;
  };
  onAlgorithmChange: (id: string, algorithm: CategoryFeeAlgorithm) => void;
  onFixedRateChange: (id: string, raw: string) => void;
  onBasisChange: (id: string, basis: FeeBasis) => void;
  onCalcChange: (id: string, method: CalcMethod) => void;
  onPerfPayoutChange: (id: string, mode: PerfPayoutMode) => void;
  onTierChange: (id: string, tierId: string, key: 'threshold' | 'rate', raw: string) => void;
  onAddTier: (id: string) => void;
  onDeleteTier: (id: string, tierId: string) => void;
  onPerfTierChange: (id: string, tierId: string, key: 'threshold' | 'rate', raw: string) => void;
  onAddPerfTier: (id: string) => void;
  onDeletePerfTier: (id: string, tierId: string) => void;
}

const CategoryLessonFeeCard: React.FC<CategoryLessonFeeCardProps> = ({
  item,
  errors,
  onAlgorithmChange,
  onFixedRateChange,
  onBasisChange,
  onCalcChange,
  onPerfPayoutChange,
  onTierChange,
  onAddTier,
  onDeleteTier,
  onPerfTierChange,
  onAddPerfTier,
  onDeletePerfTier,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasError = Boolean(
    errors?.fixedRate ||
    Object.keys(errors?.tiers || {}).length > 0 ||
    Object.keys(errors?.perfTiers || {}).length > 0,
  );

  // 有校验错误时自动展开，方便用户定位
  useEffect(() => {
    if (hasError) setExpanded(true);
  }, [hasError]);

  return (
    <View className="rounded-[24rpx] bg-muted/40 p-[20rpx]">
      {/* 分类标题：可点击展开/收起 */}
      <View
        className="flex items-center justify-between"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <Text className="text-[28rpx] font-semibold text-foreground">{item.name}</Text>
        <Icon
          name={expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}
          size={24}
          className="text-muted-foreground"
        />
      </View>

      {/* 算法与配置内容（默认收起） */}
      {expanded && (
        <View className="mt-[16rpx]">
          {/* 算法选择 */}
          <View className="flex flex-wrap gap-[12rpx] mb-[16rpx]">
            {CATEGORY_ALGORITHM_OPTIONS.map((o) => {
              const active = o.value === item.algorithm;
              return (
                <View
                  key={o.value}
                  className={cn(
                    'px-[20rpx] py-[10rpx] rounded-full text-[24rpx] font-medium border-[2rpx]',
                    active
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-white border-border text-muted-foreground',
                  )}
                  onClick={() => onAlgorithmChange(item.id, o.value)}
                >
                  {o.label}
                </View>
              );
            })}
          </View>

          {/* 固定单价 */}
          {item.algorithm === 'fixed' && (
            <View className="flex items-center gap-[12rpx]">
              <Text className="text-[28rpx] text-foreground whitespace-nowrap">该分类每节</Text>
              <FormInput
                variant="ghost"
                type="digit"
                placeholder="0"
                suffix={<Text className="text-[26rpx] text-muted-foreground ml-[4rpx]">元/节</Text>}
                value={String(item.fixedRate ?? '')}
                onInput={(e) => onFixedRateChange(item.id, e.detail.value)}
                inputClassName="w-[180rpx] h-[72rpx] bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-right"
                className="mb-0"
              />
              {errors?.fixedRate && (
                <Text className="text-[24rpx] text-error">{errors.fixedRate}</Text>
              )}
            </View>
          )}

          {/* 课量阶梯 */}
          {item.algorithm === 'tier' && (
            <View className="flex flex-col">
              <BasisCalcTabs
                basis={item.feeBasis}
                calc={item.calcMethod}
                onBasis={(b) => onBasisChange(item.id, b)}
                onCalc={(c) => onCalcChange(item.id, c)}
              />
              {item.tiers.map((t, idx) => (
                <GradientRow
                  key={t.id}
                  fields={
                    item.feeBasis === 'hours'
                      ? [
                          {
                            key: 'threshold',
                            label: '满',
                            suffix: '节起,',
                            error: errors?.tiers?.[t.id]?.threshold,
                          },
                          {
                            key: 'rate',
                            label: '',
                            suffix: '元/节',
                            error: errors?.tiers?.[t.id]?.rate,
                          },
                        ]
                      : [
                          {
                            key: 'threshold',
                            label: '满',
                            suffix: '元业绩起,',
                            error: errors?.tiers?.[t.id]?.threshold,
                          },
                          {
                            key: 'rate',
                            label: '',
                            suffix: '%',
                            error: errors?.tiers?.[t.id]?.rate,
                          },
                        ]
                  }
                  values={{ threshold: String(t.threshold ?? ''), rate: String(t.rate ?? '') }}
                  onChange={(k, raw) => onTierChange(item.id, t.id, k as 'threshold' | 'rate', raw)}
                  showDelete={item.tiers.length > 1 || idx > 0}
                  onDelete={() => onDeleteTier(item.id, t.id)}
                />
              ))}
              <GradientRow asAddButton onAdd={() => onAddTier(item.id)} />
            </View>
          )}

          {/* 业绩阶梯 */}
          {item.algorithm === 'perf' && (
            <View className="flex flex-col">
              <View className="flex items-center gap-[12rpx] mb-[12rpx]">
                <Text className="text-[26rpx] text-muted-foreground shrink-0">到档发放：</Text>
                <View className="flex flex-1 gap-[12rpx]">
                  {PERF_PAYOUT_OPTIONS.map((o) => {
                    const active = o.value === item.perfPayoutMode;
                    return (
                      <View
                        key={o.value}
                        className={cn(
                          'flex-1 py-[10rpx] text-center rounded-[14rpx] text-[24rpx] font-medium',
                          active
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-white text-muted-foreground border-[2rpx] border-border',
                        )}
                        onClick={() => onPerfPayoutChange(item.id, o.value)}
                      >
                        {o.label}
                      </View>
                    );
                  })}
                </View>
              </View>
              <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
                按当月个人卖卡业绩达到的最高档结算该分类课时费。
              </Text>
              {item.perfTiers.map((t, idx) => (
                <GradientRow
                  key={t.id}
                  fields={[
                    {
                      key: 'threshold',
                      label: '业绩达到',
                      suffix: '元,',
                      error: errors?.perfTiers?.[t.id]?.threshold,
                    },
                    {
                      key: 'rate',
                      label: item.perfPayoutMode === 'revenue_share' ? '比例' : '固定',
                      suffix: item.perfPayoutMode === 'revenue_share' ? '%' : '元/节',
                      error: errors?.perfTiers?.[t.id]?.rate,
                    },
                  ]}
                  values={{ threshold: String(t.threshold ?? ''), rate: String(t.rate ?? '') }}
                  onChange={(k, raw) =>
                    onPerfTierChange(item.id, t.id, k as 'threshold' | 'rate', raw)
                  }
                  showDelete={item.perfTiers.length > 1 || idx > 0}
                  onDelete={() => onDeletePerfTier(item.id, t.id)}
                />
              ))}
              <GradientRow asAddButton onAdd={() => onAddPerfTier(item.id)} />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default SalaryRuleEditor;
