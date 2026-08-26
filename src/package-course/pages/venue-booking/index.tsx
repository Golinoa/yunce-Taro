/**
 * 场地预约详情页
 *
 * 从课表页「场地」Tab 点击进入，展示场地实时占用、开放时间、价格，
 * 并支持选择日期、时段、人数，最后确认预约。
 */
import { View, Text, Image, ScrollView, Swiper, SwiperItem } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { BRAND_LOGO } from '@/constants/brand';
import { venueBookingService } from '@/services';
import type { BookableVenue, VenueBookingSlot } from '@/types/venue-booking';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const DEFAULT_MAX_PEOPLE = 20;
const DATE_SELECTOR_DAYS = 5;
const MAX_VISIBLE_AVATARS = 5;

/** 日期选择器展示项 */
interface DateSelectorItem {
  date: dayjs.Dayjs;
  weekday: string;
  label: string;
}

/** 生成横向日期选择器数据（从今天开始） */
function buildDateSelectorItems(): DateSelectorItem[] {
  const today = dayjs();
  return Array.from({ length: DATE_SELECTOR_DAYS }, (_, index) => {
    const date = today.add(index, 'day');
    const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdayLabels[date.day()];
    let label: string;
    if (index === 0) {
      label = '今天';
    } else if (index === 1) {
      label = '明天';
    } else {
      label = date.format('MM/DD');
    }
    return { date, weekday, label };
  });
}

/** 判断指定日期的某时段是否已过期 */
function isSlotExpired(date: dayjs.Dayjs, startTime: string): boolean {
  const now = dayjs();
  if (date.isBefore(now, 'day')) return true;
  if (date.isAfter(now, 'day')) return false;
  const [hour, minute] = startTime.split(':').map(Number);
  const slotStart = date.hour(hour).minute(minute).second(0).millisecond(0);
  return slotStart.isBefore(now);
}

/**
 * 场地预约详情页
 */
