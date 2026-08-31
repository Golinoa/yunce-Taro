/**
 * AgreementDialog - 协议确认居中弹框
 * 支持登录小弹框与注册大弹框两种样式，避免不同业务场景互相干扰
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useEffect, useState, useRef } from 'react';

export interface AgreementDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'login-compact' | 'default';
}

const AgreementDialog: React.FC<AgreementDialogProps> = ({
  visible,
  onClose,
  onConfirm,
  confirmText = '同意并继续',
  cancelText = '不同意',
  variant = 'default',
}) => {
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      rafRef.current = requestAnimationFrame(() => {
        setAnimating(true);
      });
    } else {
      setAnimating(false);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [visible]);

  const handleTransitionEnd = () => {
    if (!animating) {
      setMounted(false);
    }
  };

  const handleAgreement = () => {
    Taro.navigateTo({ url: '/package-settings/pages/agreement/index?type=user' });
  };

  const isCompact = variant === 'login-compact';

  if (!mounted) return null;

  return (
    <View className="fixed inset-0 z-200 flex items-center justify-center">
      <View
        className={cn(
          'absolute inset-0 transition-all duration-300',
          animating ? 'bg-black/44' : 'bg-transparent',
        )}
        onClick={onClose}
        catchMove
      />
      <View
        className={cn(
          'relative max-w-[86vw] rounded-[32rpx] bg-white transition-all duration-300 ease-in-out',
          isCompact ? 'w-[520rpx] px-[28rpx] py-[28rpx]' : 'w-[600rpx] p-[40rpx]',
          animating ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        )}
        onTransitionEnd={handleTransitionEnd}
      >
        <Text
          className={cn(
            'font-semibold text-foreground text-center block',
            isCompact ? 'text-[28rpx] mb-[16rpx]' : 'text-[36rpx] mb-[32rpx]',
          )}
        >
          用户协议
        </Text>

        {isCompact ? (
          <>
            <Text className="text-[24rpx] leading-[1.6] text-foreground-secondary text-center block mb-[28rpx]">
              请阅读并同意
              <Text className="text-primary" onClick={handleAgreement}>
                《用户协议》
              </Text>
            </Text>

            <View className="flex flex-row gap-[16rpx]">
              <View
                className="flex-1 h-[64rpx] rounded-[16rpx] bg-fill-secondary flex items-center justify-center active:opacity-80 transition-opacity"
                onClick={onClose}
              >
                <Text className="text-[26rpx] text-foreground">{cancelText}</Text>
              </View>
              <View
                className="flex-1 h-[64rpx] rounded-[16rpx] bg-primary flex items-center justify-center active:opacity-90 transition-opacity"
                onClick={onConfirm}
              >
                <Text className="text-[26rpx] font-medium text-white">{confirmText}</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text className="text-[28rpx] text-foreground leading-relaxed text-center block mb-[48rpx]">
              请阅读并同意
              <Text className="text-primary" onClick={handleAgreement}>
                《用户协议》
              </Text>
              后继续
            </Text>

            <View
              className="h-[96rpx] rounded-full flex items-center justify-center bg-primary active:opacity-90 transition-opacity shadow-login-btn mb-[24rpx]"
              onClick={onConfirm}
            >
              <Text className="text-[34rpx] font-semibold text-white">{confirmText}</Text>
            </View>

            <View
              className="h-[96rpx] rounded-full flex items-center justify-center border-[2rpx] border-solid border-border bg-background active:opacity-80 transition-opacity"
              onClick={onClose}
            >
              <Text className="text-[34rpx] font-semibold text-foreground">{cancelText}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

export default AgreementDialog;
