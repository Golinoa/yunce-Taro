import { describe, expect, it } from 'vitest';
import {
  currentDateKey,
  currentMonthKey,
  formatPeriodDateText,
  normalizeAnchorValue,
  parseDateKey,
} from '@/utils/format';

describe('currentMonthKey / currentDateKey（data-center 锚点口径）', () => {
  it('月份补零为两位', () => {
    expect(currentMonthKey(new Date(2026, 8, 29))).toBe('2026-09');
    expect(currentMonthKey(new Date(2026, 11, 1))).toBe('2026-12');
  });

  it('日期键为 YYYY-MM-DD 且满足后端正则', () => {
    const key = currentDateKey(new Date(2026, 0, 5));
    expect(key).toBe('2026-01-05');
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('parseDateKey / normalizeAnchorValue（Picker 往返）', () => {
  it('解析合法日期键，非法或缺失回落今天', () => {
    expect(parseDateKey('2026-03-15').getDate()).toBe(15);
    expect(parseDateKey('2026-3-15').getDate()).toBe(new Date().getDate());
    expect(parseDateKey(undefined).getDate()).toBe(new Date().getDate());
    expect(parseDateKey('').getDate()).toBe(new Date().getDate());
  });

  it('把 Picker 的返回值按粒度补全为完整锚点', () => {
    // fields=year → "2026"
    expect(normalizeAnchorValue('2026')).toBe('2026-01-01');
    // fields=month → "2026-09"
    expect(normalizeAnchorValue('2026-09')).toBe('2026-09-01');
    // fields=day → "2026-09-29"
    expect(normalizeAnchorValue('2026-09-29')).toBe('2026-09-29');
    // 非预期输入回落今天
    expect(normalizeAnchorValue('')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatPeriodDateText（日历文案，进入页面默认当月，随锚点变化）', () => {
  const today = new Date(2026, 8, 29);

  it('月：显示当月，不补零', () => {
    expect(formatPeriodDateText('month', today)).toBe('2026年9月');
  });

  it('年：显示当年', () => {
    expect(formatPeriodDateText('year', today)).toBe('2026年');
  });

  it('日：显示完整日期', () => {
    expect(formatPeriodDateText('day', today)).toBe('2026年9月29日');
  });

  it('文案跟随锚点（选中 2025-03 即显示 2025年3月）', () => {
    const anchor = parseDateKey('2025-03-08');
    expect(formatPeriodDateText('month', anchor)).toBe('2025年3月');
    expect(formatPeriodDateText('year', anchor)).toBe('2025年');
    expect(formatPeriodDateText('day', anchor)).toBe('2025年3月8日');
  });
});
