/**
 * 续费提醒 — 列表 + 统一阈值设置 + 不再提醒名单
 * 系统设置「预警阈值」已合并到本页设置。
 */
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import StudentListCard from '@/components/student/StudentListCard';
import { campusService } from '@/services/campus';
import {
  opsAlertService,
  type RenewalReminderItem,
} from '@/services/ops-alerts';
import {
  getAlertThresholdConfig,
  setAlertThresholdConfig,
  syncAlertThresholdFromCampus,
  type AlertThresholdConfig,
} from '@/utils/alert-config';
import { isPrincipalOrAbove, isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

type ListMode = 'active' | 'muted';

const RenewalReminderPage: React.FC = () => {
  useCardNavigationBar();
  const { profile, currentRole } = useAuth();
  const role = profile?.currentContext?.role ?? currentRole;
  const campusId = profile?.currentContext?.campusId || '';
  const canEditThreshold = isPrincipalOrAbove(role);

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<RenewalReminderItem[]>([]);
  const [mode, setMode] = useState<ListMode>('active');
  const [showSettings, setShowSettings] = useState(false);
  const [thresholds, setThresholds] = useState<AlertThresholdConfig>(getAlertThresholdConfig());
  const [draft, setDraft] = useState<AlertThresholdConfig>(getAlertThresholdConfig());
  const [saving, setSaving] = useState(false);
  const [tabCounts, setTabCounts] = useState({ active: 0, muted: 0 });

  const syncCampusThresholds = useCallback(async () => {
    if (!campusId) return;
    try {
      const campus = await campusService.getById(campusId);
      if (!campus) return;
      const next = syncAlertThresholdFromCampus({
        hoursAlertThreshold: campus.hoursAlertThreshold,
        daysAlertThreshold: campus.daysAlertThreshold,
        amountAlertThreshold: campus.amountAlertThreshold,
      });
      setThresholds(next);
      setDraft(next);
    } catch (err) {
      logError('renewal sync threshold', err);
    }
  }, [campusId]);

  const load = useCallback(async () => {
    if (!isStaffRole(role)) {
      setList([]);
      setTabCounts({ active: 0, muted: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await syncCampusThresholds();
      const all = await opsAlertService.listRenewalReminders({
        campusId: campusId || undefined,
        includeMuted: true,
      });
      const activeItems = all.filter((i) => !i.muted);
      const mutedItems = all.filter((i) => i.muted);
      setTabCounts({ active: activeItems.length, muted: mutedItems.length });
      setList(mode === 'muted' ? mutedItems : activeItems);
    } catch (err) {
      logError('renewal-reminder load', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
      setList([]);
      setTabCounts({ active: 0, muted: 0 });
    } finally {
      setLoading(false);
    }
  }, [campusId, mode, role, syncCampusThresholds]);

  useEffect(() => {
    void load();
  }, [load]);

  useDidShow(() => {
    void load();
  });

  usePullDownRefresh(() => {
    void load().finally(() => Taro.stopPullDownRefresh());
  });

  const openStudent = useCallback((studentId: string) => {
    void Taro.navigateTo({
      url: `/package-student/pages/student-detail/index?id=${encodeURIComponent(studentId)}`,
    });
  }, []);

  const handleMute = useCallback(
    async (item: RenewalReminderItem) => {
      const confirm = await Taro.showModal({
        title: '不再提醒',
        content: `将「${item.studentName}」移入不再提醒名单？`,
      });
      if (!confirm.confirm) return;
      try {
        await opsAlertService.muteRenewal(item.studentId, campusId || undefined);
        Taro.showToast({ title: '已加入名单', icon: 'success' });
        void load();
      } catch (err) {
        logError('renewal mute', err);
        Taro.showToast({ title: '操作失败', icon: 'none' });
      }
    },
    [campusId, load],
  );

  const handleUnmute = useCallback(
    async (item: RenewalReminderItem) => {
      const confirm = await Taro.showModal({
        title: '恢复提醒',
        content: `将「${item.studentName}」移回待提醒列表？`,
      });
      if (!confirm.confirm) return;
      try {
        await opsAlertService.unmuteRenewal(item.studentId, campusId || undefined);
        Taro.showToast({ title: '已恢复提醒', icon: 'success' });
        void load();
      } catch (err) {
        logError('renewal unmute', err);
        Taro.showToast({ title: '操作失败', icon: 'none' });
      }
    },
    [campusId, load],
  );

  const openSettings = useCallback(() => {
    setDraft(thresholds);
    setShowSettings(true);
  }, [thresholds]);

  const handleSaveSettings = useCallback(async () => {
    const hours = Number(draft.hours);
    const days = Number(draft.days);
    const amount = Number(draft.amount);
    if (![hours, days, amount].every((n) => Number.isFinite(n) && n >= 0 && Number.isInteger(n))) {
      Taro.showToast({ title: '请输入不小于 0 的整数', icon: 'none' });
      return;
    }
    if (!campusId) {
      Taro.showToast({ title: '请先选择校区', icon: 'none' });
      return;
    }
    if (!canEditThreshold) {
      Taro.showToast({ title: '仅校长/管理员可改阈值', icon: 'none' });
      return;
    }
    setSaving(true);
    try {
      const updated = await campusService.update(campusId, {
        hoursAlertThreshold: hours,
        daysAlertThreshold: days,
        amountAlertThreshold: amount,
      });
      const next = setAlertThresholdConfig({
        hours: updated?.hoursAlertThreshold ?? hours,
        days: updated?.daysAlertThreshold ?? days,
        amount: updated?.amountAlertThreshold ?? amount,
      });
      setThresholds(next);
      setShowSettings(false);
      Taro.showToast({ title: '已保存', icon: 'success' });
      void load();
    } catch (err) {
      logError('renewal save threshold', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [canEditThreshold, campusId, draft, load]);

  const thresholdSummary = useMemo(
    () => `课时≤${thresholds.hours} · 天数≤${thresholds.days} · 金额≤${thresholds.amount}元`,
    [thresholds],
  );

  if (!isStaffRole(role)) {
    return (
      <PageContainer className="bg-muted">
        <View className="py-[160rpx]">
          <Empty icon="mdi-lock-outline" description="仅机构人员可查看续费提醒" />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-muted">
      <View className="border-b border-border bg-card px-[24rpx] pt-[16rpx] pb-[16rpx]">
        <View className="mb-[16rpx] flex flex-row items-center justify-between gap-[16rpx]">
          <View className="min-w-0 flex-1">
            <Text className="block text-[22rpx] text-muted-foreground">统一提醒阈值</Text>
            <Text className="mt-[4rpx] block truncate text-[24rpx] text-foreground">
              {thresholdSummary}
            </Text>
          </View>
          <View
            className="shrink-0 rounded-full bg-primary/10 px-[24rpx] py-[12rpx] active:opacity-80"
            onClick={openSettings}
          >
            <Text className="text-[24rpx] font-medium text-primary">提醒设置</Text>
          </View>
        </View>

        <View className="flex flex-row gap-[12rpx]">
          {(
            [
              { key: 'active' as const, label: '待提醒' },
              { key: 'muted' as const, label: '不再提醒' },
            ] as const
          ).map((t) => {
            const active = mode === t.key;
            const count = tabCounts[t.key];
            return (
              <View
                key={t.key}
                className={cn(
                  'rounded-full px-[24rpx] py-[10rpx]',
                  active ? 'bg-primary' : 'bg-muted',
                )}
                onClick={() => setMode(t.key)}
              >
                <Text
                  className={cn(
                    'text-[24rpx]',
                    active ? 'font-semibold text-white' : 'text-foreground-secondary',
                  )}
                >
                  {t.label}
                  {count > 0 ? ` ${count}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View className="flex items-center justify-center py-[200rpx]">
          <Loading text="加载中..." />
        </View>
      ) : list.length === 0 ? (
        <View className="py-[160rpx]">
          <Empty
            icon="mdi-inbox"
            description={mode === 'muted' ? '暂无不再提醒学员' : '暂无续费提醒'}
          />
        </View>
      ) : (
        <ScrollView scrollY className="h-screen" enhanced showScrollbar={false}>
          <View className="flex flex-col gap-[16rpx] px-[24rpx] py-[16rpx] pb-safe-bar">
            {list.map((item) => (
              <StudentListCard
                key={item.id}
                name={item.studentName}
                nickname={item.nickname}
                avatarUrl={item.avatarUrl}
                onClick={() => openStudent(item.studentId)}
                right={
                  mode === 'active' ? (
                    <View
                      className="active:opacity-60"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleMute(item);
                      }}
                    >
                      <Text className="text-[24rpx] text-muted-foreground">不再提醒</Text>
                    </View>
                  ) : (
                    <View
                      className="active:opacity-60"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleUnmute(item);
                      }}
                    >
                      <Text className="text-[24rpx] text-primary">恢复提醒</Text>
                    </View>
                  )
                }
                subtitle={
                  <View>
                    <Text className="block text-[24rpx] text-muted-foreground">
                      剩余 {item.remainingHours} 课时
                      {item.remainingDays != null ? ` · ${item.remainingDays} 天` : ''}
                      {` · ¥${item.remainingAmount}`}
                    </Text>
                    <Text className="mt-[6rpx] block text-[22rpx] text-amber">
                      {item.reasons.join(' / ')}
                    </Text>
                  </View>
                }
              />
            ))}
          </View>
        </ScrollView>
      )}

      <BottomSheet
        visible={showSettings}
        title="提醒设置"
        height="auto"
        maxHeightLimit="80vh"
        keyboardAware
        scrollable={false}
        onClose={() => setShowSettings(false)}
      >
        <View className="px-[32rpx] pb-[24rpx]">
          <Text className="mb-[20rpx] block text-[24rpx] text-muted-foreground">
            满足任一条件即进入续费提醒（与系统预警阈值合并）
          </Text>
          {(
            [
              { key: 'hours' as const, label: '剩余课时 ≤', unit: '课时' },
              { key: 'days' as const, label: '剩余天数 ≤', unit: '天' },
              { key: 'amount' as const, label: '剩余金额 ≤', unit: '元' },
            ] as const
          ).map((row) => (
            <View
              key={row.key}
              className="mb-[16rpx] flex flex-row items-center justify-between rounded-[16rpx] bg-muted px-[24rpx] py-[20rpx]"
            >
              <Text className="text-[28rpx] text-foreground">{row.label}</Text>
              <View className="flex flex-row items-center gap-[12rpx]">
                <Input
                  className="w-[140rpx] text-right text-[28rpx] text-foreground"
                  type="number"
                  value={String(draft[row.key])}
                  disabled={!canEditThreshold}
                  onInput={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [row.key]: Number(e.detail.value || 0),
                    }))
                  }
                />
                <Text className="text-[24rpx] text-muted-foreground">{row.unit}</Text>
              </View>
            </View>
          ))}
          {!canEditThreshold ? (
            <Text className="mb-[16rpx] block text-[22rpx] text-muted-foreground">
              仅校长/管理员可修改阈值
            </Text>
          ) : null}
          <View
            className={cn(
              'mt-[8rpx] rounded-full py-[22rpx] text-center',
              canEditThreshold && !saving ? 'bg-primary active:opacity-90' : 'bg-muted',
            )}
            onClick={() => {
              if (!saving && canEditThreshold) void handleSaveSettings();
            }}
          >
            <Text
              className={cn(
                'text-[28rpx] font-semibold',
                canEditThreshold ? 'text-white' : 'text-muted-foreground',
              )}
            >
              {saving ? '保存中...' : '保存'}
            </Text>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

export default withRouteGuard(RenewalReminderPage);
