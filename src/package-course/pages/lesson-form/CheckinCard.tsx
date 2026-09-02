/**
 * 点名页学员签到卡片（从 lesson-form 抽出，Q2-2）
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';
import StudentAvatar from '@/components/student/StudentAvatar';
import { CHECKIN_OPTION_STYLES, type CheckinStatus } from './checkin-status';

/** 单个状态选项按钮（圆角胶囊） */
export const CheckinOptionButton: React.FC<{
  status: CheckinStatus;
  current: CheckinStatus;
  onClick: () => void;
}> = ({ status, current, onClick }) => {
  const active = status === current;
  const style = CHECKIN_OPTION_STYLES[status];
  return (
    <View
      className={`flex h-[52rpx] flex-1 items-center justify-center rounded-full border ${active ? `${style.activeBg} border-transparent` : 'border-border bg-muted/30'}`}
      onClick={onClick}
    >
      <Text
        className={`text-center text-[22rpx] font-medium ${active ? style.activeText : 'text-muted-foreground'}`}
      >
        {style.label}
      </Text>
    </View>
  );
};

export interface CheckinCardProps {
  name: string;
  status: CheckinStatus;
  remaining?: string;
  deduct?: string;
  isTrial?: boolean;
  /** 补课学员左上角「补」标签 */
  isMakeup?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  /** 本节课该学员的备注（有值才显示备注行） */
  note?: string;
  onToggleStatus: (next: CheckinStatus) => void;
  onOpenDetailSheet: () => void;
}

/** 学员签到卡片 - 居中头像+两按钮（签到/未到请假切换）+编辑 */
export const CheckinCard: React.FC<CheckinCardProps> = ({
  name,
  status,
  remaining = '',
  deduct = '',
  isTrial = false,
  isMakeup = false,
  disabled = false,
  highlight = false,
  note,
  onToggleStatus,
  onOpenDetailSheet,
}) => {
  const handleRightButtonClick = () => {
    if (status === 'checked') {
      onToggleStatus('absent');
    } else if (status === 'absent') {
      onToggleStatus('leave');
    } else {
      onToggleStatus('absent');
    }
  };
  const rightLabel = status === 'leave' ? '请假' : '未到';
  const rightActive = status === 'leave' || status === 'absent';
  const rightActiveBg = status === 'leave' ? 'bg-destructive' : 'bg-warning';

  const cornerBadgeLeft = highlight ? (isMakeup || isTrial ? 'left-[72rpx]' : 'left-0') : 'left-0';
  const secondBadgeLeft = highlight ? 'left-[144rpx]' : 'left-[56rpx]';

  return (
    <View
      className={`relative flex flex-col items-center rounded-[20rpx] bg-white px-[16rpx] py-[20rpx] shadow-card ${highlight ? 'border-2 border-primary bg-primary/5' : ''} ${disabled ? 'opacity-60' : ''}`}
    >
      {highlight ? (
        <View className="absolute left-0 top-0 rounded-tl-[20rpx] rounded-br-[12rpx] bg-primary/10 px-[12rpx] py-[4rpx]">
          <Text className="text-[18rpx] font-medium text-primary">补录</Text>
        </View>
      ) : null}
      {isMakeup ? (
        <View
          className={`absolute ${cornerBadgeLeft} top-0 rounded-tl-[20rpx] rounded-br-[12rpx] bg-amber-500/15 px-[12rpx] py-[4rpx]`}
        >
          <Text className="text-[18rpx] font-medium text-amber-600">补</Text>
        </View>
      ) : null}
      {isTrial ? (
        <View
          className={`absolute ${isMakeup ? secondBadgeLeft : cornerBadgeLeft} top-0 rounded-tl-[20rpx] rounded-br-[12rpx] bg-error/10 px-[12rpx] py-[4rpx]`}
        >
          <Text className="text-[18rpx] font-medium text-error">试听</Text>
        </View>
      ) : null}
      <View
        className="absolute right-[6rpx] top-[6rpx] flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full bg-muted/40 active:opacity-70"
        onClick={disabled ? undefined : onOpenDetailSheet}
      >
        <Icon name="mdi-square-edit-outline" size="md" color="primary" />
      </View>
      <StudentAvatar name={name} size="md" />
      <Text className="mt-[12rpx] text-center text-[28rpx] font-medium text-foreground line-clamp-1">
        {name}
      </Text>
      {note ? (
        <View className="mt-[6rpx] flex w-full items-center justify-center gap-[4rpx]">
          <Icon name="mdi-note-text" size={22} color="warning" />
          <Text className="max-w-[200rpx] truncate text-[20rpx] text-warning">{note}</Text>
        </View>
      ) : null}
      <View className="relative mt-[12rpx] grid w-full grid-cols-2 gap-x-[16rpx] gap-y-[4rpx]">
        <Text className="text-center text-[22rpx] text-muted-foreground">剩余</Text>
        <Text className="text-center text-[22rpx] text-muted-foreground">扣课</Text>
        <Text className="text-center text-[24rpx] text-destructive line-clamp-1">
          {remaining || '-'}
        </Text>
        <Text className="text-center text-[24rpx] text-destructive line-clamp-1">
          {deduct || '-'}
        </Text>
        <View className="absolute bottom-[4rpx] left-1/2 top-[4rpx] w-[1rpx] -translate-x-1/2 bg-border" />
      </View>
      <View className="mt-[16rpx] grid w-full grid-cols-2 gap-[16rpx]">
        <CheckinOptionButton
          status="checked"
          current={status}
          onClick={() => {
            if (!disabled) onToggleStatus('checked');
          }}
        />
        <View
          className={`flex h-[52rpx] flex-1 items-center justify-center rounded-full border ${rightActive ? `${rightActiveBg} border-transparent` : 'border-border bg-muted/30'}`}
          onClick={disabled ? undefined : handleRightButtonClick}
        >
          <Text
            className={`text-center text-[22rpx] font-medium ${rightActive ? 'text-white' : 'text-muted-foreground'}`}
          >
            {rightLabel}
          </Text>
        </View>
      </View>
    </View>
  );
};
