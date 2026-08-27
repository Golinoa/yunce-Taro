/**
 * AddToDesktopTip - 引导用户添加到桌面 / 我的小程序
 *
 * 右上角悬浮气泡（箭头指向胶囊「···」），不含免广告。
 * 未添加：间隔几天提醒一次；已添加或从快捷入口进入：永久不再提醒。
 * 冷启动保护期内不渲染，避免与桌面快捷方式启动叠加导致闪退。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  dismissAddToDesktopTip,
  shouldShowAddToDesktopTip,
  snoozeAddToDesktopTip,
} from '@/utils/add-to-desktop';
import { COLD_START_GRACE_MS, isColdStartGracePeriod } from '@/utils/launch-scene';
import './index.scss';

/** 冷启动保护期结束后再延迟展示 */
const SHOW_DELAY_MS = 800;

/** 气泡宽度（px），约为原 280 的 2/3 */
const TIP_WIDTH_PX = 187;

interface TipLayout {
  top: number;
  left: number;
  arrowLeft: number;
}

function readTipLayout(): TipLayout {
  try {
    const windowWidth = Taro.getWindowInfo().windowWidth || 375;
    const menu = Taro.getMenuButtonBoundingClientRect();
    const gap = 10;
    const top = (menu.bottom || 0) + gap;

    // 气泡尽量靠右，与胶囊对齐；左边缘不贴边
    const preferredLeft = Math.min(
      Math.max(menu.right - TIP_WIDTH_PX, 12),
      windowWidth - TIP_WIDTH_PX - 12,
    );

    // 箭头指向胶囊左侧「···」区域中心
    const targetX = menu.left + menu.width * 0.28;
    const arrowLeft = Math.min(
      Math.max(targetX - preferredLeft - 4, 16),
      TIP_WIDTH_PX - 24,
    );

    return { top, left: preferredLeft, arrowLeft };
  } catch {
    return { top: 88, left: 80, arrowLeft: 200 };
  }
}

const AddToDesktopTip: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const layout = useMemo(() => readTipLayout(), []);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), COLD_START_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || isColdStartGracePeriod()) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tryShow = async () => {
      // 开发/体验版也可引导「我的小程序」；桌面快捷仅正式版可用，文案已统一不单独拦截
      const shouldShow = await shouldShowAddToDesktopTip();
      if (cancelled || !shouldShow) {
        return;
      }
      timer = setTimeout(() => {
        if (!cancelled && !isColdStartGracePeriod()) {
          // 一展示就记一次，避免未点「我知道了」却每次进首页都弹
          snoozeAddToDesktopTip();
          setVisible(true);
        }
      }, SHOW_DELAY_MS);
    };

    void tryShow();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [ready]);

  const handleSnooze = useCallback(() => {
    snoozeAddToDesktopTip();
    setVisible(false);
  }, []);

  const handleNeverRemind = useCallback(() => {
    dismissAddToDesktopTip();
    setVisible(false);
  }, []);

  if (!ready || !visible) {
    return null;
  }

  return (
    <View className="add-to-desktop-tip" catchMove>
      {/* 透明遮罩：点空白处仅 snooze，无免广告、无重遮罩 */}
      <View className="add-to-desktop-tip__mask" onClick={handleSnooze} />

      <View
        className="add-to-desktop-tip__panel"
        style={{
          top: `${layout.top}px`,
          left: `${layout.left}px`,
          width: `${TIP_WIDTH_PX}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <View
          className="add-to-desktop-tip__arrow"
          style={{ left: `${layout.arrowLeft}px` }}
        />

        <View className="add-to-desktop-tip__icons">
          <View className="add-to-desktop-tip__icon-phone">
            <View className="add-to-desktop-tip__phone-dot" />
          </View>
          <View className="add-to-desktop-tip__icon-grid">
            <View className="add-to-desktop-tip__dot" />
            <View className="add-to-desktop-tip__dot" />
            <View className="add-to-desktop-tip__dot" />
            <View className="add-to-desktop-tip__dot" />
            <View className="add-to-desktop-tip__grid-arrow" />
          </View>
        </View>

        <Text className="add-to-desktop-tip__title">添加到桌面或我的小程序</Text>
        <Text className="add-to-desktop-tip__subtitle">使用起来更方便</Text>

        <View className="add-to-desktop-tip__btn press-scale" onClick={handleSnooze}>
          <Text className="add-to-desktop-tip__btn-text">我知道了</Text>
        </View>
        <View className="add-to-desktop-tip__never press-scale" onClick={handleNeverRemind}>
          <Text className="add-to-desktop-tip__never-text">不再提醒</Text>
        </View>
      </View>
    </View>
  );
};

export default AddToDesktopTip;
