import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo, useState, useEffect } from 'react';
import Icon from '@/components/Icon';
import type { Schedule, CourseStatus } from '@/types/schedule';

export interface TodayScheduleCardProps {
  schedules: Schedule[];
  /** 卡片标题，默认"今日课表" */
  title?: string;
}

// ===================== 时间区统一配色 =====================
// 设计稿中课程数据无 type 字段，所有卡片时间区统一使用橙色配色
// 仅通过状态覆盖背景（urgent 渐变、done/ended #fafafa）
const TIME_AREA_STYLE = {
  bg: 'course-time-normal',
  text: 'text-[hsl(var(--warning))]',
  border: 'border-[hsl(var(--warning)/0.3)]',
};

// ===================== 状态排序权重 =====================
const STATUS_ORDER: Record<CourseStatus, number> = {
  urgent: 0,
  active: 1,
  upcoming: 2,
  done: 3,
  ended: 4,
};

// ===================== 状态 → 按钮文案 =====================
function getBtnText(status: CourseStatus): string {
  if (status === 'ended' || status === 'done') return '查看';
  if (status === 'urgent') return '立即点名';
  if (status === 'active') return '继续点名';
  return '点名';
}

// ===================== 状态 → 按钮样式 =====================
function getBtnClass(status: CourseStatus): string {
  if (status === 'urgent') return 'course-btn-urgent animate-pulse-ring';
  if (status === 'upcoming' || status === 'active') return 'course-btn-normal';
  return 'course-btn-view';
}

// ===================== 状态 → 进度条样式 =====================
function getProgressClass(status: CourseStatus): string {
  if (status === 'done') return 'course-progress-done';
  if (status === 'ended') return 'course-progress-ended';
  return 'course-progress-active';
}

// ===================== 状态 → 卡片边框 =====================
function getStatusBorderClass(status: CourseStatus): string {
  if (status === 'urgent') return 'course-status-urgent-border';
  if (status === 'done') return 'course-status-done-border';
  if (status === 'ended') return 'course-status-ended-border';
  return '';
}

// ===================== 状态 → 左侧时间区背景 =====================
function getTimeBgClass(status: CourseStatus): string {
  if (status === 'urgent') return 'course-time-urgent-v14';
  if (status === 'ended') return 'course-time-ended-v14';
  if (status === 'done') return 'course-time-done-v14';
  return '';
}

// ===================== 状态 → 卡片整体透明度 =====================
// 设计稿中 done/ended 的 opacity 作用在整张卡片上
function getCardOpacity(status: CourseStatus): string {
  if (status === 'done') return 'opacity-85';
  if (status === 'ended') return 'opacity-75';
  return '';
}

// ===================== 状态 → 课程名颜色 =====================
function getNameClass(status: CourseStatus): string {
  if (status === 'done') return 'course-name-done';
  if (status === 'ended') return 'course-name-ended';
  return 'course-name-active';
}

// ===================== 倒计时文本 =====================
/** 根据排课开始时间计算倒计时文本，返回 null 表示无需显示 */
function getCountdownText(startTime: string): string | null {
  const now = new Date();
  const [h, m] = startTime.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const diffMin = Math.ceil(diffMs / 60000);
  if (diffMin > 30) return null; // 超过30分钟不显示
  if (diffMin <= 5) return `⏱ 还有${diffMin}分钟`;
  return `⏱ ${diffMin}分钟后`;
}

/**
 * TodayScheduleCard - 今日课表卡片 v3
 *
 * 对齐设计稿 course_app_home_v3.html：
 * - 左右分栏布局：左侧时间区（课程类型配色）+ 右侧内容区
 * - 5 种课程状态（urgent/upcoming/active/done/ended）视觉差异
 * - 状态标签、进度条、操作按钮随状态变化
 * - 按状态权重排序展示
 *
 * 使用场景：教师端首页今日课表区域
 */
