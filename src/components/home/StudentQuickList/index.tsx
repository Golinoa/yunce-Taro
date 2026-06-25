import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import Avatar from '@/components/Avatar';
import type { Student } from '@/types/student';

interface StudentQuickListProps {
  students: Student[];
}

const StudentQuickList: React.FC<StudentQuickListProps> = ({ students }) => {
  if (students.length === 0) return null;

  return (
    <View className="mt-5">
      <View className="flex items-center justify-between mb-3">
        <Text className="text-xl font-semibold text-foreground">我的学生</Text>
        <Text
          className="text-base text-primary"
          onClick={() => Taro.navigateTo({ url: '/package-student/pages/students/index' })}
        >
          查看全部
        </Text>
      </View>
      <View className="flex gap-3 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide">
        {students.map((student) => (
          <View
            key={student.id}
            className="flex flex-col items-center gap-1 flex-shrink-0 active:opacity-80"
            onClick={() =>
              Taro.navigateTo({
                url: `/package-student/pages/student-detail/index?id=${student.id}`,
              })
            }
          >
            <Avatar
              name={student.name}
              avatarUrl={student.avatar_url}
              size="md"
              className="shadow-soft"
            />
            <Text className="text-sm text-foreground max-w-12 truncate">{student.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default StudentQuickList;
