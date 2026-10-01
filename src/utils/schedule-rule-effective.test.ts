import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { isScheduleRuleEffectiveOnDate } from '@/utils/schedule-rule-effective';

const STOPPED_AT = '2026-10-01T09:30:00.000Z';

describe('isScheduleRuleEffectiveOnDate（删除/停止规则的日期收窄）', () => {
  it('ACTIVE 规则在任何日期都成立', () => {
    const rule = { rule_status: 'ACTIVE' as const, stopped_at: undefined };
    expect(isScheduleRuleEffectiveOnDate(rule, dayjs('2020-01-01'))).toBe(true);
    expect(isScheduleRuleEffectiveOnDate(rule, dayjs('2030-01-01'))).toBe(true);
  });

  it('STOPPED 规则：停止日及更早照旧成立（历史课表要能回看）', () => {
    const rule = { rule_status: 'STOPPED' as const, stopped_at: STOPPED_AT };
    expect(isScheduleRuleEffectiveOnDate(rule, dayjs('2026-09-24'))).toBe(true);
    // 按「天」比较：停止那一刻的当天仍算出课（与后端 d <= stoppedAt 一致）
    expect(isScheduleRuleEffectiveOnDate(rule, dayjs('2026-10-01'))).toBe(true);
  });

  it('STOPPED 规则：停止日之后不再成立（以后不该再有课）', () => {
    const rule = { rule_status: 'STOPPED' as const, stopped_at: STOPPED_AT };
    expect(isScheduleRuleEffectiveOnDate(rule, dayjs('2026-10-02'))).toBe(false);
    expect(isScheduleRuleEffectiveOnDate(rule, dayjs('2027-01-01'))).toBe(false);
  });

  it('缺 stopped_at 不拦（老数据宁可多显示，不能吞掉历史）', () => {
    expect(isScheduleRuleEffectiveOnDate({ rule_status: 'STOPPED' }, dayjs('2030-01-01'))).toBe(
      true,
    );
  });

  it('PAUSED 不在本函数管辖内（口径另议，保持原样）', () => {
    expect(isScheduleRuleEffectiveOnDate({ rule_status: 'PAUSED' }, dayjs('2030-01-01'))).toBe(
      true,
    );
  });

  it('接受 YYYY-MM-DD 字符串日期（跨模块复用）', () => {
    const rule = { rule_status: 'STOPPED' as const, stopped_at: STOPPED_AT };
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-09-30')).toBe(true);
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-10-05')).toBe(false);
  });
});

/**
 * 规则有效期（`start_date` / `end_date`）——与后端 `dateRangeFilter` 同口径：
 * `startDate ≤ 日期 ≤ endDate`，空缺 = 不设限。
 */
describe('isScheduleRuleEffectiveOnDate（规则有效期）', () => {
  it('开始日期之前不出课（排课表单默认开始日期=今天）', () => {
    const rule = { rule_status: 'ACTIVE' as const, start_date: '2026-11-01' };
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-10-01')).toBe(false);
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-11-01')).toBe(true);
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-11-08')).toBe(true);
  });

  it('结束日期之后不出课', () => {
    const rule = { rule_status: 'ACTIVE' as const, end_date: '2026-10-31' };
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-10-24')).toBe(true);
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-10-31')).toBe(true);
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-11-07')).toBe(false);
  });

  it('两端都有：区间内才出课', () => {
    const rule = {
      rule_status: 'ACTIVE' as const,
      start_date: '2026-10-05',
      end_date: '2026-10-26',
    };
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-10-04')).toBe(false);
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-10-05')).toBe(true);
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-10-26')).toBe(true);
    expect(isScheduleRuleEffectiveOnDate(rule, '2026-10-27')).toBe(false);
  });

  it('空缺 = 不设限（老规则没有有效期字段）', () => {
    const rule = { rule_status: 'ACTIVE' as const };
    expect(isScheduleRuleEffectiveOnDate(rule, '2020-01-01')).toBe(true);
    expect(isScheduleRuleEffectiveOnDate(rule, '2030-01-01')).toBe(true);
  });

  it('「删了再重建」：老规则只在停止前出课、新规则只在开始日之后出课 ⇒ 历史不重复', () => {
    const stoppedOld = {
      rule_status: 'STOPPED' as const,
      stopped_at: '2026-10-01T09:30:00.000Z',
    };
    const newRule = { rule_status: 'ACTIVE' as const, start_date: '2026-10-01' };
    const historyDay = '2026-09-24';

    expect(isScheduleRuleEffectiveOnDate(stoppedOld, historyDay)).toBe(true);
    expect(isScheduleRuleEffectiveOnDate(newRule, historyDay)).toBe(false);
  });
});
