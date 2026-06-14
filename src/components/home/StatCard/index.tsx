import { View, Text } from '@tarojs/components';
import React from 'react';

interface StatCardProps {
  /** 标签文字 */
  label: string;
  /** 数值 */
  value: number | string;
  /** 单位 */
  unit?: string;
}

/** 统计卡片组件 - 使用 UnoCSS 原子化类名 */
const StatCard: React.FC<StatCardProps> = ({ label, value, unit = '' }) => {
  return (
    <View className="flex-1 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 text-white">
      <Text className="text-sm opacity-80 block">{label}</Text>
      <View className="flex items-baseline gap-1">
        <Text className="text-2xl font-bold">{value}</Text>
        {unit && <Text className="text-xs opacity-70">{unit}</Text>}
      </View>
    </View>
  );
};

export default StatCard;
