import { View } from '@tarojs/components';
import React from 'react';
import PickerItem from '@/components/PickerItem';
import type { CoursePackage } from '@/types/course-package';
import type { Subject } from '@/types/subject';

interface StudentCardProps {
  name: string;
  nickname?: string;
  avatarUrl?: string;
  matchedPackage: CoursePackage | null;
  subject?: Subject | null;
  hoursNeeded: number;
  onChange?: () => void;
}

const StudentCard: React.FC<StudentCardProps> = ({
  name,
  nickname,
  avatarUrl,
  matchedPackage,
  subject,
  hoursNeeded,
  onChange,
}) => {
  const isOwe = matchedPackage && matchedPackage.remaining_hours < hoursNeeded;
  const noPackage = !matchedPackage;

  // 课包状态副标题
  const subtitle = noPackage
    ? '无可用课包'
    : isOwe
      ? `欠课 · ${subject ? subject.name : matchedPackage!.name}仅剩${matchedPackage!.remaining_hours}课时`
      : `${subject ? `${subject.icon} ${subject.name}` : matchedPackage!.name} · 剩余${matchedPackage!.remaining_hours}课时`;

  return (
    <View className="bg-white rounded-2xl shadow-soft p-1">
      <PickerItem
        iconType="avatar"
        avatarUrl={avatarUrl}
        avatarChar={name[0]}
        title={name}
        subtitle={nickname ? `${nickname} · ${subtitle}` : subtitle}
        selected
        right={{ type: 'change-btn', onChangeClick: onChange }}
        onClick={onChange}
      />
    </View>
  );
};

export default StudentCard;
