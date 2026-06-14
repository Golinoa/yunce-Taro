import { View, Text } from '@tarojs/components';
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ActionButtonProps {
  text: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** 是否固定在底部，默认 true */
  fixed?: boolean;
  onClick?: () => void;
}

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string }> = {
  primary: { bg: 'bg-gradient-primary', text: 'text-primary-foreground' },
  secondary: { bg: 'bg-secondary', text: 'text-secondary-foreground' },
  danger: { bg: 'bg-destructive', text: 'text-destructive-foreground' },
  ghost: { bg: 'bg-transparent border-2 border-primary', text: 'text-primary' },
};

const ActionButton: React.FC<ActionButtonProps> = ({
  text,
  variant = 'primary',
  disabled = false,
  fixed = true,
  onClick,
}) => {
  const vs = VARIANT_STYLES[variant];

  const buttonContent = (
    <View
      className={`w-full btn-primary ${vs.bg} ${disabled ? 'state-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      <Text className={`text-base font-medium ${vs.text}`}>{text}</Text>
    </View>
  );

  if (fixed) {
    return (
      <View className="fixed bottom-0 left-0 right-0 z-100 bg-white/95 backdrop-blur-sm border-t border-border">
        <View className="px-page-padding pt-3 pb-safe-bar">{buttonContent}</View>
      </View>
    );
  }

  // 非固定模式：跟随页面内容流
  return <View className="px-page-padding py-4 pb-safe-bar">{buttonContent}</View>;
};

export default ActionButton;
