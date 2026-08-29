import { View, Text } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import React, { useCallback, useRef, useState } from 'react';
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
import { logError } from '@/utils/logger';

/**
 * 补充发送次数页
 *
 * 用途：微信订阅消息是「一次授权 = 可发一条」。本页用于查看剩余次数，并主动补充授权攒额度。
 * （不是总开关；总开关在「消息通知」页顶部。）
 */
const MessageAuthPage: React.FC = () => {
  useCardNavigationBar();
  const loadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [quotas, setQuotas] = useState<SubscribeQuotaDto[]>([]);
  const [authLoadingGroup, setAuthLoadingGroup] = useState<SubscribeTemplateGroup | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await subscribeMessageService.bootstrap();
      setQuotas(data.quotas);
    } catch (err) {
      logError('message-auth.load', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  // 用 useLoad 替代 useDidShow，避免反复进栈/返回时重复 bootstrap 触发路由抖动
  useLoad(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
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
        <Text className="mb-[12rpx] block text-[30rpx] font-medium text-foreground">
          补充发送次数
        </Text>
        <Text className="mb-[24rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
          微信规定：每同意一次订阅，服务端可发 1 条对应提醒。本页用于查看剩余次数并主动补充授权；总开关请在「消息通知」页设置。
        </Text>

        <View className="mb-[24rpx] flex flex-row items-center justify-between">
          <Text className="text-[24rpx] text-muted-foreground">常用提醒（最多 4 项）</Text>
          <View
            className="rounded-full border border-primary/40 bg-primary/10 px-[24rpx] py-[10rpx] active:opacity-80"
            onClick={() => void handleAuthAllCore()}
          >
            <Text className="text-[24rpx] font-medium text-primary">
              {authLoadingGroup === 'class_remind' ? '授权中…' : '一键补充'}
            </Text>
          </View>
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
                  <View className="min-w-0 flex-1 pr-[16rpx]">
                    <Text className="block text-[28rpx] font-medium text-foreground">
                      {SUBSCRIBE_GROUP_LABELS[group]}
                    </Text>
                    <Text className="mt-[8rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
                      {enabled
                        ? `剩余可发送 ${remain} 次`
                        : '后端未配置模板，暂不可授权'}
                    </Text>
                  </View>
                  {enabled ? (
                    <Text
                      className={`flex-shrink-0 text-[26rpx] font-medium ${
                        isLoading ? 'text-muted-foreground' : 'text-primary'
                      }`}
                    >
                      {isLoading ? '授权中…' : '补充'}
                    </Text>
                  ) : (
                    <Text className="flex-shrink-0 text-[24rpx] text-muted-foreground">未启用</Text>
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
