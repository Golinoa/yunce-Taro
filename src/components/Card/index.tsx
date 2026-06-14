import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

/**
 * Card - 统一卡片容器组件
 *
 * 封装全局统一的卡片样式（白色背景、圆角、阴影、内边距），
 * 减少各页面重复的 className 声明。
 */

export interface CardProps {
  /** 卡片内容 */
  children: React.ReactNode;
  /** 阴影变体：soft（默认柔和阴影）/ card（轻阴影）/ none（无阴影） */
  shadow?: 'soft' | 'card' | 'none';
  /** 内边距大小：md（默认 20rpx）/ lg（32rpx） */
  padding?: 'md' | 'lg';
  /** 底部间距（默认 mb-3） */
  marginBottom?: boolean;
  /** 是否可点击（添加 active 态反馈） */
  clickable?: boolean;
  /** 额外类名 */
  className?: string;
  /** 点击事件 */
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  shadow = 'soft',
  padding = 'md',
  marginBottom = true,
  clickable = false,
  className,
  onClick,
}) => {
  const shadowClass = {
    soft: 'shadow-soft',
    card: 'shadow-card',
    none: '',
  }[shadow];

  const paddingClass = {
    md: 'p-5',
    lg: 'p-8',
  }[padding];

  return (
    <View
      className={cn(
        'bg-white rounded-[32rpx]',
        shadowClass,
        paddingClass,
        marginBottom && 'mb-3',
        clickable && 'press-bg',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </View>
  );
};

export default Card;
