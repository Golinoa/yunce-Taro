/**
 * BarChart - 横向条形图组件
 * 用于家长端"最近上课课时"展示
 * 使用 CSS 渲染，无需 Canvas
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import type { ChartDataItem } from '../ChartContainer';

interface BarChartProps {
  title: string;
  data: ChartDataItem[];
  unit?: string;
  barColor?: string;
}

const BarChart: React.FC<BarChartProps> = ({
  title,
  data,
  unit = '',
  barColor = 'bg-gradient-accent',
}) => {
  if (!data || data.length === 0) {
    return (
      <View className="bg-white rounded-2xl p-4 shadow-soft mb-5">
        <Text className="text-lg font-semibold text-foreground block mb-4">{title}</Text>
        <View className="flex items-center justify-center h-50">
          <Text className="text-base text-muted-foreground">暂无数据</Text>
        </View>
      </View>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <View className="bg-white rounded-2xl p-4 shadow-soft mb-5">
      <Text className="text-lg font-semibold text-foreground block mb-4">{title}</Text>
      <View className="flex flex-col gap-3">
        {data.map((item, idx) => (
          <View key={idx} className="flex items-center gap-3">
            <Text className="text-sm text-muted-foreground w-12 text-right flex-shrink-0">
              {item.label}
            </Text>
            <View className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden">
              <View
                className={`h-full rounded-full ${barColor} transition-all`}
                style={{ width: `${Math.max((item.value / maxVal) * 100, 2)}%` }}
              />
            </View>
            <Text className="text-sm font-medium text-foreground w-16 text-right flex-shrink-0">
              {item.value}
              {item.unit || unit}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default BarChart;
