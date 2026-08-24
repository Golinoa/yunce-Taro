/**
 * TodoToolbar - 待办列表顶部工具栏
 *
 * 使用场景：首页待办 Tab；左侧日历入口，右侧时间轴/四象限视图切换。
 */
import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';

export type TodoViewMode = 'timeline' | 'quadrant';

export interface TodoToolbarProps {
  viewMode: TodoViewMode;
  onCalendarClick: () => void;
  onViewModeChange: (mode: TodoViewMode) => void;
  className?: string;
}

const TodoToolbar: React.FC<TodoToolbarProps> = ({
  viewMode,
  onCalendarClick,
  onViewModeChange,
  className,
}) => {
  return (
    <View className={cn('mb-[20rpx] flex flex-row items-center justify-between', className)}>
      <View
        className="flex h-[72rpx] w-[72rpx] items-center justify-center rounded-full bg-primary-10 press-scale"
        onClick={onCalendarClick}
      >
        <Icon name="mdi-calendar-outline" size="md" color="primary" />
      </View>
      <View
        className="flex h-[72rpx] w-[72rpx] items-center justify-center press-scale"
        onClick={() => onViewModeChange(viewMode === 'timeline' ? 'quadrant' : 'timeline')}
      >
        <Icon
          name={viewMode === 'timeline' ? 'mdi-view-grid-outline' : 'mdi-format-list-bulleted'}
          size="md"
          color="foregroundSecondary"
        />
      </View>
    </View>
  );
};

export default TodoToolbar;
