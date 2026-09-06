/**
 * ExpandableFabMenu - 待办 Tab 右下角可展开 FAB 菜单
 *
 * 使用场景：首页待办事项 Tab；主按钮旋转缩小，子项自右向左依次滑入；
 * actions 数组自上而下对应展开菜单（首项在最上）。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import type { ITouchEvent } from '@tarojs/components';

/**
 * 抬到自定义 TabBar 上方（TabBar 内容区 98rpx + 间距 32rpx，另加 safe-area）
 * 与 `home-fab-logic.FAB_SCREEN_BOTTOM_OFFSET_RPX` / custom-tab-bar 对齐
 */
const FAB_SCREEN_BOTTOM_OFFSET_RPX = 130;

export interface ExpandableFabMenuAction {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
}

export interface ExpandableFabMenuProps {
  actions: ExpandableFabMenuAction[];
  className?: string;
  /** 是否显示（用于滚动进入待办区域后再展示） */
  visible?: boolean;
  /** 展开/收起时回调，便于外层保持 ScrollView 滚动位置 */
  onToggle?: (expanded: boolean) => void;
}

const MENU_STAGGER_MS = 45;
const MENU_ITEM_GAP_RPX = 88;
const ANIMATION_MS = 180;

const ExpandableFabMenu: React.FC<ExpandableFabMenuProps> = ({
  actions,
  className,
  visible = true,
  onToggle,
}) => {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);

  const setExpandedState = useCallback(
    (next: boolean) => {
      expandedRef.current = next;
      onToggle?.(next);
      setExpanded(next);
    },
    [onToggle],
  );

  useEffect(() => {
    if (!visible && expandedRef.current) {
      setExpandedState(false);
    }
  }, [visible, setExpandedState]);

  const handleToggle = useCallback(
    (event: ITouchEvent) => {
      event.stopPropagation?.();
      event.preventDefault?.();
      setExpandedState(!expandedRef.current);
    },
    [setExpandedState],
  );

  const handleBackdropClose = useCallback(
    (event: ITouchEvent) => {
      event.stopPropagation?.();
      setExpandedState(false);
    },
    [setExpandedState],
  );

  const handleActionClick = useCallback(
    (action: ExpandableFabMenuAction, event: ITouchEvent) => {
      event.stopPropagation?.();
      setExpandedState(false);
      action.onClick();
    },
    [setExpandedState],
  );

  return (
    <>
      {expanded && (
        <View className="fixed inset-0 z-90 bg-foreground/10" onClick={handleBackdropClose} />
      )}

      <View
        className={cn(
          'fixed right-[32rpx] z-100 fab-menu-root',
          visible ? 'fab-menu-root--visible' : 'fab-menu-root--hidden',
          className,
        )}
        style={{
          // 抬到自定义 TabBar 上方，避免 z-index 更低被挡住
          bottom: `calc(${FAB_SCREEN_BOTTOM_OFFSET_RPX}rpx + env(safe-area-inset-bottom))`,
        }}
        onClick={(event) => event.stopPropagation?.()}
      >
        <View className="relative min-w-[96rpx] h-[96rpx]">
          {actions.map((action, index) => {
            const stackIndex = actions.length - 1 - index;
            const delayMs = stackIndex * MENU_STAGGER_MS;
            return (
              <View
                key={action.key}
                className={cn(
                  'fab-menu-item absolute right-0 press-scale',
                  expanded ? 'fab-menu-item--visible' : 'fab-menu-item--hidden-instant',
                )}
                style={{
                  bottom: `${(stackIndex + 1) * MENU_ITEM_GAP_RPX}rpx`,
                  transitionDelay: expanded ? `${delayMs}ms` : '0ms',
                  transitionDuration: expanded ? `${ANIMATION_MS}ms` : '0ms',
                }}
                onClick={(event) => handleActionClick(action, event)}
              >
                <View className="fab-menu-action-btn gap-[10rpx] rounded-full border border-border bg-card px-[22rpx] py-[14rpx] shadow-float">
                  <Icon name={action.icon} size="sm" color="primary" />
                  <Text className="text-[24rpx] font-medium text-foreground">{action.label}</Text>
                </View>
              </View>
            );
          })}

          <View
            className={cn(
              'fab-main-trigger absolute right-[8rpx] bottom-0 flex items-center justify-center rounded-full bg-primary shadow-float press-scale',
              expanded ? 'fab-main-trigger--expanded' : 'fab-main-trigger--normal',
            )}
            hoverClass="none"
            hoverStopPropagation
            onClick={handleToggle}
          >
            <View className={cn('fab-main-icon', expanded && 'fab-main-icon--rotated')}>
              <Icon name="mdi-plus" size="xl" color="white" />
            </View>
          </View>
        </View>
      </View>
    </>
  );
};

export default ExpandableFabMenu;
