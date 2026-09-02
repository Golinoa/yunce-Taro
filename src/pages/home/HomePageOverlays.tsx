/**
 * 首页蒙层 / Sheet / 引导弹窗（与 ScrollView 解耦，便于主文件瘦身）
 * 滚动冻结仍由页面传入的 freeze/unfreeze 与 useOverlayScrollFreeze 驱动。
 */
import React from 'react';
import AddToDesktopTip from '@/components/AddToDesktopTip';
import CampusSelectSheet from '@/components/home/CampusSelectSheet';
import CompleteTodoSheet from '@/components/home/CompleteTodoSheet';
import ExpandableFabMenu from '@/components/home/ExpandableFabMenu';
import HomeCampusGuideDialog from '@/components/home/HomeCampusGuideDialog';
import MockIdentitySwitcher from '@/components/MockIdentitySwitcher';
import AddCustomTodoPopover from '@/components/my-todos/AddCustomTodoPopover';
import TodoDetailPopover from '@/components/my-todos/TodoDetailPopover';
import RelationConfirmSheet from '@/components/RelationConfirmSheet';
import RoleSwitchSheet from '@/components/RoleSwitchSheet';
import type { CampusUIModel } from '@/types/campus';
import type { TodoItem, TodoCollaborationMode } from '@/types/home-todo';
import type { UserRole } from '@/types/profile';
import type { ParentStorefrontItem } from '@/types/storefront';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import type { TodoCategoryTab } from '@/utils/todo-categories';
import { TODO_CATEGORY_INBOX_ID } from '@/utils/todo-categories';
import type { CollaboratorSummary } from '@/utils/todo-collaborator-select';
import type { HomeTab } from './home-todo-derived';

export interface HomeFabAction {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
}

export interface HomePageOverlaysProps {
  isDebugBuild: boolean;
  isStaff: boolean;
  isParent: boolean;
  showCampusSheet: boolean;
  currentCampusId: string;
  currentRole?: UserRole | null;
  campuses: CampusUIModel[];
  managedCampusIds: string[];
  lastVisitedCampusId: string;
  parentStorefronts: ParentStorefrontItem[];
  currentStorefrontKey: string;
  campusConfirming: boolean;
  onCloseCampusSheet: () => void;
  onConfirmCampus: (campus: CampusUIModel) => void;
  onConfirmStorefront: (item: ParentStorefrontItem) => void;
  roleSheetVisible: boolean;
  onCloseRoleSheet: () => void;
  addPopoverVisible: boolean;
  categoryTabs: TodoCategoryTab[];
  addTodoDefaultQuadrant?: TodoQuadrant;
  addCollaboratorIds: string[];
  addCollaboratorSummaries: CollaboratorSummary[];
  onCloseAddTodoSheet: () => void;
  onCreateCategoryFromPopover: (name: string) => Promise<string | null>;
  onSubmitCustomTodo: (payload: {
    title: string;
    note?: string;
    remindEnabled: boolean;
    remindDate?: string;
    remindTime?: string;
    quadrant?: TodoQuadrant;
    categoryId?: string;
    collaboratorIds?: string[];
    collaborationMode?: TodoCollaborationMode;
  }) => Promise<void>;
  detailVisible: boolean;
  detailItem: TodoItem | null;
  detailCollaboratorIds: string[];
  detailCollaboratorSummaries: CollaboratorSummary[];
  onCloseTodoDetail: () => void;
  onDetailDelete: (item: TodoItem) => Promise<void>;
  onDetailSave: (
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
  ) => Promise<void>;
  completeSheetVisible: boolean;
  completeSheetItem: TodoItem | null;
  onCloseCompleteSheet: () => void;
  onSubmitCompleteTodo: (note: string) => Promise<void>;
  activeTab: HomeTab;
  fabVisible: boolean;
  fabActions: HomeFabAction[];
  onFabToggle: (expanded: boolean) => void;
  relationSheetVisible: boolean;
  pendingStudentName: string;
  pendingStudentParentId: string;
  onRelationClose: () => void;
  onRelationConfirmed: () => void;
  campusGuideVisible: boolean;
  onCloseCampusGuide: () => void;
}

