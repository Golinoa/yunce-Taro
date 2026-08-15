import { View, Text } from '@tarojs/components';
import React, { useState, useCallback } from 'react';
import Empty from '@/components/Empty';
import type { RankItem } from '../RankList';

/** 排行 Tab 类型 */
export type RankTabType = 'student' | 'teacher' | 'campus';

/** 排行 Tab 配置 */
export interface RankTabConfig {
  /** Tab 类型 */
  type: RankTabType;
  /** Tab 标签文本 */
  label: string;
  /** 排行数据 */
  data: RankItem[];
  /** 排行标题 */
  title: string;
  /** 空数据文本 */
  emptyText?: string;
}

/** 排行 Tab 切换组件
 * 对齐设计稿 scheme-bc-fusion-v2.html
 * 支持学员消课 / 教师上课 / 校区业绩 三种视图切换
 */
const RankTabs: React.FC<{
  tabs: RankTabConfig[];
  periodLabel?: string;
}> = ({ tabs, periodLabel = '本月' }) => {
  const [activeType, setActiveType] = useState<RankTabType>(tabs[0]?.type || 'student');

  const handleTabChange = useCallback((type: RankTabType) => {
    setActiveType(type);
  }, []);

  const activeTab = tabs.find((t) => t.type === activeType) || tabs[0];

  return (
    <View>
      {/* 标题区 */}
      <View className="flex items-center justify-between mb-[24rpx]">
        <Text className="text-[32rpx] font-semibold text-foreground block">排行明细</Text>
        <Text className="text-[24rpx] text-muted-foreground">{periodLabel}</Text>
      </View>

      {/* Tab 切换 */}
      <View className="flex gap-[16rpx] mb-[24rpx]">
        {tabs.map((tab) => {
          const isActive = tab.type === activeType;
          return (
            <View
              key={tab.type}
              className={`flex-1 py-[16rpx] rounded-[24rpx] text-center text-[24rpx] font-medium transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-elegant'
                  : 'bg-card border-[2rpx] border-solid border-border-light text-foreground-secondary'
              }`}
              onClick={() => handleTabChange(tab.type)}
            >
              <Text className={isActive ? 'text-primary-foreground' : 'text-foreground-secondary'}>
                {tab.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 排行内容 */}
      <View className="bg-card rounded-[24rpx] border-[2rpx] border-solid border-border-light overflow-hidden shadow-card">
        {activeTab && activeTab.data.length > 0 ? (
          <View className="p-[24rpx]">
            {activeTab.data.map((item, index) => {
              const isTopThree = index < 3;
              // 前三名背景色类名（UnoCSS，禁止内联 style）
              const RANK_BG_CLASSES = ['bg-kpi-blue', 'bg-kpi-purple', 'bg-kpi-amber'];

              return (
                <View
                  key={item.id || `rank-${index}`}
                  className="flex items-center gap-[16rpx] py-[16rpx]"
                >
                  {/* 排名 */}
                  {isTopThree ? (
                    <View
                      className={`w-[48rpx] h-[48rpx] rounded-full flex items-center justify-center flex-shrink-0 ${RANK_BG_CLASSES[index]}`}
                    >
                      <Text className="text-[24rpx] text-primary-foreground font-bold">
                        {index + 1}
                      </Text>
                    </View>
                  ) : (
                    <Text className="w-[48rpx] text-[24rpx] text-muted-foreground text-center flex-shrink-0">
                      {index + 1}
                    </Text>
                  )}
                  {/* 头像首字 + 名称 */}
                  <View className="w-[64rpx] h-[64rpx] rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Text className="text-[28rpx] font-medium text-primary">
                      {item.name.slice(0, 1)}
                    </Text>
                  </View>
                  <Text className="flex-1 text-[28rpx] text-foreground truncate">{item.name}</Text>
                  {/* 数值 */}
                  <Text className="text-[28rpx] font-semibold text-primary flex-shrink-0">
                    {item.unit === '元'
                      ? `¥${item.value.toLocaleString()}`
                      : `${item.value} ${item.unit || ''}`}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="py-[64rpx]">
            <Empty icon="mdi-chart-bar" description={activeTab?.emptyText || '暂无数据'} />
          </View>
        )}
      </View>
    </View>
  );
};

export default RankTabs;
