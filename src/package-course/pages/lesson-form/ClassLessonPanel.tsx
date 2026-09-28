/**
 * 班级点名面板（从 lesson-form 抽出，Q2-2）
 */
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import ClassSelector from '@/components/lesson/ClassSelector';
import Loading from '@/components/Loading';
import Stepper from '@/components/Stepper';
import type { Class } from '@/types/class';
import type { LeadBooking } from '@/types/lead';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { CHECKIN_OPTION_STYLES, type CheckinStatus } from './checkin-status';
import { CheckinCard } from './CheckinCard';
import { getWeekday } from './lesson-form-datetime';
import type { StudentEditSheetTarget } from './StudentEditSheet';

const FORM_CARD_CLASS_NAME = 'mx-[24rpx] mb-3 overflow-hidden rounded-[20rpx] bg-white shadow-soft';

export type MergedStudentListItem =
  | { type: 'trial'; id: string; booking: LeadBooking; name: string }
  | { type: 'formal'; id: string; student: Student };

export interface ClassLessonPanelCardInfo {
  courseName?: string;
  remaining: string;
  deduct: string;
}

export interface ClassLessonPanelProps {
  selectedClassId: string;
  selectedClass: Class | null | undefined;
  classes: Class[];
  scheduledClassIds: Set<string>;
  isClassDirectEntry: boolean;
  displayLessonTime: string;
  lessonDate: string;
  selectedTeachingTeacher: TeacherUIModel | null | undefined;
  selectedAssistantTeacher: TeacherUIModel | null | undefined;
  profileName?: string;
  homework: string;
  isAlreadyChecked: boolean;
  canEditClass: boolean;
  /** 有 scheduleId 且非过去日期 → 可调课（只动这一天） */
  canReschedule: boolean;
  /** 有 scheduleId 且本节课尚未点名 → 可临时停课 */
  canSuspendLesson: boolean;
  /** 本节课已被取消（＝停过课）→ 同一位置改给「恢复本节课」 */
  canRestoreLesson: boolean;
  /** 恢复请求进行中（按钮显示"恢复中"并禁用） */
  restoring: boolean;
  studentSearchKeyword: string;
  /** 学员列表加载中（列表为空时用占位替代"暂无学员"） */
  studentsLoading: boolean;
  hoursUsed: number;
  feeAmount: string;
  attendanceFilter: 'all' | CheckinStatus;
  classCheckedCount: number;
  classLeaveCount: number;
  classAbsentCount: number;
  mergedStudentList: MergedStudentListItem[];
  trialCheckinMap: Record<string, CheckinStatus>;
  studentCheckinStatusMap: Record<string, CheckinStatus>;
  makeupStudentIds: Set<string>;
  supplementStudentIds: Set<string>;
  studentRemarkDrafts: Record<string, string>;
  recordByStudentId: Map<string, LessonRecord>;
  onHomeworkChange: (value: string) => void;
  /** 调课：进批量调课页（只影响这一天） */
  onReschedule: () => void;
  /** 编辑：弹出「编辑班级 / 编辑排课规则」二选一，进入对应页面 */
  onEdit: () => void;
  /** 停课：仅停今天这一节，弹出理由输入后通知家长 */
  onSuspendLesson: () => void;
  /** 恢复本节课：删掉停课时写入的 cancelled 记录，回到未点名 */
  onRestoreLesson: () => Promise<void>;
  /** 删除：删除这条排课规则（不可恢复），确定文案「删除排课」 */
  onDeleteSchedule: () => void;
  onSelectClass: (classId: string) => void;
  onStudentSearchChange: (value: string) => void;
  onHoursChange: (value: number) => void;
  onFeeAmountChange: (value: string) => void;
  onAttendanceFilterChange: (value: 'all' | CheckinStatus) => void;
  onOpenAddStudentSheet: () => void;
  getTrialCardInfo: () => ClassLessonPanelCardInfo;
  getStudentCardInfo: (student: Student) => ClassLessonPanelCardInfo;
  isStudentCardDisabled: (id: string) => boolean;
  onSetTrialCheckin: (bookingId: string, status: CheckinStatus) => void;
  onSetStudentCheckin: (studentId: string, status: CheckinStatus) => void;
  onOpenStudentDetailSheet: (target: StudentEditSheetTarget) => void;
}

