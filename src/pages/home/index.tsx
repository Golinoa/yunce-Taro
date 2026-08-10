import { View, Text, ScrollView, Image, Swiper, SwiperItem } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import KingKongSection from '@/components/home/KingKongSection';
import StatsOverview from '@/components/home/StatsOverview';
import TodayScheduleCard from '@/components/home/TodayScheduleCard';
import TodoList from '@/components/home/TodoList';
import type { TodoItem } from '@/components/home/TodoList';
import Icon from '@/components/Icon';
import LessonConsumptionList, {
  buildLessonConsumptionSections,
  pickHomeRecentLessonRecords,
} from '@/components/lesson/LessonConsumptionList';
import RoleSwitchSheet from '@/components/RoleSwitchSheet';
import { BRAND_FALLBACK_ORG_NAME } from '@/constants/brand';
import { lessonRecordService } from '@/services';
import { homeService } from '@/services/home';
import type {
  StatsPeriod,
  StatsData,
  QuickEntry,
  HomeTeacherSummary,
  HomeOperationContent,
  OperationActionConfig,
  OperationActivityItem,
  OperationBannerItem,
} from '@/services/home';
import { useCampusStore } from '@/stores/campus';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import { isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

/** Tab 类型 */
type HomeTab = 'schedule' | 'todo' | 'recent';

const HOME_TAB_SWIPER_DURATION = 260;
const HOME_TAB_ORDER: HomeTab[] = ['schedule', 'todo', 'recent'];

const getHomeTabIndex = (tab: HomeTab): number => HOME_TAB_ORDER.indexOf(tab);

const getHomeTabByIndex = (index: number): HomeTab => HOME_TAB_ORDER[index] || 'schedule';

/** 校区选项 */
interface CampusOption {
  id: string;
  name: string;
  isMain: boolean;
}

/**
 * Home - 教师端首页 v14
 *
 * 对齐设计稿 index_v14.html：
 * - 黄绿渐变头部 + 导航栏 + 问候语
 * - 白色统计卡片 + 时段Tab + "更多"按钮
 * - 金刚区：三卡片 + 图标网格 + 分页
 * - Tab切换：今日课表 / 待办事项 / 最近消课
 */
const ROLE_LABEL: Record<string, string> = {
  admin: '管理员',
  principal: '校长',
  teacher: '教师',
  assistant: '助教',
  parent: '家长',
};

const EMPTY_OPERATION_CONTENT: HomeOperationContent = {
  placements: {
    banners: [],
    cards: [],
    floatings: [],
    notices: [],
    popups: [],
  },
  updatedAt: '',
};

const normalizeMiniProgramPath = (path?: string): string | null => {
  if (!path) {
    return null;
  }

  return path.startsWith('/') ? path : `/${path}`;
};

const getOperationTarget = (actionConfig?: OperationActionConfig) => {
  if (!actionConfig) {
    return { target: null, type: 'NONE' as const };
  }

  const type = actionConfig.type || 'NONE';
  const target = actionConfig.path || actionConfig.url || actionConfig.appId || null;
  return { target, type };
};

const getOperationSummary = (item: OperationActivityItem): string => {
  return item.summary?.trim() || item.content?.trim() || '暂无活动说明';
};

const Home: React.FC = () => {
  const { profile, currentRole, currentIdentity } = useAuth();
  const { orgName, campuses, currentCampusId, setMainCampus, setCurrentCampusId, fetchCampuses } =
    useCampusStore();
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const mainCampus = campuses.find((c) => c.isMain) || campuses[0];
  const navSafeHeight = useNavSafeHeight();

  // ---- 招呼语：昵称最多 5 字，按字数动态缩放字号 ----
  const nickname = (profile?.name || '').slice(0, 5);
  const greetingSize = nickname ? [72, 64, 56, 48, 40][nickname.length - 1] || 40 : 64;

  // ---- 校区下拉选择 ----
  const [showCampusPicker, setShowCampusPicker] = useState(false);
  const campusOptions: CampusOption[] = campuses.map((c) => ({
    id: c.id,
    name: c.name,
    isMain: c.isMain,
  }));
  const handleToggleCampusPicker = useCallback(() => {
    if (campusOptions.length === 0) {
      Taro.showToast({ title: '暂无校区', icon: 'none' });
      return;
    }
    setShowCampusPicker((prev) => !prev);
  }, [campusOptions]);
  const handleCampusSelect = useCallback(
    async (campus: CampusOption) => {
      setShowCampusPicker(false);
      setCurrentCampusId(campus.id);
      if (!campus.isMain) {
        await setMainCampus(campus.id);
      }
    },
    [setCurrentCampusId, setMainCampus],
  );

  // ---- 教师端状态 ----
  const [teacher, setTeacher] = useState<HomeTeacherSummary | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // ---- 统计概览状态 ----
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('today');
  const [statsData, setStatsData] = useState<StatsData>({
    checkinCount: 0,
    leaveCount: 0,
    lessonHours: 0,
    lessonAmount: 0,
  });

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
  const [operationContent, setOperationContent] =
    useState<HomeOperationContent>(EMPTY_OPERATION_CONTENT);
  const [operationLoading, setOperationLoading] = useState(true);
  const [operationError, setOperationError] = useState('');

  // ---- 公共状态 ----
  const isFirstMount = useRef(true);
  const shownPopupIdsRef = useRef<string[]>([]);
  const homeTabMeasureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================
  // 统计数据加载
  // ============================================
  const loadStatsData = useCallback(
    async (teacherId: string, period: StatsPeriod, campusId?: string) => {
      try {
        const data = await homeService.getStatsByPeriod(teacherId, period, campusId);
        setStatsData(data);
      } catch (err) {
        logError('Home loadStatsData', err);
      }
    },
    [],
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
        setTeacher(teacherData);

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
        await loadStatsData(teacherData.id, 'today', campusId);
      } catch (err) {
        logError('Home loadData', err);
      }
    },
    [profile, currentRole, loadStatsData],
  );

  const executeOperationAction = useCallback(async (actionConfig?: OperationActionConfig) => {
    const { target, type } = getOperationTarget(actionConfig);

    if (type === 'NONE') {
      return;
    }

    if ((type === 'PAGE' || type === 'TAB') && target) {
      const path = normalizeMiniProgramPath(target);
      if (!path) {
        Taro.showToast({ title: '运营配置缺少跳转页面', icon: 'none' });
        return;
      }

      if (type === 'TAB') {
        Taro.switchTab({ url: path });
      } else {
        Taro.navigateTo({ url: path });
      }
      return;
    }

    if (type === 'MINI_PROGRAM' && actionConfig?.appId) {
      try {
        await Taro.navigateToMiniProgram({
          appId: actionConfig.appId,
          path: actionConfig.path,
        });
      } catch {
        Taro.showToast({ title: '打开关联小程序失败', icon: 'none' });
      }
      return;
    }

    if (type === 'WEBVIEW') {
      if (target) {
        try {
          await Taro.setClipboardData({
            data: target,
          });
          Taro.showToast({ title: '活动链接已复制', icon: 'success' });
        } catch {
          Taro.showToast({ title: '活动链接暂不可用', icon: 'none' });
        }
        return;
      }
      Taro.showToast({ title: 'H5 活动页暂未配置链接', icon: 'none' });
      return;
    }

    if (type === 'ACTIVITY') {
      const path = normalizeMiniProgramPath(target || actionConfig?.path);
      if (path) {
        Taro.navigateTo({ url: path });
        return;
      }
      Taro.showToast({ title: '活动详情暂未配置页面', icon: 'none' });
      return;
    }

    Taro.showToast({ title: '运营跳转配置暂不可用', icon: 'none' });
  }, []);

  const handleOperationTap = useCallback(
    async (item: OperationActivityItem | OperationBannerItem) => {
      await executeOperationAction(item.actionConfig);
    },
    [executeOperationAction],
  );

  const loadOperationContent = useCallback(async () => {
    setOperationLoading(true);
    setOperationError('');
    try {
      const content = await homeService.getOperationContent(currentRole);
      setOperationContent(content);
    } catch (error) {
      logError('Home loadOperationContent', error);
      setOperationContent(EMPTY_OPERATION_CONTENT);
      setOperationError('运营内容加载失败');
    } finally {
      setOperationLoading(false);
    }
  }, [currentRole]);

  /** 统计时段切换 */
  const handleStatsPeriodChange = useCallback(
    (period: StatsPeriod) => {
      setStatsPeriod(period);
      if (teacher?.id) {
        loadStatsData(teacher.id, period, currentCampusId);
      }
    },
    [teacher, currentCampusId, loadStatsData],
  );

  // ============================================
  // 初始化
  // ============================================
  useEffect(() => {
    // 按当前身份加载快捷入口与校区数据
    setQuickEntries(homeService.getQuickEntries(currentRole));
    fetchCampuses();
  }, [currentRole, fetchCampuses]);

  // 当身份、登录状态或当前校区变化时重新加载数据
  useEffect(() => {
    loadData(currentCampusId);
  }, [profile, currentRole, currentCampusId, loadData]);

  useEffect(() => {
    loadOperationContent();
  }, [loadOperationContent]);

  useDidShow(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    loadData(currentCampusId);
    loadOperationContent();
  });

  useEffect(() => {
    const popup = operationContent.placements.popups[0];
    if (!popup || shownPopupIdsRef.current.includes(popup.id)) {
      return;
    }

    shownPopupIdsRef.current = [...shownPopupIdsRef.current, popup.id];
    Taro.showModal({
      title: popup.title || '活动提醒',
      content: getOperationSummary(popup),
      confirmText: '去看看',
      cancelText: '稍后',
      success: (result) => {
        if (result.confirm) {
          void executeOperationAction(popup.actionConfig);
        }
      },
    });
  }, [executeOperationAction, operationContent]);

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

  const noticeItem = operationContent.placements.notices[0] || null;
  const floatingItem = operationContent.placements.floatings[0] || null;

  return (
    <>
      <View className="h-screen overflow-x-hidden bg-[var(--muted)]">
        <ScrollView scrollY showScrollbar={false} className="h-full overflow-x-hidden no-scrollbar">
          <View className="min-h-full">
            {/* ========== 渐变背景层 ========== */}
            <View className="gradient-bg" />
            <View className="gradient-fade" />

            {/* ========== 内容层 ========== */}
            <View className="relative z-[200]">
              {/* ===== 自定义导航栏：状态栏占位 + 机构/校区信息 + 胶囊安全区 ===== */}
              <View
                style={{ height: `${navSafeHeight}px` }}
                className="flex items-end px-[32rpx] pb-[12rpx]"
              >
                <View className="flex items-center gap-[16rpx]">
                  {/* 机构名称 */}
                  <Text className="text-[32rpx] font-bold text-white truncate max-w-[200rpx]">
                    {orgName || currentIdentity?.organizationName || BRAND_FALLBACK_ORG_NAME}
                  </Text>
                  {/* 校区选择器 - 点击展开下拉 */}
                  <View className="relative shrink-0">
                    <View
                      className="flex items-center gap-[8rpx] py-[12rpx] pr-[12rpx] pl-[4rpx]"
                      onClick={handleToggleCampusPicker}
                    >
                      <Icon name="mdi-map-marker" size="xs" color="white" />
                      <Text className="text-[28rpx] text-white/90 truncate max-w-[160rpx]">
                        {mainCampus?.name || '主校区'}
                      </Text>
                      <Icon
                        name={showCampusPicker ? 'mdi-chevron-down' : 'mdi-chevron-right'}
                        size="md"
                        color="white"
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* 通知铃铛 - 绝对定位，避免被胶囊按钮遮挡 */}
              <View
                className="absolute right-[32rpx]"
                style={{ top: `${navSafeHeight - 4}px` }}
                onClick={() => Taro.navigateTo({ url: '/pages/notifications/index' })}
              >
                <View className="relative w-[80rpx] h-[80rpx] flex items-center justify-center">
                  <Icon name="mdi-bell-outline" size={44} color="white" />
                  {unreadCount > 0 && (
                    <View className="absolute top-[10rpx] right-[10rpx] w-[18rpx] h-[18rpx] bg-destructive rounded-full border-[2rpx] border-[hsl(var(--primary))]" />
                  )}
                </View>
              </View>

              {/* ===== 主标题 ===== */}
              <View className="px-[40rpx] pt-[24rpx] pb-0">
                <Text
                  className="font-black text-white leading-tight tracking-tight"
                  style={{ fontSize: `${greetingSize}rpx` }}
                >
                  你好~ {nickname || ROLE_LABEL[currentRole || 'teacher']}
                </Text>
              </View>

              {/* ===== 统计卡片 + IP 形象 ===== */}
              {isStaffRole(currentRole) ? (
                <View className="stats-ip-wrapper">
                  <Image
                    className="ip-mascot"
                    src="/assets/images/ip-mascot.png"
                    mode="aspectFit"
                  />
                  <StatsOverview
                    period={statsPeriod}
                    onPeriodChange={handleStatsPeriodChange}
                    data={statsData}
                  />
                </View>
              ) : (
                <View className="mx-[32rpx] mt-[32rpx] p-[40rpx] rounded-[32rpx] bg-card shadow-soft flex flex-col items-center">
                  <Icon name="school" size={80} className="text-primary mb-[24rpx]" />
                  <Text className="text-[32rpx] font-bold text-foreground mb-[12rpx]">
                    {ROLE_LABEL[currentRole || 'parent']}端首页
                  </Text>
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
                      className="flex-1 rounded-full border border-[hsl(var(--primary))] px-[24rpx] py-[18rpx] flex items-center justify-center"
                      onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
                    >
                      <Text className="text-[24rpx] font-medium text-primary">个人中心</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View className="relative z-[120] px-[32rpx] mt-[24rpx]">
              {operationLoading ? (
                <View className="rounded-[32rpx] bg-white/80 px-[28rpx] py-[36rpx] text-center">
                  <Text className="text-[24rpx] text-muted-foreground">运营内容加载中...</Text>
                </View>
              ) : null}

              {/* 广告位 - 圆形胶囊样式（默认隐藏，联调后由后端控制展示） */}
              {!operationLoading && operationContent.placements.banners.length > 0 ? (
                <View className="flex flex-wrap gap-[16rpx]">
                  {operationContent.placements.banners.map((banner) => (
                    <View
                      key={banner.id}
                      className="inline-flex items-center gap-[8rpx] rounded-full bg-[hsl(var(--primary)/0.1)] px-[24rpx] py-[14rpx] active:bg-[hsl(var(--primary)/0.15)] transition-colors duration-200"
                      onClick={() => void handleOperationTap(banner)}
                    >
                      <Icon
                        name="mdi-bullhorn-outline"
                        size="xs"
                        className="text-primary shrink-0"
                      />
                      <Text className="text-[24rpx] font-semibold text-primary whitespace-nowrap">
                        {banner.title}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {!operationLoading && operationError ? (
                <View className="mt-[16rpx] rounded-[24rpx] bg-card px-[24rpx] py-[20rpx] text-center">
                  <Text className="text-[24rpx] text-muted-foreground">{operationError}</Text>
                </View>
              ) : null}
            </View>

            {/* ===== 金刚区（校长+教师显示） ===== */}
            {isStaffRole(currentRole) && <KingKongSection entries={quickEntries} />}

            {/* ===== Tab 切换栏 + 内容区 - 合并为同一白色容器，避免缝隙透出蓝色背景 ===== */}
            <View className="relative z-[100] bg-card px-[32rpx] pb-[200rpx]">
              {noticeItem ? (
                <View
                  className="mt-[24rpx] mb-[8rpx] rounded-[24rpx] bg-[hsl(var(--primary)/0.08)] px-[24rpx] py-[20rpx] flex items-start gap-[16rpx]"
                  onClick={() => void handleOperationTap(noticeItem)}
                >
                  <Icon name="mdi-bullhorn-outline" size="sm" className="text-primary shrink-0" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-[26rpx] font-semibold text-foreground block">
                      {noticeItem.title}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground mt-[4rpx]">
                      {getOperationSummary(noticeItem)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {operationContent.placements.cards.length > 0 ? (
                <View className="mt-[24rpx] flex flex-col gap-[20rpx]">
                  {operationContent.placements.cards.map((card) => (
                    <View
                      key={card.id}
                      className="rounded-[28rpx] bg-card shadow-card border-[2rpx] border-[hsl(var(--border))] overflow-hidden"
                      onClick={() => void handleOperationTap(card)}
                    >
                      {card.coverImageUrl ? (
                        <Image
                          className="w-full h-[220rpx]"
                          src={card.coverImageUrl}
                          mode="aspectFill"
                        />
                      ) : null}
                      <View className="px-[24rpx] py-[24rpx]">
                        <Text className="text-[30rpx] font-bold text-foreground block">
                          {card.title}
                        </Text>
                        <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] line-clamp-2">
                          {getOperationSummary(card)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

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

              {/* ===== Tab 内容区 ===== */}
              {isStaffRole(currentRole) && (
                <View
                  onClick={() => scheduleHomeSwiperMeasure(getHomeTabByIndex(homeSwiperCurrent))}
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
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* ===== 校区下拉菜单（fixed 定位避免被 ScrollView 裁剪） ===== */}
      {showCampusPicker && (
        <View
          className="fixed inset-0 z-[9999]"
          style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
          onClick={() => setShowCampusPicker(false)}
        >
          <View
            className="absolute left-[32rpx] top-[120rpx] bg-card rounded-[20rpx] shadow-float py-[8rpx] min-w-[240rpx] border-[2rpx] border-[hsl(var(--border))]"
            onClick={(e) => e.stopPropagation()}
          >
            {campusOptions.length === 0 ? (
              <View className="px-[24rpx] py-[16rpx]">
                <Text className="text-[26rpx] text-muted-foreground">暂无校区</Text>
              </View>
            ) : (
              campusOptions.map((campus) => (
                <View
                  key={campus.id}
                  className={`px-[24rpx] py-[16rpx] text-[26rpx] ${campus.isMain ? 'text-[hsl(var(--primary))] font-bold' : 'text-foreground'}`}
                  onClick={() => handleCampusSelect(campus)}
                >
                  <Text>
                    {campus.name}
                    {campus.isMain ? ' (主)' : ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {floatingItem ? (
        <View
          className="fixed right-[32rpx] bottom-[160rpx] z-[9998] max-w-[220rpx]"
          onClick={() => void handleOperationTap(floatingItem)}
        >
          <View className="rounded-full bg-[hsl(var(--primary))] px-[24rpx] py-[18rpx] shadow-float">
            <Text className="text-[24rpx] font-semibold text-white">{floatingItem.title}</Text>
          </View>
        </View>
      ) : null}

      {/* 身份切换 Sheet */}
      <RoleSwitchSheet visible={roleSheetVisible} onClose={() => setRoleSheetVisible(false)} />
    </>
  );
};

export default withRouteGuard(Home);
