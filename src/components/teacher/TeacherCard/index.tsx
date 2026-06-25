import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React from 'react';
import Avatar from '@/components/Avatar';
import { calcTotal } from '@/stores/teacher';
import type { TeacherUIModel } from '@/types/teacher';

interface TeacherCardProps {
  teacher: TeacherUIModel;
  onClick?: () => void;
}

const ROLE_TAG_MAP: Record<string, string> = {
  lead: 'bg-primary-bg text-primary',
  assist: 'bg-info-bg text-info',
  parttime: 'bg-amber-10 text-amber',
};

const ACCESS_SCOPE_TAG_MAP: Record<string, string> = {
  self: 'bg-muted text-muted-foreground',
  subject: 'bg-purple-10 text-purple',
  org: 'bg-destructive-10 text-destructive',
};

const TeacherCard: React.FC<TeacherCardProps> = ({ teacher, onClick }) => {
  const isResigned = teacher.status === 'resigned';
  const total = calcTotal(teacher);

  return (
    <View
      className={cn(
        'bg-card rounded-[16px] p-4 mb-3 shadow-card active:scale-[0.98] transition-transform border-l-[3px]',
        teacher.role === 'lead' && 'border-l-primary',
        teacher.role === 'assist' && 'border-l-info',
        teacher.role === 'parttime' && 'border-l-amber',
        isResigned && 'opacity-65',
      )}
      onClick={onClick}
    >
      <View className="flex items-center gap-3">
        <Avatar name={teacher.name} size="lg" className={cn(isResigned && 'grayscale-60')} />
        <View className="flex-1 min-w-0">
          <View className="flex items-center gap-2">
            <Text className="text-base font-bold text-foreground truncate">{teacher.name}</Text>
            <View
              className={cn(
                'px-2 py-[2rpx] rounded-tag text-xs font-medium whitespace-nowrap',
                ROLE_TAG_MAP[teacher.role],
              )}
            >
              {teacher.roleText}
            </View>
            {isResigned && (
              <View className="px-2 py-[2rpx] rounded-tag text-xs font-medium bg-gray-100 text-gray-500 whitespace-nowrap">
                已离职
              </View>
            )}
          </View>
          <View className="flex items-center gap-2 mt-2 flex-wrap">
            <View
              className={cn(
                'px-2 py-[2rpx] rounded-tag text-xs font-medium whitespace-nowrap',
                ACCESS_SCOPE_TAG_MAP[teacher.accessScope] || ACCESS_SCOPE_TAG_MAP.self,
              )}
            >
              {teacher.accessScopeText}
            </View>
          </View>
          <View className="flex items-center gap-2 mt-1">
            <Text className="text-xs text-muted-foreground">{teacher.subject}</Text>
            <View className="w-[6rpx] h-[6rpx] rounded-full bg-muted-foreground/40" />
            <Text className="text-xs text-muted-foreground">{teacher.phone}</Text>
          </View>
        </View>
        <View className="text-right flex-shrink-0">
          <Text
            className={cn(
              'text-2xl font-extrabold',
              isResigned ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            {teacher.hours}
          </Text>
          <Text className="text-xs text-muted-foreground block">
            {isResigned ? '已离职' : '本月课时'}
          </Text>
        </View>
      </View>

      {/* 薪资状态行 */}
      <View className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <View className="flex items-center gap-2">
          <SalaryStatusTag status={teacher.salaryStatus} />
          <Text className="text-xs text-muted-foreground">{dayjs().month() + 1}月工资</Text>
        </View>
        <Text
          className={cn(
            'text-sm font-bold',
            isResigned
              ? 'text-muted-foreground'
              : teacher.salaryStatus === 'paid'
                ? 'text-success'
                : 'text-amber',
          )}
        >
          ¥{total.toLocaleString()}
        </Text>
      </View>

      {/* 离职信息 */}
      {isResigned && teacher.resignType && (
        <View className="mt-2 p-2 rounded-lg bg-muted/50 flex items-center gap-2">
          <Text className="text-xs text-muted-foreground font-medium">
            {teacher.resignType === 'quit'
              ? '主动离职'
              : teacher.resignType === 'expire'
                ? '合同到期'
                : '辞退'}
          </Text>
          {teacher.resignReason && (
            <Text className="text-xs text-muted-foreground/60">{teacher.resignReason}</Text>
          )}
          {teacher.resignDate && (
            <Text className="text-xs text-muted-foreground/60 ml-auto">{teacher.resignDate}</Text>
          )}
        </View>
      )}
    </View>
  );
};

/** 薪资状态标签 */
const STATUS_MAP: Record<string, { cls: string; text: string }> = {
  pending: { cls: 'bg-amber-10 text-amber', text: '待确认' },
  confirmed: { cls: 'bg-purple-10 text-purple', text: '已确认' },
  paid: { cls: 'bg-success-bg text-success', text: '已发放' },
};

const SalaryStatusTag: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <View
      className={cn('px-2 py-[4rpx] rounded-tag text-xs font-semibold whitespace-nowrap', s.cls)}
    >
      {s.text}
    </View>
  );
};

export default TeacherCard;
export { SalaryStatusTag };
