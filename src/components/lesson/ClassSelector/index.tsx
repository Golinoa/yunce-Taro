import { View, Text } from '@tarojs/components';
import React, { useState, useCallback } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import { classColorHex } from '@/theme';
import type { Class } from '@/types/class';

interface ClassSelectorProps {
  classes: Class[];
  selectedClassId: string | null;
  scheduledClassIds?: Set<string>;
  onSelect: (classId: string) => void;
}

const ClassCard: React.FC<{
  cls: Class;
  hasSchedule: boolean;
  selected?: boolean;
  right?: React.ReactNode;
  onClick?: () => void;
}> = ({ cls, hasSchedule, selected, right, onClick }) => (
  <View
    className={`bg-card rounded-[24rpx] px-[32rpx] py-[28rpx] flex flex-row items-center justify-between press-bg shadow-card ${
      selected ? 'ring-[2rpx] ring-primary' : ''
    }`}
    onClick={onClick}
  >
    <View className="min-w-0 flex-1 flex flex-row items-center gap-[20rpx]">
      <View
        className="h-[88rpx] w-[16rpx] shrink-0 rounded-full"
        style={{ backgroundColor: classColorHex[cls.color] || 'hsl(var(--primary))' }}
      />
      <View className="min-w-0 flex-1">
        <View className="flex flex-row items-center gap-[12rpx]">
          <Text className="truncate text-[26rpx] font-medium text-foreground">{cls.name}</Text>
          {!hasSchedule ? (
            <View className="shrink-0 rounded-full bg-primary-bg px-[10rpx] py-[2rpx]">
              <Text className="text-[20rpx] text-primary">未排课</Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-[6rpx] block text-[22rpx] text-muted-foreground">
          {cls.student_count ?? 0} 名学员 · 已上 {cls.used_lessons ?? 0}/{cls.total_lessons ?? 0}{' '}
          课时
        </Text>
      </View>
    </View>
    {right ? <View className="ml-[16rpx] shrink-0">{right}</View> : null}
  </View>
);

const ClassSelector: React.FC<ClassSelectorProps> = ({
  classes,
  selectedClassId,
  scheduledClassIds = new Set(),
  onSelect,
}) => {
  const [showSwitcher, setShowSwitcher] = useState(false);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const handleSwitch = useCallback(
    (classId: string) => {
      onSelect(classId);
      setShowSwitcher(false);
    },
    [onSelect],
  );

  const hasSchedule = (classId: string) => scheduledClassIds.has(classId);

  return (
    <View className="flex flex-col gap-[20rpx]">
      {selectedClass ? (
        <ClassCard
          cls={selectedClass}
          hasSchedule={hasSchedule(selectedClass.id)}
          selected
          right={
            <Text
              className="text-[26rpx] text-primary"
              onClick={(e) => {
                e.stopPropagation();
                setShowSwitcher(true);
              }}
            >
              更换
            </Text>
          }
        />
      ) : (
        classes.map((cls) => (
          <ClassCard
            key={cls.id}
            cls={cls}
            hasSchedule={hasSchedule(cls.id)}
            onClick={() => handleSwitch(cls.id)}
          />
        ))
      )}

      {classes.length === 0 ? (
        <View className="rounded-[24rpx] bg-card py-[80rpx] text-center shadow-soft">
          <Text className="text-[28rpx] text-muted-foreground">暂无班级，请先创建班级</Text>
        </View>
      ) : null}

      <BottomSheet visible={showSwitcher} title="更换班级" onClose={() => setShowSwitcher(false)}>
        <View className="flex flex-col gap-[20rpx] p-[32rpx]">
          {classes.map((cls) => {
            const isCurrent = cls.id === selectedClassId;
            return (
              <ClassCard
                key={cls.id}
                cls={cls}
                hasSchedule={hasSchedule(cls.id)}
                selected={isCurrent}
                onClick={() => {
                  if (!isCurrent) handleSwitch(cls.id);
                }}
                right={
                  isCurrent ? (
                    <View className="rounded-full bg-primary-bg px-[12rpx] py-[4rpx]">
                      <Text className="text-[22rpx] text-primary">当前</Text>
                    </View>
                  ) : (
                    <Icon name="mdi-chevron-right" size={32} color="mutedForeground" />
                  )
                }
              />
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
};

export default ClassSelector;
