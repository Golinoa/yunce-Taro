/**
 * Service 层 — 待办唯一出口
 *
 * 契约：docs/todo/08-todo-module-api-contract.md
 * 首页 view=home /「我的待办」view=all 必须都走本 Service。
 */
import dayjs from 'dayjs';
import type { AlertItem } from '@/components/statistics/AlertSheet';
import type { TodoItemData } from '@/types/home-ui';
import type {
  TodoCollaborationMode,
  TodoCompletion,
  TodoItem,
  TodoItemCategory,
  TodoLevel,
} from '@/types/home-todo';
import type { UserRole } from '@/types/profile';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import {
  addCustomTodo,
  completeCustomTodo,
  getCustomTodos,
  isCustomTodoId,
  mapCustomTodoToHomeItem,
  removeCustomTodo,
  reopenCustomTodo,
  sortCustomTodos,
  sortCustomTodosByMode,
  updateCustomTodo,
  updateCustomTodoQuadrant,
  type AddCustomTodoInput,
  type CustomTodoRecord,
  type UpdateCustomTodoInput,
} from '@/utils/custom-todos';
import { del, get, post, put } from '@/utils/request';
import {
  buildStudentRechargeTodoDesc,
  buildStudentRechargeTodoTitle,
  buildStudentRechargeTodoUrl,
  isStudentRechargeTodoId,
  normalizeStudentRechargeTodoDesc,
  parseStudentIdFromRechargeTodoId,
  resolveDefaultRechargeAssigneeIds,
} from '@/utils/student-recharge-todo';
import {
  clearTodoCompletion,
  getTodoCompletion,
  saveTodoCompletion,
} from '@/utils/todo-completion';
import {
  getTodoAssigneeOverride,
  saveTodoAssigneeOverride,
} from '@/utils/todo-assignee-override';
import { getTodoQuadrantOverride, saveTodoQuadrantOverride } from '@/utils/todo-quadrant-override';
import {
  clearTodoRead,
  getTodoReadAt,
  isTodoRead,
  markTodoRead,
  rechargeAlertTodoId,
} from '@/utils/todo-read';
import { filterTodosBySettings } from '@/utils/todo-settings';
import { TODO_CATEGORY_INBOX_ID } from '@/utils/todo-categories';
import { isTodoInMonth, resolveSystemTodoDisplayDay } from '@/utils/todo-timeline';
import { statisticsService } from './statistics';

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

const TODO_TYPE_URL: Partial<Record<TodoItemData['type'], string>> = {
  // 教师自查工资台账；发薪管理页仅校长（见 route-guard）
  salary: '/package-teacher/pages/monthly-flow/index?tab=salary',
  // 缺 scheduleId 时进课表今日，禁止跳课程管理（教师无权限）
  checkin: '/pages/schedule/index',
  lead: '/package-lead/pages/my-invite/index',
};

const TODO_TYPE_CATEGORY: Record<TodoItemData['type'], TodoItemCategory> = {
  checkin: 'attendanceCheckin',
  recharge: 'studentRecharge',
  salary: 'salaryRemind',
  meeting: 'meetingRemind',
  alert: 'studentRecharge',
  lead: 'leadFollowUp',
};

const TODO_TYPE_LEVEL: Record<TodoItemData['type'], TodoLevel> = {
  checkin: 'urgent',
  recharge: 'normal',
  salary: 'high',
  meeting: 'low',
  alert: 'normal',
  lead: 'normal',
};

const TODO_PRIORITY_LEVEL: Record<TodoItemData['priority'], TodoLevel> = {
  high: 'high',
  medium: 'normal',
  low: 'low',
};

const TODO_TYPE_QUADRANT: Record<TodoItemData['type'], TodoQuadrant> = {
  alert: 'q1',
  checkin: 'q1',
  salary: 'q2',
  recharge: 'q2',
  lead: 'q3',
  meeting: 'q4',
};

async function ensureMockCustomTodoSeeds(_userId: string): Promise<void> {
  // no-op：自定义待办种子仅 Mock 需要；真 API 由后端返回
}

function buildRemindAtFromTodoTime(time: string): string {
  const today = dayjs().format('YYYY-MM-DD');
  if (/^\d{1,2}:\d{2}$/.test(time)) {
    const [hourText, minuteText] = time.split(':');
    const hour = hourText.padStart(2, '0');
    const minute = minuteText.padStart(2, '0');
    return dayjs(`${today} ${hour}:${minute}:00`).toISOString();
  }
  if (time === '今天') {
    return dayjs().hour(12).minute(0).second(0).millisecond(0).toISOString();
  }
  return dayjs().add(2, 'hour').startOf('minute').toISOString();
}

