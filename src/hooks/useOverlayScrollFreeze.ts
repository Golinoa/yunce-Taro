/**
 * useOverlayScrollFreeze �?蒙层弹窗期间冻结 ScrollView 位置
 *
 * ## 根因（务必读完）
 * 1. 微信 `scroll-into-view` 只要仍绑在节点上（含 `""`），任意 setData 都可能回�?�?idle 必须解绑（见 scrollIntoViewProps）�?
 * 2. 打开蒙层时的 setState 仍可能让未受�?ScrollView 丢位�?�?打开前用当前 scrollTop **钉住**�?
 * 3. 关闭时用 `top �?top+0.01 �?null` �?*主动驱动滚动�?* �?禁止�?
 * 4. **pin 释放时直接移�?`scrollTop` prop 同样会驱动滚动条**：Taro 模板恒渲�?`scroll-top="{{p32}}"`�?
 *    `removeAttribute` 会把值置�?`''`，微信把 `''` �?0 �?整页回顶。因�?*首次 pin �?scrollTop 粘性保�?*
 *    （`scroll-top` 是一次性命令，不是受控约束，保留旧值不会卡住后续滚动）�?
 * 5. 仅靠 onScroll 缓存不可靠（漏事件时 ref=0 �?一点击就钉回顶部）�?freeze 必须�?`scrollOffset` 读真实位置，再在回调里开层�?
 * 6. FAB 展开可复�?freeze；与固定蒙层共用同一 pin，勿另起一套�?
 *
 * ## 用法
 * ```tsx
 * const { onScroll, freeze, unfreeze, freezeProps } = useOverlayScrollFreeze('#home-scroll-view');
 * <ScrollView id="home-scroll-view" scrollY onScroll={onScroll} {...freezeProps} {...scrollIntoViewProps(id)} />
 * // 开弹层：freeze(() => setVisible(true));  // 测完位置再开，禁止先开后钉
 * // 关弹层：setVisible(false); unfreeze();   // pin 粘性保持，解除不触发回�?
 * ```
 */
import Taro from '@tarojs/taro';
import { useCallback, useEffect, useRef, useState } from 'react';

const UNFREEZE_DELAY_MS = 120;

export function useOverlayScrollFreeze(scrollViewSelector?: string) {
  const scrollTopRef = useRef(0);
  /** 仅用于触发重渲染，使 freezeProps 带上 sticky scrollTop */
  const [, setPin] = useState<number | null>(null);
  const releaseTimerRef = useRef(0);
  /** 首次 pin 后粘性保持的值：解除时不移除 scrollTop，避�?WXML scroll-top="" 触发回顶 */
  const lastPinRef = useRef<number | null>(null);

  const measureScrollTop = useCallback((): Promise<number | null> => {
    if (!scrollViewSelector) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      Taro.createSelectorQuery()
        .select(scrollViewSelector)
        .scrollOffset()
        .exec((res) => {
          const measured =
            typeof res?.[0]?.scrollTop === 'number' ? (res[0].scrollTop as number) : null;
          resolve(measured);
        });
    });
  }, [scrollViewSelector]);

  const onScroll = useCallback((event: { detail: { scrollTop: number } }) => {
    scrollTopRef.current = event.detail.scrollTop;
  }, []);

  const clearReleaseTimer = useCallback(() => {
    if (releaseTimerRef.current) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = 0;
    }
  }, []);

  /**
   * 钉住当前位置。有 selector 时先 scrollOffset 实测，再执行 afterFreeze（开层必须放这里）�?
   * 禁止：先 setVisible(true) �?freeze——会在未钉住窗口丢位置�?
   */
  const freeze = useCallback(
    (afterFreeze?: () => void) => {
      clearReleaseTimer();

      const apply = (top: number) => {
        const next = Number.isFinite(top) ? Math.max(0, top) : 0;
        scrollTopRef.current = next;
        lastPinRef.current = next;
        setPin(next);
        afterFreeze?.();
      };

      if (!scrollViewSelector) {
        apply(scrollTopRef.current);
        return;
      }

      void measureScrollTop().then((measured) => {
        if (measured == null) {
          apply(scrollTopRef.current);
          return;
        }
        apply(measured);
      });
    },
    [clearReleaseTimer, measureScrollTop, scrollViewSelector],
  );

  /** 关层后延迟解开；不解绑期间保持同一 scrollTop，禁�?+0.01 微调 */
  const unfreeze = useCallback(() => {
    clearReleaseTimer();
    releaseTimerRef.current = window.setTimeout(() => {
      setPin(null);
      releaseTimerRef.current = 0;
    }, UNFREEZE_DELAY_MS);
  }, [clearReleaseTimer]);

  /** 立即解开（FAB 收起等已验证场景�?*/
  const unfreezeNow = useCallback(() => {
    clearReleaseTimer();
    setPin(null);
  }, [clearReleaseTimer]);

  useEffect(
    () => () => {
      clearReleaseTimer();
    },
    [clearReleaseTimer],
  );

  return {
    onScroll,
    freeze,
    unfreeze,
    unfreezeNow,
    /** 粘性保持：首次 pin �?scrollTop 常驻（scroll-top 为一次性命令），解�?释放绝不写回 '' */
    freezeProps: lastPinRef.current !== null ? { scrollTop: lastPinRef.current } : {},
    scrollTopRef,
  };
}
