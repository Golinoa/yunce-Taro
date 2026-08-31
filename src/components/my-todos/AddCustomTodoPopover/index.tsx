/**
 * AddCustomTodoPopover - 创建待办就近弹框
 *
 * 使用场景：首页待办 FAB / 我的待办页 FAB；表单区块与详情弹框共用 custom-todo-popover-shared。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DatePickerSheet from '@/components/DatePickerSheet';
import AddTodoCategorySheet from '@/components/my-todos/AddTodoCategorySheet';
import {
  CustomTodoCategoryHeader,
  CustomTodoTitleNoteFields,
  CustomTodoRemindSwitchRow,
  CustomTodoPriorityRow,
  CustomTodoCollaboratorsSection,
  CustomTodoCollaborationModeSection,
  POPOVER_MASK_STYLE,
  POPOVER_PANEL_STYLE,
} from '@/components/my-todos/custom-todo-popover-shared';
import TimePickerSheet from '@/components/TimePickerSheet';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { subscribeMessageService } from '@/services';
import { useTeacherStore } from '@/stores';
import type { TodoCollaborationMode } from '@/types/home-todo';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { logError } from '@/utils/logger';
import {
  TODO_CATEGORY_ALL_ID,
  TODO_CATEGORY_INBOX_ID,
  type TodoCategoryTab,
} from '@/utils/todo-categories';
import {
  openTodoCollaboratorAddPage,
  openTodoCollaboratorViewPage,
  mergeCollaboratorSummaries,
  type CollaboratorSummary,
} from '@/utils/todo-collaborator-select';

export interface AddCustomTodoPopoverProps {
  visible: boolean;
  categoryTabs: TodoCategoryTab[];
  defaultCategoryId?: string;
  defaultQuadrant?: TodoQuadrant;
  collaboratorIds: string[];
  collaboratorSummaries: CollaboratorSummary[];
  onClose: () => void;
  /** 新建分类，成功返回新分类 id */
  onCreateCategory?: (name: string) => Promise<string | null | void>;
  onSubmit: (payload: {
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
}

const AddCustomTodoPopover: React.FC<AddCustomTodoPopoverProps> = ({
  visible,
  categoryTabs,
  defaultCategoryId,
  defaultQuadrant,
  collaboratorIds,
  collaboratorSummaries,
  onClose,
  onCreateCategory,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [remindEnabled, setRemindEnabled] = useState(true);
  const [remindDate, setRemindDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [remindTime, setRemindTime] = useState(dayjs().add(30, 'minute').format('HH:mm'));
  const [quadrant, setQuadrant] = useState<TodoQuadrant>('q4');
  const [categoryId, setCategoryId] = useState(TODO_CATEGORY_INBOX_ID);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [collaborationMode, setCollaborationMode] =
    useState<TodoCollaborationMode>('collaborative');
  const [addCategoryVisible, setAddCategoryVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [titleFocus, setTitleFocus] = useState(false);
  const teachers = useTeacherStore((state) => state.teachers);
  const fetchTeachers = useTeacherStore((state) => state.fetchTeachers);
  const wasVisibleRef = useRef(false);

  const subSheetOpen = datePickerVisible || timePickerVisible || addCategoryVisible;
  const keyboardHeight = useKeyboardHeight(visible && !subSheetOpen);

  const categoryOptions = useMemo(
    () => categoryTabs.filter((tab) => tab.id !== TODO_CATEGORY_ALL_ID),
    [categoryTabs],
  );

  const categoryLabel = useMemo(() => {
    return categoryOptions.find((tab) => tab.id === categoryId)?.name || '收件箱';
  }, [categoryId, categoryOptions]);

  const selectedCollaborators = useMemo(
    () => mergeCollaboratorSummaries(collaboratorIds, collaboratorSummaries, teachers),
    [collaboratorIds, collaboratorSummaries, teachers],
  );

  useEffect(() => {
    const justOpened = visible && !wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!justOpened) return;

    const resolvedCategory =
      defaultCategoryId && defaultCategoryId !== TODO_CATEGORY_ALL_ID
        ? defaultCategoryId
        : TODO_CATEGORY_INBOX_ID;
    setTitle('');
    setNote('');
    setRemindEnabled(true);
    setRemindDate(dayjs().format('YYYY-MM-DD'));
    setRemindTime(dayjs().add(30, 'minute').format('HH:mm'));
    setQuadrant(defaultQuadrant ?? 'q4');
    setCategoryId(resolvedCategory);
    setCategoryMenuOpen(false);
    setCollaborationMode('collaborative');
    setAddCategoryVisible(false);
    setSubmitting(false);
    setTitleFocus(false);
    window.setTimeout(() => setTitleFocus(true), 320);
  }, [visible, defaultCategoryId, defaultQuadrant]);

  useEffect(() => {
    if (!visible) return;
    void fetchTeachers();
  }, [visible, fetchTeachers]);

  useEffect(() => {
    if (collaboratorIds.length === 0) {
      setCollaborationMode('collaborative');
    }
  }, [collaboratorIds.length]);

  const remindDateTime = useMemo(
    () => dayjs(`${remindDate} ${remindTime}`),
    [remindDate, remindTime],
  );

  const relativeLabel = useMemo(() => {
    if (!remindEnabled) return null;
    const diffMin = remindDateTime.diff(dayjs(), 'minute');
    if (diffMin <= 0) return '已到提醒时间';
    if (diffMin < 60) return `${diffMin}分钟后`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour}小时后`;
  }, [remindDateTime, remindEnabled]);

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Taro.showToast({ title: '请填写标题', icon: 'none' });
      return;
    }
    if (trimmedTitle.length > 50) {
      Taro.showToast({ title: '标题不超过50字', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      // E12：开启提醒时，保存前先申请订阅授权（失败不阻断建待办）
      if (remindEnabled) {
        try {
          await subscribeMessageService.runFlow('E12');
        } catch (error) {
          logError('subscribe E12 before custom todo', error);
        }
      }
      await onSubmit({
        title: trimmedTitle,
        note: note.trim() || undefined,
        remindEnabled,
        remindDate: remindEnabled ? remindDate : undefined,
        remindTime: remindEnabled ? remindTime : undefined,
        quadrant,
        categoryId,
        collaboratorIds: collaboratorIds.length > 0 ? collaboratorIds : undefined,
        collaborationMode: collaboratorIds.length > 0 ? collaborationMode : undefined,
      });
      onClose();
    } catch {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    categoryId,
    collaboratorIds,
    collaborationMode,
    note,
    onClose,
    onSubmit,
    quadrant,
    remindDate,
    remindEnabled,
    remindTime,
    title,
  ]);

  const handleOpenAddCollaborators = useCallback(() => {
    openTodoCollaboratorAddPage(collaboratorIds, selectedCollaborators);
  }, [collaboratorIds, selectedCollaborators]);

  const handleOpenViewCollaborators = useCallback(() => {
    if (collaboratorIds.length === 0) return;
    openTodoCollaboratorViewPage(collaboratorIds, selectedCollaborators);
  }, [collaboratorIds, selectedCollaborators]);

  const handleOpenAddCategory = useCallback(() => {
    setCategoryMenuOpen(false);
    setAddCategoryVisible(true);
  }, []);

  const handleAddCategorySubmit = useCallback(
    async (name: string) => {
      if (!onCreateCategory) return;
      const createdId = await onCreateCategory(name);
      if (createdId) {
        setCategoryId(createdId);
      }
    },
    [onCreateCategory],
  );

  if (!visible) return null;

  return (
    <>
      {!subSheetOpen ? (
        <>
          <View
            className="fixed inset-0 z-[300]"
            style={POPOVER_MASK_STYLE}
            onClick={onClose}
            catchMove
          />
          <View
            className={cn(
              'fixed left-[24rpx] right-[24rpx] z-[310]',
              keyboardHeight === 0 && 'bottom-[calc(148rpx+env(safe-area-inset-bottom))]',
              'rounded-[24rpx] bg-card shadow-popup animate-popover-in',
            )}
            style={{
              ...POPOVER_PANEL_STYLE,
              ...(keyboardHeight > 0 ? { bottom: `${keyboardHeight}px` } : {}),
            }}
          >
            <View className="px-[40rpx] pt-[28rpx] pb-[calc(28rpx+env(safe-area-inset-bottom))]">
              <CustomTodoCategoryHeader
                categoryLabel={categoryLabel}
                categoryMenuOpen={categoryMenuOpen}
                categoryOptions={categoryOptions}
                categoryId={categoryId}
                onToggleMenu={() => setCategoryMenuOpen((open) => !open)}
                onCloseMenu={() => setCategoryMenuOpen(false)}
                onSelectCategory={(id) => {
                  setCategoryId(id);
                  setCategoryMenuOpen(false);
                }}
                onCreateCategory={onCreateCategory ? handleOpenAddCategory : undefined}
                onClosePopover={onClose}
              />

              <CustomTodoTitleNoteFields
                title={title}
                note={note}
                titleFocus={titleFocus}
                onTitleChange={setTitle}
                onNoteChange={setNote}
              />

              <CustomTodoRemindSwitchRow
                remindEnabled={remindEnabled}
                remindDate={remindDate}
                remindTime={remindTime}
                relativeLabel={relativeLabel}
                remindDateLabel={dayjs(remindDate).format('MM-DD')}
                onToggleRemind={setRemindEnabled}
                onOpenDate={() => setDatePickerVisible(true)}
                onOpenTime={() => setTimePickerVisible(true)}
              />

              <CustomTodoPriorityRow quadrant={quadrant} onChange={setQuadrant} />

              <CustomTodoCollaboratorsSection
                collaboratorIds={collaboratorIds}
                selectedCollaborators={selectedCollaborators}
                onOpenAdd={handleOpenAddCollaborators}
                onOpenView={handleOpenViewCollaborators}
              />

              {collaboratorIds.length > 0 ? (
                <CustomTodoCollaborationModeSection
                  collaborationMode={collaborationMode}
                  onChange={setCollaborationMode}
                />
              ) : null}

              <View className="mt-[28rpx] flex flex-row gap-[20rpx]">
                <View
                  className="flex-1 h-[80rpx] rounded-[16rpx] bg-muted center press-scale"
                  onClick={onClose}
                >
                  <Text className="text-[28rpx] font-medium text-foreground">取消</Text>
                </View>
                <View
                  className={cn(
                    'flex-1 h-[80rpx] rounded-[16rpx] center press-scale',
                    submitting ? 'bg-muted' : 'bg-primary',
                  )}
                  onClick={submitting ? undefined : handleSubmit}
                >
                  <Text className="text-[28rpx] font-semibold text-white">
                    {submitting ? '保存中...' : '保存'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </>
      ) : null}

      <DatePickerSheet
        visible={datePickerVisible}
        value={remindDate}
        title="选择提醒日期"
        onClose={() => setDatePickerVisible(false)}
        onConfirm={setRemindDate}
      />

      <TimePickerSheet
        visible={timePickerVisible}
        value={remindTime}
        title="选择提醒时间"
        onClose={() => setTimePickerVisible(false)}
        onConfirm={setRemindTime}
      />

      <AddTodoCategorySheet
        visible={addCategoryVisible}
        onClose={() => setAddCategoryVisible(false)}
        onSubmit={handleAddCategorySubmit}
      />
    </>
  );
};

export default AddCustomTodoPopover;
