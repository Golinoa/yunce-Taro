/**
 * Modal - 通用居中弹框组件
 *
 * 支持自定义内容、标题、关闭按钮，用于替代底部弹窗的居中弹框场景。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

export interface ModalProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
  /** 是否点击遮罩关闭，默认 true */
  maskClosable?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  visible,
  title,
  onClose,
  children,
  className,
  maskClosable = true,
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
        onClick={maskClosable ? onClose : undefined}
        catchMove
      />
      <View
        className={cn(
          'relative flex flex-col w-full max-w-[600rpx] max-h-[80vh] rounded-[28rpx] bg-white shadow-card overflow-hidden transition-all duration-300 ease-in-out',
          animating ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
          className,
        )}
        onTransitionEnd={handleTransitionEnd}
      >
        {title ? (
          <View className="flex items-center justify-between border-b border-border px-[32rpx] py-[28rpx]">
            <Text className="text-[32rpx] font-semibold text-foreground">{title}</Text>
            <View
              className="flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full active:bg-muted"
              onClick={onClose}
            >
              <Icon name="mdi-close" size={28} className="text-muted-foreground" />
            </View>
          </View>
        ) : null}

        {!title ? (
          <View
            className="absolute right-[16rpx] top-[16rpx] z-10 flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full active:bg-muted"
            onClick={onClose}
          >
            <Icon name="mdi-close" size={28} className="text-muted-foreground" />
          </View>
        ) : null}

        {children}
      </View>
    </View>
  );
};

export default Modal;
