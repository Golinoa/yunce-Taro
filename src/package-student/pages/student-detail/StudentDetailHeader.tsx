/**
 * 学员详情渐变头部
 *
 * 使用场景：student-detail 顶部头像、姓名、电话快捷操作。
 * 功能说明：自定义导航区 + 复制/拨打/短信入口。
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';
import StudentAvatar from '@/components/student/StudentAvatar';
import type { Student } from '@/types/student';

export interface StudentDetailHeaderProps {
  student: Student;
  statusBarHeight: number;
  onBack: () => void;
  /** 编辑学员入口（仅教职工传入，家长端不显示） */
  onEdit?: () => void;
  /** 删除学员入口（软删除，仅教职工传入，家长端不显示） */
  onDeleteStudent?: () => void;
  onCopyPhone: () => void;
  onCallPhone: () => void;
  onSendMessage: () => void;
}

const StudentDetailHeader: React.FC<StudentDetailHeaderProps> = ({
  student,
  statusBarHeight,
  onBack,
  onEdit,
  onDeleteStudent,
  onCopyPhone,
  onCallPhone,
  onSendMessage,
}) => {
  return (
    <View
      className="bg-gradient-diffuse-custom-nav px-[40rpx] relative overflow-hidden pb-[72rpx]"
      style={{ paddingTop: `${statusBarHeight + 8}px` }}
    >
      <View className="relative z-1">
        <View
          className="w-[64rpx] h-[64rpx] rounded-full bg-card/80 center shadow-soft"
          onClick={onBack}
        >
          <Icon name="mdi-arrow-left" size="sm" color="foreground" />
        </View>
      </View>

      <View className="flex items-center gap-[24rpx] mt-[24rpx] relative z-1">
        <StudentAvatar
          name={student.name}
          src={student.avatar_url}
          size="xl"
          className="border-[4rpx] border-solid border-border bg-card"
        />
        <View className="flex-1 min-w-0">
          <View className="flex items-center gap-[12rpx]">
            <Text className="text-[40rpx] font-bold text-foreground leading-none">
              {student.name}
            </Text>
            {student.gender && (
              <Icon
                name={student.gender === 'male' ? 'mdi-gender-male' : 'mdi-gender-female'}
                size={24}
                color="muted"
              />
            )}
          </View>
          <View className="flex items-center gap-[16rpx] mt-[16rpx]">
            {student.phone && (
              <Text className="text-[28rpx] text-muted-foreground font-medium">
                {student.phone}
              </Text>
            )}
            {student.phone && (
              <View className="flex items-center gap-[12rpx]">
                <View
                  className="w-[52rpx] h-[52rpx] rounded-full bg-card center press-scale shadow-soft"
                  onClick={onCopyPhone}
                >
                  <Icon name="mdi-content-copy" size={20} color="muted" />
                </View>
                <View
                  className="w-[52rpx] h-[52rpx] rounded-full bg-card center press-scale shadow-soft"
                  onClick={onCallPhone}
                >
                  <Icon name="mdi-phone" size={20} color="muted" />
                </View>
                <View
                  className="w-[52rpx] h-[52rpx] rounded-full bg-card center press-scale shadow-soft"
                  onClick={onSendMessage}
                >
                  <Icon name="mdi-message-text" size={20} color="muted" />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 姓名 行右侧操作：编辑 / 删除（软删除，仅教职工可见） */}
        {(onEdit || onDeleteStudent) && (
          <View className="flex flex-row items-center gap-[12rpx] flex-shrink-0">
            {onEdit && (
              <View
                className="rounded-full bg-card/80 px-[20rpx] py-[10rpx] center press-scale shadow-soft"
                onClick={onEdit}
              >
                <Text className="text-[24rpx] font-medium text-primary">编辑</Text>
              </View>
            )}
            {onDeleteStudent && (
              <View
                className="rounded-full bg-card/80 px-[20rpx] py-[10rpx] center press-scale shadow-soft"
                onClick={onDeleteStudent}
              >
                <Text className="text-[24rpx] font-medium text-error">删除</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export default StudentDetailHeader;
