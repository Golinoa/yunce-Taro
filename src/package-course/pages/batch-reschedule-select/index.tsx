import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '@/components/ActionButton';
import type { CalendarDotType } from '@/components/CalendarWeekSelector';
import CalendarMonthSheet from '@/components/CalendarMonthSheet';
import CircleCheckbox from '@/components/CircleCheckbox';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import QuestionHint from '@/components/QuestionHint';
import { classService, scheduleService, teacherService } from '@/services';
import type { Class } from '@/types/class';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

interface SelectableClassOption {
  id: string;
  name: string;
  teacherName: string;
  scheduleText: string;
  studentCount: number;
}

function getClassTeacherName(
  classItem: Class,
  teacherById: Record<string, TeacherUIModel>,
): string {
  const teacherIds = classItem.teachers?.length
    ? classItem.teachers
    : classItem.teacher_id
      ? [classItem.teacher_id]
      : [];
  const teacherNames = teacherIds
    .map((id) => teacherById[id]?.name)
    .filter((name): name is string => Boolean(name));
  return teacherNames.length > 0 ? teacherNames.join('、') : '未分配老师';
}

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return hour * 60 + minute;
}

const BatchRescheduleSelectPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const routerParams = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return instance?.router?.params || {};
  }, []);
  const initialDate = useMemo(() => {
    const rawDate = decodeURIComponent(routerParams.date || '');
    const parsedDate = dayjs(rawDate).isValid() ? dayjs(rawDate) : dayjs();
    return parsedDate.isBefore(dayjs(), 'day') ? dayjs() : parsedDate;
  }, [routerParams]);
  const initialClassId = useMemo(() => decodeURIComponent(routerParams.classId || ''), [routerParams]);

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [classes, setClasses] = useState<Class[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [calendarVisible, setCalendarVisible] = useState(false);

  const selectedWeekday = useMemo(
    () => (selectedDate.day() || 7) as Schedule['day_of_week'],
    [selectedDate],
  );

  const loadData = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [classList, scheduleList, teacherList] = await Promise.all([
        classService.getByTeacher(currentUserId),
        scheduleService.getByTeacher(currentUserId),
        teacherService.getList(),
      ]);
      setClasses(classList);
      setSchedules(scheduleList);
      setTeachers(teacherList);
    } catch (err) {
      logError('BatchRescheduleSelectPage loadData', err);
      Taro.showToast({ title: '页面加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teacherById = useMemo(
    () =>
      teachers.reduce<Record<string, TeacherUIModel>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [teachers],
  );

  const classOptions = useMemo<SelectableClassOption[]>(() => {
    const activeClasses = classes.filter((item) => item.status === 'active');
    return activeClasses
      .map((item) => {
        const daySchedules = schedules
          .filter((schedule) => schedule.class_id === item.id && schedule.day_of_week === selectedWeekday)
          .sort((left, right) => parseTimeToMinutes(left.start_time) - parseTimeToMinutes(right.start_time));
        if (daySchedules.length === 0) {
          return null;
        }
        return {
          id: item.id,
          name: item.name,
          teacherName: getClassTeacherName(item, teacherById),
          studentCount: item.student_count,
          scheduleText: daySchedules.map((schedule) => `${schedule.start_time}-${schedule.end_time}`).join(' / '),
        };
      })
      .filter((item): item is SelectableClassOption => Boolean(item))
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  }, [classes, schedules, selectedWeekday, teacherById]);

  useEffect(() => {
    setSelectedClassIds((prev) => {
      const optionIdSet = new Set(classOptions.map((item) => item.id));
      const next = prev.filter((item) => optionIdSet.has(item));
      if (next.length > 0) {
        return next;
      }
      if (initialClassId && optionIdSet.has(initialClassId)) {
        return [initialClassId];
      }
      return [];
    });
  }, [classOptions, initialClassId]);

  const toggleClassSelection = useCallback((classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((item) => item !== classId) : [...prev, classId],
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedClassIds((prev) =>
      prev.length === classOptions.length ? [] : classOptions.map((item) => item.id),
    );
  }, [classOptions]);

  const handleNext = useCallback(() => {
    if (selectedClassIds.length === 0) {
      Taro.showToast({ title: '请至少选择一个班级', icon: 'none' });
      return;
    }
    const encodedClassIds = encodeURIComponent(JSON.stringify(selectedClassIds));
    const encodedDate = encodeURIComponent(selectedDate.format('YYYY-MM-DD'));
    void Taro.navigateTo({
      url: `/package-course/pages/batch-reschedule-confirm/index?sourceDate=${encodedDate}&classIds=${encodedClassIds}`,
    });
  }, [selectedClassIds, selectedDate]);
  const scheduleWeekdaySet = useMemo(() => {
    return new Set(schedules.map((item) => item.day_of_week));
  }, [schedules]);
  const getDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType => {
      const weekday = (date.day() || 7) as Schedule['day_of_week'];
      if (!scheduleWeekdaySet.has(weekday)) {
        return 'none';
      }
      return date.isBefore(dayjs(), 'day') ? 'past' : 'active';
    },
    [scheduleWeekdaySet],
  );

  return (
    <PageContainer safeBottom className="bg-[#f6f8fc]">
      <View className="min-h-screen">
        <ScrollView scrollY className="h-screen" showScrollbar={false}>
          <View className="px-[24rpx] pb-[200rpx] pt-[24rpx]">
            <View className="overflow-hidden rounded-[30rpx] bg-white shadow-card">
              <View className="bg-[linear-gradient(135deg,#4f7cff_0%,#6ba7ff_100%)] px-[24rpx] py-[26rpx]">
                <View className="flex items-center justify-between">
                  <View>
                    <Text className="block text-[24rpx] text-white/75">批量调课</Text>
                    <Text className="mt-[8rpx] block text-[36rpx] font-semibold text-white">
                      第一步 选择班级
                    </Text>
                  </View>
                  <QuestionHint
                    lines={[
                      '选择后点击「下一步」进入日期调整',
                      '仅调整选中日期当天的课程，不改变长期排课规则',
                      '调课后会自动通知班级学员与家长',
                    ]}
                  />
                </View>
              </View>

              <View className="px-[24rpx] py-[24rpx]">
                <View
                  className="rounded-[24rpx] border border-[#e8edf7] bg-[#f8fbff] px-[22rpx] py-[22rpx]"
                  onClick={() => setCalendarVisible(true)}
                >
                  <View className="flex items-center justify-between">
                    <View className="flex items-center gap-[14rpx]">
                      <View className="flex h-[72rpx] w-[72rpx] items-center justify-center rounded-[20rpx] bg-[#eaf1ff]">
                        <Icon name="mdi-calendar" size="md" color="primary" />
                      </View>
                      <Text className="text-[34rpx] font-semibold text-foreground">
                        {selectedDate.format('YYYY年MM月DD日')}
                      </Text>
                    </View>
                    <View className="flex items-center gap-[8rpx]">
                      <Text className="text-[24rpx] font-medium text-primary">点击选择</Text>
                      <Icon name="mdi-chevron-right" size="sm" color="primary" />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View className="mt-[24rpx] rounded-[28rpx] bg-white px-[24rpx] py-[22rpx] shadow-card">
              <View className="flex items-center justify-between">
                <View>
                  <Text className="text-[30rpx] font-semibold text-foreground">班级列表</Text>
                  <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                    已选 {selectedClassIds.length} 个班级
                  </Text>
                </View>
                {classOptions.length > 0 ? (
                  <View className="rounded-full bg-[#edf4ff] px-[18rpx] py-[10rpx]">
                    <Text className="text-[24rpx] font-medium text-primary" onClick={handleSelectAll}>
                      {selectedClassIds.length === classOptions.length ? '取消全选' : '全选'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View className="mt-[16rpx] flex flex-col gap-[16rpx]">
              {loading ? (
                <View className="rounded-[24rpx] bg-white py-[120rpx] shadow-card">
                  <Empty icon="mdi-calendar-blank" description="班级加载中..." />
                </View>
              ) : null}

              {!loading && classOptions.length === 0 ? (
                <View className="rounded-[24rpx] bg-white py-[120rpx] shadow-card">
                  <Empty icon="mdi-calendar-blank" description="所选日期暂无可调课班级" />
                </View>
              ) : null}

              {!loading &&
                classOptions.map((item) => {
                  const checked = selectedClassIds.includes(item.id);
                  return (
                    <View
                      key={item.id}
                      className={`rounded-[26rpx] border px-[24rpx] py-[24rpx] shadow-card ${
                        checked ? 'border-primary bg-[#eef4ff]' : 'border-white bg-white'
                      }`}
                      onClick={() => toggleClassSelection(item.id)}
                    >
                      <View className="flex items-start justify-between gap-[18rpx]">
                        <View className="min-w-0 flex-1">
                          <View className="flex items-center gap-[12rpx]">
                            <Text className="truncate text-[32rpx] font-semibold text-foreground">{item.name}</Text>
                            <View className={`rounded-full px-[14rpx] py-[8rpx] ${checked ? 'bg-white' : 'bg-[#f4f7fb]'}`}>
                              <Text className="text-[22rpx] text-muted-foreground">{item.studentCount}人</Text>
                            </View>
                          </View>
                          <View className="mt-[14rpx] flex items-center gap-[10rpx]">
                            <Icon name="mdi-account-outline" size="xs" color="mutedForeground" />
                            <Text className="text-[25rpx] text-muted-foreground">{item.teacherName}</Text>
                          </View>
                          <View className="mt-[10rpx] flex items-center gap-[10rpx]">
                            <Icon name="mdi-clock-outline" size="xs" color="mutedForeground" />
                            <Text className="text-[25rpx] text-muted-foreground">
                              {item.scheduleText}
                            </Text>
                          </View>
                        </View>
                        <View className="pt-[8rpx]">
                          <CircleCheckbox checked={checked} size={42} />
                        </View>
                      </View>
                    </View>
                  );
                })}
            </View>
          </View>
        </ScrollView>

        <ActionButton
          text={classOptions.length === 0 ? '暂无可调课班级' : '确定并下一步'}
          disabled={classOptions.length === 0}
          onClick={handleNext}
        />
        <CalendarMonthSheet
          visible={calendarVisible}
          title="选择调课日期"
          selectedDate={selectedDate}
          onClose={() => setCalendarVisible(false)}
          onSelect={setSelectedDate}
          getDateDotType={getDateDotType}
          disablePastDates
        />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(BatchRescheduleSelectPage);
