import { View, Text, ScrollView } from '@tarojs/components';
import React, { useCallback, useMemo } from 'react';
import FilterBar from '@/components/teacher/FilterBar';
import TeacherCard from '@/components/teacher/TeacherCard';
import { ROLE_OPTIONS, SUBJECT_OPTIONS, STATUS_OPTIONS } from '@/data/teacher';
import type { TeacherFilter, TeacherUIModel } from '@/types/teacher';

export interface TeacherTabProps {
  filter: TeacherFilter;
  setFilter: (filter: Partial<TeacherFilter>) => void;
  filteredTeachers: TeacherUIModel[];
  activeFilterId: string | null;
  setActiveFilterId: (id: string | null | ((prev: string | null) => string | null)) => void;
  onTeacherClick: (id: string) => void;
}

/** 教师列表 Tab 组件 - 展示教师卡片列表和筛选栏 */
const TeacherTab: React.FC<TeacherTabProps> = ({
  filter,
  setFilter,
  filteredTeachers,
  activeFilterId,
  setActiveFilterId,
  onTeacherClick,
}) => {
  const teacherFilterConfig = useMemo(
    () => [
      {
        id: 'role',
        label: ROLE_OPTIONS.find((o) => o.value === filter.role)?.label || '全部岗位',
        value: filter.role,
        options: ROLE_OPTIONS.map((o) => ({
          ...o,
          dotColor:
            o.value === 'lead'
              ? '#5EC8A8'
              : o.value === 'assist'
                ? '#6BA3D6'
                : o.value === 'parttime'
                  ? '#D4A24E'
                  : undefined,
        })),
      },
      {
        id: 'subject',
        label: SUBJECT_OPTIONS.find((o) => o.value === filter.subject)?.label || '全部科目',
        value: filter.subject,
        options: SUBJECT_OPTIONS,
      },
      {
        id: 'status',
        label: STATUS_OPTIONS.find((o) => o.value === filter.status)?.label || '在职',
        value: filter.status,
        options: STATUS_OPTIONS.map((o) => ({
          ...o,
          dotColor:
            o.value === 'active' ? '#34C759' : o.value === 'resigned' ? '#8E8E93' : undefined,
        })),
      },
    ],
    [filter],
  );

  const handleFilterToggle = useCallback(
    (id: string) => {
      setActiveFilterId((prev) => (prev === id ? null : id));
    },
    [setActiveFilterId],
  );

  const handleFilterSelect = useCallback(
    (id: string, value: string, _label: string) => {
      setFilter({ [id]: value });
      setActiveFilterId(null);
    },
    [setFilter, setActiveFilterId],
  );

  return (
    <View className="flex-1 flex flex-col overflow-hidden h-0">
      <FilterBar
        filters={teacherFilterConfig}
        activeId={activeFilterId}
        onToggle={handleFilterToggle}
        onSelect={handleFilterSelect}
      />
      <ScrollView className="flex-1 h-0 px-[32rpx] py-[24rpx] pb-[48rpx]" scrollY>
        {filteredTeachers.length === 0 ? (
          <View className="flex items-center justify-center py-[120rpx]">
            <Text className="text-[28rpx] text-muted-foreground">暂无教师数据</Text>
          </View>
        ) : (
          filteredTeachers.map((t) => (
            <TeacherCard key={t.id} teacher={t} onClick={() => onTeacherClick(t.id)} />
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default TeacherTab;
