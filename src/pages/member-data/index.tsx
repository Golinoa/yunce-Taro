import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import SegmentedControl from '@/components/SegmentedControl';
import type { MemberDetailType } from '@/data/data-center';
import { dataCenterService } from '@/services/data-center';
import { useThemeStore } from '@/stores/theme';
import { useThemedNavigationBar } from '@/utils/navigation-bar';

/**
 * 会员数据详情页
 *
 * 展示会员详细数据，包含：
 * - 顶部渐变头部：标题 + 返回 + 场馆名 + 日期选择 + 日/月/年切换
 * - KPI 概览卡片：在籍总数/新增会员/流失会员/客资数量 4列
 * - 雷达图：六维分析（购买力/到店频率/课程参与/社交活跃/满意度/续卡意愿）
 * - 数据明细：会员列表
 */
const MemberData: React.FC = () => {
  const { activeTheme } = useThemeStore();

  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.primarySoftBg,
    frontColor: '#000000',
  }));

  const [data, setData] = useState<MemberDetailType | null>(null);
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);

  /** 加载数据 */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dataCenterService.getMemberDetail({ periodType: period });
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

  /** 渲染雷达图（CSS 实现） */
  const renderRadarChart = () => {
    if (!data) return null;

    const { categories, purchaseData, attendanceData } = data.radarData;
    const size = 280;
    const center = size / 2;
    const maxRadius = size / 2 - 40;

    /** 计算多边形顶点 */
    const getPolygonPoints = (values: number[]): string => {
      return values
        .map((value, index) => {
          const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
          const radius = (value / 100) * maxRadius;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return `${x}rpx ${y}rpx`;
        })
        .join(', ');
    };

    /** 计算标签位置和对齐方式 */
    const getLabelStyle = (index: number) => {
      const angle = (Math.PI * 2 * index) / categories.length - Math.PI / 2;
      const radius = maxRadius + 16;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);

      // 根据角度判断标签方位，调整对齐方式
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      let translateX = '-50%';
      let translateY = '-50%';
      const whiteSpace = 'nowrap' as const;

      if (cos > 0.3) {
        // 右侧：左对齐
        translateX = '0';
      } else if (cos < -0.3) {
        // 左侧：右对齐
        translateX = '-100%';
      }
      // 顶部/底部保持水平居中

      if (sin > 0.3) {
        // 底部：顶部对齐
        translateY = '0';
      } else if (sin < -0.3) {
        // 顶部：底部对齐
        translateY = '-100%';
      }

      return {
        left: `${x}rpx`,
        top: `${y}rpx`,
        transform: `translate(${translateX}, ${translateY})`,
        whiteSpace,
      };
    };

    return (
      <View
        className="relative mx-auto"
        style={{ width: `${size + 80}rpx`, height: `${size + 80}rpx` }}
      >
        {/* 雷达图主体（居中） */}
        <View
          className="absolute"
          style={{ left: '40rpx', top: '40rpx', width: `${size}rpx`, height: `${size}rpx` }}
        >
          {/* 背景网格 */}
          {Array.from({ length: 5 }).map((_, levelIndex) => {
            const levelValues = categories.map(() => ((levelIndex + 1) / 5) * 100);
            return (
              <View
                key={levelIndex}
                className={`absolute left-0 top-0 w-full h-full ${
                  levelIndex === 4 ? 'radar-grid-border' : 'radar-grid-bg'
                }`}
                style={{
                  clipPath: `polygon(${getPolygonPoints(levelValues)})`,
                  opacity: levelIndex === 4 ? 1 : 0.3 + levelIndex * 0.15,
                }}
              />
            );
          })}

          {/* 购卡数据多边形 */}
          <View
            className="absolute left-0 top-0 w-full h-full radar-purchase-fill radar-purchase-border"
            style={{
              clipPath: `polygon(${getPolygonPoints(purchaseData)})`,
            }}
          />

          {/* 出勤数据多边形 */}
          <View
            className="absolute left-0 top-0 w-full h-full radar-attendance-fill radar-attendance-border"
            style={{
              clipPath: `polygon(${getPolygonPoints(attendanceData)})`,
            }}
          />
        </View>

        {/* 标签（在外层，坐标偏移 40rpx 与雷达图对齐） */}
        {categories.map((category, index) => {
          const style = getLabelStyle(index);
          return (
            <Text
              key={index}
              className="absolute text-[22rpx] text-foreground-secondary font-medium"
              style={{
                left: `calc(${style.left} + 40rpx)`,
                top: `calc(${style.top} + 40rpx)`,
                transform: style.transform,
                whiteSpace: style.whiteSpace,
              }}
            >
              {category}
            </Text>
          );
        })}
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
              <View className="bg-primary-5 rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">在籍总数</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  {data?.totalMembers || 0}
                </Text>
              </View>
              <View className="bg-success-bg rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">新增会员</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  {data?.newMembers || 0}
                </Text>
              </View>
              <View className="bg-destructive-10 rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">流失会员</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  {data?.churnedMembers || 0}
                </Text>
              </View>
              <View className="bg-warning-bg rounded-[20rpx] p-[20rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">客资数量</Text>
                <Text className="text-[36rpx] font-bold text-foreground">
                  {data?.prospects || 0}
                </Text>
              </View>
            </View>
          </Card>

          {/* 雷达图卡片 */}
          <Card>
            <Text className="text-[30rpx] font-bold text-foreground block mb-[8rpx]">
              会员画像分析
            </Text>
            <Text className="text-[24rpx] text-muted-foreground block mb-[20rpx]">
              购卡与出勤六维对比
            </Text>

            {/* 图例 */}
            <View className="flex items-center justify-center gap-[32rpx] mb-[20rpx]">
              <View className="flex items-center gap-[8rpx]">
                <View className="w-[16rpx] h-[16rpx] rounded-full bg-primary" />
                <Text className="text-[24rpx] text-muted-foreground">购卡</Text>
              </View>
              <View className="flex items-center gap-[8rpx]">
                <View className="w-[16rpx] h-[16rpx] rounded-full bg-accent" />
                <Text className="text-[24rpx] text-muted-foreground">出勤</Text>
              </View>
            </View>

            {renderRadarChart()}
          </Card>

          {/* 数据明细卡片 */}
          <Card marginBottom={false}>
            <Text className="text-[30rpx] font-bold text-foreground block mb-[20rpx]">
              会员明细
            </Text>
            <View className="flex flex-col gap-[12rpx]">
              {data?.detailList.map((item, index) => (
                <View
                  key={item.id}
                  className="flex items-center gap-[16rpx] py-[16rpx] border-b-[2rpx] border-border last:border-b-0"
                >
                  <View className="w-[48rpx] h-[48rpx] rounded-full flex items-center justify-center bg-primary-10">
                    <Text className="text-[24rpx] text-primary font-medium">
                      {item.name.charAt(0)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[28rpx] font-medium text-foreground block">
                      {item.name}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] block">
                      {item.date}
                    </Text>
                  </View>
                  <Text
                    className={`text-[26rpx] font-medium ${
                      item.type === 'churned'
                        ? 'text-destructive'
                        : item.type === 'expiring'
                          ? 'text-warning'
                          : 'text-foreground'
                    }`}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
};

export default MemberData;
