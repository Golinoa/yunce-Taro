/**
 * 预约详情页 package-course/pages/booking-record-detail/index
 *
 * 家长端查看单次课程预约的详情，展示状态、上课时间、老师、校区、教室、履约进度和快捷操作。
 * 全部使用 UnoCSS Token，随主题色联动。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { classBookingService, notificationService } from '@/services';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useAuth } from '@/utils/auth';
import {
  fetchBookingRules,
  getBookingRuleSummaryList,
  readBookingRules,
  type BookingRuleState,
} from '@/utils/booking-rules';
import { logError } from '@/utils/logger';
import {
  readParentBookingById,
  updateParentBookingStatus,
  type ParentBookingItem,
} from '@/utils/parent-bookings';
import { withRouteGuard } from '@/utils/route-guard';

type BookingRecordStatus = 'upcoming' | 'completed' | 'leave' | 'expired';

const STATUS_META: Record<
  BookingRecordStatus,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  upcoming: {
    label: '待上课',
    badgeClassName: 'tag-primary',
    dotClassName: 'bg-primary',
  },
  completed: {
    label: '已完成',
    badgeClassName: 'tag-success',
    dotClassName: 'bg-success',
  },
  leave: {
    label: '已请假',
    badgeClassName: 'tag-warning',
    dotClassName: 'bg-warning',
  },
  expired: {
    label: '已失效',
    badgeClassName: 'bg-muted text-muted-foreground',
    dotClassName: 'bg-muted-foreground',
  },
};

function mapParentBookingStatusToRecordStatus(
  status?: ParentBookingItem['status'],
): BookingRecordStatus {
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'leave') {
    return 'leave';
  }
  if (status === 'expired') {
    return 'expired';
  }
  return 'upcoming';
}

const BookingRecordDetailPage: React.FC = () => {
  const { profile } = useAuth();
  const routerParams = useMemo(() => Taro.getCurrentInstance().router?.params || {}, []);
  const bookingId = decodeURIComponent(routerParams.id || '');
  const fallbackStatus = (decodeURIComponent(routerParams.status || 'upcoming') ||
    'upcoming') as BookingRecordStatus;
  const fallbackStudentName = decodeURIComponent(routerParams.studentName || '未命名学员');
  const fallbackClassName = decodeURIComponent(routerParams.className || '未命名课程');
  const fallbackLessonDate = decodeURIComponent(routerParams.lessonDate || '');
  const fallbackTimeRange = decodeURIComponent(routerParams.timeRange || '');
  const fallbackTeacherName = decodeURIComponent(routerParams.teacherName || '授课老师');
  const fallbackCampusName = decodeURIComponent(routerParams.campusName || '未设置校区');
  const fallbackRoom = decodeURIComponent(routerParams.room || '教室待定');

  const [booking, setBooking] = useState<ParentBookingItem | null>(() =>
    bookingId ? readParentBookingById(bookingId) : null,
  );
  const [status, setStatus] = useState<BookingRecordStatus>(() =>
    booking ? mapParentBookingStatusToRecordStatus(booking.status) : fallbackStatus,
  );
  const [rules, setRules] = useState<BookingRuleState>(() => readBookingRules());

  const refreshBooking = useCallback(async () => {
    if (!bookingId) {
      return;
    }
    let nextBooking = readParentBookingById(bookingId);
    try {
      const remote = (await classBookingService.listMyRecords()).find(
        (item) => item.id === bookingId,
      );
      if (remote) {
        const remoteStatus =
          remote.status === 'cancelled' ? 'cancelled' : remote.fulfillment_status || 'upcoming';
        nextBooking = {
          id: remote.id,
          userId: profile?.id || '',
          studentId: remote.student_id,
          studentName: remote.student_name,
          occurrenceKey: `${remote.class_id}:${remote.slot.lesson_date}:${remote.slot.start_time}`,
          courseId: remote.class_id,
          courseName: remote.slot.class_name || '团课',
          courseType: 'group',
          classId: remote.class_id,
          campusId: remote.slot.campus_id,
          lessonDate: remote.slot.lesson_date,
          timeRange: `${remote.slot.start_time}-${remote.slot.end_time}`,
          teacherName: remote.slot.teacher_name || '授课老师',
          deadline: remote.slot.lesson_date,
          room: remote.slot.room || undefined,
          status:
            remoteStatus === 'completed'
              ? 'completed'
              : remoteStatus === 'leave'
                ? 'leave'
                : remoteStatus === 'cancelled'
                  ? 'cancelled'
                  : 'booked',
          createdAt: remote.created_at,
        };
      }
    } catch (error) {
      logError('BookingRecordDetailPage refresh remote booking', error);
    }
    setBooking(nextBooking);
    if (nextBooking) {
      setStatus(mapParentBookingStatusToRecordStatus(nextBooking.status));
    }
  }, [bookingId, profile?.id]);

  useDidShow(() => {
    void refreshBooking();
    void fetchBookingRules()
      .then(setRules)
      .catch(() => undefined);
  });

  const studentName = booking?.studentName || fallbackStudentName;
  const className = booking?.courseName || fallbackClassName;
  const lessonDate = booking?.lessonDate || fallbackLessonDate;
  const timeRange = booking?.timeRange || fallbackTimeRange;
  const teacherName = booking?.teacherName || fallbackTeacherName;
  const campusName = booking?.campusName || fallbackCampusName;
  const room = booking?.room || fallbackRoom;

  const meta = STATUS_META[status] || STATUS_META.upcoming;
  const ruleSummaryList = useMemo(() => getBookingRuleSummaryList(rules), [rules]);

  const actionList = useMemo(() => {
    if (status === 'upcoming') {
      const list = ['发送上课提醒', '标记已完成', '标记请假'];
      if (rules.cancelEnabled) {
        list.push('取消预约');
      }
      return list;
    }
    if (status === 'completed') {
      return ['发送课后回访'];
    }
    if (status === 'leave') {
      return ['恢复待上课', '发送请假确认'];
    }
    return ['恢复待上课', '发送失效提醒'];
  }, [rules.cancelEnabled, status]);

  const sendNotification = useCallback(
    async (params: { content: string; receiverId?: string; title: string }) => {
      if (!params.receiverId) {
        return;
      }

      try {
        await notificationService.send({
          sender_id: profile?.id || params.receiverId,
          receiver_id: params.receiverId,
          related_id: bookingId,
          title: params.title,
          content: params.content,
          type: 'general',
        });
      } catch (error) {
        logError('BookingRecordDetailPage send notification', error);
      }
    },
    [bookingId, profile?.id],
  );

  const handleAction = useCallback(
    async (label: string) => {
      if (!bookingId) {
        Taro.showToast({ title: '预约记录不存在', icon: 'none' });
        return;
      }

      if (
        label === '发送上课提醒' ||
        label === '发送课后回访' ||
        label === '发送请假确认' ||
        label === '发送失效提醒'
      ) {
        const notificationTitleMap: Record<string, string> = {
          发送上课提醒: '上课提醒通知',
          发送课后回访: '课后回访通知',
          发送请假确认: '请假确认通知',
          发送失效提醒: '失效提醒通知',
        };
        const notificationContentMap: Record<string, string> = {
          发送上课提醒: `请按时参加「${className}」，上课时间为 ${lessonDate} ${timeRange}。`,
          发送课后回访: `感谢参加「${className}」，老师将尽快与您完成课后回访。`,
          发送请假确认: `您申请的「${className}」请假已记录，后续安排请留意老师通知。`,
          发送失效提醒: `「${className}」预约已失效，如需继续上课请重新预约。`,
        };
        await sendNotification({
          receiverId: booking?.userId,
          title: notificationTitleMap[label] || '课程通知',
          content: notificationContentMap[label] || `${label}已处理。`,
        });
        Taro.showToast({ title: `${label}已发送`, icon: 'success' });
        return;
      }

      if (label === '标记已完成') {
        await classBookingService.updateRecordStatus(bookingId, 'completed');
        updateParentBookingStatus(bookingId, 'completed');
        await sendNotification({
          receiverId: booking?.userId,
          title: '课程完成通知',
          content: `您预约的「${className}」已完成，时间为 ${lessonDate} ${timeRange}。`,
        });
        await refreshBooking();
        Taro.showToast({ title: '已标记为完成', icon: 'success' });
        return;
      }

      if (label === '标记请假') {
        await classBookingService.updateRecordStatus(bookingId, 'leave');
        updateParentBookingStatus(bookingId, 'leave');
        await sendNotification({
          receiverId: booking?.userId,
          title: '课程请假通知',
          content: `您预约的「${className}」已标记为请假，时间为 ${lessonDate} ${timeRange}。`,
        });
        await refreshBooking();
        Taro.showToast({ title: '已标记为请假', icon: 'success' });
        return;
      }

      if (label === '恢复待上课') {
        await classBookingService.updateRecordStatus(bookingId, 'upcoming');
        updateParentBookingStatus(bookingId, 'booked');
        await sendNotification({
          receiverId: booking?.userId,
          title: '预约恢复通知',
          content: `您预约的「${className}」已恢复为待上课，时间为 ${lessonDate} ${timeRange}。`,
        });
        await refreshBooking();
        Taro.showToast({ title: '已恢复为待上课', icon: 'success' });
        return;
      }

      if (label === '取消预约') {
        await classBookingService.removeBookingRecord(bookingId);
        updateParentBookingStatus(bookingId, 'cancelled');
        await sendNotification({
          receiverId: booking?.userId,
          title: '预约取消通知',
          content: `您预约的「${className}」已取消，原上课时间为 ${lessonDate} ${timeRange}。`,
        });
        Taro.showToast({ title: '已取消预约', icon: 'success' });
        void subscribeMessageService.runFlow('E25', {
          bookingLabel: className,
          className,
        });
        Taro.navigateBack();
        return;
      }
      Taro.showToast({ title: '操作已处理', icon: 'success' });
    },
    [
      booking?.occurrenceKey,
      booking?.userId,
      bookingId,
      className,
      lessonDate,
      refreshBooking,
      sendNotification,
      timeRange,
    ],
  );

  return (
    <PageContainer safeBottom className="bg-background">
      <View className="h-screen bg-background">
        <ScrollView scrollY className="h-full" showScrollbar={false}>
          <View className="px-[24rpx] pb-[56rpx] pt-[24rpx] flex flex-col gap-[18rpx]">
            {/* 基本信息卡片 */}
            <View className="rounded-[28rpx] bg-card px-[24rpx] py-[24rpx] shadow-card">
              <View className="mb-[18rpx] flex items-center justify-between gap-[16rpx]">
                <View className="min-w-0 flex-1">
                  <Text className="block text-[34rpx] font-semibold text-foreground">
                    {studentName}
                  </Text>
                  <Text className="mt-[10rpx] block text-[24rpx] text-muted-foreground">
                    {className}
                  </Text>
                </View>
                <View
                  className={['rounded-full px-[18rpx] py-[8rpx]', meta.badgeClassName].join(' ')}
                >
                  <Text className="text-[22rpx] font-medium">{meta.label}</Text>
                </View>
              </View>

              <View className="flex flex-col gap-[12rpx]">
                <View className="flex items-center">
                  <View
                    className={[
                      'mr-[14rpx] h-[10rpx] w-[10rpx] rounded-full',
                      meta.dotClassName,
                    ].join(' ')}
                  />
                  <Text className="text-[26rpx] text-foreground">
                    上课时间：{lessonDate} {timeRange}
                  </Text>
                </View>
                <View className="flex items-center">
                  <View className="mr-[14rpx] h-[10rpx] w-[10rpx] rounded-full bg-warning" />
                  <Text className="text-[26rpx] text-foreground">授课老师：{teacherName}</Text>
                </View>
                <View className="flex items-center">
                  <View className="mr-[14rpx] h-[10rpx] w-[10rpx] rounded-full bg-primary" />
                  <Text className="text-[26rpx] text-foreground">上课校区：{campusName}</Text>
                </View>
                <View className="flex items-center">
                  <View className="mr-[14rpx] h-[10rpx] w-[10rpx] rounded-full bg-purple" />
                  <Text className="text-[26rpx] text-foreground">教室信息：{room}</Text>
                </View>
              </View>
            </View>

            {/* 规则快照 */}
            <View className="rounded-[28rpx] bg-card px-[24rpx] py-[22rpx] shadow-card">
              <Text className="mb-[16rpx] block text-[28rpx] font-semibold text-foreground">
                规则快照
              </Text>
              {ruleSummaryList.length ? (
                <View className="mb-[14rpx] flex flex-wrap gap-[12rpx]">
                  {ruleSummaryList.map((summary) => (
                    <View key={summary} className="rounded-full bg-primary-10 px-[16rpx] py-[8rpx]">
                      <Text className="text-[22rpx] text-primary">{summary}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text className="block text-[24rpx] leading-[38rpx] text-muted-foreground">
                {rules.cancelEnabled
                  ? `当前支持取消预约，需在开课前 ${rules.cancelDeadlineHours} 小时前完成。`
                  : '当前规则不支持取消预约。'}
                {' 当前预约提交后直接生效，无需教师审核。'}
              </Text>
            </View>

            {/* 履约进度 */}
            <View className="rounded-[28rpx] bg-card px-[24rpx] py-[22rpx] shadow-card">
              <Text className="mb-[16rpx] block text-[28rpx] font-semibold text-foreground">
                履约进度
              </Text>
              <View className="flex flex-col gap-[16rpx]">
                {[
                  {
                    title: '预约已创建',
                    desc: `${studentName} 已进入当前课次预约名单`,
                  },
                  {
                    title: status === 'upcoming' ? '待上课' : meta.label,
                    desc:
                      status === 'upcoming'
                        ? '等待教师确认开课并按计划上课'
                        : `当前状态为 ${meta.label}`,
                  },
                  {
                    title: '后续动作',
                    desc:
                      status === 'completed'
                        ? '建议发送课后回访'
                        : '可在下方执行提醒、履约、取消等操作',
                  },
                ].map((item, index) => (
                  <View key={item.title} className="flex items-start">
                    <View className="mr-[16rpx] mt-[6rpx] flex h-[36rpx] w-[36rpx] items-center justify-center rounded-full bg-primary-10">
                      <Text className="text-[20rpx] font-semibold text-primary">{index + 1}</Text>
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="block text-[26rpx] font-medium text-foreground">
                        {item.title}
                      </Text>
                      <Text className="mt-[6rpx] block text-[24rpx] leading-[36rpx] text-muted-foreground">
                        {item.desc}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 快捷操作 */}
            <View className="rounded-[28rpx] bg-card px-[24rpx] py-[22rpx] shadow-card">
              <Text className="mb-[16rpx] block text-[28rpx] font-semibold text-foreground">
                快捷操作
              </Text>
              <View className="flex flex-col gap-[14rpx]">
                {actionList.map((label) => (
                  <View
                    key={label}
                    className="flex items-center justify-between rounded-[20rpx] bg-muted px-[20rpx] py-[18rpx] active:bg-muted/80"
                    onClick={() => handleAction(label)}
                  >
                    <View className="flex items-center gap-[12rpx]">
                      <Icon name="mdi-lightning-bolt-outline" size="xs" color="mutedForeground" />
                      <Text className="text-[26rpx] text-foreground">{label}</Text>
                    </View>
                    <Icon name="mdi-chevron-right" size="xs" color="mutedForeground" />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(BookingRecordDetailPage);
