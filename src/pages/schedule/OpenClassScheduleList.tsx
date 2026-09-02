/**
 * 团课开放预约列表（从 schedule/index 抽出，Q2-1）
 */
import { Button, View, Text, ScrollView, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import ScheduleActionButton from '@/components/schedule/ScheduleActionButton';
import SwappableScheduleCard from '@/components/schedule/SwappableScheduleCard';
import { BRAND_LOGO } from '@/constants/brand';
import type { Class, ClassBookingSlot } from '@/types/class';
import { CLASS_LEVEL_LABELS, CLASS_LEVEL_BADGE_WRAP, CLASS_LEVEL_BADGE_TEXT } from '@/types/class';
import type { TeacherUIModel } from '@/types/teacher';
import type { LessonSharePayload } from '@/utils/lesson-share';
import { readParentBookings } from '@/utils/parent-bookings';
import type { ScheduleCardStudentAvatar } from '@/utils/schedule-card-build';
import { getDurationText } from '@/utils/schedule-card-status';
import { canSuspendOpenSlot, parseTimeToMinutes } from '@/utils/schedule-guard';
import type dayjs from 'dayjs';

/** 开放预约卡片最多展示的前 x 个已约学员头像 */
const OPEN_BOOKING_MAX_VISIBLE_AVATARS = 5;

export interface OpenClassScheduleListProps {
  date: dayjs.Dayjs;
  filteredClasses: Class[];
  openClassSlots: Record<string, Record<string, ClassBookingSlot[]>>;
  loadingOpenSlotDates: Set<string>;
  errorOpenSlotDates: Set<string>;
  openCardId: string | null;
  onOpenCardIdChange: (id: string | null) => void;
  teacherById: Record<string, TeacherUIModel>;
  currentTime: dayjs.Dayjs;
  isParent: boolean;
  currentCampusId: string;
  currentTeacherId: string;
  currentUserId: string;
  profileId?: string;
  profileCampusId?: string;
  classStudentAvatars: Record<string, ScheduleCardStudentAvatar[]>;
  onLoadOpenClassSlots: (date: dayjs.Dayjs, force?: boolean) => void;
  onOpenClassSlotConfig: (classId: string, dateStr: string) => void;
  onProxyBooking: (slot: ClassBookingSlot) => void;
  onOpenSlotRollCall: (slot: ClassBookingSlot) => void;
  onEditOpenSlot: (slot: ClassBookingSlot) => void;
  onCancelOpenSlot: (slot: ClassBookingSlot) => void;
  onRestoreOpenSlot: (slot: ClassBookingSlot) => void;
  onSuspendOpenSlot: (slot: ClassBookingSlot, className: string) => void;
  onResumeClass: (classId: string, className: string) => void;
  onRunCardButtonAction: (action: () => void) => void;
  onParentBookOpenSlot: (slot: ClassBookingSlot) => void;
  onParentCancelOpenSlot: (slot: ClassBookingSlot) => void;
  onPrepareShare: (payload: LessonSharePayload) => void;
}

const OpenClassScheduleList: React.FC<OpenClassScheduleListProps> = ({
  date,
  filteredClasses,
  openClassSlots,
  loadingOpenSlotDates,
  errorOpenSlotDates,
  openCardId,
  onOpenCardIdChange,
  teacherById,
  currentTime,
  isParent,
  currentCampusId,
  currentTeacherId,
  currentUserId,
  profileId,
  profileCampusId,
  classStudentAvatars,
  onLoadOpenClassSlots,
  onOpenClassSlotConfig,
  onProxyBooking,
  onOpenSlotRollCall,
  onEditOpenSlot,
  onCancelOpenSlot,
  onRestoreOpenSlot,
  onSuspendOpenSlot,
  onResumeClass,
  onRunCardButtonAction,
  onParentBookOpenSlot,
  onParentCancelOpenSlot,
  onPrepareShare,
}) => {
  const dateStr = date.format('YYYY-MM-DD');
  const openClasses = filteredClasses.filter((item) => item.schedule_mode === 'open');
  const dateSlots = openClassSlots[dateStr] || {};
  const isDateLoading = loadingOpenSlotDates.has(dateStr);
  const isDateError = errorOpenSlotDates.has(dateStr);
  // 用户口径（2026-08-23）：休息（rest）不产生约课，列表不渲染 rest 卡片；
  // 全天休息的日期自然显示"当前日期暂无开放预约时段"空态
  // 停课班级的时段亦不展示（底部「已停课班级」可恢复）
  const pausedClassIds = new Set(
    openClasses.filter((item) => item.status === 'paused').map((item) => item.id),
  );
  const allSlots = Object.values(dateSlots)
    .flat()
    .filter((s) => s.status !== 'rest' && !pausedClassIds.has(s.class_id))
    .sort(
      (left, right) => parseTimeToMinutes(left.start_time) - parseTimeToMinutes(right.start_time),
    );
  const summaryFullSlots = allSlots.filter((s) => s.status === 'full').length;
  const summaryActiveSlots = allSlots.filter((s) => s.status === 'active').length;
  const openClassMap = openClasses.reduce<Record<string, Class>>((acc, cls) => {
    acc[cls.id] = cls;
    return acc;
  }, {});

  return (
    <View className="h-full bg-muted">
      <ScrollView
        className="h-full"
        scrollY
        enhanced
        showScrollbar={false}
        onScroll={() => onOpenCardIdChange(null)}
      >
        <View className="min-h-full">
          <View className="px-[24rpx] py-[12rpx]">
            <Text className="text-[28rpx] text-foreground-secondary">
              共<Text className="font-semibold text-schedule-header">{allSlots.length}</Text>
              个时段，
              <Text className="ml-[8rpx]">已约满：</Text>
              <Text className="font-semibold text-foreground-secondary">{summaryFullSlots}</Text>
              个，
              <Text className="ml-[8rpx]">可预约：</Text>
              <Text className="font-semibold text-schedule-header">{summaryActiveSlots}</Text>个
            </Text>
          </View>

          <View className="px-[24rpx] pb-[160rpx] pt-[12rpx]">
            {isDateLoading && allSlots.length === 0 ? (
              <View className="py-[120rpx] flex items-center justify-center">
                <Text className="text-[28rpx] text-muted-foreground">开放班级加载中...</Text>
              </View>
            ) : null}

            {isDateError && allSlots.length === 0 ? (
              <View className="py-[120rpx] flex flex-col items-center justify-center gap-[16rpx]">
                <Text className="text-[28rpx] text-muted-foreground">开放班级加载失败</Text>
                <Button
                  className="m-0 h-[64rpx] px-[32rpx] text-[28rpx] leading-[64rpx] rounded-[32rpx] bg-primary text-primary-foreground"
                  onClick={() => onLoadOpenClassSlots(date, true)}
                >
                  点击重试
                </Button>
              </View>
            ) : null}

            {!isDateLoading && !isDateError && allSlots.length === 0 ? (
              <View className="rounded-[16rpx] bg-card py-[80rpx] shadow-card">
                <Empty icon="mdi-calendar-blank" description="当前日期暂无开放预约时段" />
              </View>
            ) : null}

            <View className="flex flex-col gap-[14rpx]">
              {allSlots.map((slot) => {
                const cls = openClassMap[slot.class_id];
                const teacherName =
                  cls?.teachers
                    ?.map((id) => teacherById[id]?.name)
                    .filter(Boolean)
                    .join('、') ||
                  teacherById[cls?.teacher_id || '']?.name ||
                  slot.teacher_name ||
                  '未分配老师';
                const duration = getDurationText(slot.start_time, slot.end_time);
                const isRest = slot.status === 'rest';
                const isSlotInProgress =
                  !isRest &&
                  date.isSame(currentTime, 'day') &&
                  (() => {
                    const nowMinutes = currentTime.hour() * 60 + currentTime.minute();
                    const startMinutes = parseTimeToMinutes(slot.start_time);
                    const endMinutes = parseTimeToMinutes(slot.end_time);
                    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
                  })();

                return isParent ? (
                  <View
                    key={slot.id}
                    className={cn(
                      'rounded-[24rpx] px-[24rpx] py-[20rpx] shadow-card',
                      isRest ? 'bg-muted border border-border' : 'bg-card',
                    )}
                  >
                    <View className="flex">
                      {/* 左侧时间轴 */}
                      <View className="flex w-[116rpx] flex-shrink-0 flex-col items-center py-[2rpx]">
                        <View className="flex items-center gap-[8rpx]">
                          <View className="h-[12rpx] w-[12rpx] rounded-full bg-foreground" />
                          <Text className="text-[34rpx] font-bold leading-none text-foreground">
                            {slot.start_time}
                          </Text>
                        </View>
                        <View className="flex w-[2rpx] flex-1 flex-col items-center py-[4rpx]">
                          <View className="w-[2rpx] flex-1 bg-border" />
                          {duration ? (
                            <View className="py-[2rpx]">
                              <Text className="text-[22rpx] text-muted-foreground">{duration}</Text>
                            </View>
                          ) : null}
                          <View className="w-[2rpx] flex-1 bg-border" />
                        </View>
                        <View className="flex items-center gap-[8rpx]">
                          <View className="h-[12rpx] w-[12rpx] rounded-full border-[3rpx] border-foreground bg-transparent" />
                          <Text className="text-[34rpx] font-bold leading-none text-foreground">
                            {slot.end_time}
                          </Text>
                        </View>
                      </View>

                      {/* 右侧内容 */}
                      <View className="relative ml-[16rpx] flex flex-1 flex-col justify-between">
                        <View>
                          <View className="flex flex-wrap items-center gap-[12rpx]">
                            <Text className="text-[36rpx] font-bold leading-tight text-foreground">
                              {cls?.name || slot.class_name || '未命名班级'}
                            </Text>
                            {/* 团课无试听：状态标签仅「上课中」（预约满/可约用人数区表达） */}
                            {isSlotInProgress ? (
                              <View className="course-tag-active rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                                <Text className="text-[20rpx] font-medium">上课中</Text>
                              </View>
                            ) : null}
                          </View>
                          <View className="mt-[12rpx] flex flex-wrap items-center gap-[12rpx]">
                            {cls?.level ? (
                              <View className={CLASS_LEVEL_BADGE_WRAP}>
                                <Text className={CLASS_LEVEL_BADGE_TEXT}>
                                  {CLASS_LEVEL_LABELS[cls.level]}
                                </Text>
                              </View>
                            ) : null}
                            {slot.room ? (
                              <View className="flex items-center gap-[6rpx] rounded-[10rpx] bg-muted px-[14rpx] py-[6rpx]">
                                <Icon
                                  name="mdi-map-marker"
                                  size={18}
                                  color="hsl(var(--muted-foreground))"
                                />
                                <Text className="text-[24rpx] font-medium leading-none text-muted-foreground">
                                  {slot.room}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        <View className="mt-[12rpx] flex items-center justify-between gap-[12rpx]">
                          <View className="flex min-w-0 flex-1 items-center gap-[12rpx]">
                            <Image
                              src={BRAND_LOGO}
                              className="h-[40rpx] w-[40rpx] flex-shrink-0 rounded-full border border-border bg-card"
                              mode="aspectFit"
                            />
                            <Text className="truncate text-[26rpx] text-foreground">
                              {teacherName}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* 底部：已约人数 + 家长预约 */}
                    <View className="mt-[18rpx] flex items-center justify-between border-t border-border pt-[14rpx]">
                      <View className="flex flex-1 items-center min-w-0 overflow-hidden">
                        {(slot.booking_students || [])
                          .slice(0, OPEN_BOOKING_MAX_VISIBLE_AVATARS)
                          .map((student, index) => (
                            <Image
                              key={student.id}
                              src={student.avatar || BRAND_LOGO}
                              className={cn(
                                'relative h-[60rpx] w-[60rpx] flex-shrink-0 rounded-full border-2 border-card bg-muted',
                                index > 0 && '-ml-[16rpx]',
                              )}
                              mode="aspectFill"
                              lazyLoad
                            />
                          ))}
                      </View>

                      <View className="ml-[16rpx] flex flex-shrink-0 items-center gap-[16rpx]">
                        <Text className="text-[30rpx] font-semibold text-foreground">
                          <Text className="text-[34rpx] font-bold text-foreground">
                            {slot.current_count}
                          </Text>
                          <Text className="text-[24rpx] font-medium text-muted-foreground">
                            /{slot.max_count}人
                          </Text>
                        </Text>
                        {(() => {
                          const myKids = classStudentAvatars[slot.class_id] || [];
                          const parentBooked = (slot.booking_students || []).some((s) =>
                            myKids.some((kid) => kid.id === s.id),
                          );
                          if (isRest) return null;
                          if (parentBooked) {
                            return (
                              <View className="flex items-center gap-[12rpx]">
                                <View
                                  className="center h-[56rpx] rounded-full bg-muted px-[24rpx] active:opacity-80"
                                  onClick={() => {
                                    const booking = readParentBookings(profileId || '').find(
                                      (b) =>
                                        b.classId === slot.class_id &&
                                        b.lessonDate === slot.lesson_date &&
                                        b.timeRange?.startsWith(slot.start_time) &&
                                        b.status === 'booked',
                                    );
                                    if (booking) {
                                      void Taro.navigateTo({
                                        url: `/package-course/pages/booking-record-detail/index?id=${encodeURIComponent(booking.id)}`,
                                      });
                                    } else {
                                      void onParentCancelOpenSlot(slot);
                                    }
                                  }}
                                >
                                  <Text className="text-[24rpx] font-medium text-foreground">
                                    详情
                                  </Text>
                                </View>
                                <View
                                  className="center h-[56rpx] rounded-full border border-destructive/40 bg-destructive-5 px-[24rpx] active:opacity-80"
                                  onClick={() => void onParentCancelOpenSlot(slot)}
                                >
                                  <Text className="text-[24rpx] font-medium text-destructive">
                                    取消
                                  </Text>
                                </View>
                              </View>
                            );
                          }
                          if (slot.status === 'full') return null;
                          return (
                            <View
                              className="center h-[56rpx] rounded-full bg-primary px-[28rpx] active:opacity-80"
                              onClick={() => void onParentBookOpenSlot(slot)}
                            >
                              <Text className="text-[24rpx] font-medium text-white">预约</Text>
                            </View>
                          );
                        })()}
                      </View>
                    </View>
                  </View>
                ) : (
                  <SwappableScheduleCard
                    key={slot.id}
                    cardId={slot.id}
                    openCardId={openCardId}
                    onOpenChange={onOpenCardIdChange}
                    radiusClassName="rounded-[24rpx]"
                    onClick={() => onOpenClassSlotConfig(slot.class_id, slot.lesson_date)}
                    actions={[
                      {
                        label: '编辑',
                        variant: 'default',
                        onClick: () => onEditOpenSlot(slot),
                      },
                      {
                        label: '停课',
                        variant: 'warning',
                        onClick: () =>
                          void onSuspendOpenSlot(
                            slot,
                            openClassMap[slot.class_id]?.name || slot.class_name || '该班级',
                          ),
                        disabled: !canSuspendOpenSlot(slot, currentTime),
                      },
                      isRest
                        ? {
                            label: '恢复',
                            variant: 'warning',
                            onClick: () => onRestoreOpenSlot(slot),
                          }
                        : {
                            label: '取消',
                            variant: 'danger',
                            onClick: () => onCancelOpenSlot(slot),
                          },
                    ]}
                  >
                    <View
                      className={cn(
                        'rounded-[24rpx] px-[24rpx] py-[20rpx] shadow-card',
                        isRest ? 'bg-muted border border-border' : 'bg-card',
                      )}
                    >
                      <View className="flex">
                        <View className="flex w-[116rpx] flex-shrink-0 flex-col items-center py-[2rpx]">
                          <View className="flex items-center gap-[8rpx]">
                            <View className="h-[12rpx] w-[12rpx] rounded-full bg-foreground" />
                            <Text className="text-[34rpx] font-bold leading-none text-foreground">
                              {slot.start_time}
                            </Text>
                          </View>
                          <View className="flex w-[2rpx] flex-1 flex-col items-center py-[4rpx]">
                            <View className="w-[2rpx] flex-1 bg-border" />
                            {duration ? (
                              <View className="py-[2rpx]">
                                <Text className="text-[22rpx] text-muted-foreground">
                                  {duration}
                                </Text>
                              </View>
                            ) : null}
                            <View className="w-[2rpx] flex-1 bg-border" />
                          </View>
                          <View className="flex items-center gap-[8rpx]">
                            <View className="h-[12rpx] w-[12rpx] rounded-full border-[3rpx] border-foreground bg-transparent" />
                            <Text className="text-[34rpx] font-bold leading-none text-foreground">
                              {slot.end_time}
                            </Text>
                          </View>
                        </View>

                        <View className="relative ml-[16rpx] flex flex-1 flex-col justify-between">
                          <Button
                            className="absolute -right-[8rpx] -top-[8rpx] z-10 flex h-[48rpx] w-[48rpx] items-center justify-center border-none bg-transparent p-0 leading-none after:border-none active:opacity-60"
                            openType="share"
                            onClick={(event) => {
                              event.stopPropagation();
                              onPrepareShare({
                                type: 'group_slot',
                                teacherId: slot.teacher_id || currentTeacherId || currentUserId,
                                campusId:
                                  slot.campus_id ||
                                  cls?.campus_id ||
                                  currentCampusId ||
                                  profileCampusId ||
                                  '',
                                classId: slot.class_id,
                                className: cls?.name || slot.class_name,
                                slotId: slot.id,
                                date: slot.lesson_date,
                                start: slot.start_time,
                                end: slot.end_time,
                              });
                            }}
                          >
                            <Icon
                              name="mdi-share-variant"
                              size={28}
                              color="hsl(var(--muted-foreground))"
                            />
                          </Button>

                          <View>
                            <View className="flex flex-wrap items-center gap-[12rpx] pr-[44rpx]">
                              <Text className="text-[36rpx] font-bold leading-tight text-foreground">
                                {cls?.name || slot.class_name || '未命名班级'}
                              </Text>
                              {isSlotInProgress ? (
                                <View className="course-tag-active rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                                  <Text className="text-[20rpx] font-medium">上课中</Text>
                                </View>
                              ) : null}
                            </View>
                            <View className="mt-[12rpx] flex flex-wrap items-center gap-[12rpx]">
                              {cls?.level ? (
                                <View className={CLASS_LEVEL_BADGE_WRAP}>
                                  <Text className={CLASS_LEVEL_BADGE_TEXT}>
                                    {CLASS_LEVEL_LABELS[cls.level]}
                                  </Text>
                                </View>
                              ) : null}
                              {slot.room ? (
                                <View className="flex items-center gap-[6rpx] rounded-[10rpx] bg-muted px-[14rpx] py-[6rpx]">
                                  <Icon
                                    name="mdi-map-marker"
                                    size={18}
                                    color="hsl(var(--muted-foreground))"
                                  />
                                  <Text className="text-[24rpx] font-medium leading-none text-muted-foreground">
                                    {slot.room}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          <View className="mt-[12rpx] flex items-center justify-between gap-[12rpx]">
                            <View className="flex min-w-0 flex-1 items-center gap-[12rpx]">
                              <Image
                                src={BRAND_LOGO}
                                className="h-[40rpx] w-[40rpx] flex-shrink-0 rounded-full border border-border bg-card"
                                mode="aspectFit"
                              />
                              <Text className="truncate text-[26rpx] text-foreground">
                                {teacherName}
                              </Text>
                            </View>
                            {!isRest ? (
                              <View hoverStopPropagation onClick={(e) => e.stopPropagation()}>
                                <ScheduleActionButton
                                  label="点名"
                                  variant="attend"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRunCardButtonAction(() => onOpenSlotRollCall(slot));
                                  }}
                                />
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>

                      <View className="mt-[18rpx] flex items-center justify-between border-t border-border pt-[14rpx]">
                        <View className="flex flex-1 items-center min-w-0 overflow-hidden">
                          {(slot.booking_students || [])
                            .slice(0, OPEN_BOOKING_MAX_VISIBLE_AVATARS)
                            .map((student, index) => (
                              <Image
                                key={student.id}
                                src={student.avatar || BRAND_LOGO}
                                className={cn(
                                  'relative h-[60rpx] w-[60rpx] flex-shrink-0 rounded-full border-2 border-card bg-muted',
                                  index > 0 && '-ml-[16rpx]',
                                )}
                                mode="aspectFill"
                                lazyLoad
                              />
                            ))}
                          <View
                            className="relative flex h-[60rpx] w-[60rpx] flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted active:opacity-80"
                            onClick={(event) => {
                              event.stopPropagation();
                              onProxyBooking(slot);
                            }}
                          >
                            <Icon name="mdi-plus" size={30} color="hsl(var(--muted-foreground))" />
                          </View>
                        </View>
                        <Text className="ml-[24rpx] flex-shrink-0 text-[30rpx] font-semibold text-foreground">
                          <Text className="text-[34rpx] font-bold text-foreground">
                            {slot.current_count}
                          </Text>
                          <Text className="text-[24rpx] font-medium text-muted-foreground">
                            /{slot.max_count}人
                          </Text>
                        </Text>
                      </View>
                    </View>
                  </SwappableScheduleCard>
                );
              })}
            </View>

            {!isParent && openClasses.some((item) => item.status === 'paused') ? (
              <View className="mt-[28rpx] flex flex-col gap-[14rpx]">
                <Text className="px-[4rpx] text-[24rpx] text-muted-foreground">已停课班级</Text>
                {openClasses
                  .filter((item) => item.status === 'paused')
                  .map((cls) => (
                    <View
                      key={cls.id}
                      className="flex items-center gap-[16rpx] rounded-[24rpx] bg-card px-[24rpx] py-[22rpx] shadow-card"
                    >
                      <View className="min-w-0 flex-1">
                        <Text className="block truncate text-[28rpx] font-medium text-foreground">
                          {cls.name}
                        </Text>
                        <Text className="mt-[4rpx] block text-[22rpx] text-muted-foreground">
                          停课中 · 开放时段已隐藏
                        </Text>
                      </View>
                      <View
                        className="shrink-0 rounded-[12rpx] bg-primary px-[22rpx] py-[12rpx] active:opacity-85"
                        onClick={() => void onResumeClass(cls.id, cls.name)}
                      >
                        <Text className="text-[24rpx] font-semibold text-primary-foreground">
                          恢复上课
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default OpenClassScheduleList;
