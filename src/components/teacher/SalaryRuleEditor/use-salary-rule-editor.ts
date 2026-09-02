import Taro from '@tarojs/taro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { courseCategoryService } from '@/services/course-category';
import { courseTemplateService } from '@/services/course-template';
import type { CourseCategoryConfig } from '@/types/course-category';
import type { CourseTemplate } from '@/types/course-template';
import type {
  AttendanceTier,
  BaseSalaryMode,
  CalcMethod,
  CategoryFeeAlgorithm,
  CommissionMode,
  CommissionTier,
  FeeBasis,
  InsuranceConfig,
  LessonFeeMode,
  LessonTierGroup,
  PerfPayoutMode,
  PerfTier,
  SalaryRuleConfig,
  BaseSalaryTier,
} from '@/types/teacher';
import {
  buildCategoryLessonFees,
  buildCourseGroupFees,
  isCategoryLessonFeesChanged,
  isCourseGroupFeesChanged,
  uid,
} from './builders';
import type { SalaryRuleEditorErrors } from './types';
import { isSalaryRuleValid, validateSalaryRule } from './validate';

export function useSalaryRuleEditor(
  value: SalaryRuleConfig,
  onChange: (next: SalaryRuleConfig) => void,
  onSave?: () => void,
) {
  const [errors, setErrors] = useState<SalaryRuleEditorErrors>({});
  const [categories, setCategories] = useState<CourseCategoryConfig[]>([]);
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [categorySectionExpanded, setCategorySectionExpanded] = useState(false);
  const syncedRef = useRef(false);

  const patch = useCallback(
    (partial: Partial<SalaryRuleConfig>) => onChange({ ...value, ...partial }),
    [value, onChange],
  );

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
        setCoursesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!coursesLoaded || syncedRef.current) return;
    syncedRef.current = true;

    const nextCourseGroupFees = buildCourseGroupFees(categories, templates, value.courseGroupFees);
    const nextCategoryLessonFees = buildCategoryLessonFees(categories, value.categoryLessonFees);

    const courseGroupChanged = isCourseGroupFeesChanged(
      nextCourseGroupFees,
      value.courseGroupFees,
    );
    const categoryLessonChanged = isCategoryLessonFeesChanged(
      nextCategoryLessonFees,
      value.categoryLessonFees,
    );

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

  const validate = useCallback((): boolean => {
    const next = validateSalaryRule(value);
    setErrors(next);
    return isSalaryRuleValid(next);
  }, [value]);

  const handleSave = useCallback(() => {
    if (!validate()) {
      Taro.showToast({ title: '请检查表单填写', icon: 'none' });
      return;
    }
    onSave?.();
  }, [validate, onSave]);

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

  const handleInsuranceToggle = useCallback(
    (v: string) => {
      const enabled = v === 'on';
      patch({
        insurance: { ...value.insurance, enabled } as InsuranceConfig,
      });
    },
    [patch, value.insurance],
  );

  const handleLessonModeChange = useCallback(
    (v: string) => {
      patch({ lessonFeeMode: v as LessonFeeMode });
    },
    [patch],
  );

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

  const customizedCategoryCount = useMemo(
    () => value.categoryLessonFees.filter((item) => item.algorithm !== 'default').length,
    [value.categoryLessonFees],
  );

  return {
    errors,
    categorySectionExpanded,
    setCategorySectionExpanded,
    customizedCategoryCount,
    patch,
    handleSave,
    handleBaseModeChange,
    updateBaseTier,
    deleteBaseTier,
    addBaseTier,
    handleInsuranceToggle,
    handleLessonModeChange,
    toggleCourseShare,
    updateCourseRate,
    toggleCourseItemShare,
    updateAttendanceTier,
    deleteAttendanceTier,
    addAttendanceTier,
    toggleTierGroup,
    changeTierGroupBasis,
    changeTierGroupCalc,
    updateTierRow,
    deleteTierRow,
    addTierRow,
    updatePerfTier,
    deletePerfTier,
    addPerfTier,
    updateCategoryLessonAlgorithm,
    updateCategoryLessonFixedRate,
    updateCategoryLessonBasis,
    updateCategoryLessonCalc,
    updateCategoryLessonPerfPayout,
    updateCategoryLessonTier,
    addCategoryLessonTier,
    deleteCategoryLessonTier,
    updateCategoryLessonPerfTier,
    addCategoryLessonPerfTier,
    deleteCategoryLessonPerfTier,
    updateCategoryFee,
    handleCommissionMode,
    updateCommissionTier,
    deleteCommissionTier,
    addCommissionTier,
  };
}
