import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import Loading from '@/components/Loading';
import {
  SUBSCRIBE_GROUP_LABELS,
  SUBSCRIBE_TEMPLATE_GROUPS,
} from '@/constants/subscribe-presets';
import { subscribeMessageService } from '@/services/subscribe-message';
import type { SubscribeQuotaDto, SubscribeTemplateGroup } from '@/types/subscribe-message';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

const MessageAuthPage: React.FC = () => {
  useCardNavigationBar();
  const [loading, setLoading] = useState(true);
  const [quotas, setQuotas] = useState<SubscribeQuotaDto[]>([]);
  const [authLoadingGroup, setAuthLoadingGroup] = useState<SubscribeTemplateGroup | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await subscribeMessageService.bootstrap();
      setQuotas(data.quotas);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    void load();
  });

  const handleAuthGroup = async (group: SubscribeTemplateGroup) => {
    if (authLoadingGroup) return;
    setAuthLoadingGroup(group);
    try {
      const next = await subscribeMessageService.requestAuthAndReport(
        [group],
        'settings_message_auth',
      );
      setQuotas(next);
      Taro.showToast({ title: '已补充可发送次数', icon: 'none' });
    } catch {
      Taro.showToast({ title: '授权未完成', icon: 'none' });
    } finally {
      setAuthLoadingGroup(null);
    }
  };

  const handleAuthAllCore = async () => {
    if (authLoadingGroup) return;
    const core: SubscribeTemplateGroup[] = [
      'class_remind',
      'schedule_change',
      'lesson_result',
      'todo_remind',
    ];
    setAuthLoadingGroup('class_remind');
    try {
      const next = await subscribeMessageService.requestAuthAndReport(
        core,
        'settings_message_auth_batch',
      );
      setQuotas(next);
      Taro.showToast({ title: '已补充可发送次数', icon: 'none' });
    } catch {
      Taro.showToast({ title: '授权未完成', icon: 'none' });
    } finally {
      setAuthLoadingGroup(null);
    }
  };

  const quotaMap = new Map(quotas.map((q) => [q.group, q]));

  return (
    <PageContainer>
      <View className="min-h-screen bg-background px-[32rpx] py-[24rpx] pb-[60rpx]">
        <Text className="mb-[24rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
          微信服务通知需您主动授权次数。次数用完后，重要事项仍会在小程序内提醒。点击下方条目可补充对应类型的可发送次数。
        </Text>

        <View
          className="mb-[24rpx] flex items-center justify-center rounded-[20rpx] bg-primary py-[24rpx] active:opacity-90"
          onClick={() => void handleAuthAllCore()}
        >
          <Text className="text-[28rpx] font-medium text-primary-foreground">
            一键补充常用提醒（最多 4 项）
          </Text>
        </View>

        {loading ? (
          <Loading text="加载中..." />
        ) : (
          <View className="flex flex-col gap-[16rpx]">
            {SUBSCRIBE_TEMPLATE_GROUPS.map((group) => {
              const q = quotaMap.get(group);
              const remain = q?.remain ?? 0;
              const enabled = Boolean(q?.tmplId);
              const isLoading = authLoadingGroup === group;

              return (
                <View
                  key={group}
                  className="flex flex-row items-center justify-between rounded-[20rpx] bg-card px-[28rpx] py-[28rpx]"
                  onClick={
                    enabled && !isLoading ? () => void handleAuthGroup(group) : undefined
                  }
                >
                  <View className="flex-1 pr-[16rpx]">
                    <Text className="text-[28rpx] font-medium text-foreground">
                      {SUBSCRIBE_GROUP_LABELS[group]}
                    </Text>
                    <Text className="mt-[8rpx] text-[24rpx] text-muted-foreground">
                      {enabled
                        ? `剩余可发送 ${remain} 次`
                        : '后端未配置模板，暂不可授权'}
                    </Text>
                  </View>
                  {enabled ? (
                    <Text
                      className={`text-[26rpx] font-medium ${
                        isLoading ? 'text-muted-foreground' : 'text-primary'
                      }`}
                    >
                      {isLoading ? '授权中…' : '补充'}
                    </Text>
                  ) : (
                    <Text className="text-[24rpx] text-muted-foreground">未启用</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(MessageAuthPage);
