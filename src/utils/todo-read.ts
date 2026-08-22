/**
 * 首页待办事项「手动已读」记录（用户口径 2026-08-23）
 *
 * 预警提醒不再用 toast，而是进入首页【待办事项】；用户手动点「已读」后该待办消失。
 * - 已读即完成提醒：同一待办不重复出现（不重复推送）
 * - 剩余课时回升（撤销消课回补 / 充值加课时）后清除已读记录 → 可重新提醒新一轮
 *
 * 存储：本地 storage（mock 阶段）；联调后迁移到后端已读/去重逻辑。
 */
import Taro from '@tarojs/taro';

const STORAGE_KEY = 'yunce-todo-read';

/** 预警待办 id 前缀（学员级：alert-recharge-{studentId}） */
export const TODO_ALERT_RECHARGE_PREFIX = 'alert-recharge-';

let _read: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (_read) return _read;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    _read = raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
  } catch {
    _read = {};
  }
  return _read;
}

function persist(): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, _read || {});
  } catch {
    // storage 不可用时仅保留内存态（mock 阶段可接受）
  }
}

/** 标记某待办为已读（手动点已读 → 不再出现） */
export function markTodoRead(todoId: string): void {
  const read = load();
  read[todoId] = new Date().toISOString();
  persist();
}

/** 某待办是否已读 */
export function isTodoRead(todoId: string): boolean {
  return !!load()[todoId];
}

/** 清除某待办已读记录（剩余回升后可重新提醒） */
export function clearTodoRead(todoId: string): void {
  const read = load();
  if (read[todoId]) {
    delete read[todoId];
    persist();
  }
}

/** 生成学员「课时续费提醒」待办 id */
export function rechargeAlertTodoId(studentId: string): string {
  return `${TODO_ALERT_RECHARGE_PREFIX}${studentId}`;
}

/** 仅测试用：重置记录 */
export function __resetTodoReadForTest(): void {
  _read = {};
}
