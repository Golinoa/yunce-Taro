/**
 * 点名页底部操作栏（从 lesson-form 抽出，Q2-2）
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import ActionButton from '@/components/ActionButton';
import Icon from '@/components/Icon';
import type { ClassAttendanceMode } from './checkin-status';

export interface LessonFormFooterProps {
  mode: 'single' | 'class';
  attendanceMode: ClassAttendanceMode;
  allSelectableChecked: boolean;
  isAlreadyChecked: boolean;
  canModifyLesson: boolean;
  submitting: boolean;
  supplementStudentIdsSize: number;
  selectedClassId: string;
  isClassPaused: boolean;
  selectedStudent: boolean;
  submitText: string;
  onToggleSelectAllStudents: () => void;
  onOpenSupplementSheet: () => void;
  onEnterEditMode: () => void;
  onCancelSupplement: () => void;
  onSubmit: () => void;
}

const LessonFormFooter: React.FC<LessonFormFooterProps> = ({
  mode,
  attendanceMode,
  allSelectableChecked,
  isAlreadyChecked,
  canModifyLesson,
  submitting,
  supplementStudentIdsSize,
  selectedClassId,
  isClassPaused,
  selectedStudent,
  submitText,
  onToggleSelectAllStudents,
  onOpenSupplementSheet,
  onEnterEditMode,
  onCancelSupplement,
  onSubmit,
}) => {
  if (mode === 'class') {
    return (
      <View className="fixed bottom-0 left-0 right-0 z-100 border-t border-border bg-white px-[32rpx] pt-[20rpx] pb-safe-bar">
        <View className="flex items-center justify-between gap-[24rpx]">
          <View
            className={`flex items-center gap-[12rpx] ${attendanceMode === 'view' || attendanceMode === 'supplement' ? 'opacity-50' : ''}`}
            onClick={
              attendanceMode === 'view' || attendanceMode === 'supplement'
                ? undefined
                : onToggleSelectAllStudents
            }
          >
            <View
              className={`flex h-[36rpx] w-[36rpx] items-center justify-center rounded-full border-2 ${allSelectableChecked ? 'border-primary bg-primary' : 'border-muted-foreground bg-white'}`}
            >
              {allSelectableChecked ? <Icon name="mdi-check" size="xs" color="white" /> : null}
            </View>
            <Text className="text-[26rpx] text-foreground">全选签到</Text>
          </View>
          {isAlreadyChecked && attendanceMode === 'view' ? (
            canModifyLesson ? (
              <View className="flex items-center gap-[16rpx]">
                <View
                  className="rounded-[48rpx] border border-primary bg-white px-[36rpx] py-[22rpx]"
                  onClick={onOpenSupplementSheet}
                >
                  <Text className="text-center text-[28rpx] font-medium text-primary">补录</Text>
                </View>
                <View
                  className="rounded-[48rpx] bg-primary px-[36rpx] py-[22rpx]"
                  onClick={onEnterEditMode}
                >
                  <Text className="text-center text-[28rpx] font-medium text-primary-foreground">
                    修改
                  </Text>
                </View>
              </View>
            ) : (
              <View className="rounded-[48rpx] bg-muted px-[48rpx] py-[22rpx]">
                <Text className="text-center text-[28rpx] font-medium text-white">已提交</Text>
              </View>
            )
          ) : isAlreadyChecked && attendanceMode === 'supplement' ? (
            <View className="flex items-center gap-[16rpx]">
              <View
                className="rounded-[48rpx] border border-border bg-white px-[32rpx] py-[22rpx]"
                onClick={onCancelSupplement}
              >
                <Text className="text-center text-[28rpx] font-medium text-foreground">取消</Text>
              </View>
              <View
                className={`rounded-[48rpx] px-[32rpx] py-[22rpx] ${submitting || supplementStudentIdsSize === 0 ? 'bg-muted' : 'bg-primary'}`}
                onClick={submitting || supplementStudentIdsSize === 0 ? undefined : onSubmit}
              >
                <Text className="text-center text-[28rpx] font-medium text-white">
                  {submitting ? '保存中...' : '保存补录'}
                </Text>
              </View>
            </View>
          ) : isAlreadyChecked && attendanceMode === 'edit' ? (
            <View
              className={`rounded-[48rpx] px-[48rpx] py-[22rpx] ${submitting ? 'bg-muted' : 'bg-primary'}`}
              onClick={submitting ? undefined : onSubmit}
            >
              <Text className="text-center text-[28rpx] font-medium text-primary-foreground">
                {submitting ? '保存中...' : '保存修改'}
              </Text>
            </View>
          ) : !canModifyLesson ? (
            <View className="rounded-[48rpx] bg-muted px-[48rpx] py-[22rpx]">
              <Text className="text-center text-[28rpx] font-medium text-white">仅查看</Text>
            </View>
          ) : (
            <View
              className={`rounded-[48rpx] px-[48rpx] py-[22rpx] ${submitting || !selectedClassId || isClassPaused ? 'bg-muted' : 'bg-primary'}`}
              onClick={
                submitting || !selectedClassId || isClassPaused
                  ? () => {
                      if (isClassPaused) {
                        Taro.showToast({ title: '班级已停课，请先恢复上课', icon: 'none' });
                      }
                    }
                  : onSubmit
              }
            >
              <Text className="text-center text-[28rpx] font-medium text-primary-foreground">
                {submitting ? '提交中...' : isClassPaused ? '已停课' : '提交点名'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <ActionButton text={submitText} disabled={submitting || !selectedStudent} onClick={onSubmit} />
  );
};

export default LessonFormFooter;
