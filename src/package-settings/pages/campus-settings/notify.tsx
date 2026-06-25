/**
 * 通知设置页 pages/campus-settings/notify
 *
 * 对齐设计稿：通知学员 + 通知老师 两个分组，每项带开关
 */
import { View, Text } from '@tarojs/components';
import React, { useEffect, useCallback } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { useCampusStore } from '@/stores/campus';

const NotifySettings: React.FC = () => {
  const { notifyGroups, fetchNotifySettings, toggleNotify } = useCampusStore();
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [togglingId, setTogglingId] = React.useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    await fetchNotifySettings();
    const nextError = useCampusStore.getState().error;
    if (nextError) {
      setLoadError(nextError);
    }
    setLoading(false);
  }, [fetchNotifySettings]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 切换开关 */
  const handleToggle = useCallback(
    async (itemId: string) => {
      if (togglingId) return;
      setTogglingId(itemId);
      try {
        await toggleNotify(itemId);
        const nextError = useCampusStore.getState().error;
        if (nextError) {
          setLoadError(nextError);
        }
      } finally {
        setTogglingId('');
      }
    },
    [toggleNotify, togglingId],
  );

  if (loading && !notifyGroups.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载通知设置中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError && !notifyGroups.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen px-[32rpx] flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={() => void reload()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      {/* 通知分组列表 */}
      <View className="px-[32rpx] pt-[24rpx] pb-[60rpx]">
        {loadError ? (
          <View className="mb-[20rpx] p-[20rpx] rounded-[24rpx] bg-destructive/10">
            <Text className="text-[24rpx] text-destructive">{loadError}</Text>
          </View>
        ) : null}
        {notifyGroups.length === 0 ? (
          <Empty
            icon="mdi-bell-outline"
            description="暂无通知配置"
            actionText="重新加载"
            onAction={() => void reload()}
          />
        ) : null}
        {notifyGroups.map((group) => (
          <View
            key={group.title}
            className="bg-white rounded-[28rpx] shadow-soft p-[28rpx] px-[32rpx] mb-[20rpx]"
          >
            {/* 分组标题 — 设计稿：.notify-title / 12px/600/text-light + 左侧primary竖条 */}
            <View className="flex flex-row items-center mb-[20rpx] pl-[16rpx]">
              <View className="w-[8rpx] h-[24rpx] rounded-[4rpx] bg-primary mr-[12rpx]" />
              <Text className="text-[24rpx] font-semibold text-muted-foreground">
                {group.title}
              </Text>
            </View>

            {/* 通知项列表 */}
            {group.items.map((item, idx) => (
              <View
                key={item.id}
                className={`flex flex-row items-center justify-between py-[20rpx] ${
                  idx < group.items.length - 1 ? 'border-b-d5e8e0' : ''
                }`}
              >
                {/* 左侧信息 */}
                <View className="flex-1 mr-[24rpx]">
                  <Text className="text-[26rpx] text-foreground">{item.label}</Text>
                  {item.sub && (
                    <Text className="text-[20rpx] text-muted-foreground mt-[4rpx]">{item.sub}</Text>
                  )}
                </View>

                {/* 开关 — 设计稿：.notify-toggle / 44px*26px / 圆角13px / primary色 */}
                <View
                  className={`w-[88rpx] h-[52rpx] rounded-full relative transition-colors ${
                    item.enabled ? 'bg-primary' : 'bg-border'
                  } ${togglingId === item.id ? 'opacity-60' : ''}`}
                  onClick={togglingId ? undefined : () => void handleToggle(item.id)}
                >
                  <View
                    className={`absolute w-[44rpx] h-[44rpx] rounded-full bg-white top-[4rpx] transition-transform ${
                      item.enabled ? 'left-[40rpx]' : 'left-[4rpx]'
                    }`}
                    style={{ boxShadow: '0 2rpx 6rpx rgba(0,0,0,0.1)' }}
                  />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </PageContainer>
  );
};

export default NotifySettings;

definePageConfig({
  navigationBarTitleText: '通知设置',
});
