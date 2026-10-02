import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { StudentDeletePreview } from '@/services/student';

/**
 * StudentDeleteSheet — 删除学员 / 彻底删除的确认弹层
 *
 * 两种模式共用一套排版：
 * - `delete`：点「删除学员」时。先把**他名下还有什么**摊开给老师看
 *   （剩多少课时 / 在几个班 / 还有几节课 / 绑了几位家长），再让他在
 *   「冻结（休学）」「继续删除（移入回收站）」之间选 —— 这是用户定的口径：
 *   删除前必须检查，并给出"冻结"这个不进回收站的出口。
 * - `purge`：在回收站点「彻底删除」时。因为没有外键的关联表也要一起清，
 *   这里逐条列出**会被永久删掉的东西**，让老师看清楚代价再点。
 *
 * 课时数一定要显示：那既是老师判断"该不该恢复"的依据，也是防
 * "课时莫名其妙没了"的凭据。
 */

export interface StudentDeleteSheetProps {
  visible: boolean;
  studentName: string;
  /** 删除前检查的结果；未加载完时为 null（此时按钮区显示加载态） */
  preview: null | StudentDeletePreview;
  mode: 'delete' | 'purge';
  /** 检查数据加载中 */
  loading?: boolean;
  /** 正在提交（冻结 / 删除 / 彻底删除） */
  submitting?: boolean;
  onClose: () => void;
  /** 仅 delete 模式：改为冻结（休学） */
  onFreeze: () => void;
  /** delete 模式 = 继续删除；purge 模式 = 彻底删除 */
  onConfirm: () => void;
}

interface DetailLine {
  label: string;
  value: string;
}

/** 只在数量 > 0 时才列出来 —— 弹窗里不该出现一堆"0 条" */
const toLine = (label: string, count: number, unit: string): DetailLine | null =>
  count > 0 ? { label, value: `${count} ${unit}` } : null;

const compact = (lines: Array<DetailLine | null>): DetailLine[] =>
  lines.filter((line): line is DetailLine => line !== null);

/** 删除（移入回收站）会动的东西 */
const buildSoftDeleteLines = (p: StudentDeletePreview['softDelete']): DetailLine[] =>
  compact([
    p.remainingHours > 0 ? { label: '剩余课时', value: `${p.remainingHours} 课时` } : null,
    toLine('所在班级', p.classCount, '个'),
    toLine('在上的排课', p.activeScheduleCount, '节'),
    toLine('已绑定家长', p.parentCount, '人'),
  ]);

/** 彻底删除会一并清掉的流水 */
const buildPurgeLines = (p: StudentDeletePreview['purge']): DetailLine[] =>
  compact([
    toLine('会员卡', p.memberCardCount, '张'),
    toLine('上课记录', p.lessonRecordCount, '条'),
    toLine('课时流水', p.adjustmentCount, '条'),
    toLine('班级关系', p.classStudentCount, '个'),
    toLine('家长绑定', p.parentBindingCount, '人'),
    toLine('请假记录', p.leaveRequestCount, '条'),
    toLine('跟进记录', p.followRecordCount, '条'),
    toLine('欠课时', p.lessonDebtCount, '条'),
    toLine('班课预约', p.bookingCount, '条'),
    toLine('补课预约', p.makeupBookingCount, '条'),
    toLine('私教预约', p.privateLessonBookingCount, '条'),
    toLine('排课', p.scheduleCount, '节'),
    toLine('他推荐来的学员（会变成无推荐人）', p.referrerCount, '人'),
  ]);

