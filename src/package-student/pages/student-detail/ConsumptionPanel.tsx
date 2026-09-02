/**
 * 学员详情 · 课程消耗 Tab
 *
 * 使用场景：课时汇总、课包进度、最近消课列表。
 * 功能说明：课时汇总、课包进度、最近消课；提供「申请退费」入口打开 RefundSheet。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import LessonConsumptionList, {
  navigateToLessonDetail,
  type LessonConsumptionSection,
} from '@/components/lesson/LessonConsumptionList';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import { PACKAGE_STATUS_MAP } from './student-detail-constants';
import { getPackageGiftHours, getPackageUsedHours } from './student-detail-package';

export interface ConsumptionPanelProps {
  packages: CoursePackage[];
  consumptionStats: {
    total: number;
    used: number;
    remaining: number;
    percent: number;
  };
  recentConsumptions: LessonRecord[];
  recentConsumptionSections: LessonConsumptionSection[];
  /** 是否存在可退费课包（控制按钮样式） */
  canRefund: boolean;
  /** 打开退费 Sheet；无可退时由上层 toast */
  onOpenRefund: () => void;
}

const ConsumptionPanel: React.FC<ConsumptionPanelProps> = ({
  packages,
  consumptionStats,
  recentConsumptions,
  recentConsumptionSections,
  canRefund,
  onOpenRefund,
}) => {
  return (
    <ScrollView scrollY className="h-full">
      <View className="px-[32rpx] pt-[32rpx] pb-[200rpx] flex flex-col gap-[24rpx]">
        <View className="bg-card rounded-[28rpx] p-[32rpx] shadow-soft">
          <View className="flex items-center justify-between mb-[28rpx]">
            <View className="flex items-center gap-[12rpx]">
              <Icon name="mdi-chart-bar" size={28} color="primary" />
              <Text className="text-[30rpx] font-bold text-foreground">课程消耗</Text>
            </View>
            <View
              className={cn(
                'flex items-center gap-[6rpx] rounded-[40rpx] px-[24rpx] py-[12rpx] press-scale',
                canRefund ? 'bg-destructive/10' : 'bg-muted',
              )}
              onClick={onOpenRefund}
            >
              <Icon
                name="mdi-cash"
                size={22}
                color={canRefund ? 'destructive' : 'hsl(var(--muted-foreground))'}
              />
              <Text
                className={cn(
                  'text-[24rpx] font-medium',
                  canRefund ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                申请退费
              </Text>
            </View>
          </View>
          <View className="flex flex-row gap-[16rpx]">
            <View className="flex-1 center-col py-[20rpx] rounded-[20rpx] bg-muted">
              <Text className="text-[40rpx] font-bold text-foreground leading-none">
                {consumptionStats.total}
              </Text>
              <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">累计课时</Text>
            </View>
            <View className="flex-1 center-col py-[20rpx] rounded-[20rpx] bg-primary-bg">
              <Text className="text-[40rpx] font-bold text-primary leading-none">
                {consumptionStats.used}
              </Text>
              <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">已消耗</Text>
            </View>
            <View className="flex-1 center-col py-[20rpx] rounded-[20rpx] bg-amber-10">
              <Text className="text-[40rpx] font-bold text-warning leading-none">
                {consumptionStats.remaining}
              </Text>
              <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">剩余课时</Text>
            </View>
          </View>
          <View className="mt-[28rpx]">
            <View className="flex items-center justify-between mb-[12rpx]">
              <Text className="text-[24rpx] text-muted-foreground">总体消耗进度</Text>
              <Text className="text-[24rpx] text-primary font-medium">
                {consumptionStats.percent}%
              </Text>
            </View>
            <View className="h-[16rpx] rounded-full bg-muted overflow-hidden">
              <View
                className="h-full rounded-full bg-gradient-primary"
                style={{ width: `${Math.min(Math.max(consumptionStats.percent, 2), 100)}%` }}
              />
            </View>
          </View>
        </View>

        <View className="bg-card rounded-[28rpx] p-[32rpx] shadow-soft">
          <View className="flex items-center justify-between mb-[24rpx]">
            <View className="flex items-center gap-[12rpx]">
              <Icon name="mdi-book-open" size={28} color="primary" />
              <Text className="text-[30rpx] font-bold text-foreground">课包明细</Text>
            </View>
            <Text className="text-[24rpx] text-muted-foreground">共 {packages.length} 个</Text>
          </View>
          {packages.length === 0 ? (
            <Empty icon="mdi-package-variant" description="暂无课包" />
          ) : (
            <View className="flex flex-col gap-[24rpx]">
              {packages.map((pkg) => {
                const used = getPackageUsedHours(pkg);
                const remaining = Math.max(Number(pkg.remaining_hours || 0), 0);
                const total = Math.max(Number(pkg.total_hours || 0), 0);
                const percent = total > 0 ? Math.round((used / total) * 100) : 0;
                const statusInfo = PACKAGE_STATUS_MAP[pkg.status] || PACKAGE_STATUS_MAP.active;
                const giftHours = getPackageGiftHours(pkg);
                return (
                  <View key={pkg.id} className="bg-muted rounded-[20rpx] p-[24rpx]">
                    <View className="flex items-start justify-between gap-[16rpx]">
                      <View className="flex-1 min-w-0">
                        <Text className="text-[28rpx] font-semibold text-foreground block truncate">
                          {pkg.name}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground mt-[6rpx] block">
                          充值 {total - giftHours} 课时
                          {giftHours > 0 ? ` · 赠送 ${giftHours} 课时` : ''}
                        </Text>
                      </View>
                      <View
                        className={cn(
                          'py-[6rpx] px-[16rpx] rounded-full flex-shrink-0',
                          statusInfo.className,
                        )}
                      >
                        <Text className="text-[20rpx] font-medium">{statusInfo.label}</Text>
                      </View>
                    </View>
                    <View className="mt-[20rpx]">
                      <View className="flex items-center justify-between mb-[10rpx]">
                        <Text className="text-[22rpx] text-muted-foreground">
                          已用 {used} / 共 {total}
                        </Text>
                        <Text className="text-[22rpx] text-primary font-medium">
                          剩余 {remaining} 课时
                        </Text>
                      </View>
                      <View className="h-[14rpx] rounded-full bg-card overflow-hidden">
                        <View
                          className="h-full rounded-full bg-gradient-primary"
                          style={{ width: `${Math.min(Math.max(percent, 2), 100)}%` }}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View className="bg-card rounded-[28rpx] p-[32rpx] shadow-soft">
          <View className="flex items-center gap-[12rpx] mb-[24rpx]">
            <Icon name="mdi-clock-outline" size={28} color="primary" />
            <Text className="text-[30rpx] font-bold text-foreground">最近消课</Text>
          </View>
          {recentConsumptions.length === 0 ? (
            <Empty icon="mdi-history" description="暂无消课记录" />
          ) : (
            <LessonConsumptionList
              sections={recentConsumptionSections}
              embedded
              showDateHeaders={false}
              onRecordClick={navigateToLessonDetail}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default ConsumptionPanel;
