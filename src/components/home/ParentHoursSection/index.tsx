import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import ParentGlassShell from '@/components/home/ParentGlassShell';
import Icon from '@/components/Icon';

export interface ParentHourPackageCard {
  id: string;
  name: string;
  remainingHours: number;
  usedHours: number;
  totalHours: number;
  studentId?: string;
}

export interface ParentHoursSectionProps {
  packages: ParentHourPackageCard[];
  /** 用于 scroll-into-view 定位 */
  sectionId?: string;
  /** 无课包时「去续费」兜底跳转的学员 id */
  fallbackStudentId?: string;
}

/**
 * 家长端首页「我的课时」
 * 外层白卡 + 内层淡色磨砂课包卡（1~2 张）
 */
const ParentHoursSection: React.FC<ParentHoursSectionProps> = ({
  packages,
  sectionId = 'parent-hours',
  fallbackStudentId,
}) => {
  const displayPackages = packages.slice(0, 2);

  const goBilling = () => {
    const studentId = displayPackages[0]?.studentId || fallbackStudentId;
    if (studentId) {
      Taro.navigateTo({
        url: `/package-student/pages/child-detail/index?id=${encodeURIComponent(studentId)}&tab=packages`,
      });
      return;
    }
    Taro.navigateTo({ url: '/package-student/pages/children/index' });
  };

  const goDetail = (pkg: ParentHourPackageCard) => {
    if (pkg.studentId) {
      Taro.navigateTo({
        url: `/package-student/pages/child-detail/index?id=${encodeURIComponent(pkg.studentId)}&tab=packages`,
      });
      return;
    }
    goBilling();
  };

  return (
    <ParentGlassShell
      sectionId={sectionId}
      title="我的课时"
      headerRight={
        <View
          className="flex flex-row items-center gap-[4rpx] pr-[4rpx] press-scale"
          onClick={goBilling}
        >
          <Text className="text-[24rpx] text-muted-foreground">去续费与查账</Text>
          <Icon name="mdi-chevron-right" size={28} color="muted" />
        </View>
      }
    >
      {displayPackages.length === 0 ? (
        <View className="parent-glass-inner flex flex-col items-center px-[28rpx] py-[48rpx]">
          <Icon name="mdi-wallet-outline" size="lg" color="muted" />
          <Text className="mt-[12rpx] text-[24rpx] text-muted-foreground">暂无课包</Text>
          <View
            className="mt-[24rpx] w-full rounded-[20rpx] bg-primary py-[22rpx] press-scale"
            onClick={goBilling}
          >
            <Text className="block text-center text-[28rpx] font-semibold text-white">
              查看卡包
            </Text>
          </View>
        </View>
      ) : (
        <View className="flex flex-col gap-[16rpx]">
          {displayPackages.map((pkg) => (
            <View key={pkg.id} className="parent-glass-inner px-[28rpx] py-[28rpx]">
              <Text className="mb-[20rpx] block text-[30rpx] font-bold text-foreground">
                {pkg.name}
              </Text>
              <View className="mb-[24rpx] flex flex-row items-baseline justify-between gap-[16rpx]">
                <View className="flex min-w-0 flex-row items-baseline">
                  <Text className="text-[44rpx] font-extrabold leading-none text-primary">
                    {pkg.remainingHours}
                  </Text>
                  <Text className="ml-[8rpx] text-[26rpx] text-muted-foreground">/剩余课时</Text>
                </View>
                <Text className="flex-shrink-0 text-[26rpx] text-muted-foreground">
                  累计已消: {pkg.usedHours}课时
                </Text>
              </View>
              <View
                className="w-full rounded-[20rpx] bg-primary py-[22rpx] press-scale"
                onClick={() => goDetail(pkg)}
              >
                <Text className="block text-center text-[28rpx] font-semibold text-white">
                  查看详情
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ParentGlassShell>
  );
};

export default ParentHoursSection;