const HomePageOverlays: React.FC<HomePageOverlaysProps> = (props) => {
  const {
    isDebugBuild,
    isStaff,
    isParent,
    showCampusSheet,
    currentCampusId,
    currentRole,
    campuses,
    managedCampusIds,
    lastVisitedCampusId,
    parentStorefronts,
    currentStorefrontKey,
    campusConfirming,
    onCloseCampusSheet,
    onConfirmCampus,
    onConfirmStorefront,
    roleSheetVisible,
    onCloseRoleSheet,
    addPopoverVisible,
    categoryTabs,
    addTodoDefaultQuadrant,
    addCollaboratorIds,
    addCollaboratorSummaries,
    onCloseAddTodoSheet,
    onCreateCategoryFromPopover,
    onSubmitCustomTodo,
    detailVisible,
    detailItem,
    detailCollaboratorIds,
    detailCollaboratorSummaries,
    onCloseTodoDetail,
    onDetailDelete,
    onDetailSave,
    completeSheetVisible,
    completeSheetItem,
    onCloseCompleteSheet,
    onSubmitCompleteTodo,
    activeTab,
    fabVisible,
    fabActions,
    onFabToggle,
    relationSheetVisible,
    pendingStudentName,
    pendingStudentParentId,
    onRelationClose,
    onRelationConfirmed,
    campusGuideVisible,
    onCloseCampusGuide,
  } = props;

  return (
    <>
      {(isStaff || isParent) && (
        <CampusSelectSheet
          visible={showCampusSheet}
          currentId={currentCampusId}
          currentRole={currentRole}
          campuses={campuses}
          managedCampusIds={managedCampusIds}
          lastVisitedId={lastVisitedCampusId}
          storefronts={isParent ? parentStorefronts : undefined}
          currentStorefrontKey={currentStorefrontKey}
          confirming={campusConfirming}
          onClose={onCloseCampusSheet}
          onConfirm={onConfirmCampus}
          onConfirmStorefront={onConfirmStorefront}
        />
      )}

      <RoleSwitchSheet visible={roleSheetVisible} onClose={onCloseRoleSheet} />

      <AddCustomTodoPopover
        visible={addPopoverVisible}
        categoryTabs={categoryTabs}
        defaultCategoryId={TODO_CATEGORY_INBOX_ID}
        defaultQuadrant={addTodoDefaultQuadrant}
        collaboratorIds={addCollaboratorIds}
        collaboratorSummaries={addCollaboratorSummaries}
        onClose={onCloseAddTodoSheet}
        onCreateCategory={onCreateCategoryFromPopover}
        onSubmit={onSubmitCustomTodo}
      />

      <TodoDetailPopover
        visible={detailVisible}
        item={detailItem}
        categoryTabs={categoryTabs}
        collaboratorIds={detailCollaboratorIds}
        collaboratorSummaries={detailCollaboratorSummaries}
        onClose={onCloseTodoDetail}
        onCreateCategory={onCreateCategoryFromPopover}
        onDelete={onDetailDelete}
        onSave={onDetailSave}
      />

      <CompleteTodoSheet
        visible={completeSheetVisible}
        item={completeSheetItem}
        onClose={onCloseCompleteSheet}
        onSubmit={onSubmitCompleteTodo}
      />

      {isStaff && (
        <ExpandableFabMenu
          visible={activeTab === 'todo' && fabVisible}
          actions={fabActions}
          onToggle={onFabToggle}
        />
      )}

      <AddToDesktopTip />

      <RelationConfirmSheet
        visible={relationSheetVisible}
        studentName={pendingStudentName}
        studentParentId={pendingStudentParentId}
        onClose={onRelationClose}
        onConfirmed={onRelationConfirmed}
      />

      <HomeCampusGuideDialog visible={campusGuideVisible} onClose={onCloseCampusGuide} />

      {/* 仅 debug 构建挂载；生产构建常量折叠后整棵子树被移除 */}
      {isDebugBuild && <MockIdentitySwitcher />}
    </>
  );
};

export default HomePageOverlays;
