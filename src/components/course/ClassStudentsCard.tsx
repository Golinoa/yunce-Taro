/**
 * ClassStudentsCard - 上课学员卡片（班课）
 *
 * 从 course-form「上课学员」区块抽离，展示已选学员的 4 列网格（头像/姓名/剩余课时），
 * 支持「管理/添加」入口调用 StudentMultiSelectSheet 标准组件批量选/替换。
 *
 * 单个学员移除时通过 onChange(studentIds) 通知父组件，父组件负责持久化（如
 * classService.removeStudent/addStudents）并按需刷新 store。
 *
 * 父组件只需关心 onChange 回调，本组件不直接持有班级数据，避免与 classStore 耦合。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import StudentMultiSelectSheet from '@/components/StudentMultiSelectSheet';
import type { Subject } from '@/types/campus';
import type { Student } from '@/types/student';

export interface ClassStudentsCardProps {
  /** 已选学员 ID 列表（受控） */
  studentIds: string[];
  /** 已选学员完整信息（用于头像/姓名/课时展示） */
  students: Student[];
  /** 全部可选学员池（弹窗内搜索） */
  allStudents: Student[];
  /** 班级关联科目 ID（弹窗默认筛选） */
  subjectId?: string;
  /** 科目列表（弹窗筛选器） */
  subjects?: Subject[];
  /** 最大可选人数 */
  maxSelectable?: number;
  /** 学员列表变更回调（id 数组整体替换） */
  onChange: (studentIds: string[]) => void;
}

/** 计算学员剩余课时总和（跨多个 course_package） */
function computeRemaining(student: Student): number {
  const pkgs = student.course_packages;
  if (!pkgs || pkgs.length === 0) return 0;
  return pkgs.reduce((sum, pkg) => sum + (pkg.remaining_hours || 0), 0);
}

const ClassStudentsCard: React.FC<ClassStudentsCardProps> = ({
  studentIds,
  students,
  allStudents,
  subjectId,
  subjects,
  maxSelectable,
  onChange,
}) => {
  const [pickerVisible, setPickerVisible] = useState(false);

  const selectedStudents = useMemo(
    () => students.filter((s) => studentIds.includes(s.id)),
    [students, studentIds],
  );

  const openPicker = useCallback(() => setPickerVisible(true), []);
  const closePicker = useCallback(() => setPickerVisible(false), []);

  const handleConfirm = useCallback(
    (ids: string[]) => {
      onChange(ids);
      setPickerVisible(false);
    },
    [onChange],
  );

  const handleRemove = useCallback(
    async (student: Student) => {
      const { confirm } = await Taro.showModal({
        title: '移除学员',
        content: `确定将「${student.name}」从这个班级中移出吗？`,
        confirmColor: '#EF4444',
        confirmText: '移出',
      });
      if (!confirm) return;
      onChange(studentIds.filter((id) => id !== student.id));
    },
    [onChange, studentIds],
  );

  return (
    <Card className="p-[32rpx]">
      {/* 头部：标题 + 人数 badge + 管理/添加 */}
      <View className="flex flex-row items-center justify-between mb-[16rpx]">
        <View className="flex flex-row items-center gap-[12rpx]">
          <View className="w-[6rpx] h-[28rpx] rounded-[4rpx] bg-warning" />
          <Text className="text-[28rpx] font-semibold text-foreground">上课学员</Text>
          <View className="px-[14rpx] py-[4rpx] rounded-full bg-primary/10">
            <Text className="text-[22rpx] font-medium text-primary">{studentIds.length} 人</Text>
          </View>
        </View>
        <View
          className="flex flex-row items-center gap-[6rpx] active:opacity-70 press-scale"
          onClick={openPicker}
        >
          <Icon name="mdi-plus" size={28} color="primary" />
          <Text className="text-[26rpx] font-medium text-primary">
            {studentIds.length > 0 ? '管理' : '添加'}
          </Text>
        </View>
      </View>

      {/* 学员网格：4 列；最后一项为「继续添加」入口 */}
      {selectedStudents.length > 0 ? (
        <View className="grid grid-cols-4 gap-x-[20rpx] gap-y-[32rpx]">
          {selectedStudents.map((student) => {
            const remaining = computeRemaining(student);
            return (
              <View key={student.id} className="flex flex-col items-center gap-[12rpx] relative">
                <Avatar name={student.name} avatarUrl={student.avatar_url} size="mlg" />
                {/* 移除按钮（右上角红×） */}
                <View
                  className="absolute -top-[8rpx] -right-[8rpx] w-[36rpx] h-[36rpx] rounded-full bg-destructive border-[2rpx] border-card flex items-center justify-center active:opacity-70 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleRemove(student);
                  }}
                >
                  <Icon name="mdi-close" size={20} color="white" />
                </View>
                <Text className="text-[26rpx] text-foreground text-center truncate w-full">
                  {student.name}
                </Text>
                <Text className={cn('text-[22rpx]', 'text-muted-foreground')}>
                  {remaining} 课时
                </Text>
              </View>
            );
          })}

          {/* 继续添加按钮：紧跟学员头像，与头像尺寸保持一致（72rpx 圆形 + 26rpx 文字） */}
          <View
            className="flex flex-col items-center gap-[12rpx] active:opacity-70 press-scale"
            onClick={openPicker}
          >
            <View className="w-[72rpx] h-[72rpx] rounded-full bg-primary/10 flex items-center justify-center border-[2rpx] border-dashed border-primary/40">
              <Icon name="mdi-plus" size={36} color="primary" />
            </View>
            <Text className="text-[26rpx] text-foreground text-center">添加</Text>
          </View>
        </View>
      ) : (
        /* 空态：虚线框 + 圆形加号；圆形与头像尺寸一致 72rpx */
        <View
          className="flex flex-col items-center justify-center gap-[16rpx] py-[48rpx] rounded-[20rpx] border-[2rpx] border-dashed border-border active:opacity-70 press-scale"
          onClick={openPicker}
        >
          <View className="w-[72rpx] h-[72rpx] rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="mdi-plus" size={36} color="primary" />
          </View>
          <Text className="text-[26rpx] text-primary font-medium active:opacity-70">
            点击此处添加
          </Text>
        </View>
      )}

      {/* 学员多选弹窗（标准组件） */}
      <StudentMultiSelectSheet
        visible={pickerVisible}
        students={allStudents}
        selectedIds={studentIds}
        subjectId={subjectId}
        subjects={subjects}
        maxSelectable={maxSelectable}
        showUnscheduledFilter
        onClose={closePicker}
        onConfirm={handleConfirm}
      />
    </Card>
  );
};

export default ClassStudentsCard;
