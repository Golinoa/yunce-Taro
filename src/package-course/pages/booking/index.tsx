/**
 * 我的预约 — 仅展示与当前账号关联的试听预约
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { leadService } from '@/services';
import type { LeadBooking } from '@/types/lead';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';
import {
  filterLeadBookingsByScope,
  LEAD_BOOKING_STATUS_LABEL,
  sortLeadBookingsDesc,
} from '@/utils/trial-booking-scope';

const MyBookingsPage: React.FC = () => {
  const { profile } = useAuth();
  const userId = profile?.id || '';

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<LeadBooking[]>([]);

  const dateRange = useMemo(
    () => ({
      startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().add(60, 'day').format('YYYY-MM-DD'),
    }),
    [],
  );

  const loadBookings = useCallback(async () => {
    if (!userId) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const raw = await leadService.getLeadBookingsByTeacher(userId, dateRange);
      const mine = filterLeadBookingsByScope(raw, profile, undefined, 'mine');
      setBookings(sortLeadBookingsDesc(mine));
    } catch (err) {
      logError('my-bookings load', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, profile, userId]);

  useDidShow(() => {
    void loadBookings();
  });

  usePullDownRefresh(() => {
    void loadBookings().finally(() => Taro.stopPullDownRefresh());
  });

  const handleOpenDetail = useCallback((bookingId: string) => {
    Taro.navigateTo({
      url: `/package-lead/pages/lead-booking-detail/index?bookingId=${encodeURIComponent(bookingId)}`,
    });
  }, []);

  return (
    <PageContainer className="bg-muted">
      {loading ? (
        <View className="flex items-center justify-center py-[200rpx]">
          <Loading text="加载预约..." />
        </View>
      ) : bookings.length === 0 ? (
        <View className="py-[160rpx]">
          <Empty icon="mdi-inbox" description="暂无关联的预约记录" />
        </View>
      ) : (
        <ScrollView scrollY className="h-screen" showScrollbar={false}>
          <View className="flex flex-col gap-[16rpx] px-[24rpx] py-[24rpx] pb-safe-bar">
            {bookings.map((item) => (
              <View
                key={item.id}
                className="rounded-[16rpx] bg-card px-[24rpx] py-[22rpx] shadow-card active:opacity-90"
                onClick={() => handleOpenDetail(item.id)}
              >
                <View className="flex items-start gap-[16rpx]">
                  <Avatar name={item.child_name || '试'} size="md" fallback="initial" />
                  <View className="min-w-0 flex-1">
                    <View className="flex items-center justify-between gap-[12rpx]">
                      <Text className="truncate text-[30rpx] font-medium text-foreground">
                        {item.child_name || '试听学员'}
                      </Text>
                      <Text className="shrink-0 text-[22rpx] text-primary">
                        {LEAD_BOOKING_STATUS_LABEL[item.status]}
                      </Text>
                    </View>
                    <Text className="mt-[8rpx] block text-[26rpx] text-foreground">
                      {item.class_name || item.course_name}
                    </Text>
                    <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                      {dayjs(item.lesson_date).format('MM-DD')} {item.start_time}-{item.end_time}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </PageContainer>
  );
};

export default withRouteGuard(MyBookingsPage);
