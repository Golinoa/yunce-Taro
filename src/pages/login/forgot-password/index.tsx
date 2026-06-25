import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import { ACCOUNT_RULE_TEXT, isAccountFormatValid, sanitizeAccountInput } from '@/utils/account';
import {
  preparePasswordReset,
  resetPasswordByEmailCode,
} from '@/services/auth';

const MIN_PASSWORD_LENGTH = 6;
const DEMO_CODE_HINT = '演示环境验证码为 123456';

const ForgotPasswordPage: React.FC = () => {
  const [account, setAccount] = useState('');
  const [resolvedAccount, setResolvedAccount] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSendCode = useCallback(async () => {
    const trimmedAccount = account.trim();
    if (!trimmedAccount) {
      Taro.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    if (!isAccountFormatValid(trimmedAccount)) {
      Taro.showToast({ title: `账号仅支持${ACCOUNT_RULE_TEXT}`, icon: 'none' });
      return;
    }

    setSending(true);
    const result = await preparePasswordReset(trimmedAccount);
    setSending(false);

    if (result.error || result.status !== 'ready' || !result.account) {
      Taro.showToast({ title: result.error?.message || '验证码发送失败', icon: 'none' });
      return;
    }

    setResolvedAccount(result.account);
    setMaskedEmail(result.maskedEmail || '');
    setResetSuccess(false);
    Taro.showToast({
      title: `验证码已发送至${result.maskedEmail || result.email || ''}`,
      icon: 'none',
    });
  }, [account]);

  const handleResetPassword = useCallback(async () => {
    const targetAccount = resolvedAccount || account.trim();
    if (!targetAccount) {
      Taro.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    if (!code.trim()) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' });
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
    const result = await resetPasswordByEmailCode(targetAccount, code.trim(), newPassword.trim());
    setSubmitting(false);

    if (result.error) {
      Taro.showToast({ title: result.error.message || '重置失败', icon: 'none' });
      return;
    }

    setResetSuccess(true);
  }, [account, code, confirmPassword, newPassword, resolvedAccount]);

  const handleBackToLogin = useCallback(() => {
    Taro.navigateBack();
  }, []);

  return (
    <View className="min-h-screen bg-background px-[32rpx] py-[32rpx]">
      <View className="rounded-[32rpx] bg-white px-[32rpx] py-[36rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)] mb-[24rpx]">
        <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary/10 flex items-center justify-center mb-[24rpx]">
          <Icon name="lock" size={52} className="text-primary" />
        </View>
        <Text className="text-[36rpx] font-semibold text-foreground block mb-[10rpx]">
          忘记密码
        </Text>
        <Text className="text-[24rpx] leading-[1.7] text-muted-foreground block">
          输入账号并通过绑定邮箱接收验证码，验证通过后即可重置密码。
        </Text>
      </View>

      <View className="rounded-[32rpx] bg-white px-[32rpx] py-[32rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)]">
        <FormInput
          label="账号"
          placeholder="请输入登录账号"
          value={account}
          onInput={(e) => setAccount(sanitizeAccountInput(e.detail.value))}
          maxlength={16}
          hint={`仅支持${ACCOUNT_RULE_TEXT}`}
          className="mb-[24rpx]"
        />

        <View
          className="h-[88rpx] rounded-full flex items-center justify-center bg-primary/8 active:opacity-80 mb-[24rpx]"
          onClick={handleSendCode}
        >
          <Text className="text-[30rpx] font-semibold text-primary">
            {sending ? '发送中...' : '获取验证码'}
          </Text>
        </View>

        <FormInput
          label="邮箱验证码"
          placeholder="请输入邮箱验证码"
          value={code}
          onInput={(e) => setCode(e.detail.value)}
          type="number"
          maxlength={6}
          hint={maskedEmail ? `验证码已发送至 ${maskedEmail}，${DEMO_CODE_HINT}` : DEMO_CODE_HINT}
          className="mb-[24rpx]"
        />

        <FormInput
          label="新密码"
          placeholder="请输入新密码"
          value={newPassword}
          onInput={(e) => setNewPassword(e.detail.value)}
          password
          className="mb-[24rpx]"
        />

        <FormInput
          label="确认新密码"
          placeholder="请再次输入新密码"
          value={confirmPassword}
          onInput={(e) => setConfirmPassword(e.detail.value)}
          password
          className="mb-[32rpx]"
        />

        <View
          className="h-[96rpx] rounded-full flex items-center justify-center bg-primary active:opacity-90 shadow-login-btn"
          onClick={handleResetPassword}
        >
          <Text className="text-[32rpx] font-semibold text-white">
            {submitting ? '重置中...' : '验证邮箱并重置密码'}
          </Text>
        </View>
      </View>

      {resetSuccess ? (
        <View className="rounded-[32rpx] bg-white px-[32rpx] py-[32rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)] mt-[24rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground block mb-[12rpx]">
            密码已重置
          </Text>
          <Text className="text-[24rpx] text-muted-foreground block mb-[20rpx]">
            新密码已经生效，请返回登录页使用新密码登录。
          </Text>
          <View
            className="h-[88rpx] rounded-full flex items-center justify-center bg-primary/8 active:opacity-80"
            onClick={handleBackToLogin}
          >
            <Text className="text-[30rpx] font-semibold text-primary">返回登录</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default ForgotPasswordPage;
