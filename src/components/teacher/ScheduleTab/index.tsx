import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React from 'react';
import FilterBar from '@/components/teacher/FilterBar';
import { CAMPUS_OPTIONS, SUBJECT_OPTIONS } from '@/data/teacher';
import type { WeekDay, ScheduleItem } from '@/package-teacher/pages/teacher-list/useTeacherList';

export interface ScheduleTabProps {
  weekOffset: number;
  setWeekOffset: (offset: number | ((prev: number) => number)) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  weekDays: WeekDay[];
  weekTitle: string;
  daySchedule: ScheduleItem[];
  scheduleCampusFilter: string;
  setScheduleCampusFilter: (v: string) => void;
  scheduleSubjectFilter: string;
  setScheduleSubjectFilter: (v: string) => void;
  scheduleTeacherFilter: string;
  setScheduleTeacherFilter: (v: string) => void;
  scheduleFilterId: string | null;
  setScheduleFilterId: (id: string | null | ((prev: string | null) => string | null)) => void;
  scheduleDataMap: Record<string, ScheduleItem[]>;
  teachers: Array<{ id: string; name: string; status: string }>;
  onTeacherClick: (id: string) => void;
}

/** 排课 Tab 组件 - 展示周视图和当日课表 */
const ScheduleTab: React.FC<ScheduleTabProps> = ({
  setWeekOffset,
  selectedDate,
  setSelectedDate,
  weekDays,
  weekTitle,
  daySchedule,
  scheduleCampusFilter,
  setScheduleCampusFilter,
  scheduleSubjectFilter,
  setScheduleSubjectFilter,
  scheduleTeacherFilter,
  setScheduleTeacherFilter,
  scheduleFilterId,
  setScheduleFilterId,
  scheduleDataMap,
  teachers,
  onTeacherClick,
}) => {
  const activeTeachers = teachers.filter((t) => t.status === 'active');

  return (
    <View className="flex-1 flex flex-col overflow-hidden h-0">
      {/* 排课筛选栏 */}
      <FilterBar
        filters={[
          {
            id: 'campus',
            label:
              CAMPUS_OPTIONS.find((o) => o.value === scheduleCampusFilter)?.label || '全部校区',
            value: scheduleCampusFilter,
            options: CAMPUS_OPTIONS.map((o) => ({
              ...o,
              dotColor:
                o.value === 'center'
                  ? '#5EC8A8'
                  : o.value === 'south'
                    ? '#9B7ED8'
                    : o.value === 'east'
                      ? '#6BA3D6'
                      : undefined,
            })),
          },
          {
            id: 'subject',
            label:
              SUBJECT_OPTIONS.find((o) => o.value === scheduleSubjectFilter)?.label || '全部科目',
            value: scheduleSubjectFilter,
            options: SUBJECT_OPTIONS,
          },
          {
            id: 'teacher',
            label:
              scheduleTeacherFilter === 'all'
                ? '全部教师'
                : teachers.find((t) => t.id === scheduleTeacherFilter)?.name || '全部教师',
            value: scheduleTeacherFilter,
            options: [
              { label: '全部教师', value: 'all' },
              ...activeTeachers.map((t) => ({
                label: t.name,
                value: t.id,
              })),
            ],
          },
        ]}
        activeId={scheduleFilterId}
        onToggle={(id) => setScheduleFilterId((prev) => (prev === id ? null : id))}
        onSelect={(id, value) => {
          if (id === 'campus') setScheduleCampusFilter(value);
          if (id === 'subject') setScheduleSubjectFilter(value);
          if (id === 'teacher') setScheduleTeacherFilter(value);
          setScheduleFilterId(null);
        }}
      />

      <ScrollView className="flex-1 h-0" scrollY>
        <View className="px-[32rpx] py-[24rpx] pb-[48rpx]">
          {/* 周导航 */}
          <View className="flex items-center justify-between mb-[28rpx]">
            <View
              className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-card shadow-card flex items-center justify-center press-scale"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <Text className="text-[36rpx] text-muted-foreground">‹</Text>
            </View>
            <View className="text-center flex-1">
              <Text className="text-[32rpx] font-bold text-foreground block">{weekTitle}</Text>
              <Text className="text-[22rpx] text-muted-foreground mt-[2rpx] block">
                本周 {Object.values(scheduleDataMap).reduce((s, v) => s + v.length, 0)} 节课
              </Text>
            </View>
            <View
              className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-card shadow-card flex items-center justify-center press-scale"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <Text className="text-[36rpx] text-muted-foreground">›</Text>
            </View>
          </View>

          {/* 周视图 */}
          <View className="flex gap-[8rpx] mb-[28rpx] bg-card rounded-xl py-[16rpx] px-[12rpx] shadow-card">
            {weekDays.map((d) => (
              <View
                key={d.date}
                className={cn(
                  'flex-1 text-center py-[12rpx] rounded-xl transition',
                  d.isToday && selectedDate !== d.date && 'bg-info-10',
                  selectedDate === d.date && 'bg-info',
                )}
                onClick={() => setSelectedDate(d.date)}
              >
                <Text
                  className={cn(
                    'text-[20rpx] block',
                    selectedDate === d.date ? 'text-white/80' : 'text-muted-foreground',
                  )}
                >
                  {d.weekday}
                </Text>
                <Text
                  className={cn(
                    'text-[28rpx] font-semibold mt-[4rpx] block',
                    selectedDate === d.date
                      ? 'text-white'
                      : d.isToday
                        ? 'text-info font-bold'
                        : 'text-foreground',
                  )}
                >
                  {d.day}
                </Text>
                {d.hasCourse && (
                  <View
                    className={cn(
                      'w-[8rpx] h-[8rpx] rounded-full mx-auto mt-[6rpx]',
                      selectedDate === d.date ? 'bg-white' : 'bg-info',
                    )}
                  />
                )}
              </View>
            ))}
          </View>

          {/* 当日课表 */}
          <View className="text-[28rpx] font-bold text-foreground mb-[24rpx] flex items-center gap-[16rpx]">
            <Text>{dayjs(selectedDate).format('M月D日')} 课表</Text>
            {dayjs(selectedDate).isSame(dayjs(), 'day') && (
              <View className="py-[4rpx] px-[16rpx] rounded-[8rpx] bg-info-10 text-info text-[22rpx] font-semibold">
                今天
              </View>
            )}
          </View>

          {daySchedule.length === 0 ? (
            <View className="flex items-center justify-center py-[120rpx]">
              <Text className="text-[28rpx] text-muted-foreground">当日无排课</Text>
            </View>
          ) : (
            daySchedule.map((item, idx) => (
              <View
                className="flex gap-[24rpx] py-[24rpx] border-b border-border/50 last:border-b-0"
                key={idx}
              >
                <Text className="w-[100rpx] text-[26rpx] font-semibold text-foreground flex-shrink-0 text-right pt-[4rpx]">
                  {item.time}
                </Text>
                <View className="w-[20rpx] flex flex-col items-center flex-shrink-0 pt-[8rpx]">
                  <View className="w-[16rpx] h-[16rpx] rounded-full bg-info" />
                  {idx < daySchedule.length - 1 && (
                    <View className="w-[4rpx] flex-1 bg-border mt-[8rpx]" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-[28rpx] font-semibold text-foreground block">
                    {item.title}
                  </Text>
                  <Text className="text-[24rpx] text-muted-foreground mt-[4rpx] block">
                    {item.desc}
                  </Text>
                  <View className="flex gap-[8rpx] mt-[12rpx] flex-wrap">
                    {item.teachers.map((t, ti) => (
                      <View
                        key={ti}
                        className={cn(
                          'py-[6rpx] px-[16rpx] rounded-[12rpx] text-[22rpx] font-medium press-scale',
                          t.role === 'lead' ? 'bg-secondary text-primary' : 'bg-info-10 text-info',
                        )}
                        onClick={() => {
                          const teacher = teachers.find((tt) => tt.name === t.name);
                          if (teacher) onTeacherClick(teacher.id);
                        }}
                      >
                        {t.name}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default ScheduleTab;
