/**
 * VenueBookingCard - 场地预约卡片
 *
 * 用于课表页「场地」Tab 展示可预约场地。
 * 参考设计图：横向信息卡片，顶部名称 + 预约按钮 + 状态，
 * 中部实时占用进度条，底部在场会员头像与人数统计。
 */
import { View, Text, Image } from '@tarojs/components';
import cn from 'classnames';
import React, { useMemo } from 'react';
import Icon from '@/components/Icon';
import { BRAND_LOGO } from '@/constants/brand';
import type { BookableVenue } from '@/types/venue-booking';

export interface VenueBookingCardProps {
  /** 场地数据 */
  venue: BookableVenue;
  /** 卡片点击回调（整个卡片） */
  onClick?: (venue: BookableVenue) => void;
  /** 预约按钮点击回调 */
  onBook?: (venue: BookableVenue) => void;
  /** 额外类名 */
  className?: string;
}

/** 在场会员头像最多展示数量 */
const MAX_VISIBLE_AVATARS = 5;

const VenueBookingCard: React.FC<VenueBookingCardProps> = ({
  venue,
  onClick,
  onBook,
  className,
}) => {
  const timeRangeText = useMemo(() => {
    return `${venue.openTimeStart || '09:00'}-${venue.openTimeEnd || '22:00'}`;
  }, [venue.openTimeEnd, venue.openTimeStart]);

  const capacity = venue.capacity || 0;
  const currentCount = venue.currentCount || 0;
  const todayEntryCount = venue.todayEntryCount || 0;
  const occupancyRate = useMemo(() => {
    if (capacity <= 0) return 0;
    return Math.min(currentCount / capacity, 1);
  }, [currentCount, capacity]);

  const isFree = useMemo(() => (venue.pricePerSession || 0) <= 0, [venue.pricePerSession]);

  const statusText = useMemo(() => {
    if (currentCount <= 0) return { label: '空闲', color: 'text-success' };
    if (currentCount >= capacity) return { label: '已满', color: 'text-error' };
    return { label: '使用中', color: 'text-warning' };
  }, [currentCount, capacity]);

  const visibleAvatars = useMemo(() => {
    return (venue.memberAvatars || []).slice(0, MAX_VISIBLE_AVATARS);
  }, [venue.memberAvatars]);

  const remainingAvatarCount = useMemo(() => {
    return Math.max(0, (venue.memberAvatars || []).length - MAX_VISIBLE_AVATARS);
  }, [venue.memberAvatars]);

  const coverImage = venue.photos?.[0] || BRAND_LOGO;

  return (
    <View
      className={cn(
        'relative overflow-hidden rounded-[24rpx] bg-card px-[24rpx] py-[24rpx] shadow-card active:opacity-90',
        className,
      )}
      onClick={() => onClick?.(venue)}
    >
      <View className="flex gap-[20rpx]">
        {/* 左上角：场地图片，默认使用门店 Logo */}
        <Image
          src={coverImage}
          className="h-[140rpx] w-[140rpx] flex-shrink-0 rounded-[18rpx] bg-muted"
          mode="aspectFill"
        />

        {/* 右侧：分级信息 */}
        <View className="min-w-0 flex-1 flex flex-col justify-between">
          {/* 一级：名称 + 预约按钮 */}
          <View className="flex items-start justify-between gap-[12rpx]">
            <Text className="truncate text-[34rpx] font-bold leading-tight text-foreground">
              {venue.name}
            </Text>
            <View
              className="flex h-[56rpx] flex-shrink-0 items-center justify-center rounded-full bg-schedule-attend px-[28rpx] active:opacity-80"
              onClick={(event) => {
                event.stopPropagation();
                onBook?.(venue);
              }}
            >
              <Text className="text-[26rpx] font-semibold text-primary-foreground">预约</Text>
            </View>
          </View>

          {/* 二级：开放时间 + 价格 + 状态 */}
          <View className="mt-[8rpx] flex flex-wrap items-center gap-x-[16rpx] gap-y-[6rpx]">
            <Text className="text-[24rpx] text-muted-foreground">开放 {timeRangeText}</Text>
            {!isFree ? (
              <Text className="text-[24rpx] font-medium text-schedule-header">
                ¥{venue.pricePerSession}/小时
              </Text>
            ) : (
              <Text className="text-[24rpx] font-medium text-success">免费</Text>
            )}
            <Text className={cn('text-[24rpx] font-medium', statusText.color)}>
              {statusText.label}
            </Text>
          </View>

          {/* 三级：占用进度条 + 人数 */}
          <View className="mt-[12rpx] flex items-center gap-[16rpx]">
            <View className="h-[10rpx] flex-1 overflow-hidden rounded-full bg-muted">
              <View
                className="h-full rounded-full bg-schedule-attend transition-all duration-300"
                style={{ width: `${occupancyRate * 100}%` }}
              />
            </View>
            <Text className="flex-shrink-0 text-[24rpx] text-muted-foreground">
              <Text className="text-[28rpx] font-bold text-foreground">{currentCount}</Text>/
              {capacity}人
            </Text>
          </View>
        </View>
      </View>

      {/* 底部：在场会员头像 + 今日入场 */}
      <View className="mt-[20rpx] flex items-center justify-between">
        <View className="flex flex-1 items-center min-w-0">
          {visibleAvatars.length === 0 ? (
            <View className="flex items-center gap-[12rpx]">
              <View className="flex h-[52rpx] w-[52rpx] items-center justify-center rounded-full border border-border bg-background">
                <Icon name="mdi-plus" size={26} color="mutedForeground" />
              </View>
              <Text className="text-[24rpx] text-muted-foreground">暂无在场会员</Text>
            </View>
          ) : (
            <View className="flex items-center">
              {visibleAvatars.map((avatar, index) => (
                <Image
                  key={`${avatar}-${index}`}
                  src={avatar || BRAND_LOGO}
                  className={cn(
                    'relative h-[52rpx] w-[52rpx] flex-shrink-0 rounded-full border-2 border-card bg-muted',
                    index > 0 && '-ml-[16rpx]',
                  )}
                  mode="aspectFill"
                  lazyLoad
                />
              ))}
              {remainingAvatarCount > 0 ? (
                <View className="relative -ml-[16rpx] flex h-[52rpx] w-[52rpx] flex-shrink-0 items-center justify-center rounded-full border-2 border-card bg-muted">
                  <Text className="text-[20rpx] font-medium text-muted-foreground">
                    +{remainingAvatarCount}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <Text className="ml-[24rpx] flex-shrink-0 text-[22rpx] text-muted-foreground">
          今日入场 {todayEntryCount}人
        </Text>
      </View>
    </View>
  );
};

export default VenueBookingCard;
