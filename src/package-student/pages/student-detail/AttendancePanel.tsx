/**
 * 学员详情 · 出勤 Tab
 *
 * 使用场景：签到/请假时间线，按月展开收起。
 * 功能说明：待审批请假对教师展示同意/拒绝；签到行进上课详情。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import type { LeaveRequest } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import { formatDateCN } from '@/utils/format';
import { LEAVE_STATUS_MAP } from './student-detail-constants';
import type { TimelineItem } from './use-student-detail-derived';

export interface AttendancePanelProps {
  records: LessonRecord[];
  leaves: LeaveRequest[];
  timelineGroups: Record<string, TimelineItem[]>;
  monthStats: Record<string, { checkIn: number; leave: number }>;
  expandedMonths: Set<string>;
  isTeacher: boolean;
  onToggleMonth: (month: string) => void;
  onRecordClick: (recordId: string) => void;
  onApproveLeave: (id: string) => void;
  onRejectLeave: (id: string) => void;
}

const AttendancePanel: React.FC<AttendancePanelProps> = ({
  records,
  leaves,
  timelineGroups,
  monthStats,
  expandedMonths,
  isTeacher,
  onToggleMonth,
  onRecordClick,
  onApproveLeave,
  onRejectLeave,
}) => {
  return (
    <ScrollView scrollY className="h-full">
      <View className="px-[32rpx] pt-[32rpx] pb-[200rpx]">
        {records.length === 0 && leaves.length === 0 ? (
          <Empty description="暂无出勤记录" />
        ) : (
          <View className="flex flex-col gap-[24rpx]">
            <View className="bg-card rounded-[24rpx] p-[20rpx] shadow-soft">
              <View className="flex items-center gap-[8rpx] mb-[16rpx]">
                <Icon name="mdi-chart-bar" size={24} color="primary" />
                <Text className="text-[26rpx] font-bold text-foreground">出勤总结</Text>
              </View>
              <View className="flex flex-row gap-[12rpx]">
                <View className="flex-1 center-col py-[14rpx] rounded-[16rpx] bg-primary/8">
                  <Text className="text-[36rpx] font-bold text-primary leading-none">
                    {records.length}
                  </Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[6rpx]">签到次数</Text>
                </View>
                <View className="flex-1 center-col py-[14rpx] rounded-[16rpx] bg-warning/10">
                  <Text className="text-[36rpx] font-bold text-warning leading-none">
                    {leaves.length}
                  </Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[6rpx]">请假次数</Text>
                </View>
              </View>
            </View>

            {Object.entries(timelineGroups).map(([month, items]) => {
              const isExpanded = expandedMonths.has(month);
              const stat = monthStats[month] || { checkIn: 0, leave: 0 };
              return (
                <View key={month} className="bg-card rounded-[28rpx] p-[28rpx] shadow-soft">
                  <View
                    className="flex items-center justify-between"
                    onClick={() => onToggleMonth(month)}
                  >
                    <View className="flex items-center gap-[16rpx]">
                      <Text className="text-[28rpx] font-bold text-foreground">{month}</Text>
                      <Text className="text-[24rpx] text-muted-foreground">
                        签到 {stat.checkIn} · 请假 {stat.leave}
                      </Text>
                    </View>
                    <Icon
                      name={isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'}
                      size={32}
                      color="hsl(var(--muted-foreground))"
                    />
                  </View>

                  {isExpanded && (
                    <View className="flex flex-col gap-[20rpx] mt-[24rpx]">
                      {items.map((item, index) => {
                        const isLast = index === items.length - 1;
                        if (item.type === 'record') {
                          const record = item.data;
                          return (
                            <View
                              key={record.id}
                              className="bg-muted rounded-[20rpx] p-[24rpx] flex gap-[24rpx] press-scale"
                              onClick={() => onRecordClick(record.id)}
                            >
                              <View className="flex flex-col items-center w-[24rpx] flex-shrink-0 pt-[8rpx]">
                                <View className="w-[16rpx] h-[16rpx] rounded-full bg-gradient-primary flex-shrink-0" />
                                {!isLast && (
                                  <View className="w-[4rpx] flex-1 bg-border mt-[8rpx] min-h-[40rpx]" />
                                )}
                              </View>
                              <View className="flex-1 min-w-0">
                                <View className="flex items-start justify-between">
                                  <View className="flex-1">
                                    <Text className="text-[28rpx] font-medium text-foreground block">
                                      {record.course_package?.name || '上课'}
                                    </Text>
                                    <Text className="text-[24rpx] text-muted-foreground block mt-[4rpx]">
                                      {formatDateCN(record.lesson_date)}
                                    </Text>
                                  </View>
                                  <Text className="text-[30rpx] font-semibold text-primary flex-shrink-0">
                                    -{record.hours_used}课时
                                  </Text>
                                </View>
                                {record.content && (
                                  <View className="mt-[16rpx] py-[16rpx] px-[24rpx] bg-card rounded-[16rpx]">
                                    <Text className="text-[24rpx] text-muted-foreground">
                                      课程内容：{record.content}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        }
                        const leave = item.data;
                        const statusInfo = LEAVE_STATUS_MAP[leave.status];
                        return (
                          <View
                            key={leave.id}
                            className="bg-muted rounded-[20rpx] p-[24rpx] flex gap-[24rpx]"
                          >
                            <View className="flex flex-col items-center w-[24rpx] flex-shrink-0 pt-[8rpx]">
                              <View className="w-[16rpx] h-[16rpx] rounded-full bg-warning flex-shrink-0" />
                              {!isLast && (
                                <View className="w-[4rpx] flex-1 bg-border mt-[8rpx] min-h-[40rpx]" />
                              )}
                            </View>
                            <View className="flex-1 min-w-0">
                              <View className="flex items-start justify-between">
                                <View className="flex-1">
                                  <Text className="text-[28rpx] font-medium text-foreground block">
                                    {leave.type === 'reschedule' ? '调课' : '请假'}
                                  </Text>
                                  <Text className="text-[24rpx] text-muted-foreground block mt-[4rpx]">
                                    {formatDateCN(leave.original_date)}
                                    {leave.new_date && ` → ${formatDateCN(leave.new_date)}`}
                                  </Text>
                                </View>
                                <View
                                  className={cn(
                                    'py-[8rpx] px-[20rpx] rounded-[24rpx] text-[24rpx] font-medium flex-shrink-0',
                                    statusInfo.className,
                                  )}
                                >
                                  <Text>{statusInfo.label}</Text>
                                </View>
                              </View>
                              {leave.reason && (
                                <View className="mt-[16rpx] py-[16rpx] px-[24rpx] bg-card rounded-[16rpx]">
                                  <Text className="text-[24rpx] text-muted-foreground">
                                    原因：{leave.reason}
                                  </Text>
                                </View>
                              )}
                              {leave.status === 'pending' && isTeacher && (
                                <View className="flex gap-[16rpx] mt-[20rpx]">
                                  <View
                                    className="flex-1 py-[16rpx] rounded-[24rpx] bg-gradient-primary center press-scale"
                                    onClick={() => onApproveLeave(leave.id)}
                                  >
                                    <Text className="text-primary-foreground text-[26rpx] font-medium">
                                      同意
                                    </Text>
                                  </View>
                                  <View
                                    className="flex-1 py-[16rpx] rounded-[24rpx] border-[3rpx] border-destructive center press-scale"
                                    onClick={() => onRejectLeave(leave.id)}
                                  >
                                    <Text className="text-destructive text-[26rpx] font-medium">
                                      拒绝
                                    </Text>
                                  </View>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default AttendancePanel;
