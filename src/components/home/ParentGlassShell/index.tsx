import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

export interface ParentGlassShellProps {
  /** scroll-into-view / 锚点 id */
  sectionId?: string;
  title: string;
  /** 右侧操作区（如「去续费与查账」） */
  headerRight?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * 家长首页板块外壳
 * 外层白卡；内层小卡淡色磨砂点缀（标题不加 icon）
 */
const ParentGlassShell: React.FC<ParentGlassShellProps> = ({
  sectionId,
  title,
  headerRight,
  className,
  children,
}) => {
  return (
    <View id={sectionId} className={cn('parent-glass-shell mb-[28rpx]', className)}>
      <View className="relative z-10 mb-[20rpx] flex flex-row items-center justify-between">
        <View className="parent-section-title">
          <Text className="parent-section-title__label">{title}</Text>
        </View>
        {headerRight ? <View className="flex-shrink-0">{headerRight}</View> : null}
      </View>

      <View className="relative z-10">{children}</View>
    </View>
  );
};

export default ParentGlassShell;
