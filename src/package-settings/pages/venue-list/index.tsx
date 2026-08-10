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
import { logError } from '@/utils/logger';

const INTRO_STORAGE_KEY = PAGE_INTRO_STORAGE_KEYS.venue;

const VenueListPage: React.FC = () => {
  const { currentCampusId } = useCampusStore();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await roomService.getList({ campusId: currentCampusId || undefined });
      setRooms(list);
    } catch (err) {
      logError('load venue list', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [currentCampusId]);

  useDidShow(() => {
    void loadData();
    try {
      const hidden = Taro.getStorageSync(INTRO_STORAGE_KEY);
      setShowIntro(hidden !== true);
    } catch {
      setShowIntro(true);
    }
  });

  const handleAdd = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/venue-form/index' });
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
