/**
 * AgreementSheet - 协议确认底部弹窗
 * 登录/注册前统一使用，一次同意后本次会话不再弹出
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';

export interface AgreementSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmText?: string;
}

const AgreementSheet: React.FC<AgreementSheetProps> = ({
  visible,
  onClose,
  onConfirm,
  confirmText = '同意并继续',
}) => {
  const handleAgreement = () => {
    Taro.navigateTo({ url: '/package-settings/pages/agreement/index?type=user' });
  };

  return (
    <BottomSheet
      visible={visible}
      title="用户协议"
      onClose={onClose}
      maxHeight="72vh"
      scrollable={false}
    >
      <View className="px-[40rpx] pt-[12rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))]">
        <Text className="text-[28rpx] text-foreground leading-relaxed text-center block mb-[48rpx]">
          请阅读并同意
          <Text className="text-primary" onClick={handleAgreement}>
            《用户协议》
          </Text>
          后继续
        </Text>

        <View
          className={cn(
            'h-[96rpx] rounded-full flex items-center justify-center mb-[24rpx]',
            'bg-primary active:opacity-90 transition-opacity shadow-login-btn',
          )}
          onClick={onConfirm}
        >
          <Text className="text-[34rpx] font-semibold text-white">{confirmText}</Text>
        </View>

        <View
          className="h-[96rpx] rounded-full flex items-center justify-center border-[2rpx] border-solid border-border bg-background active:opacity-80 transition-opacity"
          onClick={onClose}
        >
          <Text className="text-[34rpx] font-semibold text-foreground">不同意</Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default AgreementSheet;