const VenueBookingPage: React.FC = () => {
  const instance = Taro.getCurrentInstance();
  const roomId = decodeURIComponent(instance?.router?.params?.roomId || '');
  const { profile } = useAuth();
  const navSafeHeight = useNavSafeHeight();
  const statusBarHeight = useMemo(() => Taro.getWindowInfo().statusBarHeight ?? 0, []);

  const [venue, setVenue] = useState<BookableVenue | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [slotsMap, setSlotsMap] = useState<Record<string, VenueBookingSlot[]>>({});
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [peopleCount, setPeopleCount] = useState(1);
  /** 已加载时段的日期集合，避免 slotsMap 变化导致无限请求 */
  const loadedDatesRef = React.useRef<Set<string>>(new Set());

  /** 加载场地详情 */
  const loadVenue = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const detail = await venueBookingService.getBookableVenueById(roomId);
      if (detail) {
        setVenue(detail);
      } else {
        Taro.showToast({ title: '场地不存在', icon: 'none' });
      }
    } catch (err) {
      logError('VenueBookingPage loadVenue', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  /** 加载某日期时段 */
  const loadSlots = useCallback(
    async (date: dayjs.Dayjs, force = false) => {
      if (!roomId) return;
      const dateStr = date.format('YYYY-MM-DD');
      if (!force && loadedDatesRef.current.has(dateStr)) return;
      loadedDatesRef.current.add(dateStr);
      try {
        const slots = await venueBookingService.getSlots(roomId, dateStr);
        setSlotsMap((prev) => ({ ...prev, [dateStr]: slots }));
      } catch (err) {
        logError('VenueBookingPage loadSlots', err);
        loadedDatesRef.current.delete(dateStr);
      }
    },
    [roomId],
  );

  useEffect(() => {
    void loadVenue();
  }, [loadVenue]);

  const currentSlots = useMemo(() => {
    return slotsMap[selectedDate.format('YYYY-MM-DD')] || [];
  }, [slotsMap, selectedDate]);

  const selectedSlot = useMemo(() => {
    return currentSlots.find((slot) => slot.id === selectedSlotId) || null;
  }, [currentSlots, selectedSlotId]);

  const totalPrice = useMemo(() => {
    return (selectedSlot?.price || 0) * peopleCount;
  }, [selectedSlot, peopleCount]);

  const capacity = venue?.capacity || 0;
  const currentCount = venue?.currentCount || 0;
  const todayEntryCount = venue?.todayEntryCount || 0;
  const maxPeopleCount = capacity > 0 ? Math.min(capacity, DEFAULT_MAX_PEOPLE) : DEFAULT_MAX_PEOPLE;

  const statusText = useMemo(() => {
    if (currentCount <= 0) return { label: '空闲', text: 'text-success', bg: 'bg-success/10' };
    if (currentCount >= capacity) return { label: '已满', text: 'text-error', bg: 'bg-error/10' };
    return { label: '使用中', text: 'text-warning', bg: 'bg-warning/10' };
  }, [currentCount, capacity]);

  const venueImages = useMemo(() => {
    return (venue?.photos || []).slice(0, 3);
  }, [venue?.photos]);

  const coverImage = useMemo(() => {
    return venueImages[0] || BRAND_LOGO;
  }, [venueImages]);

  const dateSelectorItems = useMemo(() => buildDateSelectorItems(), []);

  const visibleAvatars = useMemo(() => {
    return (venue?.memberAvatars || []).slice(0, MAX_VISIBLE_AVATARS);
  }, [venue?.memberAvatars]);

  const remainingAvatarCount = useMemo(() => {
    return Math.max(0, (venue?.memberAvatars || []).length - MAX_VISIBLE_AVATARS);
  }, [venue?.memberAvatars]);

  const handleSelectDate = useCallback((date: dayjs.Dayjs) => {
    setSelectedDate(date);
    setSelectedSlotId('');
  }, []);

  useEffect(() => {
    if (venue) {
      dateSelectorItems.forEach((item) => {
        void loadSlots(item.date);
      });
    }
  }, [venue, loadSlots, dateSelectorItems]);

  /** 已选时段过期或不可用时自动清除 */
  useEffect(() => {
    if (!selectedSlotId || currentSlots.length === 0) return;
    const slot = currentSlots.find((item) => item.id === selectedSlotId);
    if (!slot || slot.status !== 'available' || isSlotExpired(selectedDate, slot.startTime)) {
      setSelectedSlotId('');
    }
  }, [currentSlots, selectedDate, selectedSlotId]);

  const handleSelectSlot = useCallback(
    (slot: VenueBookingSlot) => {
      if (slot.status !== 'available') return;
      if (isSlotExpired(selectedDate, slot.startTime)) return;
      setSelectedSlotId((prev) => (prev === slot.id ? '' : slot.id));
    },
    [selectedDate],
  );

  const handlePeopleChange = useCallback(
    (delta: number) => {
      setPeopleCount((prev) => {
        const next = prev + delta;
        if (next < 1) return 1;
        if (next > maxPeopleCount) return maxPeopleCount;
        return next;
      });
    },
    [maxPeopleCount],
  );

  const handleSubmit = useCallback(async () => {
    if (!venue || !selectedSlot) return;
    if (!profile?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await venueBookingService.createBooking({
        userId: profile.id,
        userName: profile.name || '未知用户',
        roomId: venue.id,
        date: selectedSlot.date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        peopleCount,
        unitPrice: selectedSlot.price,
        totalPrice,
        status: 'confirmed',
      });
      Taro.showToast({ title: '预约成功', icon: 'success' });
      setSelectedSlotId('');
      setPeopleCount(1);
      void loadVenue();
      void loadSlots(selectedDate, true);
    } catch (err) {
      logError('VenueBookingPage submit', err);
      Taro.showToast({ title: '预约失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [venue, selectedSlot, profile, peopleCount, totalPrice, selectedDate, loadVenue, loadSlots]);

  const handleBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  if (loading) {
    return (
      <PageContainer>
        <View className="min-h-screen flex items-center justify-center bg-background">
          <Loading text="加载场地信息中..." />
        </View>
      </PageContainer>
    );
  }

  if (!venue) {
    return (
      <PageContainer>
        <View className="min-h-screen flex items-center justify-center bg-background">
          <Empty icon="mdi-map-marker-outline" description="场地信息加载失败" />
        </View>
      </PageContainer>
    );
  }

  const currentDateStr = selectedDate.format('YYYY-MM-DD');
  const slotsLoading = slotsMap[currentDateStr] === undefined;
  const slotsEmpty = !slotsLoading && currentSlots.length === 0;
  const slotsReady = !slotsLoading && currentSlots.length > 0;

  return (
    <PageContainer className="bg-background">
      <View className="relative flex h-screen flex-col overflow-hidden bg-background">
        {/* 自定义导航栏：白色背景 + 黑色文字/图标，标题定位在导航栏区域（不含状态栏） */}
        <View
          className="bg-white flex-shrink-0"
          style={{ height: `${navSafeHeight}px`, paddingTop: `${statusBarHeight}px` }}
        >
          <View className="flex h-full items-center justify-between px-[18rpx]">
            <View
              className="flex h-[64rpx] w-[64rpx] items-center justify-center active:opacity-80"
              onClick={handleBack}
            >
              <Icon name="mdi-chevron-left" size={40} color="black" />
            </View>
            <Text className="text-[34rpx] font-bold text-black">场地详情</Text>
            <View className="h-[64rpx] w-[64rpx]" />
          </View>
        </View>

        {/* 页面整体滚动区 */}
        <ScrollView
          className="flex-1"
          style={{ flex: 1, minHeight: 0 }}
          scrollY
          enhanced
          showScrollbar={false}
        >
          <View className="pb-[320rpx]">
            {/* 场地照片：单张直接展示，多张轮播，无图隐藏 */}
            {venueImages.length === 1 && (
              <View className="mx-[24rpx] mt-[20rpx] rounded-[24rpx] overflow-hidden shadow-card h-[360rpx]">
                <Image className="h-full w-full" src={venueImages[0]} mode="aspectFill" lazyLoad />
              </View>
            )}
            {venueImages.length > 1 && (
              <View className="mx-[24rpx] mt-[20rpx] rounded-[24rpx] overflow-hidden shadow-card h-[360rpx]">
                <Swiper
                  className="h-full w-full"
                  indicatorDots
                  indicatorColor="rgba(255, 255, 255, 0.4)"
                  indicatorActiveColor="rgba(255, 255, 255, 0.9)"
                  autoplay
                  interval={4000}
                  duration={300}
                  circular
                >
                  {venueImages.map((url, index) => (
                    <SwiperItem key={`${url}-${index}`}>
                      <Image className="h-full w-full" src={url} mode="aspectFill" lazyLoad />
                    </SwiperItem>
                  ))}
                </Swiper>
              </View>
            )}

            {/* 场地信息卡片：参考课表页场地卡片风格分层 */}
            <View className="mx-[24rpx] mt-[20rpx] rounded-[24rpx] bg-white px-[28rpx] py-[28rpx] shadow-card">
              {/* 第一层：左侧场地图片 + 右侧名称/场馆/状态 */}
              <View className="flex gap-[20rpx]">
                <Image
                  src={coverImage}
                  className="h-[140rpx] w-[140rpx] flex-shrink-0 rounded-[18rpx] bg-muted"
                  mode="aspectFill"
                />
                <View className="min-w-0 flex-1 flex flex-col justify-between">
                  <View className="flex items-start justify-between gap-[12rpx]">
                    <View className="min-w-0 flex-1 flex flex-col">
                      <Text className="truncate text-[36rpx] font-bold leading-tight text-foreground">
                        {venue.name}
                      </Text>
                      {venue.venueName ? (
                        <Text className="mt-[12rpx] text-[26rpx] text-muted-foreground truncate">
                          {venue.venueName}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      className={cn(
                        'flex-shrink-0 rounded-[12rpx] px-[16rpx] py-[6rpx]',
                        statusText.bg,
                      )}
                    >
                      <Text className={cn('text-[24rpx] font-semibold', statusText.text)}>
                        {statusText.label}
                      </Text>
                    </View>
                  </View>

                  {/* 实时在场人数 */}
                  <View className="mt-[12rpx] flex items-end justify-between">
                    <Text className="text-[26rpx] text-muted-foreground">实时在场</Text>
                    <View className="flex items-baseline gap-[6rpx]">
                      <Text className="text-[40rpx] font-bold leading-none text-foreground">
                        {currentCount}
                      </Text>
                      <Text className="text-[24rpx] text-muted-foreground">/{capacity}人</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 第二层：在场会员头像进度条 + 今日入场 */}
              <View className="mt-[24rpx] flex items-center justify-between">
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
                            'h-[52rpx] w-[52rpx] flex-shrink-0 rounded-full border-2 border-white bg-muted',
                            index > 0 && '-ml-[16rpx]',
                          )}
                          mode="aspectFill"
                        />
                      ))}
                      {remainingAvatarCount > 0 ? (
                        <View className="relative -ml-[16rpx] flex h-[52rpx] w-[52rpx] flex-shrink-0 items-center justify-center rounded-full border-2 border-white bg-muted">
                          <Text className="text-[20rpx] font-medium text-muted-foreground">
                            +{remainingAvatarCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>

                <Text className="ml-[24rpx] flex-shrink-0 text-[24rpx] text-muted-foreground">
                  今日入场 {todayEntryCount}人
                </Text>
              </View>

              {/* 第三层：开放时间 */}
              <View className="mt-[20rpx] pt-[20rpx] border-t border-border">
                <Text className="text-[24rpx] text-muted-foreground">
                  开放时间 {venue.openTimeStart || '09:00'}-{venue.openTimeEnd || '22:00'}
                </Text>
              </View>
            </View>

            {/* 选择时段卡片：日期选择 + 时段网格 + 预约人数 */}
            <View className="mx-[24rpx] mt-[20rpx] rounded-[24rpx] bg-white px-[28rpx] py-[28rpx] shadow-card">
              {/* 卡片标题 */}
              <View className="flex items-center justify-between">
                <Text className="text-[30rpx] font-bold text-foreground">选择时段</Text>
                <Text className="text-[24rpx] text-muted-foreground">空闲时段可预约</Text>
              </View>

              {/* 日期选择器 */}
              <View className="mt-[24rpx] flex justify-between gap-[12rpx]">
                {dateSelectorItems.map((item) => {
                  const selected = item.date.isSame(selectedDate, 'day');
                  return (
                    <View
                      key={item.date.format('YYYY-MM-DD')}
                      className={cn(
                        'flex flex-1 flex-col items-center justify-center rounded-[16rpx] py-[16rpx] active:opacity-80',
                        selected ? 'bg-primary' : 'bg-muted',
                      )}
                      onClick={() => handleSelectDate(item.date)}
                    >
                      <Text
                        className={cn(
                          'text-[26rpx] font-medium',
                          selected ? 'text-white' : 'text-foreground-secondary',
                        )}
                      >
                        {item.weekday}
                      </Text>
                      <Text
                        className={cn(
                          'mt-[6rpx] text-[26rpx] font-bold',
                          selected ? 'text-white' : 'text-foreground',
                        )}
                      >
                        {item.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* 时段网格 */}
              <View className="mt-[24rpx]">
                {slotsLoading ? (
                  <View className="py-[80rpx] flex items-center justify-center">
                    <Text className="text-[28rpx] text-muted-foreground">时段加载中...</Text>
                  </View>
                ) : null}

                {slotsEmpty ? (
                  <View className="rounded-[16rpx] bg-background py-[60rpx]">
                    <Empty icon="mdi-calendar-blank" description="当前日期暂无可约时段" />
                  </View>
                ) : null}

                {slotsReady ? (
                  <View className="grid grid-cols-4 gap-[16rpx]">
                    {currentSlots.map((slot) => {
                      const isSelected = selectedSlotId === slot.id;
                      const isExpired = isSlotExpired(selectedDate, slot.startTime);
                      const isAvailable = slot.status === 'available' && !isExpired;
                      const slotLabel = isExpired
                        ? '已过期'
                        : slot.status === 'booked'
                          ? '已满'
                          : slot.status === 'closed'
                            ? '已约'
                            : slot.price > 0
                              ? `¥${slot.price}`
                              : '免费';
                      return (
                        <View
                          key={slot.id}
                          className={cn(
                            'flex flex-col items-center justify-center rounded-[16rpx] border-[2rpx] px-[8rpx] py-[18rpx]',
                            isSelected
                              ? 'border-primary bg-primary-10'
                              : isAvailable
                                ? 'border-border bg-white active:opacity-70'
                                : 'border-border bg-muted opacity-60',
                          )}
                          onClick={() => handleSelectSlot(slot)}
                        >
                          <Text
                            className={cn(
                              'text-[28rpx] font-bold',
                              isSelected ? 'text-primary' : 'text-foreground',
                              !isAvailable && 'text-muted-foreground',
                            )}
                          >
                            {slot.startTime}
                          </Text>
                          <Text
                            className={cn(
                              'mt-[8rpx] text-[22rpx]',
                              isSelected ? 'text-primary' : 'text-muted-foreground',
                            )}
                          >
                            {slotLabel}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              {/* 预约人数：放在选择时段卡片最下方 */}
              <View className="mt-[28rpx] pt-[24rpx] border-t border-border flex items-center justify-between">
                <Text className="text-[28rpx] font-medium text-foreground">预约人数</Text>
                <View className="flex items-center gap-[20rpx]">
                  <View
                    className={cn(
                      'flex h-[64rpx] w-[64rpx] items-center justify-center rounded-full bg-primary active:opacity-80',
                      peopleCount <= 1 && 'opacity-40',
                    )}
                    onClick={() => handlePeopleChange(-1)}
                  >
                    <Icon name="mdi-minus" size={28} color="white" />
                  </View>
                  <Text className="min-w-[48rpx] text-center text-[34rpx] font-bold text-foreground">
                    {peopleCount}
                  </Text>
                  <View
                    className={cn(
                      'flex h-[64rpx] w-[64rpx] items-center justify-center rounded-full bg-primary active:opacity-80',
                      peopleCount >= maxPeopleCount && 'opacity-40',
                    )}
                    onClick={() => handlePeopleChange(1)}
                  >
                    <Icon name="mdi-plus" size={28} color="white" />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* 底部固定操作栏：预估费用（弱提醒）+ 立即预约按钮 */}
        <View className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white px-[32rpx] pt-[24rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))]">
          {/* 预估费用：弱提醒，不收款只提示 */}
          {selectedSlot ? (
            <View className="mb-[20rpx] text-center">
              <Text className="text-[24rpx] text-muted-foreground">预估费用 ¥{totalPrice}</Text>
            </View>
          ) : null}

          {/* 预约按钮 */}
          <View
            className={cn(
              'flex h-[96rpx] w-full items-center justify-center rounded-[48rpx]',
              selectedSlot && !submitting
                ? 'bg-gradient-primary active:opacity-90'
                : 'bg-btn-disabled',
            )}
            onClick={selectedSlot && !submitting ? handleSubmit : undefined}
          >
            <Text className="text-[32rpx] font-semibold text-white">
              {submitting ? '预约中...' : '立即预约'}
            </Text>
          </View>
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(VenueBookingPage);
