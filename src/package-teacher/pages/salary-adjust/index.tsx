/**
 * 调整工资页面
 *
 * 使用场景：薪资发放页点击「待核对/已核对」状态的老师卡片后进入，
 * 可查看并直接编辑系统计算工资、罚款、奖金、自定义调整项，并保存调整。
 *
 * 设计说明：
 * - 页面背景 #EFEFEF，卡片白色圆角
 * - 除课时费、提成为系统计算外，其余字段均可在页面内直接输入编辑
 * - 自定义调整项点击「+ 添加」后立即生成带边框的两行内联编辑元素
 * - 汇总卡片展示系统合计、自定义奖励、自定义扣款、实发工资的次级明细
 */
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import LessonFeeDetailSheet from '@/components/teacher/LessonFeeDetailSheet';
import { useTeacherStore } from '@/stores/teacher';
import type { CategoryLessonFeeItem, DeductionType } from '@/types/teacher';

/** 页面背景色 */
const PAGE_BACKGROUND = '#EFEFEF';

/** 解析金额字符串为数字 */
const parseAmount = (value: string) => {
  const num = parseFloat(value);
  return Number.isNaN(num) ? 0 : num;
};

/** 本地自定义调整项（金额用字符串便于输入） */
interface LocalDeduction {
  id: string;
  reason: string;
  amount: string;
  type: DeductionType;
}

/** 卡片标题 */
const CardTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({
  children,
  action,
}) => (
  <View className="flex items-center justify-between mb-[24rpx]">
    <Text className="text-[30rpx] font-bold text-foreground">{children}</Text>
    {action}
  </View>
);

/** 可编辑信息行（标签 + FormInput） */
const EditableRow: React.FC<{
  label: string;
  value: string;
  onInput: (value: string) => void;
  type?: 'text' | 'number' | 'digit';
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  negative?: boolean;
}> = ({ label, value, onInput, type = 'digit', prefix, suffix, placeholder, negative }) => (
  <View className="flex items-center justify-between py-[16rpx]">
    <Text className="text-[26rpx] text-muted-foreground shrink-0 mr-[24rpx]">{label}</Text>
    <View className="flex items-center gap-[8rpx] flex-1 justify-end">
      {prefix && <Text className="text-[28rpx] text-foreground">{prefix}</Text>}
      <FormInput
        variant="ghost"
        label=""
        value={value}
        type={type}
        placeholder={placeholder}
        className="w-[200rpx] mb-0"
        inputClassName={cn(
          'text-right text-[28rpx]',
          negative ? 'text-destructive' : 'text-foreground',
        )}
        onInput={(e) => onInput(e.detail.value)}
      />
      {suffix && <Text className="text-[28rpx] text-foreground">{suffix}</Text>}
    </View>
  </View>
);

/** 系统计算工资中的课时费行（只读 + 可点击展开明细） */
const LessonFeeRow: React.FC<{
  item: CategoryLessonFeeItem;
  onClick: () => void;
}> = ({ item, onClick }) => (
  <View className="flex items-center justify-between py-[20rpx] press-scale" onClick={onClick}>
    <Text className="text-[26rpx] text-muted-foreground">{item.categoryName}课时费</Text>
    <View className="flex items-center gap-[8rpx]">
      <Text className="text-[28rpx] text-foreground">{item.amount.toFixed(2)}</Text>
      <Icon name="mdi-chevron-right" size={18} className="text-muted-foreground" />
    </View>
  </View>
);

