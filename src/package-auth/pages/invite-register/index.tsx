/**
 * ??????? package-auth/pages/invite-register
 *
 * ??????????????+ ???????????????
 * ?? register ???????????????????
 */
import { View, Text } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import AgreementDialog from '@/components/AgreementDialog';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import { organizationService, type ShareContext } from '@/services/organization';
import { useAgreementStore } from '@/stores/agreement';
import { useAuth } from '@/utils/auth';
import {
  consumeLastLoginIsNewUser,
  markLastLoginAsNewUser,
  navigateAfterAuth,
} from '@/utils/auth-onboarding';
import {
  normalizeInviteCodeParam,
  storePendingInviteCode,
} from '@/utils/invite-parent-link';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

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

  useLoad((options) => {
    const opt = options as Record<string, string>;
    const fromQuery = opt.teacherCode || '';
    const fromScene = opt.scene || '';
    const code = normalizeInviteCodeParam(fromQuery || fromScene);
    setInviteCode(code);
  });

  useEffect(() => {
    if (inviteCode) {
      storePendingInviteCode(inviteCode);
    }
  }, [inviteCode]);

  useEffect(() => {
    if (!inviteCode) {
      setError('????????????');
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
          storePendingInviteCode(inviteCode);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '?????????');
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

  useEffect(() => {
    if (session && profile && context) {
      const isNewUser = consumeLastLoginIsNewUser();
      navigateAfterAuth(profile, isNewUser ? { isNewUser: true } : undefined);
    }
  }, [session, profile, context]);

  const executeWechatRegister = useCallback(async () => {
    if (submitting) return;

    setSubmitting(true);
    try {
      const { code: wxCode } = await Taro.login();
      if (!wxCode) {
        Taro.showToast({ title: '微信授权失败，请重试', icon: 'none' });
        return;
      }

      const { error: loginError, isNewUser } = await signInWithWechat(wxCode);
      if (loginError) {
        Taro.showToast({ title: loginError.message || '注册失败', icon: 'none' });
        return;
      }

      if (isNewUser) {
        markLastLoginAsNewUser();
      }

      // 缺手机号不拦截；首页/我的轻量提醒绑定
      Taro.setStorageSync('justLoggedIn', 'true');
    } catch {
      Taro.showToast({ title: '注册失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
      setShowAgreement(false);
    }
  }, [submitting, signInWithWechat]);

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
        <Loading text="???????.." />
      </View>
    );
  }

  if (error || !context) {
    return (
      <View className="min-h-screen flex flex-col items-center justify-center bg-background px-page-padding">
        <Icon name="mdi-alert-circle-outline" size={64} className="text-destructive mb-4" />
        <Text className="text-[28rpx] text-muted-foreground text-center">
          {error || '?????'}
        </Text>
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
            ???????{context.organizationName}
          </Text>
          <View className="flex items-center gap-[8rpx] px-[24rpx] py-[12rpx] rounded-full bg-primary/10">
            <Icon name="mdi-account-outline" size={18} className="text-primary" />
            <Text className="text-[26rpx] text-primary">????{context.teacherName}</Text>
          </View>
        </View>

        <Text className="text-[26rpx] text-muted-foreground text-center mb-[48rpx] block leading-relaxed">
          ???????????????????????
        </Text>

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
              {submitting ? '???...' : '??????'}
            </Text>
          </View>
        </View>
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
