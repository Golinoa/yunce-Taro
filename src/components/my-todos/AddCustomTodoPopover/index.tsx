/**
 * AddCustomTodoPopover - 创建待办就近弹框
 *
 * 使用场景：首页待办 FAB / 我的待办页 FAB；在按钮附近弹出带主题色边框的轻量表单，
 * 支持分类、优先级、提醒、协作人（@员工）等字段。
 */
import { View, Text, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import DatePickerSheet from '@/components/DatePickerSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import AddTodoCategorySheet from '@/components/my-todos/AddTodoCategorySheet';
import Switch from '@/components/Switch';
import TimePickerSheet from '@/components/TimePickerSheet';
import TodoQuadrantIcon from '@/components/TodoQuadrantIcon';
import { useTeacherStore } from '@/stores';
import type { TodoCollaborationMode } from '@/types/home-todo';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { TODO_QUADRANT_META } from '@/types/todo-quadrant';
import {
  openTodoCollaboratorAddPage,
  openTodoCollaboratorViewPage,
  mergeCollaboratorSummaries,
  type CollaboratorSummary,
} from '@/utils/todo-collaborator-select';
import {
  TODO_CATEGORY_ALL_ID,
  TODO_CATEGORY_INBOX_ID,
  type TodoCategoryTab,
} from '@/utils/todo-categories';

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

const COLLABORATION_MODE_OPTIONS: {
  value: TodoCollaborationMode;
  label: string;
  desc: string;
}[] = [
  {
    value: 'collaborative',
    label: '协同完成',
    desc: '一人完成即可，任务结束',
  },
  {
    value: 'individual',
    label: '各自完成',
    desc: '每位成员均需独立完成',
  },
];

/** 优先级展示顺序：普通 → 紧急 */
const PRIORITY_OPTIONS: TodoQuadrant[] = ['q4', 'q3', 'q2', 'q1'];

/** 全屏蒙层 + 主题色边框（小程序内联 style 更稳定） */
const POPOVER_MASK_STYLE = { backgroundColor: 'rgba(0, 0, 0, 0.45)' } as const;
const POPOVER_PANEL_STYLE = {
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: 'hsl(224, 90%, 60%)',
} as const;

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
  const [collaborationMode, setCollaborationMode] = useState<TodoCollaborationMode>('collaborative');
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
              <View className="relative mb-[20rpx] flex flex-row items-center justify-between">
            <View className="relative">
              <View
                className="flex flex-row items-center gap-[6rpx] rounded-full bg-muted px-[18rpx] py-[10rpx] press-scale"
                onClick={() => setCategoryMenuOpen((open) => !open)}
              >
                <Text className="text-[26rpx] font-medium text-foreground">{categoryLabel}</Text>
                <Icon
                  name={categoryMenuOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                  size="sm"
                  color="muted"
                />
              </View>
              {categoryMenuOpen ? (
                <>
                  <View
                    className="fixed inset-0 z-[96]"
                    onClick={() => setCategoryMenuOpen(false)}
                    catchMove
                  />
                  <View className="absolute left-0 top-full z-[97] mt-[8rpx] min-w-[220rpx] overflow-hidden rounded-[16rpx] border border-border bg-card shadow-float">
                    {categoryOptions.map((option) => {
                      const active = categoryId === option.id;
                      return (
                        <View
                          key={option.id}
                          className={cn(
                            'flex flex-row items-center justify-between px-[24rpx] py-[18rpx] press-bg',
                            active && 'bg-primary-10',
                          )}
                          onClick={() => {
                            setCategoryId(option.id);
                            setCategoryMenuOpen(false);
                          }}
                        >
                          <Text
                            className={cn(
                              'text-[26rpx]',
                              active ? 'font-semibold text-primary' : 'text-foreground',
                            )}
                          >
                            {option.name}
                          </Text>
                          {active ? <Icon name="mdi-check" size={18} color="primary" /> : null}
                        </View>
                      );
                    })}
                    {onCreateCategory ? (
                      <View className="border-t border-border">
                        <View
                          className="flex flex-row items-center gap-[8rpx] px-[24rpx] py-[18rpx] press-bg"
                          onClick={handleOpenAddCategory}
                        >
                          <Icon name="mdi-plus" size="sm" color="primary" />
                          <Text className="text-[26rpx] font-medium text-primary">新建分类</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
            <View
              className="flex h-[48rpx] w-[48rpx] items-center justify-center rounded-full press-bg"
              onClick={onClose}
            >
              <Icon name="mdi-close" size="sm" color="muted" />
            </View>
              </View>

              <View className="rounded-[20rpx] border border-border bg-muted/30 px-[24rpx] py-[16rpx]">
            <FormInput
              variant="ghost"
              placeholder="待办标题"
              value={title}
              maxlength={50}
              focus={titleFocus}
              adjustPosition={false}
              onInput={(event) => setTitle(event.detail.value || '')}
              inputClassName="text-[30rpx] font-semibold w-full"
              inputStyle={{ textAlign: 'left', height: '40rpx', minHeight: '40rpx' }}
              className="mb-0"
            />
                <View className="my-[14rpx] h-[2rpx] bg-border" />
                <Textarea
                  className="box-border h-[108rpx] min-h-[108rpx] max-h-[108rpx] w-full text-[26rpx] leading-[40rpx] text-foreground"
              placeholder="待办描述（选填）"
              placeholderClass="text-muted-foreground"
              maxlength={200}
              autoHeight={false}
              adjustPosition={false}
              value={note}
              onInput={(event) => setNote(event.detail.value || '')}
            />
              </View>

              <View className="mt-[20rpx] flex flex-row items-center gap-[12rpx] rounded-[16rpx] border border-border bg-card px-[20rpx] py-[14rpx]">
            <Icon name="mdi-bell-outline" size="sm" color="primary" className="shrink-0" />
            <Text className="shrink-0 text-[26rpx] text-foreground">提醒</Text>
            {remindEnabled ? (
              <>
                <View
                  className="todo-remind-chip flex min-w-0 flex-1 flex-row items-center justify-center gap-[6rpx] px-[12rpx] py-[8rpx] press-bg"
                  onClick={() => setDatePickerVisible(true)}
                >
                  <Icon name="mdi-calendar" size={16} color="primary" />
                  <Text className="text-[22rpx] font-medium text-foreground">
                    {dayjs(remindDate).format('MM-DD')}
                  </Text>
                </View>
                <View
                  className="todo-remind-chip flex min-w-0 flex-1 flex-row items-center justify-center gap-[6rpx] px-[12rpx] py-[8rpx] press-bg"
                  onClick={() => setTimePickerVisible(true)}
                >
                  <Icon name="mdi-clock-outline" size={16} color="primary" />
                  <Text className="text-[22rpx] font-medium text-foreground">{remindTime}</Text>
                </View>
                {relativeLabel ? (
                  <Text className="shrink-0 text-[20rpx] text-warning">{relativeLabel}</Text>
                ) : null}
              </>
            ) : null}
            <View className="ml-auto shrink-0">
              <Switch checked={remindEnabled} onChange={setRemindEnabled} />
            </View>
              </View>

              <View className="mt-[20rpx]">
                <Text className="mb-[12rpx] text-[22rpx] text-muted-foreground">优先级</Text>
                <View className="flex flex-row gap-[10rpx]">
              {PRIORITY_OPTIONS.map((option) => {
                const active = quadrant === option;
                return (
                  <View
                    key={option}
                    className={cn(
                      'relative flex flex-1 flex-row items-center justify-center gap-[4rpx] rounded-full border px-[8rpx] py-[10rpx] press-scale',
                      active
                        ? 'border-primary bg-primary-10 shadow-soft'
                        : 'border-borderLight bg-muted shadow-soft',
                    )}
                    onClick={() => setQuadrant(option)}
                  >
                    {active ? (
                      <View className="absolute -right-[2rpx] -top-[2rpx]">
                        <Icon name="mdi-check-circle" size={14} color="primary" />
                      </View>
                    ) : null}
                    <Text
                      className={cn(
                        'shrink-0 text-[20rpx] leading-none',
                        active ? 'font-semibold text-primary' : 'font-medium text-foregroundSecondary',
                      )}
                    >
                      {TODO_QUADRANT_META[option].shortLabel}
                    </Text>
                    <View className="scale-75 origin-center">
                      <TodoQuadrantIcon quadrant={option} size="sm" />
                    </View>
                  </View>
                );
              })}
                </View>
              </View>

              <View className="mt-[20rpx]">
                <View
                  className="rounded-[12rpx] py-[12rpx] press-bg"
                  onClick={
                    collaboratorIds.length === 0
                      ? handleOpenAddCollaborators
                      : handleOpenViewCollaborators
                  }
                >
                  <View className="mb-[10rpx] flex flex-row items-center justify-between">
                    <View className="flex min-w-0 flex-row items-center gap-[8rpx]">
                      <Text className="text-[26rpx] text-foreground">参与人</Text>
                      {collaboratorIds.length > 0 ? (
                        <Text className="text-[24rpx] text-muted-foreground">
                          {collaboratorIds.length}人
                        </Text>
                      ) : null}
                    </View>
                    <Icon name="mdi-chevron-right" size="sm" color="muted" />
                  </View>
                  <View className="flex flex-row items-center">
                    <View className="flex shrink-0 flex-row items-center">
                      {selectedCollaborators.slice(0, 4).map((teacher, index) => (
                        <View
                          key={teacher.id}
                          className={cn('relative shrink-0', index > 0 && '-ml-[12rpx]')}
                        >
                          <Avatar
                            name={teacher.name}
                            avatarUrl={teacher.avatar}
                            size="sm"
                            className="border-2 border-card"
                          />
                        </View>
                      ))}
                      <View
                        className={cn(
                          'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted press-scale',
                          selectedCollaborators.length > 0 && '-ml-[12rpx]',
                        )}
                        onClick={
                          collaboratorIds.length > 0
                            ? (event) => {
                                event.stopPropagation?.();
                                handleOpenAddCollaborators();
                              }
                            : undefined
                        }
                      >
                        <Icon name="mdi-plus" size={22} color="muted" />
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {collaboratorIds.length > 0 ? (
                <View className="mt-[16rpx]">
                  <Text className="mb-[12rpx] text-[22rpx] text-muted-foreground">完成方式</Text>
                  <View className="overflow-hidden rounded-[16rpx] border border-border bg-card">
                    {COLLABORATION_MODE_OPTIONS.map((option, index) => {
                      const active = collaborationMode === option.value;
                      return (
                        <View
                          key={option.value}
                          className={cn(
                            'flex flex-row items-start gap-[16rpx] px-[20rpx] py-[18rpx] press-bg',
                            index > 0 && 'border-t border-border',
                          )}
                          onClick={() => setCollaborationMode(option.value)}
                        >
                          <View
                            className={cn(
                              'mt-[4rpx] flex h-[36rpx] w-[36rpx] shrink-0 items-center justify-center rounded-full border-[3rpx] border-solid',
                              active
                                ? 'border-primary bg-primary'
                                : 'border-mutedForeground bg-card shadow-soft',
                            )}
                          >
                            {active ? <Icon name="mdi-check" size={18} color="white" /> : null}
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text
                              className={cn(
                                'block text-[26rpx] font-medium leading-snug',
                                active ? 'text-foreground' : 'text-foregroundSecondary',
                              )}
                            >
                              {option.label}
                            </Text>
                            <Text className="mt-[6rpx] block text-[22rpx] leading-snug text-muted-foreground">
                              {option.desc}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
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