const ClassLessonPanel: React.FC<ClassLessonPanelProps> = ({
  selectedClassId,
  selectedClass,
  classes,
  scheduledClassIds,
  isClassDirectEntry,
  displayLessonTime,
  lessonDate,
  selectedTeachingTeacher,
  selectedAssistantTeacher,
  profileName,
  homework,
  isAlreadyChecked,
  canEditClass,
  canReschedule,
  canSuspendLesson,
  canRestoreLesson,
  restoring,
  studentSearchKeyword,
  studentsLoading,
  hoursUsed,
  feeAmount,
  attendanceFilter,
  classCheckedCount,
  classLeaveCount,
  classAbsentCount,
  mergedStudentList,
  trialCheckinMap,
  studentCheckinStatusMap,
  makeupStudentIds,
  supplementStudentIds,
  studentRemarkDrafts,
  recordByStudentId,
  onHomeworkChange,
  onReschedule,
  onEdit,
  onSuspendLesson,
  onRestoreLesson,
  onDeleteSchedule,
  onSelectClass,
  onStudentSearchChange,
  onHoursChange,
  onFeeAmountChange,
  onAttendanceFilterChange,
  onOpenAddStudentSheet,
  getTrialCardInfo,
  getStudentCardInfo,
  isStudentCardDisabled,
  onSetTrialCheckin,
  onSetStudentCheckin,
  onOpenStudentDetailSheet,
}) => {
  return (
    <>
      {/* 头部信息卡片：当前时间 / 老师 / 助教 / 课程介绍 / 备注 */}
      {selectedClassId ? (
        <View className="mx-[24rpx] mt-3 rounded-[20rpx] bg-white px-[28rpx] py-[24rpx] shadow-soft">
          <View className="flex items-start justify-between gap-[20rpx]">
            <View className="flex-1">
              <Text className="block text-[44rpx] font-bold leading-[56rpx] text-foreground">
                {displayLessonTime}
              </Text>
              <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
                {lessonDate}（{getWeekday(lessonDate)}）
              </Text>
              <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
                老师：{selectedTeachingTeacher?.name || profileName || '-'}
              </Text>
              <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
                助教：{selectedAssistantTeacher?.name || '-'}
              </Text>
              <Text className="mt-[12rpx] block text-[24rpx] leading-[36rpx] text-muted-foreground">
                课程介绍：{selectedClass?.note || '-'}
              </Text>
              <View className="mt-[12rpx] flex items-start gap-[8rpx]">
                <Text className="shrink-0 text-[24rpx] leading-[44rpx] text-muted-foreground">
                  备注：
                </Text>
                <Input
                  className="min-h-[44rpx] flex-1 text-[24rpx] leading-[44rpx] text-foreground"
                  value={homework}
                  onInput={(e) => onHomeworkChange(e.detail.value || '')}
                  placeholder="可随时填写备注"
                  placeholderClass="text-muted-foreground"
                />
              </View>
            </View>
            {!isAlreadyChecked ? (
              <View className="flex shrink-0 flex-wrap items-center justify-end gap-[10rpx]">
                {/* 调课：只把今天这一节换到别的时间段（长期仍挂原排课规则） */}
                <View
                  className={cn(
                    'flex items-center justify-center rounded-[10rpx] px-[18rpx] py-[10rpx]',
                    canReschedule ? 'bg-primary' : 'bg-muted',
                  )}
                  onClick={() => {
                    if (canReschedule) onReschedule();
                  }}
                >
                  <Text
                    className={cn(
                      'text-[24rpx] font-medium leading-none',
                      canReschedule ? 'text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    调课
                  </Text>
                </View>

                {/* 编辑：弹出「编辑班级 / 编辑排课规则」二选一（两者是不同页面） */}
                {canEditClass ? (
                  <View
                    className="flex items-center justify-center rounded-[10rpx] bg-primary px-[18rpx] py-[10rpx]"
                    onClick={() => onEdit()}
                  >
                    <Text className="text-[24rpx] font-medium leading-none text-primary-foreground">
                      编辑
                    </Text>
                  </View>
                ) : null}

                {/* 停课：只停今天这一节（可填理由，确定后通知家长）。
                    已取消（＝停过课）时同一个位置变成「恢复本节课」 */}
                {canRestoreLesson ? (
                  <View
                    className={cn(
                      'flex items-center justify-center rounded-[10rpx] px-[18rpx] py-[10rpx]',
                      restoring ? 'bg-muted' : 'border border-success/30 bg-success/10',
                    )}
                    onClick={() => {
                      if (!restoring) void onRestoreLesson();
                    }}
                  >
                    <Text
                      className={cn(
                        'text-[24rpx] font-medium leading-none',
                        restoring ? 'text-muted-foreground' : 'text-success',
                      )}
                    >
                      {restoring ? '恢复中' : '恢复本节课'}
                    </Text>
                  </View>
                ) : (
                  <View
                    className={cn(
                      'flex items-center justify-center rounded-[10rpx] px-[18rpx] py-[10rpx]',
                      canSuspendLesson ? 'border border-warning/30 bg-warning/10' : 'bg-muted',
                    )}
                    onClick={() => {
                      if (canSuspendLesson) onSuspendLesson();
                    }}
                  >
                    <Text
                      className={cn(
                        'text-[24rpx] font-medium leading-none',
                        canSuspendLesson ? 'text-warning' : 'text-muted-foreground',
                      )}
                    >
                      停课
                    </Text>
                  </View>
                )}

                {/* 删除：删除这条排课规则，删后不可找回 */}
                <View
                  className="flex items-center justify-center rounded-[10rpx] border border-destructive-30 bg-destructive-10 px-[18rpx] py-[10rpx]"
                  onClick={() => onDeleteSchedule()}
                >
                  <Text className="text-[24rpx] font-medium leading-none text-destructive">
                    删除
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <View className="pt-3">
        {/* 班级选择（非直接进入时显示） */}
        {!isClassDirectEntry ? (
          <View className={FORM_CARD_CLASS_NAME}>
            <View className="border-b border-black/5 px-4 py-3">
              <View className="mb-[6rpx] flex items-center gap-1">
                <Text className="text-[24rpx] text-foreground">班级</Text>
                <Text className="text-[24rpx] text-destructive">*</Text>
              </View>
              <ClassSelector
                classes={classes}
                selectedClassId={selectedClassId}
                scheduledClassIds={scheduledClassIds}
                onSelect={onSelectClass}
              />
            </View>
          </View>
        ) : null}

        {selectedClassId ? (
          <>
            {/* 搜索框 */}
            <View className={FORM_CARD_CLASS_NAME}>
              <View className="flex items-center gap-[16rpx] px-4 py-3">
                <Icon name="mdi-magnify" size="sm" color="muted" />
                <Input
                  className="flex-1 text-[26rpx] text-foreground"
                  value={studentSearchKeyword}
                  onInput={(e) => onStudentSearchChange(e.detail.value || '')}
                  placeholder="请输入学员姓名"
                  placeholderClass="text-muted-foreground"
                />
              </View>
            </View>

            {/* 消耗课时 */}
            <View className={FORM_CARD_CLASS_NAME}>
              <View className="flex items-center justify-between px-4 py-3">
                <Text className="text-[28rpx] text-foreground">消耗课时</Text>
                <Stepper value={hoursUsed} min={0.5} step={0.5} onChange={onHoursChange} />
              </View>
            </View>

            {/* 授课扣费 */}
            <View className={FORM_CARD_CLASS_NAME}>
              <View className="flex items-center justify-between px-4 py-3">
                <Text className="text-[28rpx] text-foreground">授课扣费</Text>
                <View className="flex items-center gap-[8rpx]">
                  <Input
                    className="h-[72rpx] w-[160rpx] rounded-xl bg-background px-4 text-right text-[28rpx] leading-[72rpx] text-foreground"
                    type="digit"
                    value={feeAmount}
                    onInput={(e) => onFeeAmountChange(e.detail.value || '0')}
                    placeholder="0"
                    placeholderClass="text-muted-foreground"
                  />
                  <Text className="text-[26rpx] text-muted-foreground">元</Text>
                </View>
              </View>
            </View>

            {/* 考勤状态筛选 */}
            <View className={FORM_CARD_CLASS_NAME}>
              <View
                className="flex items-center justify-between px-4 py-3"
                onClick={() =>
                  Taro.showActionSheet({
                    itemList: ['全部', '签到', '请假', '未到'],
                    success: (res) => {
                      const map: Array<'all' | CheckinStatus> = [
                        'all',
                        'checked',
                        'leave',
                        'absent',
                      ];
                      onAttendanceFilterChange(map[res.tapIndex] || 'all');
                    },
                  })
                }
              >
                <Text className="text-[28rpx] text-foreground">考勤状态</Text>
                <View className="flex items-center gap-[8rpx]">
                  <Text className="text-[26rpx] text-muted-foreground">
                    {attendanceFilter === 'all'
                      ? '全部'
                      : CHECKIN_OPTION_STYLES[attendanceFilter].label}
                  </Text>
                  <Icon name="mdi-chevron-right" size="sm" color="muted" />
                </View>
              </View>
            </View>

            {/* 统计信息 */}
            <View className="mx-[24rpx] mb-3">
              <Text className="text-[24rpx] text-muted-foreground">
                学员已选
                <Text className="text-destructive">
                  {classCheckedCount + classLeaveCount + classAbsentCount}
                </Text>
                ，签到
                <Text className="text-destructive">{classCheckedCount}</Text>
                ，请假
                <Text className="text-destructive">{classLeaveCount}</Text>
                ，未到
                <Text className="text-destructive">{classAbsentCount}</Text>
              </Text>
            </View>

            {/* 学员列表 - 试听优先 */}
            <View className="mx-[24rpx] mb-3">
              <View className="mb-[16rpx] flex items-center justify-between">
                <Text className="text-[26rpx] font-medium text-foreground">学员列表</Text>
                {!isAlreadyChecked ? (
                  <View
                    className="flex items-center justify-center rounded-[12rpx] bg-muted px-[16rpx] py-[8rpx]"
                    onClick={onOpenAddStudentSheet}
                  >
                    <Text className="text-[22rpx] font-medium leading-none text-muted-foreground">
                      添加学员
                    </Text>
                  </View>
                ) : null}
              </View>
              {studentsLoading && mergedStudentList.length === 0 ? (
                <Loading size="small" />
              ) : (
                <>
                  <View className="grid grid-cols-2 gap-[16rpx]">
                    {mergedStudentList.map((item) => {
                      if (item.type === 'trial') {
                        const booking = item.booking;
                        const status = trialCheckinMap[booking.id] || 'absent';
                        const info = getTrialCardInfo();
                        return (
                          <CheckinCard
                            key={booking.id}
                            name={item.name}
                            status={status}
                            remaining={info.remaining}
                            deduct={info.deduct}
                            isTrial
                            disabled={isStudentCardDisabled(booking.id)}
                            onToggleStatus={(next) => onSetTrialCheckin(booking.id, next)}
                            onOpenDetailSheet={() =>
                              onOpenStudentDetailSheet({
                                type: 'trial',
                                id: booking.id,
                                name: item.name,
                                remaining: info.remaining,
                                deduct: info.deduct,
                                courseName: '试听',
                              })
                            }
                          />
                        );
                      }
                      const stu = item.student;
                      const status = studentCheckinStatusMap[stu.id] || 'absent';
                      const info = getStudentCardInfo(stu);
                      return (
                        <CheckinCard
                          key={stu.id}
                          name={stu.name}
                          status={status}
                          remaining={info.remaining}
                          deduct={info.deduct}
                          isMakeup={makeupStudentIds.has(stu.id)}
                          disabled={isStudentCardDisabled(stu.id)}
                          highlight={supplementStudentIds.has(stu.id)}
                          note={studentRemarkDrafts[stu.id] || recordByStudentId.get(stu.id)?.note}
                          onToggleStatus={(next) => onSetStudentCheckin(stu.id, next)}
                          onOpenDetailSheet={() =>
                            onOpenStudentDetailSheet({
                              type: 'formal',
                              id: stu.id,
                              name: stu.name,
                              remaining: info.remaining,
                              deduct: info.deduct,
                              courseName: info.courseName,
                              student: stu,
                            })
                          }
                        />
                      );
                    })}
                  </View>
                  {mergedStudentList.length === 0 ? (
                    <View className="rounded-[20rpx] bg-white px-[24rpx] py-[32rpx] shadow-soft">
                      <Text className="text-center text-[24rpx] text-muted-foreground">
                        暂无匹配学员
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </>
        ) : null}
      </View>
    </>
  );
};

export default ClassLessonPanel;
