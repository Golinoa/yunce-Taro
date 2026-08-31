/**
 * 约课视图组件（老师端一对一私教约课）
 *
 * 设计稿：日历下方提供「约课 / 记录」Tab 切换。
 * - 约课：展示当日可预约私教的老师卡片，点击「管理」进入老师时段管理。
 * - 记录：展示当日已预约的体验课记录卡片，点击「代约」为对应时段补充学员。
 * 班课试听统一回退到排课页发起，不再在此页面展示。
 * 底部不再保留「确认预约」按钮。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback, useEffect } from 'react';
import TeacherBookingSwitchSheet from '@/components/booking/TeacherBookingSwitchSheet';
import { type CalendarDotType } from '@/components/CalendarWeekSelector';
import ClassAvatar from '@/components/class/ClassAvatar';
import Icon from '@/components/Icon';
import CalendarSwiper from '@/components/schedule/CalendarSwiper';
import SwappableScheduleCard from '@/components/schedule/SwappableScheduleCard';
import { leadService, teacherService } from '@/services';
import type { LeadBooking, TrialSlotConfig } from '@/types/lead';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import {
  createTeacherBookingConfig,
  readTeacherBookingConfig,
  writeTeacherBookingConfig,
} from '@/utils/booking-one-on-one';
import TrialBookingSkeleton from '../TrialBookingSkeleton';

export type TrialMode = 'group' | 'private';

export interface TrialBookingViewProps {
  /** 默认选中的线索 ID */
  initialLeadId?: string;
  /** 默认模式（已废弃，始终使用 private） */
  initialMode?: TrialMode;
  /** 默认日期 YYYY-MM-DD */
  initialDate?: string;
  /** 默认老师 ID */
  initialTeacherId?: string;
  className?: string;
  /** 预约成功后的回调，由父组件控制返回/切页逻辑 */
  onSuccess?: () => void;
  /** 外部触发的刷新版本号（例如老师预约开关变化后递增） */
  refreshKey?: number;
  /** 老师预约开关弹窗是否显示（由外部加号按钮控制） */
  switchSheetVisible?: boolean;
  /** 关闭老师预约开关弹窗 */
  onSwitchSheetClose?: () => void;
  /** 家长端：隐藏管理/代约/左滑，展示预约入口 */
  isParent?: boolean;
}

type BookingTab = 'booking' | 'record';

type BookingDisplayStatus = 'upcoming' | 'ongoing' | 'ended' | 'cancelled';

type DifficultyKey = 'all' | 'basic' | 'intermediate' | 'advanced';

/** 预约状态元数据（仅四种展示状态） */
const BOOKING_STATUS_META: Record<BookingDisplayStatus, { label: string; textClassName: string }> =
  {
    upcoming: { label: '未开始', textClassName: 'text-primary' },
    ongoing: { label: '进行中', textClassName: 'text-warning' },
    ended: { label: '已结束', textClassName: 'text-success' },
    cancelled: { label: '已取消', textClassName: 'text-muted-foreground' },
  };

/** 课程难度标签元数据 */
const DIFFICULTY_META: Record<DifficultyKey, { label: string; badgeClassName: string }> = {
  all: { label: '所有人', badgeClassName: 'bg-info/10 text-info' },
  basic: { label: '基础', badgeClassName: 'bg-success/10 text-success' },
  intermediate: { label: '进阶', badgeClassName: 'bg-warning/10 text-warning' },
  advanced: { label: '高级', badgeClassName: 'bg-destructive/10 text-destructive' },
};

/** 根据预约状态和当前时间解析卡片展示状态 */
function resolveBookingDisplayStatus(
  status: LeadBooking['status'],
  startAt: dayjs.Dayjs,
  endAt: dayjs.Dayjs,
): BookingDisplayStatus {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'completed' || status === 'no_show') return 'ended';

  const now = dayjs();
  if (now.isBefore(startAt)) return 'upcoming';
  if (now.isAfter(endAt)) return 'ended';
  return 'ongoing';
}

interface TeacherWithSlots {
  teacher: TeacherUIModel;
  slots: TrialSlotConfig[];
  /** 当日是否至少有一个可预约空位 */
  bookable: boolean;
}

const BookingTabLabels: Record<BookingTab, string> = {
  booking: '私教',
  record: '记录',
};

