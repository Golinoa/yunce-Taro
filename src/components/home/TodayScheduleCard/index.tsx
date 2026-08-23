import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo, useState, useEffect } from 'react';
import Icon from '@/components/Icon';
import { classColorHex } from '@/theme';
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
  unattended: 3, // 已下课未点名（提醒色，权重在 done 之前）
  done: 4,
  ended: 5,
};

// ===================== 状态 → 按钮文案 =====================
function getBtnText(status: CourseStatus): string {
  // 用户口径（2026-08-23）：未点名沿用形态1，按钮文案统一「点名」（红框+标签已提醒）
  if (status === 'done') return '查看';
  if (status === 'urgent') return '立即点名';
  if (status === 'active') return '继续点名';
  return '点名';
}

// ===================== 状态 → 按钮样式 =====================
function getBtnClass(status: CourseStatus): string {
  if (status === 'urgent') return 'course-btn-urgent animate-pulse-ring';
  if (status === 'upcoming' || status === 'active' || status === 'unattended') {
    return 'course-btn-normal';
  }
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
  // 未点名：仅加细红边框提醒（用户口径 2026-08-23，样式收敛为形态1）
  if (status === 'unattended') return 'course-status-unattended-border';
  if (status === 'done') return 'course-status-done-border';
  if (status === 'ended') return 'course-status-ended-border';
  return '';
}

// ===================== 状态 → 左侧时间区背景 =====================
function getTimeBgClass(status: CourseStatus): string {
  if (status === 'urgent') return 'course-time-urgent-v14';
  if (status === 'done') return 'course-time-done-v14';
  if (status === 'ended') return 'course-time-ended-v14';
  return '';
}

// ===================== 状态 → 卡片整体透明度 =====================
// 用户口径（2026-08-23）：done 卡片加强可见（不再 opacity-85 灰显）；
// 未点名沿用形态1（不透明）；ended/cancelled 保持淡化
function getCardOpacity(status: CourseStatus): string {
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
          // 设计稿中 name 对应 note 字段（班级/课程名称），优先级：note > class_info.name > 未命名
          const displayName = item.note || item.class_info?.name || '未命名';
          const teacherName = item.teacher_name || '老师';
          const checked = item.checked_count || 0;
          const total = item.total_count || 0;
          const progressPercent = total > 0 ? Math.round((checked / total) * 100) : 0;
          const isEnded = status === 'ended';
          const isDone = status === 'done';
          const isUnattended = status === 'unattended';

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
                {/* 左侧时间区 - 优先班级颜色（排课 color），无 color 时回退统一橙色；状态覆盖仍生效 */}
                {(() => {
                  const timeStatusClass = getTimeBgClass(status);
                  // 状态（urgent/done/ended）有专属背景时优先状态色；否则用班级颜色；再回退橙色
                  const colorKey =
                    !timeStatusClass && item.color && classColorHex[item.color] ? item.color : null;
                  const colorHex = colorKey ? classColorHex[colorKey] : '';
                  const colorStyle = colorKey
                    ? {
                        backgroundColor: `${colorHex}40`,
                        borderColor: colorHex,
                      }
                    : undefined;
                  const timeTextClass = colorKey ? '' : TIME_AREA_STYLE.text;
                  const timeTextStyle = colorKey ? { color: colorHex } : undefined;
                  return (
                    <View
                      className={cn(
                        // 用户口径（2026-08-23）：左侧时间区收窄到 100rpx（原 152rpx 的 2/3，取双数整数）
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
                      {/* 分割线：无班级颜色时用统一橙色，有班级颜色时用班级色覆盖 */}
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

                {/* 右侧内容区 - 对齐设计稿 px-3=24rpx py-3=24rpx */}
                <View className="flex-1 px-[24rpx] py-[24rpx] flex items-center justify-between gap-[16rpx]">
                  <View className="min-w-0 flex-1">
                    {/* 课程名 + 标签 */}
                    <View className="flex items-center gap-[12rpx] mb-[8rpx]">
                      <Text className={cn('text-[30rpx] font-bold truncate', getNameClass(status))}>
                        {displayName}
                      </Text>
                      {/* 状态标签 - 用户口径（2026-08-23）：flex 居中 + 加宽 padding + shrink-0 + nowrap，解决文字不居中/挤压 */}
                      {isUnattended && (
                        <View className="course-tag-unattended rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                          <Text className="text-[20rpx] font-medium">未点名</Text>
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
                      {/* 非 done/ended/unattended 状态显示约课标签 */}
                      {!isDone && !isEnded && !isUnattended && item.tag && (
                        <View className="course-tag-booking rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                          <Text className="text-[20rpx] font-medium">{item.tag}</Text>
                        </View>
                      )}
                      {/* ended 状态也显示约课标签但半透明 */}
                      {isEnded && item.tag && (
                        <View className="course-tag-booking rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx] opacity-70">
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

                    {/* 点名进度 - ended 状态用灰色文字；done 显示签到/未到/请假明细 */}
                    {isDone ? (
                      <View className="flex items-center gap-[16rpx] text-[22rpx]">
                        <Text className="course-checkin-done">
                          签到 {checked}
                          <Text className="text-muted-foreground">
                            {' '}
                            · 未到 {item.absent_count || 0}
                          </Text>
                          <Text className="text-muted-foreground">
                            {' '}
                            · 请假 {item.leave_count || 0}
                          </Text>
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
                          已点名{' '}
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

                  {/* 操作按钮 - 对齐设计稿 px-4=32rpx py-1.5=12rpx text-[12px]=24rpx
                      用户口径（2026-08-23）：按钮列垂直居中，避免按钮贴顶靠上 */}
                  <View className="shrink-0 flex flex-col items-end justify-center gap-[8rpx]">
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
