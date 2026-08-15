import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import Icon from '@/components/Icon';
import SegmentedControl from '@/components/SegmentedControl';
import Card from '@/components/Card';
import { useThemeStore } from '@/stores/theme';
import { useThemedNavigationBar } from '@/utils/navigation-bar';
import { dataCenterService } from '@/services/data-center';
import type { SalaryDetailType } from '@/data/data-center';

/**
 * 薪资数据详情页
 *
 * 展示薪资详细数据，包含：
 * - 顶部渐变头部：标题 + 返回 + 场馆名 + 日期选择 + 月/年切换
 * - KPI 概览卡片：总薪资/固定薪资成本/团课/私教课 4列
 * - 柱状趋势图：薪资趋势
 * - 教练列表：头像+姓名+业绩/课时/耗卡
 */
const SalaryData: React.FC = () => {
  const { activeTheme } = useThemeStore();

  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.primarySoftBg,
    frontColor: '#000000',
  }));

  const [data, setData] = useState<SalaryDetailType | null>(null);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);

  /** 加载数据 */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dataCenterService.getSalaryDetail({ periodType: period });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** 返回上一页 */
  const handleBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  /** 切换周期 */
  const handlePeriodChange = useCallback((value: string) => {
    setPeriod(value as 'month' | 'year');
  }, []);

  /** 格式化金额 */
  const formatMoney = (value: number): string => {
    if (value >= 10000) {
      return (value / 10000).toFixed(1) + '万';
    }
    return value.toLocaleString();
  };

  /** 渲染柱状趋势图 */
  const renderTrendChart = () => {
    if (!data || data.trendData.length === 0) return null;

    const maxValue = Math.max(...data.trendData.map((d) => d.value));

    return (
      <View className="mt-[24rpx]">
        <View className="flex items-end justify-between h-[200rpx] gap-[8rpx]">
          {data.trendData.map((item, index) => {
            const heightPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            return (
              <View key={index} className="flex-1 flex flex-col items-center">
                <View className="w-full flex-1 flex items-end justify-center">
                  <View
                    className="w-[70%] bg-gradient-primary rounded-t-[8rpx]"
                    style={{ height: `${heightPercent}%` }}
                  />
                </View>
                <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  /** 渲染教练列表 */
  const renderCoachList = () => {
    if (!data) return null;

    return (
      <View className="flex flex-col gap-[16rpx]">
        {data.coachList.map((coach, index) => (
          <View
            key={index}
            className="flex items-center gap-[16rpx] py-[16rpx] border-b-[2rpx] border-border last:border-b-0"
          >
            <View className="w-[56rpx] h-[56rpx] rounded-full bg-kpi-green flex items-center justify-center">
              <Text className="text-[24rpx] text-white font-medium">
                {coach.name.charAt(0)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-[28rpx] font-medium text-foreground block">
                {coach.name}
              </Text>
              <View className="flex items-center gap-[16rpx] mt-[4rpx]">
                <Text className="text-[22rpx] text-muted-foreground">
                  课时 {coach.hours}h
                </Text>
                <Text className="text-[22rpx] text-muted-foreground">
                  耗卡 {coach.cardConsumed}次
                </Text>
              </View>
            </View>
            <View className="text-right">
              <Text className="text-[28rpx] font-bold text-foreground block">
                ¥{coach.performance.toLocaleString()}
              </Text>
              <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">业绩</Text>
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
        {/* 自定义导航栏 */}
        <View className="flex items-center justify-between mb-[32rpx] relative z-10">
          <View className="flex items-center gap-[16rpx]" onClick={handleBack}>
            <Icon name="mdi-arrow-left" size={28} color="foreground" />
            <Text className="text-[32rpx] font-bold text-foreground">薪资数据</Text>
          </View>
          <View className="flex items-center gap-[8rpx] bg-card/80 backdrop-blur-sm px-[20rpx] py-[10rpx] rounded-full shadow-card">
            <Text className="text-[26rpx] text-foreground font-medium">云策健身</Text>
            <Icon name="mdi-chevron-down" size={20} color="muted" />
          </View>
        </View>

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
              <View className="bg-primary-5 rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">总薪资</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  ¥{data ? formatMoney(data.totalSalary) : '0'}
                </Text>
              </View>
              <View className="bg-warning-bg rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">固定薪资成本</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  ¥{data ? formatMoney(data.fixedCost) : '0'}
                </Text>
              </View>
              <View className="bg-success-bg rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">团课</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  ¥{data ? formatMoney(data.groupClass) : '0'}
                </Text>
              </View>
              <View className="bg-accent-bg rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">私教课</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  ¥{data ? formatMoney(data.privateClass) : '0'}
                </Text>
              </View>
            </View>
          </Card>

          {/* 趋势图卡片 */}
          <Card>
            <Text className="text-[30rpx] font-bold text-foreground block mb-[8rpx]">
              薪资趋势
            </Text>
            <Text className="text-[24rpx] text-muted-foreground block mb-[16rpx]">
              薪资变化
            </Text>
            {renderTrendChart()}
          </Card>

          {/* 教练列表卡片 */}
          <Card marginBottom={false}>
            <Text className="text-[30rpx] font-bold text-foreground block mb-[20rpx]">
              教练薪资排行
            </Text>
            {renderCoachList()}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
};

export default SalaryData;