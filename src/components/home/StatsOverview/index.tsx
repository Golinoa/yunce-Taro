import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import type { StatsPeriod, StatsData } from '@/services/home';
import { formatAmount } from '@/utils/format';

export type { StatsPeriod, StatsData };

export interface StatsOverviewProps {
  /** 当前选中时段 */
  period: StatsPeriod;
  /** 切换时段 */
  onPeriodChange: (period: StatsPeriod) => void;
  /** 统计数据 */
  data: StatsData;
}

const PERIOD_OPTIONS: { label: string; value: StatsPeriod }[] = [
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '上周', value: 'lastWeek' },
  { label: '本月', value: 'month' },
];

const STAT_ITEMS: { key: keyof StatsData; label: string; isDecimal?: boolean }[] = [
  { key: 'checkinCount', label: '签到次数' },
  { key: 'leaveCount', label: '请假次数' },
  { key: 'lessonHours', label: '点名课时' },
  { key: 'lessonAmount', label: '课消金额', isDecimal: true },
];

/**
 * StatsOverview - 统计概览卡片 v14
 *
 * 对齐设计稿 index_v14.html stats-card：
 * - 白色背景 + 圆角 40rpx
 * - Tab: 蓝色 active (primary/10 + primary-dark)，灰色 inactive (muted + muted-foreground)
 * - "更多"按钮：主题蓝色
 * - 数据网格 4列，数字 40rpx bold foreground，标签 18rpx muted-foreground
 */
const StatsOverview: React.FC<StatsOverviewProps> = ({ period, onPeriodChange, data }) => {
  return (
    <View className="bg-card rounded-[40rpx] shadow-card px-[28rpx] py-[20rpx] relative z-10">
      {/* 时段 Tab + 更多按钮 */}
      <View className="flex items-center gap-[12rpx] mb-[16rpx]">
        <View className="flex items-center gap-[12rpx] flex-1 overflow-x-auto no-scrollbar">
          {PERIOD_OPTIONS.map((opt) => (
            <View
              key={opt.value}
              className={cn(
                'py-[14rpx] px-[22rpx] rounded-[28rpx] text-[28rpx] min-w-[88rpx] text-center shrink-0 transition-all duration-200',
                period === opt.value ? 'stats-tab-active-v14' : 'stats-tab-inactive-v14',
              )}
              onClick={() => onPeriodChange(opt.value)}
            >
              <Text>{opt.label}</Text>
            </View>
          ))}
        </View>
        {/* 更多按钮 - 主题蓝色 */}
        <View
          className="flex items-center gap-[4rpx] bg-[hsl(var(--primary)/0.1)] px-[20rpx] py-[10rpx] rounded-[24rpx] shrink-0 active:bg-[hsl(var(--primary)/0.15)] transition-colors duration-200"
          onClick={() => {
            Taro.setStorageSync('statisticsViewType', 'finance');
            Taro.switchTab({ url: '/pages/statistics/index' });
          }}
        >
          <Text className="text-[24rpx] font-semibold text-foreground">更多</Text>
          <Icon name="mdi-chevron-right" size="xs" color="foreground" />
        </View>
      </View>

      {/* 数据网格 */}
      <View className="grid grid-cols-4 text-center gap-[4rpx]">
        {STAT_ITEMS.map((item) => (
          <View key={item.key} className="flex flex-col items-center">
            <Text className="text-[40rpx] font-extrabold text-foreground leading-tight mb-[2rpx]">
              {item.isDecimal ? formatAmount(data[item.key] as number) : data[item.key]}
            </Text>
            <Text className="text-[18rpx] text-muted-foreground font-medium">{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default StatsOverview;
