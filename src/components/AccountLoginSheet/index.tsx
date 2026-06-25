/**
 * AccountLoginSheet - 账号密码登录底部弹窗
 * 仅收集账号密码，协议确认由登录页统一在点击登录后弹出
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import {
  ACCOUNT_MAX_LENGTH,
  ACCOUNT_RULE_TEXT,
  isAccountFormatValid,
  sanitizeAccountInput,
} from '@/utils/account';

export interface AccountLoginSheetProps {
  visible: boolean;
  onClose: () => void;
  onLogin: (username: string, password: string) => void;
  submitting?: boolean;
  initialUsername?: string;
  initialPassword?: string;
}

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 20;

const AccountLoginSheet: React.FC<AccountLoginSheetProps> = ({
  visible,
  onClose,
  onLogin,
  submitting = false,
  initialUsername = '',
  initialPassword = '',
}) => {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState(initialPassword);

  // 弹窗打开时应用初始值
  React.useEffect(() => {
    if (visible) {
      setUsername(initialUsername);
      setPassword(initialPassword);
    }
  }, [visible, initialUsername, initialPassword]);

  const isUsernameValid = useCallback((value: string) => {
    return isAccountFormatValid(value);
  }, []);

  const isPasswordValid = useCallback((value: string) => {
    return value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH;
  }, []);

  const canSubmit = isUsernameValid(username.trim()) && isPasswordValid(password.trim());

  const handleSubmit = useCallback(() => {
    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      Taro.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }
    if (!isUsernameValid(u)) {
      Taro.showToast({ title: `账号仅支持${ACCOUNT_RULE_TEXT}`, icon: 'none' });
      return;
    }
    if (!isPasswordValid(p)) {
      Taro.showToast({ title: `密码长度应为${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH}位`, icon: 'none' });
      return;
    }

    onLogin(u, p);
  }, [username, password, onLogin, isUsernameValid, isPasswordValid]);

  return (
    <BottomSheet visible={visible} title="账号密码登录" onClose={onClose} maxHeight="72vh" scrollable={false}>
      <View className="px-[40rpx] pt-[12rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))]">
        <FormInput
          label="账号"
          placeholder="请输入账号"
          value={username}
          onInput={(e) => setUsername(sanitizeAccountInput(e.detail.value))}
          maxlength={ACCOUNT_MAX_LENGTH}
          hint={`仅支持${ACCOUNT_RULE_TEXT}`}
          className="mb-[24rpx]"
        />

        <FormInput
          label="密码"
          placeholder="请输入密码"
          value={password}
          onInput={(e) => setPassword(e.detail.value)}
          password
          className="mb-[32rpx]"
        />

        {/* 登录按钮 */}
        <View
          className={cn(
            'h-[96rpx] rounded-full flex items-center justify-center',
            'bg-primary active:opacity-90 transition-opacity shadow-login-btn',
            (submitting || !canSubmit) && 'opacity-50',
          )}
          onClick={handleSubmit}
        >
          <Text className="text-[34rpx] font-semibold text-white">
            {submitting ? '登录中...' : '登录'}
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default AccountLoginSheet;
