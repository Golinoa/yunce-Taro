/**
 * BindEmailSheet - 绑定邮箱（邮箱验证码 + 登录密码）
 * 视觉对齐 WechatBindDialog：居中弹窗 + 稍后提醒，非底部 Sheet。
 * 发码：POST /auth/email-code purpose=BIND
 * 绑定：POST /auth/wechat-bind { email, code, password }
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import { EMAIL_PATTERN } from '@/constants/email-auth';
import { useEmailOtpSend } from '@/utils/use-email-otp-send';

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 20;

export interface BindEmailSheetProps {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  /** 稍后提醒（关闭并静默一段时间）；未传则等同 onClose */
  onLater?: () => void;
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
  onLater,
  onSendCode,
  onSubmit,
}) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [maskedHint, setMaskedHint] = useState('');

  const sendBindCode = useCallback(
    async (addr: string) => {
      const result = await onSendCode(addr);
      if (!result.error && result.maskedEmail) {
        setMaskedHint(result.maskedEmail);
      }
      return result;
    },
    [onSendCode],
  );

  const { sendLabel, sendDisabled, handleSend, clearCountdown } = useEmailOtpSend(sendBindCode);

  useEffect(() => {
    if (!visible) {
      setEmail('');
      setCode('');
      setPassword('');
      setConfirmPassword('');
      setMaskedHint('');
      clearCountdown();
    }
  }, [clearCountdown, visible]);

  const handleSendCode = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmed)) {
      Taro.showToast({ title: '请输入正确的邮箱', icon: 'none' });
      return;
    }
    await handleSend(trimmed);
  }, [email, handleSend]);

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

  if (!visible) return null;

  return (
    <View className="fixed inset-0 z-200 flex items-center justify-center">
      <View
        className="absolute inset-0 bg-black/45"
        catchMove
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <View className="relative mx-[48rpx] w-[640rpx] max-h-[82vh] rounded-[24rpx] bg-white overflow-hidden shadow-elegant">
        <View className="relative px-[40rpx] pt-[40rpx] pb-[16rpx]">
          <View
            className={cn(
              'absolute right-[16rpx] top-[16rpx] p-[12rpx] active:opacity-70',
              submitting && 'opacity-40 pointer-events-none',
            )}
            onClick={() => {
              if (!submitting) onClose();
            }}
          >
            <Icon name="mdi-close" size="md" color="muted" />
          </View>
          <Text className="text-[34rpx] font-semibold text-foreground text-center block">
            绑定邮箱
          </Text>
          <Text className="text-[26rpx] text-muted-foreground text-center block leading-[1.6] mt-[16rpx]">
            建议绑定，便于登录与找回账号；先获取验证码，再设置密码，可随时跳过
          </Text>
        </View>

        <ScrollView scrollY className="max-h-[52vh]">
          <View className="px-[40rpx] pb-[24rpx]">
            <FormInput
              label="邮箱"
              type="text"
              placeholder="请输入邮箱"
              value={email}
              onInput={(e) => setEmail(e.detail.value)}
              className="mb-[20rpx]"
            />
            <View className="mb-[20rpx]">
              <FormInput
                label="验证码"
                type="number"
                maxlength={6}
                placeholder="请输入验证码"
                value={code}
                onInput={(e) => setCode(e.detail.value)}
              />
              <View className="mt-[12rpx] flex items-center justify-between">
                <Text className="text-[22rpx] text-muted-foreground">
                  {maskedHint ? `已发送至 ${maskedHint}` : '验证码 5 分钟内有效'}
                </Text>
                <Text
                  className={cn(
                    'text-[26rpx] font-semibold',
                    sendDisabled ? 'text-muted-foreground' : 'text-primary',
                  )}
                  onClick={sendDisabled ? undefined : () => void handleSendCode()}
                >
                  {sendLabel}
                </Text>
              </View>
            </View>
            <FormInput
              label="设置密码"
              password
              placeholder="请设置登录密码"
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
              maxlength={MAX_PASSWORD_LENGTH}
              hint={`${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH}位，后续可用邮箱登录`}
              className="mb-[20rpx]"
            />
            <FormInput
              label="确认密码"
              password
              placeholder="请再次输入密码"
              value={confirmPassword}
              onInput={(e) => setConfirmPassword(e.detail.value)}
              maxlength={MAX_PASSWORD_LENGTH}
            />
          </View>
        </ScrollView>

        <View className="px-[40rpx] pb-[40rpx] pt-[8rpx]">
          <View
            className={cn(
              'h-[88rpx] rounded-full flex items-center justify-center',
              'bg-primary active:opacity-90',
              submitting && 'opacity-50',
            )}
            onClick={submitting ? undefined : handleSubmit}
          >
            <Text className="text-[32rpx] font-semibold text-white">
              {submitting ? '提交中…' : '确认绑定'}
            </Text>
          </View>
          <View
            className={cn(
              'h-[72rpx] mt-[12rpx] rounded-full flex items-center justify-center active:opacity-70',
              submitting && 'opacity-40 pointer-events-none',
            )}
            onClick={() => {
              if (submitting) return;
              if (onLater) onLater();
              else onClose();
            }}
          >
            <Text className="text-[28rpx] text-muted-foreground">稍后提醒</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default BindEmailSheet;
