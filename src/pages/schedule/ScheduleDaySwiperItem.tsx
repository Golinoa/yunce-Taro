/**
 * 班课日 Swiper 项：课表卡片列表（从 schedule/index 抽出，Q2-1）
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import Empty from '@/components/Empty';
import ScheduleActionButton from '@/components/schedule/ScheduleActionButton';
import ScheduleCard from '@/components/schedule/ScheduleCard';
import type { Class } from '@/types/class';
import type { LessonSharePayload } from '@/utils/lesson-share';
import { isHistoricalClassCard, isUpcomingClassCard } from '@/utils/schedule-card-actions';
import type { ScheduleCardItem } from '@/utils/schedule-card-build';
import { canOperateHistoricalLesson } from '@/utils/schedule-guard';
import type dayjs from 'dayjs';

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
  isParent: boolean;
  /** 上课提醒是否已开启（卡片铃铛状态） */
  reminderEnabled?: boolean;
  /** 点击铃铛：同步调起微信授权面板 */
  onReminderClick?: () => void;
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
  onResumeClass: (classId: string, className: string) => void;
}

const ScheduleDaySwiperItem: React.FC<ScheduleDaySwiperItemProps> = ({
  date,
  cards,
  summary,
  loading,
  currentTime,
  isParent,
  reminderEnabled,
  onReminderClick,
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
  onResumeClass,
}) => {
  return (
    <View className="h-full bg-muted">
      <ScrollView className="h-full" scrollY enhanced showScrollbar={false}>
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
                /**
                 * 注：原先老师侧这里套了一层左滑（编辑/停课/调课/暂停规则/停止规则/取消），
                 * 这些操作已收拢进点名页（详情页）：调课 / 编辑（班级或排课规则）/ 停课 /
                 * 删除排课，停课后详情页同一位置给「恢复本节课」，故左滑整体移除。
                 */
                const cardBody = (
                  <ScheduleCard
                    item={item}
                    reminderEnabled={reminderEnabled}
                    onReminderClick={onReminderClick}
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
                                  item.classId ? `classId=${encodeURIComponent(item.classId)}` : '',
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
                      /* 约试听/补课：原先只对未来课开放，过去课「忘了加人」就无法补约。
                         现放宽为非家长、非已取消的课次都显示（含过去课与当日已下课）；
                         添加成功后引导进详情页签到（见 use-schedule-card-actions.ts）。 */
                      isParent || item.status === 'cancelled' ? undefined : (
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
                      /* 底部行（学员头像 + 约试听/补课）的显示条件必须与 footerAction 对齐：
                         过去课即使一个学员都没有，也要把行渲染出来，否则「约试听/补课」入口
                         会连同行一起被隐藏 —— 防漏填补不上的闭环就断了（用户口径 2026-09-30）。 */
                      item.status !== 'cancelled' &&
                      (isUpcomingClassCard(item.status) ||
                        item.status === 'active' ||
                        (item.students?.length || 0) > 0 ||
                        !isParent)
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
                  <View
                    key={item.id}
                    className="rounded-[16rpx]"
                    onClick={() => onPrimaryAction(item, date)}
                  >
                    {cardBody}
                  </View>
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
