import { View, ScrollView, Image } from '@tarojs/components';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import HomeCampusCard from '@/components/home/campus-card';
import CampusSelectSheet from '@/components/home/CampusSelectSheet';
import TodayScheduleCard from '@/components/home/TodayScheduleCard';
import { homeService } from '@/services';
import { useCampusList, useCampusStore } from '@/stores/campus';
import type { CampusUIModel } from '@/types/campus';
import type { Schedule } from '@/types/schedule';
import { useAuth } from '@/utils/auth';
import { parseBusinessHours, getCampusOpenStatus } from '@/utils/campus';
import { withRouteGuard } from '@/utils/route-guard';

/** 机构封面默认图：随本分包下发（B12 主包瘦身，避免占用主包体积） */
const ORG_COVER_IMAGE = '/package-auth/assets/cover-home.webp';

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
  // 校区列表 + 当前校区派生：统一走 harness（useCampusList，含唯一自愈 ensureLoaded）
  const { currentCampus, ensureLoaded: ensureCampusesLoaded } = useCampusList();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showCampusSheet, setShowCampusSheet] = useState(false);

  // 加载校区列表（harness 自愈：失败强拉重试一次）
  useEffect(() => {
    void ensureCampusesLoaded();
  }, [ensureCampusesLoaded]);

  // 加载教师与今日课表数据
  // 依赖含 currentCampusId：切校区后必须按新校区重拉课表（此前只依赖 profile，切了校区课表不动）
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;
      const teacherInfo = await homeService.getTeacher(profile.id);
      if (!teacherInfo) return;

      const scheduleList = await homeService.getTodaySchedules(
        teacherInfo.id,
        profile.currentContext?.role || null,
        currentCampusId || undefined,
      );
      setSchedules(scheduleList);
    };
    loadData();
  }, [profile, currentCampusId]);

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

  const openStatus = useMemo(
    () => getCampusOpenStatus(currentCampus?.businessHours),
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
            openStatus={openStatus}
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
