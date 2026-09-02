/**
 * 校区员工邀请落地页
 * 入口：campus-invite-landing?code=XXXXXXXXXX
 * - 未登录：预览机构信息 → 登录 → 接受邀请
 * - 已登录：预览 → 接受（刷新 token）→ 进入首页
 * - 已使用且当前用户为绑定者：展示加入成功页
 */
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import { getSession } from '@/services/auth';
import { campusInviteService, type CampusInvitePreview } from '@/services/campus-invite';
import { useAuth } from '@/utils/auth';
import { clearIdentitySelectionPending } from '@/utils/auth-onboarding';
import {
  buildCampusInvitePath,
  consumePendingCampusInviteCode,
  storePendingCampusInviteCode,
} from '@/utils/invite-staff-link';
import { LOGIN_REDIRECT_KEY, navigateAfterLogin } from '@/utils/route-guard';
import { resolveCampusInviteLandingView } from '@/utils/invite-landing-view-state';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

function formatExpireAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const CampusInviteLanding: React.FC = () => {
  const router = useRouter();
  const navHeight = useNavSafeHeight();
  const { profile, refreshProfile, session } = useAuth();

  const inviteCode = useMemo(() => {
    const fromRoute = (router.params.code || '').trim().toUpperCase();
    if (fromRoute) return fromRoute;
    return consumePendingCampusInviteCode();
  }, [router.params.code]);

  const [preview, setPreview] = useState<CampusInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  const currentUserId = session?.user?.id ?? null;

  useEffect(() => {
    if (inviteCode) {
      storePendingCampusInviteCode(inviteCode);
    }
  }, [inviteCode]);

  useEffect(() => {
    if (!inviteCode) {
      setError('邀请链接无效，请联系邀请人重新获取');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await campusInviteService.preview(inviteCode);
        if (!cancelled) {
          setPreview(data);
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

  const handleLogin = useCallback(() => {
    if (inviteCode) {
      storePendingCampusInviteCode(inviteCode);
      // B0-2：登录后须回到本落地页；仅存 pending 不够（navigateAfterAuth 可能进选身份）
      try {
        Taro.setStorageSync(LOGIN_REDIRECT_KEY, buildCampusInvitePath(inviteCode));
      } catch {
        /* ignore */
      }
    }
    Taro.navigateTo({ url: '/package-auth/pages/login/index' });
  }, [inviteCode]);

  const handleAccept = useCallback(async () => {
    if (!inviteCode || accepting) return;

    if (!session) {
      handleLogin();
      return;
    }

    setAccepting(true);
    try {
      const result = await campusInviteService.accept(inviteCode);
      consumePendingCampusInviteCode();
      clearIdentitySelectionPending();
      await refreshProfile();
      const { profile: latestProfile } = await getSession();
      Taro.showToast({
        title: result.alreadyJoined ? '您已在该机构' : '加入成功',
        icon: 'success',
      });
      setTimeout(() => {
        navigateAfterLogin(latestProfile || profile);
      }, 600);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '接受邀请失败',
        icon: 'none',
      });
    } finally {
      setAccepting(false);
    }
  }, [inviteCode, accepting, session, handleLogin, refreshProfile, profile]);

  const goHome = useCallback(() => {
    navigateAfterLogin(profile);
  }, [profile]);

  const landingView = useMemo(() => {
    if (!preview) return null;
    return resolveCampusInviteLandingView(preview, currentUserId);
  }, [preview, currentUserId]);

  const canAccept = landingView === 'pending';

  if (loading) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <View style={{ height: `${navHeight}px` }} />
        <Loading text="加载邀请信息…" />
      </View>
    );
  }

  if (error || !preview) {
    return (
      <View className="min-h-screen bg-background px-[48rpx]">
        <View style={{ height: `${navHeight}px` }} />
        <View className="pt-[80rpx] flex flex-col items-center">
          <Icon
            name="mdi-alert-circle-outline"
            size={80}
            className="text-muted-foreground mb-[24rpx]"
          />
          <Text className="text-[32rpx] text-foreground text-center">{error || '邀请无效'}</Text>
          <Text
            className="text-[28rpx] text-primary mt-[48rpx]"
            onClick={() => Taro.navigateTo({ url: '/package-auth/pages/login/index' })}
          >
            去登录
          </Text>
        </View>
      </View>
    );
  }

  if (landingView === 'success_for_viewer') {
    return (
      <View className="min-h-screen flex flex-col bg-background">
        <View style={{ height: `${navHeight}px` }} />
        <View className="flex-1 flex flex-col items-center justify-center px-[48rpx]">
          <Icon name="mdi-check-circle-outline" size={96} className="text-primary mb-[32rpx]" />
          <Text className="text-[40rpx] font-semibold text-foreground text-center mb-[16rpx]">
            您已成功加入
          </Text>
          <Text className="text-[30rpx] text-muted-foreground text-center mb-[8rpx]">
            {preview.organizationName}
          </Text>
          <Text className="text-[26rpx] text-muted-foreground text-center mb-[48rpx]">
            {preview.campusName} · {preview.roleLabel || preview.roleCode}
          </Text>
          <View
            className="h-[96rpx] w-full rounded-full bg-primary flex items-center justify-center active:opacity-90"
            onClick={goHome}
          >
            <Text className="text-[32rpx] font-semibold text-white">进入首页</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="min-h-screen flex flex-col bg-background">
      <View style={{ height: `${navHeight}px` }} />

      <View className="px-[48rpx] pt-[32rpx] flex-1">
        <Text className="text-[44rpx] font-bold text-foreground block mb-[12rpx]">
          加入 {preview.organizationName}
        </Text>
        <Text className="text-[28rpx] text-muted-foreground block mb-[48rpx]">
          您已被邀请加入该机构，请确认信息后接受邀请
        </Text>

        <View className="bg-card rounded-[28rpx] p-[32rpx] border border-border shadow-soft mb-[32rpx]">
          <InfoRow label="机构" value={preview.organizationName} />
          <InfoRow label="校区" value={preview.campusName} />
          <InfoRow label="邀请角色" value={preview.roleLabel || preview.roleCode} />
          <InfoRow label="有效期至" value={formatExpireAt(preview.expireAt)} />
          <InfoRow label="邀请码" value={preview.inviteCode} copyable />
        </View>

        {landingView === 'used_invalid' ? (
          <Text className="text-[28rpx] text-muted-foreground text-center block">
            该邀请链接已被使用，请联系邀请人重新生成
          </Text>
        ) : null}
        {landingView === 'expired' ? (
          <Text className="text-[28rpx] text-muted-foreground text-center block">
            邀请链接已过期，请联系邀请人重新生成（有效期 24 小时）
          </Text>
        ) : null}
      </View>

      <View className="px-[48rpx] pb-[calc(48rpx+env(safe-area-inset-bottom))]">
        {canAccept ? (
          session ? (
            <View
              className="h-[96rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90"
              onClick={handleAccept}
            >
              <Text className="text-[32rpx] font-semibold text-white">
                {accepting ? '处理中…' : '接受邀请'}
              </Text>
            </View>
          ) : (
            <View
              className="h-[96rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90"
              onClick={handleLogin}
            >
              <Text className="text-[32rpx] font-semibold text-white">登录并接受邀请</Text>
            </View>
          )
        ) : null}
      </View>
    </View>
  );
};

const InfoRow: React.FC<{
  label: string;
  value: string;
  copyable?: boolean;
}> = ({ label, value, copyable }) => (
  <View className="flex flex-row items-center justify-between py-[16rpx] border-b border-border last:border-b-0">
    <Text className="text-[28rpx] text-muted-foreground">{label}</Text>
    <View className="flex flex-row items-center gap-[12rpx]">
      <Text className="text-[28rpx] text-foreground font-medium">{value}</Text>
      {copyable ? (
        <Icon
          name="mdi-content-copy"
          size={28}
          className="text-primary"
          onClick={() => {
            Taro.setClipboardData({ data: value });
            Taro.showToast({ title: '已复制', icon: 'success' });
          }}
        />
      ) : null}
    </View>
  </View>
);

export default CampusInviteLanding;
