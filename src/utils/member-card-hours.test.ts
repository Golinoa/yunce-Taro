import { describe, expect, it } from 'vitest';
import {
  getMemberCardPaidRemainingCount,
  getMemberCardPaidTotalCount,
  getMemberCardTotalCount,
} from './member-card-hours';

/**
 * 次数卡「总课时」统一口径（B3）。
 *
 * 此前 3 处算法互相矛盾（卡详情=卡种次数−赠课、卡编辑=卡种次数、卡包面板=卡种次数），
 * 统一为：快照优先，历史卡回落 `cardTypeCount + totalGiftCount`（口径含赠课）。
 */
describe('getMemberCardTotalCount（总课时统一口径）', () => {
  it('快照存在时优先用快照（不受卡种模板编辑影响）', () => {
    expect(
      getMemberCardTotalCount({
        cardTypeKind: 'count',
        totalCount: 60,
        cardTypeCount: 48, // 模板被改过也不影响
        totalGiftCount: 5,
      }),
    ).toBe(60);
  });

  it('历史卡（无快照）回落 cardTypeCount + totalGiftCount（含赠课）', () => {
    expect(
      getMemberCardTotalCount({
        cardTypeKind: 'count',
        totalCount: undefined,
        cardTypeCount: 48,
        totalGiftCount: 5,
      }),
    ).toBe(53);
  });

  it('totalGiftCount 缺省按 0 处理', () => {
    expect(
      getMemberCardTotalCount({
        cardTypeKind: 'count',
        totalCount: undefined,
        cardTypeCount: 48,
        totalGiftCount: undefined,
      }),
    ).toBe(48);
  });

  it('非次数卡（储值/计时等）没有「共 X 次」概念，返回 undefined', () => {
    expect(
      getMemberCardTotalCount({
        cardTypeKind: 'stored',
        totalCount: 10,
        cardTypeCount: 10,
        totalGiftCount: 0,
      }),
    ).toBeUndefined();
  });

  it('非次数卡且缺 cardTypeCount 也安全返回 undefined', () => {
    expect(
      getMemberCardTotalCount({
        cardTypeKind: 'time',
        totalCount: undefined,
        cardTypeCount: undefined,
        totalGiftCount: undefined,
      }),
    ).toBeUndefined();
  });
});

describe('getMemberCardPaidTotalCount / getMemberCardPaidRemainingCount（付费口径）', () => {
  /** 卡种 10 次 + 赠 5 次，一次没用 */
  const card = {
    cardTypeKind: 'count' as const,
    totalCount: 15,
    cardTypeCount: 10,
    totalGiftCount: 5,
    remainingCount: 15,
    remainingGiftCount: 5,
  };

  it('付费总次数不含赠送（与"共 X 次"含赠课是两个口径）', () => {
    expect(getMemberCardTotalCount(card)).toBe(15);
    expect(getMemberCardPaidTotalCount(card)).toBe(10);
  });

  it('一次没用 ⇒ 付费剩余 = 付费总次数 ⇒ 退费最多退全额', () => {
    expect(getMemberCardPaidRemainingCount(card)).toBe(10);
  });

  it('用掉 1 次赠送 + 2 次付费 ⇒ 付费剩余 8', () => {
    const used = { ...card, remainingCount: 12, remainingGiftCount: 4 };
    expect(getMemberCardPaidRemainingCount(used)).toBe(8);
  });

  it('回归护栏 1：不能拿 remainingCount（含赠课）当分子，比例必须 ≤ 1', () => {
    // 旧退费公式 = remainingCount(15) / 付费总(10) = 150% ⇒ 退费超实付
    const paidTotal = getMemberCardPaidTotalCount(card) ?? 0;
    const paidRemaining = getMemberCardPaidRemainingCount(card) ?? 0;
    expect(paidRemaining / paidTotal).toBeLessThanOrEqual(1);
    expect(15 / paidTotal).toBeGreaterThan(1); // 说明误用确实会超
  });

  it('回归护栏 2：不能用 consumedValue（金额，单位分）参与次数运算', () => {
    // 曾误写 `付费总 - consumedValue` ⇒ 10 - 50000 = 负数 ⇒ clamp 成 0 ⇒ 退费变 0
    const withValue = { ...card, consumedValue: 50000 };
    expect(getMemberCardPaidRemainingCount(withValue)).toBe(10);
  });

  it('历史卡 remainingGiftCount 缺失 ⇒ 按 0 处理并 clamp 到付费总次数（不超 100%）', () => {
    const legacy = { ...card, remainingGiftCount: undefined };
    // 总剩余 15 − 0 = 15 > 付费总 10 ⇒ clamp 到 10
    expect(getMemberCardPaidRemainingCount(legacy)).toBe(10);
  });

  it('缺 remainingCount 时安全返回 undefined（不猜）', () => {
    expect(getMemberCardPaidRemainingCount({ ...card, remainingCount: undefined })).toBeUndefined();
  });

  it('赠课为 0 时两个口径相等', () => {
    const noGift = {
      ...card,
      totalCount: 10,
      totalGiftCount: 0,
      remainingCount: 10,
      remainingGiftCount: 0,
    };
    expect(getMemberCardPaidTotalCount(noGift)).toBe(getMemberCardTotalCount(noGift));
  });

  it('非次数卡返回 undefined', () => {
    expect(getMemberCardPaidTotalCount({ ...card, cardTypeKind: 'time' })).toBeUndefined();
    expect(getMemberCardPaidRemainingCount({ ...card, cardTypeKind: 'stored' })).toBeUndefined();
  });
});
