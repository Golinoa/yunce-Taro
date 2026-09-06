/**
 * campus utils — 营业时间解析与开闭店判断、展示截断
 */
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  campusOpenStatusLabel,
  clampCampusDisplayName,
  clampCampusSingleLine,
  estimateCampusAddressMaxChars,
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

describe('clampCampusDisplayName / clampCampusSingleLine', () => {
  it('店名过长时截断并加省略号，为状态标签与切换门店留位', () => {
    const long = '某某教育培训机构旗舰总校区旗舰店';
    const clamped = clampCampusDisplayName(long, 'unset', 750);
    expect(clamped.endsWith('…')).toBe(true);
    expect(clamped.length).toBeLessThan(long.length);
    expect(clampCampusDisplayName('短名', 'open', 750)).toBe('短名');
  });

  it('地址按估算字数单行截断', () => {
    const max = estimateCampusAddressMaxChars(750);
    const long = '市'.repeat(max + 8);
    const clamped = clampCampusSingleLine(long, max);
    expect(clamped.endsWith('…')).toBe(true);
    expect(clamped.length).toBe(max);
  });
});
