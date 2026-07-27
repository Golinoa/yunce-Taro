import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { type ScheduleItem } from '@/components/InstallmentPanel';
import { studentService, packageService, subjectService } from '@/services';
import { useStudentStore, usePackageTemplateStore } from '@/stores';
import type { Subject } from '@/types/campus';
import type { CoursePackageTemplate, FeeMethod, PackageType } from '@/types/course-package';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { reportLocalDebug } from '@/utils/local-debug';
import { logError } from '@/utils/logger';

// ============================================
// 常量
// ============================================
export const QUICK_HOURS = [10, 16, 24, 36, 48];
export const GIFT_OPTIONS = [0, 1, 2, 4];
export const FEE_METHOD_OPTIONS: { key: FeeMethod; label: string }[] = [
  { key: 'wechat', label: '微信' },
  { key: 'alipay', label: '支付宝' },
  { key: 'cash', label: '现金' },
  { key: 'transfer', label: '转账' },
  { key: 'other', label: '其他' },
];

/** 课包类型图标和颜色映射（使用 UnoCSS Token 类名） */
export const TYPE_ICON_MAP: Record<
  PackageType,
  { icon: string; colorClass: string; bgClass: string; label: string }
> = {
  hour_package: {
    icon: '📚',
    colorClass: 'text-success',
    bgClass: 'bg-success-bg',
    label: '课时包',
  },
  term: { icon: '📅', colorClass: 'text-amber', bgClass: 'bg-warning-bg', label: '期课' },
  monthly: { icon: '🔄', colorClass: 'text-accent', bgClass: 'bg-accent-bg', label: '月卡' },
  trial: { icon: '🎁', colorClass: 'text-info', bgClass: 'bg-info-bg', label: '体验课' },
};

/**
 * 课包充值/编辑表单逻辑 Hook
 * 管理学员选择、课包选择、收费信息等全部表单状态
 */
