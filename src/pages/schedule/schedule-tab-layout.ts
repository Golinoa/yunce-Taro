/**
 * 课表 Tab 布局常量（Q2-1）
 */
import Taro from '@tarojs/taro';

/** Tab 区域右侧固定按钮区宽度（rpx） */
export const TAB_RIGHT_FIXED_WIDTH_RPX = 220;
/** Tab 一屏显示数量（4 个完整 + 第 5 个露出一半） */
export const TAB_COUNT_PER_SCREEN = 4.5;
/** Tab 之间的间隙（rpx） */
export const TAB_GAP_RPX = 16;
/** 单个 Tab 宽度（rpx） */
export const TAB_WIDTH_RPX =
  (750 - TAB_RIGHT_FIXED_WIDTH_RPX - (TAB_COUNT_PER_SCREEN - 1) * TAB_GAP_RPX) /
  TAB_COUNT_PER_SCREEN;

/** 计算 Tab 容器的总宽度（rpx） */
export const getTabContainerWidth = (tabCount: number): number =>
  tabCount * TAB_WIDTH_RPX + (tabCount - 1) * TAB_GAP_RPX;

/** 将 rpx 转换为当前屏幕 px */
export function rpxToPx(rpx: number): number {
  const { windowWidth } = Taro.getWindowInfo();
  return (rpx * windowWidth) / 750;
}
