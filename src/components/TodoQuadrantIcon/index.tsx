/**
 * TodoQuadrantIcon - 四象限艾森豪威尔矩阵图标
 *
 * 使用场景：创建待办选择象限、待办时间轴卡片角标；
 * 2×2 圆角方块，四格共用同一背景渐变（深色在对应象限角，浅色在对角）。
 */
import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import type { TodoQuadrant } from '@/types/todo-quadrant';

export interface TodoQuadrantIconProps {
  quadrant: TodoQuadrant;
  size?: 'sm' | 'md';
  className?: string;
}

const CELL_INDEXES = [0, 1, 2, 3] as const;

const TodoQuadrantIcon: React.FC<TodoQuadrantIconProps> = ({
  quadrant,
  size = 'sm',
  className,
}) => (
  <View
    className={cn(
      'todo-quadrant-icon',
      `todo-quadrant-icon--${quadrant}`,
      `todo-quadrant-icon--${size}`,
      className,
    )}
  >
    {CELL_INDEXES.map((index) => (
      <View
        key={index}
        className={cn('todo-quadrant-icon__cell', `todo-quadrant-icon__cell--${index}`)}
      />
    ))}
  </View>
);

export default TodoQuadrantIcon;
