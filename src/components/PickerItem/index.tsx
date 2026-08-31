import { View, Text } from '@tarojs/components';
import React from 'react';
import CircleCheckbox from '@/components/CircleCheckbox';
import StudentAvatar from '@/components/student/StudentAvatar';

/**
 * 选择器列表项 - 全局统一规格
 * 用于学员选择器、班级选择器等所有选择列表
 *
 * 尺寸规范：
 * - 头像/图标：68rpx（圆形头像 / 圆角图标）
 * - 主标题：text-base (16px)
 * - 副标题：text-sm (14px)
 * - 行高：py-3 px-4
 * - 间距：gap-3
 */

export type PickerItemRightType = 'checkbox' | 'check-icon' | 'tag' | 'change-btn' | 'none';

export interface PickerItemRightConfig {
  type: PickerItemRightType;
  /** checkbox 模式的选中状态 */
  checked?: boolean;
  /** checkbox 变更回调 */
  onCheckChange?: (checked: boolean) => void;
  /** tag 模式的标签文字 */
  tagText?: string;
  /** change-btn 模式的点击回调 */
  onChangeClick?: () => void;
}

interface PickerItemProps {
  /** 左侧图标类型：avatar 显示圆形头像，icon 显示圆角图标 */
  iconType?: 'avatar' | 'icon';
  /** 头像背景色（iconType=avatar 时使用） */
  avatarBgColor?: string;
  /** 头像图片URL（可选，不传则显示首字） */
  avatarUrl?: string;
  /** 头像首字（无图片时显示） */
  avatarChar?: string;
  /** 图标背景色（iconType=icon 时使用） */
  iconBgColor?: string;
  /** 图标名称（iconType=icon 时使用） */
  iconName?: string;
  /** 图标颜色（iconType=icon 时使用） */
  iconColor?: string;
  /** 主标题 */
  title: string;
  /** 主标题后缀 */
  titleExtra?: React.ReactNode;
  /** 副标题 */
  subtitle?: string;
  /** 右侧配置 */
  right?: PickerItemRightConfig;
  /** 是否选中态（整行高亮） */
  selected?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击回调 */
  onClick?: () => void;
}

const PickerItem: React.FC<PickerItemProps> = ({
  iconType = 'avatar',
  avatarUrl,
  avatarChar,
  iconBgColor = '#5EC8A820',
  iconName,
  iconColor = '#5EC8A8',
  title,
  titleExtra,
  subtitle,
  right,
  selected = false,
  disabled = false,
  onClick,
}) => {
  // 渲染左侧图标（学员头像统一走 StudentAvatar，与意向学员卡片一致）
  const renderIcon = () => {
    if (iconType === 'avatar') {
      return (
        <StudentAvatar name={avatarChar || title} src={avatarUrl} size="md" />
      );
    }
    // icon 模式
    return (
      <View
        className="w-[64rpx] h-[64rpx] rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconBgColor }}
      >
        <Text style={{ color: iconColor, fontSize: '28rpx' }}>{iconName || '📚'}</Text>
      </View>
    );
  };

  // 渲染右侧
  const renderRight = () => {
    if (!right) return null;
    switch (right.type) {
      case 'checkbox':
        return <CircleCheckbox checked={right.checked || false} onChange={right.onCheckChange} />;
      case 'check-icon':
        return right.checked ? <Text className="text-primary text-lg">✓</Text> : null;
      case 'tag':
        return (
          <View className="px-2 py-0_5 rounded-md bg-muted">
            <Text className="text-xs text-muted-foreground">{right.tagText}</Text>
          </View>
        );
      case 'change-btn':
        return (
          <View
            className="px-3 py-1 rounded-lg bg-primary/10 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation?.();
              right.onChangeClick?.();
            }}
          >
            <Text className="text-sm text-primary font-medium">更换</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View
      className={`flex items-center gap-3 py-2 px-4 rounded-2xl border-2 transition ${
        selected ? 'border-primary bg-primary/5' : 'border-transparent bg-transparent'
      } ${disabled ? 'state-disabled' : 'active:opacity-80'}`}
      onClick={disabled ? undefined : onClick}
    >
      {renderIcon()}
      <View className="flex-1 min-w-0">
        <View className="flex items-center gap-[8rpx] min-w-0">
          <Text className="text-[32rpx] font-semibold text-foreground truncate">{title}</Text>
          {titleExtra}
        </View>
        {subtitle ? (
          <Text className="text-[24rpx] text-muted-foreground block mt-[8rpx]">{subtitle}</Text>
        ) : null}
      </View>
      {renderRight()}
    </View>
  );
};

export default PickerItem;
