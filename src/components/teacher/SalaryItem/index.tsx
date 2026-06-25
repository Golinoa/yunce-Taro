import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React from 'react';
import Avatar from '@/components/Avatar';
import { calcTotal } from '@/stores/teacher';
import type { TeacherUIModel } from '@/types/teacher';

interface SalaryItemProps {
  teacher: TeacherUIModel;
  selected: boolean;
  selectable: boolean;
  onToggleSelect?: () => void;
  onAction?: () => void;
  onViewDetail?: () => void;
  onClick?: () => void;
}

const SalaryItem: React.FC<SalaryItemProps> = ({
  teacher,
  selected,
  selectable,
  onToggleSelect,
  onAction,
  onViewDetail,
  onClick,
}) => {
  const total = calcTotal(teacher);
  const lessonFee = teacher.hours * teacher.rate;

  const handleAction = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onAction?.();
  };

  const handleViewDetail = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onViewDetail?.();
  };

  // 角色标签样式
  const roleTagCls: Record<string, string> = {
    lead: 'bg-primary-bg text-primary',
    assist: 'bg-info-bg text-info',
    parttime: 'bg-amber-bg text-amber',
  };

  return (
    <View
      className={cn(
        'bg-card rounded-[16px] p-4 mb-3 shadow-card relative transition-all border-l-[3px]',
        teacher.role === 'lead' && 'border-l-primary',
        teacher.role === 'assist' && 'border-l-info',
        teacher.role === 'parttime' && 'border-l-amber',
        selected && 'bg-amber-50/50 border border-amber/40',
      )}
      onClick={onClick}
    >
      {/* 勾选框 */}
      {selectable && (
        <View
          className={cn(
            'absolute top-4 left-4 w-[44rpx] h-[44rpx] rounded-lg border-2 flex items-center justify-center z-2',
            selected ? 'bg-amber border-amber' : 'border-border',
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
        >
          {selected && <Text className="text-white text-xs font-bold">✓</Text>}
        </View>
      )}

      {/* 顶部：头像 + 信息 + 金额 */}
      <View className={cn('flex items-center gap-3', selectable && 'pl-[52rpx]')}>
        <Avatar name={teacher.name} size="md" />
        <View className="flex-1 min-w-0">
          <View className="flex items-center gap-2 flex-wrap">
            <Text className="text-base font-bold text-foreground truncate">{teacher.name}</Text>
            <View
              className={cn(
                'px-2 py-[2rpx] rounded-tag text-xs font-medium whitespace-nowrap',
                roleTagCls[teacher.role] || 'bg-info-bg text-info',
              )}
            >
              {teacher.roleText}
            </View>
            {teacher.status === 'resigned' && (
              <View className="px-2 py-[2rpx] rounded-tag text-xs font-medium bg-red-50 text-destructive whitespace-nowrap">
                已离职
              </View>
            )}
            <SalaryStatusTag status={teacher.salaryStatus} />
          </View>
          <Text className="text-xs text-muted-foreground mt-1">
            {teacher.hours}课时 · {teacher.subject}
          </Text>
        </View>
        <View className="text-right flex-shrink-0">
          <Text
            className={cn(
              'text-lg font-extrabold leading-tight',
              teacher.salaryStatus === 'paid' ? 'text-success' : 'text-amber',
            )}
          >
            ¥{total.toLocaleString()}
          </Text>
          <Text className="text-xs text-muted-foreground">{dayjs().month() + 1}月工资</Text>
        </View>
      </View>

      {/* 金额明细 */}
      <View className={cn('flex gap-2 mt-3 flex-wrap', selectable && 'pl-[52rpx]')}>
        {teacher.base > 0 && (
          <BreakdownChip label="底薪" value={`¥${teacher.base}`} variant="primary" />
        )}
        <BreakdownChip label="课时费" value={`¥${lessonFee}`} variant="info" />
        {teacher.attend > 0 && (
          <BreakdownChip label="全勤" value={`¥${teacher.attend}`} variant="amber" />
        )}
        {teacher.perf > 0 && (
          <BreakdownChip label="绩效" value={`¥${teacher.perf}`} variant="purple" />
        )}
        {teacher.deductions.map((d) => (
          <BreakdownChip
            key={d.id}
            label={d.reason}
            value={`${d.type === 'deduct' ? '-' : '+'}¥${d.amount}`}
            variant={d.type === 'deduct' ? 'destructive' : 'success'}
          />
        ))}
      </View>

      {/* 操作按钮 */}
      <View className={cn('flex gap-2 mt-3', selectable && 'pl-[52rpx]')}>
        {/* 查看工资单 - 所有状态都有 */}
        <View
          className="flex-1 py-2 rounded-xl text-center text-xs font-semibold text-amber bg-amber-10"
          onClick={handleViewDetail}
        >
          查看工资单
        </View>

        {/* 确认/发放/已完成 */}
        {teacher.salaryStatus === 'pending' && (
          <View
            className="flex-1 py-2 rounded-xl text-center text-xs font-semibold text-white shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #D4A24E, #c4922e)',
              boxShadow: '0 3px 10px rgba(212,162,78,0.35)',
            }}
            onClick={handleAction}
          >
            确认
          </View>
        )}
        {teacher.salaryStatus === 'confirmed' && (
          <View
            className="flex-1 py-2 rounded-xl text-center text-xs font-semibold text-white shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #3ABF6E, #2ea55a)',
              boxShadow: '0 3px 10px rgba(58,191,110,0.35)',
            }}
            onClick={handleAction}
          >
            发放
          </View>
        )}
        {teacher.salaryStatus === 'paid' && (
          <View className="flex-1 py-2 rounded-xl text-center text-xs font-semibold bg-muted text-muted-foreground">
            已完成
          </View>
        )}
      </View>
    </View>
  );
};

/** 金额构成小标签 */
const VARIANT_CLS: Record<string, string> = {
  primary: 'bg-primary-bg text-primary',
  info: 'bg-info-bg text-info',
  amber: 'bg-amber-bg text-amber',
  purple: 'bg-purple-bg text-purple',
  destructive: 'bg-red-50 text-destructive',
  success: 'bg-success-bg text-success',
};

const BreakdownChip: React.FC<{
  label: string;
  value: string;
  variant?: string;
}> = ({ label, value, variant = 'info' }) => (
  <View
    className={cn(
      'px-2 py-1 rounded-lg text-xs font-medium',
      VARIANT_CLS[variant] || VARIANT_CLS.info,
    )}
  >
    {label}
    {value}
  </View>
);

/** 薪资状态标签 */
const STATUS_MAP: Record<string, { cls: string; text: string }> = {
  pending: { cls: 'bg-amber-bg text-amber', text: '待确认' },
  confirmed: { cls: 'bg-purple-bg text-purple', text: '已确认' },
  paid: { cls: 'bg-success-bg text-success', text: '已发放' },
};

const SalaryStatusTag: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <View
      className={cn('px-2 py-[2rpx] rounded-tag text-xs font-semibold whitespace-nowrap', s.cls)}
    >
      {s.text}
    </View>
  );
};

export default SalaryItem;
