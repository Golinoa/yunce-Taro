/**
 * useDelayedLoading �?延迟显示的加载状�?Hook
 *
 * 设计动机：页面骨架屏不应在每次进入时都闪一下。mock / 缓存数据通常 200ms �? * 返回，此时显示骨架屏反而干扰体验。本 Hook 仅当加载持续时间超过阈值时才将
 * loading 置为 true，让用户只在「真正慢」（网络�?/ 接口慢）时才看到占位�? *
 * 用法（与�?useState 模式 drop-in 兼容）：
 * ```ts
 * // 旧：const [loading, setLoading] = useState(true)
 * const { loading, setLoading } = useDelayedLoading()
 *
 * useEffect(() => {
 *   setLoading(true)            // 开始加载（启动延迟计时器）
 *   fetchData().finally(() => setLoading(false))  // 完成立刻清除
 * }, [])
 *
 * if (loading) return <Loading />  // 仅慢加载时才渲染骨架�? * ```
 *
 * 行为�? * - setLoading(true)  �?启动 thresholdMs 计时器；计时器到期前 loading 仍为 false
 * - setLoading(false) �?立刻清除计时器并 loading=false（即使计时器尚未到期�? * - 连续 setLoading(true) 不会重复启动计时器（�?clear �?set�? * - 组件卸载时自动清理计时器，避免内存泄�?/ setState on unmounted
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseDelayedLoadingResult {
  /** 延迟后的加载状态——仅当加载持续超过阈值才�?true，供 UI 判断是否渲染骨架�?*/
  loading: boolean;
  /** 设置加载状态：true 启动延迟计时器，false 立即关闭 */
  setLoading: (value: boolean) => void;
}

export function useDelayedLoading(thresholdMs = 500): UseDelayedLoadingResult {
  const [loading, setLoadingState] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setLoading = useCallback(
    (value: boolean) => {
      if (value) {
        // 先清除已有计时器，避免连�?true 产生多个 timer
        clearTimer();
        timerRef.current = setTimeout(() => {
          setLoadingState(true);
        }, thresholdMs);
      } else {
        // 加载完成：立刻清除计时器 + 关闭 loading
        // 即使计时器尚未到期（快加载），也不会让骨架屏闪现
        clearTimer();
        setLoadingState(false);
      }
    },
    [thresholdMs, clearTimer],
  );

  // 组件卸载时清理计时器，防�?setState on unmounted
  useEffect(() => clearTimer, [clearTimer]);

  return { loading, setLoading };
}

export default useDelayedLoading;
