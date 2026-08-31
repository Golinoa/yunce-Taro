/**
 * Service 层 — 待办唯一出口
 *
 * 契约：docs/todo/08-todo-module-api-contract.md
 * 首页 view=home /「我的待办」view=all 必须都走本 Service。
 */
import dayjs from 'dayjs';
import type { TodoCollaborationMode, TodoCompletion, TodoItem } from '@/types/home-todo';
import type { UserRole } from '@/types/profile';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import {
  completeCustomTodo,
  getCustomTodos,
  isCustomTodoId,
  removeCustomTodo,
  reopenCustomTodo,
  sortCustomTodosByMode,
  updateCustomTodo,
  updateCustomTodoQuadrant,
  type AddCustomTodoInput,
  type CustomTodoRecord,
  type UpdateCustomTodoInput,
} from '@/utils/custom-todos';
import { del, get, post, put } from '@/utils/request';
import {
  buildStudentRechargeTodoUrl,
  isStudentRechargeTodoId,
  parseStudentIdFromRechargeTodoId,
} from '@/utils/student-recharge-todo';
import { getTodoAssigneeOverride, saveTodoAssigneeOverride } from '@/utils/todo-assignee-override';
import { TODO_CATEGORY_INBOX_ID } from '@/utils/todo-categories';
import {
  clearTodoCompletion,
  getTodoCompletion,
  saveTodoCompletion,
} from '@/utils/todo-completion';
import { getTodoQuadrantOverride, saveTodoQuadrantOverride } from '@/utils/todo-quadrant-override';
import {
  clearTodoRead,
  getTodoReadAt,
  isTodoRead,
  markTodoRead,
  rechargeAlertTodoId,
} from '@/utils/todo-read';
import { filterTodosBySettings } from '@/utils/todo-settings';
import { isTodoInMonth, resolveSystemTodoDisplayDay } from '@/utils/todo-timeline';

/** 列表视图：home=首页；all=我的待办全量 */
export type TodoListView = 'home' | 'all';

/** 待办列表查询参数（首页与「我的待办」共用） */
export interface TodoListParams {
  teacherId: string;
  userId: string;
  role?: UserRole | null;
  campusId?: string;
  userName?: string;
  view: TodoListView;
  /** 月份筛选 YYYY-MM（view=all 时按月拉取，默认当月） */
  month?: string;
}

export type { AddCustomTodoInput, CustomTodoRecord };
export type TodoListItem = TodoItem;

/** 后端列表响应（契约 08） */
interface BackendTodoListResponse {
  items: TodoItem[];
  quadrantOverrides?: Record<string, TodoQuadrant> | null;
}

interface BackendTodoMutationResponse {
  ok?: boolean;
  todoId?: string;
  completion?: TodoCompletion;
  quadrant?: TodoQuadrant;
}

async function ensureMockCustomTodoSeeds(_userId: string): Promise<void> {
  // no-op：自定义待办种子仅 Mock 需要；真 API 由后端返回
}

function applyQuadrantOverrides(
  userId: string,
  overrides: Record<string, TodoQuadrant> | null | undefined,
): void {
  if (!overrides) return;
  Object.entries(overrides).forEach(([id, q]) => {
    if (q === 'q1' || q === 'q2' || q === 'q3' || q === 'q4') {
      saveTodoQuadrantOverride(userId, id, q);
    }
  });
}

