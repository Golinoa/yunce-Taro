import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import Icon from '@/components/Icon';
import type { Schedule, ScheduleColor } from '@/types/schedule';

interface ScheduleTimelineProps {
  schedules: Schedule[];
}

// 排课颜色主题（对齐 theme.ts scheduleColors，使用 hsla 引用 CSS 变量）
const colorMap: Record<ScheduleColor, { bg: string; text: string }> = {
  primary: { bg: 'hsl(var(--primary) / 0.25)', text: 'hsl(var(--primary) / 0.85)' },
  info: { bg: 'hsl(var(--info) / 0.25)', text: 'hsl(var(--info) / 0.85)' },
  accent: { bg: 'hsl(var(--accent) / 0.25)', text: 'hsl(var(--accent) / 0.85)' },
  lavender: { bg: 'hsl(var(--petal-purple) / 0.25)', text: 'hsl(var(--petal-purple) / 0.85)' },
};

const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({ schedules }) => {
  if (schedules.length === 0) {
    return (
      <View className="flex flex-col items-center py-6">
        <Icon name="mdi-clipboard-text" size="lg" color="muted" />
        <Text className="text-base text-muted-foreground">今日暂无排课</Text>
      </View>
    );
  }

  return (
    <View className="flex flex-col">
      {schedules.map((item, index) => {
        const color = colorMap[item.color || 'primary'];
        const displayName = item.student?.name || item.class_info?.name || '未命名';
        const isLast = index === schedules.length - 1;

        return (
          <View
            key={item.id}
            className="flex items-start min-h-30 active:opacity-85"
            onClick={() =>
              Taro.navigateTo({
                url: `/package-course/pages/lesson-form/index?scheduleId=${item.id}`,
              })
            }
          >
            <View className="w-6 min-w-6 flex flex-col items-end pt-1">
              <Text className="text-sm text-muted-foreground font-medium">{item.start_time}</Text>
              {!isLast && <View className="w-0_d5 flex-1 bg-border mt-1" />}
            </View>

            <View className="w-2 min-w-2 flex flex-col items-center pt-1_d5">
              <View
                className="w-1 h-1 rounded-full flex-shrink-0"
                style={{ backgroundColor: color.text }}
              />
              {!isLast && <View className="w-0_d5 flex-1 bg-border mt-1" />}
            </View>

            <View
              className="flex-1 ml-2 mb-2 px-3 py-2_d5 rounded-lg"
              style={{ backgroundColor: color.bg }}
            >
              <View className="flex items-center justify-between mb-1">
                <Text className="text-lg font-semibold" style={{ color: color.text }}>
                  {displayName}
                </Text>
                <View className="px-2 py-0_d5 rounded-full" style={{ backgroundColor: color.text }}>
                  <Text className="text-xs text-white font-medium">{item.note || '课程'}</Text>
                </View>
              </View>
              <Text className="text-sm opacity-80" style={{ color: color.text }}>
                {item.start_time} - {item.end_time}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default ScheduleTimeline;
