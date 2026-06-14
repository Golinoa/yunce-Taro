import { View, Text, Input, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import ChipPicker from '@/components/ChipPicker';
import InstallmentPanel, { type ScheduleItem } from '@/components/InstallmentPanel';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import Stepper from '@/components/Stepper';
import { studentService, packageService } from '@/services';
import { useStudentStore, usePackageTemplateStore } from '@/stores';
import type { CoursePackageTemplate, FeeMethod, PackageType } from '@/types/course-package';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

// ============================================
// 常量
// ============================================
const QUICK_HOURS = [10, 16, 24, 36, 48];
const GIFT_OPTIONS = [0, 1, 2, 4];
const FEE_METHOD_OPTIONS: { key: FeeMethod; label: string }[] = [
  { key: 'wechat', label: '微信' },
  { key: 'alipay', label: '支付宝' },
  { key: 'cash', label: '现金' },
  { key: 'transfer', label: '转账' },
  { key: 'other', label: '其他' },
];

/** 课包类型图标和颜色映射 */
const TYPE_ICON_MAP: Record<
  PackageType,
  { icon: string; color: string; bg: string; label: string }
> = {
  hour_package: { icon: '📚', color: '#5EC8A8', bg: '#f0faf5', label: '课时包' },
  term: { icon: '📅', color: '#d4a24e', bg: '#faf6ee', label: '期课' },
  monthly: { icon: '🔄', color: '#9b7ed8', bg: '#f3f0fb', label: '月卡' },
  trial: { icon: '🎁', color: '#6ba3d6', bg: '#f0f5fb', label: '体验课' },
};

// ============================================
// 课时充值页面
// ============================================
const PackageForm: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const studentStore = useStudentStore();
  const packageTemplateStore = usePackageTemplateStore();

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

  // ===== 自定义课包表单（浮窗内） =====
  const [customName, setCustomName] = useState('');
  const [customHours, setCustomHours] = useState('');
  const [customValidDays, setCustomValidDays] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  // ===== 课包信息（仅自定义时显示） =====
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

  // ============================================
  // 初始化
  // ============================================
  useEffect(() => {
    const init = async () => {
      try {
        const [stuList, tplList] = await Promise.all([
          studentStore.fetchByTeacher(currentUserId),
          packageTemplateStore.fetchByTeacher(currentUserId),
        ]);
        setStudents(stuList);
        setTemplates(tplList);

        if (isEdit && packageId) {
          const pkg = await packageService.getById(packageId);
          if (pkg) {
            const stu = await studentService.getById(pkg.student_id);
            if (stu) setSelectedStudent(stu);
            setTotalHours(pkg.total_hours);
            setValidDays(pkg.valid_days || 0);
            setEditRemainingHours(String(pkg.remaining_hours));
            setEditExpiryDate(pkg.expiry_date || '');
            setFeeAmount(pkg.fee_amount != null ? String(pkg.fee_amount) : '');
            setFeeMethod(pkg.fee_method || '');
            setNote(pkg.note || '');
            setGiftHours(pkg.gift_hours || 0);
          }
        } else {
          // 创建模式：默认选中路由传入的学生
          if (routeStudentId) {
            const stu = await studentService.getById(routeStudentId);
            if (stu) setSelectedStudent(stu);
          }
        }
      } catch (err) {
        logError('init package form', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [packageId, isEdit, routeStudentId]);

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

  // 实际充值课时（不含赠送）
  const effectiveHours = useMemo(() => {
    if (isEdit) return totalHours;
    if (selectedTemplate) return selectedTemplate.lesson_count;
    if (isCustomPackage) return totalHours;
    return 0;
  }, [isEdit, totalHours, selectedTemplate, isCustomPackage]);

  // 合计到账课时（含赠送）
  const totalWithGift = useMemo(() => effectiveHours + giftHours, [effectiveHours, giftHours]);

  // 有效天数
  const effectiveValidDays = useMemo(() => {
    if (isEdit) return validDays;
    if (selectedTemplate) return selectedTemplate.valid_days || 0;
    if (isCustomPackage) return validDays;
    return 0;
  }, [isEdit, validDays, selectedTemplate, isCustomPackage]);

  // 收费金额（模板自动填充）
  const effectiveFeeAmount = useMemo(() => {
    if (feeAmount) return feeAmount;
    if (selectedTemplate && !isCustomPackage) return String(selectedTemplate.price);
    return '';
  }, [feeAmount, selectedTemplate, isCustomPackage]);

  // 是否可提交
  const canSubmit = useMemo(() => {
    if (!selectedStudent) return false;
    if (isEdit) return true;
    if (!selectedTemplate && !isCustomPackage) return false;
    if (isCustomPackage && totalHours <= 0) return false;
    return true;
  }, [selectedStudent, isEdit, selectedTemplate, isCustomPackage, totalHours]);

  // 底部按钮摘要
  const submitSummary = useMemo(() => {
    if (!canSubmit) return isEdit ? '保存' : '确认充值';
    const parts = [`确认充值 · ${totalWithGift}课时`];
    if (giftHours > 0) parts[0] += `（含赠送${giftHours}）`;
    const amount = parseFloat(effectiveFeeAmount);
    if (amount > 0) parts.push(`¥${amount.toLocaleString()}`);
    return parts.join(' · ');
  }, [canSubmit, isEdit, totalWithGift, giftHours, effectiveFeeAmount]);

  // ============================================
  // 学员选择
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
    async (stu: Student) => {
      setSelectedStudent(stu);
      closeStudentSheet();
    },
    [closeStudentSheet],
  );

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q) || (s.phone || '').includes(q));
  }, [students, studentSearch]);

  // ============================================
  // 课包选择
  // ============================================
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
      // 自动填充收费金额（如果用户未手动修改）
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
    setTotalHours(hours);
    setValidDays(parseInt(customValidDays) || 0);
    if (customPrice) setFeeAmount(customPrice);
    closePackageSheet();
  }, [customName, customHours, customValidDays, customPrice, closePackageSheet]);

  // ============================================
  // 赠送课时
  // ============================================
  const handleGiftChange = useCallback((val: number) => {
    setGiftHours(Math.max(0, val));
  }, []);

  // ============================================
  // 保存
  // ============================================
  const handleSave = useCallback(async () => {
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

    setSaving(true);
    try {
      if (isEdit) {
        // 编辑模式：更新课包
        await packageService.update(packageId, {
          remaining_hours: parseInt(editRemainingHours) || totalHours,
          expiry_date: editExpiryDate || undefined,
          fee_amount: feeAmount ? parseFloat(feeAmount) : undefined,
          fee_method: feeMethod || undefined,
          note: note.trim() || undefined,
          gift_hours: giftHours,
        });
        studentStore.invalidate(currentUserId);
        Taro.showToast({ title: '更新成功', icon: 'success' });
      } else {
        // 创建模式：课时充值
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
        });
        studentStore.invalidate(currentUserId);
        Taro.showToast({ title: '充值成功', icon: 'success' });
      }
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (err) {
      logError('save package', err);
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    selectedStudent,
    isEdit,
    selectedTemplate,
    isCustomPackage,
    totalHours,
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
  ]);

  // ============================================
  // 渲染
  // ============================================
  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-[200rpx]">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen pb-[200rpx]" style={{ background: '#F5FAF8' }}>
        {/* ====== 标题 ====== */}
        <View className="px-8 pt-8 pb-4">
          <Text className="text-[40rpx] font-bold text-foreground block">
            {isEdit ? '编辑套餐' : '课时充值'}
          </Text>
        </View>

        <View className="px-8">
          {/* ====== 1. 学生信息卡片（渐变） ====== */}
          <View className="mb-6">
            {selectedStudent ? (
              <View
                className="rounded-[40rpx] p-[40rpx] relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #5EC8A8, #7dd8bc)' }}
                onClick={openStudentSheet}
              >
                {/* 装饰圆 */}
                <View className="absolute -top-[60rpx] -right-[60rpx] w-[200rpx] h-[200rpx] rounded-full bg-white/8" />
                <View className="absolute -bottom-[40rpx] right-[80rpx] w-[120rpx] h-[120rpx] rounded-full bg-white/6" />

                <View className="flex items-center gap-6 mb-7 relative z-1">
                  <View className="w-[96rpx] h-[96rpx] rounded-full bg-white flex items-center justify-center flex-shrink-0">
                    <Text className="text-[40rpx] font-bold text-primary">
                      {selectedStudent.name[0]}
                    </Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[36rpx] font-bold text-white block">
                      {selectedStudent.name}
                    </Text>
                    {selectedStudent.phone && (
                      <Text className="text-[24rpx] text-white/80 block mt-1">
                        {selectedStudent.phone}
                      </Text>
                    )}
                  </View>
                  <Text
                    className="text-[24rpx] text-white/90 underline flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation?.();
                      openStudentSheet();
                    }}
                  >
                    更换学员
                  </Text>
                </View>

                <View className="flex gap-12 relative z-1">
                  <View>
                    <Text className="text-[44rpx] font-extrabold text-white block">
                      {studentRemaining}
                    </Text>
                    <Text className="text-[22rpx] text-white/75 block mt-1">剩余课时</Text>
                  </View>
                  <View>
                    <Text className="text-[44rpx] font-extrabold text-white block">
                      {studentActivePackages}
                    </Text>
                    <Text className="text-[22rpx] text-white/75 block mt-1">进行中课包</Text>
                  </View>
                  <View>
                    <Text className="text-[44rpx] font-extrabold text-white block">
                      {studentLessonCount}
                    </Text>
                    <Text className="text-[22rpx] text-white/75 block mt-1">已消课次</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View
                className="rounded-[40rpx] p-[40rpx] relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #5EC8A8, #7dd8bc)' }}
                onClick={openStudentSheet}
              >
                <View className="absolute -top-[60rpx] -right-[60rpx] w-[200rpx] h-[200rpx] rounded-full bg-white/8" />
                <View className="flex items-center justify-center py-4 relative z-1">
                  <Text className="text-[28rpx] text-white/90">点击选择学员</Text>
                </View>
              </View>
            )}
          </View>

          {/* ====== 2. 课包选择（非编辑模式） ====== */}
          {!isEdit && (
            <View className="mb-6">
              <View className="flex items-center gap-1 mb-3">
                <Text className="text-lg text-foreground font-medium">选择课包</Text>
                <Text className="text-lg text-destructive">*</Text>
              </View>

              {selectedTemplate ? (
                /* 已选模板摘要卡片 */
                <View
                  className="flex items-center gap-6 p-[28rpx] rounded-[28rpx] border-[3rpx] border-primary bg-primary-5"
                  onClick={openPackageSheet}
                >
                  <View
                    className="w-[96rpx] h-[96rpx] rounded-[24rpx] flex items-center justify-center flex-shrink-0 bg-white"
                    style={{ background: TYPE_ICON_MAP[selectedTemplate.type]?.bg || '#f0faf5' }}
                  >
                    <Text className="text-[48rpx]">
                      {TYPE_ICON_MAP[selectedTemplate.type]?.icon || '📚'}
                    </Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[30rpx] font-bold text-foreground block">
                      {selectedTemplate.name}
                    </Text>
                    {selectedTemplate.description && (
                      <Text className="text-[24rpx] text-muted-foreground block mt-1">
                        {selectedTemplate.description}
                      </Text>
                    )}
                    <View className="flex gap-2 mt-2">
                      <View className="py-1 px-3 rounded-sm bg-primary-15">
                        <Text className="text-[20rpx] text-primary font-medium">
                          {selectedTemplate.lesson_count}课时
                        </Text>
                      </View>
                      {selectedTemplate.valid_days ? (
                        <View className="py-1 px-3 rounded-sm bg-amber-15">
                          <Text className="text-[20rpx] text-amber font-medium">
                            {selectedTemplate.valid_days}天
                          </Text>
                        </View>
                      ) : (
                        <View className="py-1 px-3 rounded-sm bg-purple-15">
                          <Text className="text-[20rpx] text-purple font-medium">永久</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className="flex flex-col items-end gap-2 flex-shrink-0">
                    {selectedTemplate.price > 0 && (
                      <Text className="text-[34rpx] font-extrabold text-primary">
                        ¥{selectedTemplate.price}
                      </Text>
                    )}
                    <Text className="text-[22rpx] text-primary font-medium">更改 ›</Text>
                  </View>
                </View>
              ) : isCustomPackage && totalHours > 0 ? (
                /* 已选自定义课包摘要卡片 */
                <View
                  className="flex items-center gap-6 p-[28rpx] rounded-[28rpx] border-[3rpx] border-primary bg-primary-5"
                  onClick={openPackageSheet}
                >
                  <View className="w-[96rpx] h-[96rpx] rounded-[24rpx] flex items-center justify-center flex-shrink-0 bg-muted">
                    <Text className="text-[44rpx]">✏️</Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[30rpx] font-bold text-foreground block">
                      {customName || '自定义课包'}
                    </Text>
                    <View className="flex gap-2 mt-2">
                      <View className="py-1 px-3 rounded-sm bg-primary-15">
                        <Text className="text-[20rpx] text-primary font-medium">
                          {totalHours}课时
                        </Text>
                      </View>
                      {validDays > 0 ? (
                        <View className="py-1 px-3 rounded-sm bg-amber-15">
                          <Text className="text-[20rpx] text-amber font-medium">{validDays}天</Text>
                        </View>
                      ) : (
                        <View className="py-1 px-3 rounded-sm bg-purple-15">
                          <Text className="text-[20rpx] text-purple font-medium">永久</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className="flex flex-col items-end gap-2 flex-shrink-0">
                    {effectiveFeeAmount && parseFloat(effectiveFeeAmount) > 0 && (
                      <Text className="text-[34rpx] font-extrabold text-primary">
                        ¥{effectiveFeeAmount}
                      </Text>
                    )}
                    <Text className="text-[22rpx] text-primary font-medium">更改 ›</Text>
                  </View>
                </View>
              ) : (
                /* 未选择占位卡片 */
                <View
                  className="flex items-center gap-6 p-[36rpx] rounded-[28rpx] border-[4rpx] border-dashed border-input bg-white/50"
                  onClick={openPackageSheet}
                >
                  <View className="w-[96rpx] h-[96rpx] rounded-[24rpx] flex items-center justify-center flex-shrink-0 bg-muted">
                    <Text className="text-[44rpx]">📦</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[28rpx] font-semibold text-foreground block">
                      选择课包
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground/60 block mt-1">
                      从模板选择或自定义课包
                    </Text>
                  </View>
                  <Text className="text-[40rpx] text-muted-foreground/40">›</Text>
                </View>
              )}
            </View>
          )}

          {/* ====== 3. 课包信息（仅自定义课包时显示） ====== */}
          {!isEdit && isCustomPackage && !selectedTemplate && (
            <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
              <View className="flex items-center gap-1 mb-4">
                <Text className="text-lg text-foreground font-medium">课包信息</Text>
                <Text className="text-lg text-destructive">*</Text>
              </View>

              {/* 课时步进器 */}
              <View className="mb-4">
                <Text className="text-md text-muted-foreground font-medium mb-2 block">
                  课时数量
                </Text>
                <Stepper value={totalHours} min={1} max={200} step={1} onChange={setTotalHours} />
                <View className="flex gap-3 mt-3">
                  {QUICK_HOURS.map((h) => (
                    <View
                      key={h}
                      className={`py-2 px-6 rounded-[32rpx] border-[3rpx] ${totalHours === h ? 'border-primary bg-primary text-white' : 'border-input bg-white text-muted-foreground'}`}
                      onClick={() => setTotalHours(h)}
                    >
                      <Text
                        className={`text-[24rpx] font-medium ${totalHours === h ? 'text-white' : 'text-muted-foreground'}`}
                      >
                        {h}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 有效天数 */}
              <View>
                <Text className="text-md text-muted-foreground font-medium mb-2 block">
                  有效天数
                </Text>
                <View className="flex items-center gap-4">
                  <View className="flex-1 border-[3rpx] border-input rounded-[20rpx] py-[14rpx] px-[20rpx] bg-white">
                    <Input
                      className="w-full text-md text-foreground text-center"
                      type="number"
                      placeholder="0=永久有效"
                      value={validDays ? String(validDays) : ''}
                      onInput={(e) => setValidDays(parseInt(e.detail.value || '0') || 0)}
                    />
                  </View>
                  <Text className="text-[24rpx] text-muted-foreground">天</Text>
                </View>
              </View>
            </View>
          )}

          {/* ====== 4. 赠送课时 ====== */}
          {!isEdit && (selectedTemplate || isCustomPackage) && (
            <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
              <View className="flex items-center justify-between mb-4">
                <Text className="text-lg text-foreground font-medium">赠送课时</Text>
                <Text className="text-[22rpx] text-muted-foreground/60">选填</Text>
              </View>

              <View className="flex items-center gap-5">
                <Stepper value={giftHours} min={0} max={50} step={1} onChange={handleGiftChange} />
                <View className="flex gap-3">
                  {GIFT_OPTIONS.map((g) => (
                    <View
                      key={g}
                      className={`py-2 px-5 rounded-[32rpx] border-[3rpx] ${giftHours === g ? 'border-success bg-success text-white' : 'border-input bg-white'}`}
                      onClick={() => setGiftHours(g)}
                    >
                      <Text
                        className={`text-[24rpx] font-medium ${giftHours === g ? 'text-white' : 'text-muted-foreground'}`}
                      >
                        {g === 0 ? '0' : `+${g}`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {giftHours > 0 && (
                <View className="mt-3 py-3 px-5 rounded-[16rpx] bg-success-5">
                  <Text className="text-[24rpx] text-success">
                    赠送 {giftHours} 课时，合计到账 {totalWithGift} 课时
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ====== 5. 收费信息 ====== */}
          <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
            <View className="flex items-center justify-between mb-4">
              <Text className="text-lg text-foreground font-medium">收费信息</Text>
              <Text className="text-[22rpx] text-muted-foreground/60">选填，仅记录</Text>
            </View>

            {/* 金额输入 */}
            <View className="flex items-center border-[3rpx] border-border rounded-[24rpx] bg-white overflow-hidden mb-4">
              <View className="py-5 px-6 flex items-center justify-center bg-muted/30">
                <Text className="text-lg font-semibold text-muted-foreground">¥</Text>
              </View>
              <Input
                className="flex-1 py-5 px-7 text-lg font-semibold text-foreground"
                type="digit"
                placeholder="0.00"
                value={feeAmount}
                onInput={(e) => setFeeAmount(e.detail.value || '')}
              />
            </View>

            {/* 支付方式 */}
            <ChipPicker
              options={FEE_METHOD_OPTIONS.map((f) => ({ label: f.label, value: f.key }))}
              value={feeMethod}
              onChange={(val) => setFeeMethod(val as FeeMethod)}
            />

            {/* 分期开关 */}
            <View className="flex items-center justify-between pt-7 border-t border-input mt-6">
              <View className="flex-1">
                <Text className="text-md font-semibold text-foreground block">分期付款</Text>
                <Text className="text-[22rpx] text-muted-foreground/60 block mt-1">
                  记录分期还款计划
                </Text>
              </View>
              <View
                className={`w-[96rpx] h-[56rpx] rounded-full p-[6rpx] transition-all ${installmentEnabled ? 'bg-primary' : 'bg-border'}`}
                onClick={() => {
                  if (!installmentEnabled && !effectiveFeeAmount) {
                    Taro.showToast({ title: '请先填写金额', icon: 'none' });
                    return;
                  }
                  setInstallmentEnabled(!installmentEnabled);
                }}
              >
                <View
                  className={`w-[44rpx] h-[44rpx] rounded-full bg-white shadow-sm transition-transform ${installmentEnabled ? 'translate-x-[40rpx]' : 'translate-x-0'}`}
                />
              </View>
            </View>

            {/* 分期面板 */}
            <InstallmentPanel
              totalAmount={effectiveFeeAmount || '0'}
              enabled={installmentEnabled}
              onToggle={setInstallmentEnabled}
              periodCount={installmentPeriod}
              onPeriodChange={setInstallmentPeriod}
              schedule={installmentSchedule}
              onScheduleChange={setInstallmentSchedule}
            />
          </View>

          {/* ====== 6. 备注 ====== */}
          <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
            <View className="flex items-center justify-between mb-4">
              <Text className="text-lg text-foreground font-medium">备注</Text>
              <Text className="text-[22rpx] text-muted-foreground/60">选填</Text>
            </View>
            <Textarea
              className="w-full p-5 rounded-[20rpx] border-[3rpx] border-input bg-white text-[26rpx] text-foreground min-h-[120rpx]"
              placeholder="输入备注信息"
              value={note}
              onInput={(e) => setNote(e.detail.value || '')}
            />
          </View>

          {/* ====== 编辑模式额外字段 ====== */}
          {isEdit && (
            <>
              <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
                <Text className="text-lg text-foreground font-medium block mb-3">剩余课时</Text>
                <View className="border-[3rpx] border-input rounded-[24rpx] py-[20rpx] px-[28rpx] bg-white">
                  <Input
                    className="w-full text-lg text-foreground"
                    type="number"
                    placeholder="剩余课时"
                    value={editRemainingHours}
                    onInput={(e) => setEditRemainingHours(e.detail.value || '')}
                  />
                </View>
              </View>
              <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
                <Text className="text-lg text-foreground font-medium block mb-3">过期日期</Text>
                <View className="border-[3rpx] border-input rounded-[24rpx] py-[20rpx] px-[28rpx] bg-white">
                  <Input
                    className="w-full text-lg text-foreground"
                    placeholder="YYYY-MM-DD"
                    value={editExpiryDate}
                    onInput={(e) => setEditExpiryDate(e.detail.value || '')}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {/* ====== 底部按钮 ====== */}
        <View
          className="fixed bottom-0 left-0 right-0 px-8 py-6 bg-white/95 backdrop-blur-sm border-t-[2rpx] border-border pb-safe-bar z-50 pointer-events-auto"
          style={{ boxShadow: '0 -2px 12px rgba(0,0,0,0.06)' }}
        >
          <View
            className={`w-full py-[30rpx] rounded-[48rpx] flex items-center justify-center gap-2 transition pointer-events-auto ${canSubmit && !saving ? 'bg-gradient-primary' : 'bg-border'}`}
            style={
              canSubmit && !saving
                ? { background: 'linear-gradient(135deg, #5EC8A8, #4AB893)' }
                : {}
            }
            onClick={canSubmit && !saving ? handleSave : undefined}
          >
            <Text className="text-lg font-bold text-white">
              {saving ? '保存中...' : submitSummary}
            </Text>
          </View>
        </View>

        {/* ====== 学员选择浮窗 ====== */}
        {showStudentSheet && (
          <BottomSheet
            show={showStudentSheet}
            visible={studentSheetVisible}
            title="选择学员"
            onClose={closeStudentSheet}
            maxHeight="70vh"
          >
            {/* 搜索框 */}
            <View className="px-10 pt-4 pb-2">
              <View className="border-[2rpx] border-input rounded-[20rpx] py-[18rpx] px-[24rpx] bg-white">
                <Input
                  className="w-full text-[26rpx] text-foreground"
                  placeholder="搜索学员姓名或手机号"
                  value={studentSearch}
                  onInput={(e) => setStudentSearch(e.detail.value || '')}
                />
              </View>
            </View>

            {/* 学员列表 */}
            <View className="px-10 pb-10">
              {filteredStudents.map((stu) => (
                <View
                  key={stu.id}
                  className={`flex items-center gap-5 py-5 border-b border-input/50 ${selectedStudent?.id === stu.id ? 'bg-primary-5 -mx-4 px-4 rounded-2xl' : ''}`}
                  onClick={() => handleSelectStudent(stu)}
                >
                  <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="md" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-md font-medium text-foreground block">{stu.name}</Text>
                    <Text className="text-[22rpx] text-muted-foreground/60 block mt-1">
                      {stu.phone || '暂无手机号'} · 剩余
                      {(stu.course_packages || []).reduce(
                        (s, p) => s + (p.remaining_hours || 0),
                        0,
                      )}
                      课时
                    </Text>
                  </View>
                  {selectedStudent?.id === stu.id && (
                    <Text className="text-primary text-lg">✓</Text>
                  )}
                </View>
              ))}
              {filteredStudents.length === 0 && (
                <View className="py-10 text-center">
                  <Text className="text-md text-muted-foreground">未找到学员</Text>
                </View>
              )}
            </View>
          </BottomSheet>
        )}

        {/* ====== 课包选择浮窗 ====== */}
        {showPackageSheet && (
          <BottomSheet
            show={showPackageSheet}
            visible={packageSheetVisible}
            title="选择课包"
            onClose={closePackageSheet}
            maxHeight="70vh"
          >
            <View className="px-10 pb-10">
              {/* 模板列表 */}
              {templates.map((tpl) => {
                const typeInfo = TYPE_ICON_MAP[tpl.type] || TYPE_ICON_MAP.hour_package;
                const isSelected = selectedTemplate?.id === tpl.id;
                return (
                  <View
                    key={tpl.id}
                    className={`flex items-center gap-5 p-[28rpx] rounded-[24rpx] border-[3rpx] mb-4 transition ${isSelected ? 'border-primary bg-primary-5' : 'border-input bg-white/50'}`}
                    onClick={() => handleSelectTemplate(tpl)}
                  >
                    <View
                      className="w-[84rpx] h-[84rpx] rounded-[20rpx] flex items-center justify-center flex-shrink-0"
                      style={{ background: typeInfo.bg }}
                    >
                      <Text className="text-[40rpx]">{typeInfo.icon}</Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-[28rpx] font-semibold text-foreground block">
                        {tpl.name}
                      </Text>
                      {tpl.description && (
                        <Text className="text-[22rpx] text-muted-foreground block mt-1">
                          {tpl.description}
                        </Text>
                      )}
                      <View className="flex gap-2 mt-2">
                        <View className="py-1 px-3 rounded-sm bg-primary-15">
                          <Text className="text-[20rpx] text-primary font-medium">
                            {tpl.lesson_count}课时
                          </Text>
                        </View>
                        {tpl.valid_days ? (
                          <View className="py-1 px-3 rounded-sm bg-amber-15">
                            <Text className="text-[20rpx] text-amber font-medium">
                              {tpl.valid_days}天
                            </Text>
                          </View>
                        ) : (
                          <View className="py-1 px-3 rounded-sm bg-purple-15">
                            <Text className="text-[20rpx] text-purple font-medium">永久</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View className="flex flex-col items-end gap-3 flex-shrink-0">
                      {tpl.price > 0 && (
                        <Text className="text-[30rpx] font-bold text-primary">¥{tpl.price}</Text>
                      )}
                      <View
                        className={`w-[40rpx] h-[40rpx] rounded-full border-[4rpx] flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-input'}`}
                      >
                        {isSelected && <Text className="text-[20rpx] text-white">✓</Text>}
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* 自定义课包 */}
              <View
                className={`border-[4rpx] border-dashed rounded-[24rpx] p-[28rpx] text-center transition ${isCustomPackage ? 'border-primary bg-primary-5' : 'border-input bg-white/50'}`}
                onClick={isCustomPackage ? undefined : handleSelectCustom}
              >
                {!isCustomPackage ? (
                  <>
                    <Text className="text-[44rpx] block mb-1">✏️</Text>
                    <Text className="text-[26rpx] font-semibold text-foreground block">
                      自定义课包
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground block mt-1">
                      手动输入课时和有效期
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-[26rpx] font-semibold text-foreground block mb-4">
                      自定义课包
                    </Text>
                    <View className="text-left">
                      <View className="mb-4">
                        <Text className="text-[26rpx] font-semibold text-foreground block mb-2">
                          名称 <Text className="text-destructive text-[20rpx]">*</Text>
                        </Text>
                        <Input
                          className="w-full py-5 px-7 rounded-[20rpx] border-[3rpx] border-input bg-white text-[28rpx] text-foreground"
                          placeholder="如：暑假特训课包"
                          value={customName}
                          onInput={(e) => setCustomName(e.detail.value || '')}
                        />
                      </View>
                      <View className="flex gap-5 mb-4">
                        <View className="flex-1">
                          <Text className="text-[26rpx] font-semibold text-foreground block mb-2">
                            课时 <Text className="text-destructive text-[20rpx]">*</Text>
                          </Text>
                          <Input
                            className="w-full py-5 px-7 rounded-[20rpx] border-[3rpx] border-input bg-white text-[28rpx] text-foreground text-center"
                            type="number"
                            placeholder="课时数"
                            value={customHours}
                            onInput={(e) => setCustomHours(e.detail.value || '')}
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[26rpx] font-semibold text-foreground block mb-2">
                            有效天数
                          </Text>
                          <Input
                            className="w-full py-5 px-7 rounded-[20rpx] border-[3rpx] border-input bg-white text-[28rpx] text-foreground text-center"
                            type="number"
                            placeholder="0=永久"
                            value={customValidDays}
                            onInput={(e) => setCustomValidDays(e.detail.value || '')}
                          />
                        </View>
                      </View>
                      <View className="mb-4">
                        <Text className="text-[26rpx] font-semibold text-foreground block mb-2">
                          金额
                        </Text>
                        <Input
                          className="w-full py-5 px-7 rounded-[20rpx] border-[3rpx] border-input bg-white text-[28rpx] text-foreground"
                          type="digit"
                          placeholder="0.00"
                          value={customPrice}
                          onInput={(e) => setCustomPrice(e.detail.value || '')}
                        />
                      </View>
                      <View
                        className="w-full py-5 rounded-[24rpx] bg-gradient-primary text-center"
                        style={{ background: 'linear-gradient(135deg, #5EC8A8, #4AB893)' }}
                        onClick={handleConfirmCustom}
                      >
                        <Text className="text-lg font-bold text-white">确认</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>

              {templates.length === 0 && !isCustomPackage && (
                <View className="py-10 text-center">
                  <Text className="text-md text-muted-foreground">
                    暂无课包模板，请选择自定义课包
                  </Text>
                </View>
              )}
            </View>
          </BottomSheet>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(PackageForm);
