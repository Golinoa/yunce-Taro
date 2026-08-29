import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import Icon from '@/components/Icon';
import { classColorHex } from '@/theme';
import type { Schedule, CourseStatus } from '@/types/schedule';

export interface TodayScheduleCardProps {
  schedules: Schedule[];
  /** 卡片标题，默认"今日课表" */
  title?: string;
  /** 私教预约一键签到（不跳转） */
  onPrivateCheckIn?: (bookingId: string) => Promise<void>;
  /** 场地预约确认到场 */
  onVenueCheckIn?: (venueBookingId: string) => Promise<void>;
}

const TIME_AREA_STYLE = {
  bg: 'course-time-normal',
  text: 'text-[hsl(var(--warning))]',
  border: 'border-[hsl(var(--warning)/0.3)]',
};

const STATUS_ORDER: Record<CourseStatus, number> = {
  urgent: 0,
  active: 1,
  upcoming: 2,
  unattended: 3,
  done: 4,
  ended: 5,
};

function getBtnText(status: CourseStatus, item: Schedule): string {
  if (item.schedule_kind === 'venue') {
    return status === 'done' ? '已确认' : '确认到场';
  }
  if (item.trial_mode === 'private') {
    return status === 'done' ? '已签到' : '签到';
  }
  if (status === 'done') return '查看';
  if (status === 'urgent') return '立即点名';
  return '点名';
}

function getBtnClass(status: CourseStatus, item: Schedule): string {
  if (item.trial_mode === 'private' || item.schedule_kind === 'venue') {
    if (status === 'done') return 'course-btn-view';
    return 'course-btn-normal';
  }
  if (status === 'urgent') return 'course-btn-urgent animate-pulse-ring';
  if (status === 'upcoming' || status === 'active' || status === 'unattended') {
    return 'course-btn-normal';
  }
  return 'course-btn-view';
}

function getProgressClass(status: CourseStatus): string {
  if (status === 'done') return 'course-progress-done';
  if (status === 'ended') return 'course-progress-ended';
  return 'course-progress-active';
}

function getStatusBorderClass(status: CourseStatus): string {
  if (status === 'urgent') return 'course-status-urgent-border';
  if (status === 'active') return 'course-status-active-border';
  if (status === 'unattended') return 'course-status-unattended-border';
  if (status === 'done') return 'course-status-done-border';
  if (status === 'ended') return 'course-status-ended-border';
  return '';
}

function getTimeBgClass(status: CourseStatus): string {
  if (status === 'urgent') return 'course-time-urgent-v14';
  if (status === 'active') return 'course-time-active-v14';
  if (status === 'done') return 'course-time-done-v14';
  if (status === 'ended') return 'course-time-ended-v14';
  return '';
}

function getCardOpacity(status: CourseStatus): string {
  if (status === 'ended') return 'opacity-75';
  return '';
}

function getNameClass(status: CourseStatus): string {
  if (status === 'done') return 'course-name-done';
  if (status === 'ended') return 'course-name-ended';
  return 'course-name-active';
}

function getCountdownText(startTime: string): string | null {
  const now = new Date();
  const [h, m] = startTime.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const diffMin = Math.ceil(diffMs / 60000);
  if (diffMin > 30) return null;
  if (diffMin <= 5) return `⏱ 还有${diffMin}分钟`;
  return `⏱ ${diffMin}分钟后`;
}

