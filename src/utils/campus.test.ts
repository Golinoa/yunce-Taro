/**
 * campus utils — 营业时间解析与开闭店判断
 */
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  campusOpenStatusLabel,
  getCampusOpenStatus,
  isCampusOpen,
  parseBusinessHours,
} from './campus';

describe('parseBusinessHours', () => {
  it('解析标准格式', () => {
    expect(parseBusinessHours('09:00:00至21:00:00')).toEqual({ start: '09:00', end: '21:00' });
  });

  it('空值 / 非法格式返回 null', () => {
    expect(parseBusinessHours(undefined)).toBeNull();
    expect(parseBusinessHours(null)).toBeNull();
    expect(parseBusinessHours('')).toBeNull();
    expect(parseBusinessHours('09:00-21:00')).toBeNull();
  });
});

describe('getCampusOpenStatus / isCampusOpen', () => {
  it('未设置营业时间 → unset，不视为营业中', () => {
    expect(getCampusOpenStatus(undefined)).toBe('unset');
    expect(getCampusOpenStatus('')).toBe('unset');
    expect(isCampusOpen(undefined)).toBe(false);
    expect(campusOpenStatusLabel('unset')).toBe('未设置');
  });

  it('当前时间在区间内 → open', () => {
    const now = dayjs('2026-09-04 10:30:00');
    expect(getCampusOpenStatus('09:00:00至21:00:00', now)).toBe('open');
    expect(isCampusOpen('09:00:00至21:00:00', now)).toBe(true);
  });

  it('当前时间在区间外 → closed', () => {
    const early = dayjs('2026-09-04 08:00:00');
    const late = dayjs('2026-09-04 21:30:00');
    expect(getCampusOpenStatus('09:00:00至21:00:00', early)).toBe('closed');
    expect(getCampusOpenStatus('09:00:00至21:00:00', late)).toBe('closed');
    expect(isCampusOpen('09:00:00至21:00:00', early)).toBe(false);
  });
});
