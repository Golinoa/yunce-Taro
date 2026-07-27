import { View, Text, Input, ScrollView } from '@tarojs/components';
import React from 'react';
import Avatar from '@/components/Avatar';
import type { Student } from '@/types/student';

interface AddStudentSheetProps {
  show: boolean;
  availableStudents: Student[];
  selectedStudentIds: Set<string>;
  addSearchQuery: string;
  confirming?: boolean;
  onSearchChange: (query: string) => void;
  onToggleStudent: (id: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const AddStudentSheet: React.FC<AddStudentSheetProps> = ({
  show,
  availableStudents,
  selectedStudentIds,
  addSearchQuery,
  confirming = false,
  onSearchChange,
  onToggleStudent,
  onConfirm,
  onClose,
}) => {
  if (!show) return null;

  return (
    <View className="fixed inset-0 z-100 flex items-end">
      <View className="absolute inset-0 bg-black/40" onClick={confirming ? undefined : onClose} />
      <View className="relative w-full bg-white rounded-t-32rpx max-h-75vh flex flex-col">
        {/* 拖拽条 */}
        <View className="flex justify-center pt-2 pb-0">
          <View className="w-9 h-1 rounded-full bg-gray-200" />
        </View>
        {/* 头部 */}
        <View className="flex items-center justify-between px-5 pt-3 pb-3 border-b-d5e8e0">
          <Text className="text-base font-semibold text-foreground">选择学员</Text>
          <View
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
            onClick={confirming ? undefined : onClose}
          >
            <Text className="text-xs text-muted-foreground">✕</Text>
          </View>
        </View>
        {/* 搜索 */}
        <View className="px-5 pt-3">
          <View className="rounded-xl px-3 py-2 flex items-center gap-2 bg-f5faf8">
            <Text className="text-sm text-muted-foreground">🔍</Text>
            <Input
              className="flex-1 text-sm text-foreground"
              placeholder="搜索学员姓名..."
              placeholderClass="text-muted-foreground"
              value={addSearchQuery}
              onInput={(e) => onSearchChange(e.detail.value || '')}
            />
          </View>
        </View>
        {/* 列表 */}
        <ScrollView scrollY className="flex-1">
          <View className="px-5 py-3">
            {availableStudents.length === 0 ? (
              <View className="py-10 text-center">
                <Text className="text-sm text-muted-foreground">所有学生都已在班级中</Text>
              </View>
            ) : (
              availableStudents.map((stu) => {
                const isSelected = selectedStudentIds.has(stu.id);
                return (
                  <View
                    key={stu.id}
                    className={`flex items-center gap-3 py-3 border-b-e8e8e8 ${isSelected ? 'bg-primary-5 -mx-1 px-1 rounded-lg' : ''}`}
                    onClick={confirming ? undefined : () => onToggleStudent(stu.id)}
                  >
                    <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="sm" />
                    <View className="flex-1 min-w-0">
                      <Text className="text-base font-medium text-foreground">{stu.name}</Text>
                      {stu.phone && (
                        <Text className="text-sm text-muted-foreground block mt-0_d5">
                          {stu.phone}
                        </Text>
                      )}
                    </View>
                    <View
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary border-primary' : ''}`}
                      style={isSelected ? undefined : { borderColor: '#D5E8E0' }}
                    >
                      {isSelected && <Text className="text-white text-xs font-bold">✓</Text>}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
        {/* 底部确认 */}
        <View className="px-5 py-4 flex items-center gap-3 border-t-d5e8e0">
          <Text className="text-sm text-muted-foreground flex-1">
            已选 <Text className="font-semibold text-primary">{selectedStudentIds.size}</Text> 人
          </Text>
          <View
            className={`btn-secondary px-6 shadow-elegant ${confirming ? 'bg-border' : 'bg-gradient-primary'}`}
            onClick={confirming ? undefined : onConfirm}
          >
            <Text
              className={`text-base font-semibold ${confirming ? 'text-muted-foreground' : 'text-white'}`}
            >
              {confirming ? '添加中...' : '确认添加'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default AddStudentSheet;
