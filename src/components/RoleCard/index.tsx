/**
 * RoleCard 角色选择卡片
 * 用于注册流程选择身份、角色切换 Sheet/页面中的身份项
 * 支持 radio 单选态与 default 展示态
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import type { UserRole } from '@/types/profile';

export interface RoleCardProps {
  /** 角色类型 */
  role: UserRole;
  /** 卡片标题 */
  title: string;
  /** 卡片描述 */
  description: string;
  /** 是否被选中（radio 模式） */
  selected?: boolean;
  /** 是否为当前激活身份 */
  active?: boolean;
  /** 模式：radio 显示右侧圆圈勾选，default 不显示 */
  mode?: 'radio' | 'default';
  /** 点击回调 */
  onClick?: () => void;
  /** 自定义类名 */
  className?: string;
}

const ROLE_META: Record<
  UserRole,
  {
    icon: string;
    colorClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  principal: {
    icon: 'crown',
    colorClass: 'text-principal',
    bgClass: 'bg-principal-10',
    borderClass: 'border-principal',
  },
  teacher: {
    icon: 'book-open',
    colorClass: 'text-teacher',
    bgClass: 'bg-teacher-10',
    borderClass: 'border-teacher',
  },
  parent: {
    icon: 'account-group',
    colorClass: 'text-parent',
    bgClass: 'bg-parent-10',
    borderClass: 'border-parent',
  },
};

const ROLE_LABEL: Record<UserRole, string> = {
  principal: '校长',
  teacher: '教师',
  parent: '家长',
};

const RoleCard: React.FC<RoleCardProps> = ({
  role,
  title,
  description,
  selected = false,
  active = false,
  mode = 'default',
  onClick,
  className,
}) => {
  const meta = ROLE_META[role];
  const isSelected = selected || active;

  return (
    <View
      className={cn(
        'flex items-center p-[24rpx] rounded-2xl bg-card border-2 transition-all duration-200',
        isSelected ? ['border-primary', 'shadow-soft'] : 'border-transparent',
        onClick ? 'active:scale-[0.99]' : '',
        className,
      )}
      onClick={onClick}
    >
      {/* 图标区 */}
      <View
        className={cn(
          'w-[88rpx] h-[88rpx] rounded-2xl flex items-center justify-center mr-[24rpx]',
          meta.bgClass,
        )}
      >
        <Icon name={meta.icon} size={44} className={meta.colorClass} />
      </View>

      {/* 文案区 */}
      <View className="flex-1">
        <Text className="text-[30rpx] font-semibold text-foreground block leading-tight">
          {title}
        </Text>
        <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] block leading-normal">
          {description}
        </Text>
      </View>

      {/* 右侧选中态 */}
      {mode === 'radio' && (
        <View
          className={cn(
            'w-[44rpx] h-[44rpx] rounded-full border-2 flex items-center justify-center ml-[16rpx]',
            isSelected ? ['bg-primary', 'border-primary'] : 'border-border bg-transparent',
          )}
        >
          {isSelected && <Icon name="check" size={24} className="text-white" />}
        </View>
      )}

      {/* default 模式下当前身份显示角标 */}
      {mode === 'default' && active && (
        <View
          className={cn(
            'px-[16rpx] py-[6rpx] rounded-full text-[22rpx] font-medium ml-[16rpx]',
            meta.bgClass,
            meta.colorClass,
          )}
        >
          当前
        </View>
      )}
    </View>
  );
};

export { ROLE_LABEL };
export default RoleCard;