function navigateToSchedule(item: Schedule): void {
  const lessonDate = dayjs().format('YYYY-MM-DD');

  if (item.schedule_kind === 'venue' && item.room_id) {
    Taro.navigateTo({
      url: `/package-course/pages/venue-booking/index?roomId=${encodeURIComponent(item.room_id)}`,
    });
    return;
  }

  const bookingId = item.booking_id;
  if (bookingId && item.trial_mode !== 'private') {
    Taro.navigateTo({
      url:
        `/package-course/pages/lesson-form/index?classId=${encodeURIComponent(item.class_id || '')}` +
        `&lessonDate=${encodeURIComponent(lessonDate)}` +
        `&lessonTime=${encodeURIComponent(item.start_time)}` +
        `&hasTrialStudent=1`,
    });
    return;
  }

  if (item.tag) {
    Taro.navigateTo({
      url: `/package-course/pages/booking/index?date=${encodeURIComponent(lessonDate)}`,
    });
    return;
  }

  Taro.navigateTo({
    url:
      `/package-course/pages/lesson-form/index?scheduleId=${encodeURIComponent(item.id)}` +
      `&classId=${encodeURIComponent(item.class_id || '')}` +
      `&lessonDate=${encodeURIComponent(lessonDate)}` +
      `&hasTrialStudent=${item.has_trial_student ? '1' : '0'}`,
  });
}

