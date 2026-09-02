/**
 * 课表页 · 场地 Tab 列表（Q2-1）
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import Empty from '@/components/Empty';
import VenueBookingCard from '@/components/schedule/VenueBookingCard';
import type { BookableVenue } from '@/types/venue-booking';

export type ScheduleVenueTabProps = {
  loadingVenues: boolean;
  venues: BookableVenue[];
};

const ScheduleVenueTab: React.FC<ScheduleVenueTabProps> = ({ loadingVenues, venues }) => {
  if (loadingVenues) {
    return (
      <View className="py-[120rpx] flex items-center justify-center">
        <Text className="text-[28rpx] text-muted-foreground">场地加载中...</Text>
      </View>
    );
  }

  if (venues.length === 0) {
    return (
      <View className="px-[24rpx]">
        <View className="rounded-[16rpx] bg-card py-[80rpx] shadow-card">
          <Empty icon="mdi-map-marker-outline" description="暂无可用场地" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex flex-col gap-[14rpx] px-[24rpx] pb-[160rpx] pt-[12rpx]">
      {venues.map((venue) => (
        <VenueBookingCard
          key={venue.id}
          venue={venue}
          onClick={() => {
            Taro.navigateTo({
              url: `/package-course/pages/venue-booking/index?roomId=${encodeURIComponent(venue.id)}`,
            });
          }}
          onBook={() => {
            Taro.navigateTo({
              url: `/package-course/pages/venue-booking/index?roomId=${encodeURIComponent(venue.id)}`,
            });
          }}
        />
      ))}
    </View>
  );
};

export default ScheduleVenueTab;
