/**
 * 门店入驻申请中页 pages/store-entry/pending/index（R3）
 *
 * 中间页三态：
 * - pending  → 提交成功等待审核（双按钮：演示门店 / 客服催办）
 * - approved → 入驻成功（进入机构端）
 * - rejected → 驳回 + 重新提交
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import SupportQrDialog from '@/components/SupportQrDialog';
import { STORE_ENTRY_PENDING_COPY } from '@/constants/store-entry-copy';
import { SUPPORT_QR_EXPEDITE_COPY } from '@/constants/support-qr';
import { refreshSessionForTenant } from '@/services/auth';
import { readStoreEntryDraft, storeEntryService } from '@/services/store-entry';
import type { StoreEntryLatestResult } from '@/types/store-entry';
import { useAuth } from '@/utils/auth';
import { clearIdentitySelectionPending } from '@/utils/auth-onboarding';
import { consumePendingStoreReferralCode } from '@/utils/invite-store-referral-link';
import { usePrimaryNavigationBar } from '@/utils/navigation-bar';
import { navigateAfterLogin, withRouteGuard } from '@/utils/route-guard';
import {
  invalidateStoreEntryLatestCache,
  resolveStoreEntrySubmitError,
  writeStoreEntryLatestCache,
} from '@/utils/store-entry-onboarding';
import { isStoreEntryPending, normalizeStoreEntryStatus } from '@/utils/store-entry-status';

const StoreEntryPendingPage: React.FC = () => {
  usePrimaryNavigationBar();
  const { refreshProfile, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [latest, setLatest] = useState<StoreEntryLatestResult | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [entering, setEntering] = useState(false);
  const [enteringDemo, setEnteringDemo] = useState(false);
  const [expediteVisible, setExpediteVisible] = useState(false);

  const status = latest?.application?.status
    ? normalizeStoreEntryStatus(latest.application.status)
    : null;
  const rejectReason =
    latest?.application?.rejectReason || latest?.organization?.rejectReason || '';
  const storeName = latest?.organization?.name || '';

  const isOpened = status === 'approved';
  const isRejected = status === 'rejected';
  const isPending = status === 'pending';
  const hasApplication = Boolean(latest?.application?.id);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const result = await storeEntryService.queryLatestSafe();
      setLatest(result);
      writeStoreEntryLatestCache(result, profile?.id);
      if (result?.application?.status && isStoreEntryPending(result.application.status)) {
        clearIdentitySelectionPending();
      }
    } catch {
      setLatest(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  useEffect(() => {
    void Taro.setNavigationBarTitle({
      title: isOpened
        ? STORE_ENTRY_PENDING_COPY.titleApproved
        : isRejected
          ? STORE_ENTRY_PENDING_COPY.titleRejected
          : STORE_ENTRY_PENDING_COPY.navTitlePending,
    });
  }, [isOpened, isRejected]);

  const tip = useMemo(() => {
    if (isOpened) {
      return storeName
        ? `${STORE_ENTRY_PENDING_COPY.descApprovedPrefix}，默认主校区「${storeName}」已创建。您已是该机构管理员，可进入机构端开始管理。`
        : '门店入驻成功，您已是机构管理员，可进入机构端开始管理。';
    }
    if (isRejected) {
      return STORE_ENTRY_PENDING_COPY.descRejected;
    }
    return STORE_ENTRY_PENDING_COPY.descPending;
  }, [isOpened, isRejected, storeName]);

  const handleEnterDemo = useCallback(async () => {
    if (enteringDemo) return;
    setEnteringDemo(true);
    try {
      const refreshed = await refreshSessionForTenant();
      if (!refreshed.ok) {
        Taro.showToast({ title: refreshed.error?.message || '请重新登录', icon: 'none' });
        return;
      }
      await refreshProfile();
      clearIdentitySelectionPending();
      invalidateStoreEntryLatestCache(profile?.id);
      Taro.showToast({ title: STORE_ENTRY_PENDING_COPY.demoToast, icon: 'none', duration: 2800 });
      void Taro.switchTab({ url: '/pages/home/index' });
    } catch {
      Taro.showToast({ title: '进入演示门店失败，请重试', icon: 'none' });
    } finally {
      setEnteringDemo(false);
    }
  }, [enteringDemo, profile?.id, refreshProfile]);

  const handleEnterOrg = useCallback(async () => {
    if (entering) return;
    setEntering(true);
    try {
      const refreshed = await refreshSessionForTenant();
      if (!refreshed.ok) {
        Taro.showToast({ title: refreshed.error?.message || '请重新登录', icon: 'none' });
        return;
      }
      await refreshProfile();
      clearIdentitySelectionPending();
      invalidateStoreEntryLatestCache(profile?.id);
      navigateAfterLogin();
    } catch {
      Taro.showToast({ title: '进入失败，请重新登录后再试', icon: 'none' });
    } finally {
      setEntering(false);
    }
  }, [entering, profile?.id, refreshProfile]);

  const handleGoHome = useCallback(() => {
    invalidateStoreEntryLatestCache(profile?.id);
    clearIdentitySelectionPending();
    void Taro.switchTab({ url: '/pages/home/index' });
  }, [profile?.id]);

  const handleResubmit = useCallback(async () => {
    const draft = readStoreEntryDraft();
    if (!draft) {
      Taro.showToast({ title: '无可重新提交的资料，请重新申请', icon: 'none' });
      return;
    }
    setResubmitting(true);
    try {
      await storeEntryService.resubmit(draft);
      consumePendingStoreReferralCode();
      invalidateStoreEntryLatestCache();
      Taro.showToast({ title: '已重新提交', icon: 'success' });
      await loadLatest();
    } catch (err) {
      const action = resolveStoreEntrySubmitError(err);
      Taro.showToast({
        title: action.kind === 'toast' ? action.message : '重新提交失败，请重试',
        icon: 'none',
      });
    } finally {
      setResubmitting(false);
    }
  }, [loadLatest]);

  if (loading) {
    return (
      <PageContainer safeBottom className="px-[32rpx] py-[32rpx]">
        <View className="flex items-center justify-center py-[120rpx]">
          <Text className="text-[28rpx] text-muted-foreground">
            {STORE_ENTRY_PENDING_COPY.loading}
          </Text>
        </View>
      </PageContainer>
    );
  }

  if (loadFailed) {
    return (
      <PageContainer safeBottom className="px-[32rpx] py-[32rpx]">
        <View className="flex flex-col items-center justify-center py-[120rpx] gap-[24rpx]">
          <Text className="text-[28rpx] text-muted-foreground">
            {STORE_ENTRY_PENDING_COPY.loadFailed}
          </Text>
          <View
            className="h-[80rpx] px-[40rpx] rounded-full bg-primary flex items-center justify-center"
            onClick={() => void loadLatest()}
          >
            <Text className="text-[28rpx] text-white font-semibold">重试</Text>
          </View>
        </View>
      </PageContainer>
    );
  }

  // 无申请记录（如种子校长被错误踢进本页）：勿伪装成「等待审核」
  if (!hasApplication) {
    return (
      <PageContainer safeBottom className="px-[32rpx] py-[32rpx]">
        <View className="flex flex-col items-center justify-center py-[120rpx] gap-[24rpx]">
          <Text className="text-[30rpx] font-semibold text-foreground">暂无入驻申请</Text>
          <Text className="text-[26rpx] text-muted-foreground text-center leading-relaxed px-[24rpx]">
            当前账号没有待审核的门店入驻记录，可直接返回首页继续使用。
          </Text>
          <View
            className="h-[80rpx] px-[48rpx] rounded-full bg-primary flex items-center justify-center"
            onClick={handleGoHome}
          >
            <Text className="text-[28rpx] text-white font-semibold">返回首页</Text>
          </View>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom className="px-[32rpx] py-[32rpx]">
      <View className="rounded-[32rpx] bg-white px-[32rpx] py-[36rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)] mb-[24rpx]">
        <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary/10 flex items-center justify-center mb-[24rpx]">
          <Icon
            name={
              isOpened
                ? 'mdi-check-circle-outline'
                : isRejected
                  ? 'mdi-alert-circle-outline'
                  : 'mdi-clock-outline'
            }
            size={52}
            className={isRejected ? 'text-destructive' : 'text-primary'}
          />
        </View>
        <Text className="text-[36rpx] font-semibold text-foreground block mb-[10rpx]">
          {isOpened
            ? STORE_ENTRY_PENDING_COPY.titleApproved
            : isRejected
              ? STORE_ENTRY_PENDING_COPY.titleRejected
              : STORE_ENTRY_PENDING_COPY.titlePending}
        </Text>
        <Text className="text-[28rpx] leading-[1.7] text-muted-foreground block">{tip}</Text>

        {storeName && isPending ? (
          <View className="mt-[20rpx] rounded-[16rpx] bg-muted/40 px-[20rpx] py-[16rpx]">
            <Text className="text-[24rpx] text-muted-foreground">申请门店：{storeName}</Text>
          </View>
        ) : null}

        {isRejected && rejectReason ? (
          <View className="mt-[24rpx] rounded-[20rpx] bg-destructive/10 px-[24rpx] py-[20rpx]">
            <Text className="text-[26rpx] leading-[1.6] text-destructive">
              拒绝原因：{rejectReason}
            </Text>
          </View>
        ) : null}

        {isPending ? (
          <View className="mt-[32rpx] flex flex-col gap-[20rpx]">
            <View
              className={cn(
                'h-[92rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90',
                enteringDemo && 'opacity-70',
              )}
              onClick={enteringDemo ? undefined : handleEnterDemo}
            >
              <Text className="text-[30rpx] font-semibold text-white">
                {enteringDemo ? '进入中...' : STORE_ENTRY_PENDING_COPY.btnDemo}
              </Text>
            </View>
            <Text className="text-[22rpx] text-muted-foreground text-center -mt-[8rpx]">
              {STORE_ENTRY_PENDING_COPY.btnDemoHint}
            </Text>
            <View
              className="h-[92rpx] rounded-full border-[2rpx] border-primary flex items-center justify-center active:opacity-90"
              onClick={() => setExpediteVisible(true)}
            >
              <Text className="text-[30rpx] font-semibold text-primary">
                {STORE_ENTRY_PENDING_COPY.btnExpedite}
              </Text>
            </View>
            <Text className="text-[22rpx] text-muted-foreground text-center -mt-[8rpx]">
              {STORE_ENTRY_PENDING_COPY.btnExpediteHint}
            </Text>
          </View>
        ) : null}

        {isOpened && (
          <View
            className="mt-[32rpx] h-[92rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90"
            onClick={handleEnterOrg}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {entering ? '进入中...' : STORE_ENTRY_PENDING_COPY.btnEnterOrg}
            </Text>
          </View>
        )}

        {isRejected && (
          <View
            className="mt-[32rpx] h-[92rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90"
            onClick={handleResubmit}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {resubmitting ? '提交中...' : STORE_ENTRY_PENDING_COPY.btnResubmit}
            </Text>
          </View>
        )}
      </View>

      <SupportQrDialog
        visible={expediteVisible}
        onClose={() => setExpediteVisible(false)}
        titleLine1={SUPPORT_QR_EXPEDITE_COPY.titleLine1}
        titleLine2={SUPPORT_QR_EXPEDITE_COPY.titleLine2}
        description={SUPPORT_QR_EXPEDITE_COPY.description}
        saveLabel={SUPPORT_QR_EXPEDITE_COPY.saveLabel}
      />
    </PageContainer>
  );
};

export default withRouteGuard(StoreEntryPendingPage);
