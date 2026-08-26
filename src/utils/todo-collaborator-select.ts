import Taro from '@tarojs/taro';
import type { TeacherIdentity } from '@/types/teacher';
import { logError } from '@/utils/logger';

const INPUT_STORAGE_KEY = 'yunce:todo-collaborator:input';
const RESULT_STORAGE_KEY = 'yunce:todo-collaborator:result';
const META_STORAGE_KEY = 'yunce:todo-collaborator:meta';

const PAGE_PATH = '/package-settings/pages/todo-collaborator/index';

export interface CollaboratorSummary {
  id: string;
  name: string;
  avatar?: string;
  subject?: string;
  identity?: TeacherIdentity;
  roleText?: string;
}

export interface TodoCollaboratorPayload {
  ids: string[];
  summaries: CollaboratorSummary[];
}

function readRouterParams(): Record<string, string | undefined> {
  const router = Taro.getCurrentInstance().router;
  return (router?.params as Record<string, string | undefined>) ?? {};
}

/** 打开选择页前写入当前已选 id + 摘要（供子页首帧展示） */
export function prepareTodoCollaboratorInput(
  ids: string[],
  summaries?: CollaboratorSummary[],
): void {
  try {
    Taro.setStorageSync(INPUT_STORAGE_KEY, JSON.stringify(ids));
    const normalized = normalizeSummariesForIds(ids, summaries);
    if (normalized.length > 0) {
      Taro.setStorageSync(META_STORAGE_KEY, JSON.stringify(normalized));
    } else {
      Taro.removeStorageSync(META_STORAGE_KEY);
    }
  } catch {
    // 忽略写入失败
  }
}

/** 选择页读取初始已选 */
export function readTodoCollaboratorInput(): string[] {
  try {
    const raw = Taro.getStorageSync(INPUT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readTodoCollaboratorMeta(): CollaboratorSummary[] {
  try {
    const raw = Taro.getStorageSync(META_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CollaboratorSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeSummariesForIds(
  ids: string[],
  summaries?: CollaboratorSummary[],
): CollaboratorSummary[] {
  if (ids.length === 0) return [];

  const summaryMap = new Map<string, CollaboratorSummary>();
  summaries?.forEach((item) => summaryMap.set(item.id, item));
  readTodoCollaboratorMeta().forEach((item) => {
    if (!summaryMap.has(item.id)) summaryMap.set(item.id, item);
  });

  return ids.map((id) => summaryMap.get(id) ?? { id, name: '员工' });
}

/** 选择页确认后写入结果（id + 摘要一并回传父页） */
export function commitTodoCollaboratorResult(
  ids: string[],
  summaries?: CollaboratorSummary[],
): void {
  try {
    const payload: TodoCollaboratorPayload = {
      ids,
      summaries: normalizeSummariesForIds(ids, summaries),
    };
    Taro.setStorageSync(RESULT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 忽略写入失败
  }
}

/** 上一页 onShow 消费结果（读后即删） */
export function consumeTodoCollaboratorResult(): TodoCollaboratorPayload | null {
  try {
    const raw = Taro.getStorageSync(RESULT_STORAGE_KEY);
    if (!raw) return null;
    Taro.removeStorageSync(RESULT_STORAGE_KEY);

    const parsed = JSON.parse(raw) as TodoCollaboratorPayload | string[];
    if (Array.isArray(parsed)) {
      return { ids: parsed, summaries: normalizeSummariesForIds(parsed) };
    }

    if (parsed && Array.isArray(parsed.ids)) {
      return {
        ids: parsed.ids,
        summaries: normalizeSummariesForIds(parsed.ids, parsed.summaries),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearTodoCollaboratorResult(): void {
  try {
    Taro.removeStorageSync(RESULT_STORAGE_KEY);
  } catch {
    // 忽略清理失败
  }
}

/** 从路由 query 解析参与人 id */
export function parseCollaboratorIdsFromQuery(raw?: string): string[] {
  if (!raw) return [];
  try {
    const decoded = decodeURIComponent(String(raw));
    if (!decoded) return [];
    return decoded
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildIdsQuery(ids: string[]): string {
  return encodeURIComponent(ids.join(','));
}

/** 子页统一解析初始已选 id（router 实时参数优先） */
export function resolveInitialCollaboratorIds(queryIds?: string): string[] {
  const routerIds = parseCollaboratorIdsFromQuery(readRouterParams().ids);
  if (routerIds.length > 0) return routerIds;

  const fromQuery = parseCollaboratorIdsFromQuery(queryIds);
  if (fromQuery.length > 0) return fromQuery;

  return readTodoCollaboratorInput();
}

export function resolveInitialCollaboratorMode(queryMode?: string): 'add' | 'view' {
  const routerMode = readRouterParams().mode;
  if (routerMode === 'view' || queryMode === 'view') return 'view';
  return 'add';
}

function navigateCollaboratorPage(
  mode: 'add' | 'view',
  ids: string[],
  summaries?: CollaboratorSummary[],
): void {
  const normalizedSummaries = normalizeSummariesForIds(ids, summaries);
  prepareTodoCollaboratorInput(ids, normalizedSummaries);
  clearTodoCollaboratorResult();
  const idsQuery = ids.length > 0 ? `&ids=${buildIdsQuery(ids)}` : '';
  const url = `${PAGE_PATH}?mode=${mode}${idsQuery}`;
  void Taro.navigateTo({
    url,
    fail: (error) => {
      logError('open todo collaborator page failed', error);
      Taro.showToast({ title: '无法打开参与人页', icon: 'none' });
    },
  });
}

export function openTodoCollaboratorAddPage(
  ids: string[],
  summaries?: CollaboratorSummary[],
): void {
  navigateCollaboratorPage('add', ids, summaries);
}

export function openTodoCollaboratorViewPage(
  ids: string[],
  summaries?: CollaboratorSummary[],
): void {
  navigateCollaboratorPage('view', ids, summaries);
}

export function buildCollaboratorSummaries(
  ids: string[],
  teachers: {
    id: string;
    name: string;
    avatar?: string;
    subject?: string;
    identity?: TeacherIdentity;
    roleText?: string;
  }[],
): CollaboratorSummary[] {
  const map = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  return ids
    .map((id) => map.get(id))
    .filter(Boolean)
    .map((teacher) => ({
      id: teacher!.id,
      name: teacher!.name,
      avatar: teacher!.avatar,
      subject: teacher!.subject,
      identity: teacher!.identity,
      roleText: teacher!.roleText,
    }));
}

export function mergeCollaboratorSummaries(
  ids: string[],
  summaries: CollaboratorSummary[],
  teachers: {
    id: string;
    name: string;
    avatar?: string;
    subject?: string;
    identity?: TeacherIdentity;
    roleText?: string;
  }[],
): CollaboratorSummary[] {
  const fromTeachers = buildCollaboratorSummaries(ids, teachers);
  const teacherMap = new Map(fromTeachers.map((item) => [item.id, item]));
  const summaryMap = new Map(summaries.map((item) => [item.id, item]));
  return ids.map((id) => teacherMap.get(id) ?? summaryMap.get(id) ?? { id, name: '员工' });
}
