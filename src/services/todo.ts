/**
 * Service 层 — 待办唯一出口
 *
 * 首页时间轴 / 四象限、「我的待办」必须都走本 Service，禁止各写一套聚合。
 * view=home：排除无提醒随手记；view=all：全量（含收件箱）。
 */
import dayjs from 'dayjs';
import type { AlertItem } from '@/components/statistics/AlertSheet';
import { COURSE_MANAGEMENT_CLASS_TAB_URL } from '@/data/course-category';
import { ensureMockCustomTodoSeedsForUser } from '@/data/custom-todos';
import { mockGetTodoItems } from '@/data/home';
import type { TodoItemData } from '@/data/home';
import type { TodoCompletion, TodoItem, TodoLevel } from '@/types/home-todo';
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
  updateCustomTodoQuadrant,
  type AddCustomTodoInput,
  type CustomTodoRecord,
} from '@/utils/custom-todos';
import { notWired } from '@/utils/not-wired';
import { get, put } from '@/utils/request';
import {
  buildStudentRechargeTodoDesc,
  buildStudentRechargeTodoTitle,
  normalizeStudentRechargeTodoDesc,
} from '@/utils/student-recharge-todo';
import {
  clearTodoCompletion,
  getTodoCompletion,
  saveTodoCompletion,
} from '@/utils/todo-completion';
import { getTodoQuadrantOverride, saveTodoQuadrantOverride } from '@/utils/todo-quadrant-override';
import { getTodoReadAt, isTodoRead, markTodoRead, rechargeAlertTodoId } from '@/utils/todo-read';
import { filterTodosBySettings, type TodoItemCategory } from '@/utils/todo-settings';
import { TODO_CATEGORY_INBOX_ID } from '@/utils/todo-categories';
import { isTodoInMonth, resolveSystemTodoDisplayDay } from '@/utils/todo-timeline';
import { statisticsService } from './statistics';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

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

interface BackendTeacherTodosResponse {
  expiringPackages: number;
  lowHourStudents: number;
  pendingLeaves: number;
  quadrantOverrides?: Record<string, TodoQuadrant> | null;
}

interface UpdateTodoQuadrantRequest {
  quadrant: TodoQuadrant;
}

interface UpdateTodoQuadrantResponse {
  todoId: string;
  quadrant: TodoQuadrant;
}

const TODO_TYPE_URL: Partial<Record<TodoItemData['type'], string>> = {
  recharge: '/package-course/pages/recharge-records/index',
  salary: '/package-teacher/pages/salary-payment/index',
  checkin: COURSE_MANAGEMENT_CLASS_TAB_URL,
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

function ensureMockCustomTodoSeeds(userId: string): void {
  if (!userId || !USE_MOCK) return;
  ensureMockCustomTodoSeedsForUser(userId);
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
  };
}

function mapTodoItem(item: TodoItemData): TodoItem {
  const desc =
    item.type === 'alert'
      ? `${item.time} 查看预警详情`
      : item.type === 'recharge'
        ? buildStudentRechargeTodoDesc(item.remainingHours)
        : item.type === 'salary'
          ? `${item.time} 前往薪资管理`
          : item.type === 'checkin'
            ? `${item.time}，点击进入补点名`
            : item.type === 'lead'
              ? `${item.time} 查看线索跟进`
              : `${item.time} 查看安排`;

  const url =
    item.type === 'checkin' && item.scheduleId
      ? `/package-course/pages/lesson-form/index?scheduleId=${encodeURIComponent(item.scheduleId)}` +
        `&classId=${encodeURIComponent(item.classId || '')}` +
        `&lessonDate=${encodeURIComponent(item.lessonDate || '')}` +
        `&hasTrialStudent=0`
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
    sharedScope: item.type === 'recharge' ? 'campus_ops' : 'private',
    pushedAt: buildRemindAtFromTodoTime(item.time),
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
      level: detail.info.includes('已用尽') ? 'urgent' : mapAlertLevelToTodoLevel(alert.level),
      category: 'studentRecharge',
      sourceType: 'system',
      sharedScope: 'campus_ops',
      pushedAt,
      remindAt: pushedAt,
      remindEnabled: true,
    });
  }
  return todos;
}

function mapBackendTodoItems(data: BackendTeacherTodosResponse): TodoItem[] {
  const items: TodoItem[] = [];

  if (data.pendingLeaves > 0) {
    items.push({
      id: 'todo-pending-leaves',
      title: `${data.pendingLeaves}条请假待处理`,
      desc: '请及时处理待审批请假',
      level: 'high',
      category: 'leavePending',
    });
  }

  if (data.expiringPackages > 0) {
    items.push({
      id: 'todo-expiring-packages',
      title: `${data.expiringPackages}个课包即将到期`,
      desc: '请及时跟进续费提醒',
      url: '/package-course/pages/recharge-records/index',
      level: 'high',
      category: 'financePackage',
    });
  }

  if (data.lowHourStudents > 0) {
    items.push({
      id: 'todo-low-hour-students',
      title: `${data.lowHourStudents}位学员剩余课时不足`,
      desc: '请尽快安排续费或提醒',
      url: COURSE_MANAGEMENT_CLASS_TAB_URL,
      level: 'normal',
      category: 'studentRecharge',
    });
  }

  return items;
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

  if (isCustomTodoId(todoId)) {
    completeCustomTodo(payload.userId, todoId, {
      note: payload.note,
      memberId: payload.memberId || payload.userId,
      memberName: payload.userName,
    });
    return;
  }
  if (!USE_MOCK) notWired('todo.complete');
  saveTodoCompletion(todoId, completion);
  markTodoRead(todoId);
}

