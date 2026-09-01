/**
 * 员工招生落地页 package-auth/pages/invite-register
 *
 * 家长扫员工招生码 / 点招生链接进入。
 * 展示 share/context → 微信注册（带 inviteCode + PARENT）→ 归属机构与邀请人。
 */
import { View, Text } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AgreementDialog from '@/components/AgreementDialog';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import { organizationService, type ShareContext } from '@/services/organization';
import { useAgreementStore } from '@/stores/agreement';
import { useAuth } from '@/utils/auth';
import {
  markLastLoginAsNewUser,
  navigateAfterAuth,
} from '@/utils/auth-onboarding';
import { storePendingInviteCode } from '@/utils/invite-parent-link';
import { resolveInviteCodeFromPageEntry } from '@/utils/wxacode-scene';
import { resolveParentShareLandingView } from '@/utils/invite-landing-view-state';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

function formatExpireAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const InviteRegisterPage: React.FC = () => {
  const { signInWithWechat, profile, session } = useAuth();
  const { setAgreed } = useAgreementStore();
  const navHeight = useNavSafeHeight();

  const [inviteCode, setInviteCode] = useState('');
  const [context, setContext] = useState<ShareContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  const isLoggedIn = Boolean(session && profile);
  const currentUserId = session?.user?.id ?? null;

  useLoad((options) => {
    setInviteCode(resolveInviteCodeFromPageEntry(options as Record<string, string>));
  });

  useEffect(() => {
    if (!inviteCode) {
      setError('邀请链接无效，请向老师索取最新链接');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await organizationService.getShareContext(inviteCode);
        if (!cancelled) {
          setContext(data);
          if (data.inviteStatus === 'pending') {
            storePendingInviteCode(inviteCode);
          }
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

  const landingView = useMemo(() => {
    if (!context) return null;
    return resolveParentShareLandingView(context, currentUserId);
  }, [context, currentUserId]);

  const goHome = useCallback(() => {
    if (!profile) return;
    navigateAfterAuth(profile);
  }, [profile]);

  const executeWechatRegister = useCallback(async () => {
    if (submitting || !inviteCode) return;

    setSubmitting(true);
    try {
      const { error: loginError, isNewUser, shareAttached, profile: nextProfile } =
        await signInWithWechat({ inviteCode, role: 'PARENT' });
      if (loginError) {
        Taro.showToast({ title: loginError.message || '登录失败', icon: 'none' });
        return;
      }

      if (isNewUser) {
        markLastLoginAsNewUser();
      }

      if (nextProfile) {
        navigateAfterAuth(nextProfile, {
          isNewUser: isNewUser ? true : undefined,
          shareAttached: shareAttached === true,
        });
      }

      Taro.setStorageSync('justLoggedIn', 'true');
    } catch {
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
      setShowAgreement(false);
    }
  }, [submitting, signInWithWechat, inviteCode]);

  const handleRegisterClick = useCallback(() => {
    setShowAgreement(true);
  }, []);

  const handleConfirmAgreement = useCallback(() => {
    setAgreed(true);
    void executeWechatRegister();
  }, [setAgreed, executeWechatRegister]);

  if (loading) {
    return (
      <View className="min-h-screen bg-background">
        <Loading text="加载邀请信息…" />
      </View>
    );
  }

  if (error || !context) {
    return (
      <View className="min-h-screen flex flex-col items-center justify-center bg-background px-page-padding">
        <Icon name="mdi-alert-circle-outline" size={64} className="text-destructive mb-4" />
        <Text className="text-[28rpx] text-muted-foreground text-center">{error || '邀请无效'}</Text>
      </View>
    );
  }

  if (landingView === 'expired') {
    return (
      <View className="min-h-screen flex flex-col items-center justify-center bg-background px-page-padding">
        <Icon name="mdi-clock-alert-outline" size={64} className="text-muted-foreground mb-4" />
        <Text className="text-[32rpx] font-semibold text-foreground text-center mb-[16rpx]">
          邀请链接已过期
        </Text>
        <Text className="text-[28rpx] text-muted-foreground text-center">
          该链接有效期为 24 小时，请联系 {context.teacherName} 重新获取
        </Text>
      </View>
    );
  }

  if (landingView === 'used_invalid') {
    return (
      <View className="min-h-screen flex flex-col items-center justify-center bg-background px-page-padding">
        <Icon name="mdi-link-off" size={64} className="text-muted-foreground mb-4" />
        <Text className="text-[32rpx] font-semibold text-foreground text-center mb-[16rpx]">
          邀请链接已失效
        </Text>
        <Text className="text-[28rpx] text-muted-foreground text-center">
          该链接已被使用，请向 {context.teacherName} 索取新的邀请链接
        </Text>
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
            {context.organizationName}
          </Text>
          <Text className="text-[26rpx] text-muted-foreground text-center mb-[48rpx]">
            邀请人：{context.teacherName}
          </Text>
          <View
            className="h-[96rpx] w-full rounded-full bg-primary flex items-center justify-center active:opacity-90"
            onClick={goHome}
          >
            <Text className="text-[34rpx] font-semibold text-white">进入首页</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="min-h-screen flex flex-col bg-background relative">
      <View className="absolute top-0 left-0 right-0 h-[520rpx] overflow-hidden bg-register-deco">
        <View className="absolute w-[400rpx] h-[400rpx] rounded-full bg-register-circle -top-[120rpx] -right-[120rpx]" />
      </View>

      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      <View className="relative z-10 flex flex-col items-center justify-start pt-[88rpx]">
        <View className="absolute w-[420rpx] h-[420rpx] rounded-full bg-login-glow" />
        <View className="relative w-[220rpx] h-[220rpx] rounded-full bg-login-orb flex items-center justify-center mt-[14rpx]">
          <Icon name="school" size={120} className="text-primary" />
        </View>
      </View>

      <View className="relative z-10 px-[48rpx] pt-[64rpx]">
        <View className="mb-[48rpx] flex flex-col items-center gap-[16rpx]">
          <Text className="text-[40rpx] font-semibold text-foreground text-center">
            欢迎加入{context.organizationName}
          </Text>
          <View className="flex items-center gap-[8rpx] px-[24rpx] py-[12rpx] rounded-full bg-primary/10">
            <Icon name="mdi-account-outline" size={18} className="text-primary" />
            <Text className="text-[26rpx] text-primary">邀请人：{context.teacherName}</Text>
          </View>
          {context.expireAt ? (
            <Text className="text-[24rpx] text-muted-foreground">
              链接有效期至 {formatExpireAt(context.expireAt)}
            </Text>
          ) : null}
        </View>

        <Text className="text-[26rpx] text-muted-foreground text-center mb-[48rpx] block leading-relaxed">
          {isLoggedIn
            ? '您已登录，可直接进入首页继续使用'
            : '使用微信一键加入，注册后将归属到该机构，邀请人可在线索中跟进您'}
        </Text>

        {isLoggedIn ? (
          <View
            className={cn(
              'h-[96rpx] rounded-full flex items-center justify-center mb-[28rpx]',
              'bg-primary active:opacity-90 transition-opacity shadow-login-btn',
            )}
            onClick={goHome}
          >
            <Text className="text-[34rpx] font-semibold text-white">进入首页</Text>
          </View>
        ) : (
          <View
            className={cn(
              'h-[96rpx] rounded-full flex items-center justify-center mb-[28rpx]',
              'bg-primary active:opacity-90 transition-opacity shadow-login-btn',
              submitting && 'opacity-50',
            )}
            onClick={submitting ? undefined : handleRegisterClick}
          >
            <View className="flex items-center gap-[12rpx]">
              <Icon name="mdi-wechat" size={22} className="text-white" />
              <Text className="text-[34rpx] font-semibold text-white">
                {submitting ? '处理中…' : '微信一键加入'}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View className="flex-1" />

      <AgreementDialog
        visible={showAgreement}
        onClose={() => setShowAgreement(false)}
        onConfirm={handleConfirmAgreement}
        confirmText="同意并继续"
      />
    </View>
  );
};

export default InviteRegisterPage;
