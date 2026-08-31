/**
 * TodoDetailPopover - 待办详情就近弹框
 *
 * 使用场景：首页 / 我的待办点击卡片；表单布局复用添加待办（custom-todo-popover-shared）。
 * 入场与添加弹框一致（快速 popover-in）；蒙层 catchMove 挡穿透，页面不得改 ScrollView scrollTop。
 *
 * 注意：内部 `visible` prop 绑定必须命名为 `isOpen`（勿改回 `visible`）。
 * 原因：生产构建中该模块若把解构出的绑定命名为 `visible`，会被构建管线错误地改写成
 * 未声明的 `_a_visible`（`!visible` 的 `!` 也会丢失），运行时抛
 * `ReferenceError: _a_visible is not defined`。实测 2026-08-26：改名为 `isOpen` 后
 * 产物干净；函数声明/箭头写法均不影响该问题。对外 prop 名保持 `visible` 不变。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DatePickerSheet from '@/components/DatePickerSheet';
import AddTodoCategorySheet from '@/components/my-todos/AddTodoCategorySheet';
import {
  CustomTodoCategoryHeader,
  CustomTodoTitleNoteFields,
  CustomTodoRemindSwitchRow,
  CustomTodoRemindDisplayRow,
  CustomTodoPriorityRow,
  CustomTodoCollaboratorsSection,
  CustomTodoCollaborationModeSection,
  POPOVER_MASK_STYLE,
  POPOVER_PANEL_STYLE,
} from '@/components/my-todos/custom-todo-popover-shared';
import TimePickerSheet from '@/components/TimePickerSheet';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useTeacherStore } from '@/stores';
import type { TodoCollaborationMode, TodoItem } from '@/types/home-todo';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { resolveTodoQuadrant } from '@/types/todo-quadrant';
import { useAuth } from '@/utils/auth';
import { isCustomTodoId } from '@/utils/custom-todos';
import { logError } from '@/utils/logger';
import { isStudentRechargeTodoId } from '@/utils/student-recharge-todo';
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

export interface TodoDetailSavePayload {
  title: string;
  note?: string;
  remindEnabled: boolean;
  remindDate?: string;
  remindTime?: string;
  quadrant?: TodoQuadrant;
  categoryId?: string;
  collaboratorIds?: string[];
  collaborationMode?: TodoCollaborationMode;
}

export interface TodoDetailPopoverProps {
  /** 对外 prop 名固定为 visible（内部绑定改名为 isOpen，规避构建期 _a_visible 命名冲突） */
  visible: boolean;
  item: TodoItem | null;
  categoryTabs: TodoCategoryTab[];
  collaboratorIds: string[];
  collaboratorSummaries: CollaboratorSummary[];
  onClose: () => void;
  onCreateCategory?: (name: string) => Promise<string | null | void>;
  onSave: (item: TodoItem, payload: TodoDetailSavePayload) => Promise<void>;
  onDelete?: (item: TodoItem) => Promise<void>;
}

interface DetailSnapshot {
  title: string;
  note: string;
  remindEnabled: boolean;
  remindDate: string;
  remindTime: string;
  quadrant: TodoQuadrant;
  categoryId: string;
  collaboratorIds: string[];
  collaborationMode: TodoCollaborationMode;
}

function buildSnapshotFromItem(item: TodoItem): DetailSnapshot {
  const at = item.remindAt ? dayjs(item.remindAt) : null;
  const hasValidRemind = Boolean(at && at.isValid() && item.remindEnabled !== false);
  return {
    title: item.title || '',
    note: item.note || item.desc || '',
    remindEnabled: hasValidRemind,
    remindDate: hasValidRemind && at ? at.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    remindTime:
      hasValidRemind && at ? at.format('HH:mm') : dayjs().add(30, 'minute').format('HH:mm'),
    quadrant: resolveTodoQuadrant({ quadrant: item.quadrant, level: item.level }),
    categoryId: item.todoCategoryId || TODO_CATEGORY_INBOX_ID,
    collaboratorIds: item.assigneeTeacherIds ? [...item.assigneeTeacherIds] : [],
    collaborationMode: item.collaborationMode || 'collaborative',
  };
}

function sameIdList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

