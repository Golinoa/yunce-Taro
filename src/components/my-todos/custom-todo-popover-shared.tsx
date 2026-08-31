/**
 * 自定义待办弹框共享 UI
 *
 * 使用场景：AddCustomTodoPopover / TodoDetailPopover 共用分类、标题内容、提醒、优先级、参与人区块。
 */
import { View, Text, Textarea } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Avatar from '@/components/Avatar';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Switch from '@/components/Switch';
import TodoQuadrantIcon from '@/components/TodoQuadrantIcon';
import type { TodoCollaborationMode } from '@/types/home-todo';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { TODO_QUADRANT_META } from '@/types/todo-quadrant';
import type { CollaboratorSummary } from '@/utils/todo-collaborator-select';
import type { TodoCategoryTab } from '@/utils/todo-categories';

export const COLLABORATION_MODE_OPTIONS: {
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
export const PRIORITY_OPTIONS: TodoQuadrant[] = ['q4', 'q3', 'q2', 'q1'];

export const POPOVER_MASK_STYLE = { backgroundColor: 'rgba(0, 0, 0, 0.45)' } as const;
export const POPOVER_PANEL_STYLE = {
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: 'hsl(224, 90%, 60%)',
} as const;

export interface CustomTodoCategoryHeaderProps {
  categoryLabel: string;
  categoryMenuOpen: boolean;
  categoryOptions: TodoCategoryTab[];
  categoryId: string;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onSelectCategory: (id: string) => void;
  onCreateCategory?: () => void;
  onClosePopover: () => void;
}

/** 顶栏：分类下拉 + 关闭 */
export const CustomTodoCategoryHeader: React.FC<CustomTodoCategoryHeaderProps> = ({
  categoryLabel,
  categoryMenuOpen,
  categoryOptions,
  categoryId,
  onToggleMenu,
  onCloseMenu,
  onSelectCategory,
  onCreateCategory,
  onClosePopover,
}) => (
  <View className="relative mb-[20rpx] flex flex-row items-center justify-between">
    <View className="relative">
      <View
        className="flex flex-row items-center gap-[6rpx] rounded-full bg-muted px-[18rpx] py-[10rpx] press-scale"
        onClick={onToggleMenu}
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
          <View className="fixed inset-0 z-[96]" onClick={onCloseMenu} catchMove />
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
                  onClick={() => onSelectCategory(option.id)}
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
                  onClick={onCreateCategory}
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
      onClick={onClosePopover}
    >
      <Icon name="mdi-close" size="sm" color="muted" />
    </View>
  </View>
);

export interface CustomTodoTitleNoteFieldsProps {
  title: string;
  note: string;
  titleFocus?: boolean;
  onTitleChange: (value: string) => void;
  onNoteChange: (value: string) => void;
}

/** 标题 + 内容输入区 */
export const CustomTodoTitleNoteFields: React.FC<CustomTodoTitleNoteFieldsProps> = ({
  title,
  note,
  titleFocus = false,
  onTitleChange,
  onNoteChange,
}) => (
  <View className="rounded-[20rpx] border border-border bg-muted/30 px-[24rpx] py-[16rpx]">
    <FormInput
      variant="ghost"
      placeholder="待办标题"
      value={title}
      maxlength={50}
      focus={titleFocus}
      adjustPosition={false}
      onInput={(event) => onTitleChange(event.detail.value || '')}
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
      onInput={(event) => onNoteChange(event.detail.value || '')}
    />
  </View>
);

export interface CustomTodoRemindSwitchRowProps {
  remindEnabled: boolean;
  remindDate: string;
  remindTime: string;
  relativeLabel: string | null;
  remindDateLabel: string;
  onToggleRemind: (enabled: boolean) => void;
  onOpenDate: () => void;
  onOpenTime: () => void;
}

/** 添加态提醒行：开关 + 日期/时间 chip */
export const CustomTodoRemindSwitchRow: React.FC<CustomTodoRemindSwitchRowProps> = ({
  remindEnabled,
  remindTime,
  relativeLabel,
  remindDateLabel,
  onToggleRemind,
  onOpenDate,
  onOpenTime,
}) => (
  <View className="mt-[20rpx] flex flex-row items-center gap-[12rpx] rounded-[16rpx] border border-border bg-card px-[20rpx] py-[14rpx]">
    <Icon name="mdi-bell-outline" size="sm" color="primary" className="shrink-0" />
    <Text className="shrink-0 text-[26rpx] text-foreground">提醒</Text>
    {remindEnabled ? (
      <>
        <View
          className="todo-remind-chip flex min-w-0 flex-1 flex-row items-center justify-center gap-[6rpx] px-[12rpx] py-[8rpx] press-bg"
          onClick={onOpenDate}
        >
          <Icon name="mdi-calendar" size={16} color="primary" />
          <Text className="text-[22rpx] font-medium text-foreground">{remindDateLabel}</Text>
        </View>
        <View
          className="todo-remind-chip flex min-w-0 flex-1 flex-row items-center justify-center gap-[6rpx] px-[12rpx] py-[8rpx] press-bg"
          onClick={onOpenTime}
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
      <Switch checked={remindEnabled} onChange={onToggleRemind} />
    </View>
  </View>
);

export interface CustomTodoRemindDisplayRowProps {
  displayText: string | null;
  onEdit?: () => void;
}

/** 详情态提醒行：展示时间 + 编辑入口 */
export const CustomTodoRemindDisplayRow: React.FC<CustomTodoRemindDisplayRowProps> = ({
  displayText,
  onEdit,
}) => (
  <View className="mt-[20rpx] flex flex-row items-center gap-[12rpx] rounded-[16rpx] border border-border bg-card px-[20rpx] py-[14rpx]">
    <Icon name="mdi-bell-outline" size="sm" color="primary" className="shrink-0" />
    <Text className="shrink-0 text-[26rpx] text-foreground">提醒</Text>
    <Text className="min-w-0 flex-1 text-[26rpx] font-medium text-foreground">
      {displayText || '未设置'}
    </Text>
    {onEdit ? (
      <View
        className="shrink-0 flex flex-row items-center gap-[4rpx] rounded-full bg-muted px-[16rpx] py-[8rpx] press-scale"
        onClick={onEdit}
      >
        <Icon name="mdi-pencil" size={16} color="primary" />
        <Text className="text-[22rpx] font-medium text-primary">编辑</Text>
      </View>
    ) : null}
  </View>
);

export interface CustomTodoPriorityRowProps {
  quadrant: TodoQuadrant;
  onChange: (quadrant: TodoQuadrant) => void;
}

/** 优先级四选一 */
export const CustomTodoPriorityRow: React.FC<CustomTodoPriorityRowProps> = ({
  quadrant,
  onChange,
}) => (
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
            onClick={() => onChange(option)}
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
);

export interface CustomTodoCollaboratorsSectionProps {
  collaboratorIds: string[];
  selectedCollaborators: CollaboratorSummary[];
  onOpenAdd: () => void;
  onOpenView: () => void;
}

/** 参与人行（整行查看 / 加号追加） */
export const CustomTodoCollaboratorsSection: React.FC<CustomTodoCollaboratorsSectionProps> = ({
  collaboratorIds,
  selectedCollaborators,
  onOpenAdd,
  onOpenView,
}) => (
  <View className="mt-[20rpx]">
    <View
      className="rounded-[12rpx] py-[12rpx] press-bg"
      onClick={collaboratorIds.length === 0 ? onOpenAdd : onOpenView}
    >
      <View className="mb-[10rpx] flex flex-row items-center justify-between">
        <View className="flex min-w-0 flex-row items-center gap-[8rpx]">
          <Text className="text-[26rpx] text-foreground">参与人</Text>
          {collaboratorIds.length > 0 ? (
            <Text className="text-[24rpx] text-muted-foreground">{collaboratorIds.length}人</Text>
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
                    onOpenAdd();
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
);

export interface CustomTodoCollaborationModeSectionProps {
  collaborationMode: TodoCollaborationMode;
  onChange: (mode: TodoCollaborationMode) => void;
}

/** 完成方式（有参与人时） */
export const CustomTodoCollaborationModeSection: React.FC<
  CustomTodoCollaborationModeSectionProps
> = ({ collaborationMode, onChange }) => (
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
            onClick={() => onChange(option.value)}
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
);
