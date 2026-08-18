import { View, Text, ScrollView, Image } from '@tarojs/components';
import dayjs from 'dayjs';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CampusSelectSheet from '@/components/home/CampusSelectSheet';
import TodayScheduleCard from '@/components/home/TodayScheduleCard';
import Icon from '@/components/Icon';
import { homeService } from '@/services';
import { useCampusStore } from '@/stores/campus';
import type { CampusUIModel } from '@/types/campus';
import type { Schedule } from '@/types/schedule';
import { useAuth } from '@/utils/auth';
import { withRouteGuard } from '@/utils/route-guard';

/** 机构背景图（瑜伽馆） */
const ORG_COVER_IMAGE = '/assets/images/2.jpg';

/** 解析营业时间，返回 HH:mm 格式起止时间 */
function parseBusinessHours(hours?: string): { start: string; end: string } | null {
  if (!hours) return null;
  const match = hours.match(/(\d{2}:\d{2}):\d{2}至(\d{2}:\d{2}):\d{2}/);
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

/** 根据当前时间判断校区是否营业中 */
function isCampusOpen(hours?: string): boolean {
  const parsed = parseBusinessHours(hours);
  if (!parsed) return true;
  const now = dayjs();
  const start = dayjs(`${now.format('YYYY-MM-DD')} ${parsed.start}`);
  const end = dayjs(`${now.format('YYYY-MM-DD')} ${parsed.end}`);
  return now.isAfter(start) && now.isBefore(end);
}

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
          <View
            className="bg-white/92 backdrop-blur-md rounded-[32rpx] p-[24rpx] shadow-card press-scale"
            onClick={handleOpenCampusSheet}
          >
            <View className="flex items-center gap-[20rpx]">
              {/* 校区 Logo */}
              <View
                className="w-[88rpx] h-[88rpx] rounded-[20rpx] center overflow-hidden shrink-0 bg-[var(--campus-logo-gradient)]"
                style={
                  {
                    '--campus-logo-gradient':
                      currentCampus?.iconGradient || 'linear-gradient(135deg, #5EC8A8, #4AB893)',
                  } as React.CSSProperties
                }
              >
                {currentCampus?.logo ? (
                  <Image src={currentCampus.logo} className="w-full h-full" mode="aspectFill" />
                ) : (
                  <Text className="text-[40rpx]">{currentCampus?.icon || '🏢'}</Text>
                )}
              </View>

              {/* 校区信息 */}
              <View className="flex-1 min-w-0">
                <View className="flex items-center gap-[12rpx] mb-[6rpx]">
                  <Text className="text-[32rpx] font-bold text-foreground truncate">
                    {currentCampus?.name || '未设置校区'}
                  </Text>
                  <View
                    className={`flex items-center gap-[6rpx] px-[12rpx] py-[2rpx] rounded-[8rpx] ${
                      isOpen ? 'bg-success-bg' : 'bg-muted'
                    }`}
                  >
                    <View
                      className={`w-[12rpx] h-[12rpx] rounded-full ${
                        isOpen ? 'bg-success' : 'bg-muted-foreground'
                      }`}
                    />
                    <Text
                      className={`text-[22rpx] font-medium ${
                        isOpen ? 'text-success' : 'text-muted-foreground'
                      }`}
                    >
                      {isOpen ? '营业中' : '休息中'}
                    </Text>
                  </View>
                </View>
                <View className="flex items-center gap-[4rpx]">
                  <Icon name="mdi-map-marker-outline" size="xxs" color="mutedForeground" />
                  <Text className="text-[22rpx] text-muted-foreground truncate max-w-[240rpx]">
                    {currentCampus?.address || '暂无地址'}
                  </Text>
                </View>
              </View>

              {/* 切换按钮 */}
              <View className="flex flex-col items-end gap-[4rpx] shrink-0">
                <View className="flex items-center gap-[2rpx]">
                  <Text className="text-[26rpx] font-semibold text-foreground">切换校区</Text>
                  <Icon name="mdi-chevron-down" size="xs" color="foreground" />
                </View>
                {businessTime && (
                  <Text className="text-[26rpx] text-muted-foreground">· {businessTime}</Text>
                )}
              </View>
            </View>
          </View>
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
