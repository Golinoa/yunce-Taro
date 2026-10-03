/**
 * usePagePullRefresh - 页面级下拉刷新统一封装
 *
 * 解决的问题：每页自己写 `usePullDownRefresh` 时，**指示器收起用错方式**，
 * 导致 UI 上「拉了没反应」或「一直转」——
 * - 页面级（`index.config.ts` 的 `enablePullDownRefresh: true`）：
 *   指示器由系统接管，**必须**显式 `Taro.stopPullDownRefresh()` 才收起，
 *   且要放在 `finally`，否则请求抛错就永远转；
 * - ScrollView 级（页面 `disableScroll: true`，如首页）：
 *   指示器由 `refresherTriggered` 受控，不需要 `stopPullDownRefresh`。
 *
 * 本 hook 只管**页面级**这一种（小程序绝大多数页面都是这种）；
 * 需要 ScrollView refresher 的页面直接用 `usePullToRefresh`。
 *
 * 用法：
 * ```tsx
 * const { refreshing, runPullRefresh } = usePagePullRefresh();
 * usePullDownRefresh(() => { void runPullRefresh(refreshAll); });
 * ```
 * 或直接一行（等价）：
 * ```tsx
 * usePagePullRefresh(refreshAll);
 * ```
 */
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { useCallback, useRef, useState } from 'react';
import { logError } from '@/utils/logger';

/** 下拉刷新任务：可同步可异步，抛错会被吞掉并记日志（不让页面因刷新失败而崩） */
export type PullRefreshTask = () => Promise<unknown> | unknown;

/**
 * 页面级下拉刷新。
 *
 * @param task 刷新任务。不传则返回的 `runPullRefresh` 需由调用方自行绑定。
 * @returns `refreshing`（刷新中，供 UI 用）+ `runPullRefresh`（手动触发，供刷新按钮复用）
 */
export function usePagePullRefresh(task?: PullRefreshTask) {
  const [refreshing, setRefreshing] = useState(false);
  /** 任务放 ref：调用方传的内联函数每次渲染都是新引用，不该让 usePullDownRefresh 反复重订阅 */
  const taskRef = useRef<PullRefreshTask | undefined>(task);
  taskRef.current = task;
  /** 重入保护：刷新中再拉一次直接忽略，避免请求叠加 */
  const runningRef = useRef(false);

  const runPullRefresh = useCallback(async (override?: PullRefreshTask) => {
    // 重入保护：一次刷新没结束时不叠加请求
    if (runningRef.current) return;
    const fn = override ?? taskRef.current;
    if (!fn) return;

    runningRef.current = true;
    setRefreshing(true);
    try {
      await fn();
    } catch (err) {
      // 刷新失败只记日志：不弹 toast 打断用户，且**绝不能**让异常冒到
      // usePullDownRefresh 回调外（那会导致指示器收不起来）
      logError('usePagePullRefresh', err);
    } finally {
      runningRef.current = false;
      setRefreshing(false);
      // 页面级指示器必须显式收起，否则一直转（成功/失败/抛错都要收）
      try {
        Taro.stopPullDownRefresh();
      } catch (err) {
        logError('usePagePullRefresh stopPullDownRefresh', err);
      }
    }
  }, []);

  usePullDownRefresh(() => {
    void runPullRefresh();
  });

  return { refreshing, runPullRefresh };
}

/**
 * usePullToRefresh - ScrollView refresher 场景的下拉刷新状态管理
 *
 * 页面 `disableScroll: true` 时页面级 `enablePullDownRefresh` 不生效，
 * 只能给内层 ScrollView 挂 `refresherEnabled` / `refresherTriggered` /
 * `onRefresherRefresh`（首页就是这个套路）。
 *
 * 返回的 `scrollViewProps` 直接展开到 ScrollView 上即可。
 *
 * 用法：
 * ```tsx
 * const { scrollViewProps } = usePullToRefresh(loadHome);
 * <ScrollView {...scrollViewProps} scrollY>...</ScrollView>
 * ```
 */
export function usePullToRefresh(task: PullRefreshTask) {
  const [refreshing, setRefreshing] = useState(false);
  const runningRef = useRef(false);
  const taskRef = useRef<PullRefreshTask>(task);
  taskRef.current = task;

  const handleRefresh = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRefreshing(true);
    try {
      await taskRef.current();
    } catch (err) {
      logError('usePullToRefresh', err);
    } finally {
      // refresherTriggered 复位即收起指示器
      runningRef.current = false;
      setRefreshing(false);
    }
  }, []);

  return {
    refreshing,
    /** 展开到 ScrollView 上的下拉刷新三件套 */
    scrollViewProps: {
      refresherEnabled: true,
      refresherTriggered: refreshing,
      onRefresherRefresh: handleRefresh,
    } as const,
    handleRefresh,
  };
}
