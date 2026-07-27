import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'primary' | 'warning' | 'danger';
  confirmLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const TONE_CLASS_MAP: Record<NonNullable<ConfirmDialogProps['tone']>, string> = {
  primary: 'bg-primary',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  tone = 'primary',
  confirmLoading = false,
  onClose,
  onConfirm,
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
      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
      };
    }

    setAnimating(false);
    return undefined;
  }, [visible]);

  const handleTransitionEnd = () => {
    if (!animating) {
      setMounted(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <View className="fixed inset-0 z-200 flex items-center justify-center px-[48rpx]">
      <View
        className={cn(
          'absolute inset-0 transition-all duration-300',
          animating ? 'bg-black/45' : 'bg-transparent',
        )}
        onClick={confirmLoading ? undefined : onClose}
        catchMove
      />
      <View
        className={cn(
          'relative w-full max-w-[620rpx] rounded-[28rpx] bg-white px-[32rpx] pb-[28rpx] pt-[32rpx] transition-all duration-300 ease-in-out shadow-card',
          animating ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        onTransitionEnd={handleTransitionEnd}
      >
        <Text className="block text-center text-[32rpx] font-semibold text-foreground">
          {title}
        </Text>
        <Text className="mt-[24rpx] block text-center text-[26rpx] leading-[42rpx] text-foreground-secondary">
          {description}
        </Text>
        <View className="mt-[28rpx] flex gap-[16rpx]">
          <View
            className={cn(
              'flex-1 h-[84rpx] rounded-[16rpx] bg-muted flex items-center justify-center',
              confirmLoading ? 'opacity-60' : 'active:opacity-80',
            )}
            onClick={confirmLoading ? undefined : onClose}
          >
            <Text className="text-[28rpx] font-medium text-foreground-secondary">{cancelText}</Text>
          </View>
          <View
            className={cn(
              'flex-1 h-[84rpx] rounded-[16rpx] flex items-center justify-center text-white',
              TONE_CLASS_MAP[tone],
              confirmLoading ? 'opacity-60' : 'active:opacity-90',
            )}
            onClick={confirmLoading ? undefined : onConfirm}
          >
            <Text className="text-[28rpx] font-semibold text-white">
              {confirmLoading ? '处理中...' : confirmText}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ConfirmDialog;
