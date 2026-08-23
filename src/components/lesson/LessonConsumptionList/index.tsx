import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import type { LessonRecord } from '@/types/lesson-record';

export interface LessonConsumptionDetailItem {
  id: string;
  studentId: string;
  name: string;
  avatarUrl?: string;
  teacherDisplayText: string;
  hoursUsed: number;
  remainingHours: number;
  totalHours: number;
  attendanceStatusText?: string;
  attendanceStatusClassName?: string;
  packageTagText?: '即将到期' | '需续费';
  packageTagClassName?: string;
  description: string;
}

export interface LessonConsumptionCardItem {
  id: string;
  title: string;
  subtitle: string;
  totalHours: number;
  studentCount: number;
  studentCountText: string;
  details: LessonConsumptionDetailItem[];
}

export interface LessonConsumptionSection {
  id: string;
  date: string;
  totalHours: number;
  studentCount: number;
  cards: LessonConsumptionCardItem[];
}

export interface LessonConsumptionListProps {
  sections: LessonConsumptionSection[];
  emptyText?: string;
  footerText?: string;
  onFooterClick?: () => void;
}

interface BuildSectionsOptions {
  teacherNameMap?: Record<string, string>;
}

const WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const currentDate = date.toISOString().split('T')[0];
  if (currentDate === today.toISOString().split('T')[0]) return '今天';
  if (currentDate === yesterday.toISOString().split('T')[0]) return '昨天';

  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEK_DAYS[date.getDay()]}`;
}

function getWeekDay(dateStr: string): string {
  return WEEK_DAYS[new Date(dateStr).getDay()];
}

function getAttendanceStatusLabel(status?: LessonRecord['status']): string {
  if (status === 'cancelled') return '已取消';
  if (status === 'makeup') return '补课';
  if (status === 'leave') return '请假';
  if (status === 'absent') return '缺勤';
  return '';
}

function getAttendanceStatusClass(status?: LessonRecord['status']): string {
  if (status === 'cancelled') {
    return 'bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))]';
  }
  if (status === 'makeup') {
    return 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]';
  }
  if (status === 'leave') {
    return 'bg-[hsl(var(--info)/0.1)] text-[hsl(var(--info))]';
  }
  if (status === 'absent') {
    return 'bg-[hsl(var(--warning)/0.08)] text-[hsl(var(--warning))]';
  }
  return 'bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]';
}

function getPackageTag(remainingHours: number): '即将到期' | '需续费' | undefined {
  if (remainingHours <= 0) return '需续费';
  if (remainingHours <= 8) return '需续费';
  if (remainingHours <= 16) return '即将到期';
  return undefined;
}

function getPackageTagClass(tag?: '即将到期' | '需续费'): string {
  if (tag === '需续费') {
    return 'bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))]';
  }
  if (tag === '即将到期') {
    return 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]';
  }
  return '';
}

function getBarFill(remaining: number, total: number): string {
  if (total <= 0) return 'bg-[hsl(var(--success))]';
  const ratio = remaining / total;
  if (ratio <= 0.15) return 'bg-[hsl(var(--destructive))]';
  if (ratio <= 0.35) return 'bg-[hsl(var(--warning))]';
  return 'bg-[hsl(var(--success))]';
}

function getTeacherDisplayText(
  record: LessonRecord,
  teacherNameMap: Record<string, string>,
): string {
  const teacherName = teacherNameMap[record.teacher_id] || record.teacher?.name || '未知教师';
  const assistantName =
    teacherNameMap[record.assistant_teacher_id || ''] || record.assistant_teacher?.name || '';
  const operatorName =
    teacherNameMap[record.operator_teacher_id || ''] || record.operator_teacher?.name || '';

  const hasAssistant = Boolean(assistantName && assistantName !== teacherName);
  const hasOperator = Boolean(
    operatorName && operatorName !== teacherName && operatorName !== assistantName,
  );

  if (!hasAssistant && !hasOperator) {
    return teacherName;
  }

  const parts = [`主讲 ${teacherName}`];
  if (hasAssistant) {
    parts.push(`助教 ${assistantName}`);
  }
  if (hasOperator) {
    parts.push(`操作 ${operatorName}`);
  }

  return parts.join(' · ');
}

function getRecordSortValue(record: LessonRecord): number {
  const timestamp = record.updated_at || record.created_at || record.lesson_date;
  return new Date(timestamp).getTime() || 0;
}

function sortRecordsDesc(records: LessonRecord[]): LessonRecord[] {
  return [...records].sort((left, right) => {
    if (left.lesson_date !== right.lesson_date) {
      return new Date(right.lesson_date).getTime() - new Date(left.lesson_date).getTime();
    }
    return getRecordSortValue(right) - getRecordSortValue(left);
  });
}

export function pickHomeRecentLessonRecords(records: LessonRecord[]): LessonRecord[] {
  const sortedRecords = sortRecordsDesc(records);
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = sortedRecords.filter((record) => record.lesson_date === today);

  if (todayRecords.length >= 20) {
    return todayRecords;
  }

  return sortedRecords.slice(0, 20);
}

export function buildLessonConsumptionSections(
  records: LessonRecord[],
  options: BuildSectionsOptions = {},
): LessonConsumptionSection[] {
  const { teacherNameMap = {} } = options;
  const sortedRecords = sortRecordsDesc(records);
  const dateMap = new Map<string, LessonRecord[]>();

  sortedRecords.forEach((record) => {
    const currentRecords = dateMap.get(record.lesson_date) || [];
    currentRecords.push(record);
    dateMap.set(record.lesson_date, currentRecords);
  });

  return Array.from(dateMap.entries()).map(([date, dateRecords]) => {
    const cardMap = new Map<string, LessonRecord[]>();

    dateRecords.forEach((record) => {
      const key = record.class_id
        ? `class:${record.class_id}`
        : record.class_name
          ? `class-name:${record.class_name}`
          : `student:${record.student_id}`;
      const currentItems = cardMap.get(key) || [];
      currentItems.push(record);
      cardMap.set(key, currentItems);
    });

    const cards = Array.from(cardMap.entries()).map(([cardKey, cardRecords]) => {
      const firstRecord = cardRecords[0];
      const isClassCard = cardKey.startsWith('class:') || cardKey.startsWith('class-name:');
      const uniqueStudentIds = new Set(cardRecords.map((item) => item.student_id));
      const teacherDisplayText = getTeacherDisplayText(firstRecord, teacherNameMap);
      const title = isClassCard
        ? firstRecord.class_name || firstRecord.course_package?.name || '班级消课'
        : firstRecord.student?.name || '个人消课';
      const subtitleBase =
        firstRecord.course_package?.name || (isClassCard ? '班级消课' : '个人消课');
      const subtitle = [teacherDisplayText, subtitleBase].filter(Boolean).join(' · ');

      return {
        id: `${date}-${cardKey}`,
        title,
        subtitle,
        totalHours: cardRecords.reduce((sum, item) => sum + (item.hours_used || 0), 0),
        studentCount: uniqueStudentIds.size,
        studentCountText: isClassCard ? `${uniqueStudentIds.size}人` : '个人',
        details: cardRecords.map((record) => {
          const remainingHours = record.remaining_hours ?? 0;
          const totalHours = Math.max((record.hours_used || 0) + remainingHours, remainingHours);
          const attendanceStatusText = getAttendanceStatusLabel(record.status);
          const packageTagText = getPackageTag(remainingHours);

          return {
            id: record.id,
            studentId: record.student_id,
            name: record.student?.name || '学生',
            avatarUrl: record.student?.avatar_url,
            teacherDisplayText: getTeacherDisplayText(record, teacherNameMap),
            hoursUsed: record.hours_used || 0,
            remainingHours,
            totalHours,
            attendanceStatusText: attendanceStatusText || undefined,
            attendanceStatusClassName: attendanceStatusText
              ? getAttendanceStatusClass(record.status)
              : undefined,
            packageTagText,
            packageTagClassName: getPackageTagClass(packageTagText),
            description:
              record.content?.trim() ||
              record.course_package?.name ||
              record.class_name ||
              (isClassCard ? '班级消课' : '个人消课'),
          };
        }),
      };
    });

    return {
      id: date,
      date,
      totalHours: dateRecords.reduce((sum, item) => sum + (item.hours_used || 0), 0),
      studentCount: new Set(dateRecords.map((item) => item.student_id)).size,
      cards,
    };
  });
}

const LessonConsumptionList: React.FC<LessonConsumptionListProps> = ({
  sections,
  emptyText = '暂无消课记录',
  footerText,
  onFooterClick,
}) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const cardCount = useMemo(
    () => sections.reduce((sum, section) => sum + section.cards.length, 0),
    [sections],
  );

  const handleToggleCard = useCallback((cardId: string) => {
    setExpandedCardId((prev) => (prev === cardId ? null : cardId));
  }, []);

  const handleStudentAvatarClick = useCallback((studentId: string) => {
    if (!studentId) {
      return;
    }

    Taro.navigateTo({
      url: `/package-student/pages/student-detail/index?id=${encodeURIComponent(studentId)}`,
    });
  }, []);

  if (cardCount === 0) {
    return <Empty icon="mdi-clipboard-text" description={emptyText} />;
  }

  return (
    <View className="flex flex-col gap-[24rpx]">
      {sections.map((section) => (
        <View key={section.id} className="flex flex-col gap-[16rpx]">
          <View className="flex items-center justify-between px-[4rpx]">
            <View className="flex items-center gap-[16rpx]">
              <Text className="text-[32rpx] font-semibold text-foreground">
                {formatDateLabel(section.date)}
              </Text>
              <Text className="text-[22rpx] text-muted-foreground">{getWeekDay(section.date)}</Text>
            </View>
            <Text className="text-[22rpx] text-muted-foreground">
              {section.totalHours}课时 / {section.studentCount}人
            </Text>
          </View>

          <View className="flex flex-col gap-[16rpx]">
            {section.cards.map((card) => {
              const isExpanded = expandedCardId === card.id;
              const allCancelled =
                card.details.length > 0 &&
                card.details.every(
                  (detail) => detail.attendanceStatusText === '已取消' && detail.hoursUsed <= 0,
                );

              return (
                <View key={card.id} className="recent-group-v14 overflow-hidden">
                  <View
                    className="flex items-center gap-[20rpx] px-[28rpx] py-[24rpx]"
                    onClick={() => handleToggleCard(card.id)}
                  >
                    <View
                      className="w-[72rpx] h-[72rpx] rounded-[20rpx] flex items-center justify-center shrink-0"
                      style={{
                        background:
                          'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                      }}
                    >
                      <Icon name="mdi-check" size="sm" color="white" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <View className="flex items-center gap-[12rpx]">
                        <Text className="text-[28rpx] font-bold text-foreground block truncate">
                          {card.title}
                        </Text>
                        <View className="flex items-center shrink-0 whitespace-nowrap px-[10rpx] py-[2rpx] rounded-[8rpx] bg-[hsl(var(--primary)/0.08)]">
                          <Text className="text-[18rpx] font-bold text-[hsl(var(--primary))]">
                            {card.studentCountText}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-[22rpx] text-muted-foreground mt-[2rpx] truncate">
                        {card.subtitle}
                      </Text>
                    </View>
                    <Text className="text-[28rpx] font-bold text-[hsl(var(--primary))] shrink-0">
                      {allCancelled ? '已取消' : `-${card.totalHours}课时`}
                    </Text>
                    <View
                      className="shrink-0"
                      style={{
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.25s',
                      }}
                    >
                      <Icon name="mdi-chevron-right" size="sm" color="muted" />
                    </View>
                  </View>

                  {isExpanded && (
                    <View className="bg-[hsl(var(--muted))] px-[28rpx] pb-[20rpx]">
                      {card.details.map((detail, index) => (
                        <View
                          key={detail.id}
                          className={cn(
                            'flex items-center gap-[20rpx] py-[20rpx]',
                            index < card.details.length - 1
                              ? 'border-b-[2rpx] border-[hsl(var(--border))]'
                              : '',
                          )}
                        >
                          <View onClick={() => handleStudentAvatarClick(detail.studentId)}>
                            <Avatar
                              name={detail.name || '学'}
                              avatarUrl={detail.avatarUrl}
                              size="md"
                            />
                          </View>

                          <View className="flex-1 min-w-0">
                            <View className="flex items-center justify-between mb-[8rpx] gap-[12rpx]">
                              <View className="flex items-center gap-[8rpx] min-w-0">
                                <Text className="text-[26rpx] text-foreground font-semibold truncate">
                                  {detail.name}
                                </Text>
                                {detail.packageTagText ? (
                                  <View
                                    className={cn(
                                      'flex items-center shrink-0 whitespace-nowrap px-[10rpx] py-[2rpx] rounded-[8rpx]',
                                      detail.packageTagClassName,
                                    )}
                                  >
                                    <Text className="text-[18rpx] font-bold">
                                      {detail.packageTagText}
                                    </Text>
                                  </View>
                                ) : null}
                                {detail.attendanceStatusText ? (
                                  <View
                                    className={cn(
                                      'flex items-center shrink-0 whitespace-nowrap px-[10rpx] py-[2rpx] rounded-[8rpx]',
                                      detail.attendanceStatusClassName,
                                    )}
                                  >
                                    <Text className="text-[18rpx] font-bold">
                                      {detail.attendanceStatusText}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text className="text-[26rpx] font-bold text-[hsl(var(--primary))] shrink-0">
                                {detail.attendanceStatusText === '已取消' && detail.hoursUsed <= 0
                                  ? '未扣课时'
                                  : `-${detail.hoursUsed}课时`}
                              </Text>
                            </View>

                            <Text className="text-[20rpx] text-muted-foreground truncate block">
                              {detail.description}
                            </Text>
                            <Text className="text-[20rpx] text-muted-foreground/90 truncate block mt-[4rpx]">
                              {detail.teacherDisplayText}
                            </Text>

                            {detail.totalHours > 0 ? (
                              <View className="mt-[10rpx]">
                                <View className="h-[8rpx] rounded-[4rpx] bg-[hsl(var(--border))] overflow-hidden">
                                  <View
                                    className={cn(
                                      'h-full rounded-[4rpx]',
                                      getBarFill(detail.remainingHours, detail.totalHours),
                                    )}
                                    style={{
                                      width: `${Math.min(
                                        Math.max(
                                          ((detail.totalHours - detail.remainingHours) /
                                            detail.totalHours) *
                                            100,
                                          0,
                                        ),
                                        100,
                                      )}%`,
                                    }}
                                  />
                                </View>
                              </View>
                            ) : null}

                            <View className="flex items-center justify-between gap-[16rpx] mt-[6rpx]">
                              <Text className="text-[20rpx] text-muted-foreground truncate">
                                {detail.attendanceStatusText === '已取消' && detail.hoursUsed <= 0
                                  ? '本次取消，课时未扣减'
                                  : `已用${detail.hoursUsed} / 共${detail.totalHours || detail.hoursUsed}课时`}
                              </Text>
                              <Text className="text-[20rpx] text-muted-foreground shrink-0">
                                余{detail.remainingHours}课时
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {footerText && onFooterClick ? (
        <View
          className="mt-[8rpx] py-[24rpx] flex items-center justify-center gap-[8rpx]"
          onClick={onFooterClick}
        >
          <Text className="text-[24rpx] font-medium text-[hsl(var(--primary))]">{footerText}</Text>
          <Icon name="mdi-chevron-right" size="xs" color="primary" />
        </View>
      ) : null}
    </View>
  );
};

export default LessonConsumptionList;
