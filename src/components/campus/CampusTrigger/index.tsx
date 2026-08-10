/**
 * CampusTrigger - 校区切换触发器
 *
 * 用于页面顶部导航栏或标题栏，显示当前校区名称并提供点击切换入口。
 * 支持紧凑模式（仅图标+名称）和常规模式（带背景圆角）。
 *
 * 使用方式：
 *   <CampusTrigger
 *     currentCampus={currentCampus}
 *     onClick={handleOpenSwitcher}
 *     size="md"
 *   />
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useMemo, useCallback } from 'react';
import Icon from '@/components/Icon';
import type { CampusUIModel } from '@/types/campus';

export interface CampusTriggerProps {
  /** 当前校区对象或名称 */
  currentCampus?: CampusUIModel | string | null;
  /** 点击回调（通常用于打开 CampusSwitcher） */
  onClick?: () => void;
  /** 尺寸 */
  size?: 'sm' | 'md';
  /** 是否禁用点击 */
  disabled?: boolean;
  /** 是否显示下拉箭头（默认 true） */
  showArrow?: boolean;
  /** 占位文本（未选中校区时显示） */
  placeholder?: string;
  /** 额外类名 */
  className?: string;
}

const CampusTrigger: React.FC<CampusTriggerProps> = ({
  currentCampus,
  onClick,
  size = 'md',
  disabled = false,
  showArrow = true,
  placeholder = '选择校区',
  className,
}) => {
  const { name, icon, iconGradient } = useMemo(() => {
    if (!currentCampus) {
      return { name: placeholder, icon: undefined, iconGradient: undefined };
    }
    if (typeof currentCampus === 'string') {
      return { name: currentCampus, icon: undefined, iconGradient: undefined };
    }
    return {
      name: currentCampus.name,
      icon: currentCampus.icon,
      iconGradient: currentCampus.iconGradient,
    };
  }, [currentCampus, placeholder]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    onClick?.();
  }, [disabled, onClick]);

  const isSm = size === 'sm';

  return (
    <View
      className={cn(
        'flex flex-row items-center rounded-full press-bg',
        isSm
          ? 'gap-[8rpx] py-[6rpx] pr-[12rpx]'
          : 'gap-[12rpx] py-[10rpx] px-[20rpx] bg-white border border-border',
        disabled && 'opacity-60',
        className,
      )}
      onClick={handleClick}
    >
      {/* 校区图标：有对象时显示 emoji 图标，否则显示默认建筑图标 */}
      {icon ? (
        <View
          className={cn(
            'rounded-[12rpx] flex items-center justify-center flex-shrink-0',
            isSm ? 'w-[40rpx] h-[40rpx]' : 'w-[48rpx] h-[48rpx]',
          )}
          style={{ background: iconGradient }}
        >
          <Text className={cn('text-white', isSm ? 'text-[24rpx]' : 'text-[28rpx]')}>{icon}</Text>
        </View>
      ) : (
        <Icon
          name="mdi-office-building"
          size={isSm ? 28 : 32}
          color={disabled ? 'muted' : 'primary'}
        />
      )}

      {/* 校区名称 */}
      <Text
        className={cn(
          'font-medium truncate max-w-[240rpx]',
          isSm ? 'text-[26rpx]' : 'text-[28rpx]',
          disabled ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {name}
      </Text>

      {/* 下拉箭头 */}
      {showArrow && (
        <Icon
          name="mdi-chevron-down"
          size={isSm ? 24 : 28}
          color={disabled ? 'muted' : 'mutedForeground'}
        />
      )}
    </View>
  );
};

export default CampusTrigger;
