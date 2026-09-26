import { describe, expect, it } from 'vitest';
import { getMemberCardTotalCount } from './member-card-hours';

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
