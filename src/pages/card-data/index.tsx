import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import SegmentedControl from '@/components/SegmentedControl';
import type { CardDetailType } from '@/data/data-center';
import { dataCenterService } from '@/services/data-center';
import { useThemeStore } from '@/stores/theme';
import { useThemedNavigationBar } from '@/utils/navigation-bar';

/**
 * 卡项数据详情页
 *
 * 展示卡项详细数据，包含：
 * - 顶部渐变头部：标题 + 返回 + 场馆名 + 日期选择 + 日/月/年切换
 * - KPI 概览卡片：耗卡数据/售卡数据/剩余卡项/卡片到期 4列
 * - 数据明细卡片：售卡/耗卡 Tab 切换
 */
const CardData: React.FC = () => {
  const { activeTheme } = useThemeStore();

  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.primarySoftBg,
    frontColor: '#000000',
  }));

  const [data, setData] = useState<CardDetailType | null>(null);
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [detailTab, setDetailTab] = useState<'sold' | 'consumed'>('sold');
  const { setLoading } = useDelayedLoading();

  /** 加载数据 */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dataCenterService.getCardDetail({ periodType: period });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** 切换周期 */
  const handlePeriodChange = useCallback((value: string) => {
    setPeriod(value as 'day' | 'month' | 'year');
  }, []);

  /** 切换明细 Tab */
  const handleDetailTabChange = useCallback((value: string) => {
    setDetailTab(value as 'sold' | 'consumed');
  }, []);

  /** 格式化金额 */
  const formatMoney = (value: number): string => {
    if (value >= 10000) {
      return (value / 10000).toFixed(1) + '万';
    }
    return value.toLocaleString();
  };

  /** 渲染数据明细列表 */
  const renderDetailList = () => {
    if (!data) return null;

    const list = detailTab === 'sold' ? data.soldList : data.consumedList;
    const maxAmount = Math.max(...list.map((item) => item.amount));

    return (
      <View className="flex flex-col gap-[20rpx]">
        {list.map((item, index) => (
          <View key={item.id} className="flex flex-col gap-[8rpx]">
            <View className="flex items-center justify-between">
              <Text className="text-[28rpx] font-medium text-foreground">{item.cardName}</Text>
              <View className="flex items-center gap-[16rpx]">
                <Text className="text-[24rpx] text-muted-foreground">{item.count}张</Text>
                <Text className="text-[28rpx] font-bold text-foreground">
                  ¥{item.amount.toLocaleString()}
                </Text>
              </View>
            </View>
            <View className="w-full h-[12rpx] bg-muted rounded-full overflow-hidden">
              <View
                className={`h-full rounded-full ${
                  detailTab === 'sold' ? 'bg-progress-primary' : 'bg-progress-purple'
                }`}
                style={{ width: `${maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0}%` }}
              />
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background')}>
      {/* 顶部渐变头部 */}
      <View className="bg-gradient-diffuse-top pb-[60rpx] px-[32rpx] pt-[24rpx] relative overflow-hidden">
        {/* 日期选择 + 周期切换 */}
        <View className="flex items-center justify-between relative z-10">
          <View className="flex items-center gap-[8rpx] bg-card/80 backdrop-blur-sm px-[20rpx] py-[12rpx] rounded-full shadow-card">
            <Icon name="mdi-calendar" size={24} color="muted" />
            <Text className="text-[26rpx] text-foreground font-medium">2025年8月</Text>
            <Icon name="mdi-chevron-down" size={20} color="muted" />
          </View>
          <View className="w-[240rpx]">
            <SegmentedControl
              options={[
                { label: '日', value: 'day' },
                { label: '月', value: 'month' },
                { label: '年', value: 'year' },
              ]}
              value={period}
              onChange={handlePeriodChange}
            />
          </View>
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView className="bg-background" scrollY style={{ marginTop: '-30rpx' }}>
        <View className="px-[24rpx] pb-[48rpx]">
          {/* KPI 概览卡片 */}
          <Card>
            <Text className="text-[30rpx] font-bold text-foreground block mb-[20rpx]">
              KPI 概览
            </Text>
            <View className="grid grid-cols-2 gap-[16rpx]">
              <View className="bg-destructive-10 rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">耗卡数据</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  ¥{data ? formatMoney(data.cardConsumed) : '0'}
                </Text>
              </View>
              <View className="bg-success-bg rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">售卡数据</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  ¥{data ? formatMoney(data.cardSold) : '0'}
                </Text>
              </View>
              <View className="bg-primary-5 rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">剩余卡项</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  {data?.remainingCards || 0}
                  <Text className="text-[24rpx] font-normal text-muted-foreground ml-[4rpx]">
                    次
                  </Text>
                </Text>
              </View>
              <View className="bg-warning-bg rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">卡片到期</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  {data?.expiringCards || 0}
                  <Text className="text-[24rpx] font-normal text-muted-foreground ml-[4rpx]">
                    张
                  </Text>
                </Text>
              </View>
            </View>
          </Card>

          {/* 数据明细卡片 */}
          <Card marginBottom={false}>
            <View className="flex items-center justify-between mb-[24rpx]">
              <Text className="text-[30rpx] font-bold text-foreground">数据明细</Text>
              <View className="w-[280rpx]">
                <SegmentedControl
                  options={[
                    { label: '售卡', value: 'sold' },
                    { label: '耗卡', value: 'consumed' },
                  ]}
                  value={detailTab}
                  onChange={handleDetailTabChange}
                />
              </View>
            </View>
            {renderDetailList()}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
};

export default CardData;
