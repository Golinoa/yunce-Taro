/**
 * 首页待办「手动已读」记录回归测试（用户口径 2026-08-23）
 * 覆盖：预警提醒进首页待办、点已读后不再出现、剩余回升清除后可重新提醒
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  markTodoRead,
  isTodoRead,
  clearTodoRead,
  rechargeAlertTodoId,
  __resetTodoReadForTest,
} from '@/utils/todo-read';

describe('首页待办「已读」记录', () => {
  beforeEach(() => __resetTodoReadForTest());

  it('学员续费提醒待办 id 稳定（同学员不重复）', () => {
    expect(rechargeAlertTodoId('stu-1')).toBe('alert-recharge-stu-1');
    expect(rechargeAlertTodoId('stu-1')).toBe('alert-recharge-stu-1');
  });

  it('未已读时待办可见；点已读后标记，不再出现', () => {
    const todoId = rechargeAlertTodoId('stu-1');
    expect(isTodoRead(todoId)).toBe(false);
    markTodoRead(todoId);
    expect(isTodoRead(todoId)).toBe(true);
  });

  it('已读记录互不影响（不同学员独立）', () => {
    markTodoRead(rechargeAlertTodoId('stu-1'));
    expect(isTodoRead(rechargeAlertTodoId('stu-2'))).toBe(false);
  });

  it('剩余回升（充值/撤销回补）清除已读 → 可重新提醒', () => {
    const todoId = rechargeAlertTodoId('stu-1');
    markTodoRead(todoId);
    expect(isTodoRead(todoId)).toBe(true);
    clearTodoRead(todoId);
    expect(isTodoRead(todoId)).toBe(false);
  });
});
