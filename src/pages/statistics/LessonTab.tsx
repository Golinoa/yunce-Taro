import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import BarChart from '@/components/statistics/BarChart';
import ChartContainer from '@/components/statistics/ChartContainer';
import type { ChartDataItem } from '@/components/statistics/ChartContainer';
import KpiCard from '@/components/statistics/KpiCard';
import RankList from '@/components/statistics/RankList';
import type { RankItem } from '@/components/statistics/RankList';
import type { CoursePackage, LessonRecord } from '@/types';
import type { Student } from '@/types/student';
import { formatDateCN } from '@/utils/format';

interface LessonTabProps {
  isTeacher: boolean;
  totalHoursUsed: number;
  totalRemaining: number;
  totalHours: number;
  lessonCount: number;
  displayLessonTrend: ChartDataItem[];
  displayLessonRank: { label: string; value: number; unit: string }[];
  displayParentTrend: ChartDataItem[];
  studentDetail: RankItem[];
  records: LessonRecord[];
  packages: CoursePackage[];
  parentStudents: Student[];
}

/** 课时统计 Tab 内容 */
const LessonTab: React.FC<LessonTabProps> = ({
  isTeacher,
  totalHoursUsed,
  totalRemaining,
  totalHours,
  lessonCount,
  displayLessonTrend,
  displayLessonRank,
  displayParentTrend,
  studentDetail,
  records,
  packages,
  parentStudents,
}) => {
  return (
    <>
      <KpiCard
        data={
          isTeacher
            ? [
                { id: 's1', label: '消耗课时', value: totalHoursUsed, unit: '课时' },
                { id: 's2', label: '剩余课时', value: totalRemaining, unit: '课时' },
                { id: 's3', label: '上课次数', value: lessonCount, unit: '次' },
              ]
            : [
                { id: 's1', label: '消耗课时', value: totalHoursUsed, unit: '课时' },
                { id: 's2', label: '剩余课时', value: totalRemaining, unit: '课时' },
                { id: 's3', label: '充值课时', value: totalHours, unit: '课时' },
                { id: 's4', label: '上课次数', value: lessonCount, unit: '次' },
              ]
        }
      />

      {isTeacher && (
        <ChartContainer
          title="近6个月课时消耗趋势"
          data={displayLessonTrend}
          unit="课时"
          theme="primary"
        />
      )}

      {!isTeacher && (
        <BarChart
          title="最近上课课时"
          data={displayParentTrend}
          unit="课时"
          barColor="bg-gradient-accent"
        />
      )}

      {isTeacher && <BarChart title="学生课时消耗排行" data={displayLessonRank} unit="课时" />}

      {isTeacher && studentDetail.length > 0 && (
        <RankList
          title="学生课时明细"
          data={studentDetail}
          mode="detail"
          emptyText="暂无明细数据"
        />
      )}

      {/* 家长端：还未绑定学生空状态引导 */}
      {!isTeacher && parentStudents.length === 0 && (
        <View className="bg-card rounded-2xl p-6 shadow-soft flex flex-col items-center gap-4 mt-6">
          <View className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="mdi-link-plus" size="lg" color="primary" />
          </View>
          <View className="text-center">
            <Text className="text-xl font-semibold text-foreground block mb-1">还未绑定学生</Text>
            <Text className="text-base text-muted-foreground">请先前往「我的」页面绑定学生</Text>
          </View>
          <View
            className="w-full btn-primary bg-gradient-primary shadow-elegant"
            onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
          >
            <Text className="text-primary-foreground text-xl font-medium">前往绑定</Text>
          </View>
        </View>
      )}

      {/* 家长端：上课记录列表 */}
      {!isTeacher && parentStudents.length > 0 && (
        <>
          <Text className="text-xl font-semibold text-foreground mb-3 mt-6">上课记录</Text>
          <View className="flex flex-col gap-3">
            {records.length > 0 ? (
              records.map((r) => (
                <View
                  key={r.id}
                  className="bg-card rounded-2xl p-4 shadow-soft press-scale"
                  onClick={() =>
                    Taro.navigateTo({
                      url: `/package-course/pages/lesson-detail/index?id=${encodeURIComponent(r.id)}`,
                    })
                  }
                >
                  <View className="flex items-center justify-between">
                    <View className="flex items-center gap-3">
                      <View className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                        <Icon
                          name="mdi-book-open-variant"
                          size="sm"
                          color="hsl(var(--primary-foreground))"
                        />
                      </View>
                      <View className="flex flex-col gap-1">
                        <Text className="text-lg font-medium text-foreground">
                          {r.course_package?.name || '课程'}
                        </Text>
                        <Text className="text-sm text-muted-foreground">
                          {formatDateCN(r.lesson_date)}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-lg font-semibold text-primary">-{r.hours_used}课时</Text>
                  </View>
                  {r.content && (
                    <View className="mt-2 text-base text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                      内容：{r.content}
                    </View>
                  )}
                  {r.performance && (
                    <View className="mt-1 text-base text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                      表现：{r.performance}
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Empty icon="mdi-inbox" description="暂无上课记录" />
            )}
          </View>

          <Text className="text-xl font-semibold text-foreground mb-3 mt-6">课时充值</Text>
          <View className="space-y-3">
            {packages.length > 0 ? (
              packages.map((pkg) => (
                <View key={pkg.id} className="bg-card rounded-2xl p-4 shadow-soft">
                  <View className="flex items-center justify-between mb-2">
                    <View className="flex items-center gap-3">
                      <View className="w-10 h-10 rounded-full bg-gradient-accent flex items-center justify-center">
                        <Icon
                          name="mdi-cash-multiple"
                          size="sm"
                          color="hsl(var(--accent-foreground))"
                        />
                      </View>
                      <View className="flex flex-col gap-1">
                        <Text className="text-lg font-medium text-foreground">{pkg.name}</Text>
                        <Text className="text-sm text-muted-foreground">
                          {formatDateCN(pkg.created_at)}
                        </Text>
                      </View>
                    </View>
                    <View className="flex flex-col items-end gap-1">
                      <Text className="text-lg font-semibold text-primary">
                        +{pkg.total_hours}课时
                      </Text>
                      {pkg.fee_amount != null && pkg.fee_amount > 0 && (
                        <Text className="text-sm text-muted-foreground">¥{pkg.fee_amount}</Text>
                      )}
                    </View>
                  </View>
                  <View className="flex items-center justify-between">
                    <Text className="text-sm text-muted-foreground">
                      剩余 {pkg.remaining_hours} / 共 {pkg.total_hours} 课时
                    </Text>
                    <Text
                      className={`text-xs px-2 py-0_d5 rounded-full ${pkg.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {pkg.status === 'active'
                        ? '生效中'
                        : pkg.status === 'completed'
                          ? '已用完'
                          : '已过期'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Empty icon="mdi-package-variant" description="暂无充值记录" />
            )}
          </View>
        </>
      )}
    </>
  );
};

export default LessonTab;
