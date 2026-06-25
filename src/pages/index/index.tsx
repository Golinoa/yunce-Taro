import { View, Text, ScrollView } from '@tarojs/components';
import dayjs from 'dayjs';
import React, { useState, useEffect, useCallback } from 'react';
import StatsOverview from '@/components/home/StatsOverview';
import TodayScheduleCard from '@/components/home/TodayScheduleCard';
import Icon from '@/components/Icon';
import { homeService } from '@/services';
import type { StatsPeriod, StatsData, HomeTeacherSummary } from '@/services/home';
import { useCampusStore } from '@/stores/campus';
import type { Schedule } from '@/types/schedule';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 时段问候语 */
function getGreeting(): string {
  const hour = dayjs().hour();
  if (hour < 6) return '凌晨好';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

/**
 * Index - 教师端首页
 *
 * 功能：
 * - 渐变头部 + 问候语 + 校区
 * - 统计概览卡片（今日/本周/上周/本月）
 * - 今日课表卡片（v3 设计稿左右分栏+状态卡片）
 */
const Index: React.FC = () => {
  const { profile } = useAuth();
  const mainCampus = useCampusStore((s) => s.campuses.find((c) => c.isMain) || s.campuses[0]);
  const [teacher, setTeacher] = useState<HomeTeacherSummary | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('today');
  const [statsData, setStatsData] = useState<StatsData>({
    checkinCount: 0,
    leaveCount: 0,
    lessonHours: 0,
    lessonAmount: 0,
  });

  // 加载统计数据
  const loadStatsData = useCallback(async (teacherId: string, period: StatsPeriod) => {
    try {
      const data = await homeService.getStatsByPeriod(teacherId, period);
      setStatsData(data);
    } catch (err) {
      logError('Index loadStatsData', err);
    }
  }, []);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;
      const teacherInfo = await homeService.getTeacher(profile.id);
      if (!teacherInfo) return;
      setTeacher(teacherInfo);

      const scheduleList = await homeService.getTodaySchedules(teacherInfo.id);
      setSchedules(scheduleList);

      // 加载初始统计数据（今日）
      await loadStatsData(teacherInfo.id, 'today');
    };
    loadData();
  }, [profile, loadStatsData]);

  const handlePeriodChange = useCallback(
    (period: StatsPeriod) => {
      setStatsPeriod(period);
      if (teacher?.id) {
        loadStatsData(teacher.id, period);
      }
    },
    [teacher, loadStatsData],
  );

  const greeting = getGreeting();

  return (
    <ScrollView scrollY className="h-screen bg-background">
      {/* 渐变头部 */}
      <View className="bg-gradient-primary rounded-b-[60rpx] pb-[40rpx] relative overflow-hidden">
        {/* 装饰圆 */}
        <View className="absolute -top-[200rpx] -right-[100rpx] w-[600rpx] h-[600rpx] rounded-full bg-white/8" />
        <View className="absolute -bottom-[150rpx] -left-[80rpx] w-[400rpx] h-[400rpx] rounded-full bg-white/5" />

        {/* 问候语 */}
        <View className="px-[32rpx] pt-[80rpx] pb-[24rpx]">
          <Text className="text-[48rpx] font-bold text-white block">
            {greeting}！{teacher?.name || '老师'}
          </Text>
          <View className="flex items-center gap-[4rpx] mt-[8rpx]">
            <Text className="text-[26rpx] text-white/80">{mainCampus?.name || '未设置校区'}</Text>
            <Icon name="mdi-chevron-right" size="xs" color="white" />
          </View>
        </View>

        {/* 统计卡片 */}
        <View className="mx-[28rpx]">
          <StatsOverview
            period={statsPeriod}
            onPeriodChange={handlePeriodChange}
            data={statsData}
          />
        </View>
      </View>

      {/* 今日课表 */}
      <TodayScheduleCard schedules={schedules} />
    </ScrollView>
  );
};

export default withRouteGuard(Index);