/** 汇总行 */
const SummaryRow: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
  negative?: boolean;
}> = ({ label, value, highlight, positive, negative }) => (
  <View className="flex items-center justify-between py-[18rpx]">
    <Text
      className={cn(
        'text-[26rpx]',
        positive ? 'text-success' : negative ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {label}
    </Text>
    <Text
      className={cn(
        'text-[28rpx] font-medium',
        highlight
          ? 'text-[32rpx] font-bold text-primary'
          : positive
            ? 'text-success'
            : negative
              ? 'text-destructive'
              : 'text-foreground',
      )}
    >
      {value}
    </Text>
  </View>
);

/** 自定义调整项内联编辑卡片 */
const DeductionItemCard: React.FC<{
  item: LocalDeduction;
  onChange: (id: string, updates: Partial<LocalDeduction>) => void;
  onDelete: (id: string) => void;
}> = ({ item, onChange, onDelete }) => {
  const isDeduct = item.type === 'deduct';
  return (
    <View className="border border-border rounded-[20rpx] p-[24rpx] mb-[16rpx] bg-white">
      {/* 第一行：名称输入 + 类型切换 */}
      <View className="flex items-center justify-between gap-[16rpx] mb-[20rpx]">
        <FormInput
          variant="ghost"
          label=""
          value={item.reason}
          placeholder="请输入项目名称"
          className="flex-1 mb-0"
          inputClassName="text-left text-[28rpx] font-medium text-foreground"
          onInput={(e) => onChange(item.id, { reason: e.detail.value })}
        />
        <View className="flex items-center gap-[12rpx] shrink-0">
          <View
            className={cn(
              'px-[20rpx] py-[8rpx] rounded-[10rpx] text-[24rpx] font-medium press-scale',
              !isDeduct ? 'bg-success-bg text-success' : 'bg-muted text-muted-foreground',
            )}
            onClick={() => onChange(item.id, { type: 'bonus' })}
          >
            奖励
          </View>
          <View
            className={cn(
              'px-[20rpx] py-[8rpx] rounded-[10rpx] text-[24rpx] font-medium press-scale',
              isDeduct ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
            )}
            onClick={() => onChange(item.id, { type: 'deduct' })}
          >
            扣款
          </View>
        </View>
      </View>

      {/* 第二行：金额输入 + 删除 */}
      <View className="flex items-center justify-end gap-[16rpx]">
        <FormInput
          variant="ghost"
          label=""
          value={item.amount}
          type="digit"
          placeholder="0"
          className="w-[160rpx] mb-0"
          inputClassName="text-right text-[32rpx] font-bold text-foreground"
          onInput={(e) => onChange(item.id, { amount: e.detail.value })}
        />
        <Text className="text-[28rpx] text-foreground">元</Text>
        <Text
          className="text-[26rpx] text-destructive press-scale ml-[8rpx]"
          onClick={() => onDelete(item.id)}
        >
          删除
        </Text>
      </View>
    </View>
  );
};

const SalaryAdjustPage: React.FC = () => {
  const { id } = useRouter().params;
  const { teachers, updateTeacher } = useTeacherStore();

  const teacher = useMemo(() => teachers.find((t) => t.id === id), [teachers, id]);

  useEffect(() => {
    if (teacher) {
      void Taro.setNavigationBarTitle({ title: `调整工资 - ${teacher.name}` });
    }
  }, [teacher]);

  /** 本地表单状态 */
  const [form, setForm] = useState({
    base: '',
    lateFine: '',
    otherFine: '',
    bonusAmount: '',
    socialInsurance: '',
    deductions: [] as LocalDeduction[],
  });

  /** 初始化表单 */
  useEffect(() => {
    if (teacher) {
      setForm({
        base: teacher.base.toString(),
        lateFine: (teacher.lateFine || 0).toString(),
        otherFine: (teacher.otherFine || 0).toString(),
        bonusAmount: (teacher.bonusAmount || 0).toString(),
        socialInsurance: (teacher.socialInsurance || 0).toString(),
        deductions: teacher.deductions.map((d) => ({
          id: d.id,
          reason: d.reason,
          amount: d.amount.toString(),
          type: d.type,
        })),
      });
    }
  }, [teacher]);

  /** 课时费明细弹窗 */
  const [detailSheet, setDetailSheet] = useState<{
    visible: boolean;
    item: CategoryLessonFeeItem | null;
  }>({ visible: false, item: null });

  const handleOpenLessonFeeDetail = useCallback((item: CategoryLessonFeeItem) => {
    setDetailSheet({ visible: true, item });
  }, []);

  /** 更新普通字段 */
  const handleFieldChange = useCallback((field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  /** 更新自定义调整项 */
  const handleDeductionChange = useCallback(
    (deductionId: string, updates: Partial<LocalDeduction>) => {
      setForm((prev) => ({
        ...prev,
        deductions: prev.deductions.map((d) => (d.id === deductionId ? { ...d, ...updates } : d)),
      }));
    },
    [],
  );

  /** 添加自定义调整项 */
  const handleAddDeduction = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      deductions: [
        ...prev.deductions,
        { id: `temp-${Date.now()}`, reason: '', amount: '', type: 'deduct' },
      ],
    }));
  }, []);

  /** 删除自定义调整项 */
  const handleDeleteDeduction = useCallback((deductionId: string) => {
    setForm((prev) => ({
      ...prev,
      deductions: prev.deductions.filter((d) => d.id !== deductionId),
    }));
  }, []);

  /** 系统薪资合计（不含罚款/奖金/自定义调整） */
  const systemTotal = useMemo(() => {
    if (!teacher) return 0;
    const lessonFee = teacher.categoryLessonFees?.reduce((sum, item) => sum + item.amount, 0) ?? 0;
    return (
      parseAmount(form.base) +
      lessonFee +
      teacher.attend +
      teacher.perf -
      parseAmount(form.socialInsurance)
    );
  }, [teacher, form.base, form.socialInsurance]);

  /** 自定义奖励总额 */
  const customBonus = useMemo(
    () =>
      form.deductions
        .filter((d) => d.type === 'bonus')
        .reduce((sum, d) => sum + parseAmount(d.amount), 0),
    [form.deductions],
  );

  /** 自定义扣款总额 */
  const customDeduct = useMemo(
    () =>
      form.deductions
        .filter((d) => d.type === 'deduct')
        .reduce((sum, d) => sum + parseAmount(d.amount), 0),
    [form.deductions],
  );

  /** 实发工资 */
  const total = useMemo(() => {
    if (!teacher) return 0;
    const lessonFee = teacher.categoryLessonFees?.reduce((s, item) => s + item.amount, 0) ?? 0;
    let result = parseAmount(form.base) + lessonFee + teacher.attend + teacher.perf;
    result -= parseAmount(form.socialInsurance);
    result -= parseAmount(form.lateFine);
    result -= parseAmount(form.otherFine);
    result += parseAmount(form.bonusAmount);
    result += customBonus;
    result -= customDeduct;
    return Math.max(0, result);
  }, [teacher, form, customBonus, customDeduct]);

  /** 保存调整 */
  const handleSave = useCallback(async () => {
    if (!teacher) return;

    const deductions = form.deductions.map((d) => ({
      id: d.id.startsWith('temp-')
        ? `d${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : d.id,
      reason: d.reason.trim() || '自定义调整',
      amount: parseAmount(d.amount),
      type: d.type,
    }));

    try {
      await updateTeacher(teacher.id, {
        base: parseAmount(form.base),
        lateFine: parseAmount(form.lateFine),
        otherFine: parseAmount(form.otherFine),
        bonusAmount: parseAmount(form.bonusAmount),
        socialInsurance: parseAmount(form.socialInsurance),
        deductions,
      });
      Taro.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        void Taro.navigateBack();
      }, 500);
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  }, [teacher, form, updateTeacher]);

  if (!teacher) {
    return (
      <View className="min-h-screen bg-background pb-safe-bar">
        <View className="flex items-center justify-center py-[160rpx]">
          <Text className="text-[28rpx] text-muted-foreground">教师不存在</Text>
        </View>
      </View>
    );
  }

  const categoryLessonFees = teacher.categoryLessonFees ?? [];

  return (
    <View className="min-h-screen pb-[140rpx]" style={{ backgroundColor: PAGE_BACKGROUND }}>
      {/* 系统计算工资 */}
      <View className="mx-[32rpx] mt-[24rpx] bg-white rounded-[28rpx] p-[32rpx] shadow-card">
        <CardTitle>系统计算工资</CardTitle>
        <EditableRow
          label="底薪"
          value={form.base}
          type="number"
          onInput={(value) => handleFieldChange('base', value)}
        />
        {categoryLessonFees.map((item) => (
          <LessonFeeRow
            key={item.categoryId}
            item={item}
            onClick={() => handleOpenLessonFeeDetail(item)}
          />
        ))}
        <View className="flex items-center justify-between py-[20rpx]">
          <Text className="text-[26rpx] text-muted-foreground">提成</Text>
          <Text className="text-[28rpx] text-foreground">
            {(teacher.attend + teacher.perf).toFixed(2)}
          </Text>
        </View>
        <EditableRow
          label="个人社保"
          value={form.socialInsurance}
          type="number"
          negative
          onInput={(value) => handleFieldChange('socialInsurance', value)}
        />
        <View className="h-[2rpx] bg-border/30 my-[8rpx]" />
        <View className="flex items-center justify-between py-[20rpx]">
          <Text className="text-[26rpx] text-muted-foreground">薪资合计（系统）</Text>
          <Text className="text-[32rpx] font-bold text-primary">{systemTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* 罚款扣除 */}
      <View className="mx-[32rpx] mt-[24rpx] bg-white rounded-[28rpx] p-[32rpx] shadow-card">
        <CardTitle>罚款扣除</CardTitle>
        <EditableRow
          label="迟到罚款"
          value={form.lateFine}
          suffix="元"
          onInput={(value) => handleFieldChange('lateFine', value)}
        />
        <EditableRow
          label="其他罚款"
          value={form.otherFine}
          suffix="元"
          onInput={(value) => handleFieldChange('otherFine', value)}
        />
      </View>

      {/* 奖金 */}
      <View className="mx-[32rpx] mt-[24rpx] bg-white rounded-[28rpx] p-[32rpx] shadow-card">
        <CardTitle>奖金</CardTitle>
        <EditableRow
          label="奖金金额"
          value={form.bonusAmount}
          suffix="元"
          onInput={(value) => handleFieldChange('bonusAmount', value)}
        />
      </View>

      {/* 自定义调整项 */}
      <View className="mx-[32rpx] mt-[24rpx] bg-white rounded-[28rpx] p-[32rpx] shadow-card">
        <CardTitle
          action={
            <Text
              className="text-[28rpx] font-medium text-primary press-scale"
              onClick={handleAddDeduction}
            >
              + 添加
            </Text>
          }
        >
          自定义调整项
        </CardTitle>
        {form.deductions.length > 0 ? (
          <View>
            {form.deductions.map((d) => (
              <DeductionItemCard
                key={d.id}
                item={d}
                onChange={handleDeductionChange}
                onDelete={handleDeleteDeduction}
              />
            ))}
          </View>
        ) : (
          <Text className="text-[26rpx] text-muted-foreground py-[16rpx] block">暂无自定义项</Text>
        )}
      </View>

      {/* 汇总：带次级明细 */}
      <View className="mx-[32rpx] mt-[24rpx] mb-[24rpx] bg-white rounded-[28rpx] p-[32rpx] shadow-card">
        <SummaryRow label="系统薪资合计" value={systemTotal.toFixed(2)} />
        {customBonus > 0 && (
          <SummaryRow label="+ 自定义奖励" value={`+${customBonus.toFixed(2)}`} positive />
        )}
        {customDeduct > 0 && (
          <SummaryRow label="- 自定义扣款" value={`-${customDeduct.toFixed(2)}`} negative />
        )}
        <View className="h-[2rpx] bg-border/30 my-[8rpx]" />
        <SummaryRow label="实发工资" value={total.toFixed(2)} highlight />
      </View>

      {/* 底部保存按钮 */}
      <View className="fixed bottom-0 left-0 right-0 px-[32rpx] py-[24rpx] pb-safe-bar bg-white border-t border-border z-20">
        <View
          className="w-full py-[28rpx] rounded-full bg-primary text-white text-[32rpx] font-bold text-center shadow-card press-scale"
          onClick={handleSave}
        >
          保存调整
        </View>
      </View>

      {/* 课时费明细弹窗 */}
      <LessonFeeDetailSheet
        visible={detailSheet.visible}
        categoryName={detailSheet.item ? `${detailSheet.item.categoryName}课时费` : ''}
        records={detailSheet.item?.records ?? []}
        onClose={() => setDetailSheet({ visible: false, item: null })}
      />
    </View>
  );
};

export default SalaryAdjustPage;
