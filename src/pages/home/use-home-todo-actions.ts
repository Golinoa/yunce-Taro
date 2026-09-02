/**
 * 首页待办 CRUD / 详情 / 完成 / 新建 — 保持与 index 原交互一致（freeze 后再开层）
 */
import Taro from '@tarojs/taro';
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { TodoViewMode } from '@/components/home/TodoToolbar';
import { todoService } from '@/services';
import type { TodoItem, TodoCollaborationMode } from '@/types/home-todo';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { logError } from '@/utils/logger';
import { buildTodoCardDomId } from '@/utils/todo-card-meta';
import { addTodoCategory } from '@/utils/todo-categories';
import type { CollaboratorSummary } from '@/utils/todo-collaborator-select';
import { isTodoVisibleOnTimelineToday } from '@/utils/todo-timeline';
import type { HomeTab } from './home-todo-derived';

export interface UseHomeTodoActionsParams {
  profileId?: string;
  profileName?: string;
  currentCampusId?: string;
  loadData: (campusId?: string) => Promise<void>;
  loadCategories: () => void;
  freezeHomeScroll: (afterFreeze?: () => void) => void;
  unfreezeHomeScroll: () => void;
  setTodoItems: Dispatch<SetStateAction<TodoItem[]>>;
  setCompleteSheetItem: Dispatch<SetStateAction<TodoItem | null>>;
  setCompleteSheetVisible: Dispatch<SetStateAction<boolean>>;
  completeSheetItem: TodoItem | null;
  setDetailItem: Dispatch<SetStateAction<TodoItem | null>>;
  setDetailVisible: Dispatch<SetStateAction<boolean>>;
  setDetailCollaboratorIds: Dispatch<SetStateAction<string[]>>;
  setDetailCollaboratorSummaries: Dispatch<SetStateAction<CollaboratorSummary[]>>;
  setAddCollaboratorIds: Dispatch<SetStateAction<string[]>>;
  setAddCollaboratorSummaries: Dispatch<SetStateAction<CollaboratorSummary[]>>;
  setAddTodoDefaultQuadrant: Dispatch<SetStateAction<TodoQuadrant | undefined>>;
  setAddPopoverVisible: Dispatch<SetStateAction<boolean>>;
  setActiveTab: Dispatch<SetStateAction<HomeTab>>;
  setTodoViewMode: Dispatch<SetStateAction<TodoViewMode>>;
  setHomeScrollIntoView: Dispatch<SetStateAction<string>>;
  setQuadrantDragging: Dispatch<SetStateAction<boolean>>;
}

