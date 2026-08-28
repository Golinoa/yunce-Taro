/**
 * 试听记录 — 机构端按权限查看试听预约历史
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { leadService } from '@/services';
import { useCampusStore } from '@/stores/campus';
import type { LeadBooking, LeadBookingStatus } from '@/types/lead';
import { isPrincipalOrAbove, isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';
import {
  filterLeadBookingsByScope,
  LEAD_BOOKING_STATUS_LABEL,
  loadMockCampusLeadBookings,
  sortLeadBookingsDesc,
} from '@/utils/trial-booking-scope';
import { isUseMock } from '@/utils/build-env';

type StatusTab = 'all' | LeadBookingStatus;

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'confirmed', label: '已预约' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
];

const TrialRecordsPage: React.FC = () => {
  const { profile } = useAuth();
  const currentCampusId = useCampusStore((s) => s.currentCampusId);
  const userId = profile?.id || '';
  const role = profile?.currentContext?.role;

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<LeadBooking[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');

  const dateRange = useMemo(
    () => ({
      startDate: dayjs().subtract(90, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    }),
    [],
  );

  const loadRecords = useCallback(async () => {
    if (!userId || !isStaffRole(role)) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let raw: LeadBooking[] = [];

      if (isUseMock() && isPrincipalOrAbove(role)) {
        raw = await loadMockCampusLeadBookings(currentCampusId, dateRange);
      } else {
        raw = await leadService.getLeadBookingsByTeacher(userId, dateRange);
      }

      const scoped = filterLeadBookingsByScope(raw, profile, currentCampusId, 'records');
      setBookings(sortLeadBookingsDesc(scoped));
    } catch (err) {
      logError('trial-records load', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [currentCampusId, dateRange, profile, role, userId]);

  useDidShow(() => {
    void loadRecords();
  });

  usePullDownRefresh(() => {
    void loadRecords().finally(() => Taro.stopPullDownRefresh());
  });

  const filtered = useMemo(() => {
    if (statusTab === 'all') return bookings;
    return bookings.filter((b) => b.status === statusTab);
  }, [bookings, statusTab]);

  const handleOpenDetail = useCallback((bookingId: string) => {
    Taro.navigateTo({
      url: `/package-lead/pages/lead-booking-detail/index?bookingId=${encodeURIComponent(bookingId)}`,
    });
  }, []);

  if (!isStaffRole(role)) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center py-[200rpx]">
          <Empty icon="mdi-lock-outline" description="仅机构人员可查看试听记录" />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-muted">
      <View className="border-b border-border bg-card px-[24rpx] py-[16rpx]">
        <ScrollView scrollX enhanced showScrollbar={false} className="whitespace-nowrap">
          <View className="inline-flex flex-row gap-[12rpx]">
            {STATUS_TABS.map((tab) => {
              const active = statusTab === tab.key;
              return (
                <View
                  key={tab.key}
                  className={cn(
                    'rounded-full px-[24rpx] py-[10rpx]',
                    active ? 'bg-primary' : 'bg-muted',
                  )}
                  onClick={() => setStatusTab(tab.key)}
                >
                  <Text
                    className={cn(
                      'text-[24rpx]',
                      active ? 'font-medium text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {tab.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex items-center justify-center py-[160rpx]">
          <Loading text="加载试听记录..." />
        </View>
      ) : filtered.length === 0 ? (
        <View className="py-[120rpx]">
          <Empty icon="mdi-calendar-clock" description="暂无试听记录" />
        </View>
      ) : (
        <ScrollView scrollY className="h-screen" showScrollbar={false}>
          <View className="flex flex-col gap-[16rpx] px-[24rpx] py-[24rpx] pb-safe-bar">
            {filtered.map((item) => (
              <View
                key={item.id}
                className="rounded-[16rpx] bg-card px-[24rpx] py-[22rpx] shadow-card active:opacity-90"
                onClick={() => handleOpenDetail(item.id)}
              >
                <View className="flex items-start gap-[16rpx]">
                  <Avatar
                    name={item.child_name || '试'}
                    size="md"
                    fallback="initial"
                  />
                  <View className="min-w-0 flex-1">
                    <View className="flex items-center justify-between gap-[12rpx]">
                      <Text className="truncate text-[30rpx] font-medium text-foreground">
                        {item.child_name || '试听学员'}
                      </Text>
                      <View className="shrink-0 rounded-[8rpx] bg-primary/10 px-[12rpx] py-[4rpx]">
                        <Text className="text-[22rpx] text-primary">
                          {LEAD_BOOKING_STATUS_LABEL[item.status]}
                        </Text>
                      </View>
                    </View>
                    <Text className="mt-[8rpx] block text-[26rpx] text-foreground">
                      {item.class_name || item.course_name}
                    </Text>
                    <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                      {dayjs(item.lesson_date).format('YYYY-MM-DD')} {item.start_time}-
                      {item.end_time}
                      {item.teacher_name ? ` · ${item.teacher_name}` : ''}
                    </Text>
                    {item.parent_phone ? (
                      <Text className="mt-[4rpx] block text-[22rpx] text-muted-foreground">
                        {item.parent_name ? `${item.parent_name} · ` : ''}
                        {item.parent_phone}
                      </Text>
                    ) : null}
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

export default withRouteGuard(TrialRecordsPage);
