/**
 * 获取小程序导航安全区高度（状态栏 + 胶囊按钮 + 间隙）
 * 用于 navigationStyle: 'custom' 页面，避免内容被胶囊按钮遮挡
 */
import Taro from '@tarojs/taro';
import { useMemo } from 'react';

/** 胶囊按钮下方的视觉间隙（px） */
const NAV_GAP_PX = 8;

export function useNavSafeHeight(): number {
  return useMemo(() => {
    try {
      // 使用新版 getWindowInfo 替代已弃用的 getSystemInfoSync
      const windowInfo = Taro.getWindowInfo();
      const menuButtonInfo = Taro.getMenuButtonBoundingClientRect();
      const statusBarHeight = windowInfo.statusBarHeight ?? 0;

      // 优先用胶囊按钮底部位置 + 间隙，确保内容不会与胶囊重叠
      const baseHeight = menuButtonInfo?.bottom ?? statusBarHeight + 44;
      return baseHeight + NAV_GAP_PX;
    } catch {
      // 兜底：44px 状态栏 + 44px 胶囊栏 + 间隙
      return 96;
    }
  }, []);
}
