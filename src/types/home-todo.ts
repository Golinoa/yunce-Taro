import type { TodoLevel } from '@/components/AccentBarCard';
import type { TodoItemCategory } from '@/utils/todo-settings';
import type { TodoQuadrant } from '@/types/todo-quadrant';

export type { TodoLevel };
export type { TodoQuadrant };

/** 待办来源 */
export type TodoSourceType = 'system' | 'custom';

/** 共享范围：private=仅本人；campus_ops=校区运营协同（续费等） */
export type TodoSharedScope = 'private' | 'campus_ops';

/** 完成记录 */
export interface TodoCompletion {
  completedAt: string;
  completedBy: string;
  completedByName: string;
  note?: string;
}

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
  /** 来源类型 */
  sourceType?: TodoSourceType;
  /** 系统推送时间 ISO */
  pushedAt?: string;
  /** 展示/历史锚定日 YYYY-MM-DD */
  displayDay?: string;
  /** 共享范围 */
  sharedScope?: TodoSharedScope;
  /** 协同待办：关联教师 id（续费提醒任课老师） */
  assigneeTeacherIds?: string[];
  /** 完成记录（共享待办全员同步） */
  completion?: TodoCompletion;
}
