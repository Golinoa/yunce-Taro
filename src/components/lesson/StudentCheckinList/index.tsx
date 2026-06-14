import { View, Text } from '@tarojs/components';
import React, { useCallback } from 'react';
import PickerItem from '@/components/PickerItem';
import type { CoursePackage } from '@/types/course-package';
import type { Student } from '@/types/student';
import type { Subject } from '@/types/subject';

interface StudentCheckinItem {
  student: Student;
  package: CoursePackage | null;
  subject?: Subject | null;
  hoursNeeded: number;
}

interface StudentCheckinListProps {
  items: StudentCheckinItem[];
  checkedIds: Set<string>;
  onToggle: (studentId: string) => void;
}

const StudentCheckinList: React.FC<StudentCheckinListProps> = ({ items, checkedIds, onToggle }) => {
  const checkedCount = items.filter((i) => checkedIds.has(i.student.id)).length;

  const renderItem = useCallback(
    (item: StudentCheckinItem) => {
      const { student, package: pkg, subject, hoursNeeded } = item;
      const isChecked = checkedIds.has(student.id);
      const isOwe = pkg && pkg.remaining_hours < hoursNeeded;
      const noPackage = !pkg;

      // 头像背景色
      const avatarBg = noPackage ? '#D9404020' : isOwe ? '#E8C46820' : '#5EC8A820';
      // 副标题
      const subtitle = noPackage
        ? '无可用课包'
        : isOwe
          ? `欠课 · ${subject ? subject.name : pkg!.name}仅剩${pkg!.remaining_hours}课时`
          : `${subject ? `${subject.icon} ${subject.name}` : pkg!.name} · ${pkg!.remaining_hours}课时`;

      return (
        <PickerItem
          key={student.id}
          iconType="avatar"
          avatarBgColor={avatarBg}
          avatarUrl={student.avatar_url}
          avatarChar={student.name[0]}
          title={student.name}
          subtitle={subtitle}
          selected={isChecked}
          right={{
            type: 'checkbox',
            checked: isChecked,
            onCheckChange: () => onToggle(student.id),
          }}
          onClick={() => onToggle(student.id)}
        />
      );
    },
    [checkedIds, onToggle],
  );

  return (
    <View>
      {/* 标题栏 */}
      <View className="flex items-center justify-between mb-3">
        <Text className="text-lg text-foreground font-medium">学员名单</Text>
        <Text className="text-sm text-muted-foreground">
          签到 {checkedCount}/{items.length}
        </Text>
      </View>

      {/* 学员列表 */}
      <View className="bg-white rounded-3xl shadow-soft p-4 flex flex-col gap-2">
        {items.map((item) => renderItem(item))}
        {items.length === 0 && (
          <View className="py-10 text-center">
            <Text className="text-base text-muted-foreground">暂无学员</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default StudentCheckinList;