export function useHomeTodoActions(params: UseHomeTodoActionsParams) {
  const {
    profileId,
    profileName,
    currentCampusId,
    loadData,
    loadCategories,
    freezeHomeScroll,
    unfreezeHomeScroll,
    setTodoItems,
    setCompleteSheetItem,
    setCompleteSheetVisible,
    completeSheetItem,
    setDetailItem,
    setDetailVisible,
    setDetailCollaboratorIds,
    setDetailCollaboratorSummaries,
    setAddCollaboratorIds,
    setAddCollaboratorSummaries,
    setAddTodoDefaultQuadrant,
    setAddPopoverVisible,
    setActiveTab,
    setTodoViewMode,
    setHomeScrollIntoView,
    setQuadrantDragging,
  } = params;

  const handleCompleteTodo = useCallback(
    (item: TodoItem) => {
      if (item.sharedScope === 'campus_ops') {
        setCompleteSheetItem(item);
        setCompleteSheetVisible(true);
        return;
      }
      if (!profileId) return;
      const userName = profileName || '我';
      void todoService
        .complete(item.id, { userId: profileId, userName })
        .then(() => loadData(currentCampusId))
        .catch((err) => logError('Home completeTodo', err));
    },
    [
      profileId,
      profileName,
      currentCampusId,
      loadData,
      setCompleteSheetItem,
      setCompleteSheetVisible,
    ],
  );

  const handleOpenTodoDetail = useCallback(
    (item: TodoItem) => {
      // scrollOffset 实测后再开层；禁止先 setVisible 再 freeze（会丢位置钉成 0）
      freezeHomeScroll(() => {
        setDetailItem(item);
        setDetailCollaboratorIds(item.assigneeTeacherIds ? [...item.assigneeTeacherIds] : []);
        setDetailCollaboratorSummaries([]);
        setDetailVisible(true);
      });
    },
    [
      freezeHomeScroll,
      setDetailItem,
      setDetailCollaboratorIds,
      setDetailCollaboratorSummaries,
      setDetailVisible,
    ],
  );

  const handleCloseTodoDetail = useCallback(() => {
    setDetailVisible(false);
    setDetailItem(null);
    setDetailCollaboratorIds([]);
    setDetailCollaboratorSummaries([]);
    // 延迟解绑 scrollTop；禁止 +0.01 微调（那会主动驱动滚动条）
    unfreezeHomeScroll();
  }, [
    unfreezeHomeScroll,
    setDetailVisible,
    setDetailItem,
    setDetailCollaboratorIds,
    setDetailCollaboratorSummaries,
  ]);

  const handleDetailDelete = useCallback(
    async (item: TodoItem) => {
      if (!profileId) return;
      await todoService.remove(profileId, item.id);
      await loadData(currentCampusId);
    },
    [profileId, currentCampusId, loadData],
  );

  const handleDetailSave = useCallback(
    async (
      item: TodoItem,
      payload: {
        title: string;
        note?: string;
        remindEnabled: boolean;
        remindDate?: string;
        remindTime?: string;
        quadrant?: TodoQuadrant;
        categoryId?: string;
        collaboratorIds?: string[];
        collaborationMode?: TodoCollaborationMode;
      },
    ) => {
      if (!profileId) return;
      const updated = await todoService.update(profileId, item.id, payload);
      await loadData(currentCampusId);
      if (updated) setDetailItem(updated);
    },
    [profileId, currentCampusId, loadData, setDetailItem],
  );

  const handleSubmitCompleteTodo = useCallback(
    async (note: string) => {
      if (!profileId || !completeSheetItem) return;
      const userName = profileName || '我';
      await todoService.complete(completeSheetItem.id, {
        userId: profileId,
        userName,
        note,
      });
      setCompleteSheetVisible(false);
      setCompleteSheetItem(null);
      await loadData(currentCampusId);
    },
    [
      profileId,
      profileName,
      completeSheetItem,
      currentCampusId,
      loadData,
      setCompleteSheetVisible,
      setCompleteSheetItem,
    ],
  );

  const handleOpenAddTodoSheet = useCallback(
    (quadrant?: TodoQuadrant) => {
      freezeHomeScroll(() => {
        setAddCollaboratorIds([]);
        setAddCollaboratorSummaries([]);
        setAddTodoDefaultQuadrant(quadrant);
        setAddPopoverVisible(true);
      });
    },
    [
      freezeHomeScroll,
      setAddCollaboratorIds,
      setAddCollaboratorSummaries,
      setAddTodoDefaultQuadrant,
      setAddPopoverVisible,
    ],
  );

  const handleCloseAddTodoSheet = useCallback(() => {
    setAddPopoverVisible(false);
    setAddTodoDefaultQuadrant(undefined);
    unfreezeHomeScroll();
  }, [unfreezeHomeScroll, setAddPopoverVisible, setAddTodoDefaultQuadrant]);

  const handleCreateCategoryFromPopover = useCallback(
    async (name: string) => {
      if (!profileId) return null;
      const created = addTodoCategory(profileId, name);
      if (!created) {
        Taro.showToast({ title: '分类已存在或无效', icon: 'none' });
        return null;
      }
      loadCategories();
      Taro.showToast({ title: '已添加', icon: 'success' });
      return created.id;
    },
    [loadCategories, profileId],
  );

  const handleQuadrantChange = useCallback(
    async (item: TodoItem, quadrant: TodoQuadrant) => {
      if (!profileId) return;
      const ok = await todoService.updateQuadrant(profileId, item.id, quadrant);
      if (!ok) {
        Taro.showToast({ title: '调整失败', icon: 'none' });
        return;
      }
      setTodoItems((prev) =>
        prev.map((todo) => (todo.id === item.id ? { ...todo, quadrant } : todo)),
      );
    },
    [profileId, setTodoItems],
  );

  const handleQuadrantDragActiveChange = useCallback(
    (active: boolean) => {
      setQuadrantDragging(active);
    },
    [setQuadrantDragging],
  );

  const handleSubmitCustomTodo = useCallback(
    async (payload: {
      title: string;
      note?: string;
      remindEnabled: boolean;
      remindDate?: string;
      remindTime?: string;
      quadrant?: TodoQuadrant;
      categoryId?: string;
      collaboratorIds?: string[];
      collaborationMode?: TodoCollaborationMode;
    }) => {
      if (!profileId) return;
      const created = await todoService.add(profileId, payload);
      setAddPopoverVisible(false);
      setAddTodoDefaultQuadrant(undefined);
      setActiveTab('todo');
      setTodoViewMode('timeline');
      await loadData(currentCampusId);

      // 首页仅展示今日时间轴：在首页则滚动定位；否则 Toast 兜底引导去「我的待办」
      if (isTodoVisibleOnTimelineToday(created)) {
        setTimeout(() => {
          setHomeScrollIntoView(buildTodoCardDomId(created.id));
          setTimeout(() => setHomeScrollIntoView(''), 500);
        }, 150);
        Taro.showToast({ title: '已保存', icon: 'success' });
      } else {
        Taro.showToast({ title: '已保存，请到「我的待办」查看', icon: 'none' });
      }
    },
    [
      profileId,
      loadData,
      currentCampusId,
      setAddPopoverVisible,
      setAddTodoDefaultQuadrant,
      setActiveTab,
      setTodoViewMode,
      setHomeScrollIntoView,
    ],
  );

  const handleOpenMyTodos = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/my-todos/index' });
  }, []);

  return {
    handleCompleteTodo,
    handleOpenTodoDetail,
    handleCloseTodoDetail,
    handleDetailDelete,
    handleDetailSave,
    handleSubmitCompleteTodo,
    handleOpenAddTodoSheet,
    handleCloseAddTodoSheet,
    handleCreateCategoryFromPopover,
    handleQuadrantChange,
    handleQuadrantDragActiveChange,
    handleSubmitCustomTodo,
    handleOpenMyTodos,
  };
}
