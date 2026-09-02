/**
 * 首页日期 key 单测
 */
import { describe, expect, it } from 'vitest';
import { todayDateKey } from './home-date-logic';

describe('todayDateKey', () => {
  it('按本地时区格式化为 yyyy-mm-dd', () => {
    expect(todayDateKey(new Date(2026, 8, 3, 15, 30, 0))).toBe('2026-09-03');
  });

  it('月份与日期不足两位时补零', () => {
    expect(todayDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
