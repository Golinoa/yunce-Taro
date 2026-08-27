/**
 * 待办领域类型（前后端契约对齐，见 docs/todo/08-todo-module-api-contract.md）
 *
 * 类型层不依赖 components / utils。
 */
import type { TodoQuadrant } from '@/types/todo-quadrant';

export type { TodoQuadrant };

/** 待办事态等级（左侧色条） */
export type TodoLevel = 'urgent' | 'high' | 'normal' | 'low';

/** 待办提醒分类（对应设置页开关；custom = 用户自建） */
export type TodoItemCategory =
  | 'attendanceCheckin'
  | 'studentRecharge'
  | 'financePackage'
  | 'leavePending'
  | 'leadFollowUp'
  | 'salaryRemind'
  | 'meetingRemind'
  | 'custom';

/** 待办来源 */
export type TodoSourceType = 'system' | 'custom';

/** 共享范围：private=仅本人；campus_ops=校区运营协同（续费等） */
export type TodoSharedScope = 'private' | 'campus_ops';

/** 协作待办完成模式 */
export type TodoCollaborationMode = 'collaborative' | 'individual';

/** 各自完成模式下成员完成记录 */
export interface TodoMemberCompletion {
  completedAt: string;
  completedByName: string;
}

/** 完成记录 */
export interface TodoCompletion {
  completedAt: string;
  completedBy: string;
  completedByName: string;
  note?: string;
}

/** @deprecated 使用 quadrant */
export type TodoTagColor = 'default' | 'primary' | 'accent' | 'warning' | 'success';

/**
 * 待办卡片 / API TodoDto（首页与「我的待办」统一）
 */
export interface TodoItem {
  id: string;
  title: string;
  desc: string;
  url?: string;
  level?: TodoLevel;
  category?: TodoItemCategory;
  actionLabel?: string;
  remindAt?: string;
  note?: string;
  quadrant?: TodoQuadrant;
  /** @deprecated 使用 quadrant */
  tagColor?: TodoTagColor;
  remindEnabled?: boolean;
  todoCategoryId?: string;
  completed?: boolean;
  sourceType?: TodoSourceType;
  pushedAt?: string;
  displayDay?: string;
  sharedScope?: TodoSharedScope;
  assigneeTeacherIds?: string[];
  collaborationMode?: TodoCollaborationMode;
  memberCompletions?: Record<string, TodoMemberCompletion>;
  completion?: TodoCompletion;
  createdAt?: string;
  /** 关联实体类型（续费 student / 未点名 schedule / 预警 alert） */
  refType?: string;
  /** 关联实体 id */
  refId?: string;
}
