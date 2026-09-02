/**
 * 首页 FAB 显隐 / 展开冻结 / 视图切换（延迟走同一 handleTodoViewModeChange）
 */
import Taro from '@tarojs/taro';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TodoViewMode } from '@/components/home/TodoToolbar';
import type { UserRole } from '@/types/profile';
import { isStaffRole } from '@/utils/auth';
import { FAB_VIEW_TOGGLE_DELAY_MS, nextTodoViewMode, shouldRevealHomeFab } from './home-fab-logic';
import type { HomeTab } from './home-todo-derived';

export interface UseHomeFabParams {
  activeTab: HomeTab;
  currentRole: UserRole | null | undefined;
  todoItemsLength: number;
  freezeHomeScroll: (afterFreeze?: () => void) => void;
  unfreezeHomeScrollNow: () => void;
  onTodoViewModeChange: (mode: TodoViewMode) => void;
  todoViewModeRef: React.MutableRefObject<TodoViewMode>;
}

export function useHomeFab({
  activeTab,
  currentRole,
  todoItemsLength,
  freezeHomeScroll,
  unfreezeHomeScrollNow,
  onTodoViewModeChange,
  todoViewModeRef,
}: UseHomeFabParams) {
  const [fabMenuExpanded, setFabMenuExpanded] = useState(false);
  const [fabVisible, setFabVisible] = useState(false);
  /** 待办 Tab 内是否发生过滚动（防止仅点 Tab 未滑就误显） */
  const todoTabScrollEngagedRef = useRef(false);
  const fabVisibilityRafRef = useRef(0);

  const updateFabVisibility = useCallback(() => {
    if (fabMenuExpanded) {
      return;
    }
    if (activeTab !== 'todo' || !isStaffRole(currentRole) || !todoTabScrollEngagedRef.current) {
      setFabVisible(false);
      return;
    }

    Taro.createSelectorQuery()
      .select('#home-scroll-view')
      .boundingClientRect()
      .select('#home-todo-fab-anchor')
      .boundingClientRect()
      .exec((res) => {
        const scrollViewRect = res[0];
        const anchorRect = res[1];
        setFabVisible(
          shouldRevealHomeFab({
            scrollViewRect,
            anchorRect,
            windowWidth: Taro.getWindowInfo().windowWidth,
          }),
        );
      });
  }, [activeTab, currentRole, fabMenuExpanded]);

  const scheduleFabVisibilityUpdate = useCallback(() => {
    if (fabVisibilityRafRef.current) return;
    fabVisibilityRafRef.current = requestAnimationFrame(() => {
      fabVisibilityRafRef.current = 0;
      updateFabVisibility();
    });
  }, [updateFabVisibility]);

  const markTodoTabScrolled = useCallback(() => {
    todoTabScrollEngagedRef.current = true;
    scheduleFabVisibilityUpdate();
  }, [scheduleFabVisibilityUpdate]);

  const handleFabToggle = useCallback(
    (expanded: boolean) => {
      setFabMenuExpanded(expanded);
      if (expanded) {
        freezeHomeScroll();
        return;
      }
      unfreezeHomeScrollNow();
    },
    [freezeHomeScroll, unfreezeHomeScrollNow],
  );

  /** FAB「卡片/列表视图」：菜单先收起（ExpandableFabMenu 内已关），再延迟走工具栏同款切换 */
  const handleFabViewModeToggle = useCallback(() => {
    const next = nextTodoViewMode(todoViewModeRef.current);
    setTimeout(() => {
      onTodoViewModeChange(next);
    }, FAB_VIEW_TOGGLE_DELAY_MS);
  }, [onTodoViewModeChange, todoViewModeRef]);

  const resetFabOnTabLeave = useCallback(() => {
    setFabMenuExpanded(false);
    setFabVisible(false);
    todoTabScrollEngagedRef.current = false;
  }, []);

  const prepareFabForTodoTab = useCallback(() => {
    todoTabScrollEngagedRef.current = false;
    setFabVisible(false);
  }, []);

  useEffect(() => {
    if (activeTab !== 'todo') {
      todoTabScrollEngagedRef.current = false;
      setFabVisible(false);
      return;
    }
    todoTabScrollEngagedRef.current = false;
    setFabVisible(false);
  }, [activeTab, todoItemsLength]);

  useEffect(
    () => () => {
      if (fabVisibilityRafRef.current) {
        cancelAnimationFrame(fabVisibilityRafRef.current);
      }
    },
    [],
  );

  return {
    fabMenuExpanded,
    fabVisible,
    handleFabToggle,
    handleFabViewModeToggle,
    markTodoTabScrolled,
    resetFabOnTabLeave,
    prepareFabForTodoTab,
    setFabMenuExpanded,
    setFabVisible,
  };
}
