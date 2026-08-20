import { View, Text } from '@tarojs/components';
import React, { useEffect, useState } from 'react';

/**
 * 页面/区块加载占位组件
 *
 * 设计要点（接入主题色系统 + 信息分层）：
 * - 卡片容器用 `bg-card` token（替代硬编码 `bg-white`），随主题切换背景
 * - 整体竖向居中布局：标题区 → 加载环 → 骨架占位 → 进度指示器，4 段清晰分层
 * - 加载环做主视觉（128rpx）：外圈虚线圈 + 主题色软底 + 内圈旋转环
 * - 骨架条 3 行宽度规律化（72/92/60%），与设计稿节奏一致
 * - 底部 3 个圆点指示器用主题色阶梯（100/55/25）+ 当前激活点放大+发光
 *
 * @example
 * ```tsx
 * <Loading fullScreen size="large" title="正在准备页面" text="页面即将打开，请稍候" />
 * ```
 */

const LOADING_APPEAR_DELAY_MS = 120;

interface LoadingProps {
  /** 主标题（默认"正在加载"） */
  title?: string;
  /** 副标题（默认"正在同步页面数据，请稍候"） */
  text?: string;
  /** 加载环尺寸：small=32rpx / medium=48rpx / large=64rpx 旋转环 */
  size?: 'small' | 'medium' | 'large';
  /** 全屏模式：占满 min-h-screen，居中显示 */
  fullScreen?: boolean;
  /** 延迟显示毫秒（避免极短任务闪屏） */
  delayMs?: number;
}

const Loading: React.FC<LoadingProps> = ({
  title = '正在加载',
  text = '正在同步页面数据，请稍候',
  size = 'medium',
  fullScreen = false,
  delayMs = LOADING_APPEAR_DELAY_MS,
}) => {
  const [visible, setVisible] = useState(delayMs <= 0);
  const ringSize = size === 'small' ? '32rpx' : size === 'large' ? '64rpx' : '48rpx';

  useEffect(() => {
    if (delayMs <= 0) {
      setVisible(true);
      return undefined;
    }

    setVisible(false);
    const timer = setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [delayMs]);

  if (!visible) {
    return null;
  }

  const wrapperClassName = fullScreen
    ? 'min-h-screen bg-gradient-subtle px-[40rpx] flex items-center justify-center'
    : 'flex items-center justify-center px-[24rpx] py-[64rpx]';

  return (
    <View className={wrapperClassName}>
      <View
        className={`w-full rounded-[36rpx] bg-card border-[2rpx] border-solid border-border-light shadow-soft ${
          fullScreen
            ? 'max-w-[560rpx] px-[48rpx] py-[64rpx]'
            : 'max-w-[520rpx] px-[32rpx] py-[40rpx]'
        }`}
      >
        {/* 标题区：竖排居中 */}
        <View className="flex flex-col items-center gap-[12rpx]">
          <Text className="text-[36rpx] font-semibold text-foreground tracking-tight">{title}</Text>
          <Text className="text-[26rpx] leading-[1.6] text-muted-foreground text-center">
            {text}
          </Text>
        </View>

        {/* 加载环：主视觉居中 */}
        <View className="mt-[48rpx] flex items-center justify-center">
          <View className="relative w-[128rpx] h-[128rpx] rounded-full bg-primary/8 flex items-center justify-center shadow-float">
            <View className="absolute inset-[10rpx] rounded-full border-[2rpx] border-dashed border-primary/15" />
            <View className="flex items-center justify-center animate-spin">
              <View
                className="rounded-full border-[4rpx] border-solid border-primary/15 border-t-primary"
                style={{ width: ringSize, height: ringSize }}
              />
            </View>
          </View>
        </View>

        {/* 骨架占位：3 行有节奏 */}
        <View className="mt-[40rpx] flex flex-col items-center gap-[14rpx]">
          <View className="h-[18rpx] w-[72%] rounded-full bg-muted animate-pulse" />
          <View className="h-[18rpx] w-[92%] rounded-full bg-muted animate-pulse" />
          <View className="h-[18rpx] w-[60%] rounded-full bg-muted animate-pulse" />
        </View>

        {/* 进度指示器：当前激活点放大 + 发光 */}
        <View className="mt-[36rpx] flex flex-row items-center justify-center gap-[12rpx]">
          <View className="w-[16rpx] h-[16rpx] rounded-full bg-primary shadow-float animate-pulse" />
          <View className="w-[10rpx] h-[10rpx] rounded-full bg-primary/55" />
          <View className="w-[10rpx] h-[10rpx] rounded-full bg-primary/25" />
          <Text className="ml-[8rpx] text-[22rpx] text-muted-foreground">页面内容即将呈现</Text>
        </View>
      </View>
    </View>
  );
};

export default Loading;
