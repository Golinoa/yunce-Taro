/**
 * 试听记录 — 按次预约台账
 *
 * 产品边界（PRD）：
 * - 本页是 LeadBooking 列表，不是线索列表
 * - 跟进 / 转化走线索详情（跟进功能已在线索页）
 * - 签到走点名 / 今日课表，不进半成品预约签到页
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import {
  LEAD_BOOKING_MODE_BADGE_CLASS,
  LEAD_BOOKING_STATUS_META,
  getLeadBookingModeLabel,
} from '@/constants/lead';
import { leadService } from '@/services';
import { useCampusStore } from '@/stores/campus';
import type { LeadBooking, LeadBookingStatus } from '@/types/lead';
import { isPrincipalOrAbove, isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';
import {
  filterLeadBookingsByScope,
  resolveTeachingActorId,
  sortLeadBookingsDesc,
} from '@/utils/trial-booking-scope';

type StatusTab = 'all' | Exclude<LeadBookingStatus, 'pending'>;

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'confirmed', label: '已预约' },
  { key: 'completed', label: '已完成' },
  { key: 'no_show', label: '未到店' },
  { key: 'cancelled', label: '已取消' },
];

function getCardTitle(item: LeadBooking): string {
  // 一对一只展示课程名，绝不展示班级
  if (item.trial_mode === 'private') {
    return item.course_name || '一对一试听';
  }
  return item.class_name || item.course_name || '跟班试听';
}

function TrialRecordCard({
  item,
  onOpenLead,
}: {
  item: LeadBooking;
  onOpenLead: (leadId: string) => void;
}) {
  const statusMeta = LEAD_BOOKING_STATUS_META[item.status];
  const modeLabel = getLeadBookingModeLabel(item);
  const title = getCardTitle(item);
  const showOwner =
    Boolean(item.owner_teacher_name) &&
    item.owner_teacher_id &&
    item.teacher_id &&
    item.owner_teacher_id !== item.teacher_id;

  const handlePhone = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      if (!item.parent_phone) return;
      Taro.makePhoneCall({
        phoneNumber: item.parent_phone,
        fail: (err) => {
          // 用户取消拨号不提示
          if (String(err?.errMsg || '').includes('cancel')) return;
          Taro.showToast({ title: '无法拨打电话', icon: 'none' });
        },
      });
    },
    [item.parent_phone],
  );

  return (
    <View
      className="rounded-[24rpx] bg-card px-[28rpx] py-[24rpx] shadow-soft active:opacity-90"
      onClick={() => onOpenLead(item.lead_id)}
    >
      <View className="flex items-start gap-[16rpx]">
        <Avatar name={item.child_name || '试'} size="md" fallback="initial" />
        <View className="min-w-0 flex-1">
          <View className="flex items-center justify-between gap-[12rpx]">
            <View className="min-w-0 flex flex-row items-center gap-[12rpx]">
              <Text className="truncate text-[30rpx] font-semibold text-foreground">
                {item.child_name || '试听学员'}
              </Text>
              <View className={cn('shrink-0 rounded-full px-[14rpx] py-[4rpx]', statusMeta.className)}>
                <Text className="text-[22rpx] font-bold">{statusMeta.label}</Text>
              </View>
            </View>
            {item.parent_phone ? (
              <View
                className="flex h-[56rpx] w-[56rpx] shrink-0 items-center justify-center active:opacity-60"
                onClick={handlePhone}
              >
                <Icon name="mdi-phone" size={28} color="primary" />
              </View>
            ) : null}
          </View>

          <View className="mt-[10rpx] flex flex-row flex-wrap items-center gap-[8rpx]">
            <View className={LEAD_BOOKING_MODE_BADGE_CLASS}>
              <Text className="text-[20rpx] text-muted-foreground">{modeLabel}</Text>
            </View>
          </View>

          <Text className="mt-[12rpx] block text-[26rpx] font-medium text-foreground">{title}</Text>
          <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
            {dayjs(item.lesson_date).format('MM-DD')} {item.start_time}-{item.end_time}
            {item.room ? ` · ${item.room}` : ''}
          </Text>

          <View className="mt-[14rpx] border-t border-border/40 pt-[14rpx]">
            <Text className="block text-[24rpx] text-foreground">
              试听老师 · {item.teacher_name || '未指定'}
            </Text>
            {showOwner ? (
              <Text className="mt-[4rpx] block text-[24rpx] text-muted-foreground">
                归属老师 · {item.owner_teacher_name}
              </Text>
            ) : null}
            {item.note ? (
              <Text className="mt-[4rpx] block text-[24rpx] text-muted-foreground">
                备注 · {item.note}
              </Text>
            ) : null}
            {item.parent_name || item.parent_phone ? (
              <Text className="mt-[4rpx] block text-[22rpx] text-muted-foreground">
                {[item.parent_name, item.parent_phone].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const TrialRecordsPage: React.FC = () => {
  useCardNavigationBar();
  const { profile } = useAuth();
  const currentCampusId = useCampusStore((s) => s.currentCampusId);
  const role = profile?.currentContext?.role;
  const teachingActorId = resolveTeachingActorId(profile);

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
    if (!isStaffRole(role)) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const canLoadPrincipal = isPrincipalOrAbove(role);
    const canLoadTeacher = Boolean(teachingActorId);
    if (!canLoadPrincipal && !canLoadTeacher) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const raw = canLoadPrincipal
        ? await leadService.getLeadBookingsByCampus(currentCampusId, dateRange)
        : await leadService.getLeadBookingsByTeacher(teachingActorId, dateRange);

      const scoped = filterLeadBookingsByScope(raw, profile, currentCampusId, 'records');
      setBookings(sortLeadBookingsDesc(scoped));
    } catch (err) {
      logError('trial-records load', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [currentCampusId, dateRange, profile, role, teachingActorId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

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

  const handleOpenLead = useCallback((leadId: string) => {
    if (!leadId) {
      Taro.showToast({ title: '未关联线索', icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: `/package-lead/pages/lead-detail/index?id=${encodeURIComponent(leadId)}`,
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
      <View className="bg-white border-b border-border/40">
        <View className="flex flex-row">
          {STATUS_TABS.map((tab, index) => {
            const active = statusTab === tab.key;
            return (
              <View
                key={tab.key}
                className="relative flex-1 flex items-center justify-center py-[28rpx]"
                onClick={() => setStatusTab(tab.key)}
              >
                {index > 0 ? (
                  <View className="absolute left-0 top-1/2 h-[28rpx] w-[2rpx] -translate-y-1/2 bg-border" />
                ) : null}
                <Text
                  className={cn(
                    'text-[28rpx] font-medium',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {tab.label}
                </Text>
                {active ? (
                  <View className="absolute bottom-0 left-0 right-0 h-[4rpx] bg-primary" />
                ) : null}
              </View>
            );
          })}
        </View>
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
              <TrialRecordCard key={item.id} item={item} onOpenLead={handleOpenLead} />
            ))}
          </View>
        </ScrollView>
      )}
    </PageContainer>
  );
};

export default withRouteGuard(TrialRecordsPage);
