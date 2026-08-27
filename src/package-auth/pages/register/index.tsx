/**
 * 注册 Step1：创建账号 - 支付宝风格
 * 点击注册后检查协议同意状态，未同意则弹出协议确认 BottomSheet
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import AgreementDialog from '@/components/AgreementDialog';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import { BRAND_NAME_ZH } from '@/constants/brand';
import { authCapabilities } from '@/services/auth';
import { useAgreementStore } from '@/stores/agreement';
import {
  ACCOUNT_MAX_LENGTH,
  ACCOUNT_RULE_TEXT,
  isAccountFormatValid,
  sanitizeAccountInput,
} from '@/utils/account';
import { useAuth } from '@/utils/auth';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const MIN_PASSWORD_LENGTH = 6;

const RegisterStep1: React.FC = () => {
  const { signUpStep1 } = useAuth();
  const { setAgreed } = useAgreementStore();
  const navHeight = useNavSafeHeight();

  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAgreementSheet, setShowAgreementSheet] = useState(false);
  const usesMockRegister = authCapabilities.usesMockRegister;

  const validate = useCallback(() => {
    if (!usesMockRegister) {
      const normalizedPhone = phone.trim();
      if (!normalizedPhone) {
        Taro.showToast({ title: '请输入手机号', icon: 'none' });
        return false;
      }
      if (!/^1[3-9]\d{9}$/.test(normalizedPhone)) {
        Taro.showToast({ title: '请输入正确的手机号', icon: 'none' });
        return false;
      }
      return true;
    }

    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (!normalizedUsername) {
      Taro.showToast({ title: '请输入账号', icon: 'none' });
      return false;
    }
    if (!isAccountFormatValid(normalizedUsername)) {
      Taro.showToast({ title: `账号仅支持${ACCOUNT_RULE_TEXT}`, icon: 'none' });
      return false;
    }
    if (!normalizedPassword) {
      Taro.showToast({ title: '请输入密码', icon: 'none' });
      return false;
    }
    if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
      Taro.showToast({ title: `密码至少${MIN_PASSWORD_LENGTH}位`, icon: 'none' });
      return false;
    }
    return true;
  }, [usesMockRegister, phone, username, password]);

  const handleUsernameInput = useCallback((value: string) => {
    // 注册账号只允许安全白名单字符，输入阶段直接过滤掉汉字、空格和特殊符号。
    setUsername(sanitizeAccountInput(value));
  }, []);

  const executeRegister = useCallback(async () => {
    if (submitting) return;

    setSubmitting(true);
    const { error } = usesMockRegister
      ? await signUpStep1({ username: username.trim(), password: password.trim() })
      : await signUpStep1({ phone: phone.trim() });
    setSubmitting(false);
    setShowAgreementSheet(false);

    if (error) {
      Taro.showToast({ title: error.message || '注册失败', icon: 'none' });
      return;
    }

    Taro.navigateTo({ url: '/package-auth/pages/register/role-select' });
  }, [submitting, usesMockRegister, username, password, phone, signUpStep1]);

  const handleRegisterClick = useCallback(() => {
    if (!validate()) return;
    setShowAgreementSheet(true);
  }, [validate]);

  const handleConfirmAgreement = useCallback(() => {
    setAgreed(true);
    setShowAgreementSheet(false);
    executeRegister();
  }, [setAgreed, executeRegister]);

  const handleBackToLogin = useCallback(() => {
    Taro.navigateBack();
  }, []);

  return (
    <View className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* 顶部装饰背景：覆盖状态栏，统一颜色 */}
      <View className="absolute top-0 left-0 right-0 h-[520rpx] overflow-hidden bg-register-deco">
        <View className="absolute w-[400rpx] h-[400rpx] rounded-full bg-register-circle -top-[120rpx] -right-[120rpx]" />
      </View>

      {/* 导航安全区占位 */}
      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      {/* 顶部 IP：回到登录页同样的视觉位置 */}
      <View className="relative z-10 flex flex-col items-center justify-start pt-[88rpx]">
        <View className="absolute w-[420rpx] h-[420rpx] rounded-full bg-login-glow" />
        <View className="relative w-[220rpx] h-[220rpx] rounded-full bg-login-orb flex items-center justify-center mt-[14rpx]">
          <Icon name="school" size={120} className="text-primary" />
        </View>
      </View>

      {/* 欢迎语与注册表单：整体下压，并拉开欢迎语与输入框间距 */}
      <View className="relative z-10 px-[48rpx] pt-[80rpx]">
        <View className="mb-[120rpx] flex items-center justify-center">
          <Text className="text-[40rpx] font-semibold text-foreground text-center">
            你好，欢迎注册{BRAND_NAME_ZH}
          </Text>
        </View>
        <FormInput
          variant="capsule"
          placeholder={usesMockRegister ? '请输入账号（字母/数字/下划线）' : '请输入手机号'}
          value={usesMockRegister ? username : phone}
          onInput={(e) =>
            usesMockRegister
              ? handleUsernameInput(e.detail.value)
              : setPhone(e.detail.value.replace(/\D/g, '').slice(0, 11))
          }
          maxlength={usesMockRegister ? ACCOUNT_MAX_LENGTH : 11}
          hint={usesMockRegister ? `仅支持${ACCOUNT_RULE_TEXT}` : '手机号将作为登录账号'}
          className="mb-[24rpx]"
        />

        {usesMockRegister ? (
          <FormInput
            variant="capsule"
            placeholder="设置6位以上密码"
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
            password
            className="mb-[48rpx]"
          />
        ) : (
          <View className="mb-[48rpx]" />
        )}

        {/* 立即注册按钮 */}
        <View
          className={cn(
            'h-[96rpx] rounded-full flex items-center justify-center mb-[28rpx]',
            'bg-primary active:opacity-90 transition-opacity shadow-login-btn',
            (submitting ||
              (usesMockRegister ? !username.trim() || !password.trim() : !phone.trim())) &&
              'opacity-50',
          )}
          onClick={handleRegisterClick}
        >
          <Text className="text-[34rpx] font-semibold text-white">
            {submitting ? '注册中...' : '立即注册'}
          </Text>
        </View>
      </View>

      <View className="flex-1" />

      {/* 底部 */}
      <View className="relative z-10 px-[48rpx] pb-[calc(48rpx+env(safe-area-inset-bottom))]">
        <View className="flex items-center justify-center">
          <Text className="text-[28rpx] text-primary" onClick={handleBackToLogin}>
            已有账号？去登录
          </Text>
        </View>
      </View>

      {/* 协议确认弹框 */}
      <AgreementDialog
        visible={showAgreementSheet}
        onClose={() => setShowAgreementSheet(false)}
        onConfirm={handleConfirmAgreement}
        confirmText="同意协议并注册新账号"
      />
    </View>
  );
};

export default RegisterStep1;
