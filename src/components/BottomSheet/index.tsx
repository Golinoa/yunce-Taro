import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useState, useRef } from 'react';

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
  /** 内容面板高度（默认 70vh），支持固定高度如 70vh / 600rpx */
  height?: string;
  /** 内容区最大高度（已废弃，请使用 height） */
  maxHeight?: string;
  /** 额外内容区类名 */
  className?: string;
  /** 内容区是否可滚动（默认 true） */
  scrollable?: boolean;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  show: showProp,
  visible,
  title,
  onClose,
  children,
  height,
  maxHeight,
  className,
  scrollable = true,
}) => {
  // 向后兼容：如果传了 show，则用 show 控制渲染、visible 控制动画
  // 否则用 visible 同时控制渲染和动画
  const useDualMode = showProp !== undefined;
  const shouldRender = useDualMode ? showProp! : visible;
  const shouldAnimate = visible;

  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);

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

  if (!mounted) return null;

  // 高度兼容：优先使用 height，其次 maxHeight，默认 70vh
  // height="auto" 时内容自适应，不设固定高度
  const isAutoHeight = height === 'auto';
  const panelHeight = isAutoHeight ? undefined : height || maxHeight || '70vh';
  const scrollAreaHeight = isAutoHeight ? undefined : `calc(${panelHeight} - 120rpx)`;

  const content = <View className="bg-white">{children}</View>;

  return (
    <View
      className="fixed inset-0 z-200"
      // 最外层也拦截点击，防止事件穿透到下层页面元素
      onClick={(e) => {
        e.stopPropagation();
        onClose?.();
      }}
      catchMove
    >
      {/* 遮罩层 — 始终保持可点击背景，bg-black/0 确保小程序中接收 tap 事件 */}
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
      {/* 内容面板 — 阻止点击冒泡到遮罩层 */}
      <View
        className={cn(
          'absolute bottom-0 left-0 right-0 rounded-t-[40rpx] bg-white overflow-hidden',
          'transition-transform duration-300 ease-in-out',
          animating ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
        style={panelHeight ? { height: panelHeight, maxHeight: panelHeight } : undefined}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* 标题栏 */}
        {title && (
          <View className="px-[40rpx] pb-[12rpx] pt-[28rpx] bg-white">
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
            <View className="bg-white">{children}</View>
          </ScrollView>
        ) : (
          content
        )}
      </View>
    </View>
  );
};

export default BottomSheet;