/**
 * 聚合待办唯一实现：自定义 + 预警 + 系统/Mock 固定项。
 * 首页与「我的待办」仅通过 view 区分是否纳入无提醒随手记。
 */
async function getList(params: TodoListParams): Promise<TodoItem[]> {
  const { teacherId, userId, role, campusId, userName, view, month } = params;
  if (!userId) return [];

  const monthKey = month || dayjs().format('YYYY-MM');

  ensureMockCustomTodoSeeds(userId);

  const includeNoRemind = view === 'all';
  const customTodoItems = sortCustomTodos(getCustomTodos(userId))
    .filter((record) => {
      const hasRemind = record.remindEnabled !== false && Boolean(record.remindDate);
      return includeNoRemind ? true : hasRemind;
    })
    .map((record) => enrichTodoItem(mapCustomTodoToHomeItem(record, userName), userId));

  const canShared = role === 'admin' || role === 'principal' || role === 'teacher';

  const [operationAlertList, financeAlertList] = await Promise.all([
    statisticsService
      .getAlerts(getCurrentAlertQueryParams('operation'))
      .catch((): AlertItem[] => []),
    statisticsService.getAlerts(getCurrentAlertQueryParams('finance')).catch((): AlertItem[] => []),
  ]);

  const operationTodos = operationAlertList
    .flatMap(mapOperationAlertToStudentTodos)
    .filter((todo) => canShared || todo.sharedScope !== 'campus_ops');
  const financeTodos = financeAlertList
    .filter((alert) => alert.id !== 'fin-stable')
    .map(mapAlertToTodoItem)
    .map((todo) =>
      enrichTodoItem({ ...todo, sourceType: 'system', pushedAt: new Date().toISOString() }, userId),
    );
  const alertTodoItems = [...operationTodos, ...financeTodos].map((todo) =>
    enrichTodoItem(todo, userId),
  );

  if (!USE_MOCK && role === 'teacher') {
    try {
      const queryParams = new URLSearchParams();
      if (campusId) queryParams.set('campusId', campusId);
      if (view === 'all') {
        const [yearText, monthText] = monthKey.split('-');
        if (yearText) queryParams.set('year', yearText);
        if (monthText) queryParams.set('month', monthText);
      }
      const query = queryParams.toString();
      const data = await get<BackendTeacherTodosResponse>(
        `/home/teacher/todos${query ? `?${query}` : ''}`,
      );
      if (data.quadrantOverrides) {
        Object.entries(data.quadrantOverrides).forEach(([id, q]) => {
          if (q === 'q1' || q === 'q2' || q === 'q3' || q === 'q4') {
            saveTodoQuadrantOverride(userId, id, q);
          }
        });
      }
      const backendTodos = mapBackendTodoItems(data).map((todo) =>
        enrichTodoItem(
          { ...todo, sourceType: 'system', pushedAt: new Date().toISOString() },
          userId,
        ),
      );
      const apiResult = filterTodosBySettings([
        ...customTodoItems,
        ...alertTodoItems,
        ...backendTodos,
      ]);
      if (view === 'all') {
        return apiResult.filter((item) => isTodoInMonth(item, monthKey));
      }
      return apiResult;
    } catch {
      const fallback = filterTodosBySettings([...customTodoItems, ...alertTodoItems]);
      if (view === 'all') {
        return fallback.filter((item) => isTodoInMonth(item, monthKey));
      }
      return fallback;
    }
  }

  const fixedTodos = (await mockGetTodoItems(teacherId || '', campusId))
    .map(mapTodoItem)
    .map((todo) => enrichTodoItem(todo, userId));

  const result = filterTodosBySettings([...customTodoItems, ...alertTodoItems, ...fixedTodos]);
  if (view === 'all') {
    return result.filter((item) => isTodoInMonth(item, monthKey));
  }
  return result;
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
    if (!USE_MOCK) notWired('todo.add');
    const record = addCustomTodo(userId, input);
    return mapCustomTodoToHomeItem(record);
  },

  /** 仅自定义原始记录（调试/兼容，业务列表请用 getList） */
  listCustomRecords: async (userId: string): Promise<CustomTodoRecord[]> => {
    if (!userId) return [];
    ensureMockCustomTodoSeeds(userId);
    if (!USE_MOCK) notWired('todo.listCustomRecords');
    return sortCustomTodosByMode(getCustomTodos(userId), 'deadline');
  },

  /** 删除自定义待办 */
  remove: async (userId: string, todoId: string): Promise<boolean> => {
    if (!USE_MOCK) notWired('todo.remove');
    return removeCustomTodo(userId, todoId);
  },

  /** 重新打开待办 */
  reopen: async (userId: string, todoId: string): Promise<boolean> => {
    if (!userId || !todoId) return false;
    if (isCustomTodoId(todoId)) {
      if (!USE_MOCK) notWired('todo.reopen');
      return reopenCustomTodo(userId, todoId);
    }
    if (!USE_MOCK) notWired('todo.reopen');
    clearTodoCompletion(todoId);
    return true;
  },

  /** 更新四象限 */
  updateQuadrant: async (
    userId: string,
    todoId: string,
    quadrant: TodoQuadrant,
  ): Promise<boolean> => {
    if (!userId || !todoId) return false;

    if (USE_MOCK) {
      if (isCustomTodoId(todoId)) {
        if (!updateCustomTodoQuadrant(userId, todoId, quadrant)) return false;
      }
      saveTodoQuadrantOverride(userId, todoId, quadrant);
      return true;
    }

    try {
      await put<UpdateTodoQuadrantResponse>(
        `/home/teacher/todos/${encodeURIComponent(todoId)}/quadrant`,
        { quadrant } satisfies UpdateTodoQuadrantRequest,
      );
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
};
