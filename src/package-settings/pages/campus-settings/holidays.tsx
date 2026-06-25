/**
 * 假期设置页 pages/campus-settings/holidays
 *
 * 校长自主管理假期，不预置法定节假日
 * 只提供新增/删除功能，搞错了删了重新加
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback, useMemo } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { HOLIDAY_STATUS_MAP } from '@/data/campus';
import { useCampusStore } from '@/stores/campus';
import type { HolidayStatus } from '@/types/campus';

const Holidays: React.FC = () => {
  const { holidays, fetchHolidays, addHoliday, deleteHoliday } = useCampusStore();

  const [showFormSheet, setShowFormSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 表单
  const [form, setForm] = useState({
    name: '',
    icon: '📅',
    startDate: '',
    endDate: '',
    status: 'rest' as HolidayStatus,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    await fetchHolidays();
    const nextError = useCampusStore.getState().error;
    if (nextError) {
      setLoadError(nextError);
    }
    setLoading(false);
  }, [fetchHolidays]);

  Taro.useDidShow(() => {
    void reload();
  });

  // 页面显示时加载数据
  Taro.useDidShow(() => {
    fetchHolidays();
  });

  // ============================================
  // 添加假期
  // ============================================
  const handleOpenAdd = useCallback(() => {
    setForm({ name: '', icon: '📅', startDate: '', endDate: '', status: 'rest' });
    setShowFormSheet(true);
  }, []);

  // ============================================
  // 保存假期
  // ============================================
  const submitBlockedReason = useMemo(() => {
    if (!form.name.trim()) return '请输入假期名称';
    if (!form.startDate || !form.endDate) return '请选择日期范围';
    if (!dayjs(form.startDate).isValid() || !dayjs(form.endDate).isValid()) {
      return '请输入正确的日期';
    }
    if (form.startDate > form.endDate) return '结束日期不能早于开始日期';
    return '';
  }, [form]);

  const canSubmit = useMemo(() => !submitBlockedReason && !saving, [saving, submitBlockedReason]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      const result = await addHoliday({
        name: form.name.trim(),
        icon: form.icon,
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
      });
      if (!result) {
        Taro.showToast({ title: useCampusStore.getState().error || '添加假期失败', icon: 'none' });
        return;
      }
      setShowFormSheet(false);
      Taro.showToast({ title: '添加成功', icon: 'success' });
    } finally {
      setSaving(false);
    }
  }, [form, addHoliday, saving, submitBlockedReason]);

  // ============================================
  // 删除
  // ============================================
  const handleDelete = useCallback((id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const success = await deleteHoliday(deletingId);
      if (!success) {
        Taro.showToast({ title: useCampusStore.getState().error || '删除假期失败', icon: 'none' });
        return;
      }
      setShowDeleteConfirm(false);
      Taro.showToast({ title: '删除成功', icon: 'success' });
    } finally {
      setDeleting(false);
    }
  }, [deletingId, deleteHoliday, deleting]);

  const updateForm = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  /** 计算假期天数 */
  const calcDays = useCallback((start: string, end: string) => {
    const s = dayjs(start);
    const e = dayjs(end);
    return e.diff(s, 'day') + 1;
  }, []);

  /** 格式化日期范围 — 对齐设计稿 formatDateRange */
  const formatDateRange = useCallback(
    (start: string, end: string) => {
      const fmt = (d: string) => d.replace(/-/g, '年').replace(/年/, '月').replace(/月/, '日');
      if (start === end) return fmt(start);
      const days = calcDays(start, end);
      return `${fmt(start)}-${fmt(end)}（${days}天）`;
    },
    [calcDays],
  );

  /** 渲染假期卡片 — 对齐设计稿 holiday-card */
  const renderHolidayItem = (holiday: (typeof holidays)[0]) => {
    const statusInfo = HOLIDAY_STATUS_MAP[holiday.status] || HOLIDAY_STATUS_MAP.rest;
    return (
      <View
        key={holiday.id}
        className="bg-white rounded-[28rpx] shadow-soft px-[28rpx] py-[24rpx] mb-[16rpx] flex flex-row items-center gap-[20rpx]"
      >
        {/* 图标 — 设计稿：hol-icon bg=var(--amber-bg) */}
        <View className="w-[72rpx] h-[72rpx] rounded-[20rpx] bg-amber-10 flex items-center justify-center flex-shrink-0">
          <Text className="text-[36rpx]">{holiday.icon}</Text>
        </View>

        {/* 信息 — 设计稿：hol-name + hol-date 上下分行 */}
        <View className="flex-1 min-w-0">
          <Text className="text-[28rpx] font-semibold text-foreground">{holiday.name}</Text>
          <Text className="text-[22rpx] text-muted-foreground mt-[4rpx]">
            {formatDateRange(holiday.startDate, holiday.endDate)}
          </Text>
        </View>

        {/* 状态标签 — 设计稿：hol-status / hol-status.work */}
        <View
          className={cn(
            'px-[16rpx] py-[6rpx] rounded-[12rpx] flex-shrink-0',
            holiday.status === 'adjust' ? 'bg-primary-bg' : 'bg-destructive/10',
          )}
        >
          <Text
            className={cn(
              'text-[20rpx] font-semibold',
              holiday.status === 'adjust' ? 'text-primary' : 'text-destructive',
            )}
          >
            {statusInfo.label}
          </Text>
        </View>

        {/* 删除按钮 */}
        <View
          className="w-[56rpx] h-[56rpx] rounded-[12rpx] bg-destructive/10 flex items-center justify-center flex-shrink-0"
          onClick={() => handleDelete(holiday.id)}
        >
          <Icon name="mdi-delete-outline" size={28} color="destructive" />
        </View>
      </View>
    );
  };

  if (loading && !holidays.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载假期中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError && !holidays.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen px-[32rpx] flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={() => void reload()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      {/* 添加按钮 */}
      <View className="px-[32rpx] pt-[24rpx] flex flex-row justify-end">
        <View
          className="flex flex-row items-center bg-primary/10 px-[28rpx] py-[14rpx] rounded-full gap-[6rpx]"
          onClick={handleOpenAdd}
        >
          <Icon name="mdi-plus" size={28} color="primary" />
          <Text className="text-[26rpx] text-primary font-semibold">添加假期</Text>
        </View>
      </View>

      {/* 假期列表 — 不分类，统一展示 */}
      <View className="px-[32rpx] pt-[16rpx]">
        {deleting ? (
          <View className="mb-[16rpx] px-[24rpx] py-[18rpx] rounded-[20rpx] bg-white shadow-soft">
            <Text className="text-[24rpx] text-muted-foreground">正在删除假期，请稍候...</Text>
          </View>
        ) : null}
        {holidays.map((h) => renderHolidayItem(h))}
        {holidays.length === 0 && (
          <View className="pt-[180rpx]">
            <Empty
              icon="mdi-calendar-blank-outline"
              description="暂无假期，点击右上角添加假期"
              actionText="添加假期"
              onAction={handleOpenAdd}
            />
          </View>
        )}
      </View>

      {/* ============================================ */}
      {/* 添加假期弹窗 */}
      {/* ============================================ */}
      <BottomSheet
        visible={showFormSheet}
        title="添加假期"
        onClose={() => {
          if (saving) return;
          setShowFormSheet(false);
        }}
      >
        <View className="px-4 py-4">
          <FormInput
            label="假期名称"
            required
            placeholder="如：机构团建"
            value={form.name}
            onInput={(e) => updateForm('name', e.detail.value)}
          />

          {/* 图标选择 */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-2">图标</Text>
            <View className="flex flex-row gap-3">
              {['📅', '🎉', '☀️', '❄️', '🏖️', '🏕️', '🧧', '🌸'].map((emoji) => (
                <View
                  key={emoji}
                  className={cn(
                    'w-[64rpx] h-[64rpx] rounded-2xl flex items-center justify-center border-[3rpx]',
                    form.icon === emoji ? 'border-primary' : 'border-transparent bg-muted',
                  )}
                  onClick={() => updateForm('icon', emoji)}
                >
                  <Text className="text-[28rpx]">{emoji}</Text>
                </View>
              ))}
            </View>
          </View>

          <FormInput
            label="开始日期"
            required
            placeholder="2026-01-01"
            value={form.startDate}
            onInput={(e) => updateForm('startDate', e.detail.value)}
          />

          <FormInput
            label="结束日期"
            required
            placeholder="2026-01-03"
            value={form.endDate}
            onInput={(e) => updateForm('endDate', e.detail.value)}
          />

          {/* 状态选择 */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-2">状态</Text>
            <View className="flex flex-row gap-3">
              {(['rest', 'adjust'] as HolidayStatus[]).map((s) => {
                const info = HOLIDAY_STATUS_MAP[s];
                return (
                  <View
                    key={s}
                    className={cn(
                      'flex-1 py-3 rounded-2xl border-[3rpx] flex items-center justify-center',
                      form.status === s ? 'border-primary bg-primary/5' : 'border-d5e8e0',
                    )}
                    onClick={() => updateForm('status', s)}
                  >
                    <Text
                      className={cn(
                        'text-sm font-medium text-center',
                        form.status === s ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {info.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {!canSubmit && submitBlockedReason ? (
            <View className="mb-3">
              <Text className="text-sm text-muted-foreground">{submitBlockedReason}</Text>
            </View>
          ) : null}
          <View
            className={cn(
              'rounded-2xl py-4 flex items-center justify-center mt-4',
              canSubmit ? 'bg-primary' : 'bg-muted',
            )}
            onClick={canSubmit ? () => void handleSave() : undefined}
          >
            <Text className={cn('text-base font-semibold', canSubmit ? 'text-white' : 'text-muted-foreground')}>
              {saving ? '添加中...' : '确认添加'}
            </Text>
          </View>
        </View>
      </BottomSheet>

      {/* ============================================ */}
      {/* 删除确认弹窗 */}
      {/* ============================================ */}
      <BottomSheet
        visible={showDeleteConfirm}
        title="删除假期"
        onClose={() => {
          if (deleting) return;
          setShowDeleteConfirm(false);
        }}
      >
        <View className="px-4 py-6 items-center">
          <Text className="text-5xl mb-4">🗑️</Text>
          <Text className="text-lg font-semibold text-foreground mb-2">确认删除？</Text>
          <Text className="text-sm text-muted-foreground text-center">
            删除后该假期数据将无法恢复
          </Text>
          <View className="flex flex-row gap-3 w-full mt-6">
            <View
              className="flex-1 bg-muted rounded-2xl py-3 items-center"
              onClick={() => {
                if (deleting) return;
                setShowDeleteConfirm(false);
              }}
            >
              <Text className="text-sm text-muted-foreground font-medium">取消</Text>
            </View>
            <View
              className={cn(
                'flex-1 rounded-2xl py-3 items-center',
                deleting ? 'bg-muted' : 'bg-destructive',
              )}
              onClick={deleting ? undefined : () => void handleConfirmDelete()}
            >
              <Text className={cn('text-sm font-medium', deleting ? 'text-muted-foreground' : 'text-white')}>
                {deleting ? '删除中...' : '确认删除'}
              </Text>
            </View>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

export default Holidays;
