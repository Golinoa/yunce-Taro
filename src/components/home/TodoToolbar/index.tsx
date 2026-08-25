/**
 * TodoToolbar - 待办列表顶部工具栏
 *
 * 使用场景：首页待办 Tab；左侧「我的待办」对齐时间轴中线，
 * 右侧为视图切换 + 线框加号（快速记待办）。
 */
import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';

export type TodoViewMode = 'timeline' | 'quadrant';

export interface TodoToolbarProps {
  viewMode: TodoViewMode;
  onMyTodosClick: () => void;
  onViewModeChange: (mode: TodoViewMode) => void;
  /** 快速创建待办 */
  onAddTodoClick: () => void;
  className?: string;
}

/** 与 TodoList 时间轴几何对齐：外层 px-[8rpx] + 轴线 left-[36rpx] + 线宽 2rpx → 中心 45rpx */
const TIMELINE_AXIS_CENTER_RPX = 45;
const LEFT_BTN_SIZE_RPX = 72;
const RIGHT_BTN_SIZE_RPX = 72;
/** 视图切换与加号间距 */
const RIGHT_BTN_GAP_RPX = 8;

const TodoToolbar: React.FC<TodoToolbarProps> = ({
  viewMode,
  onMyTodosClick,
  onViewModeChange,
  onAddTodoClick,
  className,
}) => {
  const leftBtnLeftRpx = TIMELINE_AXIS_CENTER_RPX - LEFT_BTN_SIZE_RPX / 2;
  const isTimeline = viewMode === 'timeline';
  const viewSwitchRightRpx = RIGHT_BTN_SIZE_RPX + RIGHT_BTN_GAP_RPX;

  return (
    <View className={cn('relative mb-[20rpx] h-[72rpx]', className)}>
      {isTimeline && (
        <View
          className="pointer-events-none absolute w-[2rpx] todo-timeline-line"
          style={{
            left: `${TIMELINE_AXIS_CENTER_RPX - 1}rpx`,
            top: `${LEFT_BTN_SIZE_RPX / 2}rpx`,
            bottom: '-20rpx',
          }}
        />
      )}

      {/* 我的待办：小本子图标 */}
      <View
        className="absolute z-10 flex h-[72rpx] w-[72rpx] items-center justify-center rounded-full bg-primary-10 press-scale"
        style={{ left: `${leftBtnLeftRpx}rpx` }}
        onClick={onMyTodosClick}
      >
        <Icon name="mdi-clipboard-text-outline" size="md" color="primary" />
      </View>

      {/* 视图切换 */}
      <View
        className="absolute top-0 flex h-[72rpx] w-[72rpx] items-center justify-center press-scale"
        style={{ right: `${viewSwitchRightRpx}rpx` }}
        onClick={() => onViewModeChange(isTimeline ? 'quadrant' : 'timeline')}
      >
        <Icon
          name={isTimeline ? 'mdi-view-grid-outline' : 'mdi-format-list-bulleted'}
          size="md"
          color="primary"
        />
      </View>

      {/* 快速记待办：线框圆圈 + 加号，无实心底 */}
      <View
        className="absolute right-0 top-0 flex h-[72rpx] w-[72rpx] items-center justify-center press-scale"
        onClick={onAddTodoClick}
      >
        <View className="flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full border-[2rpx] border-primary">
          <Icon name="mdi-plus" size="md" color="primary" />
        </View>
      </View>
    </View>
  );
};

export default TodoToolbar;
