/**
 * ScheduleConflictDialog - 排课冲突提示弹窗
 *
 * 对齐设计：标红冲突字段；「忽略冲突」/「返回修改」
 */
import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import type { ScheduleConflictItem, ScheduleConflictType } from '@/types/schedule-conflict';

export interface ScheduleConflictDialogProps {
  visible: boolean;
  conflictSummary: string;
  conflicts: ScheduleConflictItem[];
  onIgnore: () => void;
  onModify: () => void;
}

function hasType(item: ScheduleConflictItem, type: ScheduleConflictType): boolean {
  return item.conflictTypes.includes(type);
}

const ScheduleConflictDialog: React.FC<ScheduleConflictDialogProps> = ({
  visible,
  conflictSummary,
  conflicts,
  onIgnore,
  onModify,
}) => {
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      rafRef.current = requestAnimationFrame(() => {
        setAnimating(true);
      });
      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
      };
    }
    setAnimating(false);
    return undefined;
  }, [visible]);

  const handleTransitionEnd = () => {
    if (!animating) setMounted(false);
  };

  if (!mounted) return null;

  return (
    <View className="fixed inset-0 z-200 flex items-center justify-center px-[48rpx]">
      <View
        className={cn(
          'absolute inset-0 transition-all duration-300',
          animating ? 'bg-black/45' : 'bg-transparent',
        )}
        catchMove
      />
      <View
        className={cn(
          'relative w-full max-w-[640rpx] rounded-[28rpx] bg-white px-[32rpx] pb-[28rpx] pt-[36rpx] shadow-card transition-all duration-300 ease-in-out',
          animating ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        onTransitionEnd={handleTransitionEnd}
      >
        <Text className="mb-[20rpx] block text-center text-[34rpx] font-semibold text-foreground">
          冲突提示
        </Text>
        <Text className="mb-[12rpx] block text-[26rpx] leading-[1.5] text-foreground-secondary">
          当前排课和以下排课存在冲突（标红内容为冲突）
        </Text>
        {conflictSummary ? (
          <Text className="mb-[20rpx] block text-[26rpx] font-medium text-destructive">
            {conflictSummary}
            {conflictSummary.endsWith('、') ? '' : '、'}
          </Text>
        ) : null}

        <ScrollView scrollY className="max-h-[420rpx]">
          <View className="flex flex-col gap-[16rpx]">
            {conflicts.map((item) => (
              <View key={item.id} className="rounded-[16rpx] bg-muted px-[24rpx] py-[20rpx]">
                <View className="mb-[12rpx] flex items-start">
                  <Text className="w-[150rpx] shrink-0 text-[26rpx] text-muted-foreground">
                    上课班级
                  </Text>
                  <Text
                    className={cn(
                      'flex-1 text-[26rpx]',
                      hasType(item, 'class') ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {item.className || '—'}
                  </Text>
                </View>
                <View className="mb-[12rpx] flex items-start">
                  <Text className="w-[150rpx] shrink-0 text-[26rpx] text-muted-foreground">
                    上课时间
                  </Text>
                  <Text
                    className={cn(
                      'flex-1 text-[26rpx]',
                      hasType(item, 'time') ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {item.displayTime ||
                      `${item.dayOfWeekText || ''} ${item.startTime}-${item.endTime}`.trim()}
                  </Text>
                </View>
                <View className="mb-[12rpx] flex items-start">
                  <Text className="w-[150rpx] shrink-0 text-[26rpx] text-muted-foreground">
                    上课老师
                  </Text>
                  <Text
                    className={cn(
                      'flex-1 text-[26rpx]',
                      hasType(item, 'teacher') ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {item.teacherName || '—'}
                  </Text>
                </View>
                <View className="flex items-start">
                  <Text className="w-[150rpx] shrink-0 text-[26rpx] text-muted-foreground">
                    上课教室
                  </Text>
                  <Text
                    className={cn(
                      'flex-1 text-[26rpx]',
                      hasType(item, 'room') ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {item.room || ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View className="mt-[28rpx] flex gap-[20rpx]">
          <View
            className="flex h-[80rpx] flex-1 items-center justify-center rounded-full border-[2rpx] border-primary"
            onClick={onIgnore}
          >
            <Text className="text-[28rpx] font-medium text-primary">忽略冲突</Text>
          </View>
          <View
            className="flex h-[80rpx] flex-1 items-center justify-center rounded-full bg-primary"
            onClick={onModify}
          >
            <Text className="text-[28rpx] font-medium text-primary-foreground">返回修改</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ScheduleConflictDialog;