const TodayScheduleCard: React.FC<TodayScheduleCardProps> = ({ schedules, title = '今日课表' }) => {
  // 按状态权重排序
  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      const orderA = STATUS_ORDER[a.status || 'upcoming'] ?? 2;
      const orderB = STATUS_ORDER[b.status || 'upcoming'] ?? 2;
      return orderA - orderB;
    });
  }, [schedules]);

  // 倒计时每分钟刷新
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  if (schedules.length === 0) {
    return (
      <View className="px-[28rpx] mt-[24rpx] mb-[16rpx] bg-card">
        {title ? (
          <Text className="text-[28rpx] font-bold text-foreground mb-[20rpx] block">{title}</Text>
        ) : null}
        <View className="bg-card rounded-[24rpx] shadow-card py-[48rpx] flex flex-col items-center">
          <Icon name="mdi-clipboard-text" size="lg" color="muted" />
          <Text className="text-[24rpx] text-muted-foreground mt-[12rpx]">暂无排课记录</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="px-[28rpx] mt-[24rpx] mb-[16rpx] bg-card">
      {title ? (
        <Text className="text-[28rpx] font-bold text-foreground mb-[20rpx] block">{title}</Text>
      ) : null}

      <View className="flex flex-col gap-[20rpx]">
        {sortedSchedules.map((item) => {
          const status: CourseStatus = item.status || 'upcoming';
          // 设计稿中 name 对应 note 字段（班级/课程名称），优先级：note > class_info.name > 未命名
          const displayName = item.note || item.class_info?.name || '未命名';
          const teacherName = item.teacher_name || '老师';
          const checked = item.checked_count || 0;
          const total = item.total_count || 0;
          const progressPercent = total > 0 ? Math.round((checked / total) * 100) : 0;
          const isEnded = status === 'ended';
          const isDone = status === 'done';

          return (
            <View
              key={item.id}
              className={cn(
                'bg-card rounded-[24rpx] overflow-hidden shadow-card press-scale',
                getStatusBorderClass(status),
                getCardOpacity(status),
              )}
              onClick={() => {
                if (item.tag) {
                  Taro.navigateTo({
                    url: `/pages/booking/index?date=${encodeURIComponent(dayjs().format('YYYY-MM-DD'))}`,
                  });
                  return;
                }

                Taro.navigateTo({
                  url: `/package-course/pages/lesson-form/index?scheduleId=${item.id}`,
                });
              }}
            >
              <View className="flex">
                {/* 左侧时间区 - 设计稿统一橙色配色，仅状态覆盖背景 */}
                <View
                  className={cn(
                    'w-[152rpx] shrink-0 flex flex-col items-center justify-center py-[24rpx] border-r',
                    TIME_AREA_STYLE.bg,
                    TIME_AREA_STYLE.border,
                    getTimeBgClass(status),
                  )}
                >
                  <Text className={cn('text-[24rpx] font-bold', TIME_AREA_STYLE.text)}>
                    {item.start_time}
                  </Text>
                  {/* 分割线 - 设计稿统一 bg-orange-200 */}
                  <View className="w-[16rpx] h-[2rpx] my-[4rpx] bg-[hsl(var(--warning)/0.3)]" />
                  <Text className={cn('text-[24rpx] font-bold opacity-60', TIME_AREA_STYLE.text)}>
                    {item.end_time}
                  </Text>
                </View>

                {/* 右侧内容区 - 对齐设计稿 px-3=24rpx py-3=24rpx */}
                <View className="flex-1 px-[24rpx] py-[24rpx] flex items-center justify-between gap-[16rpx]">
                  <View className="min-w-0 flex-1">
                    {/* 课程名 + 标签 */}
                    <View className="flex items-center gap-[12rpx] mb-[8rpx]">
                      <Text className={cn('text-[30rpx] font-bold truncate', getNameClass(status))}>
                        {displayName}
                      </Text>
                      {/* 状态标签 - 对齐设计稿 px-1.5=6rpx py-0.5=2rpx text-[10px]=20rpx */}
                      {isDone && (
                        <View className="course-tag-done rounded px-[6rpx] py-[2rpx]">
                          <Text className="text-[20rpx] font-medium">已完成</Text>
                        </View>
                      )}
                      {isEnded && (
                        <View className="course-tag-ended rounded px-[6rpx] py-[2rpx]">
                          <Text className="text-[20rpx] font-medium">已下课</Text>
                        </View>
                      )}
                      {/* 非done/ended状态显示约课标签 */}
                      {!isDone && !isEnded && item.tag && (
                        <View className="course-tag-booking rounded px-[6rpx] py-[2rpx]">
                          <Text className="text-[20rpx] font-medium">{item.tag}</Text>
                        </View>
                      )}
                      {/* ended状态也显示约课标签但半透明 */}
                      {isEnded && item.tag && (
                        <View className="course-tag-booking rounded px-[6rpx] py-[2rpx] opacity-70">
                          <Text className="text-[20rpx] font-medium">{item.tag}</Text>
                        </View>
                      )}
                    </View>

                    {/* 老师 + 教室 - 对齐设计稿 text-[11px]=22rpx gap-3=24rpx */}
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

                    {/* 点名进度 - ended状态用灰色文字 */}
                    <View className="flex items-center gap-[16rpx] mt-[16rpx]">
                      <Text
                        className={cn(
                          'text-[22rpx]',
                          isEnded ? 'course-meta-ended' : 'course-meta-text',
                        )}
                      >
                        已点名{' '}
                        <Text
                          className={cn(
                            'font-semibold',
                            isDone
                              ? 'course-checkin-done'
                              : isEnded
                                ? 'course-checkin-ended'
                                : 'course-checkin-active',
                          )}
                        >
                          {checked}/{total}
                        </Text>
                      </Text>
                      <View className="w-[96rpx] h-[6rpx] course-progress-track rounded-full overflow-hidden">
                        <View
                          className={cn('h-full rounded-full', getProgressClass(status))}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </View>
                    </View>
                  </View>

                  {/* 操作按钮 - 对齐设计稿 px-4=32rpx py-1.5=12rpx text-[12px]=24rpx */}
                  <View className="shrink-0 flex flex-col items-end gap-[8rpx]">
                    {status === 'urgent' && getCountdownText(item.start_time) && (
                      <Text className="text-[20rpx] course-urgent-hint font-medium">
                        {getCountdownText(item.start_time)}
                      </Text>
                    )}
                    <View
                      className={cn(
                        'px-[32rpx] py-[12rpx] rounded-full text-[24rpx] font-semibold press-scale',
                        getBtnClass(status),
                      )}
                    >
                      <Text>{getBtnText(status)}</Text>
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
