/**
 * 门店入驻申请中页 pages/store-entry/pending/index（R3）
 *
 * 进页查询真实申请状态（兼容 PENDING/pending 大小写）：
 * - pending  → 审核中（展示申请信息 + 联系客服）
 * - approved → 入驻成功（刷会话注入 organizationId 后进入机构端）
 * - rejected → 展示拒绝原因 + 重新提交
 *
 * 产品：获批后用户 = 管理员（OWNER）；校区岗「校长」≠ 本页身份。
 */
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { refreshSessionForTenant } from '@/services/auth';
import { readStoreEntryDraft, storeEntryService } from '@/services/store-entry';
import type { StoreEntryLatestResult } from '@/types/store-entry';
import { useAuth } from '@/utils/auth';
import { usePrimaryNavigationBar } from '@/utils/navigation-bar';
import { navigateAfterLogin, withRouteGuard } from '@/utils/route-guard';
import {
  isStoreEntryApproved,
  isStoreEntryRejected,
  normalizeStoreEntryStatus,
} from '@/utils/store-entry-status';
import { consumePendingStoreReferralCode } from '@/utils/invite-store-referral-link';

/** 分包静态资源，构建时 copy 至 dist/package-settings/assets/ */
const WX_QR_CODE = '/package-settings/assets/wx.jpg';

const StoreEntryPendingPage: React.FC = () => {
  usePrimaryNavigationBar();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<StoreEntryLatestResult | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [entering, setEntering] = useState(false);

  const status = normalizeStoreEntryStatus(latest?.application?.status || 'pending');
  const rejectReason =
    latest?.application?.rejectReason || latest?.organization?.rejectReason || '';
  const storeName = latest?.organization?.name || '';

  const isOpened = isStoreEntryApproved(status);
  const isRejected = isStoreEntryRejected(status);

  useEffect(() => {
    void Taro.setNavigationBarTitle({
      title: isOpened ? '入驻成功' : isRejected ? '申请被驳回' : '申请中',
    });
  }, [isOpened, isRejected]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await storeEntryService.queryLatest();
        if (!cancelled) setLatest(result);
      } catch {
        if (!cancelled) setLatest(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tip = useMemo(() => {
    if (isOpened) {
      return storeName
        ? `门店入驻成功，默认主校区「${storeName}」已创建。您已是该机构管理员，可进入机构端开始管理。`
        : '门店入驻成功，您已是机构管理员，可进入机构端开始管理。';
    }
    if (isRejected) {
      return '很抱歉，您的入驻申请未通过运营审核，可修改资料后重新提交。';
    }
    return '您的门店入驻申请已提交，需运营审核通过后开通（通常 1-3 个工作日）。';
  }, [isOpened, isRejected, storeName]);

  const handlePreviewQr = useCallback(() => {
    void Taro.previewImage({ current: WX_QR_CODE, urls: [WX_QR_CODE] });
  }, []);

  const handleEnterOrg = useCallback(async () => {
    if (entering) return;
    setEntering(true);
    try {
      // 批准前会话可能无 organizationId；强制 refresh 注入 ACTIVE 主租户
      const refreshed = await refreshSessionForTenant();
      if (!refreshed.ok) {
        Taro.showToast({ title: refreshed.error?.message || '请重新登录', icon: 'none' });
        return;
      }
      await refreshProfile();
      navigateAfterLogin();
    } catch {
      Taro.showToast({ title: '进入失败，请重新登录后再试', icon: 'none' });
    } finally {
      setEntering(false);
    }
  }, [entering, refreshProfile]);

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
      Taro.showToast({ title: '已重新提交', icon: 'success' });
      setLatest(null);
      setLoading(true);
      const result = await storeEntryService.queryLatest();
      setLatest(result);
      setLoading(false);
    } catch {
      Taro.showToast({ title: '重新提交失败，请重试', icon: 'none' });
      setLoading(false);
    } finally {
      setResubmitting(false);
    }
  }, []);

  if (loading) {
    return (
      <PageContainer safeBottom className="px-[32rpx] py-[32rpx]">
        <View className="flex items-center justify-center py-[120rpx]">
          <Text className="text-[28rpx] text-muted-foreground">查询申请状态中...</Text>
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
          {isOpened ? '入驻成功' : isRejected ? '申请被驳回' : '申请审核中'}
        </Text>
        <Text className="text-[28rpx] leading-[1.7] text-muted-foreground block">{tip}</Text>

        {isRejected && rejectReason ? (
          <View className="mt-[24rpx] rounded-[20rpx] bg-destructive/10 px-[24rpx] py-[20rpx]">
            <Text className="text-[26rpx] leading-[1.6] text-destructive">
              拒绝原因：{rejectReason}
            </Text>
          </View>
        ) : null}

        {isOpened && (
          <View
            className="mt-[32rpx] h-[92rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90"
            onClick={handleEnterOrg}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {entering ? '进入中...' : '进入机构端首页'}
            </Text>
          </View>
        )}

        {isRejected && (
          <View
            className="mt-[32rpx] h-[92rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90"
            onClick={handleResubmit}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {resubmitting ? '提交中...' : '修改资料重新提交'}
            </Text>
          </View>
        )}
      </View>

      <View className="rounded-[32rpx] bg-white px-[32rpx] py-[40rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)]">
        <View className="flex flex-row items-center gap-[12rpx] mb-[24rpx]">
          <Icon name="headset" size={40} className="text-primary" />
          <Text className="text-[32rpx] font-semibold text-foreground">联系客服</Text>
          <Text className="text-[24rpx] text-muted-foreground">在线客服</Text>
        </View>

        <View className="flex flex-col items-center" onClick={handlePreviewQr}>
          <Image
            src={WX_QR_CODE}
            mode="aspectFit"
            className="w-[320rpx] h-[320rpx] rounded-[28rpx] border-[2rpx] border-border"
            showMenuByLongpress
          />
          <Text className="text-[24rpx] text-muted-foreground text-center block mt-[24rpx] leading-[1.7]">
            点击图片放大，长按可保存微信二维码
          </Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(StoreEntryPendingPage);
