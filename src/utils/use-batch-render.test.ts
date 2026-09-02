/**
 * useBatchRender 分批渲染纯函数测试（P-02）
 *
 * 验收口径：
 * - 500 条数据首屏仅渲染首批（默认 ≤50 条）
 * - 上拉每次追加一批直至加载完，不超界、不重复
 * - 不足一批时全部可见、hasMore 为 false
 * - 筛选/搜索后重置回首批
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BATCH_SIZE,
  advanceBatchCount,
  computeBatchView,
  resetBatchCount,
} from '@/utils/use-batch-render';

function buildList(n: number): Array<{ id: number; name: string }> {
  return Array.from({ length: n }, (_, i) => ({ id: i, name: `student-${i}` }));
}

describe('computeBatchView', () => {
  it('500 条数据：首屏仅渲染默认首批 50 条，hasMore 为 true', () => {
    const view = computeBatchView(buildList(500), DEFAULT_BATCH_SIZE);

    expect(view.visibleList).toHaveLength(50);
    expect(view.visibleList[0].id).toBe(0);
    expect(view.visibleList[49].id).toBe(49);
    expect(view.hasMore).toBe(true);
  });

  it('不足一批（20 条）：全部可见，hasMore 为 false', () => {
    const view = computeBatchView(buildList(20), DEFAULT_BATCH_SIZE);

    expect(view.visibleList).toHaveLength(20);
    expect(view.hasMore).toBe(false);
  });

  it('count 超过总长度时按 slice 语义截断，不越界', () => {
    const view = computeBatchView(buildList(10), 999);

    expect(view.visibleList).toHaveLength(10);
    expect(view.hasMore).toBe(false);
  });
});

describe('advanceBatchCount', () => {
  it('上拉逐批追加 50→100→…→500，到达末尾后不再增长', () => {
    const total = 500;
    let count = DEFAULT_BATCH_SIZE;
    const seen: number[] = [];

    while (count < total) {
      count = advanceBatchCount(count, DEFAULT_BATCH_SIZE, total);
      seen.push(count);
    }

    expect(seen).toEqual([100, 150, 200, 250, 300, 350, 400, 450, 500]);
    expect(count).toBe(500);
    // 末尾追加不再增长（不重复渲染）
    expect(advanceBatchCount(count, DEFAULT_BATCH_SIZE, total)).toBe(500);
  });

  it('剩余不足一批时追加到总长度为止', () => {
    expect(advanceBatchCount(120, 50, 130)).toBe(130);
    expect(advanceBatchCount(130, 50, 130)).toBe(130);
  });

  it('空列表：追加后仍为 0', () => {
    expect(advanceBatchCount(DEFAULT_BATCH_SIZE, DEFAULT_BATCH_SIZE, 0)).toBe(0);
  });
});

describe('resetBatchCount', () => {
  it('筛选/搜索后重置回首批', () => {
    expect(resetBatchCount(DEFAULT_BATCH_SIZE)).toBe(DEFAULT_BATCH_SIZE);
    expect(resetBatchCount(20)).toBe(20);
  });
});
