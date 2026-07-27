import { View, Text } from '@tarojs/components';
import React, { useCallback } from 'react';
import PickerItem from '@/components/PickerItem';
import type { CoursePackage } from '@/types/course-package';
import type { Student } from '@/types/student';
import type { Subject } from '@/types/subject';
import { isTrialPackage } from '@/utils/package-helper';

interface StudentCheckinItem {
  student: Student;
  package: CoursePackage | null;
  subject?: Subject | null;
  hoursNeeded: number;
  attendanceState?: 'checked' | 'leave' | 'absent';
}

interface StudentCheckinListProps {
  items: StudentCheckinItem[];
  onToggle: (studentId: string) => void;
  title?: string;
  showHeader?: boolean;
  embedded?: boolean;
}

const StudentCheckinList: React.FC<StudentCheckinListProps> = ({
  items,
  onToggle,
  title = '学员名单',
  showHeader = true,
  embedded = false,
}) => {
  const checkedCount = items.filter((item) => item.attendanceState === 'checked').length;
  const leaveCount = items.filter((item) => item.attendanceState === 'leave').length;
  const absentCount = items.filter((item) => item.attendanceState === 'absent').length;

  const renderItem = useCallback(
    (item: StudentCheckinItem) => {
      const { student, package: pkg, subject, hoursNeeded, attendanceState = 'absent' } = item;
      const isChecked = attendanceState === 'checked';
      const isLeave = attendanceState === 'leave';
      const isOwe = pkg && pkg.remaining_hours < hoursNeeded;
      const noPackage = !pkg;
      const isTrial = isTrialPackage(pkg) || isTrialPackage(student.course_packages?.[0]);

      // 头像背景色
      const avatarBg = isLeave
        ? '#CBD5E120'
        : noPackage
          ? '#D9404020'
          : isOwe
            ? '#E8C46820'
            : '#5EC8A820';
      // 副标题
      const subtitle = isLeave
        ? '家长已请假，本节课自动记为请假'
        : noPackage
          ? '无可用课包'
          : isOwe
            ? `欠课 · ${subject ? subject.name : pkg!.name}仅剩${pkg!.remaining_hours}课时`
            : `${subject ? subject.name : pkg!.name} · ${pkg!.remaining_hours}课时`;

      return (
        <PickerItem
          key={student.id}
          iconType="avatar"
          avatarBgColor={avatarBg}
          avatarUrl={student.avatar_url}
          avatarChar={student.name[0]}
          title={student.name}
          titleExtra={
            <View className="flex items-center gap-[8rpx]">
              <View
                className={`rounded-[8rpx] px-[12rpx] py-[4rpx] ${
                  isLeave ? 'bg-slate-100' : isChecked ? 'bg-emerald-50' : 'bg-amber-50'
                }`}
              >
                <Text
                  className={`text-center text-[20rpx] font-medium ${
                    isLeave ? 'text-slate-500' : isChecked ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {isLeave ? '请假' : isChecked ? '签到' : '未到'}
                </Text>
              </View>
              {isTrial ? (
                <View className="rounded-[8rpx] bg-error/10 px-[12rpx] py-[4rpx]">
                  <Text className="text-center text-[20rpx] font-medium text-error">试听</Text>
                </View>
              ) : null}
            </View>
          }
          subtitle={subtitle}
          selected={isChecked}
          disabled={isLeave}
          right={
            isLeave
              ? { type: 'none' }
              : {
                  type: 'checkbox',
                  checked: isChecked,
                  onCheckChange: () => onToggle(student.id),
                }
          }
          onClick={isLeave ? undefined : () => onToggle(student.id)}
        />
      );
    },
    [onToggle],
  );

  return (
    <View>
      {showHeader ? (
        <View className="mb-3 flex items-center justify-between">
          <Text className="text-lg font-medium text-foreground">{title}</Text>
          <Text className="text-sm text-muted-foreground">
            签到 {checkedCount} · 请假 {leaveCount} · 未到 {absentCount}
          </Text>
        </View>
      ) : null}

      <View
        className={
          embedded
            ? 'flex flex-col gap-2'
            : 'rounded-3xl bg-white p-4 shadow-soft flex flex-col gap-2'
        }
      >
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
