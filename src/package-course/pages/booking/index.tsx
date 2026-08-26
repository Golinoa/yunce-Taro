import { View, Text, ScrollView, Swiper, SwiperItem } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BookingControlSheet from '@/components/booking/BookingControlSheet';
import CalendarWeekSelector, { type CalendarDotType } from '@/components/CalendarWeekSelector';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import SegmentedControl from '@/components/SegmentedControl';
import { scheduleService, teacherService } from '@/services';
import { useCampusStore } from '@/stores/campus';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import {
  createTeacherBookingConfig,
  readTeacherBookingConfigs,
  type TeacherBookingConfig,
  type TeacherBookingStatus,
  writeTeacherBookingConfigs,
} from '@/utils/booking-one-on-one';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';
import { useDateSwiperWindow } from '@/utils/use-date-swiper-window';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

type MainTab = 'booking' | 'my';
type CourseType = 'group' | 'oneOnOne';

const TYPE_OPTIONS = [
  { label: '一对多', value: 'group' },
  { label: '一对一', value: 'oneOnOne' },
];

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

const BOOKING_CARD_SWIPER_DURATION = 260;

/**
 * 预约页可用高度 = 100vh - 导航栏 - 类型选择 - 日历选择器 - 底部预留
 * 用 calc 确保像素级精确，避免 flex 布局在 navigateTo 页面中丢失触摸区域
 * 日历高度由 CalendarWeekSelector 的 week 模式决定，约 280rpx
 * 底部留 48rpx 给 FAB 按钮避让
 */
const SWIPER_HEIGHT_CALC = 'calc(100vh - 88px - 80rpx - 280rpx - 48rpx)';

interface BookingCourse {
  id: string;
  occurrenceKey: string;
  name: string;
  timeRange: string;
  teacher: string;
  bookedCount: number;
  totalCount: number;
  deadline: string;
  note: string;
  room?: string;
  status: 'booking' | 'full' | 'paused';
  color: string;
}

/** 根据日期构建课程列表（Swiper 每页调用） */
function buildCoursesForDate(
  date: dayjs.Dayjs,
  schedules: Schedule[],
  courseType: CourseType,
): BookingCourse[] {
  const dateStr = date.format('YYYY-MM-DD');
  const targetDayOfWeek = date.day() || 7;
  const isGroup = courseType === 'group';

  return schedules
    .filter((item) => item.day_of_week === targetDayOfWeek)
    .filter((item) => (isGroup ? !!item.class_id : !!item.student_id))
    .map((item) => {
      const totalCount = isGroup ? 12 : 1;
      const bookedCount = isGroup ? 6 : 0;
      const deadline = dayjs(`${dateStr} ${item.start_time}`)
        .subtract(30, 'minute')
        .format('YYYY-MM-DD HH:mm');
      const isExpired = dayjs(deadline).isBefore(dayjs());

      return {
        id: item.id,
        occurrenceKey: `${item.id}-${dateStr}`,
        name: item.class_info?.name || item.student?.name || item.note || '未命名课程',
        timeRange: `${item.start_time}-${item.end_time}`,
        teacher: item.teacher_name || '授课老师',
        bookedCount,
        totalCount,
        deadline,
        note: item.note || '',
        room: item.room,
        status: isExpired ? 'paused' : bookedCount >= totalCount ? 'full' : 'booking',
        color: item.color || 'primary',
      };
    });
}

/**
 * 预约页（试听约课）
 *
 * ⚠️ 关键设计决策：本页是 navigateTo 页面（非 tabBar），微信小程序中
 * navigateTo 页面的 page 容器默认启用页面级滚动，会消费触摸手势。
 * 即使设置 disableScroll: true，在某些机型/版本上仍不能完全阻止手势被拦截。
 * 排课页（schedule）是 tabBar 页面，框架对 tabBar 页面禁用页面级滚动，
 * 因此 Swiper + ScrollView 的嵌套可以和平共处。
 *
 * 本页的解决方案：
 * 1. Swiper 使用 calc() 显式像素高度（而非 flex: 1），确保原生层正确注册触摸区域
 * 2. SwiperItem 内部不嵌套 ScrollView（scrollY），避免垂直/水平手势冲突
 *    改用普通 View + overflow-y: auto 让内容超出时自动滚动
 * 3. 禁用页面滚动 disableScroll: true
 */
