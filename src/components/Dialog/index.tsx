/**
 * Dialog - 居中弹窗组件
 *
 * 通用居中模态弹窗，支持遮罩、关闭、自定义内容。
 * 可用于页面介绍、二次确认、通知等场景。
 */
import { View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';

export interface DialogProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调（点击遮罩时触发） */
  onClose?: () => void;
  /** 内容 */
  children: React.ReactNode;
  /** 是否允许点击遮罩关闭 */
  maskClosable?: boolean;
  className?: string;
}

const Dialog: React.FC<DialogProps> = ({
  visible,
  onClose,
  children,
  maskClosable = false,
  className,
}) => {
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!mounted) return null;

  const handleMaskClick = () => {
    if (maskClosable) onClose?.();
  };

  return (
    <View className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* 遮罩 */}
      <View
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        style={{ opacity: animating ? 1 : 0 }}
        onClick={handleMaskClick}
      />
      {/* 内容 */}
      <View
        className={className}
        style={{
          opacity: animating ? 1 : 0,
          transform: animating ? 'scale(1)' : 'scale(0.95)',
          transition: 'opacity 200ms ease, transform 200ms ease',
        }}
      >
        {children}
      </View>
    </View>
  );
};

export default Dialog;
