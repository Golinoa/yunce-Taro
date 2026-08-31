import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo } from 'react';
import Icon from '@/components/Icon';
import ParentGlassShell from '@/components/home/ParentGlassShell';
import type { Schedule } from '@/types/schedule';

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
/** 首页竖排最多展示 2 张，刚好一屏内看完 */
const HOME_VISIBLE_COUNT = 2;

export interface ParentScheduleSectionProps {
  schedules: Schedule[];
  /** 用于 scroll-into-view 定位 */
  sectionId?: string;
}

function formatWeekday(dayOfWeek?: number): string {
  if (!dayOfWeek) {
    const jsDay = new Date().getDay();
    return WEEKDAY_LABELS[jsDay];
  }
  if (dayOfWeek === 7) return WEEKDAY_LABELS[0];
  return WEEKDAY_LABELS[dayOfWeek] || WEEKDAY_LABELS[new Date().getDay()];
}

/**
 * 家长端首页「我的课表」
 * 竖排紧凑卡片，默认展示 2 张，无需左右滑动
 */
const ParentScheduleSection: React.FC<ParentScheduleSectionProps> = ({
  schedules,
  sectionId = 'parent-schedule',
}) => {
  const sorted = useMemo(
    () => [...schedules].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [schedules],
  );
  const visible = sorted.slice(0, HOME_VISIBLE_COUNT);
  const hasMore = sorted.length > HOME_VISIBLE_COUNT;

  const handleGo = () => {
    Taro.switchTab({ url: '/pages/schedule/index' });
  };

  return (
    <ParentGlassShell sectionId={sectionId} title="我的课表" className="mt-[8rpx]">
      {sorted.length === 0 ? (
        <View className="parent-glass-inner flex flex-col items-center px-[24rpx] py-[40rpx]">
          <Icon name="mdi-calendar-blank-outline" size="lg" color="muted" />
          <Text className="mt-[12rpx] text-[24rpx] text-muted-foreground">今日暂无课程</Text>
          <View
            className="mt-[20rpx] rounded-full bg-primary/10 px-[28rpx] py-[12rpx] press-scale"
            onClick={handleGo}
          >
            <Text className="text-[24rpx] font-medium text-primary">去课表看看</Text>
          </View>
        </View>
      ) : (
        <View className="flex flex-col gap-[12rpx]">
          {visible.map((item) => {
            const title = item.note || item.class_info?.name || '未命名课程';
            const teacher = item.teacher_name || '授课老师';
            const timeLabel = `${formatWeekday(item.day_of_week)} ${item.start_time}-${item.end_time}`;
            const tag = item.category_label;

            return (
              <View
                key={item.id}
                className="parent-glass-inner flex flex-row items-center px-[20rpx] py-[16rpx] press-scale"
                onClick={handleGo}
              >
                <View className="min-w-0 flex-1">
                  <View className="mb-[8rpx] flex flex-row items-center gap-[10rpx]">
                    <Text className="min-w-0 flex-1 truncate text-[26rpx] font-bold text-foreground">
                      {title}
                    </Text>
                    {tag ? (
                      <View className="shrink-0 rounded-full bg-primary/10 px-[10rpx] py-[2rpx]">
                        <Text className="text-[18rpx] text-primary">{tag}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View className="flex flex-row flex-wrap items-center gap-x-[16rpx] gap-y-[4rpx]">
                    <View className="flex flex-row items-center gap-[6rpx]">
                      <Icon name="mdi-account-outline" size={18} color="muted" />
                      <Text className="text-[20rpx] text-muted-foreground">{teacher}</Text>
                    </View>
                    <View className="flex flex-row items-center gap-[6rpx]">
                      <Icon name="mdi-clock-outline" size={18} color="muted" />
                      <Text className="text-[20rpx] text-muted-foreground">{timeLabel}</Text>
                    </View>
                  </View>
                </View>
                <View className="ml-[12rpx] flex h-[56rpx] w-[56rpx] flex-shrink-0 items-center justify-center rounded-full bg-primary">
                  <Text className="text-[18rpx] font-bold text-white">GO</Text>
                </View>
              </View>
            );
          })}
          {hasMore ? (
            <View className="flex items-center justify-center py-[4rpx] press-scale" onClick={handleGo}>
              <Text className="text-[22rpx] text-primary">还有 {sorted.length - HOME_VISIBLE_COUNT} 节 · 查看全部</Text>
            </View>
          ) : null}
        </View>
      )}
    </ParentGlassShell>
  );
};

export default ParentScheduleSection;
