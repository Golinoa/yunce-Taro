/**
 * 节假日设置页 — 对齐「停课放假 / 节假日设置」设计稿
 * 列表：圆圈 + 名称/日期 + 删除；顶栏：全部删除 / 生成法定节假日；右下 FAB 新增
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { useCampusStore } from '@/stores/campus';
import type { Holiday } from '@/types/campus';

type DateField = 'startDate' | 'endDate' | null;

const Holidays: React.FC = () => {
  const {
    holidays,
    fetchHolidays,
    addHoliday,
    deleteHoliday,
    clearHolidays,
    generateStatutoryHolidays,
  } = useCampusStore();

  const [showFormSheet, setShowFormSheet] = useState(false);
  const [dateField, setDateField] = useState<DateField>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    await fetchHolidays();
    const nextError = useCampusStore.getState().error;
    if (nextError) setLoadError(nextError);
    setLoading(false);
  }, [fetchHolidays]);

  Taro.useDidShow(() => {
    void reload();
  });

  const sortedHolidays = useMemo(
    () =>
      [...holidays].sort((a, b) =>
        a.startDate === b.startDate
          ? a.name.localeCompare(b.name, 'zh-CN')
          : a.startDate.localeCompare(b.startDate),
      ),
    [holidays],
  );

  const formatRange = useCallback((h: Holiday) => {
    if (h.startDate === h.endDate) return `${h.startDate}至${h.endDate}`;
    return `${h.startDate}至${h.endDate}`;
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleOpenAdd = useCallback(() => {
    setForm({ name: '', startDate: '', endDate: '' });
    setShowFormSheet(true);
  }, []);

  const submitBlockedReason = useMemo(() => {
    if (!form.name.trim()) return '请输入假期名称';
    if (!form.startDate || !form.endDate) return '请选择日期范围';
    if (!dayjs(form.startDate).isValid() || !dayjs(form.endDate).isValid()) {
      return '请输入正确的日期';
    }
    if (form.startDate > form.endDate) return '结束日期不能早于开始日期';
    return '';
  }, [form]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }
    setSaving(true);
    try {
      // 按日拆条，与设计稿「元旦/春节逐日一条」一致
      let cursor = dayjs(form.startDate);
      const end = dayjs(form.endDate);
      const name = form.name.trim();
      while (!cursor.isAfter(end, 'day')) {
        const date = cursor.format('YYYY-MM-DD');
        const result = await addHoliday({
          name,
          icon: '📅',
          startDate: date,
          endDate: date,
          status: 'rest',
        });
        if (!result) {
          Taro.showToast({
            title: useCampusStore.getState().error || '添加失败',
            icon: 'none',
          });
          return;
        }
        cursor = cursor.add(1, 'day');
      }
      setShowFormSheet(false);
      Taro.showToast({ title: '添加成功', icon: 'success' });
    } finally {
      setSaving(false);
    }
  }, [addHoliday, form, saving, submitBlockedReason]);

  const handleDeleteOne = useCallback(
    async (id: string) => {
      const { confirm } = await Taro.showModal({
        title: '删除假期',
        content: '确认删除该条停课放假记录？',
        confirmText: '删除',
        confirmColor: '#F0705F',
      });
      if (!confirm) return;
      const ok = await deleteHoliday(id);
      if (!ok) {
        Taro.showToast({ title: useCampusStore.getState().error || '删除失败', icon: 'none' });
        return;
      }
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      Taro.showToast({ title: '已删除', icon: 'success' });
    },
    [deleteHoliday],
  );

  const handleDeleteAll = useCallback(async () => {
    if (busy) return;
    if (holidays.length === 0) {
      Taro.showToast({ title: '暂无假期', icon: 'none' });
      return;
    }
    const targets = selectedIds.length > 0 ? selectedIds : holidays.map((h) => h.id);
    const { confirm } = await Taro.showModal({
      title: selectedIds.length > 0 ? '删除所选' : '全部删除',
      content:
        selectedIds.length > 0
          ? `确认删除已选 ${targets.length} 条？`
          : `确认删除全部 ${targets.length} 条停课放假？`,
      confirmText: '删除',
      confirmColor: '#F0705F',
    });
    if (!confirm) return;
    setBusy(true);
    try {
      if (selectedIds.length === 0) {
        const ok = await clearHolidays();
        if (!ok) {
          Taro.showToast({ title: useCampusStore.getState().error || '删除失败', icon: 'none' });
          return;
        }
      } else {
        for (const id of targets) {
          await deleteHoliday(id);
        }
      }
      setSelectedIds([]);
      Taro.showToast({ title: '已删除', icon: 'success' });
    } finally {
      setBusy(false);
    }
  }, [busy, clearHolidays, deleteHoliday, holidays, selectedIds]);

  const handleGenerate = useCallback(async () => {
    if (busy) return;
    const { confirm } = await Taro.showModal({
      title: '生成法定节假日',
      content: '将按当前年份生成法定节假日（逐日一条）。已有同名同日记录会跳过。',
      confirmText: '生成',
    });
    if (!confirm) return;
    setBusy(true);
    try {
      const count = await generateStatutoryHolidays();
      if (count < 0) {
        Taro.showToast({ title: useCampusStore.getState().error || '生成失败', icon: 'none' });
        return;
      }
      Taro.showToast({
        title: count > 0 ? `已生成 ${count} 条` : '没有新增（可能已存在）',
        icon: 'none',
      });
    } finally {
      setBusy(false);
    }
  }, [busy, generateStatutoryHolidays]);

  if (loading && !holidays.length) {
    return (
      <PageContainer safeBottom>
        <View className="flex min-h-screen items-center justify-center">
          <Loading text="加载假期中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError && !holidays.length) {
    return (
      <PageContainer safeBottom>
        <View className="flex min-h-screen items-center justify-center px-[32rpx]">
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
    <PageContainer safeBottom className="bg-muted/40">
      {/* 顶栏操作 — 对齐设计稿右上：全部删除 / 生成法定节假日 */}
      <View className="flex items-center justify-end gap-[28rpx] bg-white px-[32rpx] py-[20rpx]">
        <Text
          className={cn('text-[28rpx] text-primary active:opacity-70', busy && 'opacity-50')}
          onClick={busy ? undefined : () => void handleDeleteAll()}
        >
          {selectedIds.length > 0 ? `删除所选(${selectedIds.length})` : '全部删除'}
        </Text>
        <Text
          className={cn('text-[28rpx] text-primary active:opacity-70', busy && 'opacity-50')}
          onClick={busy ? undefined : () => void handleGenerate()}
        >
          生成法定节假日
        </Text>
      </View>

      <View className="mt-[16rpx] bg-white">
        {sortedHolidays.map((holiday, index) => {
          const selected = selectedIds.includes(holiday.id);
          return (
            <View
              key={holiday.id}
              className={cn(
                'flex items-center gap-[20rpx] px-[32rpx] py-[28rpx]',
                index < sortedHolidays.length - 1 && 'border-b border-border/60',
              )}
            >
              <View
                className={cn(
                  'flex h-[40rpx] w-[40rpx] shrink-0 items-center justify-center rounded-full border-[3rpx]',
                  selected ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-white',
                )}
                onClick={() => toggleSelect(holiday.id)}
              >
                {selected ? <Icon name="mdi-check" size={22} color="#ffffff" /> : null}
              </View>

              <View className="min-w-0 flex-1" onClick={() => toggleSelect(holiday.id)}>
                <Text className="block text-[30rpx] font-medium text-foreground">
                  {holiday.name}
                </Text>
                <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                  {formatRange(holiday)}
                </Text>
              </View>

              <Text
                className="shrink-0 text-[28rpx] text-primary active:opacity-70"
                onClick={() => void handleDeleteOne(holiday.id)}
              >
                删除
              </Text>
            </View>
          );
        })}

        {sortedHolidays.length === 0 ? (
          <View className="py-[160rpx]">
            <Empty
              icon="mdi-calendar-blank-outline"
              description="暂无停课放假，点击右下角添加或使用顶栏生成法定节假日"
            />
          </View>
        ) : null}
      </View>

      {/* FAB */}
      <View
        className="fixed bottom-[80rpx] right-[40rpx] z-50 flex h-[100rpx] w-[100rpx] items-center justify-center rounded-full bg-primary shadow-float active:opacity-90"
        onClick={handleOpenAdd}
      >
        <Icon name="mdi-plus" size={48} color="#ffffff" />
      </View>

      <BottomSheet
        visible={showFormSheet}
        title="添加假期"
        onClose={() => {
          if (saving) return;
          setShowFormSheet(false);
        }}
      >
        <View className="px-[32rpx] pb-[40rpx] pt-[8rpx]">
          <FormInput
            label="假期名称"
            required
            placeholder="如：元旦、机构团建"
            value={form.name}
            onInput={(e) => setForm((prev) => ({ ...prev, name: e.detail.value }))}
          />

          <View className="mb-[24rpx]">
            <Text className="mb-[12rpx] block text-[26rpx] text-muted-foreground">开始日期</Text>
            <View
              className="flex items-center justify-between rounded-[16rpx] bg-muted/40 px-[24rpx] py-[24rpx]"
              onClick={() => setDateField('startDate')}
            >
              <Text
                className={cn(
                  'text-[28rpx]',
                  form.startDate ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {form.startDate || '请选择'}
              </Text>
              <Icon name="mdi-calendar" size={28} color="muted" />
            </View>
          </View>

          <View className="mb-[32rpx]">
            <Text className="mb-[12rpx] block text-[26rpx] text-muted-foreground">结束日期</Text>
            <View
              className="flex items-center justify-between rounded-[16rpx] bg-muted/40 px-[24rpx] py-[24rpx]"
              onClick={() => setDateField('endDate')}
            >
              <Text
                className={cn(
                  'text-[28rpx]',
                  form.endDate ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {form.endDate || '请选择'}
              </Text>
              <Icon name="mdi-calendar" size={28} color="muted" />
            </View>
          </View>

          {submitBlockedReason ? (
            <Text className="mb-[16rpx] block text-[24rpx] text-muted-foreground">
              {submitBlockedReason}
            </Text>
          ) : null}

          <View
            className={cn(
              'flex items-center justify-center rounded-[24rpx] py-[28rpx]',
              !submitBlockedReason && !saving ? 'bg-primary' : 'bg-muted',
            )}
            onClick={!submitBlockedReason && !saving ? () => void handleSave() : undefined}
          >
            <Text
              className={cn(
                'text-[30rpx] font-semibold',
                !submitBlockedReason && !saving
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {saving ? '添加中...' : '确认添加'}
            </Text>
          </View>
        </View>
      </BottomSheet>

      <DatePickerSheet
        visible={Boolean(dateField)}
        title={dateField === 'endDate' ? '选择结束日期' : '选择开始日期'}
        value={
          dateField === 'endDate'
            ? form.endDate || form.startDate || dayjs().format('YYYY-MM-DD')
            : form.startDate || dayjs().format('YYYY-MM-DD')
        }
        onClose={() => setDateField(null)}
        onConfirm={(date) => {
          if (!dateField) return;
          setForm((prev) => {
            const next = { ...prev, [dateField]: date };
            if (dateField === 'startDate' && (!prev.endDate || prev.endDate < date)) {
              next.endDate = date;
            }
            return next;
          });
          setDateField(null);
        }}
      />
    </PageContainer>
  );
};

export default Holidays;