const BookingPage: React.FC = () => {
  const { profile } = useAuth();
  const currentCampusId = useCampusStore((state) => state.currentCampusId);
  const navSafeHeight = useNavSafeHeight();

  const [activeTab, setActiveTab] = useState<MainTab>('booking');
  const [courseType, setCourseType] = useState<CourseType>('group');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingControlSheetVisible, setBookingControlSheetVisible] = useState(false);
  const [teacherBookingConfigs, setTeacherBookingConfigs] = useState<
    Record<string, TeacherBookingConfig>
  >(() => readTeacherBookingConfigs());

  // 家长视角滑动日期窗口
  const {
    dateWindow: parentDateWindow,
    swiperCurrent: parentSwiperCurrent,
    handleCalendarChange: handleParentCalendarChange,
    handleSwiperChange: handleParentSwiperChange,
    handleSwiperAnimationFinish: handleParentSwiperAnimationFinish,
  } = useDateSwiperWindow({
    selectedDate,
    onDateChange: setSelectedDate,
  });

  const loadSchedules = useCallback(
    async (campusId?: string) => {
      if (!profile?.id) return;
      setLoading(true);
      try {
        const [scheduleList, teacherList] = await Promise.all([
          scheduleService.getByTeacher(profile.id, campusId),
          teacherService.getList(campusId).catch(() => [] as TeacherUIModel[]),
        ]);
        setSchedules(scheduleList);
        setTeachers(teacherList);
      } catch (err) {
        logError('BookingPage loadSchedules', err);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    },
    [profile?.id],
  );

  useEffect(() => {
    loadSchedules(currentCampusId);
  }, [loadSchedules, currentCampusId]);

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

  /** 家长视角：切换老师可预约状态 */
  const handleBookingControlToggle = useCallback(
    (teacherId: string, enabled: boolean) => {
      setTeacherBookingConfigs((prev) => {
        const existing = prev[teacherId];
        const teacher = teachers.find((t) => t.id === teacherId);
        const newStatus: TeacherBookingStatus = enabled ? 'open' : 'rest';
        let updated: TeacherBookingConfig;
        if (existing) {
          updated = { ...existing, status: newStatus, updatedAt: new Date().toISOString() };
        } else {
          updated = createTeacherBookingConfig({
            teacherId,
            teacherName: teacher?.name || '未知老师',
            subject: teacher?.subject,
            campusId: currentCampusId,
            status: newStatus,
          });
        }
        const next = { ...prev, [teacherId]: updated };
        writeTeacherBookingConfigs(next);
        return next;
      });
    },
    [teachers, currentCampusId],
  );

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

  /** 渲染 Swiper 中某日期的课程列表 */
  const renderCourseSwiperItem = useCallback(
    (date: dayjs.Dayjs) => {
      const dateStr = date.format('YYYY-MM-DD');
      const dateCourses = buildCoursesForDate(date, schedules, courseType);

      return (
        /**
         * ⚠️ 关键：SwiperItem 内部不使用 ScrollView（scrollY）
         * 在 navigateTo 页面中，ScrollView 的 scrollY 会与 Swiper 的水平滑动
         * 产生手势冲突——ScrollView 消费垂直方向手势后，原生层判定为"非水平滑动"，
         * 导致 Swiper 完全收不到手势信号。
         * 排课页是 tabBar 页面，page 容器不消费手势，因此不受影响。
         * 这里使用普通 View + overflow-y: auto 让内容超出时仍可滚动，
         * 但不会注册为 ScrollView 原生组件，不会与 Swiper 冲突。
         */
        <View className="h-full bg-schedule-page overflow-y-auto">
          <View className="px-[32rpx] pb-[160rpx]">
            {loading && dateCourses.length === 0 && (
              <View className="py-[80rpx] flex justify-center">
                <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
              </View>
            )}

            {!loading && dateCourses.length === 0 && (
              <Empty icon="mdi-calendar-blank" description="该日期暂无可约试听课程" />
            )}

            {dateCourses.map((course) => {
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

                  <View className="flex items-center gap-[8rpx] mb-[10rpx]">
                    <Icon name="mdi-account-outline" size="xs" color="muted" />
                    <Text className="text-[26rpx] text-foreground-secondary">
                      上课老师：{course.teacher}
                    </Text>
                  </View>

                  <View className="flex items-center gap-[8rpx] mb-[20rpx]">
                    <Icon name="mdi-calendar-range" size="xs" color="muted" />
                    <Text className="text-[24rpx] text-foreground-secondary">
                      上课日期：{dateStr}
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
                    <View className="min-w-0 flex-1 pr-[16rpx]">
                      <View className="flex items-center gap-[8rpx]">
                        <Icon name="mdi-clock-alert-outline" size="xs" color="warning" />
                        <Text className="text-[24rpx] text-warning">
                          截止时间：{course.deadline}
                        </Text>
                      </View>
                    </View>
                    <View
                      className={cn(
                        'px-[32rpx] py-[12rpx] rounded-full',
                        course.status === 'booking'
                          ? 'bg-destructive active:opacity-80'
                          : 'bg-[#ececec]',
                      )}
                      onClick={() => {
                        if (course.status !== 'booking') {
                          Taro.showToast({
                            title: course.status === 'full' ? '已满员' : '已过截止时间',
                            icon: 'none',
                          });
                          return;
                        }
                        handleBooking(course);
                      }}
                    >
                      <Text
                        className={cn(
                          'text-[26rpx] font-medium',
                          course.status === 'booking' ? 'text-white' : 'text-[#9f9f9f]',
                        )}
                      >
                        {course.status === 'booking'
                          ? '预约'
                          : course.status === 'full'
                            ? '已满'
                            : '已截止'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      );
    },
    [courseType, handleBooking, loading, schedules],
  );

  return (
    // 注意：不传 safeBottom —— pb-safe-bottom 会给外层 View 增加 144rpx + safe-area 的 padding，
    // 导致 navigateTo（非 tabBar）页面总高度超过视口，页面产生垂直滚动，
    // 进而消费 Swiper 的水平滑动手势。tabBar 页面（排课页）有特殊处理不受影响。
    <PageContainer className="bg-schedule-page">
      <View className="relative h-screen bg-schedule-page flex flex-col overflow-hidden">
        {/* 自定义导航栏 — 与排课页一致 */}
        <View className="bg-schedule-header flex-shrink-0">
          <View
            className="flex items-end px-[18rpx] pb-[18rpx]"
            style={{ height: `${navSafeHeight}px` }}
          >
            <View className="flex items-center gap-[14rpx]">
              {[
                { key: 'booking', label: '试听约课' },
                { key: 'my', label: '我的预约' },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <View
                    key={tab.key}
                    className={cn(
                      'flex items-center justify-center h-[64rpx] px-[24rpx] rounded-full transition-colors',
                      isActive ? 'bg-white/20' : 'bg-transparent',
                    )}
                    onClick={() => setActiveTab(tab.key as MainTab)}
                  >
                    <Text
                      className={cn(
                        'text-[28rpx] font-medium',
                        isActive ? 'text-white' : 'text-white/60',
                      )}
                    >
                      {tab.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {activeTab === 'booking' && (
          <>
            {/* 课程类型选择 + 提示 */}
            <View className="bg-schedule-page flex-shrink-0 px-[32rpx] pt-[24rpx] pb-[16rpx]">
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

            {/* 日历选择器 */}
            <View className="bg-schedule-page flex-shrink-0">
              <CalendarWeekSelector
                className="px-[32rpx] pt-[26rpx] pb-[24rpx]"
                selectedDate={selectedDate}
                onChange={handleParentCalendarChange}
                getDateDotType={getDateDotType}
              />
            </View>

            {/* 滑动切换日期课程列表
                关键修复：navigateTo 页面中 Swiper 必须使用 calc() 显式高度，
                且 SwiperItem 内部不能用 ScrollView（scrollY），
                否则垂直/水平手势冲突导致 Swiper 完全收不到手势信号。 */}
            <Swiper
              className="bg-schedule-page"
              style={{ height: SWIPER_HEIGHT_CALC }}
              current={parentSwiperCurrent}
              duration={BOOKING_CARD_SWIPER_DURATION}
              easingFunction="easeOutCubic"
              skipHiddenItemLayout
              onChange={handleParentSwiperChange}
              onAnimationFinish={handleParentSwiperAnimationFinish}
            >
              {parentDateWindow.map((date) => (
                <SwiperItem key={date.format('YYYY-MM-DD')} itemId={date.format('YYYY-MM-DD')}>
                  {renderCourseSwiperItem(date)}
                </SwiperItem>
              ))}
            </Swiper>

            {/* FAB：老师预约控制 */}
            <View
              className="fixed bottom-[72rpx] right-[32rpx] z-20"
              onClick={() => setBookingControlSheetVisible(true)}
            >
              <View className="flex h-[88rpx] w-[88rpx] items-center justify-center rounded-full bg-[#f97b6d] shadow-[0_10rpx_24rpx_rgba(249,123,109,0.3)]">
                <Icon name="mdi-tune-variant" size="md" color="white" />
              </View>
            </View>
          </>
        )}

        {activeTab === 'my' && (
          <ScrollView scrollY className="flex-1" showScrollbar={false}>
            <View className="pb-safe-bar">
              <View className="px-[32rpx] pb-[48rpx]">
                <Empty
                  icon="mdi-inbox"
                  description={
                    USE_MOCK ? '您还没有预约任何试听课程' : '真实联调阶段暂未接入我的预约列表'
                  }
                />
              </View>
            </View>
          </ScrollView>
        )}

        {/* 老师预约控制弹窗 */}
        <BookingControlSheet
          visible={bookingControlSheetVisible}
          teachers={teachers}
          bookingConfigs={teacherBookingConfigs}
          onConfigChange={handleBookingControlToggle}
          onClose={() => setBookingControlSheetVisible(false)}
        />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(BookingPage);
