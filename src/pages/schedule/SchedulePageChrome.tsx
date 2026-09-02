/**
 * 课表页顶栏：安全区 + 主分类 Tab + 周日历（Q2-1）
 */
import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React from 'react';
import CalendarWeekSelector, { type CalendarDotType } from '@/components/CalendarWeekSelector';
import Icon from '@/components/Icon';
import type { CourseCategoryMode } from '@/types/course-category';
import {
  getTabContainerWidth,
  TAB_WIDTH_RPX,
} from './schedule-tab-layout';

export type ScheduleChromeTabType = 'category' | 'venue';

export interface ScheduleChromeTabItem {
  key: string;
  type: ScheduleChromeTabType;
  label: string;
  mode?: CourseCategoryMode;
}

export interface SchedulePageChromeProps {
  navSafeHeight: number;
  tabs: ScheduleChromeTabItem[];
  activeTabKey: string;
  activeTab?: ScheduleChromeTabItem;
  tabScrollLeft: number;
  isParent: boolean;
  selectedDate: dayjs.Dayjs;
  scheduleSubMode: 'fixed' | 'open';
  getDateDotType: (date: dayjs.Dayjs) => CalendarDotType | undefined;
  getOpenDateDotType: (date: dayjs.Dayjs) => CalendarDotType | undefined;
  onMainTabChange: (tabKey: string, tabIndex: number) => void;
  onBatchAction: () => void;
  onScheduleDateChange: (date: dayjs.Dayjs) => void;
}

const SchedulePageChrome: React.FC<SchedulePageChromeProps> = ({
  navSafeHeight,
  tabs,
  activeTabKey,
  activeTab,
  tabScrollLeft,
  isParent,
  selectedDate,
  scheduleSubMode,
  getDateDotType,
  getOpenDateDotType,
  onMainTabChange,
  onBatchAction,
  onScheduleDateChange,
}) => (
  <>
    <View className="bg-schedule-header flex-shrink-0">
      <View
        className="flex items-end justify-end px-[18rpx] pb-[18rpx]"
        style={{ height: `${navSafeHeight}px` }}
      />
    </View>

    <View className="bg-schedule-page flex-shrink-0">
      {/* 主分类 Tab：基础模式 + 场地 + 独立展示分类 */}
      <View className="flex items-center px-[24rpx] py-[16rpx]">
        <ScrollView
          id="schedule-tab-scroll"
          className="flex-1 min-w-0 overflow-hidden"
          scrollX
          scrollWithAnimation
          showScrollbar={false}
          enhanced
          scrollLeft={tabScrollLeft}
        >
          <View
            className="flex items-center"
            style={{ width: `${getTabContainerWidth(tabs.length)}rpx` }}
          >
            {tabs.map((tab, index) => {
              const isActive = activeTabKey === tab.key;
              const isLast = index === tabs.length - 1;
              return (
                <View
                  key={tab.key}
                  className={cn(
                    'flex items-center justify-center rounded-full border py-[12rpx] transition-colors active:scale-95 shrink-0',
                    !isLast && 'mr-[16rpx]',
                    isActive ? 'border-primary/55 bg-primary/10' : 'border-border bg-card',
                  )}
                  style={{ width: `${TAB_WIDTH_RPX}rpx` }}
                  onClick={() => onMainTabChange(tab.key, index)}
                >
                  <Text
                    className={cn(
                      'text-[28rpx] font-medium',
                      isActive ? 'text-primary' : 'text-foreground-secondary',
                    )}
                  >
                    {tab.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
        <View className="ml-[16rpx] flex flex-shrink-0 items-center gap-[16rpx]">
          {!isParent && (
            <View
              className="flex items-center gap-[4rpx] active:opacity-70"
              onClick={onBatchAction}
            >
              <Text className="text-[28rpx] text-foreground-secondary">筛选</Text>
              <Icon name="mdi-chevron-down" size={20} color="mutedForeground" />
            </View>
          )}
          {!isParent && (activeTab?.mode === 'class' || activeTab?.mode === 'group') && (
            <View
              className="flex h-[56rpx] w-[56rpx] items-center justify-center active:opacity-70"
              onClick={onBatchAction}
            >
              <Icon
                name="mdi-checkbox-multiple-marked-outline"
                size={28}
                color="mutedForeground"
              />
            </View>
          )}
        </View>
      </View>

      {activeTab?.mode !== 'private' && (
        <CalendarWeekSelector
          selectedDate={selectedDate}
          onChange={onScheduleDateChange}
          getDateDotType={
            activeTab?.type === 'venue'
              ? undefined
              : scheduleSubMode === 'fixed'
                ? getDateDotType
                : getOpenDateDotType
          }
        />
      )}
    </View>
  </>
);

export default SchedulePageChrome;
