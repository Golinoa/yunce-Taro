/**
 * 登录页 — 邮箱验证码 + 微信一键登录；mock / 生产均走 services/auth
 */
import { View, Text, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AgreementDialog from '@/components/AgreementDialog';
import Icon from '@/components/Icon';
import { BRAND_LOGO } from '@/constants/brand';
import { authCapabilities, prepareEmailLogin } from '@/services/auth';
import { useAgreementStore } from '@/stores/agreement';
import { consumeLastLoginIsNewUser, navigateAfterAuth } from '@/utils/auth-onboarding';
import { useAuth } from '@/utils/auth';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_COUNTDOWN_SEC = 60;
type PendingAction = 'wechat' | 'email' | null;

const Login: React.FC = () => {
  const { profile, signInWithWechat, signInWithEmailCode } = useAuth();
  const { agreed, setAgreed } = useAgreementStore();
  const navHeight = useNavSafeHeight();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const [wechatSubmitting, setWechatSubmitting] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (profile) {
      const isNewUser = consumeLastLoginIsNewUser();
      navigateAfterAuth(profile, isNewUser ? { isNewUser: true } : undefined);
    }
  }, [profile]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setCountdown(CODE_COUNTDOWN_SEC);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const executeWechatLogin = useCallback(async () => {
    if (wechatSubmitting) return;

    setWechatSubmitting(true);
    try {
      const { code: wxCode } = await Taro.login();
      if (!wxCode) {
        Taro.showToast({ title: '微信授权失败，请重试', icon: 'none' });
        return;
      }
      const { error } = await signInWithWechat(wxCode);
      if (error) {
        Taro.showToast({ title: error.message || '微信登录失败', icon: 'none' });
        return;
      }
      Taro.setStorageSync('justLoggedIn', 'true');
    } catch {
      Taro.showToast({ title: '微信登录失败', icon: 'none' });
    } finally {
      setWechatSubmitting(false);
      setPendingAction(null);
    }
  }, [signInWithWechat, wechatSubmitting]);

  const executeEmailLogin = useCallback(async () => {
    if (emailSubmitting) return;
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    setEmailSubmitting(true);
    try {
      const { error } = await signInWithEmailCode(trimmedEmail, trimmedCode);
      if (error) {
        Taro.showToast({ title: error.message || '邮箱登录失败', icon: 'none' });
        return;
      }
      Taro.setStorageSync('justLoggedIn', 'true');
    } catch {
      Taro.showToast({ title: '邮箱登录失败', icon: 'none' });
    } finally {
      setEmailSubmitting(false);
      setPendingAction(null);
    }
  }, [code, email, emailSubmitting, signInWithEmailCode]);

  const ensureAgreement = useCallback(
    (action: Exclude<PendingAction, null>) => {
      if (agreed) return true;
      setPendingAction(action);
      setShowAgreementDialog(true);
      return false;
    },
    [agreed],
  );

  const handleSendCode = useCallback(async () => {
    if (sendingCode || countdown > 0) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Taro.showToast({ title: '请输入邮箱', icon: 'none' });
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      Taro.showToast({ title: '请输入正确的邮箱地址', icon: 'none' });
      return;
    }

    setSendingCode(true);
    const result = await prepareEmailLogin(trimmedEmail, 'email');
    setSendingCode(false);

    if (result.error || result.status !== 'ready') {
      Taro.showToast({ title: result.error?.message || '验证码发送失败', icon: 'none' });
      return;
    }

    startCountdown();
    Taro.showToast({
      title: `验证码已发送至${result.maskedEmail || result.email || ''}`,
      icon: 'none',
      duration: 2500,
    });
  }, [countdown, email, sendingCode, startCountdown]);

  const handleEmailLogin = useCallback(() => {
    if (emailSubmitting || wechatSubmitting) return;
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (!trimmedEmail) {
      Taro.showToast({ title: '请输入邮箱', icon: 'none' });
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      Taro.showToast({ title: '请输入正确的邮箱地址', icon: 'none' });
      return;
    }
    if (!trimmedCode) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }
    if (trimmedCode.length < 4) {
      Taro.showToast({ title: '请输入正确的验证码', icon: 'none' });
      return;
    }
    if (!ensureAgreement('email')) return;
    void executeEmailLogin();
  }, [
    code,
    email,
    emailSubmitting,
    ensureAgreement,
    executeEmailLogin,
    wechatSubmitting,
  ]);

  const handleWechatLogin = useCallback(() => {
    if (wechatSubmitting || emailSubmitting) return;
    if (!authCapabilities.supportsWechatLogin) {
      Taro.showToast({ title: '当前环境暂不支持微信登录', icon: 'none' });
      return;
    }
    if (!ensureAgreement('wechat')) return;
    void executeWechatLogin();
  }, [emailSubmitting, ensureAgreement, executeWechatLogin, wechatSubmitting]);

  const handleAgreementConfirm = useCallback(() => {
    setAgreed(true);
    setShowAgreementDialog(false);
    if (pendingAction === 'wechat') {
      void executeWechatLogin();
      return;
    }
    if (pendingAction === 'email') {
      void executeEmailLogin();
    }
  }, [executeEmailLogin, executeWechatLogin, pendingAction, setAgreed]);

  const goRegister = useCallback(() => {
    Taro.navigateTo({ url: '/package-auth/pages/register/index' });
  }, []);

  const goForgotPassword = useCallback(() => {
    Taro.navigateTo({ url: '/package-auth/pages/login/forgot-password/index' });
  }, []);

  return (
    <View className="min-h-screen flex flex-col relative overflow-hidden bg-login-page">
      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      {/* 头部品牌斜排字 + sgpk 气泡 */}
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

      {/* 表单区 */}
      <View className="relative z-10 flex-1 flex flex-col px-[56rpx] pt-[72rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))] shadow-login-sheet bg-white rounded-t-[72rpx]">
        <View className="h-[96rpx] rounded-full bg-login-field flex flex-row items-center px-[44rpx] mb-[28rpx]">
          <Input
            className="flex-1 text-[32rpx] font-semibold text-foreground"
            type="text"
            placeholder="请输入邮箱"
            placeholderClass="text-muted-foreground font-normal"
            value={email}
            maxlength={64}
            onInput={(e) => setEmail(e.detail.value)}
          />
        </View>

        <View className="h-[96rpx] rounded-full bg-login-field flex flex-row items-center px-[44rpx] mb-[28rpx]">
          <Input
            className="flex-1 text-[32rpx] font-semibold text-foreground"
            type="number"
            placeholder="请输入验证码"
            placeholderClass="text-muted-foreground font-normal"
            value={code}
            maxlength={6}
            onInput={(e) => setCode(e.detail.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Text
            className={cn(
              'pl-[24rpx] text-[28rpx] font-semibold flex-shrink-0',
              countdown > 0 || sendingCode ? 'text-muted-foreground' : 'text-primary',
            )}
            onClick={() => {
              void handleSendCode();
            }}
          >
            {sendingCode ? '发送中' : countdown > 0 ? `${countdown}s` : '发送验证码'}
          </Text>
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
            我已阅读并同意
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

        {/* 邮箱登录：弱按钮 */}
        <View
          className={cn(
            'h-[88rpx] rounded-[28rpx] flex items-center justify-center border-login-email-btn active:bg-primary/5',
            emailSubmitting && 'opacity-60',
          )}
          onClick={handleEmailLogin}
        >
          <Text className="text-[30rpx] font-semibold text-primary">
            {emailSubmitting ? '登录中...' : '邮箱登录'}
          </Text>
        </View>

        {/* 微信一键登录：主 CTA */}
        <View
          className={cn(
            'mt-[24rpx] h-[88rpx] rounded-[28rpx] flex flex-row items-center justify-center gap-[16rpx] bg-gradient-wechat-solid shadow-wechat-btn active:opacity-90',
            wechatSubmitting && 'opacity-60',
          )}
          onClick={handleWechatLogin}
        >
          <Icon name="wechat" size={40} color="white" />
          <Text className="text-[30rpx] font-semibold text-white">
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
