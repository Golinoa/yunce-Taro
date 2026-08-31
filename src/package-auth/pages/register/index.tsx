/**
 * 注册页 — 对齐登录页视觉：邮箱验证码注册（未注册邮箱会创建账号）
 */
import { View, Text, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AgreementDialog from '@/components/AgreementDialog';
import { BRAND_LOGO } from '@/constants/brand';
import { prepareEmailLogin } from '@/services/auth';
import { useAgreementStore } from '@/stores/agreement';
import { useAuth } from '@/utils/auth';
import { consumeLastLoginIsNewUser, navigateAfterAuth } from '@/utils/auth-onboarding';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_COUNTDOWN_SEC = 60;
const Register: React.FC = () => {
  const { profile, signInWithEmailCode } = useAuth();
  const { agreed, setAgreed } = useAgreementStore();
  const navHeight = useNavSafeHeight();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [pendingRegister, setPendingRegister] = useState(false);
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

  const executeRegister = useCallback(async () => {
    if (submitting) return;
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    setSubmitting(true);
    try {
      const { error, isNewUser } = await signInWithEmailCode(trimmedEmail, trimmedCode);
      if (error) {
        Taro.showToast({ title: error.message || '注册失败', icon: 'none' });
        return;
      }
      Taro.setStorageSync('justLoggedIn', 'true');
      if (!isNewUser) {
        Taro.showToast({ title: '该邮箱已注册，已为您登录', icon: 'none' });
      }
    } catch {
      Taro.showToast({ title: '注册失败', icon: 'none' });
    } finally {
      setSubmitting(false);
      setPendingRegister(false);
    }
  }, [code, email, signInWithEmailCode, submitting]);

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

  const handleRegister = useCallback(() => {
    if (submitting) return;
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
    if (!agreed) {
      setPendingRegister(true);
      setShowAgreementDialog(true);
      return;
    }
    void executeRegister();
  }, [agreed, code, email, executeRegister, submitting]);

  const handleAgreementConfirm = useCallback(() => {
    setAgreed(true);
    setShowAgreementDialog(false);
    if (pendingRegister) {
      void executeRegister();
    }
  }, [executeRegister, pendingRegister, setAgreed]);

  const goLogin = useCallback(() => {
    Taro.navigateBack({
      fail: () => {
        Taro.redirectTo({ url: '/package-auth/pages/login/index' });
      },
    });
  }, []);

  return (
    <View className="min-h-screen flex flex-col relative overflow-hidden bg-login-page">
      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      <View className="relative z-10 h-[280rpx] flex items-end justify-center px-[56rpx] pb-[36rpx]">
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

      <View className="relative z-10 flex-1 flex flex-col px-[56rpx] pt-[48rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))] shadow-login-sheet bg-white rounded-t-[72rpx]">
        <Text className="mb-[32rpx] text-[32rpx] font-semibold text-foreground">邮箱注册</Text>

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
          className="mb-[40rpx] flex flex-row items-start gap-[16rpx]"
          onClick={() => setAgreed(!agreed)}
        >
          <View
            className={cn(
              'mt-[4rpx] h-[32rpx] w-[32rpx] rounded-full border-[2rpx] flex items-center justify-center flex-shrink-0',
              agreed ? 'border-primary bg-primary' : 'border-[#CFCFCF]',
            )}
          >
            {agreed ? <Text className="text-[20rpx] text-white">✓</Text> : null}
          </View>
          <Text className="flex-1 text-[24rpx] leading-[36rpx] text-muted-foreground">
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

        <View
          className={cn(
            'h-[88rpx] rounded-[28rpx] flex items-center justify-center bg-primary active:opacity-90',
            submitting && 'opacity-60',
          )}
          onClick={handleRegister}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {submitting ? '注册中...' : '注册账号'}
          </Text>
        </View>

        <View className="mt-[56rpx] flex flex-row items-center justify-center">
          <Text className="text-[28rpx] text-muted-foreground font-medium" onClick={goLogin}>
            已有账号？去登录
          </Text>
        </View>
      </View>

      <AgreementDialog
        visible={showAgreementDialog}
        onClose={() => {
          setShowAgreementDialog(false);
          setPendingRegister(false);
        }}
        onConfirm={handleAgreementConfirm}
        confirmText="同意并注册"
      />
    </View>
  );
};

export default Register;

export function definePageConfig() {
  return {
    navigationBarTitleText: '注册',
    navigationStyle: 'custom',
  };
}
