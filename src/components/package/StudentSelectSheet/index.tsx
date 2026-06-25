import { View, Text, Input } from '@tarojs/components';
import React from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
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

/** 学员选择底部弹窗组件 */
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
      {/* 搜索框 */}
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

      {/* 学员列表 */}
      <View className="px-10 pb-10">
        {filteredStudents.map((stu) => (
          <View
            key={stu.id}
            className={`flex items-center gap-5 py-5 border-b border-input/50 ${selectedStudent?.id === stu.id ? 'bg-primary-5 -mx-4 px-4 rounded-2xl' : ''}`}
            onClick={() => onSelect(stu)}
          >
            <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="md" />
            <View className="flex-1 min-w-0">
              <Text className="text-md font-medium text-foreground block">{stu.name}</Text>
              <Text className="text-[22rpx] text-muted-foreground/60 block mt-1">
                {stu.phone || '暂无手机号'} · 剩余
                {(stu.course_packages || []).reduce((s, p) => s + (p.remaining_hours || 0), 0)}
                课时
              </Text>
            </View>
            {selectedStudent?.id === stu.id && <Text className="text-primary text-lg">✓</Text>}
          </View>
        ))}
        {filteredStudents.length === 0 && (
          <View className="py-10 text-center">
            <Text className="text-md text-muted-foreground">未找到学员</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

export default StudentSelectSheet;
