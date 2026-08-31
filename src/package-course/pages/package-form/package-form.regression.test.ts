/**
 * 课时充值相关：防白屏常量约定 + 分期计划纯函数回归
 *
 * 背景：Taro weapp ModuleConcatenation 下，模块级数组常量 + useState 数组解构
 * 可能撞名，把 hook/导出覆盖成字符串导致课时充值页白屏。
 * 约定：constants / 选项列表一律用 getter；hook 内用 pair[0]/pair[1] 取状态。
 */
import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import {
  DATE_PICKER_YEAR_START,
  datePickerYearIndex,
  getDatePickerDays,
  getDatePickerMonths,
  getDatePickerYears,
} from '@/components/DatePickerSheet/date-picker-utils';
import {
  buildInstallmentSchedule,
  getPeriodOptions,
} from '@/components/InstallmentPanel/installment-utils';
import {
  getFeeMethodOptions,
  getGiftOptions,
  getQuickHours,
  getTypeIconMap,
} from '@/package-course/pages/package-form/constants';

describe('package-form/constants（防白屏 getter）', () => {
  it('getter 每次返回新数组/对象，避免共享可变模块绑定', () => {
    const a = getQuickHours();
    const b = getQuickHours();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);

    const f1 = getFeeMethodOptions();
    const f2 = getFeeMethodOptions();
    expect(f1).toEqual(f2);
    expect(f1).not.toBe(f2);

    const g1 = getGiftOptions();
    const g2 = getGiftOptions();
    expect(g1).not.toBe(g2);

    const t1 = getTypeIconMap();
    const t2 = getTypeIconMap();
    expect(t1).not.toBe(t2);
    expect(t1.hour_package.label).toBe('课时包');
  });

  it('支付方式与快捷课时覆盖业务选项', () => {
    expect(getQuickHours()).toEqual([10, 16, 24, 36, 48]);
    expect(getGiftOptions()).toEqual([0, 1, 2, 4]);
    expect(getFeeMethodOptions().map((x) => x.key)).toEqual([
      'wechat',
      'alipay',
      'cash',
      'transfer',
      'other',
    ]);
  });
});

describe('InstallmentPanel 纯函数', () => {
  it('getPeriodOptions 每次新数组', () => {
    const a = getPeriodOptions();
    const b = getPeriodOptions();
    expect(a.map((x) => x.value)).toEqual(['2', '3', '6', '12']);
    expect(a).not.toBe(b);
  });

  it('buildInstallmentSchedule：金额均分且尾差落到最后一期', () => {
    const plan = buildInstallmentSchedule(100, 3);
    expect(plan).toHaveLength(3);
    expect(plan.map((p) => p.period)).toEqual([1, 2, 3]);
    const amounts = plan.map((p) => parseFloat(p.amount));
    expect(amounts[0]).toBe(33.33);
    expect(amounts[1]).toBe(33.33);
    expect(amounts[2]).toBeCloseTo(33.34, 2);
    expect(amounts.reduce((s, n) => s + n, 0)).toBeCloseTo(100, 2);
  });

  it('buildInstallmentSchedule：日期从今天起每月 +1', () => {
    const today = dayjs().startOf('day');
    const plan = buildInstallmentSchedule(50, 2);
    expect(plan[0].date).toBe(today.format('YYYY-MM-DD'));
    expect(plan[1].date).toBe(today.add(1, 'month').format('YYYY-MM-DD'));
  });

  it('buildInstallmentSchedule：金额为 0 时仍生成期数与日期', () => {
    const plan = buildInstallmentSchedule(0, 2);
    expect(plan).toHaveLength(2);
    expect(plan.every((p) => p.amount === '0')).toBe(true);
  });
});

describe('DatePickerSheet 年份列表 getter', () => {
  it('年份覆盖生日可选范围且每次新数组', () => {
    const years = getDatePickerYears();
    expect(years[0]).toBe(String(DATE_PICKER_YEAR_START));
    expect(Number(years[years.length - 1])).toBeGreaterThanOrEqual(dayjs().year());
    expect(getDatePickerYears()).not.toBe(years);
    expect(getDatePickerMonths()).toHaveLength(12);
    expect(getDatePickerDays()).toHaveLength(31);
  });

  it('datePickerYearIndex 钳制到合法下标', () => {
    const years = getDatePickerYears();
    expect(datePickerYearIndex(DATE_PICKER_YEAR_START, years)).toBe(0);
    expect(datePickerYearIndex(1800, years)).toBe(0);
    expect(datePickerYearIndex(9999, years)).toBe(years.length - 1);
  });
});
