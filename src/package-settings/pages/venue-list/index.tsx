/**
 * 场地管理列表页 - package-settings/pages/venue-list/index
 *
 * 展示当前校区下所有可用空间（Room 作为场地/教室）。
 * 支持：新增场地、编辑场地（删除在编辑页操作）。
 * 首次进入展示「添加教室 / 场地」引导弹窗。
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PageIntroSheet from '@/components/PageIntroSheet';
import { roomService } from '@/services/campus';
import { PAGE_INTRO_STORAGE_KEYS } from '@/services/onboarding';
import { useCampusStore } from '@/stores/campus';
import type { Room } from '@/types/campus';
import { TTL, markFetched, shouldRefetch } from '@/utils/data-freshness';
import { logError } from '@/utils/logger';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { REFRESH_SIGNAL, consumeRefreshSignal } from '@/utils/refresh-signal';

const INTRO_STORAGE_KEY = PAGE_INTRO_STORAGE_KEYS.venue;

const VenueListPage: React.FC = () => {
  useCardNavigationBar();
  const { currentCampusId } = useCampusStore();

  const [rooms, setRooms] = useState<Room[]>([]);
  // 首屏即视为「加载中」：onShow 里才发起请求，若初值为 false 会先闪一帧「暂无场地」
  const [loading, setLoading] = useState(true);
  // 失败必须独立成态：以前失败只弹 toast，界面落回空态，看起来就是「确实无数据」
  const [loadError, setLoadError] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  // 上下文键 + TTL 组合守卫：切换校区必须立刻重拉（键不同即视为过期）
  const lastFetchKeyRef = React.useRef('');
  const lastFetchAtRef = React.useRef<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const campusKey = currentCampusId || '';
      const list = await roomService.getList({ campusId: currentCampusId || undefined });
      setRooms(list);
      lastFetchKeyRef.current = campusKey;
      markFetched(lastFetchAtRef);
    } catch (err) {
      logError('load venue list', err);
      setLoadError(true);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [currentCampusId]);

  useDidShow(() => {
    // 列表页 TTL 守卫：写入口在子页 venue-form（保存/删除后置 REFRESH_SIGNAL.venues）；
    // 刷新信号优先级高于 TTL —— 有信号就必须真的重新拉取，否则写后列表不更新。
    const campusKey = currentCampusId || '';
    const force = consumeRefreshSignal(REFRESH_SIGNAL.venues);
    const canSkip =
      !force &&
      campusKey === lastFetchKeyRef.current &&
      !shouldRefetch(lastFetchAtRef.current, TTL.campus);
    if (canSkip) {
      // 跳过请求时也要给 loading 终态，否则「跳过 + 初值 true」会变成永久转圈
      setLoading(false);
    } else {
      void loadData();
    }
    try {
      const hidden = Taro.getStorageSync(INTRO_STORAGE_KEY);
      setShowIntro(hidden !== true);
    } catch {
      setShowIntro(true);
    }
  });

  // FAB 单飞守卫：快速双击曾把两层相同表单压栈，navigateBack 只关顶层，
  // 露出底下一张同样的表单 —— 表现即「添加成功后没关闭页面」（2026-09-19 反馈）
  const addNavigatingRef = React.useRef(false);
  const handleAdd = useCallback(() => {
    if (addNavigatingRef.current) return;
    addNavigatingRef.current = true;
    Taro.navigateTo({
      url: '/package-settings/pages/venue-form/index',
      complete: () => {
        addNavigatingRef.current = false;
      },
    });
  }, []);

  const handleEdit = useCallback((id: string) => {
    Taro.navigateTo({ url: `/package-settings/pages/venue-form/index?id=${id}` });
  }, []);

  const countText = useMemo(() => `${rooms.length} 个场地`, [rooms.length]);

  if (loading && rooms.length === 0) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载场地数据中..." />
        </View>
      </PageContainer>
    );
  }

  // 失败与「确实无数据」分开呈现：失败可重试，不再伪装成空列表
  if (loadError && rooms.length === 0) {
    return (
      <PageContainer safeBottom>
        <View className="px-[32rpx] pt-[24rpx] pb-[200rpx]">
          <View className="flex flex-row items-center justify-between py-[24rpx]">
            <Text className="text-[28rpx] text-muted-foreground">{countText}</Text>
          </View>
          <Empty
            icon="mdi-alert-circle-outline"
            description="场地加载失败"
            actionText="重新加载"
            onAction={() => void loadData()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[24rpx] pb-[200rpx]">
        {/* 顶部统计 */}
        <View className="flex flex-row items-center justify-between py-[24rpx]">
          <Text className="text-[28rpx] text-muted-foreground">{countText}</Text>
        </View>

        {rooms.length === 0 ? (
          <Empty icon="mdi-office-building" description="暂无场地，点击右下角添加" />
        ) : (
          <View className="flex flex-col gap-[20rpx]">
            {rooms.map((room) => (
              <View
                key={room.id}
                className="bg-white rounded-[24rpx] px-[32rpx] py-[28rpx] flex flex-row items-center justify-between press-bg"
                onClick={() => handleEdit(room.id)}
              >
                <Text className="text-[32rpx] font-medium text-foreground">{room.name}</Text>
                <View className="flex flex-row items-center gap-[16rpx]">
                  <View className="px-[16rpx] py-[6rpx] rounded-[8rpx] bg-primary/10">
                    <Text className="text-[24rpx] font-medium text-primary">场地</Text>
                  </View>
                  <Text className="text-[30rpx] font-semibold text-foreground">
                    {room.capacity ?? 0}
                  </Text>
                  <Icon name="mdi-chevron-right" size={28} color="mutedForeground" />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 悬浮添加按钮 */}
      <View
        className="fixed right-[32rpx] bottom-[calc(64rpx+env(safe-area-inset-bottom))] flex flex-row items-center gap-[8rpx] px-[28rpx] py-[18rpx] rounded-full bg-primary shadow-lg press-scale"
        onClick={handleAdd}
      >
        <Icon name="mdi-plus" size={28} color="white" />
        <Text className="text-[28rpx] font-medium text-white">添加</Text>
      </View>

      {/* 页面介绍弹窗 */}
      <PageIntroSheet
        visible={showIntro}
        onClose={() => setShowIntro(false)}
        storageKey={INTRO_STORAGE_KEY}
        currentStep={2}
        totalSteps={6}
        title="添加教室 / 场地"
        description="把场馆里实际的教室、球场、泳道等场地加进来，并设定每间能同时容纳多少人。"
        bulletPoints={[
          '排「团课」时必须指定上课空间，所以团课型门店至少要 1 个启用空间',
          '需要开放会员在线订场时，进入空间详情，打开「场地预约模式」后保存',
          '开启后，会员可从首页「场地」入口选择日期、场地和时段完成预约',
          '私教 1v1 课程不强制指定教室，可以自由约',
          '禁用的教室不会出现在排课选项中，但历史课表保留',
        ]}
      />
    </PageContainer>
  );
};

definePageConfig({
  navigationBarTitleText: '场地管理',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
});

export default VenueListPage;
