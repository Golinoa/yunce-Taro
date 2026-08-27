import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import { TODO_LEVEL_BAR_COLOR } from '@/components/AccentBarCard';
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
  /** 班课聚合卡 */
  cardKind: 'class';
  details: LessonConsumptionDetailItem[];
}

export interface LessonConsumptionSection {
  id: string;
  date: string;
  totalHours: number;
  studentCount: number;
  /** 班课聚合卡 */
  cards: LessonConsumptionCardItem[];
  /** 个人消课：每条记录独立学员卡，不合并 */
  personalItems: LessonConsumptionDetailItem[];
}

export interface LessonConsumptionListProps {
  sections: LessonConsumptionSection[];
  emptyText?: string;
  footerText?: string;
  onFooterClick?: () => void;
  /** 点击单条消课记录（优先于跳转学员详情） */
  onRecordClick?: (recordId: string) => void;
  /** 嵌入卡片内时收紧间距、空态不套大卡片 */
  embedded?: boolean;
  /** 是否展示日期分组标题 */
  showDateHeaders?: boolean;
}

/** 跳转消课详情页（多入口复用） */
export function navigateToLessonDetail(recordId: string): void {
  if (!recordId) {
    return;
  }
  Taro.navigateTo({
    url: `/package-course/pages/lesson-detail/index?id=${encodeURIComponent(recordId)}`,
  });
}

interface BuildSectionsOptions {
  teacherNameMap?: Record<string, string>;
}

const WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

type RecordStatus = LessonRecord['status'] | 'checked';

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

function getAttendanceStatusLabel(status?: RecordStatus): string {
  if (status === 'cancelled') return '已取消';
  if (status === 'makeup') return '补课';
  if (status === 'leave') return '请假';
  if (status === 'absent') return '未到';
  if (status === 'checked' || status === 'normal') return '签到';
  return '';
}

function getAttendanceStatusClass(status?: RecordStatus): string {
  if (status === 'cancelled') {
    return 'bg-destructive-5 text-destructive';
  }
  if (status === 'makeup') {
    return 'bg-warning-bg text-warning';
  }
  if (status === 'leave') {
    return 'bg-info/10 text-info';
  }
  if (status === 'absent') {
    return 'bg-warning-bg text-warning';
  }
  if (status === 'checked' || status === 'normal') {
    return 'bg-primary-bg text-primary';
  }
  return 'bg-primary-bg text-primary';
}

function getPackageTag(remainingHours: number): '即将到期' | '需续费' | undefined {
  if (remainingHours <= 0) return '需续费';
  if (remainingHours <= 8) return '需续费';
  if (remainingHours <= 16) return '即将到期';
  return undefined;
}

function getPackageTagClass(tag?: '即将到期' | '需续费'): string {
  if (tag === '需续费') {
    return 'bg-destructive-5 text-destructive';
  }
  if (tag === '即将到期') {
    return 'bg-warning-bg text-warning';
  }
  return '';
}

function getBarFill(remaining: number, total: number): string {
  if (total <= 0) return 'bg-success';
  const ratio = remaining / total;
  if (ratio <= 0.15) return 'bg-destructive';
  if (ratio <= 0.35) return 'bg-warning';
  return 'bg-success';
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

function mapRecordToDetail(
  record: LessonRecord,
  teacherNameMap: Record<string, string>,
  isClassCard: boolean,
): LessonConsumptionDetailItem {
  const remainingHours = record.remaining_hours ?? 0;
  const totalHours = Math.max((record.hours_used || 0) + remainingHours, remainingHours);
  const recordStatus = record.status as RecordStatus | undefined;
  const attendanceStatusText = getAttendanceStatusLabel(recordStatus);
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
      ? getAttendanceStatusClass(recordStatus)
      : undefined,
    packageTagText,
    packageTagClassName: getPackageTagClass(packageTagText),
    description:
      record.content?.trim() ||
      record.course_package?.name ||
      record.class_name ||
      (isClassCard ? '班级消课' : '个人消课'),
  };
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

function isClassRecord(record: LessonRecord): boolean {
  return Boolean(record.class_id || record.class_name);
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
    const classCardMap = new Map<string, LessonRecord[]>();
    const personalItems: LessonConsumptionDetailItem[] = [];

    dateRecords.forEach((record) => {
      if (isClassRecord(record)) {
        const key = record.class_id
          ? `class:${record.class_id}`
          : `class-name:${record.class_name}`;
        const currentItems = classCardMap.get(key) || [];
        currentItems.push(record);
        classCardMap.set(key, currentItems);
        return;
      }

      personalItems.push(mapRecordToDetail(record, teacherNameMap, false));
    });

    const cards = Array.from(classCardMap.entries()).map(([cardKey, cardRecords]) => {
      const firstRecord = cardRecords[0];
      const uniqueStudentIds = new Set(cardRecords.map((item) => item.student_id));
      const teacherDisplayText = getTeacherDisplayText(firstRecord, teacherNameMap);
      const title = firstRecord.class_name || firstRecord.course_package?.name || '班级消课';
      const subtitleBase = firstRecord.course_package?.name || '班级消课';
      const subtitle = [teacherDisplayText, subtitleBase].filter(Boolean).join(' · ');

      return {
        id: `${date}-${cardKey}`,
        title,
        subtitle,
        totalHours: cardRecords.reduce((sum, item) => sum + (item.hours_used || 0), 0),
        studentCount: uniqueStudentIds.size,
        studentCountText: `${uniqueStudentIds.size}人`,
        cardKind: 'class' as const,
        details: cardRecords.map((record) => mapRecordToDetail(record, teacherNameMap, true)),
      };
    });

    return {
      id: date,
      date,
      totalHours: dateRecords.reduce((sum, item) => sum + (item.hours_used || 0), 0),
      studentCount: new Set(dateRecords.map((item) => item.student_id)).size,
      cards,
      personalItems,
    };
  });
}

