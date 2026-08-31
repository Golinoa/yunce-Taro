import { View, Text, Input } from '@tarojs/components';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import StudentListCard from '@/components/student/StudentListCard';
import type { Student } from '@/types/student';

export interface StudentSelectSheetProps {
  show: boolean;
  visible: boolean;
  studentSearch: string;
  filteredStudents: Student[];
  selectedStudent: Student | null;
  onSearchChange: (val: string) => void;
  onSelect: (stu: Student) => void;
  onClose: () => void;
}

/** 学员选择底部弹窗 — 行样式对齐意向学员 / StudentListCard */
const StudentSelectSheet: React.FC<StudentSelectSheetProps> = ({
  show,
  visible,
  studentSearch,
  filteredStudents,
  selectedStudent,
  onSearchChange,
  onSelect,
  onClose,
}) => {
  if (!show) return null;

  return (
    <BottomSheet show={show} visible={visible} title="选择学员" onClose={onClose} maxHeight="70vh">
      <View className="px-10 pt-4 pb-2">
        <View className="border-[2rpx] border-input rounded-[20rpx] py-[18rpx] px-[24rpx] bg-white">
          <Input
            className="w-full text-[26rpx] text-foreground"
            placeholder="搜索学员姓名或手机号"
            value={studentSearch}
            onInput={(e) => onSearchChange(e.detail.value || '')}
          />
        </View>
      </View>

      <View className="px-10 pb-10">
        {filteredStudents.map((stu) => {
          const remaining = (stu.course_packages || []).reduce(
            (s, p) => s + (p.remaining_hours || 0),
            0,
          );
          const selected = selectedStudent?.id === stu.id;
          return (
            <StudentListCard
              key={stu.id}
              variant="row"
              name={stu.name}
              nickname={stu.nickname}
              avatarUrl={stu.avatar_url}
              selected={selected}
              subtitle={`${stu.phone || '暂无手机号'} · 剩余 ${remaining} 课时`}
              right={
                selected ? <Text className="text-primary text-[32rpx] font-semibold">✓</Text> : null
              }
              onClick={() => onSelect(stu)}
            />
          );
        })}
        {filteredStudents.length === 0 && (
          <View className="py-10 text-center">
            <Text className="text-[28rpx] text-muted-foreground">未找到学员</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

export default StudentSelectSheet;
