/**
 * 试听预约详情页 package-lead/pages/lead-booking-detail
 *
 * 从课表「记录」Tab 点击卡片进入，展示：
 * - 顶部橙色头部：课程名、老师、日期时间、签到统计
 * - 会员预约名单：已签到 / 待签
 * - 底部主操作按钮：根据状态显示「全部已签到」「取消预约」或「恢复预约」
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad, useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { leadService } from '@/services';
import { useCampusStore } from '@/stores/campus';
import type { LeadBooking } from '@/types/lead';
import { isPrincipalOrAbove, useAuth } from '@/utils/auth';
import { resolveTeachingActorId } from '@/utils/trial-booking-scope';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

interface PageParams {
  bookingId?: string;
}

const LeadBookingDetailPage: React.FC = () => {
  const { profile } = useAuth();
  const currentCampusId = useCampusStore((s) => s.currentCampusId);
  const teachingActorId = resolveTeachingActorId(profile);
  const role = profile?.currentContext?.role;
  const navSafeHeight = useNavSafeHeight();
  const [params, setParams] = useState<PageParams>({});
  const [booking, setBooking] = useState<LeadBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusBarHeight, setStatusBarHeight] = useState(44);

  useLoad((options) => {
    const opt = options as Record<string, string>;
    setParams({ bookingId: opt.bookingId });
  });

  useEffect(() => {
    const windowInfo = Taro.getWindowInfo();
    setStatusBarHeight(windowInfo.statusBarHeight || 44);
  }, []);

  const loadBooking = useCallback(async () => {
    if (!params.bookingId) return;
    setLoading(true);
    try {
      const dateRange = {
        startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
      };
      const list = isPrincipalOrAbove(role)
        ? await leadService.getLeadBookingsByCampus(currentCampusId, dateRange)
        : await leadService.getLeadBookingsByTeacher(teachingActorId, dateRange);
      const found = list.find((b) => b.id === params.bookingId) || null;
      setBooking(found);
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [currentCampusId, params.bookingId, role, teachingActorId]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  useDidShow(() => {
    void loadBooking();
  });

  const dateText = useMemo(() => {
    if (!booking) return '';
    return `${dayjs(booking.lesson_date).format('MM-DD')} ${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs(booking.lesson_date).day()]}`;
  }, [booking]);

  const timeRange = useMemo(() => {
    if (!booking) return '';
    return `${booking.start_time}-${booking.end_time}`;
  }, [booking]);

  const durationText = useMemo(() => {
    if (!booking) return '';
    const start = dayjs(`${booking.lesson_date} ${booking.start_time}`);
    const end = dayjs(`${booking.lesson_date} ${booking.end_time}`);
    const minutes = end.diff(start, 'minute');
    return `${minutes}分钟`;
  }, [booking]);

  const signedCount = useMemo(() => {
    // 体验课试听预约暂无签到明细，按 0 展示
    return 0;
  }, []);

  const totalCount = useMemo(() => {
    return 1;
  }, []);

  const handleCancel = useCallback(async () => {
    if (!booking) return;
    const res = await Taro.showModal({
      title: '确认取消预约',
      content: `确定取消 ${booking.child_name || '学员'} 的 ${booking.course_name} 预约吗？`,
      confirmText: '取消预约',
      cancelText: '再想想',
      confirmColor: '#ef4444',
    });
    if (!res.confirm) return;
    try {
      await leadService.cancelLeadBooking(booking.id);
      Taro.showToast({ title: '已取消预约', icon: 'success' });
      void loadBooking();
    } catch {
      Taro.showToast({ title: '取消失败', icon: 'none' });
    }
  }, [booking, loadBooking]);

  const handleRestore = useCallback(async () => {
    if (!booking) return;
    try {
      await leadService.restoreLeadBooking(booking.id);
      Taro.showToast({ title: '已恢复预约', icon: 'success' });
      void loadBooking();
    } catch {
      Taro.showToast({ title: '恢复失败', icon: 'none' });
    }
  }, [booking, loadBooking]);

  const bottomAction = useMemo(() => {
    if (!booking) return null;
    if (booking.status === 'cancelled') {
      return { label: '恢复预约', variant: 'primary' as const, action: handleRestore };
    }
    // G1-2：体验课签到未接通 — 砍掉「全部已签到」假入口，仅保留取消
    return { label: '取消预约', variant: 'ghost' as const, action: handleCancel };
  }, [booking, handleCancel, handleRestore]);

  if (loading) {
    return (
      <View className="h-screen bg-[#f6f7fb]">
        <View className="center h-full">
          <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
        </View>
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="h-screen bg-[#f6f7fb]">
        <View className="center h-full flex-col gap-3">
          <Icon name="mdi-alert-circle-outline" size={64} className="text-muted-foreground" />
          <Text className="text-[28rpx] text-muted-foreground">预约记录不存在</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex h-screen flex-col overflow-hidden bg-[#f6f7fb]">
      {/* 顶部橙色头部 */}
      <View className="relative flex-shrink-0 bg-primary">
        <View
          className="flex items-end justify-between px-[24rpx] pb-[20rpx]"
          style={{ paddingTop: `${statusBarHeight}px`, height: `${navSafeHeight}px` }}
        >
          <View
            className="center h-[72rpx] w-[72rpx] active:opacity-80"
            onClick={() => Taro.navigateBack()}
          >
            <Icon name="mdi-chevron-left" size={36} color="white" />
          </View>
          <Text className="text-[34rpx] font-semibold text-white">预约详情</Text>
          <View className="h-[72rpx] w-[72rpx]" />
        </View>

        <View className="px-[30rpx] pb-[80rpx] pt-[12rpx]">
          <View className="flex items-start justify-between">
            <View className="flex-1">
              <View className="flex items-center gap-[16rpx]">
                <Text className="text-[40rpx] font-bold text-white">
                  {booking.course_name || '体验课'}
                </Text>
                <View className="rounded-full bg-white/20 px-[16rpx] py-[6rpx]">
                  <Text className="text-[22rpx] font-medium text-white">
                    {booking.teacher_name || '未分配老师'}
                  </Text>
                </View>
              </View>
              <Text className="mt-[16rpx] text-[28rpx] text-white/90">
                {dateText} · {timeRange} · {durationText}
              </Text>
            </View>
            <View className="center h-[112rpx] w-[112rpx] rounded-full bg-white/20">
              <View className="center flex-col">
                <Text className="text-[32rpx] font-bold text-white">
                  {signedCount}/{totalCount}
                </Text>
                <Text className="text-[20rpx] text-white/80">已签到</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 签到统计卡片 */}
      <View className="relative z-10 -mt-[40rpx] mx-[24rpx] rounded-[24rpx] bg-white px-[24rpx] py-[24rpx] shadow-[0_8rpx_24rpx_rgba(15,23,42,0.04)]">
        <View className="flex items-center justify-between">
          <View>
            <Text className="text-[32rpx] font-bold text-foreground">
              已签到
              <Text className="text-primary">{signedCount}</Text>人 · 待签
              <Text className="text-warning">{totalCount - signedCount}</Text>人
            </Text>
            <Text className="mt-[6rpx] text-[24rpx] text-muted-foreground">
              合计耗卡¥0 含时间卡单日耗卡
            </Text>
          </View>
          <View
            className="center h-[64rpx] rounded-full bg-primary px-[28rpx] active:opacity-80"
            onClick={() => handleProxyBooking()}
          >
            <Icon name="mdi-plus" size={24} color="white" />
            <Text className="ml-[8rpx] text-[26rpx] font-medium text-white">代约</Text>
          </View>
        </View>
      </View>

      {/* 会员列表 */}
      <ScrollView scrollY enhanced showScrollbar={false} className="min-h-0 flex-1">
        <View className="px-[24rpx] pb-[40rpx] pt-[24rpx]">
          <View className="rounded-[24rpx] bg-white px-[24rpx] py-[24rpx] shadow-[0_8rpx_24rpx_rgba(15,23,42,0.04)]">
            <Text className="text-[30rpx] font-bold text-foreground">预约会员</Text>
            <View className="mt-6 center flex-col gap-3 py-10">
              <View className="center h-[120rpx] w-[120rpx] rounded-full bg-muted">
                <Icon name="mdi-account-outline" size={56} className="text-muted-foreground/40" />
              </View>
              <Text className="text-[28rpx] text-foreground">暂无预约会员</Text>
              <Text className="text-[24rpx] text-muted-foreground">
                点击顶部右侧「+ 代约」添加会员
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View
        className="flex-shrink-0 border-t border-border bg-white px-[30rpx]"
        style={{ paddingTop: '20rpx', paddingBottom: 'env(safe-area-inset-bottom, 20rpx)' }}
      >
        <View className="flex items-center gap-[20rpx] pb-[20rpx]">
          {Array.isArray(bottomAction) ? (
            bottomAction.map((act) => (
              <View
                key={act.label}
                className={cn(
                  'center h-[80rpx] flex-1 rounded-full text-[30rpx] font-medium transition-all active:scale-95',
                  act.variant === 'primary'
                    ? 'bg-primary text-white active:bg-primary/90'
                    : 'border border-border bg-white text-foreground active:bg-muted',
                )}
                onClick={act.action}
              >
                {act.label}
              </View>
            ))
          ) : bottomAction ? (
            <View
              className={cn(
                'center h-[80rpx] w-full rounded-full text-[30rpx] font-medium transition-all active:scale-95',
                bottomAction.variant === 'primary'
                  ? 'bg-primary text-white active:bg-primary/90'
                  : 'border border-border bg-white text-foreground active:bg-muted',
              )}
              onClick={bottomAction.action}
            >
              {bottomAction.label}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

function handleProxyBooking() {
  // 占位：后续跳转到代约页面
  Taro.showToast({ title: '代约功能开发中', icon: 'none' });
}

export default LeadBookingDetailPage;
