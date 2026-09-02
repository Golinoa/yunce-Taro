/**
 * L4 门店互邀落地页
 * 入口：store-referral-landing?code=OXXXXXXXX
 * 展示推荐机构 → 跳转门店入驻（携带 pending referral）
 */
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import { BRAND_NAME_ZH } from '@/constants/brand';
import { orgReferralService, type OrgReferralPreview } from '@/services/org-referral';
import {
  normalizeOrgReferralCode,
  storePendingStoreReferralCode,
} from '@/utils/invite-store-referral-link';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const StoreReferralLanding: React.FC = () => {
  const router = useRouter();
  const navHeight = useNavSafeHeight();

  const inviteCode = useMemo(
    () => normalizeOrgReferralCode(router.params.code || ''),
    [router.params.code],
  );

  const [preview, setPreview] = useState<OrgReferralPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (inviteCode) {
      storePendingStoreReferralCode(inviteCode);
    }
  }, [inviteCode]);

  useEffect(() => {
    if (!inviteCode) {
      setError('邀请链接无效，请向邀请方索取最新链接');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await orgReferralService.preview(inviteCode);
        if (!cancelled) {
          setPreview(data);
          storePendingStoreReferralCode(data.inviteCode);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '邀请信息加载失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  const handleApply = useCallback(() => {
    if (inviteCode) {
      storePendingStoreReferralCode(inviteCode);
    }
    Taro.navigateTo({ url: '/package-settings/pages/store-entry/index' });
  }, [inviteCode]);

  if (loading) {
    return (
      <View className="min-h-screen bg-background" style={{ paddingTop: navHeight }}>
        <Loading text="加载邀请信息..." />
      </View>
    );
  }

  if (error || !preview) {
    return (
      <View
        className="min-h-screen bg-background px-[40rpx] flex flex-col items-center justify-center"
        style={{ paddingTop: navHeight }}
      >
        <Icon name="mdi-link-off" size={64} className="text-muted-foreground mb-[24rpx]" />
        <Text className="text-[32rpx] font-bold text-foreground text-center">
          {error || '链接无效'}
        </Text>
        <View
          className="mt-[48rpx] px-[48rpx] h-[88rpx] rounded-full bg-primary center press-scale"
          onClick={() => Taro.navigateTo({ url: '/package-settings/pages/about/index' })}
        >
          <Text className="text-[28rpx] font-bold text-white">了解 {BRAND_NAME_ZH}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="min-h-screen bg-background flex flex-col" style={{ paddingTop: navHeight }}>
      <View className="flex-1 px-[40rpx] pt-[48rpx] pb-[200rpx]">
        <View className="bg-card rounded-[28rpx] shadow-card p-[40rpx]">
          <Text className="block text-[24rpx] text-muted-foreground mb-[16rpx]">好友推荐</Text>
          <Text className="block text-[40rpx] font-black text-foreground leading-tight">
            {preview.organizationName}
          </Text>
          <Text className="block text-[28rpx] text-muted-foreground mt-[20rpx] leading-relaxed">
            邀请您开通门店，使用 {BRAND_NAME_ZH} 管理排课、消课与会员。
          </Text>
          <View className="mt-[32rpx] px-[24rpx] py-[20rpx] rounded-[16rpx] bg-muted/40">
            <Text className="text-[24rpx] text-muted-foreground">
              提交申请后需运营审核；审核通过即可成为机构管理员。
            </Text>
          </View>
        </View>
      </View>

      <View className="fixed bottom-0 left-0 right-0 px-[32rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))] pt-[16rpx] bg-background/95 border-t border-border">
        <View
          className="h-[96rpx] rounded-[28rpx] bg-primary center press-scale shadow-lg"
          onClick={handleApply}
        >
          <Text className="text-[30rpx] font-bold text-white">申请门店入驻</Text>
        </View>
        <Text className="block text-center text-[22rpx] text-muted-foreground mt-[16rpx]">
          邀请码 {preview.inviteCode}
        </Text>
      </View>
    </View>
  );
};

export default StoreReferralLanding;
