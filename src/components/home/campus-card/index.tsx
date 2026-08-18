/**
 * HomeCampusCard - 首页校区切换卡片
 *
 * 用于教师端/家长端首页顶部，展示当前校区信息、营业状态、地址和营业时间，
 * 点击后打开校区切换 Sheet。
 */
import { View, Text, Image } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import type { CampusUIModel } from '@/types/campus';

export interface HomeCampusCardProps {
  /** 当前校区 */
  campus: CampusUIModel | null;
  /** 营业时间（已格式化，如 08:00-22:00） */
  businessTime: string;
  /** 是否营业中 */
  isOpen: boolean;
  /** 点击卡片回调 */
  onClick: () => void;
  /** 卡片额外类名（如阴影样式） */
  className?: string;
}

const HomeCampusCard: React.FC<HomeCampusCardProps> = ({
  campus,
  businessTime,
  isOpen,
  onClick,
  className,
}) => {
  return (
    <View
      className={cn(
        'bg-white/92 backdrop-blur-md rounded-[32rpx] p-[24rpx] press-scale',
        className,
      )}
      onClick={onClick}
    >
      <View className="flex items-center gap-[20rpx]">
        {/* 校区 Logo */}
        <View
          className="w-[88rpx] h-[88rpx] rounded-[20rpx] center overflow-hidden shrink-0"
          style={{
            background: campus?.iconGradient || 'linear-gradient(135deg, #5EC8A8, #4AB893)',
          }}
        >
          {campus?.logo ? (
            <Image src={campus.logo} className="w-full h-full" mode="aspectFill" />
          ) : (
            <Text className="text-[40rpx]">{campus?.icon || '🏢'}</Text>
          )}
        </View>

        {/* 校区信息 */}
        <View className="flex-1 min-w-0">
          <View className="flex items-center gap-[12rpx] mb-[6rpx]">
            <Text className="text-[32rpx] font-bold text-foreground truncate">
              {campus?.name || '未设置校区'}
            </Text>
            <View
              className={cn(
                'flex items-center gap-[6rpx] px-[12rpx] py-[2rpx] rounded-[8rpx]',
                isOpen ? 'bg-success-bg' : 'bg-muted',
              )}
            >
              <View
                className={cn(
                  'w-[12rpx] h-[12rpx] rounded-full',
                  isOpen ? 'bg-success' : 'bg-muted-foreground',
                )}
              />
              <Text
                className={cn(
                  'text-[22rpx] font-medium',
                  isOpen ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {isOpen ? '营业中' : '休息中'}
              </Text>
            </View>
          </View>
          <View className="flex items-center gap-[4rpx]">
            <Icon name="mdi-map-marker-outline" size="xxs" color="mutedForeground" />
            <Text className="text-[22rpx] text-muted-foreground truncate max-w-[240rpx]">
              {campus?.address || '暂无地址'}
            </Text>
          </View>
        </View>

        {/* 切换按钮 */}
        <View className="flex flex-col items-end gap-[4rpx] shrink-0">
          <View className="flex items-center gap-[2rpx]">
            <Text className="text-[26rpx] font-semibold text-foreground">切换校区</Text>
            <Icon name="mdi-chevron-down" size="xs" color="foreground" />
          </View>
          {businessTime && (
            <Text className="text-[26rpx] text-muted-foreground">· {businessTime}</Text>
          )}
        </View>
      </View>
    </View>
  );
};

export default HomeCampusCard;
