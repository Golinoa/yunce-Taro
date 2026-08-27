import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';

/**
 * BottomSheet - 统一底部弹窗组件
 *
 * 支持滑入/滑出动画，遮罩渐变，统一全局底部弹窗样式。
 *
 * 使用方式（推荐）：
 *   <BottomSheet visible={true} title="xxx" onClose={handleClose}>
 *     内容
 *   </BottomSheet>
 *
 * 内部自动管理 mounted + 动画时序：
 *   - visible=true → 先 mounted=true（渲染DOM），下一帧 animating=true（触发滑入动画）
 *   - visible=false → animating=false（触发滑出动画），transitionEnd 后 mounted=false（卸载DOM）
 *
 * 向后兼容：仍支持 show + visible 双 prop 模式，但推荐使用单一 visible。
 */

export interface BottomSheetProps {
  /** 是否显示（控制渲染），向后兼容，推荐直接用 visible */
  show?: boolean;
  /** 是否可见（控制动画 + 渲染） */
  visible: boolean;
  /** 标题 */
  title?: string;
  /** 关闭回调 */
  onClose?: () => void;
  /** 子内容 */
  children: React.ReactNode;
  /**
   * 内容面板高度
   * - 默认 70vh
   * - 固定高度如 '80vh' / '600rpx'
   * - 传 'auto' 时面板自适应内容高度（配合 maxHeightLimit 限制上限）
   */
  height?: string;
  /** @deprecated 请使用 height。旧字段保留兼容 */
  maxHeight?: string;
  /**
   * 面板上限高度（用于 height='auto' 时限制最大高度，避免遮罩盖全屏；如 '80vh'）
   * 固定高度模式下不生效
   */
  maxHeightLimit?: string;
  /**
   * 内容面板高度占当前窗口可用高度的比例（0~1）。
   * 基于 Taro.getWindowInfo().windowHeight 换算为 px，避免 vh 在有/无导航栏页面表现不一致。
   * 与 height 同时传入时优先使用 heightRatio。
   */
  heightRatio?: number;
  /** 额外内容区类名 */
  className?: string;
  /** 内容区是否可滚动（默认 true） */
  scrollable?: boolean;
  /**
   * 内容容器是否撑满面板（h-full + flex-col）
   * - true：业务组件需要内部 flex 布局（如 ScrollView flex-1 + 固定底部按钮）时使用
   * - false（默认）：保留 block 布局
   */
  fillHeight?: boolean;
  /** 键盘弹起时整体上移，避免遮挡输入区（弹窗内表单场景） */
  keyboardAware?: boolean;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  show: showProp,
  visible,
  title,
  onClose,
  children,
  height,
  maxHeight,
  maxHeightLimit,
  className,
  scrollable = true,
  fillHeight = false,
  heightRatio,
  keyboardAware = false,
}) => {
  // 向后兼容：如果传了 show，则用 show 控制渲染、visible 控制动画
  // 否则用 visible 同时控制渲染和动画
  const useDualMode = showProp !== undefined;
  const shouldRender = useDualMode ? showProp! : visible;
  const shouldAnimate = visible;

  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const keyboardHeight = useKeyboardHeight(mounted && keyboardAware);

  useEffect(() => {
    if (shouldRender) {
      // 打开：先挂载 DOM
      setMounted(true);
    }
    // animating 由 shouldAnimate 驱动
    if (shouldAnimate && shouldRender) {
      // 下一帧触发滑入动画
      rafRef.current = requestAnimationFrame(() => {
        setAnimating(true);
      });
    } else {
      // 滑出动画或保持隐藏
      setAnimating(false);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [shouldRender, shouldAnimate]);

  // 动画结束后卸载
  const handleTransitionEnd = () => {
    if (!animating) {
      setMounted(false);
    }
  };

  const ratioHeightPx = useMemo(() => {
    if (!heightRatio || heightRatio <= 0 || !shouldRender) {
      return undefined;
    }
    const { windowHeight } = Taro.getWindowInfo();
    return `${Math.round(windowHeight * Math.min(heightRatio, 1))}px`;
  }, [heightRatio, shouldRender]);

  const isAutoHeight = height === 'auto';
  const fixedHeight = useMemo(() => {
    if (isAutoHeight) {
      return undefined;
    }
    if (ratioHeightPx) {
      return ratioHeightPx;
    }
    return height || maxHeight || '70vh';
  }, [height, isAutoHeight, maxHeight, ratioHeightPx]);
  const scrollAreaHeight = isAutoHeight ? undefined : `calc(${fixedHeight} - 120rpx)`;

  if (!mounted) return null;

  // auto 模式下：内容自然撑开，用 maxHeightLimit 限制上限
  // 固定高度模式下：高度固定为 fixedHeight
  const panelStyle = isAutoHeight
    ? maxHeightLimit
      ? { maxHeight: maxHeightLimit }
      : undefined
    : { height: fixedHeight, maxHeight: fixedHeight };

  const panelPositionStyle =
    keyboardAware && keyboardHeight > 0 ? { bottom: `${keyboardHeight}px` } : undefined;

  // fillHeight 时内容区用 flex-1 而非 h-full：面板是 flex-col，标题栏占去一部分高度后，
  // h-full（100% 面板高）会把内容区撑出面板底部、被 overflow-hidden 裁剪（确认按钮被遮）。
  // flex-1 min-h-0 让内容区正确压缩在标题栏下方的剩余空间内。
  const content = fillHeight ? (
    <View className="bg-white flex-1 min-h-0 flex flex-col">{children}</View>
  ) : (
    <View className="bg-white">{children}</View>
  );

  return (
    <View className="fixed inset-0 z-200">
      {/* 遮罩层 — 始终保持可点击背景，bg-black/0 确保小程序中接收 tap 事件；
          仅遮罩层 catchMove，阻止背景页面滚动，同时不阻塞内容面板内的 PickerView/ScrollView */}
      <View
        className={cn(
          'absolute inset-0 transition-all duration-300',
          animating ? 'bg-black/45' : 'bg-black/0',
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
        catchMove
      />
      {/* 内容面板 — 阻止点击冒泡到遮罩层；不 catchMove，避免拦截内部 PickerView/ScrollView 滚动
          面板为 flex-col：标题栏 shrink-0，内容区 flex-1 撑满剩余空间，避免内容溢出底部被裁剪 */}
      <View
        className={cn(
          'absolute bottom-0 left-0 right-0 rounded-t-[40rpx] bg-white overflow-hidden flex flex-col',
          'transition-transform duration-300 ease-in-out',
          animating ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
        style={{ ...panelStyle, ...panelPositionStyle }}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* 标题栏 */}
        {title && (
          <View className="shrink-0 px-[40rpx] pb-[12rpx] pt-[28rpx] bg-white">
            <Text className="text-[32rpx] font-semibold text-foreground">{title}</Text>
          </View>
        )}
        {/* 内容区 */}
        {scrollable && !isAutoHeight ? (
          <ScrollView
            scrollY
            className="bg-white"
            style={{ height: scrollAreaHeight, maxHeight: scrollAreaHeight }}
          >
            <View className={cn('bg-white', fillHeight && 'h-full flex flex-col')}>{children}</View>
          </ScrollView>
        ) : (
          content
        )}
      </View>
    </View>
  );
};

export default BottomSheet;
