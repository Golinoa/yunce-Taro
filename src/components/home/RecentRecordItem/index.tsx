import { View, Text } from '@tarojs/components';
import React from 'react';
import type { LessonRecord } from '@/types/lesson-record';

interface RecentRecordItemProps {
  record: LessonRecord;
}

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const RecentRecordItem: React.FC<RecentRecordItemProps> = ({ record }) => {
  const studentName = record.student?.name || '学生';
  const firstChar = studentName[0] || '学';
  const packageName = record.course_package?.name || '课程';

  return (
    <View className="flex items-center p-4 bg-white rounded-2xl shadow-soft mb-3 press-scale">
      <View className="w-10 h-10 min-w-10 rounded-full bg-gradient-primary flex items-center justify-center mr-3">
        <Text className="text-base font-bold text-white">{firstChar}</Text>
      </View>
      <View className="flex-1 flex flex-col gap-1">
        <Text className="text-lg font-medium text-foreground">{studentName}</Text>
        <Text className="text-sm text-muted-foreground">{packageName}</Text>
      </View>
      <View className="flex flex-col items-end gap-1">
        <Text className="text-lg font-semibold text-primary">-{record.hours_used}课时</Text>
        <Text className="text-sm text-muted-foreground">{formatDateCN(record.lesson_date)}</Text>
      </View>
    </View>
  );
};

export default RecentRecordItem;
