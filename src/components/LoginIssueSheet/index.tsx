import { View, Text } from '@tarojs/components';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';

export interface LoginIssueSheetProps {
  visible: boolean;
  onClose: () => void;
  onForgotAccount: () => void;
  onForgotPassword: () => void;
  onContactSupport: () => void;
}

const LoginIssueSheet: React.FC<LoginIssueSheetProps> = ({
  visible,
  onClose,
  onForgotAccount,
  onForgotPassword,
  onContactSupport,
}) => {
  const actions = [
    {
      key: 'forgot-account',
      label: '忘记账号',
      description: '通过绑定邮箱验证身份后找回账号',
      icon: 'account-search' as const,
      onClick: onForgotAccount,
    },
    {
      key: 'forgot-password',
      label: '忘记密码',
      description: '通过绑定邮箱接收验证码后重置密码',
      icon: 'lock' as const,
      onClick: onForgotPassword,
    },
    {
      key: 'contact-support',
      label: '联系客服',
      description: '扫码添加客服微信，对接维修与售后',
      icon: 'headset' as const,
      onClick: onContactSupport,
    },
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="遇到问题"
      maxHeight="58vh"
      scrollable={false}
    >
      <View className="px-[32rpx] pt-[12rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))] bg-white">
        {actions.map((item) => (
          <View
            key={item.key}
            className="flex flex-row items-center justify-between rounded-[28rpx] bg-primary/5 px-[24rpx] py-[24rpx] mb-[20rpx] active:opacity-80"
            onClick={item.onClick}
          >
            <View className="flex flex-row items-center flex-1 min-w-0">
              <View className="w-[72rpx] h-[72rpx] rounded-full bg-white flex items-center justify-center mr-[20rpx] flex-shrink-0">
                <Icon name={item.icon} size={36} className="text-primary" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[30rpx] font-semibold text-foreground block mb-[6rpx]">
                  {item.label}
                </Text>
                <Text className="text-[24rpx] text-muted-foreground block leading-[1.5]">
                  {item.description}
                </Text>
              </View>
            </View>
            <Icon name="mdi-chevron-right" size={28} className="text-muted-foreground ml-[12rpx]" />
          </View>
        ))}
      </View>
    </BottomSheet>
  );
};

export default LoginIssueSheet;
