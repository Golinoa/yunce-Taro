/**
 * SalaryEditSheet - 薪资编辑弹窗
 *
 * 从底部弹出的编辑表单，独立于薪资详情页的只读展示。
 * 这种设计彻底避免了在页面内切换 editable 状态导致的
 * Taro reconciler _num 崩溃问题。
 */
import { View, Text, Input } from '@tarojs/components';
import cn from 'classnames';
import React, { useState, useEffect, useCallback } from 'react';
import BottomSheet from '@/components/BottomSheet';

export interface SalaryEditData {
  base: number;
  lessonFee: number;
  attend: number;
  perf: number;
}

interface SalaryEditErrors {
  base?: string;
  lessonFee?: string;
  attend?: string;
  perf?: string;
}

export interface SalaryEditSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 教师名称 */
  teacherName: string;
  /** 课时数（展示用） */
  hours: number;
  /** 当前费率（展示用） */
  rate: number;
  /** 初始数据 */
  initialData: SalaryEditData;
  /** 保存回调 */
  onSave: (data: SalaryEditData) => Promise<void>;
  /** 关闭回调 */
  onClose: () => void;
}

/** 输入框统一样式 */
const INPUT_WRAPPER =
  'flex items-center justify-between py-[24rpx] border-b-[2rpx] border-border/30';
const INPUT_LABEL = 'text-[30rpx] text-foreground shrink-0 mr-[24rpx]';
const INPUT_FIELD =
  'text-right text-[30rpx] text-foreground h-[72rpx] flex-1 min-w-0 bg-transparent';
const INPUT_SUFFIX = 'text-[30rpx] text-muted-foreground ml-[8rpx] shrink-0';

const SalaryEditSheet: React.FC<SalaryEditSheetProps> = ({
  visible,
  teacherName,
  hours,
  rate,
  initialData,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<SalaryEditData>(initialData);
  const [errors, setErrors] = useState<SalaryEditErrors>({});
  const [saving, setSaving] = useState(false);

  // 弹窗打开时重置
  useEffect(() => {
    if (visible) {
      setDraft(initialData);
      setErrors({});
      setSaving(false);
    }
  }, [visible, initialData]);

  const validate = useCallback((): boolean => {
    const next: SalaryEditErrors = {};
    if (draft.base < 0) next.base = '不能为负数';
    if (draft.lessonFee < 0) next.lessonFee = '不能为负数';
    if (draft.attend < 0) next.attend = '不能为负数';
    if (draft.perf < 0) next.perf = '不能为负数';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [draft]);

  const handleSave = useCallback(async () => {
    if (!validate()) {
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } catch {
      // 由调用方处理 toast
    } finally {
      setSaving(false);
    }
  }, [draft, validate, onSave]);

  const updateField = useCallback((key: keyof SalaryEditData, raw: string) => {
    const v = raw === '' ? 0 : Number(raw) || 0;
    setDraft((d) => ({ ...d, [key]: v }));
  }, []);

  return (
    <BottomSheet visible={visible} title="编辑薪资" onClose={onClose}>
      <View className="px-[32rpx] pb-[40rpx]">
        {/* 教师信息 */}
        <View className="mb-[24rpx] p-[24rpx] rounded-[16rpx] bg-muted">
          <Text className="text-[28rpx] text-muted-foreground">
            当前教师：
            <Text className="font-semibold text-foreground">{teacherName}</Text>
          </Text>
        </View>

        {/* 底薪 */}
        <View className={INPUT_WRAPPER}>
          <Text className={INPUT_LABEL}>底薪</Text>
          <Input
            type="digit"
            className={INPUT_FIELD}
            placeholder="0"
            value={String(draft.base)}
            onInput={(e) => updateField('base', e.detail.value)}
          />
          <Text className={INPUT_SUFFIX}>元</Text>
        </View>
        {errors.base && (
          <Text className="text-[24rpx] text-destructive mt-[8rpx]">{errors.base}</Text>
        )}

        {/* 课时费 */}
        <View className={INPUT_WRAPPER}>
          <Text className={INPUT_LABEL}>
            课时费 ({hours}课时 × ¥{rate})
          </Text>
          <Input
            type="digit"
            className={INPUT_FIELD}
            placeholder="0"
            value={String(draft.lessonFee)}
            onInput={(e) => updateField('lessonFee', e.detail.value)}
          />
          <Text className={INPUT_SUFFIX}>元</Text>
        </View>
        {errors.lessonFee && (
          <Text className="text-[24rpx] text-destructive mt-[8rpx]">{errors.lessonFee}</Text>
        )}

        {/* 全勤奖 */}
        <View className={INPUT_WRAPPER}>
          <Text className={INPUT_LABEL}>全勤奖</Text>
          <Input
            type="digit"
            className={INPUT_FIELD}
            placeholder="0"
            value={String(draft.attend)}
            onInput={(e) => updateField('attend', e.detail.value)}
          />
          <Text className={INPUT_SUFFIX}>元</Text>
        </View>
        {errors.attend && (
          <Text className="text-[24rpx] text-destructive mt-[8rpx]">{errors.attend}</Text>
        )}

        {/* 绩效奖金 */}
        <View className={INPUT_WRAPPER}>
          <Text className={INPUT_LABEL}>绩效奖金</Text>
          <Input
            type="digit"
            className={INPUT_FIELD}
            placeholder="0"
            value={String(draft.perf)}
            onInput={(e) => updateField('perf', e.detail.value)}
          />
          <Text className={INPUT_SUFFIX}>元</Text>
        </View>
        {errors.perf && (
          <Text className="text-[24rpx] text-destructive mt-[8rpx]">{errors.perf}</Text>
        )}

        {/* 操作按钮 */}
        <View className="flex gap-[24rpx] mt-[40rpx]">
          <View
            className="flex-1 py-[24rpx] rounded-[24rpx] text-center bg-muted press-scale"
            onClick={saving ? undefined : onClose}
          >
            <Text className="text-[28rpx] font-semibold text-muted-foreground">取消</Text>
          </View>
          <View
            className={cn(
              'flex-1 py-[24rpx] rounded-[24rpx] text-center press-scale',
              saving ? 'bg-muted' : 'bg-gradient-primary',
            )}
            onClick={saving ? undefined : handleSave}
          >
            <Text
              className={cn(
                'text-[28rpx] font-semibold',
                saving ? 'text-muted-foreground' : 'text-white',
              )}
            >
              {saving ? '保存中...' : '保存'}
            </Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default SalaryEditSheet;
