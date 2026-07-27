import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '@/components/ActionButton';
import CalendarMonthSheet from '@/components/CalendarMonthSheet';
import type { CalendarDotType } from '@/components/CalendarWeekSelector';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import WorkflowHeaderCard from '@/components/reschedule/WorkflowHeaderCard';
import {
  classService,
  notificationService,
  scheduleService,
  studentService,
  teacherService,
  temporaryRescheduleService,
} from '@/services';
import type { TemporaryReschedule } from '@/types';
import type { Class } from '@/types/class';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { getDefaultRescheduleTargetDate } from '@/utils/reschedule-date';
import { withRouteGuard } from '@/utils/route-guard';
import { buildVisibleSchedulesForDate } from '@/utils/visible-schedules';

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return hour * 60 + minute;
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

const BatchRescheduleConfirmPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const routerParams = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return instance?.router?.params || {};
  }, []);
  const sourceDate = useMemo(
    () => decodeURIComponent(routerParams.sourceDate || ''),
    [routerParams],
  );
  const selectedClassIds = useMemo<string[]>(() => {
    try {
      const raw = decodeURIComponent(routerParams.classIds || '[]');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [routerParams]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [temporaryReschedules, setTemporaryReschedules] = useState<TemporaryReschedule[]>([]);
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [targetDate, setTargetDate] = useState(() => {
    return getDefaultRescheduleTargetDate(sourceDate);
  });
  const [calendarVisible, setCalendarVisible] = useState(false);

  const sourceWeekday = useMemo(
    () => (dayjs(sourceDate).day() || 7) as Schedule['day_of_week'],
    [sourceDate],
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
      logError('BatchRescheduleConfirmPage loadData', err);
      Taro.showToast({ title: '页面加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadTemporaryReschedules = useCallback(async () => {
    if (!currentUserId || !sourceDate || !dayjs(sourceDate).isValid()) {
      return;
    }
    try {
      const sourceDay = dayjs(sourceDate);
      const rangeStart = (sourceDay.isBefore(targetDate, 'day') ? sourceDay : targetDate)
        .startOf('month')
        .subtract(7, 'day');
      const rangeEnd = (sourceDay.isAfter(targetDate, 'day') ? sourceDay : targetDate)
        .endOf('month')
        .add(7, 'day');
      const list = await temporaryRescheduleService.getByTeacherAndRange(
        currentUserId,
        rangeStart.format('YYYY-MM-DD'),
        rangeEnd.format('YYYY-MM-DD'),
      );
      setTemporaryReschedules(list);
    } catch (err) {
      logError('BatchRescheduleConfirmPage loadTemporaryReschedules', err);
      Taro.showToast({ title: '临时调课加载失败', icon: 'none' });
    }
  }, [currentUserId, sourceDate, targetDate]);

  useEffect(() => {
    void loadTemporaryReschedules();
  }, [loadTemporaryReschedules]);

  const classById = useMemo(
    () =>
      classes.reduce<Record<string, Class>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [classes],
  );
  const teacherById = useMemo(
    () =>
      teachers.reduce<Record<string, TeacherUIModel>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [teachers],
  );

  const affectedSchedules = useMemo(() => {
    return buildVisibleSchedulesForDate({
      date: dayjs(sourceDate),
      schedules,
      temporaryReschedules,
    })
      .filter((item) => Boolean(item.class_id) && selectedClassIds.includes(item.class_id || ''))
      .sort(
        (left, right) => parseTimeToMinutes(left.start_time) - parseTimeToMinutes(right.start_time),
      );
  }, [schedules, selectedClassIds, sourceDate, temporaryReschedules]);

  const selectedClasses = useMemo(() => {
    return selectedClassIds
      .map((id) => classById[id])
      .filter((item): item is Class => Boolean(item))
      .map((item) => {
        const classSchedules = affectedSchedules
          .filter((schedule) => schedule.class_id === item.id)
          .map((schedule) => `${schedule.start_time}-${schedule.end_time}`)
          .join(' / ');
        return {
          id: item.id,
          name: item.name,
          teacherName: getClassTeacherName(item, teacherById),
          studentCount: item.student_count,
          scheduleText: classSchedules || '当天无课',
        };
      });
  }, [affectedSchedules, classById, selectedClassIds, teacherById]);

  const sourceWeekdayText = useMemo(
    () => `周${'一二三四五六日'[sourceWeekday - 1]}`,
    [sourceWeekday],
  );
  const getDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType => {
      const visibleSchedules = buildVisibleSchedulesForDate({
        date,
        schedules,
        temporaryReschedules,
      });
      if (visibleSchedules.length === 0) {
        return 'none';
      }
      return date.isBefore(dayjs(), 'day') ? 'past' : 'active';
    },
    [schedules, temporaryReschedules],
  );

  const notifyStudentAndParents = useCallback(
    async (studentId: string, title: string, content: string) => {
      try {
        await notificationService.send({
          sender_id: currentUserId,
          receiver_id: studentId,
          title,
          content,
          related_id: studentId,
        });
      } catch (err) {
        logError('BatchRescheduleConfirmPage notify student', err);
      }

      try {
        const parents = await studentService.getParents(studentId);
        for (const binding of parents) {
          await notificationService.send({
            sender_id: currentUserId,
            receiver_id: binding.parent_id,
            title,
            content,
            related_id: studentId,
          });
        }
      } catch (err) {
        logError('BatchRescheduleConfirmPage notify parents', err);
      }
    },
    [currentUserId],
  );

  const handleSubmit = useCallback(async () => {
    if (saving) {
      return;
    }
    if (!sourceDate || !dayjs(sourceDate).isValid()) {
      Taro.showToast({ title: '原上课日期异常', icon: 'none' });
      return;
    }
    if (selectedClassIds.length === 0) {
      Taro.showToast({ title: '请先选择班级', icon: 'none' });
      return;
    }

    const targetDateStr = targetDate.format('YYYY-MM-DD');
    if (targetDateStr === sourceDate) {
      Taro.showToast({ title: '新日期不能与原日期相同', icon: 'none' });
      return;
    }
    if (affectedSchedules.length === 0) {
      Taro.showToast({ title: '所选班级在当天没有可调课程', icon: 'none' });
      return;
    }

    const conflictItems = await temporaryRescheduleService.checkDateConflict({
      teacherId: currentUserId,
      sourceDate,
      targetDate: targetDateStr,
      movingSchedules: affectedSchedules,
      allSchedules: schedules,
      classById,
    });
    if (conflictItems.length > 0) {
      Taro.showToast({
        title: '目标日期存在时间冲突',
        icon: 'none',
        duration: 3000,
      });
      return;
    }

    setSaving(true);
    try {
      await temporaryRescheduleService.saveBatch({
        teacherId: currentUserId,
        sourceDate,
        targetDate: targetDateStr,
        schedules: affectedSchedules,
      });

      for (const classItem of selectedClasses) {
        const students = await classService.getStudents(classItem.id);
        const title = '调课通知';
        const content = `您所在的「${classItem.name}」已从 ${dayjs(sourceDate).format('MM月DD日')} 调整到 ${targetDate.format('MM月DD日')}，上课时间 ${classItem.scheduleText} 不变，仅本次课程生效。`;
        for (const student of students) {
          await notifyStudentAndParents(student.id, title, content);
        }
      }

      Taro.showToast({ title: '批量调课成功', icon: 'success' });
      setTimeout(() => {
        void Taro.navigateBack({ delta: 2 });
      }, 1200);
    } catch (err) {
      logError('BatchRescheduleConfirmPage handleSubmit', err);
      Taro.showToast({ title: '调课失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    affectedSchedules,
    classById,
    currentUserId,
    notifyStudentAndParents,
    saving,
    schedules,
    selectedClassIds.length,
    selectedClasses,
    sourceDate,
    targetDate,
  ]);

  return (
    <PageContainer safeBottom className="bg-[#f6f8fc]">
      <View className="min-h-screen">
        <ScrollView scrollY className="h-screen" showScrollbar={false}>
          <View className="px-[24rpx] pb-[200rpx] pt-[24rpx]">
            <WorkflowHeaderCard
              eyebrow="批量调课"
              title="第二步 确认调课"
              tone="green"
              hintLines={[
                '仅调整选中日期当天的课程，不改变长期排课规则',
                '确认后会自动通知相关班级学员和家长',
              ]}
            >
              <View className="flex items-center gap-[12rpx] rounded-[20rpx] bg-[#f4fffa] px-[18rpx] py-[18rpx]">
                <View className="flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full bg-[#e8f7ee]">
                  <Icon name="mdi-swap-horizontal" size="xs" color="#16a34a" />
                </View>
                <Text className="text-[24rpx] font-medium text-foreground-secondary">
                  {dayjs(sourceDate).format('MM月DD日')} {sourceWeekdayText}
                </Text>
                <Icon name="mdi-arrow-right" size="xs" color="mutedForeground" />
                <Text className="text-[24rpx] font-semibold text-[#16a34a]">
                  {targetDate.format('MM月DD日')}
                </Text>
              </View>

              <View
                className="mt-[14rpx] rounded-[24rpx] border border-[#dff3e8] bg-[#f4fffa] px-[22rpx] py-[22rpx]"
                onClick={() => setCalendarVisible(true)}
              >
                <View className="flex items-center justify-between">
                  <View className="flex items-center gap-[14rpx]">
                    <View className="flex h-[72rpx] w-[72rpx] items-center justify-center rounded-[20rpx] bg-[#e4fff1]">
                      <Icon name="mdi-calendar-check" size="md" color="#16a34a" />
                    </View>
                    <Text className="text-[34rpx] font-semibold text-foreground">
                      {targetDate.format('YYYY年MM月DD日')}
                    </Text>
                  </View>
                  <View className="flex items-center gap-[8rpx]">
                    <Text className="text-[24rpx] font-medium text-[#16a34a]">点击选择</Text>
                    <Icon name="mdi-chevron-right" size="sm" color="#16a34a" />
                  </View>
                </View>
              </View>
            </WorkflowHeaderCard>

            <View className="mt-[24rpx] rounded-[28rpx] bg-white px-[24rpx] py-[22rpx] shadow-card">
              <View className="flex items-center justify-between">
                <View>
                  <Text className="text-[30rpx] font-semibold text-foreground">调课班级</Text>
                  <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                    共 {selectedClasses.length} 个班级
                  </Text>
                </View>
                <View className="rounded-full bg-[#edfdf3] px-[18rpx] py-[10rpx]">
                  <Text className="text-[24rpx] font-medium text-[#16a34a]">
                    {affectedSchedules.length} 节课
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-[16rpx] flex flex-col gap-[16rpx]">
              {loading ? (
                <View className="rounded-[24rpx] bg-white py-[120rpx] shadow-card">
                  <Empty icon="mdi-calendar-blank" description="班级加载中..." />
                </View>
              ) : null}

              {!loading && selectedClasses.length === 0 ? (
                <View className="rounded-[24rpx] bg-white py-[120rpx] shadow-card">
                  <Empty icon="mdi-calendar-blank" description="未获取到可调课班级" />
                </View>
              ) : null}

              {!loading &&
                selectedClasses.map((item) => (
                  <View
                    key={item.id}
                    className="rounded-[26rpx] bg-white px-[24rpx] py-[24rpx] shadow-card"
                  >
                    <View className="flex items-center justify-between gap-[16rpx]">
                      <Text className="truncate text-[32rpx] font-semibold text-foreground">
                        {item.name}
                      </Text>
                      <View className="rounded-full bg-[#f4f7fb] px-[14rpx] py-[8rpx]">
                        <Text className="flex-shrink-0 text-[22rpx] text-muted-foreground">
                          {item.studentCount}人
                        </Text>
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
                ))}
            </View>
          </View>
        </ScrollView>

        <ActionButton
          text={saving ? '提交中...' : '确认调课'}
          disabled={loading || selectedClasses.length === 0 || saving}
          onClick={handleSubmit}
        />
        <CalendarMonthSheet
          visible={calendarVisible}
          title="选择新日期"
          selectedDate={targetDate}
          onClose={() => setCalendarVisible(false)}
          onSelect={setTargetDate}
          getDateDotType={getDateDotType}
          disablePastDates
        />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(BatchRescheduleConfirmPage);
