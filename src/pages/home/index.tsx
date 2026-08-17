import { View, Text, ScrollView, Image, Swiper, SwiperItem } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import CampusSelectSheet from '@/components/home/CampusSelectSheet';
import KingKongSection from '@/components/home/KingKongSection';
import TodayScheduleCard from '@/components/home/TodayScheduleCard';
import TodoList from '@/components/home/TodoList';
import type { TodoItem } from '@/components/home/TodoList';
import Icon from '@/components/Icon';
import LessonConsumptionList, {
  buildLessonConsumptionSections,
  pickHomeRecentLessonRecords,
} from '@/components/lesson/LessonConsumptionList';
import RoleSwitchSheet from '@/components/RoleSwitchSheet';
import { lessonRecordService } from '@/services';
import { homeService } from '@/services/home';
import type { QuickEntry } from '@/services/home';
import { useCampusStore } from '@/stores/campus';
import { useThemeStore } from '@/stores/theme';
import type { CampusUIModel } from '@/types/campus';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import { isPrincipalOrAbove, isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

/** Tab 类型 */
type HomeTab = 'schedule' | 'todo' | 'recent';

const HOME_TAB_SWIPER_DURATION = 260;
const HOME_TAB_ORDER: HomeTab[] = ['schedule', 'todo', 'recent'];
const ORG_COVER_IMAGE = '/assets/images/2.jpg';

const getHomeTabIndex = (tab: HomeTab): number => HOME_TAB_ORDER.indexOf(tab);

const getHomeTabByIndex = (index: number): HomeTab => HOME_TAB_ORDER[index] || 'schedule';

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
 * Home - 机构端首页
 *
 * 对齐设计稿：
 * - 机构图片背景头部 + 校区切换卡片
 * - 金刚区快捷入口
 * - Tab 切换：今日课表 / 待办事项 / 最近消课
 */
const Home: React.FC = () => {
  const { profile, currentRole, currentIdentity } = useAuth();
  const { campuses, currentCampusId, lastVisitedCampusId, setCurrentCampusId, fetchCampuses } =
    useCampusStore();
  const { activeTheme } = useThemeStore();
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [showCampusSheet, setShowCampusSheet] = useState(false);
  const navSafeHeight = useNavSafeHeight();

  const currentCampus = useMemo<CampusUIModel | null>(() => {
    const byId = campuses.find((c) => c.id === currentCampusId);
    return byId || campuses.find((c) => c.isMain) || campuses[0] || null;
  }, [campuses, currentCampusId]);

  const businessTime = useMemo(() => {
    const parsed = parseBusinessHours(currentCampus?.businessHours);
    if (!parsed) return '';
    return `${parsed.start}-${parsed.end}`;
  }, [currentCampus?.businessHours]);

  const isOpen = useMemo(
    () => isCampusOpen(currentCampus?.businessHours),
    [currentCampus?.businessHours],
  );

  // ---- 教师端状态 ----
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // ---- 快捷入口 ----
  const [quickEntries, setQuickEntries] = useState<QuickEntry[]>([]);

  // ---- Tab 状态 ----
  const [activeTab, setActiveTab] = useState<HomeTab>('schedule');
  const [homeSwiperCurrent, setHomeSwiperCurrent] = useState(0);
  const [homeSwiperHeight, setHomeSwiperHeight] = useState(420);

  // ---- 待办事项 ----
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);

  // ---- 最近消课 ----
  const [recentRecords, setRecentRecords] = useState<LessonRecord[]>([]);

  // ---- 未读消息数 ----
  const [unreadCount, setUnreadCount] = useState(0);
  // ---- 公共状态 ----
  const isFirstMount = useRef(true);
  const homeTabMeasureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================
  // 校区切换
  // ============================================
  const managedCampusIds = useMemo(() => {
    if (isPrincipalOrAbove(currentRole)) {
      return currentIdentity?.campusIds || [];
    }
    return [];
  }, [currentRole, currentIdentity]);

  const handleOpenCampusSheet = useCallback(() => {
    if (campuses.length === 0) {
      Taro.showToast({ title: '暂无校区', icon: 'none' });
      return;
    }
    setShowCampusSheet(true);
  }, [campuses.length]);

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

  // ============================================
  // 教师端数据加载
  // ============================================
  const loadData = useCallback(
    async (campusId?: string) => {
      if (!profile?.id) return;

      if (!isStaffRole(currentRole)) {
        try {
          const unread = await homeService.getUnreadCount(profile.id, currentRole);
          setUnreadCount(unread);
        } catch (err) {
          logError('Home loadUnreadCount', err);
        }
        return;
      }

      try {
        const teacherData = await homeService.getTeacher(profile.id, currentRole);
        if (!teacherData) {
          return;
        }

        const recentLessonRequest =
          currentRole === 'teacher'
            ? lessonRecordService.getByTeacher(teacherData.id, campusId)
            : lessonRecordService.getAll();

        const [scheduleList, unread, todoList, lessonRecords] = await Promise.all([
          homeService.getTodaySchedules(teacherData.id, currentRole, campusId),
          homeService.getUnreadCount(profile.id, currentRole),
          homeService.getTodoItems(teacherData.id, currentRole, campusId),
          recentLessonRequest,
        ]);
        setSchedules(scheduleList);
        setUnreadCount(unread);
        setTodoItems(todoList);
        setRecentRecords(lessonRecords);
      } catch (err) {
        logError('Home loadData', err);
      }
    },
    [profile, currentRole],
  );

  // ============================================
  // 初始化
  // ============================================
  useEffect(() => {
    setQuickEntries(homeService.getQuickEntries(currentRole));
    fetchCampuses();
  }, [currentRole, fetchCampuses]);

  useEffect(() => {
    loadData(currentCampusId);
  }, [profile, currentRole, currentCampusId, loadData]);

  useDidShow(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    loadData(currentCampusId);
  });

  // Tab 配置
  const TAB_OPTIONS: { key: HomeTab; label: string; badge?: number }[] = [
    { key: 'schedule', label: '今日课表' },
    { key: 'todo', label: '待办事项', badge: todoItems.length },
    { key: 'recent', label: '最近消课' },
  ];

  const recentSections = useMemo(
    () => buildLessonConsumptionSections(pickHomeRecentLessonRecords(recentRecords)),
    [recentRecords],
  );

  const measureHomeSwiperHeight = useCallback(
    (targetTab?: HomeTab) => {
      if (!isStaffRole(currentRole)) {
        return;
      }

      const nextTab = targetTab || getHomeTabByIndex(homeSwiperCurrent);
      const targetId = `#home-tab-panel-${nextTab}`;

      Taro.nextTick(() => {
        const query = Taro.createSelectorQuery();
        query.select(targetId).boundingClientRect();
        query.exec((result) => {
          const rect = result?.[0];
          if (rect?.height) {
            setHomeSwiperHeight(Math.max(320, Math.ceil(rect.height)));
          }
        });
      });
    },
    [currentRole, homeSwiperCurrent],
  );

  const scheduleHomeSwiperMeasure = useCallback(
    (targetTab?: HomeTab) => {
      if (homeTabMeasureTimerRef.current) {
        clearTimeout(homeTabMeasureTimerRef.current);
      }

      homeTabMeasureTimerRef.current = setTimeout(() => {
        measureHomeSwiperHeight(targetTab);
      }, HOME_TAB_SWIPER_DURATION + 40);
    },
    [measureHomeSwiperHeight],
  );

  const handleHomeTabChange = useCallback(
    (tab: HomeTab) => {
      setHomeSwiperCurrent(getHomeTabIndex(tab));
      scheduleHomeSwiperMeasure(tab);
    },
    [scheduleHomeSwiperMeasure],
  );

  const handleHomeSwiperChange = useCallback(
    (event: { detail?: { current?: number } }) => {
      const current = event.detail?.current ?? 0;
      const nextTab = getHomeTabByIndex(current);
      setHomeSwiperCurrent(current);
      scheduleHomeSwiperMeasure(nextTab);
    },
    [scheduleHomeSwiperMeasure],
  );

  const handleHomeSwiperFinish = useCallback(
    (event: { detail?: { current?: number } }) => {
      const current = event.detail?.current ?? homeSwiperCurrent;
      const nextTab = getHomeTabByIndex(current);
      setActiveTab(nextTab);
      measureHomeSwiperHeight(nextTab);
    },
    [homeSwiperCurrent, measureHomeSwiperHeight],
  );

  useEffect(() => {
    setHomeSwiperCurrent(getHomeTabIndex(activeTab));
  }, [activeTab]);

  useEffect(() => {
    measureHomeSwiperHeight(activeTab);
  }, [activeTab, schedules, todoItems, recentRecords, measureHomeSwiperHeight]);

  useEffect(() => {
    return () => {
      if (homeTabMeasureTimerRef.current) {
        clearTimeout(homeTabMeasureTimerRef.current);
      }
    };
  }, []);

  const renderHeader = () => {
    if (!isStaffRole(currentRole)) {
      return (
        <View className="mx-[32rpx] mt-[32rpx] p-[40rpx] rounded-[32rpx] bg-card shadow-soft flex flex-col items-center">
          <Icon name="school" size={80} className="text-primary mb-[24rpx]" />
          <Text className="text-[32rpx] font-bold text-foreground mb-[12rpx]">家长端首页</Text>
          <Text className="text-[26rpx] text-muted-foreground text-center leading-normal">
            当前联调阶段先展示通用运营内容{'\n'}
            可从消息通知和个人中心继续使用家长侧能力
          </Text>
          <View className="mt-[24rpx] flex gap-[16rpx] w-full">
            <View
              className="flex-1 rounded-full bg-primary px-[24rpx] py-[18rpx] flex items-center justify-center"
              onClick={() => Taro.navigateTo({ url: '/pages/notifications/index' })}
            >
              <Text className="text-[24rpx] font-medium text-white">消息通知</Text>
            </View>
            <View
              className="flex-1 rounded-full border border-primary px-[24rpx] py-[18rpx] flex items-center justify-center"
              onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
            >
              <Text className="text-[24rpx] font-medium text-primary">个人中心</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <>
        {/* 机构背景图 */}
        <View className="relative h-[480rpx] overflow-hidden">
          <Image
            src={ORG_COVER_IMAGE}
            className="absolute inset-0 w-full h-full"
            mode="aspectFill"
          />
          <View className="absolute inset-0 bg-black/35" />

          {/* 通知铃铛 */}
          <View
            className="absolute right-[24rpx] z-10"
            style={{ top: `${navSafeHeight - 4}px` }}
            onClick={() => Taro.navigateTo({ url: '/pages/notifications/index' })}
          >
            <View className="relative w-[80rpx] h-[80rpx] flex items-center justify-center">
              <Icon name="mdi-bell-outline" size={44} color="white" />
              {unreadCount > 0 && (
                <View className="absolute top-[10rpx] right-[10rpx] w-[18rpx] h-[18rpx] bg-destructive rounded-full border-[2rpx] border-primary" />
              )}
            </View>
          </View>
        </View>

        {/* 校区卡片 */}
        <View className="relative z-30 -mt-[90rpx] mx-[28rpx]">
          <View
            className="bg-white/92 backdrop-blur-md rounded-[32rpx] p-[24rpx] shadow-campus press-scale"
            onClick={handleOpenCampusSheet}
          >
            <View className="flex items-center gap-[20rpx]">
              <View
                className="w-[88rpx] h-[88rpx] rounded-[20rpx] center overflow-hidden shrink-0"
                style={{
                  background:
                    currentCampus?.iconGradient || 'linear-gradient(135deg, #5EC8A8, #4AB893)',
                }}
              >
                {currentCampus?.logo ? (
                  <Image src={currentCampus.logo} className="w-full h-full" mode="aspectFill" />
                ) : (
                  <Text className="text-[40rpx]">{currentCampus?.icon || '🏢'}</Text>
                )}
              </View>

              <View className="flex-1 min-w-0">
                <View className="flex items-center gap-[12rpx] mb-[6rpx]">
                  <Text className="text-[32rpx] font-bold text-foreground truncate">
                    {currentCampus?.name || '未设置校区'}
                  </Text>
                  <View
                    className={cn(
                      'flex items-center gap-[6rpx] px-[12rpx] py-[2rpx] rounded-[8rpx]',
                      isOpen ? 'bg-success-bg' : 'bg-muted',
                    )}
                  >
                    <View
                      className={cn(
                        'w-[12rpx] h-[12rpx] rounded-full',
                        isOpen ? 'bg-success' : 'bg-muted-foreground',
                      )}
                    />
                    <Text
                      className={cn(
                        'text-[22rpx] font-medium',
                        isOpen ? 'text-success' : 'text-muted-foreground',
                      )}
                    >
                      {isOpen ? '营业中' : '休息中'}
                    </Text>
                  </View>
                </View>
                <View className="flex items-center gap-[4rpx]">
                  <Icon name="mdi-map-marker-outline" size="xxs" color="mutedForeground" />
                  <Text className="text-[24rpx] text-muted-foreground truncate">
                    {currentCampus?.address || '暂无地址'}
                  </Text>
                </View>
              </View>

              <View className="flex flex-col items-end gap-[4rpx] shrink-0">
                <View className="flex items-center gap-[2rpx]">
                  <Text className="text-[26rpx] font-semibold text-foreground">切换校区</Text>
                  <Icon name="mdi-chevron-down" size="xs" color="foreground" />
                </View>
                {businessTime && (
                  <Text className="text-[22rpx] text-muted-foreground">{businessTime}</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </>
    );
  };

  return (
    <>
      <View className={cn(`theme-${activeTheme}`, 'h-screen overflow-x-hidden bg-background')}>
        <ScrollView scrollY showScrollbar={false} className="h-full overflow-x-hidden no-scrollbar">
          <View className="min-h-full">
            {renderHeader()}

            {/* 内容区：校区卡片压住上半部分 */}
            <View className="relative z-10 bg-transparent mx-[28rpx] pt-[0] pb-[200rpx]">
              {/* 金刚区 */}
              {isStaffRole(currentRole) && <KingKongSection entries={quickEntries} />}

              {/* Tab 内容区 */}
              <View className="px-[24rpx]">
                {isStaffRole(currentRole) && (
                  <>
                    <View className="flex items-baseline gap-[24rpx] overflow-x-hidden py-[24rpx]">
                      {TAB_OPTIONS.map((tab) => (
                        <View
                          key={tab.key}
                          className={
                            homeSwiperCurrent === getHomeTabIndex(tab.key)
                              ? 'tab-item-v14 active'
                              : 'tab-item-v14'
                          }
                          onClick={() => handleHomeTabChange(tab.key)}
                        >
                          <Text>{tab.label}</Text>
                          {tab.badge && tab.badge > 0 && (
                            <View className="inline-block bg-destructive text-white text-[18rpx] font-bold px-[8rpx] rounded-[16rpx] min-w-[28rpx] h-[28rpx] leading-[28rpx] text-center ml-[4rpx]">
                              <Text className="text-white text-[18rpx]">{tab.badge}</Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>

                    <View
                      onClick={() =>
                        scheduleHomeSwiperMeasure(getHomeTabByIndex(homeSwiperCurrent))
                      }
                    >
                      <Swiper
                        current={homeSwiperCurrent}
                        duration={HOME_TAB_SWIPER_DURATION}
                        easingFunction="easeOutCubic"
                        style={{ height: `${homeSwiperHeight}px` }}
                        onChange={handleHomeSwiperChange}
                        onAnimationFinish={handleHomeSwiperFinish}
                      >
                        <SwiperItem itemId="schedule">
                          <View id="home-tab-panel-schedule">
                            <TodayScheduleCard schedules={schedules} title="" />
                          </View>
                        </SwiperItem>
                        <SwiperItem itemId="todo">
                          <View id="home-tab-panel-todo" className="pt-[24rpx]">
                            <TodoList items={todoItems} />
                          </View>
                        </SwiperItem>
                        <SwiperItem itemId="recent">
                          <View id="home-tab-panel-recent" className="pt-[24rpx]">
                            <LessonConsumptionList
                              sections={recentSections}
                              emptyText="暂无消课记录"
                              footerText="查看更多"
                              onFooterClick={() =>
                                Taro.navigateTo({ url: '/package-teacher/pages/attendance/index' })
                              }
                            />
                          </View>
                        </SwiperItem>
                      </Swiper>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* 校区切换 Sheet */}
      {isStaffRole(currentRole) && (
        <CampusSelectSheet
          visible={showCampusSheet}
          currentId={currentCampusId}
          currentRole={currentRole}
          campuses={campuses}
          managedCampusIds={managedCampusIds}
          lastVisitedId={lastVisitedCampusId}
          onClose={handleCloseCampusSheet}
          onConfirm={handleConfirmCampus}
        />
      )}

      {/* 身份切换 Sheet */}
      <RoleSwitchSheet visible={roleSheetVisible} onClose={() => setRoleSheetVisible(false)} />
    </>
  );
};

export default withRouteGuard(Home);
