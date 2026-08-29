import { View, Text, Image, Button } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import ClassAvatar from '@/components/class/ClassAvatar';
import Icon from '@/components/Icon';
import { BRAND_LOGO } from '@/constants/brand';

/**
 * ScheduleCard - 排课卡片展示组件
 *
 * 班课布局：
 * - 顶栏：班级名 + 状态标签（仅「上课中」「试听」两种）/ 时段
 * - 右上角：分享（对齐团课）
 * - 信息行：老师(+助教) · 人数 · 教室 | 右侧点名/补录
 * - 分割线下方：圆形头像 + 约试听
 */

export interface ScheduleCardStudentAvatar {
  id: string;
  name: string;
  avatar?: string;
}

export interface ScheduleCardItem {
  id: string;
  classId?: string;
  className: string;
  startTime: string;
  endTime: string;
  leadTeacherName: string;
  assistantTeacherName?: string;
  note?: string;
  room?: string;
  checkedCount: number;
  totalCount: number;
  status: 'urgent' | 'upcoming' | 'active' | 'done' | 'ended' | 'cancelled';
  countdownText?: string;
  bookingTag?: string;
  hasTrialStudent?: boolean;
  canCancelLesson: boolean;
  isTemporaryAdjusted?: boolean;
  campusId?: string;
  students?: ScheduleCardStudentAvatar[];
}

export interface ScheduleCardProps {
  item: ScheduleCardItem;
  /** 卡片点击回调 */
  onClick?: (item: ScheduleCardItem) => void;
  /** 信息行最右侧操作（点名 / 补录） */
  metaAction?: React.ReactNode;
  /** 分割线下方右侧操作（约试听） */
  footerAction?: React.ReactNode;
  /** 是否展示头像行（默认有学员或 footerAction 时展示） */
  showStudentRow?: boolean;
  /** 右上角分享：点击后由页面 useShareAppMessage 读取上下文 */
  onSharePrepare?: (item: ScheduleCardItem) => void;
  /** 是否展示分享按钮 */
  showShare?: boolean;
  /** 右上角更多菜单（优先于分享按钮） */
  menu?: React.ReactNode;
  /** 额外类名 */
  className?: string;
  /** @deprecated 使用 metaAction / footerAction */
  children?: React.ReactNode;
}

const MAX_VISIBLE_AVATARS = 5;