function TodoDetailPopover({
  visible: isOpen,
  item,
  categoryTabs,
  collaboratorIds,
  collaboratorSummaries,
  onClose,
  onCreateCategory,
  onSave,
  onDelete,
}: TodoDetailPopoverProps) {
  const { profile } = useAuth();
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
  const [remindEditing, setRemindEditing] = useState(false);
  const [addCategoryVisible, setAddCategoryVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  /** 推迟挂载 Input，避免微信在 fixed 弹层插入 input 时把底层 ScrollView 推走 */
  const [formReady, setFormReady] = useState(false);
  const snapshotRef = useRef<DetailSnapshot | null>(null);
  const wasVisibleRef = useRef(false);

  const teachers = useTeacherStore((state) => state.teachers);
  const fetchTeachers = useTeacherStore((state) => state.fetchTeachers);

  const subSheetOpen = datePickerVisible || timePickerVisible || addCategoryVisible;
  const keyboardHeight = useKeyboardHeight(isOpen && !subSheetOpen);

  const isCustom = Boolean(item && (item.sourceType === 'custom' || isCustomTodoId(item.id)));
  /** 课时续费系统待办：允许改参与人 / 优先级并保存 */
  const isEditableSystemRecharge = Boolean(item && isStudentRechargeTodoId(item.id));
  const canSave = isCustom || isEditableSystemRecharge;
  const hasProcessUrl = Boolean(item?.url);

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

  /** E13-3：协作待办参与人可在此开启到时提醒 */
  const showCollabRemindBanner = useMemo(() => {
    if (!item || !isCustom) return false;
    if (!remindEnabled) return false;
    const participants = item.assigneeTeacherIds ?? collaboratorIds;
    if (participants.length === 0) return false;
    const uid = profile?.id;
    return Boolean(uid && participants.includes(uid));
  }, [item, isCustom, remindEnabled, collaboratorIds, profile?.id]);

  const handleCollabRemindAuth = useCallback(async () => {
    try {
      await subscribeMessageService.requestAuthAndReport(
        ['todo_remind', 'class_remind'],
        'collab_todo_entry',
      );
      Taro.showToast({ title: '已开启到时提醒', icon: 'none' });
    } catch (error) {
      logError('subscribe E13 collab todo auth', error);
    }
  }, []);

  useEffect(() => {
    const justOpened = isOpen && !wasVisibleRef.current;
    wasVisibleRef.current = isOpen;
    if (!justOpened || !item) return;

    const snap = buildSnapshotFromItem(item);
    snapshotRef.current = snap;
    setTitle(snap.title);
    setNote(snap.note);
    setRemindEnabled(snap.remindEnabled);
    setRemindDate(snap.remindDate);
    setRemindTime(snap.remindTime);
    setQuadrant(snap.quadrant);
    setCategoryId(snap.categoryId);
    setCollaborationMode(snap.collaborationMode);
    setRemindEditing(false);
    setCategoryMenuOpen(false);
    setAddCategoryVisible(false);
    setBusy(false);
    setFormReady(false);
  }, [isOpen, item]);

  useEffect(() => {
    if (!isOpen) {
      setFormReady(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setFormReady(true);
    }, 48);
    return () => window.clearTimeout(timer);
  }, [isOpen, item?.id]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchTeachers();
  }, [isOpen, fetchTeachers]);

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

  const remindDisplayText = useMemo(() => {
    if (!remindEnabled) return null;
    return `${dayjs(remindDate).format('YYYY-MM-DD')} ${remindTime}`;
  }, [remindDate, remindEnabled, remindTime]);

  const isDirty = useMemo(() => {
    const snap = snapshotRef.current;
    if (!snap) return false;
    if (isEditableSystemRecharge) {
      return (
        quadrant !== snap.quadrant ||
        collaborationMode !== snap.collaborationMode ||
        !sameIdList(collaboratorIds, snap.collaboratorIds)
      );
    }
    return (
      title.trim() !== snap.title.trim() ||
      note.trim() !== snap.note.trim() ||
      remindEnabled !== snap.remindEnabled ||
      (remindEnabled && remindDate !== snap.remindDate) ||
      (remindEnabled && remindTime !== snap.remindTime) ||
      quadrant !== snap.quadrant ||
      categoryId !== snap.categoryId ||
      collaborationMode !== snap.collaborationMode ||
      !sameIdList(collaboratorIds, snap.collaboratorIds)
    );
  }, [
    categoryId,
    collaborationMode,
    collaboratorIds,
    isEditableSystemRecharge,
    note,
    quadrant,
    remindDate,
    remindEnabled,
    remindTime,
    title,
  ]);

  /** 有链接且未编辑 → 去处理；否则保存 */
  const showProcessAction = hasProcessUrl && !isDirty;
  const primaryLabel = showProcessAction ? '去处理' : busy ? '保存中...' : '保存';

  const handleGoProcess = useCallback(() => {
    if (!item?.url) return;
    onClose();
    void Taro.navigateTo({ url: item.url }).catch(() => {
      Taro.showToast({ title: '无法打开处理页', icon: 'none' });
    });
  }, [item, onClose]);

  const handleSave = useCallback(async () => {
    if (!item || busy) return;
    if (!canSave) {
      Taro.showToast({ title: '系统待办暂不支持修改', icon: 'none' });
      return;
    }
    const trimmedTitle = title.trim();
    if (isCustom) {
      if (!trimmedTitle) {
        Taro.showToast({ title: '请填写标题', icon: 'none' });
        return;
      }
      if (trimmedTitle.length > 50) {
        Taro.showToast({ title: '标题不超过50字', icon: 'none' });
        return;
      }
    }

    setBusy(true);
    try {
      await onSave(item, {
        title: trimmedTitle || item.title,
        note: note.trim() || undefined,
        remindEnabled: isCustom ? remindEnabled : Boolean(item.remindEnabled !== false),
        remindDate: isCustom && remindEnabled ? remindDate : undefined,
        remindTime: isCustom && remindEnabled ? remindTime : undefined,
        quadrant,
        categoryId: isCustom ? categoryId : item.todoCategoryId,
        collaboratorIds: collaboratorIds.length > 0 ? collaboratorIds : [],
        collaborationMode: collaboratorIds.length > 0 ? collaborationMode : undefined,
      });
      snapshotRef.current = {
        title: trimmedTitle || item.title,
        note: note.trim(),
        remindEnabled,
        remindDate,
        remindTime,
        quadrant,
        categoryId,
        collaboratorIds: [...collaboratorIds],
        collaborationMode,
      };
      setRemindEditing(false);
      Taro.showToast({ title: '已保存', icon: 'success' });
      onClose();
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    canSave,
    categoryId,
    collaborationMode,
    collaboratorIds,
    isCustom,
    item,
    note,
    onClose,
    onSave,
    quadrant,
    remindDate,
    remindEnabled,
    remindTime,
    title,
  ]);

  const handlePrimary = useCallback(() => {
    if (showProcessAction) {
      handleGoProcess();
      return;
    }
    void handleSave();
  }, [handleGoProcess, handleSave, showProcessAction]);

  const handleDelete = useCallback(() => {
    if (!item || !onDelete || busy || !isCustom) return;
    Taro.showModal({
      title: '删除待办',
      content: `确定删除「${item.title}」？删除后不可恢复`,
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: (result) => {
        if (!result.confirm) return;
        setBusy(true);
        void onDelete(item)
          .then(() => {
            onClose();
            Taro.showToast({ title: '已删除', icon: 'success' });
          })
          .catch(() => {
            Taro.showToast({ title: '删除失败', icon: 'none' });
          })
          .finally(() => setBusy(false));
      },
    });
  }, [busy, isCustom, item, onClose, onDelete]);

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

  if (!isOpen || !item) return null;

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
                categoryLabel={isCustom ? categoryLabel : '课时续费'}
                categoryMenuOpen={isCustom ? categoryMenuOpen : false}
                categoryOptions={isCustom ? categoryOptions : []}
                categoryId={categoryId}
                onToggleMenu={
                  isCustom ? () => setCategoryMenuOpen((open) => !open) : () => undefined
                }
                onCloseMenu={() => setCategoryMenuOpen(false)}
                onSelectCategory={(id) => {
                  if (!isCustom) return;
                  setCategoryId(id);
                  setCategoryMenuOpen(false);
                }}
                onCreateCategory={isCustom && onCreateCategory ? handleOpenAddCategory : undefined}
                onClosePopover={onClose}
              />

              {isCustom && formReady ? (
                <CustomTodoTitleNoteFields
                  title={title}
                  note={note}
                  onTitleChange={setTitle}
                  onNoteChange={setNote}
                />
              ) : (
                <View className="rounded-[20rpx] border border-border bg-muted/30 px-[24rpx] py-[16rpx]">
                  <Text className="block text-[30rpx] font-semibold text-foreground">
                    {title || '待办标题'}
                  </Text>
                  <View className="my-[14rpx] h-[2rpx] bg-border" />
                  <Text className="block min-h-[108rpx] text-[26rpx] leading-[40rpx] text-muted-foreground">
                    {note || item.desc || '待办描述（选填）'}
                  </Text>
                </View>
              )}

              {isCustom && remindEditing ? (
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
              ) : (
                <CustomTodoRemindDisplayRow
                  displayText={remindDisplayText}
                  onEdit={isCustom ? () => setRemindEditing(true) : undefined}
                />
              )}

              <CustomTodoPriorityRow quadrant={quadrant} onChange={setQuadrant} />

              {showCollabRemindBanner ? (
                <View
                  className="mt-[20rpx] flex flex-row items-center justify-between rounded-[16rpx] bg-primary/8 px-[24rpx] py-[20rpx]"
                  onClick={() => void handleCollabRemindAuth()}
                >
                  <Text className="flex-1 text-[26rpx] text-foreground">
                    开启到时提醒，到点将通过微信通知你
                  </Text>
                  <Text className="text-[26rpx] font-medium text-primary">开启</Text>
                </View>
              ) : null}

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
                {isCustom && onDelete ? (
                  <View
                    className={cn(
                      'center h-[80rpx] flex-1 rounded-[16rpx] border border-destructive/30 bg-destructive-5 press-scale',
                      busy && 'opacity-60',
                    )}
                    onClick={busy ? undefined : handleDelete}
                  >
                    <Text className="text-[28rpx] font-medium text-destructive">删除</Text>
                  </View>
                ) : null}
                <View
                  className={cn(
                    'center h-[80rpx] flex-1 rounded-[16rpx] press-scale',
                    busy && !showProcessAction ? 'bg-muted' : 'bg-primary',
                    !canSave && !showProcessAction && 'opacity-60',
                  )}
                  onClick={busy ? undefined : handlePrimary}
                >
                  <Text className="text-[28rpx] font-semibold text-white">{primaryLabel}</Text>
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
}

export default TodoDetailPopover;