const BookingTabSwitch: React.FC<{
  active: BookingTab;
  onChange: (tab: BookingTab) => void;
}> = ({ active, onChange }) => {
  return (
    <View className="flex items-center justify-center">
      <View className="inline-flex items-center rounded-full bg-muted p-[6rpx]">
        {(Object.keys(BookingTabLabels) as BookingTab[]).map((tab) => {
          const isActive = active === tab;
          return (
            <View
              key={tab}
              className={cn(
                'center min-w-[160rpx] rounded-full border px-[28rpx] py-[12rpx] transition-colors active:scale-95',
                isActive
                  ? 'border-primary bg-primary shadow-md'
                  : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted active:bg-muted',
              )}
              onClick={() => onChange(tab)}
            >
              <Text
                className={cn(
                  'text-[28rpx] font-medium',
                  isActive ? 'text-white' : 'text-muted-foreground',
                )}
              >
                {BookingTabLabels[tab]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

/** 单条记录卡片：复用 SwappableScheduleCard 实现左滑露出编辑/取消或编辑/恢复 */
const BookingRecordCard: React.FC<{
  booking: LeadBooking;
  onProxy: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onRestore: () => void;
  cardId: string;
  openCardId?: string | null;
  onOpenChange?: (cardId: string | null) => void;
  /** 家长端只读浏览，不展示代约与左滑操作 */
  isParent?: boolean;
}> = React.memo(
  ({
    booking,
    onProxy,
    onEdit,
    onCancel,
    onRestore,
    cardId,
    openCardId,
    onOpenChange,
    isParent = false,
  }) => {
    const start = dayjs(`${booking.lesson_date} ${booking.start_time}`);
    const end = dayjs(`${booking.lesson_date} ${booking.end_time}`);
    const duration = end.diff(start, 'minute');
    const displayStatus = resolveBookingDisplayStatus(booking.status, start, end);
    const statusMeta = BOOKING_STATUS_META[displayStatus];
    const difficultyMeta = DIFFICULTY_META[(booking.difficulty as DifficultyKey) || 'all'];
    const isCancelled = booking.status === 'cancelled';

    const body = (
      <View className="rounded-[24rpx] bg-white px-[28rpx] py-[24rpx] shadow-card">
        <View className="flex items-center gap-[22rpx]">
          <View className="flex flex-shrink-0 flex-col items-center gap-[16rpx]">
            <ClassAvatar size="md" />
            <Text className="text-[22rpx] text-muted-foreground">
              {booking.teacher_name || '未分配老师'}
            </Text>
          </View>

          <View className="min-w-0 flex-1">
            <View className="flex items-center gap-[16rpx]">
              <View className="title-divider-left" />
              <Text className="flex-shrink-0 text-[34rpx] font-bold text-foreground">
                {booking.course_name || '体验课'}
              </Text>
              <View className="title-divider-right" />
            </View>

            <View className="mt-[10rpx] flex items-center justify-center gap-[12rpx]">
              <Text className="text-[26rpx] text-foreground">
                {booking.start_time} - {booking.end_time}
              </Text>
              <Text className="text-[24rpx] text-muted-foreground">{duration}分钟</Text>
              <View
                className={cn(
                  'center rounded-[8rpx] px-[12rpx] py-[4rpx]',
                  difficultyMeta.badgeClassName,
                )}
              >
                <Text className="text-center text-[20rpx] font-medium leading-none">
                  {difficultyMeta.label}
                </Text>
              </View>
            </View>

            <View className="mt-[8rpx] flex justify-center">
              <Text className={cn('text-[24rpx] font-medium', statusMeta.textClassName)}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          {!isParent ? (
            <View
              className="flex flex-shrink-0 flex-col items-center justify-center gap-[6rpx]"
              onClick={(e) => {
                e.stopPropagation();
                onProxy();
              }}
            >
              <View className="center h-[68rpx] w-[68rpx] rounded-full bg-muted shadow-sm transition-all active:bg-muted-foreground/20">
                <Icon name="mdi-plus" size={30} className="text-muted-foreground" />
              </View>
              <Text className="text-[20rpx] text-muted-foreground">代约</Text>
            </View>
          ) : null}
        </View>
      </View>
    );

    if (isParent) {
      return (
        <SwappableScheduleCard
          radiusClassName="rounded-[24rpx]"
          cardId={cardId}
          openCardId={openCardId}
          onOpenChange={onOpenChange}
          actions={[
            {
              label: isCancelled ? '恢复' : '取消',
              variant: isCancelled ? 'warning' : 'danger',
              onClick: isCancelled ? onRestore : onCancel,
            },
          ]}
        >
          {body}
        </SwappableScheduleCard>
      );
    }

    return (
      <SwappableScheduleCard
        radiusClassName="rounded-[24rpx]"
        cardId={cardId}
        openCardId={openCardId}
        onOpenChange={onOpenChange}
        onClick={onEdit}
        actions={[
          { label: '编辑', variant: 'default', onClick: onEdit },
          {
            label: isCancelled ? '恢复' : '取消',
            variant: isCancelled ? 'warning' : 'danger',
            onClick: isCancelled ? onRestore : onCancel,
          },
        ]}
      >
        {body}
      </SwappableScheduleCard>
    );
  },
);

const TrialBookingView: React.FC<TrialBookingViewProps> = ({
  initialDate,
  initialTeacherId,
  className,
  refreshKey,
  switchSheetVisible = false,
  onSwitchSheetClose,
  isParent = false,
}) => {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(initialDate ? dayjs(initialDate) : dayjs());
  const [activeTab, setActiveTab] = useState<BookingTab>('booking');
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [slots, setSlots] = useState<TrialSlotConfig[]>([]);
  const [bookings, setBookings] = useState<LeadBooking[]>([]);
  const [loading, setLoading] = useState(true);
  /** 当前左滑打开按钮的卡片 ID，用于卡片互斥 */
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  /** 开关切换后内部刷新版本号 */
  const [switchVersion, setSwitchVersion] = useState(0);

  const campusId = profile?.currentContext?.campusId;
  const currentUserId = profile?.id || '';

  const loadData = useCallback(async () => {
    if (!campusId) return;
    setLoading(true);
    try {
      const slotTeacherId = isParent ? undefined : initialTeacherId || currentUserId;
      const [teacherList, slotList, bookingList] = await Promise.all([
        teacherService.getList(),
        leadService.getTrialSlotConfigs(slotTeacherId, campusId),
        isParent
          ? leadService.getLeadBookingsByCampus(campusId)
          : leadService.getLeadBookingsByTeacher(initialTeacherId || currentUserId),
      ]);
      setTeachers(teacherList);
      setSlots(slotList);
      setBookings(bookingList);

      // 为「展示在私教老师列表」且未配置预约开关的老师自动初始化为 open，
      // 保证详情页打开开关后老师立即出现在私教预约列表中
      teacherList
        .filter((t) => t.showInPrivateList === true)
        .forEach((teacher) => {
          if (!readTeacherBookingConfig(teacher.id)) {
            writeTeacherBookingConfig(
              createTeacherBookingConfig({
                teacherId: teacher.id,
                teacherName: teacher.name,
                subject: teacher.subject,
                status: 'open',
              }),
            );
          }
        });
    } finally {
      setLoading(false);
    }
  }, [campusId, currentUserId, initialTeacherId, isParent]);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(dayjs(initialDate));
    }
  }, [initialDate]);

  // 加载老师、时段、预约记录
  useEffect(() => {
    loadData();
  }, [loadData]);

  /** 日历红点：有预约的日期显示红点，过去的预约显示灰点 */
  const getDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType => {
      const dateStr = date.format('YYYY-MM-DD');
      const hasBooking = bookings.some(
        (booking) => booking.lesson_date === dateStr && booking.status !== 'cancelled',
      );
      if (!hasBooking) return 'none';
      return date.isBefore(dayjs(), 'day') ? 'past' : 'active';
    },
    [bookings],
  );

  /**
   * 获取指定日期下可展示的老师列表（含当日时段）
   * 以「展示在私教老师列表」的老师为全集（与详情页开关联动），
   * 再附加当日时段信息：当天有时段则展示具体时段，当天无时段则展示空时段（仍显示老师卡片）
   */
  const getTeachersWithSlots = useCallback(
    (date: dayjs.Dayjs): TeacherWithSlots[] => {
      const dateStr = date.format('YYYY-MM-DD');
      const daySlots = slots.filter((s) => s.lesson_date === dateStr);

      const dayTeacherSlotsMap = new Map<string, TrialSlotConfig[]>();
      daySlots.forEach((slot) => {
        const list = dayTeacherSlotsMap.get(slot.teacher_id) || [];
        list.push(slot);
        dayTeacherSlotsMap.set(slot.teacher_id, list);
      });

      return teachers
        .filter((t) => t.showInPrivateList === true)
        .map((teacher) => {
          // 仅展示在「老师预约开关」中状态为 open 的老师（与弹窗开关完全联动）
          const bookingConfig = readTeacherBookingConfig(teacher.id);
          if (!bookingConfig || bookingConfig.status !== 'open') return null;
          const teacherDaySlots = dayTeacherSlotsMap.get(teacher.id) || [];
          return {
            teacher,
            slots: teacherDaySlots,
            // 当天有时段且可约才算可约；当天无时段则不可约（但仍展示老师卡片）
            bookable: teacherDaySlots.some((s) => s.max_count - s.current_count > 0),
          };
        })
        .filter((item): item is TeacherWithSlots => Boolean(item));
    },
    // switchVersion / refreshKey 变化时重新计算（老师开关切换后刷新）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slots, teachers, switchVersion, refreshKey],
  );

  const handleDateChange = useCallback((date: dayjs.Dayjs) => {
    setSelectedDate(date);
    setOpenCardId(null);
  }, []);

  const handleManageTeacher = useCallback((teacherId: string) => {
    // 进入老师时段管理页面（或底部弹窗），当前先跳转新建/编辑页
    void Taro.navigateTo({
      url: `/package-lead/pages/trial-slot-config/index?teacherId=${encodeURIComponent(teacherId)}`,
    });
  }, []);

  const handleParentBookTeacher = useCallback((teacherId: string) => {
    // 家长端进入同一时段页选时预约；不展示教师端管理入口文案
    void Taro.navigateTo({
      url: `/package-lead/pages/trial-slot-config/index?teacherId=${encodeURIComponent(teacherId)}&from=parent`,
    });
  }, []);

  const handleProxyBooking = useCallback(
    (bookingId: string) => {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;
      void Taro.navigateTo({
        url: `/package-lead/pages/proxy-booking-form/index?bookingId=${encodeURIComponent(booking.id)}`,
      });
    },
    [bookings],
  );

  /** 编辑页与卡片点击共用同一入口，均进入「修改排课」表单页 */
  const handleEditBooking = useCallback((bookingId: string) => {
    void Taro.navigateTo({
      url: `/package-lead/pages/lead-booking-edit/index?bookingId=${encodeURIComponent(bookingId)}`,
    });
  }, []);

  const handleCancelBooking = useCallback(
    async (bookingId: string) => {
      try {
        await leadService.cancelLeadBooking(bookingId);
        Taro.showToast({ title: '已取消预约', icon: 'success' });
        loadData();
      } catch {
        Taro.showToast({ title: '取消失败', icon: 'none' });
      }
    },
    [loadData],
  );

  const handleRestoreBooking = useCallback(
    async (bookingId: string) => {
      try {
        await leadService.restoreLeadBooking(bookingId);
        Taro.showToast({ title: '已恢复预约', icon: 'success' });
        loadData();
      } catch {
        Taro.showToast({ title: '恢复失败', icon: 'none' });
      }
    },
    [loadData],
  );

  const renderBookingList = useCallback(
    (date: dayjs.Dayjs) => {
      if (loading) return <TrialBookingSkeleton />;

      const teachersWithSlots = getTeachersWithSlots(date);
      if (teachersWithSlots.length === 0) {
        return (
          <View className="center flex-col gap-3 py-20">
            <Icon name="mdi-calendar-clock" size={64} className="text-muted-foreground" />
            <Text className="text-[28rpx] text-muted-foreground">当日暂无可预约老师</Text>
          </View>
        );
      }

      return (
        <View className="flex flex-col gap-[16rpx]">
          {teachersWithSlots.map(({ teacher, slots: teacherDaySlots }) => {
            // 已开放预约的老师默认全天可约；仅当当天有时段且全部约满时才显示"已约满"
            const hasSlots = teacherDaySlots.length > 0;
            const allFull =
              hasSlots && teacherDaySlots.every((s) => s.max_count - s.current_count <= 0);
            const isFull = allFull;
            return (
              <View
                key={teacher.id}
                className="rounded-[24rpx] bg-white px-[28rpx] py-[24rpx] shadow-card"
              >
                {/* 老师信息行 */}
                <View className="flex items-center justify-between">
                  <View className="flex items-center gap-[22rpx]">
                    <ClassAvatar />
                    <View>
                      <Text className="text-[32rpx] font-bold text-foreground">{teacher.name}</Text>
                      <View className="mt-[6rpx] flex items-center gap-[8rpx]">
                        <View
                          className={cn(
                            'h-[14rpx] w-[14rpx] rounded-full',
                            isFull ? 'bg-muted-foreground' : 'bg-success',
                          )}
                        />
                        <Text
                          className={cn(
                            'text-[24rpx]',
                            isFull ? 'text-muted-foreground' : 'text-success',
                          )}
                        >
                          {isFull ? '已约满' : '可预约'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View className="flex items-center gap-[12rpx]">
                    <View
                      className="center h-[64rpx] rounded-full bg-primary px-[32rpx] active:opacity-80"
                      onClick={() =>
                        isParent
                          ? handleParentBookTeacher(teacher.id)
                          : handleManageTeacher(teacher.id)
                      }
                    >
                      <Text className="text-[26rpx] font-medium text-white">
                        {isParent ? '预约' : '管理'}
                      </Text>
                    </View>
                    <Icon name="mdi-chevron-right" size={28} className="text-muted-foreground" />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      );
    },
    [getTeachersWithSlots, handleManageTeacher, handleParentBookTeacher, isParent, loading],
  );

  const renderRecordList = useCallback(
    (date: dayjs.Dayjs) => {
      if (loading) return <TrialBookingSkeleton />;

      const dateStr = date.format('YYYY-MM-DD');
      // 保留已取消记录，卡片展示「已取消」状态并支持左滑恢复
      const dayBookings = bookings.filter((b) => b.lesson_date === dateStr);

      if (dayBookings.length === 0) {
        return (
          <View className="center flex-col gap-3 py-20">
            <Icon name="mdi-calendar-check" size={64} className="text-muted-foreground" />
            <Text className="text-[28rpx] text-muted-foreground">当日暂无预约记录</Text>
          </View>
        );
      }

      return (
        <View className="flex flex-col gap-[16rpx]">
          {dayBookings.map((booking) => (
            <BookingRecordCard
              key={booking.id}
              cardId={booking.id}
              openCardId={openCardId}
              onOpenChange={setOpenCardId}
              booking={booking}
              isParent={isParent}
              onProxy={() => handleProxyBooking(booking.id)}
              onEdit={() => handleEditBooking(booking.id)}
              onCancel={() => handleCancelBooking(booking.id)}
              onRestore={() => handleRestoreBooking(booking.id)}
            />
          ))}
        </View>
      );
    },
    [
      bookings,
      handleCancelBooking,
      handleEditBooking,
      handleProxyBooking,
      handleRestoreBooking,
      isParent,
      loading,
      openCardId,
    ],
  );

  return (
    <View className={cn('flex h-full flex-col overflow-hidden', className)}>
      {/* 日期选择 + Tab 切换 + 滑动切换 — 结构与排课页对齐 */}
      <CalendarSwiper
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        getDateDotType={getDateDotType}
        contentClassName="px-page-padding pt-[24rpx]"
        onScroll={() => setOpenCardId(null)}
        toolbar={
          <View className="pb-[24rpx] pt-[12rpx]">
            <BookingTabSwitch active={activeTab} onChange={setActiveTab} />
          </View>
        }
      >
        {(date) => (
          <>
            {activeTab === 'booking' && renderBookingList(date)}
            {activeTab === 'record' && renderRecordList(date)}
          </>
        )}
      </CalendarSwiper>

      {/* 老师预约开关弹窗：仅机构端 */}
      {!isParent ? (
        <TeacherBookingSwitchSheet
          visible={switchSheetVisible}
          onClose={() => onSwitchSheetClose?.()}
          teachers={teachers}
          onChange={() => setSwitchVersion((v) => v + 1)}
        />
      ) : null}
    </View>
  );
};

export default TrialBookingView;
