/**
 * 找回密码 — 对齐登录页视觉：邮箱验证码重置密码
 */
import { View, Text, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BRAND_LOGO } from '@/constants/brand';
import { preparePasswordReset, resetPasswordByEmailCode } from '@/services/auth';
import { isUseMock } from '@/utils/build-env';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const MIN_PASSWORD_LENGTH = 6;
const CODE_COUNTDOWN_SEC = 60;
const DEMO_CODE_HINT = '演示环境验证码为 123456';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordPage: React.FC = () => {
  const navHeight = useNavSafeHeight();

  const [email, setEmail] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleSendCode = useCallback(async () => {
    if (sending || countdown > 0) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Taro.showToast({ title: '请输入邮箱', icon: 'none' });
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      Taro.showToast({ title: '请输入正确的邮箱地址', icon: 'none' });
      return;
    }

    setSending(true);
    const result = await preparePasswordReset(trimmedEmail);
    setSending(false);

    if (result.error || result.status !== 'ready' || !result.account) {
      Taro.showToast({ title: result.error?.message || '验证码发送失败', icon: 'none' });
      return;
    }

    setResolvedEmail(result.account);
    setResetSuccess(false);
    startCountdown();
    Taro.showToast({
      title: isUseMock()
        ? DEMO_CODE_HINT
        : `验证码已发送至${result.maskedEmail || result.email || ''}`,
      icon: 'none',
      duration: 2500,
    });
  }, [countdown, email, sending, startCountdown]);

  const handleResetPassword = useCallback(async () => {
    if (submitting) return;
    const targetEmail = (resolvedEmail || email).trim();
    if (!targetEmail) {
      Taro.showToast({ title: '请输入邮箱', icon: 'none' });
      return;
    }
    if (!EMAIL_PATTERN.test(targetEmail)) {
      Taro.showToast({ title: '请输入正确的邮箱地址', icon: 'none' });
      return;
    }
    if (!code.trim()) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }
    if (code.trim().length < 4) {
      Taro.showToast({ title: '请输入正确的验证码', icon: 'none' });
      return;
    }
    if (!newPassword.trim()) {
      Taro.showToast({ title: '请输入新密码', icon: 'none' });
      return;
    }
    if (newPassword.trim().length < MIN_PASSWORD_LENGTH) {
      Taro.showToast({ title: `密码至少${MIN_PASSWORD_LENGTH}位`, icon: 'none' });
      return;
    }
    if (newPassword !== confirmPassword) {
      Taro.showToast({ title: '两次输入的密码不一致', icon: 'none' });
      return;
    }

    setSubmitting(true);
    const result = await resetPasswordByEmailCode(targetEmail, code.trim(), newPassword.trim());
    setSubmitting(false);

    if (result.error) {
      Taro.showToast({ title: result.error.message || '重置失败', icon: 'none' });
      return;
    }

    setResetSuccess(true);
  }, [code, confirmPassword, email, newPassword, resolvedEmail, submitting]);

  const handleBackToLogin = useCallback(() => {
    Taro.navigateBack({
      fail: () => {
        Taro.redirectTo({ url: '/package-auth/pages/login/index' });
      },
    });
  }, []);

  return (
    <View className="min-h-screen flex flex-col relative overflow-hidden bg-login-page">
      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      <View className="relative z-10 h-[240rpx] flex items-end justify-center px-[56rpx] pb-[28rpx]">
        <View className="rotate-login-slogan">
          <View className="flex flex-row items-start gap-[16rpx]">
            <Text className="text-[56rpx] font-bold text-primary tracking-[4rpx] leading-[1.08]">
              智能教务
            </Text>
            <View className="relative w-[64rpx] h-[64rpx] mt-[-4rpx] flex-shrink-0">
              <View className="absolute left-[8rpx] bottom-[-4rpx] w-[20rpx] h-[20rpx] bg-login-bubble rounded-[4rpx_0_16rpx_0] rotate-[28deg]" />
              <View className="relative z-10 w-[64rpx] h-[64rpx] rounded-full bg-login-bubble flex items-center justify-center shadow-[0_12rpx_32rpx_rgba(59,110,245,0.28)]">
                <Image
                  src={BRAND_LOGO}
                  mode="aspectFill"
                  className="w-[42rpx] h-[42rpx] rounded-full bg-white"
                />
              </View>
            </View>
          </View>
          <Text className="mt-[10rpx] ml-[64rpx] text-[56rpx] font-bold text-primary tracking-[4rpx] leading-[1.08] block">
            尽在松果
          </Text>
        </View>
      </View>

      <View className="relative z-10 flex-1 flex flex-col px-[56rpx] pt-[40rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))] shadow-login-sheet bg-white rounded-t-[72rpx]">
        <Text className="mb-[12rpx] text-[32rpx] font-semibold text-foreground">找回密码</Text>
        <Text className="mb-[32rpx] text-[24rpx] leading-[36rpx] text-muted-foreground">
          输入绑定邮箱接收验证码，验证通过后即可重置密码
        </Text>

        {resetSuccess ? (
          <>
            <Text className="mb-[12rpx] text-[30rpx] font-semibold text-foreground">密码已重置</Text>
            <Text className="mb-[40rpx] text-[24rpx] leading-[36rpx] text-muted-foreground">
              新密码已生效，请返回登录页使用新密码登录
            </Text>
            <View
              className="h-[88rpx] rounded-[28rpx] flex items-center justify-center bg-primary active:opacity-90"
              onClick={handleBackToLogin}
            >
              <Text className="text-[30rpx] font-semibold text-white">返回登录</Text>
            </View>
          </>
        ) : (
          <>
            <View className="h-[96rpx] rounded-full bg-login-field flex flex-row items-center px-[44rpx] mb-[28rpx]">
              <Input
                className="flex-1 text-[32rpx] font-semibold text-foreground"
                type="text"
                placeholder="请输入绑定邮箱"
                placeholderClass="text-muted-foreground font-normal"
                value={email}
                maxlength={64}
                onInput={(e) => setEmail(e.detail.value.trim())}
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
                  countdown > 0 || sending ? 'text-muted-foreground' : 'text-primary',
                )}
                onClick={() => {
                  void handleSendCode();
                }}
              >
                {sending ? '发送中' : countdown > 0 ? `${countdown}s` : '发送验证码'}
              </Text>
            </View>

            <View className="h-[96rpx] rounded-full bg-login-field flex flex-row items-center px-[44rpx] mb-[28rpx]">
              <Input
                className="flex-1 text-[32rpx] font-semibold text-foreground"
                password
                placeholder="请输入新密码"
                placeholderClass="text-muted-foreground font-normal"
                value={newPassword}
                maxlength={20}
                onInput={(e) => setNewPassword(e.detail.value)}
              />
            </View>

            <View className="h-[96rpx] rounded-full bg-login-field flex flex-row items-center px-[44rpx] mb-[40rpx]">
              <Input
                className="flex-1 text-[32rpx] font-semibold text-foreground"
                password
                placeholder="请再次输入新密码"
                placeholderClass="text-muted-foreground font-normal"
                value={confirmPassword}
                maxlength={20}
                onInput={(e) => setConfirmPassword(e.detail.value)}
              />
            </View>

            <View
              className={cn(
                'h-[88rpx] rounded-[28rpx] flex items-center justify-center bg-primary active:opacity-90',
                submitting && 'opacity-60',
              )}
              onClick={() => {
                void handleResetPassword();
              }}
            >
              <Text className="text-[30rpx] font-semibold text-white">
                {submitting ? '重置中...' : '重置密码'}
              </Text>
            </View>

            <View className="mt-[56rpx] flex flex-row items-center justify-center">
              <Text
                className="text-[28rpx] text-muted-foreground font-medium"
                onClick={handleBackToLogin}
              >
                返回登录
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

export default ForgotPasswordPage;
