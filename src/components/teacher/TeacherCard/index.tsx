import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React from 'react';
import Avatar from '@/components/Avatar';
import { calcTotal } from '@/stores/teacher';
import { SALARY_STATUS_META, normalizeSalaryStatus } from '@/types/teacher';
import type { TeacherUIModel } from '@/types/teacher';

interface TeacherCardProps {
  teacher: TeacherUIModel;
  onClick?: () => void;
}

const ROLE_TAG_MAP: Record<string, { bg: string; text: string }> = {
  lead: { bg: 'bg-primary-bg', text: 'text-primary' },
  assist: { bg: 'bg-info-bg', text: 'text-info' },
  parttime: { bg: 'bg-amber-10', text: 'text-amber' },
};

const ACCESS_SCOPE_TAG_MAP: Record<string, { bg: string; text: string }> = {
  self: { bg: 'bg-muted', text: 'text-muted-foreground' },
  subject: { bg: 'bg-purple-10', text: 'text-purple' },
  org: { bg: 'bg-destructive-10', text: 'text-destructive' },
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
        <Avatar
          name={teacher.name}
          avatarUrl={teacher.avatar}
          size="lg"
          className={cn(isResigned && 'grayscale-60')}
        />
        <View className="flex-1 min-w-0">
          <View className="flex items-center gap-2">
            <Text className="text-base font-bold text-foreground truncate">{teacher.name}</Text>
            {(() => {
              const roleTag = ROLE_TAG_MAP[teacher.role];
              return (
                <View className={cn('px-2 py-[2rpx] rounded-tag whitespace-nowrap', roleTag.bg)}>
                  <Text className={cn('text-xs font-medium', roleTag.text)}>
                    {teacher.roleText}
                  </Text>
                </View>
              );
            })()}
            {isResigned && (
              <View className="px-2 py-[2rpx] rounded-tag bg-muted whitespace-nowrap">
                <Text className="text-xs font-medium text-muted-foreground">已离职</Text>
              </View>
            )}
          </View>
          <View className="flex items-center gap-2 mt-2 flex-wrap">
            {(() => {
              const scopeTag =
                ACCESS_SCOPE_TAG_MAP[teacher.accessScope] || ACCESS_SCOPE_TAG_MAP.self;
              return (
                <View className={cn('px-2 py-[2rpx] rounded-tag whitespace-nowrap', scopeTag.bg)}>
                  <Text className={cn('text-xs font-medium', scopeTag.text)}>
                    {teacher.accessScopeText}
                  </Text>
                </View>
              );
            })()}
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
              : normalizeSalaryStatus(teacher.salaryStatus) === 'archived'
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
const SalaryStatusTag: React.FC<{ status: string }> = ({ status }) => {
  const key = normalizeSalaryStatus(status);
  const meta = SALARY_STATUS_META[key];
  return (
    <View className={cn('px-2 py-[4rpx] rounded-tag whitespace-nowrap', meta.bgClass)}>
      <Text className={cn('text-xs font-semibold', meta.textClass)}>{meta.label}</Text>
    </View>
  );
};

export default TeacherCard;
export { SalaryStatusTag };
