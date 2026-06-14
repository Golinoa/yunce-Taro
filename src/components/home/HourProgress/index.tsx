import { View, Text } from '@tarojs/components';
import React, { useMemo } from 'react';
import Icon from '@/components/Icon';
import type { CoursePackage } from '@/types/course-package';

interface HourProgressProps {
  packages: CoursePackage[];
}

const HourProgress: React.FC<HourProgressProps> = ({ packages }) => {
  const { totalAll, totalUsed, totalRemaining } = useMemo(() => {
    const all = packages.reduce((sum, p) => sum + (p.total_hours || 0), 0);
    const remaining = packages.reduce((sum, p) => sum + (p.remaining_hours || 0), 0);
    return { totalAll: all, totalUsed: all - remaining, totalRemaining: remaining };
  }, [packages]);

  const isLow = totalRemaining < 3 && totalAll > 0;

  return (
    <View className="bg-card rounded-xl shadow-soft px-4 py-3_d5">
      {/* 汇总统计 */}
      <View className="flex items-center justify-around mb-3_d5">
        <View className="flex flex-col items-center gap-1">
          <Text className="text-sm text-muted-foreground">总课时</Text>
          <Text className="text-2xl font-bold text-foreground">{totalAll}</Text>
        </View>
        <View className="w-0_d5 h-6 bg-border" />
        <View className="flex flex-col items-center gap-1">
          <Text className="text-sm text-muted-foreground">已消课</Text>
          <Text className="text-2xl font-bold text-muted-foreground">{totalUsed}</Text>
        </View>
        <View className="w-0_d5 h-6 bg-border" />
        <View className="flex flex-col items-center gap-1">
          <Text className="text-sm text-muted-foreground">剩余</Text>
          <Text className={`text-2xl font-bold ${isLow ? 'text-destructive' : 'text-primary'}`}>
            {totalRemaining}
          </Text>
        </View>
      </View>

      {/* 各套餐进度条 */}
      {packages.map((pkg) => {
        const percent =
          pkg.total_hours > 0 ? Math.round((pkg.remaining_hours / pkg.total_hours) * 100) : 0;
        const pkgLow = pkg.remaining_hours < 3 && pkg.total_hours > 0;

        return (
          <View key={pkg.id} className="mt-2_d5">
            <View className="flex items-center justify-between mb-1">
              <Text className="text-base text-foreground font-medium">{pkg.name}</Text>
              <Text
                className={`text-sm font-semibold ${pkgLow ? 'text-destructive' : 'text-primary'}`}
              >
                {pkg.remaining_hours}/{pkg.total_hours} 课时
              </Text>
            </View>
            <View className="w-full h-1_d5 bg-muted rounded-sm overflow-hidden">
              <View
                className={`h-full rounded-sm transition-all duration-500 ${pkgLow ? 'bg-gradient-to-r from-destructive to-warning' : 'bg-gradient-primary'}`}
                style={{ width: `${percent}%` }}
              />
            </View>
          </View>
        );
      })}

      {/* 课时不足提醒 */}
      {isLow && (
        <View className="flex items-center gap-2 mt-3 px-3 py-2_d5 bg-destructive/10 border border-destructive/20 rounded-lg">
          <Icon name="mdi-alert" size="sm" color="warning" />
          <View className="flex-1">
            <Text className="block text-base font-medium text-destructive mb-0_d5">
              课时不足提醒
            </Text>
            <Text className="text-sm text-destructive/80">
              剩余课时仅 {totalRemaining} 课时，请联系教师充值
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default HourProgress;
