/**
 * 发薪日设置页 pages/campus-settings/pay-day
 *
 * 对齐设计稿三个区域：
 * 1. 发薪规则（发薪日+课时报表推送+自动确认）
 * 2. 薪资模板（工资模型列表+新建模板）
 * 3. 本月发薪状态（待处理/应发总额/倒计时）
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { useCampusStore } from '@/stores/campus';
import type { SalaryModel } from '@/types/campus';

const PayDay: React.FC = () => {
  const {
    payDaySettings,
    salaryModels,
    fetchPayDaySettings,
    fetchSalaryModels,
    updatePayDaySettings,
    createSalaryModel,
    updateSalaryModel,
    deleteSalaryModel,
  } = useCampusStore();

  const [fixedDay, setFixedDay] = useState(payDaySettings.fixedDay || 15);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingPayDay, setSavingPayDay] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [deletingModelId, setDeletingModelId] = useState('');

  // 薪资模板弹窗
  const [showModelSheet, setShowModelSheet] = useState(false);
  const [editingModel, setEditingModel] = useState<SalaryModel | null>(null);
  const [modelForm, setModelForm] = useState({
    name: '',
    type: 'standard' as SalaryModel['type'],
    base: '',
    rate: '',
    attend: '',
    perf: '',
  });

  // 发薪日修改弹窗
  const [showPayDaySheet, setShowPayDaySheet] = useState(false);
  const [pickerDay, setPickerDay] = useState(fixedDay);

  // 页面显示时加载数据
  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    await Promise.all([fetchPayDaySettings(), fetchSalaryModels()]);
    const nextError = useCampusStore.getState().error;
    if (nextError) {
      setLoadError(nextError);
    }
    setLoading(false);
  }, [fetchPayDaySettings, fetchSalaryModels]);

  Taro.useDidShow(() => {
    void reload();
  });

  useEffect(() => {
    setFixedDay(payDaySettings.fixedDay || 15);
    setPickerDay(payDaySettings.fixedDay || 15);
  }, [payDaySettings.fixedDay]);

  // 计算距发薪日天数
  const daysUntilPayDay = useCallback(() => {
    const today = dayjs();
    const payDay = payDaySettings.fixedDay || 15;
    let target = today.date(payDay);
    if (target.isBefore(today, 'day')) {
      target = today.add(1, 'month').date(payDay);
    }
    return target.diff(today, 'day');
  }, [payDaySettings.fixedDay]);

  const totalTeachersUsingModels = useMemo(
    () => salaryModels.reduce((sum, model) => sum + model.teacherCount, 0),
    [salaryModels],
  );

  const totalBaseConfig = useMemo(
    () => salaryModels.reduce((sum, model) => sum + model.base * model.teacherCount, 0),
    [salaryModels],
  );

  const defaultModelCount = useMemo(
    () => salaryModels.filter((model) => model.isDefault).length,
    [salaryModels],
  );

  // ============================================
  // 薪资模板操作
  // ============================================
  const handleOpenAddModel = useCallback(() => {
    setEditingModel(null);
    setModelForm({ name: '', type: 'standard', base: '', rate: '', attend: '', perf: '' });
    setShowModelSheet(true);
  }, []);

  const handleOpenEditModel = useCallback(
    (id: string) => {
      const model = salaryModels.find((m) => m.id === id);
      if (!model) return;
      setEditingModel(model);
      setModelForm({
        name: model.name,
        type: model.type,
        base: String(model.base),
        rate: String(model.rate),
        attend: String(model.attend),
        perf: String(model.perf),
      });
      setShowModelSheet(true);
    },
    [salaryModels],
  );

  const modelSubmitBlockedReason = useMemo(() => {
    if (!modelForm.name.trim()) return '请输入模板名称';
    if (modelForm.name.trim().length > 20) return '模板名称最多 20 个字';
    if (modelForm.type === 'hourly' && !modelForm.rate.trim()) return '请输入课时费';
    return '';
  }, [modelForm]);

  const handleSaveModel = useCallback(async () => {
    if (savingModel) return;
    if (modelSubmitBlockedReason) {
      Taro.showToast({ title: modelSubmitBlockedReason, icon: 'none' });
      return;
    }
    const data = {
      name: modelForm.name.trim(),
      type: modelForm.type,
      base: Number(modelForm.base) || 0,
      rate: Number(modelForm.rate) || 0,
      attend: Number(modelForm.attend) || 0,
      perf: Number(modelForm.perf) || 0,
      isDefault: false,
    };

    setSavingModel(true);
    try {
      if (editingModel) {
        const success = await updateSalaryModel(editingModel.id, data);
        if (!success) {
          Taro.showToast({
            title: useCampusStore.getState().error || '保存模板失败',
            icon: 'none',
          });
          return;
        }
      } else {
        const result = await createSalaryModel(data);
        if (!result) {
          Taro.showToast({
            title: useCampusStore.getState().error || '创建模板失败',
            icon: 'none',
          });
          return;
        }
      }
      setShowModelSheet(false);
      Taro.showToast({ title: '保存成功', icon: 'success' });
    } finally {
      setSavingModel(false);
    }
  }, [
    modelForm,
    editingModel,
    createSalaryModel,
    updateSalaryModel,
    savingModel,
    modelSubmitBlockedReason,
  ]);

  const handleDeleteModel = useCallback(
    async (id: string) => {
      if (deletingModelId) return;
      setDeletingModelId(id);
      try {
        const success = await deleteSalaryModel(id);
        if (success) {
          Taro.showToast({ title: '删除成功', icon: 'success' });
        } else {
          Taro.showToast({
            title: useCampusStore.getState().error || '默认模板不可删除',
            icon: 'none',
          });
        }
      } finally {
        setDeletingModelId('');
      }
    },
    [deleteSalaryModel, deletingModelId],
  );

  const updateModelForm = useCallback((field: string, value: string) => {
    setModelForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  /** 获取薪资模板描述 */
  const getModelDesc = useCallback((model: SalaryModel) => {
    const parts: string[] = [];
    if (model.base > 0) parts.push('底薪');
    parts.push('课时费');
    if (model.attend > 0) parts.push('全勤奖');
    if (model.perf > 0) parts.push('绩效奖金');
    return parts.join(' + ');
  }, []);

  if (loading && !salaryModels.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载发薪设置中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError && !salaryModels.length) {
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
      {loadError ? (
        <View className="px-4 pt-4">
          <View className="p-[20rpx] rounded-[24rpx] bg-destructive/10">
            <Text className="text-[24rpx] text-destructive">{loadError}</Text>
          </View>
        </View>
      ) : null}
      {/* ============================================ */}
      {/* 1. 发薪规则 */}
      {/* ============================================ */}
      <View className="px-4">
        <Text className="text-[24rpx] font-semibold text-muted-foreground/60 uppercase tracking-wider ml-[8rpx] mb-[12rpx]">
          发薪规则
        </Text>
        <View className="bg-white rounded-[28rpx] shadow-soft overflow-hidden">
          {/* 发薪日 */}
          <View className="flex flex-row items-center justify-between px-[28rpx] py-[24rpx] border-b-d5e8e0">
            <Text className="text-[28rpx] text-foreground">发薪日</Text>
            <View className="flex flex-row items-center gap-[12rpx]">
              <Text className="text-[26rpx] text-muted-foreground">
                每月 <Text className="font-bold text-amber">{payDaySettings.fixedDay || 15}号</Text>
              </Text>
              <View
                className="text-[24rpx] text-primary font-medium px-[16rpx] py-[8rpx] bg-primary/10 rounded-[12rpx]"
                onClick={() => {
                  setPickerDay(payDaySettings.fixedDay || 15);
                  setShowPayDaySheet(true);
                }}
              >
                <Text className="text-[24rpx] text-primary font-medium">修改</Text>
              </View>
            </View>
          </View>

          {/* 课时报表推送 */}
          <View className="flex flex-row items-center justify-between px-[28rpx] py-[24rpx] border-b-d5e8e0">
            <Text className="text-[28rpx] text-foreground">课时报表推送</Text>
            <View className="flex flex-row items-center gap-[12rpx]">
              <Text className="text-[26rpx] text-muted-foreground">能力预留，暂未开放配置</Text>
              <View className="text-[24rpx] text-muted-foreground font-medium px-[16rpx] py-[8rpx] bg-muted rounded-[12rpx]">
                <Text className="text-[24rpx] text-muted-foreground font-medium">即将开放</Text>
              </View>
            </View>
          </View>

          {/* 自动确认 — 只读，避免假保存 */}
          <View className="flex flex-row items-center justify-between px-[28rpx] py-[24rpx]">
            <View className="flex-1 mr-[20rpx]">
              <Text className="text-[28rpx] text-foreground">自动确认</Text>
              <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] block">即将开放</Text>
            </View>
            <View
              className={cn('w-[88rpx] h-[52rpx] rounded-full relative transition-all', 'bg-muted')}
            >
              <View
                className={cn(
                  'absolute top-[6rpx] w-[40rpx] h-[40rpx] bg-white rounded-full shadow-card transition-all',
                  'left-[6rpx]',
                )}
              />
            </View>
          </View>
        </View>
      </View>

      {/* ============================================ */}
      {/* 2. 薪资模板 */}
      {/* ============================================ */}
      <View className="px-4 mt-[40rpx]">
        <Text className="text-[24rpx] font-semibold text-muted-foreground/60 uppercase tracking-wider ml-[8rpx] mb-[12rpx]">
          薪资模板
        </Text>
        <View className="bg-white rounded-[28rpx] shadow-soft p-[28rpx]">
          {/* 标题行 */}
          <View className="flex flex-row items-center justify-between mb-[20rpx]">
            <Text className="text-[28rpx] font-semibold text-foreground">工资模型</Text>
            <View
              className="flex flex-row items-center bg-primary/10 px-[20rpx] py-[10rpx] rounded-full"
              onClick={handleOpenAddModel}
            >
              <Icon name="mdi-plus" size="xs" color="primary" />
              <Text className="text-[24rpx] text-primary font-medium ml-[4rpx]">新建模板</Text>
            </View>
          </View>

          {/* 模板卡片列表 */}
          {salaryModels.length === 0 ? (
            <Empty
              icon="mdi-cash-multiple"
              description="暂无薪资模板，点击右上角新建模板"
              actionText="新建模板"
              onAction={handleOpenAddModel}
            />
          ) : null}
          {salaryModels.map((model) => (
            <View
              key={model.id}
              className={cn(
                'bg-white rounded-[28rpx] shadow-soft p-[28rpx] px-[32rpx] mb-[20rpx] last:mb-0',
                deletingModelId === model.id ? 'opacity-60' : 'press-bg',
              )}
              onClick={deletingModelId ? undefined : () => handleOpenEditModel(model.id)}
            >
              <View className="flex flex-row items-center justify-between">
                <View className="flex flex-row items-center gap-[12rpx]">
                  <Text className="text-[28rpx] font-semibold text-foreground">{model.name}</Text>
                  {/* 铭牌 — 对齐设计稿 sm-tag */}
                  {model.isDefault && (
                    <View className="bg-amber-10 px-[16rpx] py-[4rpx] rounded-[12rpx] ml-[8rpx]">
                      <Text className="text-[20rpx] text-amber font-semibold">默认</Text>
                    </View>
                  )}
                  {!model.isDefault && model.type === 'hourly' && (
                    <View className="bg-info-bg px-[16rpx] py-[4rpx] rounded-[12rpx] ml-[8rpx]">
                      <Text className="text-[20rpx] text-info font-semibold">助教</Text>
                    </View>
                  )}
                  {!model.isDefault && model.type === 'standard' && (
                    <View className="bg-primary-bg px-[16rpx] py-[4rpx] rounded-[12rpx] ml-[8rpx]">
                      <Text className="text-[20rpx] text-primary font-semibold">标准</Text>
                    </View>
                  )}
                </View>
                {!model.isDefault && (
                  <View
                    onClick={(e) => {
                      e.stopPropagation();
                      if (deletingModelId) return;
                      void handleDeleteModel(model.id);
                    }}
                  >
                    <Icon name="mdi-delete-outline" size="sm" color="muted" />
                  </View>
                )}
              </View>
              <Text className="text-[24rpx] text-muted-foreground mt-[8rpx]">
                {getModelDesc(model)}
              </Text>
              <Text className="text-[22rpx] text-muted-foreground/60 mt-[6rpx]">
                {model.teacherCount}位教师使用
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ============================================ */}
      {/* 3. 本月发薪状态 */}
      {/* ============================================ */}
      <View className="px-4 mt-[40rpx]">
        <Text className="text-[24rpx] font-semibold text-muted-foreground/60 uppercase tracking-wider ml-[8rpx] mb-[12rpx]">
          本月发薪状态
        </Text>
        <View className="bg-white rounded-[28rpx] shadow-soft p-[32rpx] border-t-[6rpx] border-amber">
          {/* 头部 */}
          <View className="flex flex-row items-center gap-[16rpx] mb-[20rpx]">
            <View className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-amber-10 flex items-center justify-center text-[32rpx]">
              💰
            </View>
            <View className="flex-1">
              <Text className="text-[28rpx] font-semibold text-foreground">发薪配置概览</Text>
              <Text className="text-[24rpx] text-muted-foreground">
                <Text className="font-bold text-foreground">{salaryModels.length}</Text>{' '}
                个模板已配置
              </Text>
            </View>
          </View>

          {/* 倒计时 — 对齐设计稿 ss-countdown */}
          <View className="bg-amber-10 rounded-[16rpx] px-[24rpx] py-[16rpx] mb-[20rpx]">
            <Text className="text-[26rpx] text-amber font-medium">
              距下次发薪日还有 <Text className="font-bold">{daysUntilPayDay()}</Text> 天
            </Text>
          </View>

          {/* 统计 — 对齐设计稿 ss-stats：数值和标签分行 */}
          <View className="flex flex-row gap-[16rpx]">
            <View className="flex-1 bg-background rounded-[16rpx] py-[16rpx] flex flex-col items-center">
              <Text className="text-[32rpx] font-extrabold text-amber">¥{totalBaseConfig}</Text>
              <Text className="text-[20rpx] text-muted-foreground mt-[4rpx]">已配置底薪</Text>
            </View>
            <View className="flex-1 bg-background rounded-[16rpx] py-[16rpx] flex flex-col items-center">
              <Text className="text-[32rpx] font-extrabold text-foreground">
                {totalTeachersUsingModels}
              </Text>
              <Text className="text-[20rpx] text-muted-foreground mt-[4rpx]">关联教师</Text>
            </View>
            <View className="flex-1 bg-background rounded-[16rpx] py-[16rpx] flex flex-col items-center">
              <Text className="text-[32rpx] font-extrabold text-destructive">
                {defaultModelCount}
              </Text>
              <Text className="text-[20rpx] text-muted-foreground mt-[4rpx]">默认模板</Text>
            </View>
          </View>

          {/* 查看运营数据（即将开放） */}
          <View className="flex flex-row items-center justify-center mt-[24rpx] py-[16rpx]">
            <Text className="text-[26rpx] text-muted-foreground font-medium">
              运营数据 · 即将开放
            </Text>
          </View>
        </View>
      </View>

      {/* ============================================ */}
      {/* 发薪日修改弹窗 */}
      {/* ============================================ */}
      <BottomSheet
        visible={showPayDaySheet}
        title="修改发薪日"
        onClose={() => {
          if (savingPayDay) return;
          setShowPayDaySheet(false);
        }}
      >
        <View className="px-4 py-4">
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-3">每月发薪日</Text>
            <View className="flex flex-row items-center gap-[24rpx] bg-primary/8 rounded-[24rpx] p-[28rpx]">
              <View
                className="w-[72rpx] h-[72rpx] rounded-full border-[3rpx] border-border bg-white flex items-center justify-center"
                onClick={savingPayDay ? undefined : () => setPickerDay(Math.max(1, pickerDay - 1))}
              >
                <Text className="text-[32rpx] text-primary font-bold">−</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-[56rpx] font-bold text-foreground">{pickerDay}</Text>
                <Text className="text-[28rpx] text-muted-foreground">日</Text>
              </View>
              <View
                className="w-[72rpx] h-[72rpx] rounded-full border-[3rpx] border-border bg-white flex items-center justify-center"
                onClick={savingPayDay ? undefined : () => setPickerDay(Math.min(28, pickerDay + 1))}
              >
                <Text className="text-[32rpx] text-primary font-bold">＋</Text>
              </View>
            </View>
          </View>

          <View
            className={cn(
              'rounded-2xl py-4 flex items-center justify-center mt-4',
              savingPayDay ? 'bg-muted' : 'bg-primary',
            )}
            onClick={
              savingPayDay
                ? undefined
                : async () => {
                    setSavingPayDay(true);
                    try {
                      setFixedDay(pickerDay);
                      await updatePayDaySettings({ fixedDay: pickerDay });
                      if (useCampusStore.getState().error) {
                        Taro.showToast({
                          title: useCampusStore.getState().error || '保存失败',
                          icon: 'none',
                        });
                        return;
                      }
                      setShowPayDaySheet(false);
                      Taro.showToast({ title: '保存成功', icon: 'success' });
                    } finally {
                      setSavingPayDay(false);
                    }
                  }
            }
          >
            <Text
              className={cn(
                'text-base font-semibold',
                savingPayDay ? 'text-muted-foreground' : 'text-white',
              )}
            >
              {savingPayDay ? '保存中...' : '保存'}
            </Text>
          </View>
        </View>
      </BottomSheet>

      {/* ============================================ */}
      {/* 薪资模板编辑弹窗 */}
      {/* ============================================ */}
      <BottomSheet
        visible={showModelSheet}
        title={editingModel ? '编辑薪资模板' : '新建薪资模板'}
        onClose={() => {
          if (savingModel) return;
          setShowModelSheet(false);
        }}
      >
        <View className="px-4 py-4">
          <FormInput
            label="模板名称"
            required
            placeholder="如：资深主讲、助教"
            value={modelForm.name}
            onInput={(e) => updateModelForm('name', e.detail.value)}
          />

          {/* 模板类型 */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-2">模板类型</Text>
            <View className="flex flex-row gap-[12rpx]">
              {(['standard', 'hourly'] as const).map((t) => (
                <View
                  key={t}
                  className={cn(
                    'flex-1 py-[20rpx] rounded-[16rpx] border-[3rpx] flex items-center justify-center',
                    modelForm.type === t ? 'border-primary bg-primary/5' : 'border-d5e8e0',
                  )}
                  onClick={() => updateModelForm('type', t)}
                >
                  <Text
                    className={cn(
                      'text-[24rpx] font-medium text-center',
                      modelForm.type === t ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {t === 'standard' ? '标准（底薪+课时+奖金）' : '纯课时'}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {modelForm.type === 'standard' && (
            <>
              <FormInput
                label="底薪（元/月）"
                placeholder="0"
                type="digit"
                prefix="¥"
                value={modelForm.base}
                onInput={(e) => updateModelForm('base', e.detail.value)}
              />
              <FormInput
                label="默认课时费（元/课时）"
                placeholder="0"
                type="digit"
                prefix="¥"
                value={modelForm.rate}
                onInput={(e) => updateModelForm('rate', e.detail.value)}
              />
              <FormInput
                label="全勤奖（元/月）"
                placeholder="0"
                type="digit"
                prefix="¥"
                value={modelForm.attend}
                onInput={(e) => updateModelForm('attend', e.detail.value)}
              />
              <FormInput
                label="绩效奖金（元/月）"
                placeholder="0"
                type="digit"
                prefix="¥"
                value={modelForm.perf}
                onInput={(e) => updateModelForm('perf', e.detail.value)}
              />
            </>
          )}

          {modelForm.type === 'hourly' && (
            <FormInput
              label="课时费（元/课时）"
              placeholder="0"
              type="digit"
              prefix="¥"
              value={modelForm.rate}
              onInput={(e) => updateModelForm('rate', e.detail.value)}
            />
          )}

          {modelSubmitBlockedReason ? (
            <View className="mb-3">
              <Text className="text-sm text-muted-foreground">{modelSubmitBlockedReason}</Text>
            </View>
          ) : null}
          <View
            className={cn(
              'rounded-2xl py-4 flex items-center justify-center mt-4',
              !modelSubmitBlockedReason && !savingModel ? 'bg-primary' : 'bg-muted',
            )}
            onClick={
              !modelSubmitBlockedReason && !savingModel ? () => void handleSaveModel() : undefined
            }
          >
            <Text
              className={cn(
                'text-base font-semibold',
                !modelSubmitBlockedReason && !savingModel ? 'text-white' : 'text-muted-foreground',
              )}
            >
              {savingModel ? '保存中...' : editingModel ? '保存修改' : '确认添加'}
            </Text>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

export default PayDay;
