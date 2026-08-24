import { describe, expect, it } from 'vitest';
import {
  buildStudentRechargeTodoDesc,
  buildStudentRechargeTodoTitle,
  normalizeStudentRechargeTodoDesc,
} from './student-recharge-todo';

describe('student-recharge-todo', () => {
  it('统一标题格式', () => {
    expect(buildStudentRechargeTodoTitle('小明')).toBe('「小明」课时续费提醒');
  });

  it('统一描述格式', () => {
    expect(buildStudentRechargeTodoDesc(3)).toBe('剩余 3 课时 · 请尽快跟进续费');
    expect(buildStudentRechargeTodoDesc(0, { exhausted: true })).toBe(
      '课时已用尽 · 请尽快跟进续费',
    );
  });

  it('从预警 info 归一化描述', () => {
    expect(normalizeStudentRechargeTodoDesc('剩余 2 课时')).toBe(
      '剩余 2 课时 · 请尽快跟进续费',
    );
    expect(normalizeStudentRechargeTodoDesc('课时已用尽')).toBe(
      '课时已用尽 · 请尽快跟进续费',
    );
  });
});
