/**
 * WechatBindDialog - 可选绑定手机号并设置密码（无短信）
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PhoneInput, {
  isPhoneValidForDialCode,
  type CountryDialOption,
} from '@/package-auth/components/PhoneInput';

export interface WechatBindDialogProps {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  /** 稍后提醒（关闭并静默一段时间） */
  onLater?: () => void;
  onSubmit: (payload: { phone: string; password: string }) => void;
}

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 20;

const WechatBindDialog: React.FC<WechatBindDialogProps> = ({
  visible,
  submitting = false,
  onClose,
  onLater,
  onSubmit,
}) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dialCode, setDialCode] = useState('+86');

  useEffect(() => {
    if (!visible) {
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setDialCode('+86');
    }
  }, [visible]);

  const isPhoneValid = isPhoneValidForDialCode(phone, dialCode);

  const handleCountryChange = useCallback((option: CountryDialOption) => {
    setDialCode(option.dialCode);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmedPhone = phone.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!isPhoneValid) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!trimmedPassword) {
      Taro.showToast({ title: '请设置登录密码', icon: 'none' });
      return;
    }
    if (
      trimmedPassword.length < MIN_PASSWORD_LENGTH ||
      trimmedPassword.length > MAX_PASSWORD_LENGTH
    ) {
      Taro.showToast({
        title: `密码长度应为${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH}位`,
        icon: 'none',
      });
      return;
    }
    if (trimmedPassword !== trimmedConfirm) {
      Taro.showToast({ title: '两次输入的密码不一致', icon: 'none' });
      return;
    }

    onSubmit({
      phone: trimmedPhone,
      password: trimmedPassword,
    });
  }, [confirmPassword, isPhoneValid, onSubmit, password, phone]);

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
            绑定手机号
          </Text>
          <Text className="text-[26rpx] text-muted-foreground text-center block leading-[1.6] mt-[16rpx]">
            建议绑定，便于找回账号；无需短信验证，可随时跳过
          </Text>
        </View>

        <ScrollView scrollY className="max-h-[52vh]">
          <View className="px-[40rpx] pb-[24rpx]">
            <PhoneInput
              label="手机号"
              placeholder="请输入手机号"
              value={phone}
              onInput={(e) => setPhone(e.detail.value.replace(/\D/g, '').slice(0, 11))}
              onCountryChange={handleCountryChange}
              maxlength={11}
              adjustPosition={false}
              className="mb-[20rpx]"
            />

            <FormInput
              label="设置密码"
              placeholder="请设置登录密码"
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
              password
              hint={`${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH}位，后续可用手机号登录`}
              className="mb-[20rpx]"
            />

            <FormInput
              label="确认密码"
              placeholder="请再次输入密码"
              value={confirmPassword}
              onInput={(e) => setConfirmPassword(e.detail.value)}
              password
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
            onClick={handleSubmit}
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

export default WechatBindDialog;
