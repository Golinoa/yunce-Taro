/**
 * ProfileHeader - 个人中心顶部用户信息卡片
 *
 * 支持两种视觉变体：
 * - default: 白色圆角卡片，用于传统布局
 * - gradient: 沉浸式橙色头部，头像 + 名称 + 手机号/机构 + 我的资料
 */
import { View, Text, Image } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';

// 默认 Mock 头像，当用户未上传头像时使用
// 上线前请替换为业务自己的默认头像图片或本地资源
const DEFAULT_AVATAR_URL = 'https://api.dicebear.com/7.x/avataaars/png?seed=teacher&radius=50';

export type ProfileHeaderVariant = 'default' | 'gradient';

export interface ProfileHeaderProps {
  /** 用户头像 URL */
  avatarUrl?: string;
  /** 用户昵称 */
  name: string;
  /** 身份标签文本，如"教师"/"家长" */
  role?: string;
  /** 手机号 */
  phone?: string;
  /** 机构/校区名称 */
  orgName?: string;
  /** 设置按钮点击（gradient 下作为"我的资料"入口） */
  onSettings?: () => void;
  /** 扫码按钮点击 */
  onScan?: () => void;
  /** 视觉变体 */
  variant?: ProfileHeaderVariant;
  /** 额外类名 */
  className?: string;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  avatarUrl,
  name,
  role,
  phone,
  orgName,
  onSettings,
  onScan,
  variant = 'default',
  className,
}) => {
  if (variant === 'gradient') {
    return (
      <View
        className={cn(
          'relative overflow-hidden bg-profile-orange px-page-padding pt-nav-safe pb-[380rpx] rounded-b-48rpx',
          className,
        )}
      >
        {/* 用户信息：头像 + 名称 + 手机号/机构 + 我的资料 */}
        <View className="absolute bottom-[120rpx] left-0 right-0 px-page-padding flex items-center gap-[24rpx]">
          {/* 头像：白色圆形底 + 灰色外边框，头像缩小后自然留出白色内边 */}
          <View className="relative flex-shrink-0 w-[96rpx] h-[96rpx] rounded-full border-[4rpx] border-solid border-profile-avatar-outer bg-white flex items-center justify-center overflow-hidden">
            <Image
              src={avatarUrl || DEFAULT_AVATAR_URL}
              mode="aspectFill"
              className="w-[80rpx] h-[80rpx] rounded-full flex-shrink-0"
            />
          </View>

          <View className="flex-1 min-w-0">
            <Text className="text-[34rpx] font-bold text-white/95 truncate block">{name}</Text>
            {phone && (
              <Text className="mt-[8rpx] text-[26rpx] font-semibold text-white/75 truncate block">
                {phone}
              </Text>
            )}
            {!phone && orgName && (
              <Text className="mt-[8rpx] text-[26rpx] font-semibold text-white/75 truncate block">
                {orgName}
              </Text>
            )}
          </View>

          <View
            className="flex items-center gap-[4rpx] active:opacity-70 flex-shrink-0"
            onClick={onSettings}
          >
            <Text className="text-[26rpx] text-white/95">我的资料</Text>
            <Icon name="mdi-chevron-right" size="xs" color="white" />
          </View>
        </View>
      </View>
    );
  }

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
            {role && (
              <View className="px-[16rpx] py-[4rpx] rounded-[20rpx] bg-primary-10">
                <Text className="text-[22rpx] font-medium text-primary">{role}</Text>
              </View>
            )}
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
