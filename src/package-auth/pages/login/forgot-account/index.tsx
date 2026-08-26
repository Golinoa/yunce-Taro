import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import { prepareAccountRecovery, recoverAccountByEmailCode } from '@/services/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_CODE_HINT = '演示环境验证码为 123456';

const ForgotAccountPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [recoveredAccount, setRecoveredAccount] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSendCode = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Taro.showToast({ title: '请输入绑定邮箱', icon: 'none' });
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      Taro.showToast({ title: '请输入正确的邮箱地址', icon: 'none' });
      return;
    }

    setSending(true);
    const result = await prepareAccountRecovery(trimmedEmail);
    setSending(false);

    if (result.error || result.status !== 'ready' || !result.email) {
      Taro.showToast({ title: result.error?.message || '验证码发送失败', icon: 'none' });
      return;
    }

    setResolvedEmail(result.email);
    setMaskedEmail(result.maskedEmail || result.email);
    setRecoveredAccount('');
    Taro.showToast({
      title: `验证码已发送至${result.maskedEmail || result.email}`,
      icon: 'none',
    });
  }, [email]);

  const handleRecoverAccount = useCallback(async () => {
    if (!resolvedEmail) {
      Taro.showToast({ title: '请先获取验证码', icon: 'none' });
      return;
    }
    if (!code.trim()) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }

    setSubmitting(true);
    const result = await recoverAccountByEmailCode(resolvedEmail, code.trim());
    setSubmitting(false);

    if (result.error || !result.account) {
      Taro.showToast({ title: result.error?.message || '找回失败', icon: 'none' });
      return;
    }

    setRecoveredAccount(result.account);
  }, [code, resolvedEmail]);

  const handleBackToLogin = useCallback(() => {
    Taro.navigateBack();
  }, []);

  return (
    <View className="min-h-screen bg-background px-[32rpx] py-[32rpx]">
      <View className="rounded-[32rpx] bg-white px-[32rpx] py-[36rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)] mb-[24rpx]">
        <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary/10 flex items-center justify-center mb-[24rpx]">
          <Icon name="mdi-account-search" size={52} className="text-primary" />
        </View>
        <Text className="text-[36rpx] font-semibold text-foreground block mb-[10rpx]">
          忘记账号
        </Text>
        <Text className="text-[24rpx] leading-[1.7] text-muted-foreground block">
          使用已绑定邮箱完成身份验证，通过验证码找回账号。
        </Text>
      </View>

      <View className="rounded-[32rpx] bg-white px-[32rpx] py-[32rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)]">
        <FormInput
          label="绑定邮箱"
          placeholder="请输入已绑定的邮箱地址"
          value={email}
          onInput={(e) => setEmail(e.detail.value)}
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
          className="mb-[32rpx]"
        />

        <View
          className="h-[96rpx] rounded-full flex items-center justify-center bg-primary active:opacity-90 shadow-login-btn"
          onClick={handleRecoverAccount}
        >
          <Text className="text-[32rpx] font-semibold text-white">
            {submitting ? '验证中...' : '验证身份并找回账号'}
          </Text>
        </View>
      </View>

      {recoveredAccount ? (
        <View className="rounded-[32rpx] bg-white px-[32rpx] py-[32rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)] mt-[24rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground block mb-[12rpx]">
            已找回账号
          </Text>
          <Text className="text-[24rpx] text-muted-foreground block mb-[20rpx]">
            该绑定邮箱对应的账号如下，请返回登录页继续登录。
          </Text>
          <View className="rounded-[24rpx] bg-primary/6 px-[24rpx] py-[24rpx] mb-[24rpx]">
            <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">账号</Text>
            <Text className="text-[36rpx] font-semibold text-primary">{recoveredAccount}</Text>
          </View>
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

export default ForgotAccountPage;