export function usePackageForm() {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);
  const invalidateStudents = useStudentStore((state) => state.invalidate);
  const fetchPackageTemplatesByTeacher = usePackageTemplateStore((state) => state.fetchByTeacher);

  const params = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return instance?.router?.params || {};
  }, []);
  const packageId = decodeURIComponent(params.id || '');
  const routeStudentId = decodeURIComponent(params.studentId || '');
  const isEdit = !!packageId;

  // ===== 加载状态 =====
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // ===== 学员选择 =====
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentSheet, setShowStudentSheet] = useState(false);
  const [studentSheetVisible, setStudentSheetVisible] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // ===== 课包选择 =====
  const [templates, setTemplates] = useState<CoursePackageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CoursePackageTemplate | null>(null);
  const [isCustomPackage, setIsCustomPackage] = useState(false);
  const [showPackageSheet, setShowPackageSheet] = useState(false);
  const [packageSheetVisible, setPackageSheetVisible] = useState(false);

  // ===== 自定义课包表单 =====
  const [customName, setCustomName] = useState('');
  const [customHours, setCustomHours] = useState('');
  const [customValidDays, setCustomValidDays] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customSubjectId, setCustomSubjectId] = useState('');

  // ===== 科目列表 =====
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // ===== 课包信息 =====
  const [totalHours, setTotalHours] = useState(0);
  const [validDays, setValidDays] = useState(0);

  // ===== 赠送课时 =====
  const [giftHours, setGiftHours] = useState(0);

  // ===== 收费信息 =====
  const [feeAmount, setFeeAmount] = useState('');
  const [feeMethod, setFeeMethod] = useState<FeeMethod | ''>('');

  // ===== 分期付款 =====
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentPeriod, setInstallmentPeriod] = useState(2);
  const [installmentSchedule, setInstallmentSchedule] = useState<ScheduleItem[]>([]);

  // ===== 备注 =====
  const [note, setNote] = useState('');

  // ===== 编辑模式回填 =====
  const [editRemainingHours, setEditRemainingHours] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const initStartAtRef = useState({ current: 0 })[0];

  // ============================================
  // 初始化
  // ============================================
  useEffect(() => {
    const init = async () => {
      initStartAtRef.current = Date.now();
      // #region debug-point H2:package-form-init-start
      reportLocalDebug({
        hypothesisId: 'H2',
        location: 'src/package-course/pages/package-form/usePackageForm.ts:init',
        msg: '[DEBUG] package form init start',
        data: { currentUserId, isEdit, packageId, routeStudentId },
      });
      // #endregion
      setLoading(true);
      setLoadError('');
      setNotFound(false);

      if (!currentUserId) {
        setLoadError('未获取到登录信息，请重新进入页面');
        setLoading(false);
        return;
      }

      try {
        const [stuList, tplList] = await Promise.all([
          fetchStudentsByTeacher(currentUserId),
          fetchPackageTemplatesByTeacher(currentUserId),
        ]);
        setStudents(stuList);
        setTemplates(tplList);

        // 加载科目列表
        const subjectList = await subjectService.getList();
        setSubjects(subjectList);

        if (isEdit && packageId) {
          const pkg = await packageService.getById(packageId);
          if (!pkg) {
            setNotFound(true);
            return;
          }

          const stu = await studentService.getById(pkg.student_id);
          if (!stu) {
            setNotFound(true);
            return;
          }

          setSelectedStudent(stu);
          const packageGiftHours = pkg.gift_hours || 0;
          setTotalHours(Math.max(pkg.total_hours - packageGiftHours, 0));
          setValidDays(pkg.valid_days || 0);
          setEditRemainingHours(String(pkg.remaining_hours));
          setEditExpiryDate(pkg.expiry_date || '');
          setFeeAmount(pkg.fee_amount != null ? String(pkg.fee_amount) : '');
          setFeeMethod(pkg.fee_method || '');
          setNote(pkg.note || '');
          setGiftHours(packageGiftHours);
        } else {
          if (routeStudentId) {
            const stu = await studentService.getById(routeStudentId);
            if (!stu) {
              setLoadError('未找到对应学员，请重新选择');
              return;
            }
            setSelectedStudent(stu);
          }
        }
      } catch (err) {
        logError('init package form', err);
        setLoadError('课包表单初始化失败，请稍后重试');
      } finally {
        // #region debug-point H2:package-form-init-end
        reportLocalDebug({
          hypothesisId: 'H2',
          location: 'src/package-course/pages/package-form/usePackageForm.ts:init',
          msg: '[DEBUG] package form init end',
          data: {
            currentUserId,
            isEdit,
            packageId,
            routeStudentId,
            durationMs: Date.now() - initStartAtRef.current,
          },
        });
        // #endregion
        setLoading(false);
      }
    };
    init();
  }, [
    packageId,
    isEdit,
    routeStudentId,
    currentUserId,
    fetchStudentsByTeacher,
    fetchPackageTemplatesByTeacher,
  ]);

  // ============================================
  // 计算属性
  // ============================================
  const studentRemaining = useMemo(
    () =>
      (selectedStudent?.course_packages || []).reduce(
        (sum, p) => sum + (p.remaining_hours || 0),
        0,
      ),
    [selectedStudent],
  );

  const studentActivePackages = useMemo(
    () => (selectedStudent?.course_packages || []).filter((p) => p.status === 'active').length,
    [selectedStudent],
  );

  const studentLessonCount = useMemo(
    () =>
      (selectedStudent?.course_packages || []).reduce(
        (sum, p) => sum + (p.total_hours - p.remaining_hours),
        0,
      ),
    [selectedStudent],
  );

  const effectiveHours = useMemo(() => {
    if (isEdit) return totalHours;
    if (selectedTemplate) return selectedTemplate.lesson_count;
    if (isCustomPackage) return totalHours;
    return 0;
  }, [isEdit, totalHours, selectedTemplate, isCustomPackage]);

  const totalWithGift = useMemo(() => effectiveHours + giftHours, [effectiveHours, giftHours]);

  const effectiveValidDays = useMemo(() => {
    if (isEdit) return validDays;
    if (selectedTemplate) return selectedTemplate.valid_days || 0;
    if (isCustomPackage) return validDays;
    return 0;
  }, [isEdit, validDays, selectedTemplate, isCustomPackage]);

  const effectiveFeeAmount = useMemo(() => {
    if (feeAmount) return feeAmount;
    if (selectedTemplate && !isCustomPackage) return String(selectedTemplate.price);
    return '';
  }, [feeAmount, selectedTemplate, isCustomPackage]);

  const submitBlockedReason = useMemo(() => {
    if (!selectedStudent) return '请选择学员';

    if (isEdit) {
      const remainingHours = parseInt(editRemainingHours, 10);
      if (!editRemainingHours.trim()) return '请填写剩余课时';
      if (Number.isNaN(remainingHours) || remainingHours < 0) return '剩余课时不能小于 0';
      if (editExpiryDate && !dayjs(editExpiryDate, 'YYYY-MM-DD', true).isValid()) {
        return '过期日期格式应为 YYYY-MM-DD';
      }
      if (feeAmount) {
        const amount = parseFloat(feeAmount);
        if (Number.isNaN(amount) || amount < 0) return '收费金额不能为负数';
      }
      return '';
    }

    if (!selectedTemplate && !isCustomPackage) return '请选择课包';
    if (isCustomPackage && totalHours <= 0) return '请输入有效的课时数量';
    if (effectiveFeeAmount) {
      const amount = parseFloat(effectiveFeeAmount);
      if (Number.isNaN(amount) || amount < 0) return '收费金额不能为负数';
    }
    if (installmentEnabled) {
      if (!effectiveFeeAmount || parseFloat(effectiveFeeAmount) <= 0) return '分期付款需先填写金额';
      if (!installmentSchedule.length) return '请完善分期计划';
      if (
        installmentSchedule.some(
          (item) =>
            !item.date ||
            !item.amount ||
            Number.isNaN(parseFloat(String(item.amount))) ||
            parseFloat(String(item.amount)) <= 0,
        )
      ) {
        return '请填写完整的分期计划';
      }
    }
    return '';
  }, [
    selectedStudent,
    isEdit,
    editRemainingHours,
    editExpiryDate,
    feeAmount,
    selectedTemplate,
    isCustomPackage,
    totalHours,
    effectiveFeeAmount,
    installmentEnabled,
    installmentSchedule,
  ]);

  const canSubmit = useMemo(() => {
    return !submitBlockedReason;
  }, [submitBlockedReason]);

  const submitSummary = useMemo(() => {
    if (!canSubmit) return isEdit ? '保存' : '确认充值';
    const parts = [`确认充值 · ${totalWithGift}课时`];
    if (giftHours > 0) parts[0] += `（含赠送${giftHours}）`;
    const amount = parseFloat(effectiveFeeAmount);
    if (amount > 0) parts.push(`¥${amount.toLocaleString()}`);
    return parts.join(' · ');
  }, [canSubmit, isEdit, totalWithGift, giftHours, effectiveFeeAmount]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q) || (s.phone || '').includes(q));
  }, [students, studentSearch]);

  // ============================================
  // 事件处理
  // ============================================
  const openStudentSheet = useCallback(() => {
    setShowStudentSheet(true);
    setTimeout(() => setStudentSheetVisible(true), 50);
  }, []);

  const closeStudentSheet = useCallback(() => {
    setStudentSheetVisible(false);
    setTimeout(() => setShowStudentSheet(false), 300);
  }, []);

  const handleSelectStudent = useCallback(
    (stu: Student) => {
      setSelectedStudent(stu);
      closeStudentSheet();
    },
    [closeStudentSheet],
  );

  const openPackageSheet = useCallback(() => {
    setShowPackageSheet(true);
    setTimeout(() => setPackageSheetVisible(true), 50);
  }, []);

  const closePackageSheet = useCallback(() => {
    setPackageSheetVisible(false);
    setTimeout(() => setShowPackageSheet(false), 300);
  }, []);

  const handleSelectTemplate = useCallback(
    (tpl: CoursePackageTemplate) => {
      setSelectedTemplate(tpl);
      setIsCustomPackage(false);
      setTotalHours(tpl.lesson_count);
      setValidDays(tpl.valid_days || 0);
      if (!feeAmount) setFeeAmount(String(tpl.price));
      closePackageSheet();
    },
    [feeAmount, closePackageSheet],
  );

  const handleSelectCustom = useCallback(() => {
    setSelectedTemplate(null);
    setIsCustomPackage(true);
  }, []);

  const handleConfirmCustom = useCallback(() => {
    const hours = parseInt(customHours);
    if (!customName.trim() || !hours || hours <= 0) {
      Taro.showToast({ title: '请填写课包名称和课时', icon: 'none' });
      return;
    }
    if (customPrice && parseFloat(customPrice) < 0) {
      Taro.showToast({ title: '价格不能为负数', icon: 'none' });
      return;
    }
    if (customValidDays && parseInt(customValidDays) < 0) {
      Taro.showToast({ title: '有效天数不能为负数', icon: 'none' });
      return;
    }
    setTotalHours(hours);
    setValidDays(parseInt(customValidDays) || 0);
    if (customPrice) setFeeAmount(customPrice);
    closePackageSheet();
  }, [customName, customHours, customValidDays, customPrice, closePackageSheet]);

  const handleGiftChange = useCallback((val: number) => {
    setGiftHours(Math.max(0, val));
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;

    if (!selectedStudent) {
      Taro.showToast({ title: '请选择学生', icon: 'none' });
      return;
    }
    if (!isEdit && !selectedTemplate && !isCustomPackage) {
      Taro.showToast({ title: '请选择课包', icon: 'none' });
      return;
    }
    if (isCustomPackage && totalHours <= 0) {
      Taro.showToast({ title: '请输入有效的课时数量', icon: 'none' });
      return;
    }

    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }

    // 金额校验
    if (effectiveFeeAmount) {
      const amount = parseFloat(effectiveFeeAmount);
      if (isNaN(amount) || amount < 0) {
        Taro.showToast({ title: '金额不能为负数', icon: 'none' });
        return;
      }
    }

    setSaving(true);
    try {
      if (isEdit) {
        const newRemaining = parseInt(editRemainingHours) || totalHours;
        await packageService.update(packageId, {
          remaining_hours: newRemaining,
          // 编辑时按比例调整购买/赠送剩余
          purchased_remaining: newRemaining,
          bonus_remaining: 0,
          expiry_date: editExpiryDate || undefined,
          fee_amount: feeAmount ? parseFloat(feeAmount) : undefined,
          fee_method: feeMethod || undefined,
          note: note.trim() || undefined,
          gift_hours: giftHours,
        });
        invalidateStudents(currentUserId);
        Taro.showToast({ title: '更新成功', icon: 'success' });
      } else {
        await packageService.createRecharge({
          student_id: selectedStudent.id,
          template_id: selectedTemplate?.id,
          name: isCustomPackage
            ? customName.trim() || '课时充值'
            : selectedTemplate?.name || '课时充值',
          total_hours: totalHours,
          valid_days: effectiveValidDays || undefined,
          gift_hours: giftHours > 0 ? giftHours : undefined,
          fee_amount: effectiveFeeAmount ? parseFloat(effectiveFeeAmount) : undefined,
          fee_method: feeMethod || undefined,
          installment_enabled: installmentEnabled || undefined,
          installment_period: installmentEnabled ? installmentPeriod : undefined,
          installment_schedule: installmentEnabled ? installmentSchedule : undefined,
          note: note.trim() || undefined,
          subject_id: isCustomPackage ? customSubjectId || undefined : selectedTemplate?.subject_id,
        });
        invalidateStudents(currentUserId);
        // 充值成功后提示到期日
        const expiryDate =
          effectiveValidDays > 0
            ? dayjs().add(effectiveValidDays, 'day').format('YYYY-MM-DD')
            : null;
        const expiryTip = expiryDate ? `，到期日 ${expiryDate}` : '';
        Taro.showToast({ title: `充值成功${expiryTip}`, icon: 'success', duration: 2000 });
      }
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (err) {
      logError('save package', err);
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    selectedStudent,
    isEdit,
    selectedTemplate,
    isCustomPackage,
    totalHours,
    submitBlockedReason,
    packageId,
    editRemainingHours,
    editExpiryDate,
    feeAmount,
    feeMethod,
    note,
    giftHours,
    customName,
    effectiveValidDays,
    effectiveFeeAmount,
    installmentEnabled,
    installmentPeriod,
    installmentSchedule,
    currentUserId,
    invalidateStudents,
  ]);

  return {
    // 路由参数
    isEdit,
    // 加载
    loading,
    saving,
    loadError,
    notFound,
    // 学员
    students,
    selectedStudent,
    showStudentSheet,
    studentSheetVisible,
    studentSearch,
    filteredStudents,
    openStudentSheet,
    closeStudentSheet,
    handleSelectStudent,
    setStudentSearch,
    // 课包
    templates,
    selectedTemplate,
    isCustomPackage,
    showPackageSheet,
    packageSheetVisible,
    openPackageSheet,
    closePackageSheet,
    handleSelectTemplate,
    handleSelectCustom,
    handleConfirmCustom,
    // 自定义课包
    customName,
    customHours,
    customValidDays,
    customPrice,
    setCustomName,
    setCustomHours,
    setCustomValidDays,
    setCustomPrice,
    customSubjectId,
    setCustomSubjectId,
    // 科目列表
    subjects,
    // 课包信息
    totalHours,
    setTotalHours,
    validDays,
    setValidDays,
    // 赠送
    giftHours,
    handleGiftChange,
    setGiftHours,
    // 收费
    feeAmount,
    feeMethod,
    effectiveFeeAmount,
    setFeeAmount,
    setFeeMethod,
    // 分期
    installmentEnabled,
    installmentPeriod,
    installmentSchedule,
    setInstallmentEnabled,
    setInstallmentPeriod,
    setInstallmentSchedule,
    // 备注
    note,
    setNote,
    // 编辑模式
    editRemainingHours,
    editExpiryDate,
    setEditRemainingHours,
    setEditExpiryDate,
    // 计算属性
    studentRemaining,
    studentActivePackages,
    studentLessonCount,
    effectiveHours,
    totalWithGift,
    effectiveValidDays,
    canSubmit,
    submitBlockedReason,
    submitSummary,
    // 保存
    handleSave,
  };
}
