import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import StudentAvatar from '@/components/student/StudentAvatar';

/**
 * StudentListCard — 全局学员卡片/列表行统一视觉
 *
 * 对齐意向学员 LeadCard：
 * - 头像：StudentAvatar（品牌图兜底，有 URL 则展示真实头像）
 * - 姓名：32rpx / semibold；昵称：24rpx muted，跟在姓名后
 * - 卡片：白底圆角 24rpx、p-28、gap-24、shadow-soft
 *
 * variant:
 * - card：列表页独立卡片（考勤异常 / 续费提醒）
 * - row：选择弹窗内行（消课选学员等）
 */

export interface StudentListCardProps {
  name: string;
  nickname?: string;
  avatarUrl?: string | null;
  /** 副标题（纯文本或自定义节点） */
  subtitle?: React.ReactNode;
  /** 姓名旁徽章 */
  badge?: React.ReactNode;
  /** 右侧操作区（电话按钮、勾选等） */
  right?: React.ReactNode;
  /** 卡片底部操作区 */
  footer?: React.ReactNode;
  /** 头像尺寸：card 默认 lg，row 默认 md */
  avatarSize?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'card' | 'row';
  selected?: boolean;
  className?: string;
  onClick?: () => void;
}

const StudentListCard: React.FC<StudentListCardProps> = ({
  name,
  nickname,
  avatarUrl,
  subtitle,
  badge,
  right,
  footer,
  avatarSize,
  variant = 'card',
  selected = false,
  className,
  onClick,
}) => {
  const resolvedAvatarSize = avatarSize ?? (variant === 'card' ? 'lg' : 'md');
  const isCard = variant === 'card';

  const nameRow = (
    <View className="flex items-center gap-[12rpx] min-w-0">
      <Text className="text-[32rpx] font-semibold text-foreground truncate">{name}</Text>
      {nickname ? (
        <Text className="text-[24rpx] text-muted-foreground truncate max-w-[180rpx]">
          {nickname}
        </Text>
      ) : null}
      {badge}
    </View>
  );

  const subtitleNode =
    subtitle == null ? null : typeof subtitle === 'string' ? (
      <Text className="text-[24rpx] text-muted-foreground">{subtitle}</Text>
    ) : (
      subtitle
    );

  return (
    <View
      className={cn(
        isCard
          ? 'bg-white rounded-[24rpx] p-[28rpx] shadow-soft press-scale'
          : cn(
              'flex flex-row items-center gap-[20rpx] px-[8rpx] py-[24rpx] border-b border-border/40',
              selected && 'bg-primary/5 rounded-[16rpx] border-transparent',
            ),
        className,
      )}
      onClick={onClick}
    >
      {isCard ? (
        <View className="flex gap-[24rpx]">
          <StudentAvatar name={name} src={avatarUrl || undefined} size={resolvedAvatarSize} />
          <View className="min-w-0 flex-1">
            <View className="flex items-center justify-between gap-[12rpx]">
              {nameRow}
              {right ? <View className="flex-shrink-0">{right}</View> : null}
            </View>
            {subtitleNode ? <View className="mt-[8rpx]">{subtitleNode}</View> : null}
          </View>
        </View>
      ) : (
        <>
          <StudentAvatar name={name} src={avatarUrl || undefined} size={resolvedAvatarSize} />
          <View className="min-w-0 flex-1 flex flex-col gap-[8rpx]">
            {nameRow}
            {subtitleNode}
          </View>
          {right ? <View className="flex-shrink-0">{right}</View> : null}
        </>
      )}
      {footer ? <View className="mt-[16rpx]">{footer}</View> : null}
    </View>
  );
};

export default StudentListCard;
