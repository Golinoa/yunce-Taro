import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

export interface SubscribePromptDialogProps {
  visible: boolean;
  title: string;
  body: string;
  primaryText: string;
  secondaryText: string;
  tertiaryText?: string;
  showTertiary?: boolean;
  loading?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onTertiary?: () => void;
}

const SubscribePromptDialog: React.FC<SubscribePromptDialogProps> = ({
  visible,
  title,
  body,
  primaryText,
  secondaryText,
  tertiaryText,
  showTertiary,
  loading = false,
  onPrimary,
  onSecondary,
  onTertiary,
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

  const hasTertiary = showTertiary && tertiaryText && onTertiary;

  return (
    <View className="fixed inset-0 z-200 flex items-center justify-center px-[48rpx]">
      <View
        className={cn(
          'absolute inset-0 transition-all duration-300',
          animating ? 'bg-black/45' : 'bg-transparent',
        )}
        onClick={loading ? undefined : onSecondary}
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
          {body}
        </Text>
        <View className="mt-[28rpx] flex gap-[16rpx]">
          <View
            className={cn(
              'flex-1 h-[84rpx] rounded-[16rpx] bg-muted flex items-center justify-center',
              loading ? 'opacity-60' : 'active:opacity-80',
            )}
            onClick={loading ? undefined : onSecondary}
          >
            <Text className="text-[28rpx] font-medium text-foreground-secondary">
              {secondaryText}
            </Text>
          </View>
          <View
            className={cn(
              'flex-1 h-[84rpx] rounded-[16rpx] bg-primary flex items-center justify-center',
              loading ? 'opacity-60' : 'active:opacity-90',
            )}
            onClick={loading ? undefined : onPrimary}
          >
            <Text className="text-[28rpx] font-semibold text-white">
              {loading ? '处理中...' : primaryText}
            </Text>
          </View>
        </View>
        {hasTertiary ? (
          <View
            className={cn(
              'mt-[16rpx] h-[72rpx] flex items-center justify-center',
              loading ? 'opacity-60' : 'active:opacity-80',
            )}
            onClick={loading ? undefined : onTertiary}
          >
            <Text className="text-[26rpx] font-medium text-primary">{tertiaryText}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default SubscribePromptDialog;
