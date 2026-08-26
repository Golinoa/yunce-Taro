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
  confirmText = '同意协议并继续',
}) => {
  const handleAgreement = () => {
    Taro.navigateTo({ url: '/package-settings/pages/agreement/index?type=user' });
  };

  const handlePrivacy = () => {
    Taro.navigateTo({ url: '/package-settings/pages/agreement/index?type=privacy' });
  };

  return (
    <BottomSheet
      visible={visible}
      title="服务协议及隐私保护"
      onClose={onClose}
      maxHeight="72vh"
      scrollable={false}
    >
      <View className="px-[40rpx] pt-[12rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))]">
        <Text className="text-[28rpx] text-foreground leading-relaxed block mb-[32rpx]">
          尊敬的用户，为了更好地保障您的合法权益，让您正常使用松果排课服务，我们需要依照相关法律法规收集并使用您的身份信息、联系方式等。
        </Text>
        <Text className="text-[28rpx] text-foreground leading-relaxed block mb-[48rpx]">
          松果排课将严格保护您的个人信息，确保您的信息安全。请您务必审慎阅读并充分理解
          <Text className="text-primary" onClick={handleAgreement}>
            《用户协议》
          </Text>
          和
          <Text className="text-primary" onClick={handlePrivacy}>
            《隐私政策》
          </Text>
          后进行操作。
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
