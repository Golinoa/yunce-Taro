/**
 * RankList - 排行榜组件
 * 支持多种模式：
 * - lesson/income: 横向进度条排行
 * - payment: 收费方式明细
 * - detail: 学生课时明细
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Empty from '@/components/Empty';

export interface RankItem {
  id: string;
  name: string;
  value: number;
  unit?: string;
  extra?: string;
  remain?: number;
}

interface RankListProps {
  title: string;
  data: RankItem[];
  emptyText?: string;
  maxCount?: number;
  mode?: 'lesson' | 'income' | 'payment' | 'detail';
}

const RANK_COLORS: Record<number, string> = {
  0: '#FFB800',
  1: '#C0C0C0',
  2: '#CD7F32',
};

const RankList: React.FC<RankListProps> = ({
  title,
  data,
  emptyText = '暂无数据',
  maxCount = 10,
  mode = 'lesson',
}) => {
  const displayData = data.slice(0, maxCount);
  const maxValue = Math.max(...displayData.map((d) => d.value), 1);

  return (
    <View className="bg-white rounded-2xl p-4 shadow-soft mb-5">
      <Text className="text-lg font-semibold text-foreground block mb-4">{title}</Text>

      {displayData.length === 0 ? (
        <View className="py-8">
          <Empty icon="mdi-chart-bar" description={emptyText} />
        </View>
      ) : (
        <View className="space-y-3">
          {displayData.map((item, index) => {
            const percent = (item.value / maxValue) * 100;
            const isTopThree = index < 3;
            const rankColor = RANK_COLORS[index] || '#999999';

            // 课时/收入排行模式
            if (mode === 'lesson' || mode === 'income') {
              return (
                <View key={item.id} className="flex items-center gap-3">
                  {isTopThree ? (
                    <View
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: rankColor }}
                    >
                      <Text className="text-sm text-white font-bold">{index + 1}</Text>
                    </View>
                  ) : (
                    <Text className="w-8 text-sm text-muted-foreground text-center flex-shrink-0">
                      {index + 1}
                    </Text>
                  )}
                  <Text className="w-16 text-sm text-muted-foreground truncate flex-shrink-0 text-right">
                    {item.name}
                  </Text>
                  <View className="flex-1 flex items-center gap-2">
                    <View className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <View
                        className="h-full rounded-full bg-gradient-primary transition-all duration-700"
                        style={{ width: `${percent}%` }}
                      />
                    </View>
                    <Text className="text-sm font-semibold text-foreground w-10 text-right flex-shrink-0">
                      {item.value}
                      {item.unit || ''}
                    </Text>
                  </View>
                </View>
              );
            }

            // 收费方式明细模式
            if (mode === 'payment') {
              const percentStr = item.extra || '0%';
              const barPercent = parseFloat(percentStr) || (item.value / maxValue) * 100;
              return (
                <View key={item.id} className="bg-white rounded-2xl p-4 shadow-soft mb-4">
                  <View className="flex items-center gap-3">
                    <View
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isTopThree ? 'bg-gradient-primary' : 'bg-muted'}`}
                    >
                      <Text
                        className={`text-sm font-bold ${isTopThree ? 'text-white' : 'text-muted-foreground'}`}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <View className="flex-1 flex flex-col gap-1">
                      <Text className="text-lg font-medium text-foreground">{item.name}</Text>
                      <Text className="text-sm text-muted-foreground">占比 {percentStr}</Text>
                    </View>
                    <View className="text-right">
                      <Text className="text-lg font-semibold text-primary">
                        ¥{item.value.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <View className="w-full h-2 bg-muted rounded-full overflow-hidden mt-3">
                    <View
                      className="h-full rounded-full bg-gradient-primary transition-all duration-700"
                      style={{ width: `${Math.max(barPercent, 2)}%` }}
                    />
                  </View>
                </View>
              );
            }

            // 学生课时明细模式
            if (mode === 'detail') {
              const totalHours = item.value + (item.remain || 0);
              const consumedPercent = totalHours > 0 ? (item.value / totalHours) * 100 : 0;
              return (
                <View key={item.id} className="bg-white rounded-2xl p-4 shadow-soft mb-4">
                  <View className="flex items-center gap-3">
                    <View
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isTopThree ? 'bg-gradient-primary' : 'bg-muted'}`}
                    >
                      <Text
                        className={`text-sm font-bold ${isTopThree ? 'text-white' : 'text-muted-foreground'}`}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <View className="flex-1 flex flex-col gap-1">
                      <Text className="text-lg font-medium text-foreground">{item.name}</Text>
                      <Text className="text-sm text-muted-foreground">
                        {item.extra || '上课 1 次'}
                      </Text>
                    </View>
                    <View className="text-right flex flex-col gap-1">
                      <Text className="text-lg font-semibold text-primary">
                        已消 {item.value} 课时
                      </Text>
                      <Text className="text-sm text-muted-foreground">剩余 {item.remain || 0}</Text>
                    </View>
                  </View>
                  <View className="w-full h-2 bg-muted rounded-full overflow-hidden mt-3">
                    <View
                      className="h-full rounded-full bg-gradient-primary transition-all duration-700"
                      style={{ width: `${Math.max(consumedPercent, 2)}%` }}
                    />
                  </View>
                </View>
              );
            }

            return null;
          })}

          {/* 底部刻度（仅排行模式） */}
          {(mode === 'lesson' || mode === 'income') && displayData.length > 0 && (
            <View className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
              <View className="w-16" />
              <View className="flex-1 flex justify-between text-xs text-muted-foreground px-0">
                <Text>0</Text>
                <Text>{Math.round(maxValue * 0.25)}</Text>
                <Text>{Math.round(maxValue * 0.5)}</Text>
                <Text>{Math.round(maxValue * 0.75)}</Text>
                <Text>{maxValue}</Text>
              </View>
              <View className="w-10" />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default RankList;
