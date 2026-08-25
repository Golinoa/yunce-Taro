/**
 * 待办参与人选择页 — 共享导航、列表行与身份标签
 *
 * 使用场景：添加参与人 / 查看参与人全屏页统一设计语言。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import { IDENTITY_TAG_MAP, TEACHER_IDENTITY_OPTIONS } from '@/data/teacher';
import type { TeacherIdentity } from '@/types/teacher';
import { useMiniProgramNavBarLayout } from '@/utils/use-nav-safe-height';
import type { CollaboratorSummary } from '@/utils/todo-collaborator-select';

const DEFAULT_IDENTITY: TeacherIdentity = 'teacher';

/** 列表行展示所需的最小教师字段 */
export interface CollaboratorDisplayInfo {
  id: string;
  name: string;
  avatar?: string;
  subject?: string;
  identity?: TeacherIdentity;
  roleText?: string;
}

export function collaboratorSummaryToDisplay(summary: CollaboratorSummary): CollaboratorDisplayInfo {
  return {
    id: summary.id,
    name: summary.name,
    avatar: summary.avatar,
    subject: summary.subject,
    identity: summary.identity,
    roleText: summary.roleText,
  };
}

export function resolveTeacherIdentityMeta(teacher: CollaboratorDisplayInfo) {
  const identity = teacher.identity ?? DEFAULT_IDENTITY;
  const label =
    TEACHER_IDENTITY_OPTIONS.find((option) => option.value === identity)?.label ||
    teacher.roleText ||
    '老师';
  const tag = IDENTITY_TAG_MAP[identity] ?? IDENTITY_TAG_MAP.teacher;
  return { label, tag };
}

/** 参与人列表统一头像（添加/查看页一致：图片优先，无图用姓氏色块） */
export const TodoCollaboratorListAvatar: React.FC<{
  teacher: CollaboratorDisplayInfo;
  className?: string;
}> = ({ teacher, className }) => (
  <Avatar
    name={teacher.name}
    avatarUrl={teacher.avatar}
    size="sm"
    fallback="initial"
    className={cn('shrink-0', className)}
  />
);

export interface TodoCollaboratorNavBarProps {
  title: string;
  onCancel: () => void;
}

/** 与微信原生导航栏同行的顶栏：左侧取消 + 居中标题 */
export const TodoCollaboratorNavBar: React.FC<TodoCollaboratorNavBarProps> = ({
  title,
  onCancel,
}) => {
  const { statusBarHeight, navBarHeight, navPaddingRight } = useMiniProgramNavBarLayout();

  return (
    <View
      className="shrink-0 border-b border-border bg-card"
      style={{ paddingTop: `${statusBarHeight}px` }}
    >
      <View
        className="relative flex items-center justify-center"
        style={{
          height: `${navBarHeight}px`,
          paddingRight: `${navPaddingRight}px`,
        }}
      >
        <View
          className="absolute left-[12px] z-[1] flex h-full items-center px-[4px] press-bg"
          onClick={onCancel}
        >
          <Text className="text-[30rpx] text-foreground">取消</Text>
        </View>
        <Text
          className="w-full text-center text-[32rpx] font-semibold text-foreground"
          style={{ paddingLeft: `${navPaddingRight}px` }}
        >
          {title}
        </Text>
      </View>
    </View>
  );
};

export interface TodoCollaboratorBottomActionProps {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

/** 底部主操作按钮（确定 / 完成） */
export const TodoCollaboratorBottomAction: React.FC<TodoCollaboratorBottomActionProps> = ({
  label,
  disabled = false,
  onClick,
}) => (
  <View className="shrink-0 border-t border-border-light bg-card px-[32rpx] pt-[20rpx] pb-safe-bar">
    <View
      className={cn(
        'center h-[88rpx] rounded-[16rpx] press-scale',
        disabled ? 'bg-muted' : 'bg-primary',
      )}
      onClick={disabled ? undefined : onClick}
    >
      <Text
        className={cn(
          'text-[30rpx] font-semibold',
          disabled ? 'text-muted-foreground' : 'text-white',
        )}
      >
        {label}
      </Text>
    </View>
  </View>
);

export interface TodoCollaboratorSelectRowProps {
  teacher: CollaboratorDisplayInfo;
  checked: boolean;
  onToggle: () => void;
}

/** 添加页 — 左侧勾选 + 头像 + 姓名(科目) + 身份标签 */
export const TodoCollaboratorSelectRow: React.FC<TodoCollaboratorSelectRowProps> = ({
  teacher,
  checked,
  onToggle,
}) => {
  const identityMeta = resolveTeacherIdentityMeta(teacher);

  return (
    <View
      className="flex flex-row items-center border-b border-border/40 py-[22rpx] press-bg"
      onClick={onToggle}
    >
      <View
        className={cn(
          'mr-[20rpx] flex h-[44rpx] w-[44rpx] shrink-0 items-center justify-center rounded-full border-[3rpx] border-solid',
          checked ? 'border-primary bg-primary' : 'border-border bg-card',
        )}
      >
        {checked ? <Icon name="mdi-check" size={22} color="#fff" /> : null}
      </View>
      <TodoCollaboratorListAvatar teacher={teacher} />
      <View className="ml-[16rpx] min-w-0 flex-1 flex-row items-center overflow-hidden">
        <Text className="shrink-0 text-[30rpx] font-medium text-foreground">{teacher.name}</Text>
        {teacher.subject ? (
          <Text className="ml-[8rpx] truncate text-[24rpx] text-muted-foreground">
            ({teacher.subject})
          </Text>
        ) : null}
      </View>
      <View className={cn('ml-[12rpx] shrink-0 rounded-tag px-[12rpx] py-[4rpx]', identityMeta.tag.bg)}>
        <Text className={cn('text-[22rpx] font-medium', identityMeta.tag.text)}>
          {identityMeta.label}
        </Text>
      </View>
    </View>
  );
};

export interface TodoCollaboratorViewRowProps {
  teacher: CollaboratorDisplayInfo;
  onRemove: () => void;
}

/** 查看页 — 头像 + 姓名 + 右侧移除（与添加页列表行头像/字号对齐） */
export const TodoCollaboratorViewRow: React.FC<TodoCollaboratorViewRowProps> = ({
  teacher,
  onRemove,
}) => (
  <View className="flex flex-row items-center py-[22rpx]">
    <TodoCollaboratorListAvatar teacher={teacher} />
    <Text className="ml-[16rpx] min-w-0 flex-1 truncate text-[30rpx] font-medium text-foreground">
      {teacher.name}
    </Text>
    <View
      className="ml-[16rpx] flex h-[48rpx] w-[48rpx] shrink-0 items-center justify-center press-bg"
      onClick={onRemove}
    >
      <Icon name="mdi-close" size={20} color="muted" />
    </View>
  </View>
);
