/**
 * TodoQuadrantIcon - 四象限 2×2 小方块图标
 *
 * 使用场景：创建待办选择象限、待办时间轴卡片角标；
 * 通过高亮象限对应格子 + 渐变深浅表达紧急程度。
 */
import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import type { TodoQuadrant } from '@/types/todo-quadrant';

export interface TodoQuadrantIconProps {
  quadrant: TodoQuadrant;
  /** 是否选中（选择器态） */
  active?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** 象限对应高亮格索引：0 左上 1 右上 2 左下 3 右下 */
const QUADRANT_ACTIVE_INDEX: Record<TodoQuadrant, number> = {
  q1: 0,
  q2: 2,
  q3: 1,
  q4: 3,
};

const ACTIVE_CELL_CLASS: Record<TodoQuadrant, string> = {
  q1: 'todo-quadrant-cell-q1',
  q2: 'todo-quadrant-cell-q2',
  q3: 'todo-quadrant-cell-q3',
  q4: 'todo-quadrant-cell-q4',
};

const SIZE_CLASS = {
  sm: { wrap: 'w-[28rpx]', cell: 'w-[12rpx] h-[12rpx]', gap: 'gap-[3rpx]' },
  md: { wrap: 'w-[36rpx]', cell: 'w-[15rpx] h-[15rpx]', gap: 'gap-[4rpx]' },
} as const;

const TodoQuadrantIcon: React.FC<TodoQuadrantIconProps> = ({
  quadrant,
  active = false,
  size = 'sm',
  className,
}) => {
  const activeIndex = QUADRANT_ACTIVE_INDEX[quadrant];
  const activeClass = ACTIVE_CELL_CLASS[quadrant];
  const sizeToken = SIZE_CLASS[size];
  const cells = [0, 1, 2, 3];

  return (
    <View
      className={cn(
        'rounded-[6rpx] p-[3rpx]',
        sizeToken.wrap,
        active ? 'todo-quadrant-icon-active' : '',
        className,
      )}
    >
      <View className={cn('flex flex-row', sizeToken.gap)}>
        {cells.slice(0, 2).map((index) => (
          <View
            key={index}
            className={cn(
              'rounded-[3rpx]',
              sizeToken.cell,
              index === activeIndex ? activeClass : 'todo-quadrant-cell-muted',
            )}
          />
        ))}
      </View>
      <View className={cn('mt-[3rpx] flex flex-row', sizeToken.gap)}>
        {cells.slice(2, 4).map((index) => (
          <View
            key={index}
            className={cn(
              'rounded-[3rpx]',
              sizeToken.cell,
              index === activeIndex ? activeClass : 'todo-quadrant-cell-muted',
            )}
          />
        ))}
      </View>
    </View>
  );
};

export default TodoQuadrantIcon;
