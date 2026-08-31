/**
 * BindEmailSheet - 绑定邮箱（邮箱验证码 + 登录密码）
 * 发码：POST /auth/email-code purpose=BIND
 * 绑定：POST /auth/wechat-bind { email, code, password }
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 20;

export interface BindEmailSheetProps {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  /** 发送绑定验证码 */
  onSendCode: (
    email: string,
  ) => Promise<{ error: { message: string } | null; maskedEmail?: string }>;
  onSubmit: (payload: { email: string; code: string; password: string }) => void | Promise<void>;
}

const BindEmailSheet: React.FC<BindEmailSheetProps> = ({
  visible,
  submitting = false,
  onClose,
  onSendCode,
  onSubmit,
}) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [maskedHint, setMaskedHint] = useState('');
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      setEmail('');
      setCode('');
      setPassword('');
      setConfirmPassword('');
      setSending(false);
      setCountdown(0);
      setMaskedHint('');
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }
  }, [visible]);

  useEffect(
    () => () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    },
    [],
  );

  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setCountdown(60);
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
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmed)) {
      Taro.showToast({ title: '请输入正确的邮箱', icon: 'none' });
      return;
    }
    setSending(true);
    try {
      const result = await onSendCode(trimmed);
      if (result.error) {
        Taro.showToast({ title: result.error.message || '验证码发送失败', icon: 'none' });
        return;
      }
      startCountdown();
      const hint = result.maskedEmail || trimmed;
      setMaskedHint(hint);
      Taro.showToast({
        title: `验证码已发送至${hint}`,
        icon: 'none',
      });
    } finally {
      setSending(false);
    }
  }, [countdown, email, onSendCode, sending, startCountdown]);

  const handleSubmit = useCallback(() => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmed)) {
      Taro.showToast({ title: '请输入正确的邮箱', icon: 'none' });
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      Taro.showToast({ title: '请输入 6 位验证码', icon: 'none' });
      return;
    }
    if (
      !password ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      Taro.showToast({
        title: `密码长度应为 ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} 位`,
        icon: 'none',
      });
      return;
    }
    if (password !== confirmPassword) {
      Taro.showToast({ title: '两次密码不一致', icon: 'none' });
      return;
    }
    void onSubmit({ email: trimmed, code: code.trim(), password });
  }, [code, confirmPassword, email, onSubmit, password]);

  return (
    <BottomSheet
      visible={visible}
      title="绑定邮箱"
      onClose={onClose}
      height="auto"
      maxHeightLimit="85vh"
      keyboardAware
      scrollable
    >
      <View className="flex flex-col gap-[24rpx] px-[8rpx] pb-[16rpx]">
        <Text className="text-[26rpx] leading-relaxed text-muted-foreground">
          绑定后可用邮箱登录与找回密码。请先获取邮箱验证码，再设置登录密码。
        </Text>
        <FormInput
          label="邮箱"
          type="text"
          placeholder="请输入邮箱"
          value={email}
          onInput={(e) => setEmail(e.detail.value)}
          required
        />
        <View>
          <FormInput
            label="验证码"
            type="number"
            maxlength={6}
            placeholder="请输入验证码"
            value={code}
            onInput={(e) => setCode(e.detail.value)}
            required
          />
          <View className="mt-[12rpx] flex items-center justify-between">
            <Text className="text-[22rpx] text-muted-foreground">
              {maskedHint ? `已发送至 ${maskedHint}` : '验证码 5 分钟内有效'}
            </Text>
            <Text
              className={cn(
                'text-[26rpx] font-semibold',
                countdown > 0 || sending ? 'text-muted-foreground' : 'text-primary',
              )}
              onClick={countdown > 0 || sending ? undefined : () => void handleSendCode()}
            >
              {sending ? '发送中' : countdown > 0 ? `${countdown}s` : '发送验证码'}
            </Text>
          </View>
        </View>
        <FormInput
          label="登录密码"
          password
          placeholder={`${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} 位密码`}
          value={password}
          onInput={(e) => setPassword(e.detail.value)}
          maxlength={MAX_PASSWORD_LENGTH}
          required
        />
        <FormInput
          label="确认密码"
          password
          placeholder="再次输入密码"
          value={confirmPassword}
          onInput={(e) => setConfirmPassword(e.detail.value)}
          maxlength={MAX_PASSWORD_LENGTH}
          required
        />
        <View
          className={cn(
            'mt-[8rpx] center h-[96rpx] rounded-[28rpx] bg-gradient-primary active:opacity-90',
            submitting && 'opacity-60',
          )}
          onClick={submitting ? undefined : handleSubmit}
        >
          <Text className="text-[32rpx] font-bold text-white">
            {submitting ? '绑定中...' : '确认绑定'}
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default BindEmailSheet;
