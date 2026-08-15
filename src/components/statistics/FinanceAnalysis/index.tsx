import { View, Text } from '@tarojs/components';
import React, { useState, useCallback } from 'react';

/** 收入构成项 */
export interface IncomeCompositionItem {
  /** 标签 */
  label: string;
  /** 金额 */
  amount: string;
  /** 占比百分比 */
  percent: number;
  /** 进度条颜色类名 */
  barClass: string;
}

/** 支出构成项 */
export interface ExpenseCompositionItem {
  /** 标签 */
  label: string;
  /** 金额 */
  amount: string;
  /** 占比百分比 */
  percent: number;
  /** 进度条颜色类名 */
  barClass: string;
}

/** 财务分析数据 */
export interface FinanceAnalysisData {
  /** 总收入 */
  totalRevenue: string;
  /** 总支出 */
  totalExpense: string;
  /** 净利润 */
  netProfit: string;
  /** 利润率 */
  profitMargin: string;
  /** 支出趋势 */
  expenseTrend: string;
  /** 收入构成 */
  incomeComposition: IncomeCompositionItem[];
  /** 支出构成 */
  expenseComposition: ExpenseCompositionItem[];
  /** 环比 */
  momVal: string;
  /** 环比标签 */
  momLabel: string;
  /** 环比描述 */
  momDesc: string;
  /** 同比 */
  yoyVal: string;
  /** 同比标签 */
  yoyLabel: string;
  /** 同比描述 */
  yoyDesc: string;
}

/** 构成项行 */
const CompositionRow: React.FC<{
  item: IncomeCompositionItem | ExpenseCompositionItem;
}> = ({ item }) => (
  <View>
    <View className="flex items-center justify-between mb-[8rpx]">
      <Text className="text-[24rpx] text-foreground-secondary">{item.label}</Text>
      <Text className="text-[24rpx] font-semibold text-primary">{item.amount}</Text>
    </View>
    <View className="h-[16rpx] bg-muted rounded-full overflow-hidden">
      <View
        className={`h-full rounded-full ${item.barClass}`}
        style={{ width: `${item.percent}%` }}
      />
    </View>
    <Text className="text-[20rpx] text-muted-foreground block mt-[4rpx]">
      占比 {item.percent.toFixed(1)}%
    </Text>
  </View>
);

/**
 * 财务分析组件
 * 收入/支出构成 Tab 切换 + 环比/同比
 * 对齐设计稿 scheme-bc-fusion-v2.html
 */
const FinanceAnalysis: React.FC<{ data: FinanceAnalysisData }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');

  const handleTabChange = useCallback((tab: 'income' | 'expense') => {
    setActiveTab(tab);
  }, []);

  return (
    <View className="mb-[24rpx]">
      {/* 小标题：收支明细 */}
      <Text className="text-[28rpx] text-foreground font-semibold px-[8rpx] block mt-[16rpx] mb-[8rpx]">
        收支明细
      </Text>

      {/* 收入/支出构成 Tab */}
      <View className="bg-card rounded-[24rpx] border-[2rpx] border-solid border-border-light mb-[24rpx] overflow-hidden shadow-card">
        {/* Tab 切换 */}
        <View className="flex border-b-[2rpx] border-solid border-border-light">
          <View
            className={`flex-1 py-[20rpx] text-center text-[24rpx] font-medium transition-all relative ${
              activeTab === 'income' ? 'text-primary font-semibold' : 'text-muted-foreground'
            }`}
            onClick={() => handleTabChange('income')}
          >
            <Text>收入构成</Text>
            {activeTab === 'income' && (
              <View className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[48rpx] h-[4rpx] rounded-[4rpx] bg-primary" />
            )}
          </View>
          <View
            className={`flex-1 py-[20rpx] text-center text-[24rpx] font-medium transition-all relative ${
              activeTab === 'expense' ? 'text-primary font-semibold' : 'text-muted-foreground'
            }`}
            onClick={() => handleTabChange('expense')}
          >
            <Text>支出构成</Text>
            {activeTab === 'expense' && (
              <View className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[48rpx] h-[4rpx] rounded-[4rpx] bg-primary" />
            )}
          </View>
        </View>

        {/* 收入构成内容 */}
        {activeTab === 'income' && (
          <View className="p-[32rpx] flex flex-col gap-[24rpx]">
            {data.incomeComposition.map((item, idx) => (
              <CompositionRow key={`income-${idx}`} item={item} />
            ))}
          </View>
        )}

        {/* 支出构成内容 */}
        {activeTab === 'expense' && (
          <View className="p-[32rpx]">
            <View className="flex items-center justify-between mb-[24rpx]">
              <Text className="text-[24rpx] text-muted-foreground">总支出</Text>
              <View className="flex items-center gap-[8rpx]">
                <Text className="text-[28rpx] font-bold text-primary number-display">
                  {data.totalExpense}
                </Text>
                <Text className="text-[20rpx] text-success ml-[8rpx]">{data.expenseTrend}</Text>
              </View>
            </View>
            <View className="flex flex-col gap-[20rpx]">
              {data.expenseComposition.map((item, idx) => (
                <CompositionRow key={`expense-${idx}`} item={item} />
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 环比/同比 */}
      <View className="grid grid-cols-2 gap-[24rpx]">
        <View className="bg-card rounded-[24rpx] p-[24rpx] border-[2rpx] border-solid border-border-light shadow-card">
          <Text className="text-[20rpx] text-muted-foreground block mb-[8rpx]">环比</Text>
          <View className="flex items-baseline gap-[8rpx]">
            <Text className="text-[36rpx] font-bold text-primary number-display">
              {data.momVal}
            </Text>
            <Text className="text-[20rpx] text-muted-foreground">{data.momLabel}</Text>
          </View>
          <Text className="text-[20rpx] text-foreground-secondary block mt-[4rpx]">
            {data.momDesc}
          </Text>
        </View>
        <View className="bg-card rounded-[24rpx] p-[24rpx] border-[2rpx] border-solid border-border-light shadow-card">
          <Text className="text-[20rpx] text-muted-foreground block mb-[8rpx]">同比去年</Text>
          <View className="flex items-baseline gap-[8rpx]">
            <Text className="text-[36rpx] font-bold text-primary number-display">
              {data.yoyVal}
            </Text>
            <Text className="text-[20rpx] text-muted-foreground">{data.yoyLabel}</Text>
          </View>
          <Text className="text-[20rpx] text-foreground-secondary block mt-[4rpx]">
            {data.yoyDesc}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default FinanceAnalysis;
