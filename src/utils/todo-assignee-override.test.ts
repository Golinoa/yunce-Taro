/**
 * 课时续费系统待办：参与人覆盖
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetTodoAssigneeOverridesForTest,
  getTodoAssigneeOverride,
  saveTodoAssigneeOverride,
} from './todo-assignee-override';

describe('todo-assignee-override', () => {
  beforeEach(() => {
    __resetTodoAssigneeOverridesForTest();
  });

  it('可保存并读取参与人覆盖', () => {
    saveTodoAssigneeOverride('alert-recharge-stu-027', ['teacher-001', 'teacher-002']);
    expect(getTodoAssigneeOverride('alert-recharge-stu-027')).toEqual([
      'teacher-001',
      'teacher-002',
    ]);
  });
});
