/**
 * TrendSection - 趋势分析组件
 * 默认展开，使用纵向柱状图展示趋势数据
 * 运营页显示课时趋势（蓝色），财务页显示收入趋势（紫色）
 */
import { View, Text } from '@tarojs/components';
import React, { useState, useCallback } from 'react';
import Icon from '@/components/Icon';
import ChartContainer from '../ChartContainer';
import type { ChartTheme, ChartDataItem } from '../ChartContainer';

/** 趋势分析数据 */
export interface TrendSectionData {
  /** 趋势图表数据 */
  chartData: ChartDataItem[];
  /** 图表单位 */
  chartUnit?: string;
  /** 图表主题色 */
  chartTheme?: ChartTheme;
  /** 图表标题 */
  chartTitle?: string;
  /** 环比值（如 +8.2%） */
  momVal: string;
  /** 环比标签（如 课时/收入） */
  momLabel: string;
  /** 环比描述（如 多消耗14课时） */
  momDesc: string;
  /** 同比值 */
  yoyVal: string;
  /** 同比标签 */
  yoyLabel: string;
  /** 同比描述 */
  yoyDesc: string;
}

/**
 * 趋势分析组件
 * 默认展开，展示柱状图 + 环比/同比卡片
 */
const TrendSection: React.FC<{ data: TrendSectionData; title?: string }> = ({
  data,
  title = '趋势分析',
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const handleToggle = useCallback(() => {
    setCollapsed((v) => !v);
  }, []);

  return (
    <View className="px-[24rpx] py-[40rpx]">
      {/* 标题 + 折叠按钮 */}
      <View className="flex items-center justify-between mb-[32rpx]">
        <Text className="text-[32rpx] font-semibold text-foreground block">{title}</Text>
        <View
          className="flex items-center gap-[8rpx] px-[24rpx] py-[12rpx] rounded-[24rpx] bg-primary/10"
          onClick={handleToggle}
        >
          <Text className="text-[24rpx] text-primary font-medium">
            {collapsed ? '展开' : '收起'}
          </Text>
          <Icon
            name="mdi-chevron-down"
            size="xs"
            color="primary"
            className={collapsed ? '' : 'rotate-180'}
          />
        </View>
      </View>

      {/* 内容区（默认展开） */}
      {!collapsed && (
        <View>
          {/* 柱状图卡片 */}
          <View className="mb-[24rpx]">
            <ChartContainer
              title={data.chartTitle || ''}
              data={data.chartData}
              unit={data.chartUnit}
              theme={data.chartTheme || 'primary'}
            />
          </View>

          {/* 环比/同比卡片 */}
          <View className="grid grid-cols-2 gap-[24rpx]">
            <View className="bg-card rounded-[24rpx] p-[32rpx] border-[2rpx] border-solid border-border-light shadow-card">
              <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">环比</Text>
              <View className="flex items-baseline gap-[16rpx]">
                <Text className="text-[40rpx] font-bold text-primary number-display">
                  {data.momVal}
                </Text>
                <Text className="text-[24rpx] text-muted-foreground">{data.momLabel}</Text>
              </View>
              <Text className="text-[24rpx] text-foreground-secondary block mt-[8rpx]">
                {data.momDesc}
              </Text>
            </View>
            <View className="bg-card rounded-[24rpx] p-[32rpx] border-[2rpx] border-solid border-border-light shadow-card">
              <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">同比去年</Text>
              <View className="flex items-baseline gap-[16rpx]">
                <Text className="text-[40rpx] font-bold text-primary number-display">
                  {data.yoyVal}
                </Text>
                <Text className="text-[24rpx] text-muted-foreground">{data.yoyLabel}</Text>
              </View>
              <Text className="text-[24rpx] text-foreground-secondary block mt-[8rpx]">
                {data.yoyDesc}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default TrendSection;
