import { View, Text, ScrollView, Swiper, SwiperItem } from '@tarojs/components';
import React, { useCallback } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import DateRangeSheet from '@/components/statistics/DateRangeSheet';
import FinanceAnalysis from '@/components/statistics/FinanceAnalysis';
import FinanceKpi from '@/components/statistics/FinanceKpi';
import OperationKpi from '@/components/statistics/OperationKpi';
import RankTabs from '@/components/statistics/RankTabs';
import TrendSection from '@/components/statistics/TrendSection';
import IncomeTab from './IncomeTab';
import LessonTab from './LessonTab';
import { useStatistics } from './useStatistics';

/** 视图类型 */
type ViewType = 'operation' | 'finance';

const TEACHER_TAB_SWIPER_DURATION = 260;

/**
 * 统计页面主组件
 * 对齐设计稿 scheme-bc-fusion-v2.html
 * - 教师端：运营/财务视图切换 + 预警摘要 + KPI + 排行 + 趋势
 * - 家长端：保留原有课时统计逻辑
 */
const Statistics: React.FC = () => {
  const {
    isTeacher,
    status,
    errorMsg,
    refreshing,
    activeTab,
    setActiveTab,
    year,
    month,
    filterMode,
    activeKey,
    startDate,
    endDate,
    showCustomPicker,
    handleQuickFilter,
    handleToggleCustomPicker,
    handleCustomConfirm,
    // 数据
    records,
    packages,
    parentStudents,
    activeStudentName,
    // 计算
    totalHoursUsed,
    totalRemaining,
    totalHours,
    lessonCount,
    incomeData,
    compareData,
    paymentRank,
    studentDetail,
    incomeDetail,
    displayLessonTrend,
    displayIncomeTrend,
    displayLessonRank,
    displayPaymentRank,
    displayParentTrend,
    // 操作
    loadBaseData,
    handleRefresh,
    // 新增：设计稿数据
    viewType,
    setViewType,
    operationKpiData,
    financeKpiData,
    financeAnalysisData,
    rankTabsData,
  } = useStatistics();

  const [teacherSwiperCurrent, setTeacherSwiperCurrent] = React.useState(
    viewType === 'finance' ? 1 : 0,
  );

  React.useEffect(() => {
    setTeacherSwiperCurrent(viewType === 'finance' ? 1 : 0);
  }, [viewType]);

  /** 切换视图（运营/财务） */
  const handleViewChange = useCallback(
    (view: ViewType) => {
      if (!isTeacher || view === viewType) {
        return;
      }

      setTeacherSwiperCurrent(view === 'finance' ? 1 : 0);
    },
    [isTeacher, viewType],
  );

  const handleTeacherSwiperChange = useCallback(
    (event: { detail?: { current?: number } }) => {
      if (!isTeacher) return;

      const nextCurrent = event.detail?.current ?? 0;
      setTeacherSwiperCurrent(nextCurrent);
    },
    [isTeacher],
  );

  const handleTeacherSwiperFinish = useCallback(
    (event: { detail?: { current?: number } }) => {
      if (!isTeacher) return;

      const current = event.detail?.current ?? teacherSwiperCurrent;
      const nextView: ViewType = current === 1 ? 'finance' : 'operation';

      if (nextView !== viewType) {
        setViewType(nextView);
      }
    },
    [isTeacher, setViewType, teacherSwiperCurrent, viewType],
  );

  /** 渲染顶部导航栏（运营/财务切换） */
  const renderNavBar = () => {
    if (!isTeacher) {
      return (
        <View className="px-[24rpx] py-[24rpx] bg-white/90 backdrop-blur-sm border-b-[2rpx] border-solid border-border-light flex items-center justify-between">
          <Text className="text-[32rpx] font-bold text-foreground">课时记录</Text>
          {activeStudentName && (
            <View className="bg-primary/10 px-[16rpx] py-[8rpx] rounded-full">
              <Text className="text-[24rpx] text-primary">{activeStudentName}</Text>
            </View>
          )}
        </View>
      );
    }
    return (
      <View className="px-[24rpx] py-[24rpx] bg-white/90 backdrop-blur-sm border-b-[2rpx] border-solid border-border-light flex items-center justify-between">
        <View className="flex items-center gap-[16rpx]">
          <Text className="text-[32rpx] font-bold text-foreground">数据中心</Text>
        </View>
        <View className="flex items-center gap-[8rpx] bg-muted rounded-full p-[4rpx]">
          <View
            className={`px-[24rpx] py-[12rpx] rounded-full text-[24rpx] font-medium transition-all ${
              teacherSwiperCurrent === 0
                ? 'bg-primary text-white shadow-elegant'
                : 'text-muted-foreground'
            }`}
            onClick={() => handleViewChange('operation')}
          >
            <Text className={teacherSwiperCurrent === 0 ? 'text-white' : 'text-muted-foreground'}>
              运营
            </Text>
          </View>
          <View
            className={`px-[24rpx] py-[12rpx] rounded-full text-[24rpx] font-medium transition-all ${
              teacherSwiperCurrent === 1
                ? 'bg-primary text-white shadow-elegant'
                : 'text-muted-foreground'
            }`}
            onClick={() => handleViewChange('finance')}
          >
            <Text className={teacherSwiperCurrent === 1 ? 'text-white' : 'text-muted-foreground'}>
              财务
            </Text>
          </View>
        </View>
      </View>
    );
  };

  /** 渲染时段显示 + 筛选 */
  const renderPeriodFilter = (currentViewType: ViewType) => {
    const periodText =
      filterMode === 'year'
        ? `${year}年`
        : filterMode === 'quarter'
          ? `${year}年 Q${month}`
          : filterMode === 'month'
            ? `${year}年${month}月`
            : `${startDate || '开始'} ~ ${endDate || '结束'}`;

    return (
      <View className="bg-gradient-subtle px-[24rpx] pt-[40rpx] pb-[24rpx]">
        {/* 时段显示 + 健康徽章 */}
        <View className="flex items-center justify-between mb-[24rpx]">
          <View className="flex items-center gap-[8rpx]">
            <Text className="text-[28rpx] text-foreground-secondary">{periodText}</Text>
            <Icon name="mdi-chevron-down" size="xs" color="muted" />
          </View>
          <View className="flex items-center gap-[8rpx] bg-success/5 px-[16rpx] py-[8rpx] rounded-[16rpx]">
            <Icon name="mdi-trending-up" size="xs" color="success" />
            <Text className="text-[24rpx] text-success">整体向好</Text>
          </View>
        </View>

        {/* 教师端：运营/财务 KPI */}
        {isTeacher && currentViewType === 'operation' && <OperationKpi data={operationKpiData} />}
        {isTeacher && currentViewType === 'finance' && <FinanceKpi data={financeKpiData} />}

        {/* 家长端：保留原有 KPI 简化展示 */}
        {!isTeacher && (
          <View className="bg-white rounded-[24rpx] p-[24rpx] border-[2rpx] border-solid border-border-light shadow-card mb-[24rpx]">
            <View className="grid grid-cols-3 gap-[16rpx]">
              <View className="text-center">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">消耗课时</Text>
                <Text className="text-[40rpx] font-bold text-primary number-display block">
                  {totalHoursUsed}
                </Text>
              </View>
              <View className="text-center">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">剩余课时</Text>
                <Text className="text-[40rpx] font-bold text-primary number-display block">
                  {totalRemaining}
                </Text>
              </View>
              <View className="text-center">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">充值课时</Text>
                <Text className="text-[40rpx] font-bold text-primary number-display block">
                  {totalHours}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 快捷时段筛选：本月 / 上月 / 本季 / 本年 / 自定义 */}
        <View className="flex gap-[12rpx]">
          <View
            className={`flex-1 py-[16rpx] rounded-[24rpx] text-center text-[24rpx] font-medium transition-all ${
              activeKey === 'thisMonth'
                ? 'bg-primary text-white'
                : 'bg-white border-[2rpx] border-solid border-border-light text-foreground-secondary'
            }`}
            onClick={() => handleQuickFilter('thisMonth')}
          >
            <Text
              className={activeKey === 'thisMonth' ? 'text-white' : 'text-foreground-secondary'}
            >
              本月
            </Text>
          </View>
          <View
            className={`flex-1 py-[16rpx] rounded-[24rpx] text-center text-[24rpx] font-medium transition-all ${
              activeKey === 'lastMonth'
                ? 'bg-primary text-white'
                : 'bg-white border-[2rpx] border-solid border-border-light text-foreground-secondary'
            }`}
            onClick={() => handleQuickFilter('lastMonth')}
          >
            <Text
              className={activeKey === 'lastMonth' ? 'text-white' : 'text-foreground-secondary'}
            >
              上月
            </Text>
          </View>
          <View
            className={`flex-1 py-[16rpx] rounded-[24rpx] text-center text-[24rpx] font-medium transition-all ${
              activeKey === 'thisQuarter'
                ? 'bg-primary text-white'
                : 'bg-white border-[2rpx] border-solid border-border-light text-foreground-secondary'
            }`}
            onClick={() => handleQuickFilter('thisQuarter')}
          >
            <Text
              className={activeKey === 'thisQuarter' ? 'text-white' : 'text-foreground-secondary'}
            >
              本季
            </Text>
          </View>
          <View
            className={`flex-1 py-[16rpx] rounded-[24rpx] text-center text-[24rpx] font-medium transition-all ${
              activeKey === 'thisYear'
                ? 'bg-primary text-white'
                : 'bg-white border-[2rpx] border-solid border-border-light text-foreground-secondary'
            }`}
            onClick={() => handleQuickFilter('thisYear')}
          >
            <Text className={activeKey === 'thisYear' ? 'text-white' : 'text-foreground-secondary'}>
              本年
            </Text>
          </View>
          <View
            className={`flex-1 py-[16rpx] rounded-[24rpx] text-center text-[24rpx] font-medium transition-all ${
              activeKey === 'custom'
                ? 'bg-primary text-white'
                : 'bg-white border-[2rpx] border-solid border-border-light text-foreground-secondary'
            }`}
            onClick={handleToggleCustomPicker}
          >
            <Text className={activeKey === 'custom' ? 'text-white' : 'text-foreground-secondary'}>
              自定义
            </Text>
          </View>
        </View>

        {/* 自定义区间选择弹窗 */}
        <DateRangeSheet
          visible={showCustomPicker}
          startDate={startDate}
          endDate={endDate}
          onConfirm={handleCustomConfirm}
          onClose={handleToggleCustomPicker}
        />
      </View>
    );
  };

  /** 渲染运营视图主体（排行） */
  const renderOperationContent = () => {
    return (
      <View className="px-[24rpx] pb-[32rpx]">
        <View className="h-[24rpx]" />

        {/* 排行明细（学员/教师/校区 Tab 切换） */}
        {rankTabsData.length > 0 && <RankTabs tabs={rankTabsData} periodLabel="本月" />}
      </View>
    );
  };

  /** 渲染财务视图主体（财务分析） */
  const renderFinanceContent = () => {
    return (
      <View className="px-[24rpx] pb-[32rpx]">
        <View className="h-[24rpx]" />

        {/* 财务分析（收支概览 + 收入/支出构成 Tab） */}
        <FinanceAnalysis data={financeAnalysisData} />
      </View>
    );
  };

  /** 渲染家长端内容（保留原有逻辑） */
  const renderParentContent = () => {
    return (
      <View className="px-[24rpx] pt-[24rpx] pb-[32rpx]">
        <View className="flex gap-[16rpx] mb-[32rpx] bg-white rounded-[24rpx] p-[8rpx] shadow-soft">
          <View
            className={`flex-1 py-[24rpx] rounded-[24rpx] text-center text-[28rpx] font-medium transition-all ${
              activeTab === 'lesson'
                ? 'bg-gradient-primary text-white shadow-elegant'
                : 'text-muted-foreground'
            }`}
            onClick={() => setActiveTab('lesson')}
          >
            <Text className={activeTab === 'lesson' ? 'text-white' : 'text-muted-foreground'}>
              课时统计
            </Text>
          </View>
          <View
            className={`flex-1 py-[24rpx] rounded-[24rpx] text-center text-[28rpx] font-medium transition-all ${
              activeTab === 'income'
                ? 'bg-gradient-primary text-white shadow-elegant'
                : 'text-muted-foreground'
            }`}
            onClick={() => setActiveTab('income')}
          >
            <Text className={activeTab === 'income' ? 'text-white' : 'text-muted-foreground'}>
              收入统计
            </Text>
          </View>
        </View>

        {activeTab === 'lesson' ? (
          <LessonTab
            isTeacher={isTeacher}
            totalHoursUsed={totalHoursUsed}
            totalRemaining={totalRemaining}
            totalHours={totalHours}
            lessonCount={lessonCount}
            displayLessonTrend={displayLessonTrend}
            displayLessonRank={displayLessonRank}
            displayParentTrend={displayParentTrend}
            studentDetail={studentDetail}
            records={records}
            packages={packages}
            parentStudents={parentStudents}
          />
        ) : (
          <IncomeTab
            isTeacher={isTeacher}
            incomeData={incomeData}
            displayIncomeTrend={displayIncomeTrend}
            compareData={compareData}
            displayPaymentRank={displayPaymentRank}
            paymentRank={paymentRank}
            incomeDetail={incomeDetail}
          />
        )}

        {status === 'empty' && (
          <View className="py-[64rpx]">
            <Empty icon="mdi-chart-bar" description="暂无统计数据" />
          </View>
        )}
      </View>
    );
  };

  /** 渲染趋势分析区（底部，默认收起） */
  const renderTrendSection = (currentViewType: ViewType) => {
    return (
      <TrendSection
        data={{
          chartData: currentViewType === 'operation' ? displayLessonTrend : displayIncomeTrend,
          chartUnit: currentViewType === 'operation' ? '课时' : '元',
          chartTheme: currentViewType === 'operation' ? 'primary' : 'accent',
          chartTitle: currentViewType === 'operation' ? '近6个月课时消耗趋势' : '近6个月收入趋势',
          momVal: compareData.mom,
          momLabel: currentViewType === 'operation' ? '课时' : '收入',
          momDesc: currentViewType === 'operation' ? '课时环比变化' : compareData.momValue,
          yoyVal: compareData.yoy,
          yoyLabel: currentViewType === 'operation' ? '课时' : '收入',
          yoyDesc: compareData.yoyValue,
        }}
      />
    );
  };

  const renderTeacherPanel = (currentViewType: ViewType) => {
    return (
      <>
        {renderPeriodFilter(currentViewType)}
        {currentViewType === 'operation' ? renderOperationContent() : renderFinanceContent()}
        <View className="h-[16rpx] bg-muted" />
        {renderTrendSection(currentViewType)}
        <View className="text-center py-[32rpx]">
          <Text className="text-[24rpx] text-muted-foreground">
            数据更新时间：{new Date().toLocaleString('zh-CN')}
          </Text>
        </View>
      </>
    );
  };

  if (status === 'loading') {
    return (
      <View className="min-h-screen bg-gradient-subtle">
        {renderNavBar()}
        {renderPeriodFilter(viewType)}
        <View className="py-[64rpx] flex justify-center">
          <Loading />
        </View>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="min-h-screen bg-gradient-subtle">
        {renderNavBar()}
        {renderPeriodFilter(viewType)}
        <View className="py-[64rpx] flex flex-col items-center gap-[32rpx]">
          <Empty icon="mdi-alert-circle" description={errorMsg || '加载失败'} />
          <View
            className="bg-gradient-primary px-[48rpx] py-[16rpx] rounded-[16rpx]"
            onClick={() => loadBaseData()}
          >
            <Text className="text-[28rpx] text-white font-medium">重新加载</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      {/* 顶部导航 - 固定不滚动 */}
      {renderNavBar()}
      {isTeacher ? (
        <Swiper
          className="bg-gradient-subtle h-calc-nav"
          current={teacherSwiperCurrent}
          duration={TEACHER_TAB_SWIPER_DURATION}
          easingFunction="easeOutCubic"
          skipHiddenItemLayout
          onChange={handleTeacherSwiperChange}
          onAnimationFinish={handleTeacherSwiperFinish}
        >
          <SwiperItem itemId="operation">
            <View className="h-full bg-gradient-subtle">
              <ScrollView
                className="h-full"
                scrollY
                refresherEnabled
                refresherTriggered={refreshing && teacherSwiperCurrent === 0}
                onRefresherRefresh={handleRefresh}
              >
                <View className="min-h-full">{renderTeacherPanel('operation')}</View>
              </ScrollView>
            </View>
          </SwiperItem>
          <SwiperItem itemId="finance">
            <View className="h-full bg-gradient-subtle">
              <ScrollView
                className="h-full"
                scrollY
                refresherEnabled
                refresherTriggered={refreshing && teacherSwiperCurrent === 1}
                onRefresherRefresh={handleRefresh}
              >
                <View className="min-h-full">{renderTeacherPanel('finance')}</View>
              </ScrollView>
            </View>
          </SwiperItem>
        </Swiper>
      ) : (
        <View className="bg-gradient-subtle h-calc-nav">
          <ScrollView
            className="h-full"
            scrollY
            refresherEnabled
            refresherTriggered={refreshing}
            onRefresherRefresh={handleRefresh}
          >
            <View className="min-h-full">
              {/* L1: 核心决策区（时段 + KPI + 快捷筛选） */}
              {renderPeriodFilter(viewType)}

              {/* 主体区域 */}
              {renderParentContent()}

              {/* 分隔带 */}
              <View className="h-[16rpx] bg-muted" />

              {/* L5: 趋势分析（默认收起） */}
              {renderTrendSection(viewType)}

              {/* 底部更新时间 */}
              <View className="text-center py-[32rpx]">
                <Text className="text-[24rpx] text-muted-foreground">
                  数据更新时间：{new Date().toLocaleString('zh-CN')}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </>
  );
};

export default Statistics;
