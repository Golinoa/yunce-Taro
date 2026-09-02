/**
 * 机构端首页 Tab：今日课表 / 待办事项 / 最近消课（条件渲染，高度自然撑开）
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import TodayScheduleCard from '@/components/home/TodayScheduleCard';
import TodoList from '@/components/home/TodoList';
import TodoQuadrantBoard from '@/components/home/TodoQuadrantBoard';
import TodoToolbar, { type TodoViewMode } from '@/components/home/TodoToolbar';
import Icon from '@/components/Icon';
import LessonConsumptionList, {
  navigateToLessonDetail,
} from '@/components/lesson/LessonConsumptionList';
import type { LessonConsumptionSection } from '@/components/lesson/LessonConsumptionList';
import type { TodoItem } from '@/types/home-todo';
import type { Schedule } from '@/types/schedule';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import {
  formatTabBadgeText,
  resolveTodoEmptyPanelStyle,
  type HomeTab,
  type HomeTabOption,
} from './home-todo-derived';

export interface HomeStaffTabPanelsProps {
  activeTab: HomeTab;
  tabOptions: HomeTabOption[];
  onTabChange: (tab: HomeTab) => void;
  schedules: Schedule[];
  onPrivateCheckIn: (bookingId: string) => Promise<void>;
  onVenueCheckIn: (venueBookingId: string) => Promise<void>;
  todoViewMode: TodoViewMode;
  todayTodoItems: TodoItem[];
  otherTodoCount: number;
  onTodoViewModeChange: (mode: TodoViewMode) => void;
  onOpenMyTodos: () => void;
  onOpenAddTodo: (quadrant?: TodoQuadrant) => void;
  onCompleteTodo: (item: TodoItem) => void;
  onOpenTodoDetail: (item: TodoItem) => void;
  onQuadrantChange: (item: TodoItem, quadrant: TodoQuadrant) => void;
  onQuadrantDragActiveChange: (active: boolean) => void;
  recentSections: LessonConsumptionSection[];
}

const HomeStaffTabPanels: React.FC<HomeStaffTabPanelsProps> = ({
  activeTab,
  tabOptions,
  onTabChange,
  schedules,
  onPrivateCheckIn,
  onVenueCheckIn,
  todoViewMode,
  todayTodoItems,
  otherTodoCount,
  onTodoViewModeChange,
  onOpenMyTodos,
  onOpenAddTodo,
  onCompleteTodo,
  onOpenTodoDetail,
  onQuadrantChange,
  onQuadrantDragActiveChange,
  recentSections,
}) => {
  return (
    <View className="px-[24rpx]">
      <View className="relative flex flex-row items-center gap-[24rpx] overflow-x-hidden py-[24rpx]">
        {tabOptions.map((tab) => {
          const badgeCount = typeof tab.badge === 'number' && tab.badge > 0 ? tab.badge : 0;
          return (
            <View
              key={tab.key}
              className={activeTab === tab.key ? 'tab-item-v14 active' : 'tab-item-v14'}
              onClick={() => onTabChange(tab.key)}
            >
              <Text className="tab-item-v14__label">{tab.label}</Text>
              {badgeCount > 0 && (
                <View className="tab-badge-v14">
                  <Text className="tab-badge-v14__text">{formatTabBadgeText(badgeCount)}</Text>
                </View>
              )}
            </View>
          );
        })}
        <View
          id="home-todo-fab-anchor"
          className="pointer-events-none absolute bottom-0 left-0 h-[1rpx] w-full"
        />
      </View>

      <View className="home-tab-panels relative min-h-[400rpx]">
        {activeTab === 'schedule' && (
          <View id="home-tab-panel-schedule">
            <TodayScheduleCard
              schedules={schedules}
              title=""
              onPrivateCheckIn={onPrivateCheckIn}
              onVenueCheckIn={onVenueCheckIn}
            />
          </View>
        )}

        {activeTab === 'todo' && (
          <View
            id="home-tab-panel-todo"
            className="relative pt-[24rpx] pb-[48rpx]"
            style={resolveTodoEmptyPanelStyle(todoViewMode, todayTodoItems.length)}
          >
            <TodoToolbar
              viewMode={todoViewMode}
              onMyTodosClick={onOpenMyTodos}
              onViewModeChange={onTodoViewModeChange}
              onAddTodoClick={() => onOpenAddTodo()}
            />
            {todoViewMode === 'timeline' ? (
              <TodoList
                items={todayTodoItems}
                onComplete={onCompleteTodo}
                onPress={onOpenTodoDetail}
              />
            ) : (
              <TodoQuadrantBoard
                items={todayTodoItems}
                onAddQuadrant={onOpenAddTodo}
                onComplete={onCompleteTodo}
                onQuadrantChange={onQuadrantChange}
                onDragActiveChange={onQuadrantDragActiveChange}
              />
            )}

            {/* 历史 / 未来待办入口：进入「我的待办」看全部（按截止日期等排序） */}
            <View
              className="mx-[8rpx] mt-[28rpx] flex flex-row items-center justify-center gap-[8rpx] rounded-[24rpx] bg-card px-[24rpx] py-[24rpx] shadow-card press-scale"
              onClick={onOpenMyTodos}
            >
              <Text className="text-[26rpx] text-primary font-medium">查看更多</Text>
              {otherTodoCount > 0 ? (
                <Text className="text-[22rpx] text-muted-foreground">还有 {otherTodoCount} 条</Text>
              ) : null}
              <Icon name="mdi-chevron-right" size="sm" color="primary" />
            </View>
          </View>
        )}

        {activeTab === 'recent' && (
          <View id="home-tab-panel-recent" className="pt-[24rpx]">
            <LessonConsumptionList
              sections={recentSections}
              emptyText="暂无消课记录"
              onRecordClick={navigateToLessonDetail}
              footerText="查看更多"
              onFooterClick={() =>
                Taro.navigateTo({
                  url: '/package-course/pages/records/index',
                })
              }
            />
          </View>
        )}
      </View>
    </View>
  );
};

export default HomeStaffTabPanels;
