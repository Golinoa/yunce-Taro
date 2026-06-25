/**
 * ProfileHeader - 个人中心顶部用户信息卡片
 *
 * 用于"我的"页面顶部，展示头像、昵称、身份标签、机构名称，
 * 并提供设置/扫码等快捷操作入口。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';

export interface ProfileHeaderProps {
  /** 用户头像 URL */
  avatarUrl?: string;
  /** 用户昵称 */
  name: string;
  /** 身份标签文本，如"教师"/"家长" */
  role: string;
  /** 机构/校区名称 */
  orgName?: string;
  /** 设置按钮点击 */
  onSettings?: () => void;
  /** 扫码按钮点击 */
  onScan?: () => void;
  /** 额外类名 */
  className?: string;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  avatarUrl,
  name,
  role,
  orgName,
  onSettings,
  onScan,
  className,
}) => {
  return (
    <View
      className={cn(
        'mx-[32rpx] mt-[24rpx] mb-[24rpx] px-[32rpx] py-[36rpx] rounded-[32rpx] bg-white shadow-soft',
        className,
      )}
    >
      <View className="flex items-center gap-[24rpx]">
        <Avatar name={name} avatarUrl={avatarUrl} size="lg" />
        <View className="flex-1 min-w-0">
          <Text className="text-[40rpx] font-bold text-foreground truncate block">{name}</Text>
          <View className="flex items-center gap-[12rpx] mt-[10rpx]">
            <View className="px-[16rpx] py-[4rpx] rounded-[20rpx] bg-primary-10">
              <Text className="text-[22rpx] font-medium text-primary">{role}</Text>
            </View>
            {orgName && (
              <Text className="text-[24rpx] text-muted-foreground truncate">{orgName}</Text>
            )}
          </View>
        </View>
        <View className="flex items-center gap-[16rpx]">
          {onScan && (
            <View
              className="w-[56rpx] h-[56rpx] rounded-full bg-muted flex items-center justify-center active:bg-primary-10"
              onClick={onScan}
            >
              <Icon name="mdi-qrcode-scan" size="sm" color="foregroundSecondary" />
            </View>
          )}
          {onSettings && (
            <View
              className="w-[56rpx] h-[56rpx] rounded-full bg-muted flex items-center justify-center active:bg-primary-10"
              onClick={onSettings}
            >
              <Icon name="mdi-cog" size="sm" color="foregroundSecondary" />
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default ProfileHeader;