function mapAlertLevelToTodoLevel(level: 'danger' | 'warning' | 'primary'): TodoLevel {
  if (level === 'danger') return 'urgent';
  if (level === 'warning') return 'high';
  return 'normal';
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

function mapTodoItem(item: TodoItemData): TodoItem {
  const desc =
    item.type === 'alert'
      ? `${item.time} 查看预警详情`
      : item.type === 'recharge'
        ? buildStudentRechargeTodoDesc(item.remainingHours)
        : item.type === 'salary'
          ? `${item.time} 查看工资记录`
          : item.type === 'checkin'
            ? `${item.time}，点击进入补点名`
            : item.type === 'lead'
              ? `${item.time} 查看线索跟进`
              : `${item.time} 查看安排`;

  const isRecharge = item.type === 'recharge';
  const studentId = isRecharge
    ? parseStudentIdFromRechargeTodoId(item.id) || item.id.replace(/^alert-recharge-/, '')
    : undefined;

  const url =
    item.type === 'checkin' && item.scheduleId
      ? `/package-course/pages/lesson-form/index?scheduleId=${encodeURIComponent(item.scheduleId)}` +
        `&classId=${encodeURIComponent(item.classId || '')}` +
        `&lessonDate=${encodeURIComponent(item.lessonDate || '')}` +
        `&hasTrialStudent=0`
      : isRecharge && studentId
        ? buildStudentRechargeTodoUrl(studentId)
        : TODO_TYPE_URL[item.type];

  return {
    id: item.id,
    title: item.title,
    desc,
    url,
    level: TODO_PRIORITY_LEVEL[item.priority] ?? TODO_TYPE_LEVEL[item.type],
    category: TODO_TYPE_CATEGORY[item.type],
    remindAt: buildRemindAtFromTodoTime(item.time),
    quadrant: TODO_TYPE_QUADRANT[item.type],
    remindEnabled: true,
    completed: item.completed,
    sourceType: 'system',
    sharedScope: isRecharge ? 'campus_ops' : 'private',
    pushedAt: buildRemindAtFromTodoTime(item.time),
    ...(isRecharge && studentId
      ? { refType: 'student', refId: studentId }
      : item.scheduleId
        ? { refType: 'schedule', refId: item.scheduleId }
        : {}),
  };
}

function getCurrentAlertQueryParams(viewType: 'operation' | 'finance') {
  const now = new Date();
  return {
    viewType,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    filterMode: 'month' as const,
  };
}

function mapAlertToTodoItem(alert: {
  id: string;
  level: 'danger' | 'warning' | 'primary';
  title: string;
  desc: string;
  count: number;
}): TodoItem {
  return {
    id: `todo-alert-${alert.id}`,
    title: alert.count > 1 ? `${alert.title} (${alert.count})` : alert.title,
    desc: alert.desc,
    url: `/package-statistics/pages/alert-detail/index?alertId=${encodeURIComponent(alert.id)}`,
    level: mapAlertLevelToTodoLevel(alert.level),
    category: 'financePackage',
    sourceType: 'system',
    sharedScope: 'private',
    refType: 'alert',
    refId: alert.id,
  };
}

function mapOperationAlertToStudentTodos(alert: {
  id: string;
  level: 'danger' | 'warning' | 'primary';
  title: string;
  desc: string;
  count: number;
  details: { name: string; info: string; refId?: string }[];
}): TodoItem[] {
  const todos: TodoItem[] = [];
  for (const detail of alert.details) {
    if (!detail.refId) continue;
    const todoId = rechargeAlertTodoId(detail.refId);
    const pushedAt = new Date().toISOString();
    todos.push({
      id: todoId,
      title: buildStudentRechargeTodoTitle(detail.name),
      desc: normalizeStudentRechargeTodoDesc(detail.info),
      url: buildStudentRechargeTodoUrl(detail.refId),
      level: detail.info.includes('已用尽') ? 'urgent' : mapAlertLevelToTodoLevel(alert.level),
      category: 'studentRecharge',
      sourceType: 'system',
      sharedScope: 'campus_ops',
      pushedAt,
      remindAt: pushedAt,
      remindEnabled: true,
      collaborationMode: 'collaborative',
      refType: 'student',
      refId: detail.refId,
    });
  }
  return todos;
}

/** 真 API 下续费待办指派人由后端返回；本地不再拼 mock 教师名单 */
async function attachMockRechargeAssignees(
  todos: TodoItem[],
  _campusId?: string,
): Promise<TodoItem[]> {
  return todos;
}

function dedupeTodosById(items: TodoItem[]): TodoItem[] {
  const seen = new Set<string>();
  const result: TodoItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
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

/**
 * 本地聚合（历史 mock 路径，已停用；保留结构便于对照 API 字段）。
 * 现网请走 getListFromApi。
 */
async function getListFromMock(params: TodoListParams): Promise<TodoItem[]> {
  void params;
  return [];
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
