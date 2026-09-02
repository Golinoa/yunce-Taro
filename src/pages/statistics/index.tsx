import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import MockIdentitySwitcher from '@/components/MockIdentitySwitcher';
import SegmentedControl from '@/components/SegmentedControl';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { dataCenterService } from '@/services/data-center';
import { useCampusStore } from '@/stores/campus';
import { useThemeStore } from '@/stores/theme';
import type {
  VenueOverviewType,
  RevenueTrendType,
  FinanceDataType,
  MemberDataType,
  CardDataType,
  SalaryDataType,
} from '@/types/data-center';
import { useAuth } from '@/utils/auth';
import { useThemedNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';
import { syncTabBarByProfile } from '@/utils/tab-bar';

/**
 * 数据中心首页
 *
 * 场馆经营数据总览，包含：
 * - 顶部渐变头部：场馆选择 + 今日营收 + 三列数据
 * - 营收趋势卡片：日/周/月/年切换 + 柱状图
 * - 财务/会员/卡项/薪资 四大数据卡片
 * - 右下角悬浮「记一笔」按钮
 */
const DataCenter: React.FC = () => {
  /** 构建期常量：生产构建恒为 false，DCE 整棵移除 MockIdentitySwitcher（P-05/B-02） */
  const isDebugBuild = process.env.TARO_ENABLE_LOCAL_DEBUG === 'true';
  const { activeTheme } = useThemeStore();
  const { profile } = useAuth();
  const campuses = useCampusStore((s) => s.campuses);
  const currentCampusId = useCampusStore((s) => s.currentCampusId);
  const fetchCampuses = useCampusStore((s) => s.fetchCampuses);
  const [venueOverview, setVenueOverview] = useState<VenueOverviewType | null>(null);

  const campusName = useMemo(() => {
    const current = campuses.find((c) => c.id === currentCampusId);
    return current?.name || venueOverview?.venueName || '加载中';
  }, [campuses, currentCampusId, venueOverview?.venueName]);

  // 导航栏背景色与弥散渐变顶部一致，实现无缝衔接
  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.primarySoftBg,
    frontColor: '#000000',
  }));

  useDidShow(() => {
    syncTabBarByProfile(profile);
    if (campuses.length === 0) {
      void fetchCampuses();
    }
  });
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendType | null>(null);
  const [financeData, setFinanceData] = useState<FinanceDataType | null>(null);
  const [memberData, setMemberData] = useState<MemberDataType | null>(null);
  const [cardData, setCardData] = useState<CardDataType | null>(null);
  const [salaryData, setSalaryData] = useState<SalaryDataType | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const { setLoading } = useDelayedLoading();

  /** 加载所有数据 */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, trend, finance, member, card, salary] = await Promise.all([
        dataCenterService.getVenueOverview(),
        dataCenterService.getRevenueTrend({ period: trendPeriod }),
        dataCenterService.getFinanceData(),
        dataCenterService.getMemberData(),
        dataCenterService.getCardData(),
        dataCenterService.getSalaryData(),
      ]);
      setVenueOverview(overview);
      setRevenueTrend(trend);
      setFinanceData(finance);
      setMemberData(member);
      setCardData(card);
      setSalaryData(salary);
    } finally {
      setLoading(false);
    }
  }, [trendPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** 切换营收趋势周期 */
  const handlePeriodChange = useCallback((value: string) => {
    setTrendPeriod(value as 'day' | 'week' | 'month' | 'year');
  }, []);

  /** 跳转到财务详情 */
  const goFinanceDetail = useCallback(() => {
    Taro.navigateTo({ url: '/package-statistics/pages/finance-data/index' });
  }, []);

  /** 跳转会员详情 */
  const goMemberDetail = useCallback(() => {
    Taro.navigateTo({ url: '/package-statistics/pages/member-data/index' });
  }, []);

  /** 跳转卡项详情 */
  const goCardDetail = useCallback(() => {
    Taro.navigateTo({ url: '/package-statistics/pages/card-data/index' });
  }, []);

  /** 跳转薪资详情 */
  const goSalaryDetail = useCallback(() => {
    Taro.navigateTo({ url: '/package-statistics/pages/salary-data/index' });
  }, []);

  /** 跳转记一笔 */
  const goRecordTransaction = useCallback(() => {
    Taro.navigateTo({ url: '/package-statistics/pages/record-transaction/index' });
  }, []);

  /** 返回首页 */
  const goHome = useCallback(() => {
    Taro.switchTab({ url: '/pages/home/index' });
  }, []);

  /** 格式化金额：万以上显示 xx.x万 */
  const formatMoney = (value: number): string => {
    if (value >= 10000) {
      return (value / 10000).toFixed(1) + '万';
    }
    return value.toLocaleString();
  };

  /** 渲染变化率徽章 */
  const renderChangeBadge = (change: number) => {
    const isPositive = change >= 0;
    return (
      <View className="inline-flex items-center gap-[4rpx] px-[12rpx] py-[4rpx] rounded-full bg-card/80 backdrop-blur-sm shadow-card">
        <Icon
          name={isPositive ? 'mdi-trending-up' : 'mdi-trending-down'}
          size={20}
          color={isPositive ? 'success' : 'destructive'}
        />
        <Text
          className={`text-[20rpx] font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}
        >
          {isPositive ? '+' : ''}
          {change}%
        </Text>
      </View>
    );
  };

  /** 渲染柱状图 */
  const renderBarChart = () => {
    if (!revenueTrend || revenueTrend.data.length === 0) return null;

    const maxValue = Math.max(...revenueTrend.data.map((d) => d.value));
    const lastIndex = revenueTrend.data.length - 1;

    return (
      <View className="mt-[24rpx]">
        <View className="flex items-end justify-between h-[200rpx] gap-[8rpx]">
          {revenueTrend.data.map((item, index) => {
            const heightPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            const isLast = index === lastIndex;
            return (
              <View key={index} className="flex-1 flex flex-col items-center">
                <View className="w-full flex-1 flex items-end justify-center">
                  <View
                    className={cn(
                      'w-[70%] rounded-t-[8rpx] transition-all',
                      isLast ? 'bg-gradient-primary' : 'bg-primary/10',
                    )}
                    style={{ height: `${Math.max(heightPercent, 5)}%` }}
                  />
                </View>
                <Text
                  className={cn(
                    'text-[20rpx] mt-[8rpx]',
                    isLast ? 'text-primary font-medium' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
        <View className="flex justify-between mt-[20rpx] pt-[20rpx] border-t-[2rpx] border-border">
          <View>
            <Text className="text-[24rpx] text-muted-foreground block">
              {revenueTrend.totalLabel}
            </Text>
            <Text className="text-[32rpx] font-bold text-foreground">
              ¥{formatMoney(revenueTrend.total)}
            </Text>
          </View>
          <View className="text-right">
            <Text className="text-[24rpx] text-muted-foreground block">
              {revenueTrend.averageLabel}
            </Text>
            <Text className="text-[32rpx] font-bold text-foreground">
              ¥{formatMoney(revenueTrend.average)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background')}>
      {/* 顶部弥散渐变头部 */}
      <View className="bg-gradient-diffuse-top pb-[80rpx] px-[32rpx] pt-[24rpx] relative overflow-hidden">
        {/* 场馆选择：左侧，点击跳转首页 */}
        <View className="relative z-10 mb-[32rpx]">
          <View
            className="inline-flex items-center gap-[8rpx] bg-card/80 backdrop-blur-sm px-[20rpx] py-[10rpx] rounded-full shadow-card press-scale"
            onClick={goHome}
          >
            <Icon name="mdi-office-building-outline" size={20} color="primary" />
            <Text className="text-[26rpx] text-foreground font-medium">{campusName}</Text>
            <Icon name="mdi-chevron-down" size={20} color="muted" />
          </View>
        </View>

        {/* 今日营收大数字 */}
        <View className="relative z-10">
          <Text className="text-[26rpx] text-muted-foreground block mb-[8rpx]">今日营收</Text>
          <View className="flex items-end gap-[16rpx]">
            <Text className="text-[64rpx] font-bold text-foreground leading-none">
              ¥{venueOverview?.todayRevenue?.toLocaleString() || '0'}
            </Text>
            {venueOverview && renderChangeBadge(venueOverview.revenueChange)}
          </View>
          <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] block">较昨日</Text>
        </View>

        {/* 三列数据 */}
        <View className="flex gap-[16rpx] mt-[32rpx] relative z-10">
          <View className="flex-1 bg-card/80 backdrop-blur-sm rounded-[20rpx] p-[20rpx] text-center shadow-card">
            <Text className="text-[36rpx] font-bold text-foreground block leading-tight">
              {venueOverview?.todayOrders || 0}
            </Text>
            <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">今日订单</Text>
          </View>
          <View className="flex-1 bg-card/80 backdrop-blur-sm rounded-[20rpx] p-[20rpx] text-center shadow-card">
            <Text className="text-[36rpx] font-bold text-foreground block leading-tight">
              {venueOverview?.newMembers || 0}
            </Text>
            <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">今日新增会员</Text>
          </View>
          <View className="flex-1 bg-card/80 backdrop-blur-sm rounded-[20rpx] p-[20rpx] text-center shadow-card">
            <Text className="text-[36rpx] font-bold text-foreground block leading-tight">
              {venueOverview ? formatMoney(venueOverview.floatBalance) : '0'}
            </Text>
            <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">浮盈余额</Text>
          </View>
        </View>
      </View>

      {/* 白色卡片区域 */}
      <ScrollView className="bg-background" scrollY style={{ marginTop: '-40rpx' }}>
        <View className="px-[24rpx] pb-[120rpx]">
          {/* 营收趋势卡片 */}
          <Card>
            <View className="flex items-center justify-between mb-[16rpx]">
              <Text className="text-[30rpx] font-bold text-foreground">营收趋势</Text>
              <View className="w-[280rpx]">
                <SegmentedControl
                  options={[
                    { label: '日', value: 'day' },
                    { label: '周', value: 'week' },
                    { label: '月', value: 'month' },
                    { label: '年', value: 'year' },
                  ]}
                  value={trendPeriod}
                  onChange={handlePeriodChange}
                />
              </View>
            </View>
            {renderBarChart()}
          </Card>

          {/* 财务数据卡片 */}
          <Card clickable onClick={goFinanceDetail}>
            <View className="flex items-start justify-between mb-[20rpx]">
              <View className="flex items-center gap-[16rpx]">
                <View className="w-[80rpx] h-[80rpx] rounded-[20rpx] bg-kpi-orange flex items-center justify-center">
                  <Icon name="mdi-cash" size={40} color="white" />
                </View>
                <View>
                  <Text className="text-[30rpx] font-bold text-foreground block">财务数据</Text>
                  <Text className="text-[24rpx] text-muted-foreground">本月净收入</Text>
                </View>
              </View>
              <Icon name="mdi-chevron-right" size={28} color="muted" />
            </View>
            <View className="flex items-end gap-[12rpx] mb-[20rpx]">
              <Text className="text-[48rpx] font-bold text-foreground leading-none">
                ¥{financeData ? formatMoney(financeData.monthNetIncome) : '0'}
              </Text>
              {financeData && (
                <View
                  className={`inline-flex items-center gap-[4rpx] px-[10rpx] py-[4rpx] rounded-full ${
                    financeData.netIncomeChange >= 0 ? 'bg-success/10' : 'bg-destructive/10'
                  }`}
                >
                  <Icon
                    name={
                      financeData.netIncomeChange >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'
                    }
                    size={18}
                    color={financeData.netIncomeChange >= 0 ? 'success' : 'destructive'}
                  />
                  <Text
                    className={`text-[20rpx] font-medium ${
                      financeData.netIncomeChange >= 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {financeData.netIncomeChange >= 0 ? '+' : ''}
                    {financeData.netIncomeChange}%
                  </Text>
                </View>
              )}
            </View>
            <View className="flex gap-[16rpx]">
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  ¥{financeData ? formatMoney(financeData.income) : '0'}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">收入</Text>
              </View>
              <View className="w-[2rpx] bg-border" />
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  ¥{financeData ? formatMoney(financeData.expense) : '0'}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">支出</Text>
              </View>
              <View className="w-[2rpx] bg-border" />
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  ¥{financeData ? formatMoney(financeData.float) : '0'}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">浮盈</Text>
              </View>
            </View>
          </Card>

          {/* 会员数据卡片 */}
          <Card clickable onClick={goMemberDetail}>
            <View className="flex items-start justify-between mb-[20rpx]">
              <View className="flex items-center gap-[16rpx]">
                <View className="w-[80rpx] h-[80rpx] rounded-[20rpx] bg-kpi-blue flex items-center justify-center">
                  <Icon name="mdi-account-group" size={40} color="white" />
                </View>
                <View>
                  <Text className="text-[30rpx] font-bold text-foreground block">会员数据</Text>
                  <Text className="text-[24rpx] text-muted-foreground">活跃会员</Text>
                </View>
              </View>
              <Icon name="mdi-chevron-right" size={28} color="muted" />
            </View>
            <View className="flex items-end gap-[12rpx] mb-[20rpx]">
              <Text className="text-[48rpx] font-bold text-foreground leading-none">
                {memberData?.activeMembers || 0}
              </Text>
              {memberData && (
                <View
                  className={`inline-flex items-center gap-[4rpx] px-[10rpx] py-[4rpx] rounded-full ${
                    memberData.activeChange >= 0 ? 'bg-success/10' : 'bg-destructive/10'
                  }`}
                >
                  <Icon
                    name={memberData.activeChange >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'}
                    size={18}
                    color={memberData.activeChange >= 0 ? 'success' : 'destructive'}
                  />
                  <Text
                    className={`text-[20rpx] font-medium ${
                      memberData.activeChange >= 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {memberData.activeChange >= 0 ? '+' : ''}
                    {memberData.activeChange}%
                  </Text>
                </View>
              )}
            </View>
            <View className="flex gap-[16rpx]">
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  {memberData?.newThisMonth || 0}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">本月新增</Text>
              </View>
              <View className="w-[2rpx] bg-border" />
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  {memberData?.expiringSoon || 0}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">即将到期</Text>
              </View>
              <View className="w-[2rpx] bg-border" />
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  {memberData?.churnWarning || 0}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">流失预警</Text>
              </View>
            </View>
          </Card>

          {/* 卡项数据卡片 */}
          <Card clickable onClick={goCardDetail}>
            <View className="flex items-start justify-between mb-[20rpx]">
              <View className="flex items-center gap-[16rpx]">
                <View className="w-[80rpx] h-[80rpx] rounded-[20rpx] bg-kpi-purple flex items-center justify-center">
                  <Icon name="mdi-cash-multiple" size={40} color="white" />
                </View>
                <View>
                  <Text className="text-[30rpx] font-bold text-foreground block">卡项数据</Text>
                  <Text className="text-[24rpx] text-muted-foreground">本月售卡</Text>
                </View>
              </View>
              <Icon name="mdi-chevron-right" size={28} color="muted" />
            </View>
            <View className="flex items-end gap-[12rpx] mb-[20rpx]">
              <Text className="text-[48rpx] font-bold text-foreground leading-none">
                ¥{cardData ? formatMoney(cardData.monthCardSales) : '0'}
              </Text>
              {cardData && (
                <View
                  className={`inline-flex items-center gap-[4rpx] px-[10rpx] py-[4rpx] rounded-full ${
                    cardData.salesChange >= 0 ? 'bg-success/10' : 'bg-destructive/10'
                  }`}
                >
                  <Icon
                    name={cardData.salesChange >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'}
                    size={18}
                    color={cardData.salesChange >= 0 ? 'success' : 'destructive'}
                  />
                  <Text
                    className={`text-[20rpx] font-medium ${
                      cardData.salesChange >= 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {cardData.salesChange >= 0 ? '+' : ''}
                    {cardData.salesChange}%
                  </Text>
                </View>
              )}
            </View>
            <View className="flex gap-[16rpx]">
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  {cardData?.soldCount || 0}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">售出张数</Text>
              </View>
              <View className="w-[2rpx] bg-border" />
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  {cardData?.pendingRedeem || 0}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">待核销</Text>
              </View>
              <View className="w-[2rpx] bg-border" />
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-primary block">
                  {cardData?.topSeller || '-'}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">热卖卡种</Text>
              </View>
            </View>
          </Card>

          {/* 薪资数据卡片 */}
          <Card clickable onClick={goSalaryDetail}>
            <View className="flex items-start justify-between mb-[20rpx]">
              <View className="flex items-center gap-[16rpx]">
                <View className="w-[80rpx] h-[80rpx] rounded-[20rpx] bg-kpi-green flex items-center justify-center">
                  <Icon name="mdi-cash" size={40} color="white" />
                </View>
                <View>
                  <Text className="text-[30rpx] font-bold text-foreground block">薪资数据</Text>
                  <Text className="text-[24rpx] text-muted-foreground">本月应发薪资</Text>
                </View>
              </View>
              <Icon name="mdi-chevron-right" size={28} color="muted" />
            </View>
            <View className="flex items-end gap-[12rpx] mb-[20rpx]">
              <Text className="text-[48rpx] font-bold text-foreground leading-none">
                ¥{salaryData ? formatMoney(salaryData.monthSalaryPayable) : '0'}
              </Text>
              {salaryData && (
                <View
                  className={`inline-flex items-center gap-[4rpx] px-[10rpx] py-[4rpx] rounded-full ${
                    salaryData.salaryChange >= 0 ? 'bg-success/10' : 'bg-destructive/10'
                  }`}
                >
                  <Icon
                    name={salaryData.salaryChange >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'}
                    size={18}
                    color={salaryData.salaryChange >= 0 ? 'success' : 'destructive'}
                  />
                  <Text
                    className={`text-[20rpx] font-medium ${
                      salaryData.salaryChange >= 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {salaryData.salaryChange >= 0 ? '+' : ''}
                    {salaryData.salaryChange}%
                  </Text>
                </View>
              )}
            </View>
            <View className="flex gap-[16rpx]">
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  ¥{salaryData ? formatMoney(salaryData.classFee) : '0'}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">课时费</Text>
              </View>
              <View className="w-[2rpx] bg-border" />
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  ¥{salaryData ? formatMoney(salaryData.commission) : '0'}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">提成</Text>
              </View>
              <View className="w-[2rpx] bg-border" />
              <View className="flex-1 text-center">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  {salaryData?.coachCount || 0}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">教练</Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* 右下角悬浮按钮 - 记一笔 */}
      <View
        className="fixed right-[32rpx] bottom-[120rpx] w-[112rpx] h-[112rpx] rounded-full bg-gradient-primary shadow-elegant flex items-center justify-center z-50 press-scale"
        onClick={goRecordTransaction}
      >
        <View className="flex flex-col items-center">
          <Icon name="mdi-pencil" size={36} color="white" />
          <Text className="text-[20rpx] text-white font-medium mt-[4rpx]">记一笔</Text>
        </View>
      </View>

      {/* 仅 debug 构建挂载；生产构建常量折叠后整棵子树被移除 */}
      {isDebugBuild && <MockIdentitySwitcher />}
    </View>
  );
};

export default withRouteGuard(DataCenter);
