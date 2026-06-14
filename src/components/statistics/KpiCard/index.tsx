/**
 * KpiCard - KPI 指标卡片组件
 * - isTop=true: 顶部大卡片（绿色背景区白色卡片）
 * - isTop=false: 次级小卡片（白色背景区，数值绿色大字）
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';

/** KPI 数据项 */
export interface KpiData {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  navigateTo?: string;
  hidden?: boolean;
}

interface KpiCardProps {
  data: KpiData[];
  isTop?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ data, isTop = false }) => {
  const visibleData = data.filter((item) => !item.hidden);

  if (visibleData.length === 0) return null;

  if (isTop) {
    return (
      <View className="flex gap-3 mt-4">
        {visibleData.map((item) => {
          const handleClick = () => {
            if (item.navigateTo) Taro.navigateTo({ url: item.navigateTo });
          };
          return (
            <View
              key={item.id}
              className={`flex-1 bg-white/20 backdrop-blur-sm rounded-2xl p-3 text-center ${item.navigateTo ? 'active:opacity-90' : ''}`}
              onClick={handleClick}
            >
              <Text className="text-2xl font-bold text-white leading-none block mb-1">
                {item.value}
                {item.unit && (
                  <Text className="text-xs font-normal text-white/80 ml-0_d5">{item.unit}</Text>
                )}
              </Text>
              <Text className="text-xs text-white/80 block mt-1">{item.label}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View className={`grid gap-3 mb-5 ${visibleData.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {visibleData.map((item) => {
        const handleClick = () => {
          if (item.navigateTo) Taro.navigateTo({ url: item.navigateTo });
        };
        return (
          <View
            key={item.id}
            className={`bg-white rounded-2xl p-4 shadow-soft text-center ${item.navigateTo ? 'active:opacity-90' : ''}`}
            onClick={handleClick}
          >
            <Text className="text-3xl font-bold text-primary block leading-tight mb-1">
              {item.value}
              {item.unit && (
                <Text className="text-sm font-normal text-primary ml-0_d5">{item.unit}</Text>
              )}
            </Text>
            <Text className="text-sm text-muted-foreground block">{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
};

export default KpiCard;