function enrichTodoItem(todo: TodoItem, userId?: string): TodoItem {
  const stored = getTodoCompletion(todo.id);
  const legacyReadAt = isTodoRead(todo.id) ? getTodoReadAt(todo.id) : undefined;
  const completion: TodoCompletion | undefined =
    stored ||
    (legacyReadAt
      ? {
          completedAt: legacyReadAt,
          completedBy: 'legacy',
          completedByName: '已处理',
        }
      : todo.completion);

  const pushedAt = todo.pushedAt || todo.remindAt || new Date().toISOString();
  const displayDay =
    todo.displayDay ||
    (todo.sourceType === 'system' || (!todo.sourceType && !todo.remindAt && todo.pushedAt)
      ? resolveSystemTodoDisplayDay(pushedAt, completion?.completedAt)
      : todo.remindAt
        ? dayjs(todo.remindAt).format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD'));

  const quadrantOverride = userId ? getTodoQuadrantOverride(userId, todo.id) : null;
  const assigneeOverride = isStudentRechargeTodoId(todo.id)
    ? getTodoAssigneeOverride(todo.id)
    : null;
  const sourceType = todo.sourceType || (todo.pushedAt ? 'system' : undefined);

  return {
    ...todo,
    sourceType,
    todoCategoryId: todo.todoCategoryId || TODO_CATEGORY_INBOX_ID,
    pushedAt: sourceType === 'system' || todo.pushedAt ? pushedAt : todo.pushedAt,
    displayDay,
    completion,
    completed: Boolean(completion || todo.completed),
    ...(quadrantOverride ? { quadrant: quadrantOverride } : {}),
    ...(assigneeOverride ? { assigneeTeacherIds: assigneeOverride } : {}),
  };
}

function buildListQuery(params: TodoListParams, monthKey: string): string {
  const queryParams = new URLSearchParams();
  queryParams.set('view', params.view);
  if (params.campusId) queryParams.set('campusId', params.campusId);
  if (params.view === 'all') {
    const [yearText, monthText] = monthKey.split('-');
    if (yearText) queryParams.set('year', yearText);
    if (monthText) queryParams.set('month', monthText);
    queryParams.set('monthKey', monthKey);
  }
  return queryParams.toString();
}

async function getListFromApi(params: TodoListParams): Promise<TodoItem[]> {
  const monthKey = params.month || dayjs().format('YYYY-MM');
  const query = buildListQuery(params, monthKey);
  const data = await get<BackendTodoListResponse>(`/todos?${query}`);
  applyQuadrantOverrides(params.userId, data.quadrantOverrides);
  const items = (data.items || []).map((todo) => enrichTodoItem(todo, params.userId));
  const filtered = filterTodosBySettings(items);
  if (params.view === 'all') {
    return filtered.filter((item) => isTodoInMonth(item, monthKey));
  }
  return filtered;
}

async function getList(params: TodoListParams): Promise<TodoItem[]> {
  if (!params.userId) return [];
  return getListFromApi(params);
}

async function completeTodoItem(
  todoId: string,
  payload: { userId: string; userName: string; note?: string; memberId?: string },
): Promise<void> {
  const completion: TodoCompletion = {
    completedAt: new Date().toISOString(),
    completedBy: payload.userId,
    completedByName: payload.userName,
    note: payload.note?.trim() || undefined,
  };

  const data = await post<BackendTodoMutationResponse>(
    `/todos/${encodeURIComponent(todoId)}/complete`,
    {
      note: payload.note?.trim() || undefined,
      memberId: payload.memberId || payload.userId,
    },
  );
  if (data.completion) {
    saveTodoCompletion(todoId, data.completion);
  } else {
    saveTodoCompletion(todoId, completion);
  }
  markTodoRead(todoId);
  if (isCustomTodoId(todoId)) {
    completeCustomTodo(payload.userId, todoId, {
      note: payload.note,
      memberId: payload.memberId || payload.userId,
      memberName: payload.userName,
    });
  }
}

/**
 * 课时回升后清除续费待办完成态（read + completion），使下次列表可再提醒。
 * 页面在充值 / 撤销消课后调用。
 */
export function clearStudentRechargeTodoState(studentId: string): void {
  if (!studentId) return;
  const todoId = rechargeAlertTodoId(studentId);
  clearTodoRead(todoId);
  clearTodoCompletion(todoId);
}

export const todoService = {
  /**
   * 待办列表（唯一入口）
   * - view=home → 首页
   * - view=all → 我的待办
   */
  getList,

  /** 添加自定义待办 */
  add: async (userId: string, input: AddCustomTodoInput): Promise<TodoItem> => {
    const created = await post<TodoItem>('/todos', {
      title: input.title,
      note: input.note,
      remindEnabled: input.remindEnabled,
      remindDate: input.remindDate,
      remindTime: input.remindTime,
      quadrant: input.quadrant,
      todoCategoryId: input.categoryId,
      collaboratorIds: input.collaboratorIds,
      collaborationMode: input.collaborationMode,
    });
    return enrichTodoItem(created, userId);
  },

  /** 仅自定义原始记录（调试/兼容，业务列表请用 getList） */
  listCustomRecords: async (userId: string): Promise<CustomTodoRecord[]> => {
    if (!userId) return [];
    await ensureMockCustomTodoSeeds(userId);
    // 真模式：自定义记录已含在 GET /todos；本方法仅 Mock/调试保留本地副本
    return sortCustomTodosByMode(getCustomTodos(userId), 'deadline');
  },

  /** 删除自定义待办 */
  remove: async (userId: string, todoId: string): Promise<boolean> => {
    await del<BackendTodoMutationResponse>(`/todos/${encodeURIComponent(todoId)}`);
    removeCustomTodo(userId, todoId);
    return true;
  },

  /** 更新待办：自定义全量；续费系统待办仅参与人（+四象限） */
  update: async (
    userId: string,
    todoId: string,
    input: UpdateCustomTodoInput,
  ): Promise<TodoItem | null> => {
    if (!userId || !todoId) return null;

    if (isStudentRechargeTodoId(todoId)) {
      if (input.collaboratorIds !== undefined) {
        saveTodoAssigneeOverride(todoId, input.collaboratorIds || []);
      }
      if (input.quadrant) {
        saveTodoQuadrantOverride(userId, todoId, input.quadrant);
      }

      try {
        await put<TodoItem>(`/todos/${encodeURIComponent(todoId)}`, {
          collaboratorIds: input.collaboratorIds,
          collaborationMode: input.collaborationMode,
          quadrant: input.quadrant,
        });
      } catch {
        // 后端暂未支持系统待办编辑时，保留本地覆盖
      }
      const studentId = parseStudentIdFromRechargeTodoId(todoId) || '';
      const assignees =
        input.collaboratorIds !== undefined
          ? input.collaboratorIds
          : getTodoAssigneeOverride(todoId) || [];
      return enrichTodoItem(
        {
          id: todoId,
          title: input.title || '课时续费提醒',
          desc: input.note || '',
          url: studentId ? buildStudentRechargeTodoUrl(studentId) : undefined,
          category: 'studentRecharge',
          sourceType: 'system',
          sharedScope: 'campus_ops',
          assigneeTeacherIds: assignees,
          collaborationMode:
            (input.collaborationMode as TodoCollaborationMode | undefined) ||
            (assignees.length > 0 ? 'collaborative' : undefined),
          quadrant: input.quadrant,
          remindEnabled: true,
          refType: 'student',
          refId: studentId || undefined,
        },
        userId,
      );
    }

    if (!isCustomTodoId(todoId)) return null;
    const updated = await put<TodoItem>(`/todos/${encodeURIComponent(todoId)}`, {
      title: input.title,
      note: input.note,
      remindEnabled: input.remindEnabled,
      remindDate: input.remindDate,
      remindTime: input.remindTime,
      quadrant: input.quadrant,
      todoCategoryId: input.categoryId,
      collaboratorIds: input.collaboratorIds,
      collaborationMode: input.collaborationMode,
    });
    updateCustomTodo(userId, todoId, input);
    return enrichTodoItem(updated, userId);
  },

  /** 重新打开待办 */
  reopen: async (userId: string, todoId: string): Promise<boolean> => {
    if (!userId || !todoId) return false;
    await post<BackendTodoMutationResponse>(`/todos/${encodeURIComponent(todoId)}/reopen`);
    if (isCustomTodoId(todoId)) {
      reopenCustomTodo(userId, todoId);
    }
    clearTodoCompletion(todoId);
    clearTodoRead(todoId);
    return true;
  },

  /** 更新四象限 */
  updateQuadrant: async (
    userId: string,
    todoId: string,
    quadrant: TodoQuadrant,
  ): Promise<boolean> => {
    if (!userId || !todoId) return false;

    try {
      await put<BackendTodoMutationResponse>(`/todos/${encodeURIComponent(todoId)}/quadrant`, {
        quadrant,
      });
    } catch {
      return false;
    }

    if (isCustomTodoId(todoId)) {
      updateCustomTodoQuadrant(userId, todoId, quadrant);
    }
    saveTodoQuadrantOverride(userId, todoId, quadrant);
    return true;
  },

  /** 完成待办 */
  complete: completeTodoItem,

  /** 课时回升：清除学员续费待办完成态 */
  clearStudentRechargeState: clearStudentRechargeTodoState,
};
