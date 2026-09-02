/**
 * 点名页学员编辑底部弹窗（从 lesson-form 抽出，Q2-2）
 */
import { View, Text, Textarea } from '@tarojs/components';
import React, { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import StudentAvatar from '@/components/student/StudentAvatar';
import type { Class } from '@/types/class';
import type { Student } from '@/types/student';

export interface StudentEditSheetTarget {
  type: 'formal' | 'trial';
  id: string;
  name: string;
  remaining: string;
  deduct: string;
  courseName?: string;
  student?: Student;
}

export interface StudentEditSheetProps {
  visible: boolean;
  target: StudentEditSheetTarget | null;
  remark: string;
  classes: Class[];
  selectedClassId: string;
  onRemarkChange: (value: string) => void;
  onClose: () => void;
  onTransfer: (student: Student, targetClassId: string) => void;
  onRemove: (student: Student) => void;
  onConfirm: () => void | Promise<void>;
}

const StudentEditSheet: React.FC<StudentEditSheetProps> = ({
  visible,
  target,
  remark,
  classes,
  selectedClassId,
  onRemarkChange,
  onClose,
  onTransfer,
  onRemove,
  onConfirm,
}) => {
  const [showTransferList, setShowTransferList] = useState(false);

  if (!target) {
    return null;
  }

  const isTrial = target.type === 'trial';
  const canManage = !isTrial && Boolean(target.student);

  return (
    <BottomSheet visible={visible} title="" height="auto" scrollable={false} onClose={onClose}>
      <View className="px-[32rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))] pt-[24rpx]">
        <View className="mb-[32rpx] flex items-center justify-between">
          <View className="flex items-center gap-[16rpx]">
            <StudentAvatar name={target.name} size="md" />
            <Text className="text-[32rpx] font-medium text-foreground">{target.name}</Text>
          </View>
          {canManage ? (
            <View className="flex items-center gap-[24rpx]">
              <Text
                className="text-[26rpx] text-primary"
                onClick={() => setShowTransferList((prev) => !prev)}
              >
                调课
              </Text>
              {target.student ? (
                <Text
                  className="text-[26rpx] text-destructive"
                  onClick={() => onRemove(target.student!)}
                >
                  移除
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {showTransferList && canManage ? (
          <View className="mb-[24rpx] rounded-[16rpx] bg-muted/50 px-[20rpx] py-[16rpx]">
            <Text className="mb-[12rpx] block text-[24rpx] text-muted-foreground">
              选择目标班级
            </Text>
            <View className="flex flex-col gap-[12rpx]">
              {classes
                .filter((cls) => cls.id !== selectedClassId)
                .map((cls) => (
                  <View
                    key={cls.id}
                    className="flex items-center justify-between rounded-[12rpx] bg-white px-[20rpx] py-[18rpx]"
                    onClick={() => {
                      if (target.student) {
                        onTransfer(target.student, cls.id);
                      }
                      setShowTransferList(false);
                    }}
                  >
                    <Text className="text-[26rpx] text-foreground">{cls.name}</Text>
                    <Icon name="mdi-chevron-right" size="sm" color="muted" />
                  </View>
                ))}
              {classes.filter((cls) => cls.id !== selectedClassId).length === 0 ? (
                <Text className="block text-center text-[24rpx] text-muted-foreground">
                  暂无其他班级
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View className="mb-[24rpx] flex flex-col">
          <View className="flex items-center justify-between border-b border-border/40 py-[24rpx]">
            <Text className="text-[28rpx] text-muted-foreground">消耗课程</Text>
            <Text className="text-[28rpx] font-medium text-foreground">
              {target.courseName || '-'}
            </Text>
          </View>
          <View className="flex items-center justify-between border-b border-border/40 py-[24rpx]">
            <Text className="text-[28rpx] text-muted-foreground">扣课时</Text>
            <Text className="text-[28rpx] font-medium text-foreground">{target.deduct || '0'}</Text>
          </View>
          <View className="flex items-center justify-between py-[24rpx]">
            <Text className="text-[28rpx] text-muted-foreground">剩余课时</Text>
            <Text className="text-[28rpx] font-medium text-foreground">
              {target.remaining || '-'}
            </Text>
          </View>
        </View>

        <View className="mb-[24rpx]">
          <Text className="mb-[12rpx] block text-[28rpx] text-foreground">备注</Text>
          <View className="rounded-[16rpx] bg-muted/30 px-[20rpx] py-[16rpx]">
            <Textarea
              className="h-[160rpx] w-full text-[28rpx] leading-[44rpx] text-foreground placeholder:text-muted-foreground/60"
              placeholder="请输入备注（学员端不可见）"
              value={remark}
              onInput={(e) => onRemarkChange(e.detail.value)}
              maxlength={200}
            />
          </View>
        </View>

        <View className="flex justify-center pb-[8rpx]">
          <View
            className="flex w-full items-center justify-center rounded-[48rpx] bg-primary py-[24rpx]"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
          >
            <Text className="text-[28rpx] font-medium text-white">确定</Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default StudentEditSheet;
