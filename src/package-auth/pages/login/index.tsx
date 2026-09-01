/**
 * 登录页 — 账号+密码为主路径；微信一键为次要 CTA
 */
import { View, Text, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import AgreementDialog from '@/components/AgreementDialog';
import Icon from '@/components/Icon';
import { BRAND_LOGO } from '@/constants/brand';
import { authCapabilities } from '@/services/auth';
import { useAgreementStore } from '@/stores/agreement';
import { useAuth } from '@/utils/auth';
import { consumeLastLoginIsNewUser, navigateAfterAuth } from '@/utils/auth-onboarding';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

type PendingAction = 'wechat' | 'password' | null;

const Login: React.FC = () => {
  const { profile, signInWithWechat, signInWithUsername } = useAuth();
  const { agreed, setAgreed } = useAgreementStore();
  const navHeight = useNavSafeHeight();

  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const [wechatSubmitting, setWechatSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  useEffect(() => {
    if (profile) {
      const isNewUser = consumeLastLoginIsNewUser();
      navigateAfterAuth(profile, isNewUser ? { isNewUser: true } : undefined);
    }
  }, [profile]);

  const executeWechatLogin = useCallback(async () => {
    if (wechatSubmitting) return;

    setWechatSubmitting(true);
    try {
      const { code: wxCode } = await Taro.login();
      if (!wxCode) {
        Taro.showToast({ title: '微信授权失败，请重试', icon: 'none' });
        return;
      }
      const { error, isNewUser, profile: nextProfile } = await signInWithWechat(wxCode);
      if (error) {
        Taro.showToast({ title: error.message || '微信登录失败', icon: 'none' });
        return;
      }
      Taro.setStorageSync('justLoggedIn', 'true');
      if (nextProfile) {
        navigateAfterAuth(nextProfile, isNewUser ? { isNewUser: true } : undefined);
      }
    } catch {
      Taro.showToast({ title: '微信登录失败', icon: 'none' });
    } finally {
      setWechatSubmitting(false);
      setPendingAction(null);
    }
  }, [signInWithWechat, wechatSubmitting]);

  const executePasswordLogin = useCallback(async () => {
    if (passwordSubmitting) return;
    const trimmedAccount = account.trim();
    const trimmedPassword = password;

    setPasswordSubmitting(true);
    try {
      const {
        error,
        profile: nextProfile,
        isNewUser,
      } = await signInWithUsername(trimmedAccount, trimmedPassword);
      if (error) {
        Taro.showToast({ title: error.message || '账号登录失败', icon: 'none' });
        return;
      }
      Taro.setStorageSync('justLoggedIn', 'true');
      if (nextProfile) {
        navigateAfterAuth(nextProfile, isNewUser ? { isNewUser: true } : undefined);
      }
    } catch {
      Taro.showToast({ title: '账号登录失败', icon: 'none' });
    } finally {
      setPasswordSubmitting(false);
      setPendingAction(null);
    }
  }, [account, password, passwordSubmitting, signInWithUsername]);

  const ensureAgreement = useCallback(
    (action: Exclude<PendingAction, null>) => {
      if (agreed) return true;
      setPendingAction(action);
      setShowAgreementDialog(true);
      return false;
    },
    [agreed],
  );

  const handlePasswordLogin = useCallback(() => {
    if (passwordSubmitting || wechatSubmitting) return;
    const trimmedAccount = account.trim();
    if (!trimmedAccount) {
      Taro.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    if (!password) {
      Taro.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    if (password.length < 6) {
      Taro.showToast({ title: '密码至少 6 位', icon: 'none' });
      return;
    }
    if (!ensureAgreement('password')) return;
    void executePasswordLogin();
  }, [
    account,
    ensureAgreement,
    executePasswordLogin,
    password,
    passwordSubmitting,
    wechatSubmitting,
  ]);

  const handleWechatLogin = useCallback(() => {
    if (wechatSubmitting || passwordSubmitting) return;
    if (!authCapabilities.supportsWechatLogin) {
      Taro.showToast({ title: '当前环境暂不支持微信登录', icon: 'none' });
      return;
    }
    if (!ensureAgreement('wechat')) return;
    void executeWechatLogin();
  }, [ensureAgreement, executeWechatLogin, passwordSubmitting, wechatSubmitting]);

  const handleAgreementConfirm = useCallback(() => {
    setAgreed(true);
    setShowAgreementDialog(false);
    if (pendingAction === 'wechat') {
      void executeWechatLogin();
      return;
    }
    if (pendingAction === 'password') {
      void executePasswordLogin();
    }
  }, [executePasswordLogin, executeWechatLogin, pendingAction, setAgreed]);

  const goRegister = useCallback(() => {
    Taro.navigateTo({ url: '/package-auth/pages/register/index' });
  }, []);

  const goForgotPassword = useCallback(() => {
    Taro.navigateTo({ url: '/package-auth/pages/login/forgot-password/index' });
  }, []);

  return (
    <View className="min-h-screen flex flex-col relative overflow-hidden bg-login-page">
      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      <View className="relative z-10 h-[340rpx] flex items-end justify-center px-[56rpx] pb-[80rpx]">
        <View className="rotate-login-slogan">
          <View className="flex flex-row items-start gap-[16rpx]">
            <Text className="text-[64rpx] font-bold text-primary tracking-[4rpx] leading-[1.08]">
              智慧教务
            </Text>
            <View className="relative w-[72rpx] h-[72rpx] mt-[-6rpx] flex-shrink-0">
              <View className="absolute left-[8rpx] bottom-[-4rpx] w-[22rpx] h-[22rpx] bg-login-bubble rounded-[4rpx_0_16rpx_0] rotate-[28deg]" />
              <View className="relative z-10 w-[72rpx] h-[72rpx] rounded-full bg-login-bubble flex items-center justify-center shadow-[0_12rpx_32rpx_rgba(59,110,245,0.28)]">
                <Image
                  src={BRAND_LOGO}
                  mode="aspectFill"
                  className="w-[48rpx] h-[48rpx] rounded-full bg-white"
                />
              </View>
            </View>
          </View>
          <Text className="mt-[12rpx] ml-[72rpx] text-[64rpx] font-bold text-primary tracking-[4rpx] leading-[1.08] block">
            尽在松果
          </Text>
        </View>
      </View>

      <View className="relative z-10 flex-1 flex flex-col px-[56rpx] pt-[72rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))] shadow-login-sheet bg-white rounded-t-[72rpx]">
        <View className="h-[96rpx] rounded-full bg-login-field flex flex-row items-center px-[44rpx] mb-[28rpx]">
          <Input
            className="flex-1 text-[32rpx] font-semibold text-foreground"
            type="text"
            placeholder="请输入账号"
            placeholderClass="text-muted-foreground font-normal"
            value={account}
            maxlength={64}
            onInput={(e) => setAccount(e.detail.value)}
          />
        </View>

        <View className="h-[96rpx] rounded-full bg-login-field flex flex-row items-center px-[44rpx] mb-[28rpx]">
          <Input
            className="flex-1 text-[32rpx] font-semibold text-foreground"
            password
            placeholder="请输入密码"
            placeholderClass="text-muted-foreground font-normal"
            value={password}
            maxlength={20}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>

        <View
          className="mb-[32rpx] flex flex-row items-center gap-[12rpx]"
          onClick={() => setAgreed(!agreed)}
        >
          <View
            className={cn(
              'h-[28rpx] w-[28rpx] rounded-full border-[2rpx] flex items-center justify-center flex-shrink-0',
              agreed ? 'border-primary bg-primary' : 'border-[#CFCFCF]',
            )}
          >
            {agreed ? <Text className="text-[18rpx] text-white">✓</Text> : null}
          </View>
          <Text className="text-[22rpx] leading-[32rpx] text-muted-foreground">
            未注册账号请先注册；登录即表示已阅读并同意
            <Text
              className="text-primary"
              onClick={(e) => {
                e.stopPropagation();
                Taro.navigateTo({ url: '/package-settings/pages/agreement/index?type=user' });
              }}
            >
              《用户协议》
            </Text>
          </Text>
        </View>

        <View
          className={cn(
            'h-[88rpx] rounded-[28rpx] flex items-center justify-center bg-primary active:opacity-90',
            passwordSubmitting && 'opacity-60',
          )}
          onClick={handlePasswordLogin}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {passwordSubmitting ? '登录中...' : '账号登录'}
          </Text>
        </View>

        <View
          className={cn(
            'mt-[24rpx] h-[88rpx] rounded-[28rpx] flex flex-row items-center justify-center gap-[16rpx] border-login-email-btn active:bg-primary/5',
            wechatSubmitting && 'opacity-60',
          )}
          onClick={handleWechatLogin}
        >
          <Icon name="wechat" size={40} color="#07C160" />
          <Text className="text-[30rpx] font-semibold text-primary">
            {wechatSubmitting ? '登录中...' : '微信一键登录'}
          </Text>
        </View>

        <View className="mt-[56rpx] flex flex-row items-center justify-between px-[16rpx]">
          <Text className="text-[28rpx] text-muted-foreground font-medium" onClick={goRegister}>
            注册账号
          </Text>
          <Text
            className="text-[28rpx] text-muted-foreground font-medium"
            onClick={goForgotPassword}
          >
            找回密码
          </Text>
        </View>
      </View>

      <AgreementDialog
        visible={showAgreementDialog}
        variant="login-compact"
        confirmText="同意"
        cancelText="取消"
        onClose={() => {
          setShowAgreementDialog(false);
          setPendingAction(null);
        }}
        onConfirm={handleAgreementConfirm}
      />
    </View>
  );
};

export default Login;

export function definePageConfig() {
  return {
    navigationBarTitleText: '登录',
    navigationStyle: 'custom',
  };
}
