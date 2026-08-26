import { View, ScrollView, Image } from '@tarojs/components';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import HomeCampusCard from '@/components/home/campus-card';
import CampusSelectSheet from '@/components/home/CampusSelectSheet';
import TodayScheduleCard from '@/components/home/TodayScheduleCard';
import { ORG_COVER_IMAGE } from '@/constants/brand';
import { homeService } from '@/services';
import { useCampusStore } from '@/stores/campus';
import type { CampusUIModel } from '@/types/campus';
import type { Schedule } from '@/types/schedule';
import { useAuth } from '@/utils/auth';
import { parseBusinessHours, isCampusOpen } from '@/utils/campus';
import { withRouteGuard } from '@/utils/route-guard';

/**
 * Index - 教师端首页
 *
 * 功能：
 * - 机构图片背景头部 + 校区切换卡片
 * - 今日课表卡片
 */
const Index: React.FC = () => {
  const { profile } = useAuth();
  const campuses = useCampusStore((s) => s.campuses);
  const currentCampusId = useCampusStore((s) => s.currentCampusId);
  const setCurrentCampusId = useCampusStore((s) => s.setCurrentCampusId);
  const fetchCampuses = useCampusStore((s) => s.fetchCampuses);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showCampusSheet, setShowCampusSheet] = useState(false);

  const currentCampus = useMemo(() => {
    const byId = campuses.find((c) => c.id === currentCampusId);
    return byId || campuses.find((c) => c.isMain) || campuses[0] || null;
  }, [campuses, currentCampusId]);

  // 加载校区列表
  useEffect(() => {
    void fetchCampuses();
  }, [fetchCampuses]);

  // 加载教师与今日课表数据
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;
      const teacherInfo = await homeService.getTeacher(profile.id);
      if (!teacherInfo) return;

      const scheduleList = await homeService.getTodaySchedules(teacherInfo.id);
      setSchedules(scheduleList);
    };
    loadData();
  }, [profile]);

  const handleOpenCampusSheet = useCallback(() => {
    setShowCampusSheet(true);
  }, []);

  const handleCloseCampusSheet = useCallback(() => {
    setShowCampusSheet(false);
  }, []);

  const handleConfirmCampus = useCallback(
    (campus: CampusUIModel) => {
      setCurrentCampusId(campus.id);
      setShowCampusSheet(false);
    },
    [setCurrentCampusId],
  );

  const businessTime = useMemo(() => {
    const parsed = parseBusinessHours(currentCampus?.businessHours);
    if (!parsed) return '';
    return `${parsed.start}-${parsed.end}`;
  }, [currentCampus?.businessHours]);

  const isOpen = useMemo(
    () => isCampusOpen(currentCampus?.businessHours),
    [currentCampus?.businessHours],
  );

  return (
    <ScrollView scrollY className="h-screen bg-background">
      {/* 机构背景图头部 */}
      <View className="relative h-[460rpx] overflow-hidden rounded-b-[60rpx]">
        <Image src={ORG_COVER_IMAGE} className="absolute inset-0 w-full h-full" mode="aspectFill" />
        {/* 暗色遮罩，保证卡片与文字可读 */}
        <View className="absolute inset-0 bg-black/35" />

        {/* 校区切换卡片 */}
        <View className="absolute bottom-[32rpx] left-[28rpx] right-[28rpx]">
          <HomeCampusCard
            campus={currentCampus}
            businessTime={businessTime}
            isOpen={isOpen}
            onSwitch={handleOpenCampusSheet}
            className="shadow-card"
          />
        </View>
      </View>

      {/* 今日课表 */}
      <TodayScheduleCard schedules={schedules} />

      {/* 校区切换弹窗 */}
      <CampusSelectSheet
        visible={showCampusSheet}
        currentId={currentCampusId}
        campuses={campuses}
        onClose={handleCloseCampusSheet}
        onConfirm={handleConfirmCampus}
      />
    </ScrollView>
  );
};

export default withRouteGuard(Index);