const TodayScheduleCard: React.FC<TodayScheduleCardProps> = ({
  schedules,
  title = '今日课表',
  onPrivateCheckIn,
  onVenueCheckIn,
}) => {
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      const orderA = STATUS_ORDER[a.status || 'upcoming'] ?? 2;
      const orderB = STATUS_ORDER[b.status || 'upcoming'] ?? 2;
      if (orderA !== orderB) return orderA - orderB;
      return a.start_time.localeCompare(b.start_time);
    });
  }, [schedules]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleActionClick = useCallback(
    async (item: Schedule, status: CourseStatus) => {
      if (checkingId) return;

      if (item.trial_mode === 'private' && item.booking_id && status !== 'done') {
        if (!onPrivateCheckIn) return;
        setCheckingId(item.id);
        try {
          await onPrivateCheckIn(item.booking_id);
        } finally {
          setCheckingId(null);
        }
        return;
      }

      if (item.schedule_kind === 'venue' && item.venue_booking_id && status !== 'done') {
        if (!onVenueCheckIn) return;
        setCheckingId(item.id);
        try {
          await onVenueCheckIn(item.venue_booking_id);
        } finally {
          setCheckingId(null);
        }
        return;
      }

      navigateToSchedule(item);
    },
    [checkingId, onPrivateCheckIn, onVenueCheckIn],
  );

  if (schedules.length === 0) {
    return (
      <View className="mt-[24rpx] mb-[16rpx]">
        {title ? (
          <Text className="px-[28rpx] text-[28rpx] font-bold text-foreground mb-[20rpx] block">
            {title}
          </Text>
        ) : null}
        <View className="bg-card rounded-[24rpx] shadow-card py-[48rpx] flex flex-col items-center">
          <Icon name="mdi-clipboard-text" size="lg" color="muted" />
          <Text className="text-[24rpx] text-muted-foreground mt-[12rpx]">暂无排课记录</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mt-[24rpx] mb-[16rpx]">
      {title ? (
        <Text className="px-[28rpx] text-[28rpx] font-bold text-foreground mb-[20rpx] block">
          {title}
        </Text>
      ) : null}

      <View className="flex flex-col gap-[20rpx]">
        {sortedSchedules.map((item) => {
          const status: CourseStatus = item.status || 'upcoming';
          const displayName = item.note || item.class_info?.name || '未命名';
          const teacherName = item.teacher_name || '老师';
          const checked = item.checked_count || 0;
          const total = item.total_count || 0;
          const progressPercent = total > 0 ? Math.round((checked / total) * 100) : 0;
          const isEnded = status === 'ended';
          const isDone = status === 'done';
          const isUnattended = status === 'unattended';
          const isActive = status === 'active';
          const isUrgent = status === 'urgent';
          const countdownText = isUrgent ? getCountdownText(item.start_time) : null;
          const categoryLabel = item.category_label;
          const isInlineCheckIn =
            (item.trial_mode === 'private' && !!item.booking_id) ||
            (item.schedule_kind === 'venue' && !!item.venue_booking_id);
          const progressLabel =
            item.trial_mode === 'private' || item.schedule_kind === 'venue' ? '已签到' : '已点名';

          return (
            <View
              key={item.id}
              className={cn(
                'bg-card rounded-[24rpx] overflow-hidden shadow-card press-scale',
                getStatusBorderClass(status),
                getCardOpacity(status),
              )}
              onClick={() => {
                if (isInlineCheckIn && !isDone) return;
                navigateToSchedule(item);
              }}
            >
              <View className="flex">
                {(() => {
                  const timeStatusClass = getTimeBgClass(status);
                  const forcedStatusStyle: React.CSSProperties | null =
                    status === 'done'
                      ? {
                          backgroundColor: 'hsl(var(--success) / 0.08)',
                          borderRightColor: 'hsl(var(--success) / 0.2)',
                        }
                      : status === 'active'
                        ? {
                            backgroundColor: 'hsl(var(--success) / 0.12)',
                            borderRightColor: 'hsl(var(--success) / 0.35)',
                          }
                        : status === 'urgent'
                          ? {
                              background:
                                'linear-gradient(135deg, hsl(var(--warning)), hsl(var(--warning) / 0.7))',
                              borderRightColor: 'hsl(var(--warning))',
                            }
                          : status === 'ended'
                            ? {
                                background: 'hsl(var(--muted))',
                                borderRightColor: 'hsl(var(--border))',
                              }
                            : null;
                  const colorKey =
                    !forcedStatusStyle &&
                    !timeStatusClass &&
                    item.color &&
                    classColorHex[item.color]
                      ? item.color
                      : null;
                  const colorHex = colorKey ? classColorHex[colorKey] : '';
                  const colorStyle: React.CSSProperties | undefined = forcedStatusStyle
                    ? forcedStatusStyle
                    : colorKey
                      ? {
                          backgroundColor: `${colorHex}40`,
                          borderColor: colorHex,
                        }
                      : undefined;
                  const timeTextClass =
                    status === 'urgent'
                      ? 'text-white'
                      : status === 'active'
                        ? 'text-success'
                        : colorKey
                          ? ''
                          : TIME_AREA_STYLE.text;
                  const timeTextStyle =
                    status === 'urgent'
                      ? undefined
                      : colorKey
                        ? { color: colorHex }
                        : undefined;
                  return (
                    <View
                      className={cn(
                        'w-[100rpx] shrink-0 flex flex-col items-center justify-center py-[24rpx] border-r',
                        !colorKey && TIME_AREA_STYLE.bg,
                        !colorKey && TIME_AREA_STYLE.border,
                        timeStatusClass,
                      )}
                      style={colorStyle}
                    >
                      <Text
                        className={cn('text-[24rpx] font-bold', timeTextClass)}
                        style={timeTextStyle}
                      >
                        {item.start_time}
                      </Text>
                      <View
                        className="w-[16rpx] h-[2rpx] my-[4rpx] bg-[hsl(var(--warning)/0.3)]"
                        style={colorKey ? { backgroundColor: colorHex } : undefined}
                      />
                      <Text
                        className={cn('text-[24rpx] font-bold opacity-60', timeTextClass)}
                        style={timeTextStyle}
                      >
                        {item.end_time}
                      </Text>
                    </View>
                  );
                })()}

                <View className="flex-1 px-[24rpx] py-[24rpx] flex items-center justify-between gap-[16rpx]">
                  <View className="min-w-0 flex-1">
                    <View className="flex items-center gap-[12rpx] mb-[8rpx]">
                      <Text className={cn('text-[30rpx] font-bold truncate', getNameClass(status))}>
                        {displayName}
                      </Text>
                      {isUnattended && (
                        <View className="course-tag-unattended rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                          <Text className="text-[20rpx] font-medium">未点名</Text>
                        </View>
                      )}
                      {isActive && (
                        <View className="course-tag-active rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                          <Text className="text-[20rpx] font-medium">上课中</Text>
                        </View>
                      )}
                      {isDone && (
                        <View className="course-tag-done rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                          <Text className="text-[20rpx] font-medium">已完成</Text>
                        </View>
                      )}
                      {isEnded && (
                        <View className="course-tag-ended rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                          <Text className="text-[20rpx] font-medium">已下课</Text>
                        </View>
                      )}
                      {!isDone && !isEnded && !isUnattended && !isActive && categoryLabel && (
                        <View className="course-tag-booking rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                          <Text className="text-[20rpx] font-medium">{categoryLabel}</Text>
                        </View>
                      )}
                      {!isDone && !isEnded && !isUnattended && !isActive && !categoryLabel && item.tag && (
                        <View className="course-tag-booking rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                          <Text className="text-[20rpx] font-medium">{item.tag}</Text>
                        </View>
                      )}
                      {isEnded && categoryLabel && (
                        <View className="course-tag-booking rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx] opacity-70">
                          <Text className="text-[20rpx] font-medium">{categoryLabel}</Text>
                        </View>
                      )}
                    </View>

                    <View className="flex items-center gap-[24rpx] text-[22rpx] course-meta-text">
                      <View className="flex items-center gap-[4rpx]">
                        <Icon name="mdi-account-outline" size="xs" color="muted" />
                        <Text>{teacherName}</Text>
                      </View>
                      {item.room && (
                        <View className="flex items-center gap-[4rpx]">
                          <Icon name="mdi-map-marker" size="xs" color="muted" />
                          <Text>{item.room}</Text>
                        </View>
                      )}
                    </View>

                    {isDone ? (
                      <View className="flex items-center gap-[16rpx] text-[22rpx]">
                        <Text className="course-checkin-done">
                          {progressLabel} {checked}
                          {item.schedule_kind !== 'venue' && item.trial_mode !== 'private' && (
                            <>
                              <Text className="text-muted-foreground">
                                {' '}
                                · 未到 {item.absent_count || 0}
                              </Text>
                              <Text className="text-muted-foreground">
                                {' '}
                                · 请假 {item.leave_count || 0}
                              </Text>
                            </>
                          )}
                        </Text>
                        <View className="w-[96rpx] h-[6rpx] course-progress-track rounded-full overflow-hidden">
                          <View
                            className={cn('h-full rounded-full', getProgressClass(status))}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </View>
                      </View>
                    ) : (
                      <View className="flex items-center gap-[16rpx] mt-[16rpx]">
                        <Text
                          className={cn(
                            'text-[22rpx]',
                            isEnded ? 'course-meta-ended' : 'course-meta-text',
                          )}
                        >
                          {progressLabel}{' '}
                          <Text
                            className={cn(
                              'font-semibold',
                              isEnded ? 'course-checkin-ended' : 'course-checkin-active',
                            )}
                          >
                            {checked + (item.absent_count || 0) + (item.leave_count || 0)}/{total}
                          </Text>
                        </Text>
                        <View className="w-[96rpx] h-[6rpx] course-progress-track rounded-full overflow-hidden">
                          <View
                            className={cn('h-full rounded-full', getProgressClass(status))}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </View>
                      </View>
                    )}
                  </View>

                  <View className="shrink-0 self-stretch flex flex-col items-end justify-end gap-[8rpx]">
                    {countdownText && (
                      <Text className="text-[20rpx] course-urgent-hint font-medium whitespace-nowrap">
                        {countdownText}
                      </Text>
                    )}
                    <View
                      className={cn(
                        'px-[32rpx] py-[12rpx] rounded-full text-[24rpx] font-semibold press-scale',
                        getBtnClass(status, item),
                        checkingId === item.id && 'opacity-60',
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleActionClick(item, status);
                      }}
                    >
                      <Text>{checkingId === item.id ? '处理中' : getBtnText(status, item)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default TodayScheduleCard;
