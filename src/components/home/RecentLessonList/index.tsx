import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useState } from 'react';
import Icon from '@/components/Icon';

/** 学生消课信息 */
export interface RecentStudent {
  name: string;
  avatar: string;
  hoursUsed: number;
  remainingHours: number;
  totalHours: number;
  time: string;
  tag?: '即将到期' | '需续费';
}

/** 班级消课组 */
export interface RecentGroup {
  id: string;
  className: string;
  meta: string;
  totalHours: number;
  students: RecentStudent[];
}

export interface RecentLessonListProps {
  groups: RecentGroup[];
}

/** 课时占比 → 进度条颜色 */
function getBarFill(remaining: number, total: number): string {
  if (total <= 0) return 'bar-fill-green';
  const ratio = remaining / total;
  if (ratio <= 0.15) return 'bar-fill-red';
  if (ratio <= 0.35) return 'bar-fill-orange';
  return 'bar-fill-green';
}

/** 标签样式（使用 theme token） */
function getTagStyle(tag?: string): string {
  if (tag === '需续费') return 'bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))]';
  if (tag === '即将到期') return 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]';
  return '';
}

/**
 * RecentLessonList - 最近消课手风琴 v14
 *
 * 对齐设计稿 index_v14.html recent-group：
 * - 手风琴互斥展开
 * - 班级头部：图标 + 班级名 + 元信息 + 课时 + 箭头
 * - 展开详情：学生列表 + 进度条 + 标签
 */
const RecentLessonList: React.FC<RecentLessonListProps> = ({ groups }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <View className="py-[80rpx] text-center">
        <Text className="text-[hsl(var(--muted-foreground))] text-[28rpx]">暂无消课记录</Text>
      </View>
    );
  }

  const toggleGroup = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <View className="flex flex-col gap-[20rpx]">
      {groups.map((group) => {
        const isExpanded = expandedId === group.id;

        return (
          <View key={group.id} className="recent-group-v14">
            {/* 头部 */}
            <View
              className="flex items-center gap-[20rpx] px-[28rpx] py-[24rpx]"
              onClick={() => toggleGroup(group.id)}
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
                <Text className="text-[28rpx] font-bold text-foreground block">
                  {group.className}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground mt-[2rpx]">{group.meta}</Text>
              </View>
              <Text className="text-[28rpx] font-bold text-[hsl(var(--primary))] shrink-0">
                -{group.totalHours}课时
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

            {/* 展开详情 */}
            {isExpanded && (
              <View className="bg-[hsl(var(--muted))] px-[28rpx] pb-[20rpx]">
                {group.students.map((student, idx) => {
                  const barWidth =
                    student.totalHours > 0
                      ? Math.round(
                          ((student.totalHours - student.remainingHours) / student.totalHours) *
                            100,
                        )
                      : 0;

                  return (
                    <View
                      key={idx}
                      className={cn(
                        'flex items-center gap-[20rpx] py-[20rpx]',
                        idx < group.students.length - 1
                          ? 'border-b-[2rpx] border-[hsl(var(--border))]'
                          : '',
                      )}
                    >
                      {/* 头像 */}
                      <View
                        className="w-[64rpx] h-[64rpx] rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background:
                            'linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(var(--primary)/0.15))',
                        }}
                      >
                        <Text className="text-[26rpx] font-bold text-[hsl(var(--primary))]">
                          {student.avatar}
                        </Text>
                      </View>

                      <View className="flex-1 min-w-0">
                        <View className="flex items-center justify-between mb-[8rpx]">
                          <View className="flex items-center gap-[8rpx]">
                            <Text className="text-[26rpx] text-foreground font-semibold">
                              {student.name}
                            </Text>
                            {student.tag && (
                              <View
                                className={cn(
                                  'px-[10rpx] py-[2rpx] rounded-[8rpx]',
                                  getTagStyle(student.tag),
                                )}
                              >
                                <Text className="text-[18rpx] font-bold">{student.tag}</Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-[26rpx] font-bold text-[hsl(var(--primary))] shrink-0">
                            -{student.hoursUsed}课时
                          </Text>
                        </View>
                        {/* 进度条 */}
                        <View className="h-[8rpx] rounded-[4rpx] bg-[hsl(var(--muted))] overflow-hidden">
                          <View
                            className={cn(
                              'h-full rounded-[4rpx]',
                              getBarFill(student.remainingHours, student.totalHours),
                            )}
                            style={{ width: `${barWidth}%` }}
                          />
                        </View>
                        <View className="flex justify-between mt-[4rpx]">
                          <Text className="text-[20rpx] text-muted-foreground">{student.time}</Text>
                          <Text className="text-[20rpx] text-muted-foreground">
                            余{student.remainingHours}课时
                          </Text>
                        </View>
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
  );
};

export default RecentLessonList;
