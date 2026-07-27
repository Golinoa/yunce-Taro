/**
 * 我的邀约页 package-lead/pages/my-invite
 *
 * 老师视角：展示线索列表、筛选Tab、统计摘要、邀约二维码入口。
 * 支持下拉刷新、Tab筛选切换、新增线索。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import LeadCard from '@/components/lead/LeadCard';
import PageContainer from '@/components/PageContainer';
import { LEAD_FILTER_TAB_OPTIONS } from '@/constants/lead';
import { useLeadStore } from '@/stores/lead';
import type { LeadFilterTab } from '@/types/lead';
import { useAuth } from '@/utils/auth';

const MyInvitePage: React.FC = () => {
  const { session } = useAuth();
  const teacherId = session?.user.id || '';

  const {
    cache,
    summaryCache,
    loading,
    activeFilterTab,
    fetchCards,
    fetchSummary,
    setActiveFilterTab,
    invalidate,
  } = useLeadStore();

  // 页面显示时加载数据
  useDidShow(() => {
    if (teacherId) {
      fetchCards(teacherId, activeFilterTab);
      fetchSummary(teacherId);
    }
  });

  // 下拉刷新
  usePullDownRefresh(() => {
    if (teacherId) {
      invalidate(teacherId);
      Promise.all([
        fetchCards(teacherId, activeFilterTab, true),
        fetchSummary(teacherId, true),
      ]).finally(() => {
        Taro.stopPullDownRefresh();
      });
    }
  });

  // 当前 tab 的缓存 key
  const cacheKey = `${teacherId}::${activeFilterTab}`;
  const leadList = cache[cacheKey] || [];
  const summary = summaryCache[teacherId];
  const isLoading = loading[cacheKey];

  // Tab 切换
  const handleTabChange = useCallback(
    (tab: LeadFilterTab) => {
      setActiveFilterTab(tab);
      if (teacherId) {
        fetchCards(teacherId, tab);
      }
    },
    [teacherId, setActiveFilterTab, fetchCards],
  );

  // 新增线索
  const handleAddLead = useCallback(() => {
    Taro.navigateTo({ url: '/package-lead/pages/lead-form/index' });
  }, []);

  // 邀约二维码
  const handleInviteQr = useCallback(() => {
    Taro.navigateTo({ url: '/package-lead/pages/invite-qrcode/index' });
  }, []);

  return (
    <PageContainer>
      {/* 顶部统计摘要 */}
      {summary && (
        <View className="flex gap-2 px-page-padding py-3">
          <View className="flex-1 bg-primary/10 rounded-[16rpx] py-3 center">
            <Text className="text-[32rpx] font-bold text-primary">{summary.today_trial}</Text>
            <Text className="text-[22rpx] text-primary ml-1">今日试听</Text>
          </View>
          <View className="flex-1 bg-warning/10 rounded-[16rpx] py-3 center">
            <Text className="text-[32rpx] font-bold text-warning">{summary.pending}</Text>
            <Text className="text-[22rpx] text-warning ml-1">待预约</Text>
          </View>
          <View className="flex-1 bg-accent/10 rounded-[16rpx] py-3 center">
            <Text className="text-[32rpx] font-bold text-accent">{summary.following}</Text>
            <Text className="text-[22rpx] text-accent ml-1">跟进中</Text>
          </View>
          <View className="flex-1 bg-success/10 rounded-[16rpx] py-3 center">
            <Text className="text-[32rpx] font-bold text-success">{summary.converted}</Text>
            <Text className="text-[22rpx] text-success ml-1">已转化</Text>
          </View>
        </View>
      )}

      {/* 筛选 Tab */}
      <ScrollView scrollX className="px-page-padding py-2 flex-shrink-0">
        <View className="flex gap-2">
          {LEAD_FILTER_TAB_OPTIONS.map((tab) => (
            <View
              key={tab.key}
              className={cn(
                'px-[24rpx] py-[12rpx] rounded-full flex-shrink-0',
                activeFilterTab === tab.key ? 'bg-primary' : 'bg-muted',
              )}
              onClick={() => handleTabChange(tab.key)}
            >
              <Text
                className={cn(
                  'text-[24rpx] whitespace-nowrap',
                  activeFilterTab === tab.key
                    ? 'text-white font-medium'
                    : 'text-foreground-secondary',
                )}
              >
                {tab.label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 线索列表 */}
      <View className="px-page-padding pb-safe-bar">
        {isLoading && leadList.length === 0 && (
          <View className="py-20 center">
            <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
          </View>
        )}

        {!isLoading && leadList.length === 0 && (
          <View className="py-20 center flex-col gap-3">
            <Icon name="mdi-account-search" size={64} className="text-muted-foreground" />
            <Text className="text-[28rpx] text-muted-foreground">暂无线索</Text>
          </View>
        )}

        <View className="flex flex-col gap-3">
          {leadList.map((item) => (
            <LeadCard key={item.id} data={item} />
          ))}
        </View>
      </View>

      {/* 底部悬浮操作栏 */}
      <View className="fixed bottom-0 left-0 right-0 z-100 bg-white/95 backdrop-blur-sm border-t border-border">
        <View className="flex gap-2 px-page-padding pt-3 pb-safe-bar">
          <View
            className="flex-1 bg-white border-2 border-accent rounded-full py-3 center"
            onClick={() => Taro.navigateTo({ url: '/package-lead/pages/trial-slots/index' })}
          >
            <View className="flex items-center gap-1">
              <Icon name="mdi-calendar-clock" size={16} className="text-accent" />
              <Text className="text-[24rpx] text-accent font-medium">试听时段</Text>
            </View>
          </View>
          <View
            className="flex-1 bg-white border-2 border-primary rounded-full py-3 center"
            onClick={handleInviteQr}
          >
            <View className="flex items-center gap-1">
              <Icon name="mdi-qrcode-scan" size={16} className="text-primary" />
              <Text className="text-[24rpx] text-primary font-medium">邀约二维码</Text>
            </View>
          </View>
          <View
            className="flex-1 bg-gradient-primary rounded-full py-3 center"
            onClick={handleAddLead}
          >
            <View className="flex items-center gap-1">
              <Icon name="mdi-plus" size={16} className="text-white" />
              <Text className="text-[24rpx] text-white font-medium">新增线索</Text>
            </View>
          </View>
        </View>
      </View>
    </PageContainer>
  );
};

export default MyInvitePage;
