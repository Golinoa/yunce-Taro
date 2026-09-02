/**
 * 长列表分批渲染（P-02）
 *
 * 背景：students / card-member-list / recharge-records 等列表全量 map 渲染，
 * 无任何分批或虚拟化机制，数据量大时首屏渲染节点过多、交互卡顿。
 *
 * 本模块提供：
 * - 纯函数（computeBatchView / advanceBatchCount / resetBatchCount）：
 *   分批状态转换逻辑，node 环境可直接单测（回归防护）；
 * - useBatchRender hook：薄壳，把纯函数接到 React state 上。
 *
 * 用法：
 *   const { visibleList, hasMore, onScrollToLower, reset } = useBatchRender(filteredList);
 *   <ScrollView scrollY onScrollToLower={onScrollToLower}>
 *     {visibleList.map(...)}
 *     {hasMore && <View>上拉加载更多…</View>}
 *   </ScrollView>
 *   筛选条件变化时调用 reset() 回到首批。
 */
import { useCallback, useState } from 'react';

/** 默认每批渲染条数 */
export const DEFAULT_BATCH_SIZE = 50;

/** 当前批次可见视图 */
export interface BatchRenderView<T> {
  /** 本批可见列表（前 count 条） */
  visibleList: T[];
  /** 是否还有更多（count < list.length） */
  hasMore: boolean;
}

/** 计算当前批次可见列表（纯函数） */
export function computeBatchView<T>(list: T[], count: number): BatchRenderView<T> {
  return {
    visibleList: list.slice(0, count),
    hasMore: count < list.length,
  };
}

/** 上拉追加一批（纯函数）：不超过总长度 */
export function advanceBatchCount(count: number, batchSize: number, total: number): number {
  return Math.min(count + batchSize, total);
}

/** 筛选/搜索变化后重置回首批（纯函数） */
export function resetBatchCount(batchSize: number): number {
  return batchSize;
}

export interface BatchRenderResult<T> {
  /** 本批可见列表 */
  visibleList: T[];
  /** 是否还有更多 */
  hasMore: boolean;
  /** 滚动到底部时追加一批（ScrollView onScrollToLower） */
  onScrollToLower: () => void;
  /** 筛选/搜索条件变化时重置回首批 */
  reset: () => void;
}

export function useBatchRender<T>(
  list: T[],
  batchSize: number = DEFAULT_BATCH_SIZE,
): BatchRenderResult<T> {
  const [count, setCount] = useState(batchSize);

  const onScrollToLower = useCallback(() => {
    setCount((c) => advanceBatchCount(c, batchSize, list.length));
  }, [batchSize, list.length]);

  const reset = useCallback(() => {
    setCount(resetBatchCount(batchSize));
  }, [batchSize]);

  const { visibleList, hasMore } = computeBatchView(list, count);

  return { visibleList, hasMore, onScrollToLower, reset };
}