interface StudentConsumptionRowProps {
  detail: LessonConsumptionDetailItem;
  onStudentClick: (studentId: string) => void;
  onRecordClick?: (recordId: string) => void;
  showDivider?: boolean;
}

/** 学员消课信息行（班课展开 / 个人消课复用） */
const StudentConsumptionRow: React.FC<StudentConsumptionRowProps> = ({
  detail,
  onStudentClick,
  onRecordClick,
  showDivider = false,
}) => (
  <View
    className={cn(
      'flex items-center gap-[20rpx] py-[20rpx] press-bg',
      showDivider ? 'border-b border-border' : '',
    )}
    onClick={() => {
      if (onRecordClick) {
        onRecordClick(detail.id);
        return;
      }
      onStudentClick(detail.studentId);
    }}
  >
    <View className="shrink-0 rounded-full border-[2rpx] border-card shadow-soft">
      <Avatar name={detail.name || '学'} avatarUrl={detail.avatarUrl} size="md" />
    </View>

    <View className="flex-1 min-w-0">
      <View className="flex items-center justify-between mb-[8rpx] gap-[12rpx]">
        <View className="flex items-center gap-[8rpx] min-w-0 flex-wrap">
          <Text className="text-[26rpx] text-foreground font-semibold truncate">{detail.name}</Text>
          {detail.attendanceStatusText ? (
            <View
              className={cn(
                'flex items-center shrink-0 whitespace-nowrap px-[10rpx] py-[2rpx] rounded-[8rpx]',
                detail.attendanceStatusClassName,
              )}
            >
              <Text className="text-[18rpx] font-bold">{detail.attendanceStatusText}</Text>
            </View>
          ) : null}
          {detail.packageTagText ? (
            <View
              className={cn(
                'flex items-center shrink-0 whitespace-nowrap px-[10rpx] py-[2rpx] rounded-[8rpx]',
                detail.packageTagClassName,
              )}
            >
              <Text className="text-[18rpx] font-bold">{detail.packageTagText}</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-[26rpx] font-bold text-primary shrink-0">
          {detail.attendanceStatusText === '已取消' && detail.hoursUsed <= 0
            ? '未扣课时'
            : `-${detail.hoursUsed}课时`}
        </Text>
      </View>

      <Text className="text-[20rpx] text-muted-foreground truncate block">{detail.description}</Text>
      <Text className="text-[20rpx] text-muted-foreground/90 truncate block mt-[4rpx]">
        {detail.teacherDisplayText}
      </Text>

      {detail.totalHours > 0 ? (
        <View className="mt-[10rpx]">
          <View className="h-[8rpx] rounded-[4rpx] bg-border overflow-hidden">
            <View
              className={cn(
                'h-full rounded-[4rpx]',
                getBarFill(detail.remainingHours, detail.totalHours),
              )}
              style={{
                width: `${Math.min(
                  Math.max(
                    ((detail.totalHours - detail.remainingHours) / detail.totalHours) * 100,
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
);

const LessonConsumptionList: React.FC<LessonConsumptionListProps> = ({
  sections,
  emptyText = '暂无消课记录',
  footerText,
  onFooterClick,
  onRecordClick,
  embedded = false,
  showDateHeaders = true,
}) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const cardCount = useMemo(
    () =>
      sections.reduce(
        (sum, section) => sum + section.cards.length + section.personalItems.length,
        0,
      ),
    [sections],
  );

  const handleToggleCard = useCallback((cardId: string) => {
    setExpandedCardId((prev) => (prev === cardId ? null : cardId));
  }, []);

  const handleStudentClick = useCallback((studentId: string) => {
    if (!studentId) {
      return;
    }

    Taro.navigateTo({
      url: `/package-student/pages/student-detail/index?id=${encodeURIComponent(studentId)}`,
    });
  }, []);

  if (cardCount === 0) {
    if (embedded) {
      return <Text className="text-[24rpx] text-muted-foreground text-center py-[24rpx]">{emptyText}</Text>;
    }
    return (
      <View className="bg-card rounded-[28rpx] shadow-card px-[28rpx] py-[60rpx] text-center">
        <Text className="text-muted-foreground text-[28rpx]">{emptyText}</Text>
      </View>
    );
  }

  return (
    <View className={cn('flex flex-col', embedded ? 'gap-[12rpx]' : 'gap-[24rpx]')}>
      {sections.map((section) => (
        <View key={section.id} className="flex flex-col gap-[16rpx]">
          {showDateHeaders ? (
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
          ) : null}

          <View className="flex flex-col gap-[16rpx]">
            {section.cards.map((card) => {
              const isExpanded = expandedCardId === card.id;
              const allCancelled =
                card.details.length > 0 &&
                card.details.every(
                  (detail) => detail.attendanceStatusText === '已取消' && detail.hoursUsed <= 0,
                );

              return (
                <View key={card.id} className="bg-card rounded-[24rpx] shadow-card overflow-hidden">
                  <View
                    className="flex flex-row items-center gap-[20rpx] px-[32rpx] py-[28rpx] press-bg"
                    onClick={() => handleToggleCard(card.id)}
                  >
                    <View
                      className="w-[16rpx] min-h-[60rpx] self-stretch rounded-full shrink-0"
                      style={{ backgroundColor: TODO_LEVEL_BAR_COLOR.normal }}
                    />
                    <View className="flex-1 min-w-0">
                      <View className="flex flex-row items-center gap-[12rpx]">
                        <Text className="text-[28rpx] font-medium text-foreground truncate">
                          {card.title}
                        </Text>
                        <View className="shrink-0 px-[10rpx] py-[2rpx] rounded-full bg-primary-bg">
                          <Text className="text-[20rpx] text-primary">{card.studentCountText}</Text>
                        </View>
                      </View>
                      <Text className="mt-[6rpx] block text-[22rpx] text-muted-foreground truncate">
                        {card.subtitle}
                      </Text>
                    </View>
                    <Text className="text-[26rpx] font-semibold text-primary shrink-0">
                      {allCancelled ? '已取消' : `-${card.totalHours}课时`}
                    </Text>
                    <Icon
                      name={isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                      size="sm"
                      color="muted"
                      className="shrink-0"
                    />
                  </View>

                  {isExpanded && (
                    <View className="bg-muted px-[32rpx] pb-[20rpx] border-t border-border">
                      {card.details.map((detail, index) => (
                        <StudentConsumptionRow
                          key={detail.id}
                          detail={detail}
                          onStudentClick={handleStudentClick}
                          onRecordClick={onRecordClick}
                          showDivider={index < card.details.length - 1}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {section.personalItems.map((detail) => (
              <View
                key={detail.id}
                className="bg-card rounded-[24rpx] shadow-card overflow-hidden px-[32rpx] py-[8rpx]"
              >
                <View className="flex flex-row gap-[20rpx]">
                  <View
                    className="w-[16rpx] min-h-[60rpx] self-stretch rounded-full shrink-0 mt-[20rpx]"
                    style={{ backgroundColor: TODO_LEVEL_BAR_COLOR.low }}
                  />
                  <View className="flex-1 min-w-0">
                    <StudentConsumptionRow
                      detail={detail}
                      onStudentClick={handleStudentClick}
                      onRecordClick={onRecordClick}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}

      {footerText && onFooterClick ? (
        <View
          className="mt-[8rpx] py-[24rpx] flex items-center justify-center press-scale"
          onClick={onFooterClick}
        >
          <Text className="text-[24rpx] font-medium text-primary">{footerText}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default LessonConsumptionList;
