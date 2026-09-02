/**
 * 班课日 Swiper 项：课表卡片列表（从 schedule/index 抽出，Q2-1）
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type dayjs from 'dayjs';
import React from 'react';
import Empty from '@/components/Empty';
import ScheduleActionButton from '@/components/schedule/ScheduleActionButton';
import ScheduleCard from '@/components/schedule/ScheduleCard';
import SwappableScheduleCard from '@/components/schedule/SwappableScheduleCard';
import type { Class } from '@/types/class';
import type { LessonSharePayload } from '@/utils/lesson-share';
import { canOperateHistoricalLesson, canSuspendThisLesson } from '@/utils/schedule-guard';
import {
  getCardActionVisibility,
  isHistoricalClassCard,
  isUpcomingClassCard,
} from '@/utils/schedule-card-actions';
import type { ScheduleCardItem } from '@/utils/schedule-card-build';

export interface ScheduleDaySummary {
  total: number;
  checked: number;
  unchecked: number;
}

export interface ScheduleDaySwiperItemProps {
  date: dayjs.Dayjs;
  cards: ScheduleCardItem[];
  summary: ScheduleDaySummary;
  loading: boolean;
  currentTime: dayjs.Dayjs;
  openCardId: string | null;
  onOpenCardIdChange: (id: string | null) => void;
  isParent: boolean;
  currentCampusId: string;
  currentTeacherId: string;
  currentUserId: string;
  profileCampusId?: string;
  pausedClasses: Class[];
  onPrepareShare: (payload: LessonSharePayload) => void;
  onRunCardButtonAction: (action: () => void) => void;
  onOpenBookSheet: (item: ScheduleCardItem) => void;
  onPrimaryAction: (item: ScheduleCardItem, date: dayjs.Dayjs) => void;
  onRollCall: (item: ScheduleCardItem, date: dayjs.Dayjs) => void;
  onSupplement: (item: ScheduleCardItem, date: dayjs.Dayjs) => void;
  onEditSchedule: (item: ScheduleCardItem) => void;
  onClassReschedule: (item: ScheduleCardItem) => void;
  onCancelLesson: (item: ScheduleCardItem) => void;
  onRestoreLesson: (item: ScheduleCardItem) => void;
  onSuspendLesson: (item: ScheduleCardItem) => void;
  onResumeClass: (classId: string, className: string) => void;
}

const ScheduleDaySwiperItem: React.FC<ScheduleDaySwiperItemProps> = ({
  date,
  cards,
  summary,
  loading,
  currentTime,
  openCardId,
  onOpenCardIdChange,
  isParent,
  currentCampusId,
  currentTeacherId,
  currentUserId,
  profileCampusId,
  pausedClasses,
  onPrepareShare,
  onRunCardButtonAction,
  onOpenBookSheet,
  onPrimaryAction,
  onRollCall,
  onSupplement,
  onEditSchedule,
  onClassReschedule,
  onCancelLesson,
  onRestoreLesson,
  onSuspendLesson,
  onResumeClass,
}) => {
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
              共<Text className="font-semibold text-schedule-header">{summary.total}</Text>
              节课，
              <Text className="ml-[8rpx]">已点名：</Text>
              <Text className="font-semibold text-foreground-secondary">{summary.checked}</Text>
              节，
              <Text className="ml-[8rpx]">未点名：</Text>
              <Text className="font-semibold text-schedule-header">{summary.unchecked}</Text>节
            </Text>
          </View>

          <View className="px-[24rpx] pb-[160rpx] pt-[12rpx]">
            {loading && cards.length === 0 ? (
              <View className="py-[120rpx] flex items-center justify-center">
                <Text className="text-[28rpx] text-muted-foreground">课表加载中...</Text>
              </View>
            ) : null}

            {!loading && cards.length === 0 ? (
              <View className="rounded-[16rpx] bg-card py-[80rpx] shadow-card">
                <Empty icon="mdi-calendar-blank" description="当前日期暂无课程安排" />
              </View>
            ) : null}

            <View className="flex flex-col gap-[14rpx]">
              {cards.map((item) => {
                const actionVisibility = getCardActionVisibility(item, date, currentTime);
                const isCancelled = item.status === 'cancelled';
                const cardBody = (
                  <ScheduleCard
                    item={item}
                    showShare={!isParent && item.status !== 'cancelled'}
                    onSharePrepare={
                      isParent
                        ? undefined
                        : (card) => {
                            onPrepareShare({
                              type: 'class_lesson',
                              teacherId: currentTeacherId || currentUserId,
                              campusId: card.campusId || currentCampusId || profileCampusId || '',
                              classId: card.classId || '',
                              className: card.className,
                              scheduleId: card.id,
                              date: date.format('YYYY-MM-DD'),
                              start: card.startTime,
                              end: card.endTime,
                            });
                          }
                    }
                    metaAction={
                      isParent ? (
                        item.status !== 'cancelled' && isUpcomingClassCard(item.status) ? (
                          <ScheduleActionButton
                            label="请假"
                            variant="neutral"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunCardButtonAction(() => {
                                const lessonKey = `${item.id}:${date.format('YYYY-MM-DD')}`;
                                const studentId = item.students?.[0]?.id || '';
                                const query = [
                                  studentId ? `studentId=${encodeURIComponent(studentId)}` : '',
                                  `lessonKey=${encodeURIComponent(lessonKey)}`,
                                  item.classId
                                    ? `classId=${encodeURIComponent(item.classId)}`
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join('&');
                                void Taro.navigateTo({
                                  url: `/package-course/pages/leave-request/index?${query}`,
                                });
                              });
                            }}
                          />
                        ) : undefined
                      ) : item.status === 'cancelled' ? undefined : isHistoricalClassCard(
                          item.status,
                          date,
                          currentTime,
                        ) ? (
                        canOperateHistoricalLesson(date, currentTime) ? (
                          <ScheduleActionButton
                            label="补录"
                            variant="neutral"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunCardButtonAction(() => onSupplement(item, date));
                            }}
                          />
                        ) : undefined
                      ) : (
                        <ScheduleActionButton
                          label={item.status === 'urgent' ? '立即点名' : '点名'}
                          variant="attend"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRunCardButtonAction(() => onRollCall(item, date));
                          }}
                        />
                      )
                    }
                    footerAction={
                      isParent || !isUpcomingClassCard(item.status) ? undefined : (
                        <View
                          className="flex min-h-[48rpx] items-center px-[4rpx] active:opacity-70"
                          hoverStopPropagation
                          onClick={(e) => {
                            e.stopPropagation();
                            onRunCardButtonAction(() => onOpenBookSheet(item));
                          }}
                        >
                          <Text className="text-[24rpx] text-primary">约试听/补课</Text>
                          <Text className="ml-[2rpx] text-[24rpx] text-primary">›</Text>
                        </View>
                      )
                    }
                    showStudentRow={
                      item.status !== 'cancelled' &&
                      (isUpcomingClassCard(item.status) ||
                        item.status === 'active' ||
                        (item.students?.length || 0) > 0)
                    }
                  />
                );

                if (isParent) {
                  const openLeave = () => {
                    if (item.status === 'cancelled') return;
                    const lessonKey = `${item.id}:${date.format('YYYY-MM-DD')}`;
                    const studentId = item.students?.[0]?.id || '';
                    const query = [
                      studentId ? `studentId=${encodeURIComponent(studentId)}` : '',
                      `lessonKey=${encodeURIComponent(lessonKey)}`,
                      item.classId ? `classId=${encodeURIComponent(item.classId)}` : '',
                    ]
                      .filter(Boolean)
                      .join('&');
                    void Taro.navigateTo({
                      url: `/package-course/pages/leave-request/index?${query}`,
                    });
                  };
                  return (
                    <View key={item.id} className="rounded-[16rpx]" onClick={openLeave}>
                      {cardBody}
                    </View>
                  );
                }

                return (
                  <SwappableScheduleCard
                    key={item.id}
                    cardId={item.id}
                    openCardId={openCardId}
                    onOpenChange={onOpenCardIdChange}
                    onClick={() => onPrimaryAction(item, date)}
                    actions={[
                      {
                        label: '编辑',
                        variant: 'default',
                        onClick: () => onEditSchedule(item),
                        disabled: !actionVisibility.showEditAndReschedule,
                      },
                      {
                        label: '停课',
                        variant: 'warning',
                        onClick: () => {
                          void onSuspendLesson(item);
                        },
                        disabled: !canSuspendThisLesson(item, date, currentTime),
                      },
                      {
                        label: '调课',
                        variant: 'warning',
                        onClick: () => onClassReschedule(item),
                        disabled: !actionVisibility.showEditAndReschedule,
                      },
                      isCancelled
                        ? {
                            label: '恢复',
                            variant: 'warning',
                            onClick: () => void onRestoreLesson(item),
                          }
                        : {
                            label: '取消',
                            variant: 'danger',
                            onClick: () => void onCancelLesson(item),
                            disabled: !actionVisibility.showCancelLesson,
                          },
                    ]}
                  >
                    {cardBody}
                  </SwappableScheduleCard>
                );
              })}
            </View>

            {!isParent && pausedClasses.length > 0 ? (
              <View className="mt-[28rpx] flex flex-col gap-[14rpx]">
                <Text className="px-[4rpx] text-[24rpx] text-muted-foreground">已停课班级</Text>
                {pausedClasses.map((cls) => (
                  <View
                    key={cls.id}
                    className="flex items-center gap-[16rpx] rounded-[16rpx] bg-card px-[24rpx] py-[22rpx] shadow-card"
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="block text-[28rpx] font-medium text-foreground truncate">
                        {cls.name}
                      </Text>
                      <Text className="mt-[4rpx] block text-[22rpx] text-muted-foreground">
                        停课中 · 课表已隐藏排课
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

export default ScheduleDaySwiperItem;
