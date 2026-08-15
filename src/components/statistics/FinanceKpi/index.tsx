import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';

/** 财务 KPI 数据项 */
export interface FinanceKpiItem {
  /** 本月营收 */
  revenue: string;
  /** 营收徽章（如 +12.5% 环比） */
  revenueBadge: string;
  /** 收费笔数 */
  bills: string;
  /** 客单价 */
  avg: string;
  /** 课消金额 */
  lessonAmount: string;
  /** 课消趋势 */
  lessonTrend: string;
  /** 新签金额 */
  newAmount: string;
  /** 新签备注 */
  newNote: string;
  /** 待收金额 */
  pending: string;
  /** 待收备注 */
  pendingNote: string;
  /** 总收入 */
  totalRevenue: string;
  /** 总支出 */
  totalExpense: string;
  /** 净利润 */
  netProfit: string;
  /** 利润率 */
  profitMargin: string;
}

/**
 * 财务 KPI 组件
 * 大营收卡（蓝色渐变）+ 4 小卡（课消/新签/待收/总支出）+ 收支利润概览（总收入-总支出=净利润）
 * 对齐设计稿 scheme-bc-fusion-v2.html
 */
const FinanceKpi: React.FC<{ data: FinanceKpiItem }> = ({ data }) => {
  return (
    <View className="mb-[32rpx]">
      {/* 大营收卡片（深色渐变，对齐设计稿 v3） */}
      <View className="bg-finance-dark rounded-[48rpx] p-[48rpx] relative overflow-hidden mb-[32rpx]">
        {/* 装饰圆 */}
        <View className="absolute -top-[80rpx] -right-[80rpx] w-[256rpx] h-[256rpx] rounded-full bg-primary-foreground/10" />
        <View className="absolute top-[160rpx] -right-[32rpx] w-[128rpx] h-[128rpx] rounded-full bg-primary-foreground/10" />

        <View className="relative z-10">
          <View className="flex items-center gap-[16rpx] mb-[24rpx]">
            <Text className="text-[24rpx] font-medium text-primary-foreground/60 uppercase tracking-wider">
              本月营收
            </Text>
            <View className="px-[16rpx] py-[4rpx] rounded-full bg-primary-foreground/20">
              <Text className="text-[24rpx] text-primary-foreground font-medium">
                {data.revenueBadge}
              </Text>
            </View>
          </View>
          <Text className="text-[80rpx] font-bold number-display text-primary-foreground block leading-tight">
            {data.revenue}
          </Text>
          <View className="flex items-center gap-[32rpx] mt-[16rpx]">
            <Text className="text-[28rpx] text-primary-foreground/70">{data.bills}</Text>
            <Text className="text-[28rpx] text-primary-foreground/70">·</Text>
            <Text className="text-[28rpx] text-primary-foreground/70">{data.avg}</Text>
          </View>
        </View>
      </View>

      {/* 4 小卡 */}
      <View className="grid grid-cols-4 gap-[16rpx] mb-[24rpx]">
        {/* 课消金额 */}
        <View className="bg-card rounded-[24rpx] p-[20rpx] border-[2rpx] border-solid border-border-light text-center shadow-card">
          <Text className="text-[22rpx] text-muted-foreground block mb-[8rpx]">课消金额</Text>
          <Text className="text-[32rpx] font-bold text-primary number-display block">
            {data.lessonAmount}
          </Text>
          <Text className="text-[22rpx] text-success block mt-[8rpx]">{data.lessonTrend}</Text>
        </View>
        {/* 新签金额 */}
        <View className="bg-card rounded-[24rpx] p-[20rpx] border-[2rpx] border-solid border-border-light text-center shadow-card">
          <Text className="text-[22rpx] text-muted-foreground block mb-[8rpx]">新签金额</Text>
          <Text className="text-[32rpx] font-bold text-primary number-display block">
            {data.newAmount}
          </Text>
          <Text className="text-[22rpx] text-muted-foreground block mt-[8rpx]">{data.newNote}</Text>
        </View>
        {/* 待收金额 */}
        <View className="bg-card rounded-[24rpx] p-[20rpx] border-[2rpx] border-solid border-border-light text-center shadow-card">
          <Text className="text-[22rpx] text-muted-foreground block mb-[8rpx]">待收金额</Text>
          <Text className="text-[32rpx] font-bold text-primary number-display block">
            {data.pending}
          </Text>
          <Text className="text-[22rpx] text-warning block mt-[8rpx]">{data.pendingNote}</Text>
        </View>
        {/* 总支出 */}
        <View className="bg-card rounded-[24rpx] p-[20rpx] border-[2rpx] border-solid border-border-light text-center shadow-card">
          <Text className="text-[22rpx] text-muted-foreground block mb-[8rpx]">总支出</Text>
          <Text className="text-[32rpx] font-bold text-destructive number-display block">
            {data.totalExpense}
          </Text>
          <Text className="text-[22rpx] text-muted-foreground block mt-[8rpx]">本期支出</Text>
        </View>
      </View>

      {/* 收支利润概览卡片（总收入 - 总支出 = 净利润） */}
      <View className="bg-card rounded-[24rpx] p-[24rpx] border-[2rpx] border-solid border-border-light flex items-center justify-between shadow-card">
        {/* 总收入 */}
        <View className="flex items-center gap-[16rpx]">
          <View className="w-[56rpx] h-[56rpx] rounded-[16rpx] bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="mdi-arrow-up" size="xs" color="primary" />
          </View>
          <View>
            <Text className="text-[20rpx] text-muted-foreground block">总收入</Text>
            <Text className="text-[28rpx] font-bold text-primary number-display block">
              {data.totalRevenue}
            </Text>
          </View>
        </View>
        <Text className="text-[36rpx] text-muted-foreground">−</Text>
        {/* 总支出 */}
        <View className="flex items-center gap-[16rpx]">
          <View className="w-[56rpx] h-[56rpx] rounded-[16rpx] bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <Icon name="mdi-arrow-down" size="xs" color="destructive" />
          </View>
          <View>
            <Text className="text-[20rpx] text-muted-foreground block">总支出</Text>
            <Text className="text-[28rpx] font-bold text-destructive number-display block">
              {data.totalExpense}
            </Text>
          </View>
        </View>
        <Text className="text-[36rpx] text-muted-foreground">=</Text>
        {/* 净利润 */}
        <View className="flex items-center gap-[16rpx]">
          <View className="w-[56rpx] h-[56rpx] rounded-[16rpx] bg-success/10 flex items-center justify-center flex-shrink-0">
            <Icon name="mdi-currency-cny" size="xs" color="success" />
          </View>
          <View>
            <Text className="text-[20rpx] text-muted-foreground block">
              净利润 <Text className="text-success">{data.profitMargin}</Text>
            </Text>
            <Text className="text-[28rpx] font-bold text-success number-display block">
              {data.netProfit}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default FinanceKpi;