const StudentDeleteSheet: React.FC<StudentDeleteSheetProps> = ({
  visible,
  studentName,
  preview,
  mode,
  loading = false,
  submitting = false,
  onClose,
  onFreeze,
  onConfirm,
}) => {
  const isPurge = mode === 'purge';
  const lines = preview
    ? isPurge
      ? buildPurgeLines(preview.purge)
      : buildSoftDeleteLines(preview.softDelete)
    : [];
  const busy = loading || submitting;
  const close = busy ? () => undefined : onClose;

  return (
    <BottomSheet visible={visible} onClose={close} height="auto" scrollable={false}>
      <View className="bg-white rounded-t-[40rpx] px-[32rpx] pt-[36rpx] pb-[env(safe-area-inset-bottom)]">
        <Text className="block text-center text-[32rpx] font-semibold text-foreground">
          {isPurge ? '彻底删除（不可恢复）' : '删除学员'}
        </Text>
        <Text className="mt-[12rpx] block text-center text-[26rpx] text-foreground-secondary">
          {studentName}
        </Text>

        {/* 明细：先让老师看清代价 */}
        <View className="mt-[24rpx] rounded-[20rpx] bg-muted px-[24rpx] py-[8rpx] min-h-[88rpx] flex flex-col justify-center">
          {loading ? (
            <Text className="py-[20rpx] text-center text-[26rpx] text-muted-foreground">
              正在检查他名下的数据…
            </Text>
          ) : lines.length === 0 ? (
            <Text className="py-[20rpx] text-center text-[26rpx] text-muted-foreground">
              {isPurge ? '没有会一并删除的关联记录' : '名下没有课时 / 班级 / 家长'}
            </Text>
          ) : (
            lines.map((line) => (
              <View
                key={line.label}
                className="flex items-center justify-between py-[14rpx] border-b border-border-light last:border-b-0"
              >
                <Text className="text-[26rpx] text-foreground-secondary">{line.label}</Text>
                <Text className="text-[26rpx] font-medium text-foreground">{line.value}</Text>
              </View>
            ))
          )}
        </View>

        <Text className="mt-[20rpx] block text-[24rpx] leading-[38rpx] text-muted-foreground">
          {isPurge
            ? '以上记录会被永久删除，无法恢复。'
            : '删除只会把他移入回收站：课时、上课记录、流水都保留；班级、课表、家长绑定会解除。想暂时停课又不想动这些，选「冻结」。'}
        </Text>

        {/* 按钮区 */}
        {isPurge ? (
          <View className="mt-[28rpx] flex gap-[16rpx]">
            <View
              className={cn(
                'flex-1 h-[88rpx] rounded-[16rpx] bg-muted flex items-center justify-center',
                busy ? 'opacity-60' : 'active:opacity-80',
              )}
              onClick={close}
            >
              <Text className="text-[28rpx] font-medium text-foreground-secondary">取消</Text>
            </View>
            <View
              className={cn(
                'flex-1 h-[88rpx] rounded-[16rpx] bg-destructive flex items-center justify-center',
                busy ? 'opacity-60' : 'active:opacity-90',
              )}
              onClick={busy ? undefined : onConfirm}
            >
              <Text className="text-[28rpx] font-semibold text-white">
                {submitting ? '处理中...' : '彻底删除'}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View className="mt-[28rpx] flex gap-[16rpx]">
              <View
                className={cn(
                  'flex-1 h-[88rpx] rounded-[16rpx] bg-muted flex items-center justify-center',
                  busy ? 'opacity-60' : 'active:opacity-80',
                )}
                onClick={busy ? undefined : onFreeze}
              >
                <Text className="text-[28rpx] font-semibold text-foreground">冻结</Text>
              </View>
              <View
                className={cn(
                  'flex-1 h-[88rpx] rounded-[16rpx] bg-destructive flex items-center justify-center',
                  busy ? 'opacity-60' : 'active:opacity-90',
                )}
                onClick={busy ? undefined : onConfirm}
              >
                <Text className="text-[28rpx] font-semibold text-white">
                  {submitting ? '处理中...' : '继续删除'}
                </Text>
              </View>
            </View>
            <View className="mt-[16rpx] h-[88rpx] flex items-center justify-center" onClick={close}>
              <Text className="text-[28rpx] text-muted-foreground">取消</Text>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
};

export default StudentDeleteSheet;