const ScheduleCard: React.FC<ScheduleCardProps> = ({
  item,
  onClick,
  metaAction,
  footerAction,
  showStudentRow,
  onSharePrepare,
  showShare,
  menu,
  className,
  children,
}) => {
  const isActive = item.status === 'active';
  const students = item.students || [];
  const shouldShowStudentRow =
    showStudentRow ?? (Boolean(footerAction) || students.length > 0);
  const teacherLabel = item.assistantTeacherName
    ? `${item.leadTeacherName} / ${item.assistantTeacherName}`
    : item.leadTeacherName;
  const countLabel = item.totalCount > 0 ? `${item.checkedCount}/${item.totalCount}` : '0/0';
  const showTopActions = Boolean(menu) || Boolean(showShare);

  return (
    <View
      className={cn(
        'relative rounded-[14rpx] bg-card px-[24rpx] py-[22rpx] shadow-card',
        className,
      )}
      onClick={() => onClick?.(item)}
    >
      {item.status === 'cancelled' ? (
        <View className="absolute right-0 top-0 overflow-hidden rounded-tr-[14rpx]">
          <View className="rounded-bl-[16rpx] bg-destructive px-[20rpx] py-[10rpx] shadow-card">
            <Text className="text-[20rpx] font-semibold tracking-[2rpx] text-destructive-foreground">
              取消
            </Text>
          </View>
        </View>
      ) : null}

      {!menu && showTopActions && item.status !== 'cancelled' ? (
        <View className="absolute right-[8rpx] top-[8rpx] z-10 flex items-center">
          {showShare ? (
            <Button
              className="flex h-[48rpx] w-[48rpx] items-center justify-center border-none bg-transparent p-0 leading-none after:border-none active:opacity-60"
              openType="share"
              hoverStopPropagation
              onClick={(event) => {
                event.stopPropagation();
                onSharePrepare?.(item);
              }}
            >
              <Icon
                name="mdi-share-variant"
                size={28}
                color="hsl(var(--muted-foreground))"
              />
            </Button>
          ) : null}
        </View>
      ) : null}

      <View className="flex items-start justify-between gap-3">
        <View
          className={cn(
            'flex min-w-0 flex-1 flex-wrap items-center gap-[14rpx]',
            showTopActions && item.status !== 'cancelled' ? 'pr-[56rpx]' : '',
          )}
        >
          <ClassAvatar size="sm" />
          <View className="flex min-w-0 flex-1 flex-col">
            <View className="flex flex-wrap items-center gap-[12rpx]">
              <Text className="text-[34rpx] font-bold text-foreground">{item.className}</Text>
              {/* 班课标题区状态标签仅两种：上课中 / 试听 */}
              {isActive ? (
                <View className="course-tag-active rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                  <Text className="text-[20rpx] font-medium">上课中</Text>
                </View>
              ) : null}
              {item.hasTrialStudent ? (
                <View className="rounded-[8rpx] bg-error/10 px-[12rpx] py-[4rpx]">
                  <Text className="text-center text-[20rpx] font-semibold text-error">试听</Text>
                </View>
              ) : null}
            </View>
            <View className="mt-[8rpx] self-start rounded-[8rpx] bg-primary-10 px-[12rpx] py-[6rpx]">
              <Text className="text-[28rpx] font-semibold text-primary">
                {item.startTime}-{item.endTime}
              </Text>
            </View>
          </View>
        </View>
        {menu ? <View className="flex-shrink-0">{menu}</View> : null}
      </View>

      {/* 信息行：老师(+助教) · 人数 · 教室 | 点名 */}
      <View className="mt-[16rpx] flex items-center justify-between gap-[12rpx]">
        <View className="flex min-w-0 flex-1 items-center overflow-hidden">
          <Icon name="mdi-account-outline" size="xs" color="mutedForeground" />
          <Text className="ml-[6rpx] truncate text-[26rpx] text-muted-foreground">{teacherLabel}</Text>
          <Text className="ml-[10rpx] shrink-0 text-[26rpx] tabular-nums text-muted-foreground">
            {countLabel}
          </Text>
          {item.room ? (
            <View className="ml-[12rpx] flex min-w-0 shrink items-center overflow-hidden">
              <Icon name="mdi-map-marker" size="xs" color="mutedForeground" />
              <Text className="ml-[4rpx] truncate text-[26rpx] text-muted-foreground">{item.room}</Text>
            </View>
          ) : null}
        </View>
        {metaAction ? <View className="shrink-0">{metaAction}</View> : null}
      </View>

      {item.countdownText ? (
        <Text className="mt-[10rpx] block text-[24rpx] text-warning">{item.countdownText}</Text>
      ) : null}

      {/* 分割线下方：头像 + 约试听 */}
      {shouldShowStudentRow ? (
        <View className="mt-[16rpx] flex items-center justify-between gap-[16rpx] border-t border-border/70 pt-[16rpx]">
          <View className="flex min-w-0 flex-1 items-center overflow-hidden">
            {students.slice(0, MAX_VISIBLE_AVATARS).map((student, index) => (
              <Image
                key={student.id}
                src={student.avatar || BRAND_LOGO}
                className={cn(
                  'relative h-[56rpx] w-[56rpx] flex-shrink-0 rounded-full border-2 border-card bg-muted',
                  index > 0 && '-ml-[14rpx]',
                )}
                mode="aspectFill"
              />
            ))}
            {students.length === 0 ? (
              <Text className="text-[24rpx] text-muted-foreground">暂无学员</Text>
            ) : null}
            {students.length > MAX_VISIBLE_AVATARS ? (
              <View className="relative -ml-[14rpx] flex h-[56rpx] w-[56rpx] flex-shrink-0 items-center justify-center rounded-full border-2 border-card bg-muted">
                <Text className="text-[20rpx] text-muted-foreground">
                  +{students.length - MAX_VISIBLE_AVATARS}
                </Text>
              </View>
            ) : null}
          </View>
          {footerAction ? <View className="shrink-0">{footerAction}</View> : null}
        </View>
      ) : children ? (
        <View className="mt-[16rpx] border-t border-border/70 pt-[16rpx]">{children}</View>
      ) : null}
    </View>
  );
};

export default ScheduleCard;
