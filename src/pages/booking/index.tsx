import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CalendarWeekSelector, { type CalendarDotType } from '@/components/CalendarWeekSelector';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import SegmentedControl from '@/components/SegmentedControl';
import { scheduleService } from '@/services';
import type { Schedule } from '@/types/schedule';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

type MainTab = 'booking' | 'my';
type CourseType = 'group' | 'oneOnOne';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const TYPE_OPTIONS = [
  { label: '一对多', value: 'group' },
  { label: '一对一', value: 'oneOnOne' },
];

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

interface BookingCourse {
  id: string;
  name: string;
  timeRange: string;
  teacher: string;
  bookedCount: number;
  totalCount: number;
  deadline: string;
  color: string;
}

const BookingPage: React.FC = () => {
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<MainTab>('booking');
  const [courseType, setCourseType] = useState<CourseType>('group');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSchedules = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const list = await scheduleService.getByTeacher(profile.id);
      setSchedules(list);
    } catch (err) {
      logError('BookingPage loadSchedules', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const courses = useMemo<BookingCourse[]>(() => {
    const targetDayOfWeek = selectedDate.day() || 7;
    const isGroup = courseType === 'group';

    return schedules
      .filter((item) => item.day_of_week === targetDayOfWeek)
      .filter((item) => (isGroup ? !!item.class_id : !!item.student_id))
      .map((item) => {
        const bookedCount = isGroup ? 6 : 1;
        const totalCount = isGroup ? 12 : 1;
        const deadline = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${item.start_time}`)
          .subtract(30, 'minute')
          .format('YYYY-MM-DD HH:mm');

        return {
          id: item.id,
          name: item.class_info?.name || item.student?.name || item.note || '未命名课程',
          timeRange: `${item.start_time}-${item.end_time}`,
          teacher: item.teacher_name || '授课老师',
          bookedCount,
          totalCount,
          deadline,
          color: item.color || 'primary',
        };
      });
  }, [courseType, schedules, selectedDate]);

  const handleToday = useCallback(() => {
    setSelectedDate(dayjs());
  }, []);

  const handleCourseTypeChange = useCallback((value: string) => {
    if (!USE_MOCK && value === 'oneOnOne') {
      Taro.showToast({ title: '真实联调阶段仅支持班级排课', icon: 'none' });
      return;
    }
    setCourseType(value as CourseType);
  }, []);

  const handleBooking = useCallback((course: BookingCourse) => {
    Taro.showToast({ title: `已预约试听：${course.name}`, icon: 'none' });
  }, []);
  const scheduleWeekdaySet = useMemo(() => {
    const isGroup = courseType === 'group';
    return new Set(
      schedules
        .filter((item) => (isGroup ? Boolean(item.class_id) : Boolean(item.student_id)))
        .map((item) => item.day_of_week),
    );
  }, [courseType, schedules]);
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
    <View className="h-screen flex flex-col bg-background">
      <View className="flex bg-white border-b border-border">
        {[
          { key: 'booking', label: '试听约课' },
          { key: 'my', label: '我的预约' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <View
              key={tab.key}
              className="flex-1 flex flex-col items-center pt-[24rpx] pb-0"
              onClick={() => setActiveTab(tab.key as MainTab)}
            >
              <Text
                className={cn(
                  'text-[30rpx] font-medium',
                  isActive ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {tab.label}
              </Text>
              <View
                className={cn(
                  'mt-[16rpx] w-[64rpx] h-[4rpx] rounded-full',
                  isActive ? 'bg-destructive' : 'bg-transparent',
                )}
              />
            </View>
          );
        })}
      </View>

      <ScrollView scrollY className="flex-1" showScrollbar={false}>
        <View className="pb-safe-bar">
          <View className="px-[32rpx] pt-[24rpx] pb-[16rpx]">
            {!USE_MOCK && (
              <View className="mb-[20rpx] rounded-[24rpx] bg-warning/10 border border-warning/30 px-[24rpx] py-[18rpx]">
                <Text className="text-[24rpx] text-warning">
                  当前联调阶段真实排课接口仅支持班级排课，一对一试听先保留页面占位
                </Text>
              </View>
            )}
            <SegmentedControl
              options={TYPE_OPTIONS}
              value={courseType}
              onChange={handleCourseTypeChange}
              className="w-[320rpx]"
            />
          </View>

          <CalendarWeekSelector
            className="px-[32rpx] pb-[24rpx]"
            selectedDate={selectedDate}
            onChange={setSelectedDate}
            getDateDotType={getDateDotType}
          />

          <View className="px-[32rpx] pb-[48rpx]">
            {activeTab === 'booking' && (
              <>
                {loading && courses.length === 0 && (
                  <View className="py-[80rpx] flex justify-center">
                    <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
                  </View>
                )}

                {!loading && courses.length === 0 && (
                  <Empty icon="mdi-calendar-blank" description="该日期暂无可约试听课程" />
                )}

                {courses.map((course) => {
                  const progressPercent =
                    course.totalCount > 0
                      ? Math.round((course.bookedCount / course.totalCount) * 100)
                      : 0;

                  return (
                    <View
                      key={course.id}
                      className="bg-card rounded-[24rpx] p-[28rpx] mb-[20rpx] shadow-card"
                    >
                      <View className="flex items-center justify-between mb-[16rpx]">
                        <Text className="text-[30rpx] font-bold text-foreground truncate flex-1 mr-[16rpx]">
                          {course.name}
                        </Text>
                        <View className="px-[12rpx] py-[4rpx] rounded-[8rpx] bg-primary-bg">
                          <Text className="text-[22rpx] text-primary font-medium">
                            {course.timeRange}
                          </Text>
                        </View>
                      </View>

                      <View className="flex items-center gap-[8rpx] mb-[20rpx]">
                        <Icon name="mdi-account-outline" size="xs" color="muted" />
                        <Text className="text-[26rpx] text-foreground-secondary">
                          上课老师：{course.teacher}
                        </Text>
                      </View>

                      <View className="flex items-center gap-[16rpx] mb-[24rpx]">
                        <Text className="text-[24rpx] text-foreground-secondary whitespace-nowrap">
                          预约人数：
                        </Text>
                        <View className="flex-1 h-[12rpx] bg-muted rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full bg-progress-primary"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </View>
                        <Text className="text-[24rpx] text-foreground-secondary">
                          {course.bookedCount}/{course.totalCount}
                        </Text>
                      </View>

                      <View className="flex items-center justify-between pt-[20rpx] border-t border-border-light">
                        <View className="flex items-center gap-[8rpx]">
                          <Icon name="mdi-clock-alert-outline" size="xs" color="warning" />
                          <Text className="text-[24rpx] text-warning">
                            截止时间：{course.deadline}
                          </Text>
                        </View>
                        <View
                          className="px-[32rpx] py-[12rpx] rounded-full bg-destructive active:opacity-80"
                          onClick={() => handleBooking(course)}
                        >
                          <Text className="text-[26rpx] font-medium text-white">预约</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {activeTab === 'my' && (
              <Empty
                icon="mdi-inbox"
                description={USE_MOCK ? '您还没有预约任何试听课程' : '真实联调阶段暂未接入我的预约列表'}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default withRouteGuard(BookingPage);
