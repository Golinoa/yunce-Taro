import type { TodoLevel } from '@/components/AccentBarCard';
import type { TodoItemCategory } from '@/utils/todo-settings';
import type { TodoQuadrant } from '@/types/todo-quadrant';

export type { TodoLevel };
export type { TodoQuadrant };

/** 待办卡片角标色 */
export type TodoTagColor = 'default' | 'primary' | 'accent' | 'warning' | 'success';

/** 首页待办事项数据 */
export interface TodoItem {
  id: string;
  title: string;
  desc: string;
  url?: string;
  /** 事态等级（兼容旧逻辑） */
  level?: TodoLevel;
  /** 对应待办提醒设置开关，用于过滤展示 */
  category?: TodoItemCategory;
  /** 右侧操作文案，默认「已读」 */
  actionLabel?: string;
  /** 提醒时间 ISO，用于时间轴排序与展示 */
  remindAt?: string;
  /** 备注/描述 */
  note?: string;
  /** 四象限分类 */
  quadrant?: TodoQuadrant;
  /** @deprecated 使用 quadrant */
  tagColor?: TodoTagColor;
  /** 是否开启提醒 */
  remindEnabled?: boolean;
  /** 是否已完成（展示态） */
  completed?: boolean;
}
