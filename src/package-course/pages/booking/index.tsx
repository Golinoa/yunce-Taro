/**
 * 我的预约 — 与当前老师相关的统一时间线台账
 * 来源：试听 / 团课开放约 / 私教约课 / 场地；卡片类型标签区分，不做类型分栏。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import {
  MY_BOOKING_STATUS_META,
  MY_BOOKING_STATUS_TABS,
  MY_BOOKING_TYPE_BADGE_CLASS,
  MY_BOOKING_TYPE_LABEL,
} from '@/constants/my-booking';
import { leadService, myBookingService, venueBookingService } from '@/services';
import type { MyBookingCard, MyBookingStatus } from '@/types/my-booking';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { canAccessMyBookings, resolveMyBookingActions } from '@/utils/related-booking-scope';
import { withRouteGuard } from '@/utils/route-guard';

type StatusTab = 'all' | MyBookingStatus;

function MyBookingCardView({
  item,
  profile,
  actingId,
  onOpen,
  onCheckIn,
  onCancel,
  onVenueCheckIn,
}: {
  item: MyBookingCard;
  profile: Parameters<typeof resolveMyBookingActions>[0];
  actingId: string | null;
  onOpen: (item: MyBookingCard) => void;
  onCheckIn: (item: MyBookingCard) => void;
  onCancel: (item: MyBookingCard) => void;
  onVenueCheckIn: (item: MyBookingCard) => void;
}) {
  const statusMeta = MY_BOOKING_STATUS_META[item.status];
  const typeLabel = MY_BOOKING_TYPE_LABEL[item.sourceType];
  const busy = actingId === item.id;
  const actions = resolveMyBookingActions(profile, item);

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <View className="rounded-[24rpx] bg-card px-[28rpx] py-[24rpx] shadow-soft">
      <View className="flex items-start gap-[16rpx] active:opacity-90" onClick={() => onOpen(item)}>
        <Avatar name={item.title || '约'} size="md" />
        <View className="min-w-0 flex-1">
          <View className="flex items-center justify-between gap-[12rpx]">
            <View className="min-w-0 flex flex-row items-center gap-[12rpx]">
              <Text className="truncate text-[30rpx] font-semibold text-foreground">
                {item.title}
              </Text>
              <View
                className={cn('shrink-0 rounded-full px-[14rpx] py-[4rpx]', statusMeta.className)}
              >
                <Text className="text-[22rpx] font-bold">{statusMeta.label}</Text>
              </View>
            </View>
          </View>

          <View className="mt-[10rpx] flex flex-row flex-wrap items-center gap-[8rpx]">
            <View className={MY_BOOKING_TYPE_BADGE_CLASS}>
              <Text className="text-[20rpx] text-muted-foreground">{typeLabel}</Text>
            </View>
          </View>

          <Text className="mt-[12rpx] block text-[26rpx] font-medium text-foreground">
            {item.subtitle}
          </Text>
          <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
            {dayjs(item.date).format('MM-DD')} {item.start}
            {item.end ? `-${item.end}` : ''}
          </Text>

          <Text className="mt-[10rpx] block text-[22rpx] text-muted-foreground">
            {item.relationLabel}
          </Text>
        </View>
      </View>

      {(actions.canCheckIn || actions.canCancel || actions.canVenueCheckIn) && (
        <View
          className="mt-[16rpx] flex flex-row flex-wrap gap-[12rpx] border-t border-border/40 pt-[16rpx]"
          onClick={stop}
        >
          {actions.canCheckIn ? (
            <View
              className="rounded-full bg-primary px-[24rpx] py-[10rpx] active:opacity-80"
              onClick={() => !busy && onCheckIn(item)}
            >
              <Text className="text-[22rpx] text-primary-foreground">
                {actions.checkInLabel || '签到'}
              </Text>
            </View>
          ) : null}
          {actions.canVenueCheckIn ? (
            <View
              className="rounded-full bg-primary px-[24rpx] py-[10rpx] active:opacity-80"
              onClick={() => !busy && onVenueCheckIn(item)}
            >
              <Text className="text-[22rpx] text-primary-foreground">
                {actions.checkInLabel || '核销'}
              </Text>
            </View>
          ) : null}
          {actions.canCancel ? (
            <View
              className="rounded-full bg-muted px-[24rpx] py-[10rpx] active:opacity-80"
              onClick={() => !busy && onCancel(item)}
            >
              <Text className="text-[22rpx] text-muted-foreground">取消</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const MyBookingsPage: React.FC = () => {
  const { profile } = useAuth();
  const allowed = canAccessMyBookings(profile);

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<MyBookingCard[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>('confirmed');
  const [actingId, setActingId] = useState<string | null>(null);

  const dateRange = useMemo(
    () => ({
      startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().add(60, 'day').format('YYYY-MM-DD'),
    }),
    [],
  );

  const loadBookings = useCallback(async () => {
    if (!allowed) {
      setBookings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await myBookingService.getMyRelatedBookings(profile, dateRange);
      setBookings(list);
    } catch (err) {
      logError('my-bookings load', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, dateRange, profile]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useDidShow(() => {
    void loadBookings();
  });

  usePullDownRefresh(() => {
    void loadBookings().finally(() => Taro.stopPullDownRefresh());
  });

  const filtered = useMemo(() => {
    if (statusTab === 'all') return bookings;
    return bookings.filter((b) => b.status === statusTab);
  }, [bookings, statusTab]);

  const handleOpenDetail = useCallback((item: MyBookingCard) => {
    const { navigatePayload: p, sourceType } = item;
    // 试听：进线索详情（与试听记录一致）；签到/取消走卡片操作区
    if (sourceType === 'trial_group' || sourceType === 'trial_private') {
      if (p.leadId) {
        void Taro.navigateTo({
          url: `/package-lead/pages/lead-detail/index?id=${encodeURIComponent(p.leadId)}`,
        });
        return;
      }
      Taro.showToast({ title: '线索信息缺失', icon: 'none' });
      return;
    }
    if (sourceType === 'venue' && p.roomId) {
      void Taro.navigateTo({
        url: `/package-course/pages/venue-booking/index?roomId=${encodeURIComponent(p.roomId)}`,
      });
      return;
    }
    if ((sourceType === 'group' || sourceType === 'private') && p.parentBookingId) {
      void Taro.navigateTo({
        url: `/package-course/pages/booking-record-detail/index?id=${encodeURIComponent(p.parentBookingId)}`,
      });
      return;
    }
    if (sourceType === 'class_open' && p.classId && p.lessonDate) {
      void Taro.navigateTo({
        url:
          `/package-course/pages/lesson-form/index?classId=${encodeURIComponent(p.classId)}` +
          `&date=${encodeURIComponent(p.lessonDate)}`,
      });
      return;
    }
    Taro.showToast({ title: '暂无详情页', icon: 'none' });
  }, []);

  const handleCheckIn = useCallback(
    async (item: MyBookingCard) => {
      if (actingId) return;
      const flags = resolveMyBookingActions(profile, item);
      if (!flags.canCheckIn) {
        Taro.showToast({ title: '无操作权限', icon: 'none' });
        return;
      }
      const p = item.navigatePayload;
      if (item.sourceType === 'trial_group' && p.classId) {
        void Taro.navigateTo({
          url:
            `/package-course/pages/lesson-form/index?classId=${encodeURIComponent(p.classId)}` +
            `&date=${encodeURIComponent(p.lessonDate || item.date)}` +
            `&leadBookingId=${encodeURIComponent(p.bookingId)}`,
        });
        return;
      }
      if (item.sourceType === 'trial_private') {
        setActingId(item.id);
        try {
          const updated = await leadService.checkInPrivateLeadBooking(p.bookingId);
          if (!updated) {
            Taro.showToast({ title: '签到失败', icon: 'none' });
            return;
          }
          Taro.showToast({ title: '已签到', icon: 'success' });
          void loadBookings();
        } catch (err) {
          logError('my-bookings checkIn', err);
          Taro.showToast({ title: '签到失败', icon: 'none' });
        } finally {
          setActingId(null);
        }
      }
    },
    [actingId, loadBookings, profile],
  );

  const handleCancel = useCallback(
    async (item: MyBookingCard) => {
      if (actingId) return;
      const flags = resolveMyBookingActions(profile, item);
      if (!flags.canCancel) {
        Taro.showToast({ title: '无操作权限', icon: 'none' });
        return;
      }
      const confirm = await Taro.showModal({
        title: '取消预约',
        content: '确认取消该预约？',
      });
      if (!confirm.confirm) return;
      setActingId(item.id);
      try {
        await leadService.cancelLeadBooking(item.navigatePayload.bookingId);
        Taro.showToast({ title: '已取消', icon: 'success' });
        void loadBookings();
      } catch (err) {
        logError('my-bookings cancel', err);
        Taro.showToast({ title: '取消失败', icon: 'none' });
      } finally {
        setActingId(null);
      }
    },
    [actingId, loadBookings, profile],
  );

  const handleVenueCheckIn = useCallback(
    async (item: MyBookingCard) => {
      if (actingId) return;
      const flags = resolveMyBookingActions(profile, item);
      if (!flags.canVenueCheckIn) {
        Taro.showToast({ title: '无操作权限', icon: 'none' });
        return;
      }
      setActingId(item.id);
      try {
        const updated = await venueBookingService.checkInBooking(item.navigatePayload.bookingId);
        if (!updated) {
          Taro.showToast({ title: '核销失败', icon: 'none' });
          return;
        }
        Taro.showToast({ title: '已核销', icon: 'success' });
        void loadBookings();
      } catch (err) {
        logError('my-bookings venueCheckIn', err);
        Taro.showToast({ title: '核销失败', icon: 'none' });
      } finally {
        setActingId(null);
      }
    },
    [actingId, loadBookings, profile],
  );

  if (!allowed) {
    return (
      <PageContainer className="bg-muted">
        <View className="py-[160rpx]">
          <Empty icon="mdi-lock-outline" description="暂无权限查看预约" />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-muted">
      <View className="sticky top-0 z-10 bg-muted px-[24rpx] pt-[16rpx] pb-[8rpx]">
        <ScrollView scrollX showScrollbar={false} className="whitespace-nowrap">
          <View className="inline-flex flex-row gap-[12rpx] pr-[24rpx]">
            {MY_BOOKING_STATUS_TABS.map((tab) => {
              const active = statusTab === tab.key;
              return (
                <View
                  key={tab.key}
                  className={cn(
                    'rounded-full px-[28rpx] py-[12rpx]',
                    active ? 'bg-primary' : 'bg-card',
                  )}
                  onClick={() => setStatusTab(tab.key)}
                >
                  <Text
                    className={cn(
                      'text-[24rpx]',
                      active ? 'font-semibold text-primary-foreground' : 'text-muted-foreground',
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
        <View className="flex items-center justify-center py-[200rpx]">
          <Loading text="加载预约..." />
        </View>
      ) : filtered.length === 0 ? (
        <View className="py-[160rpx]">
          <Empty icon="mdi-inbox" description="暂无与我相关的预约" />
        </View>
      ) : (
        <ScrollView scrollY className="h-screen" showScrollbar={false}>
          <View className="flex flex-col gap-[16rpx] px-[24rpx] py-[16rpx] pb-safe-bar">
            {filtered.map((item) => (
              <MyBookingCardView
                key={item.id}
                item={item}
                profile={profile}
                actingId={actingId}
                onOpen={handleOpenDetail}
                onCheckIn={handleCheckIn}
                onCancel={handleCancel}
                onVenueCheckIn={handleVenueCheckIn}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </PageContainer>
  );
};

export default withRouteGuard(MyBookingsPage);
