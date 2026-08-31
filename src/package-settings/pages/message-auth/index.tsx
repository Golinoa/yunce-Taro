import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useRef, useState } from 'react';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { SUBSCRIBE_GROUP_LABELS, SUBSCRIBE_TEMPLATE_GROUPS } from '@/constants/subscribe-presets';
import { subscribeMessageService } from '@/services/subscribe-message';
import type { SubscribeQuotaDto, SubscribeTemplateGroup } from '@/types/subscribe-message';
import { logError } from '@/utils/logger';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

/**
 * Subscribe quota top-up page ("补充发送次数").
 * One WeChat accept = one server send credit. Master toggle lives on notifications settings.
 */
const MessageAuthPage: React.FC = () => {
  useCardNavigationBar();
  const loadingRef = useRef(false);
  const lastLoadAtRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [quotas, setQuotas] = useState<SubscribeQuotaDto[]>([]);
  const [authLoadingGroup, setAuthLoadingGroup] = useState<SubscribeTemplateGroup | 'batch' | null>(
    null,
  );

  const load = useCallback(async (force = false) => {
    if (loadingRef.current) return;
    const now = Date.now();
    // Debounce re-entry jitter when navigating back within 1.5s
    if (!force && now - lastLoadAtRef.current < 1500) return;
    loadingRef.current = true;
    lastLoadAtRef.current = now;
    setLoading(true);
    try {
      const data = await subscribeMessageService.bootstrap(undefined, undefined, { force: true });
      setQuotas(data.quotas);
    } catch (err) {
      logError('message-auth.load', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useDidShow(() => {
    void load(false);
  });

  const applyAuthResult = (
    result: { quotas: SubscribeQuotaDto[]; acceptedCount: number },
    emptyHint: string,
  ) => {
    setQuotas(result.quotas);
    if (result.acceptedCount > 0) {
      Taro.showToast({
        title: `已补充 ${result.acceptedCount} 次可发送额度`,
        icon: 'none',
      });
      return;
    }
    Taro.showToast({ title: emptyHint, icon: 'none' });
  };

  const handleAuthGroup = async (group: SubscribeTemplateGroup) => {
    if (authLoadingGroup) return;
    setAuthLoadingGroup(group);
    try {
      const result = await subscribeMessageService.requestAuthAndReport(
        [group],
        'settings_message_auth',
      );
      applyAuthResult(result, '未获得授权，次数未变化');
    } catch {
      Taro.showToast({ title: '授权上报失败，请重试', icon: 'none' });
      void load(true);
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
    setAuthLoadingGroup('batch');
    try {
      const result = await subscribeMessageService.requestAuthAndReport(
        core,
        'settings_message_auth_batch',
      );
      applyAuthResult(result, '未获得授权，次数未变化');
    } catch {
      Taro.showToast({ title: '授权上报失败，请重试', icon: 'none' });
      void load(true);
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
          微信规定：每同意一次订阅，服务端可发 1
          条对应提醒。本页用于查看剩余次数并主动补充授权；总开关请在「消息通知」页设置。
        </Text>

        <View className="mb-[24rpx] flex flex-row items-center justify-between">
          <Text className="text-[24rpx] text-muted-foreground">常用提醒（最多 4 项）</Text>
          <View
            className="rounded-full border border-primary/40 bg-primary/10 px-[24rpx] py-[10rpx] active:opacity-80"
            onClick={() => void handleAuthAllCore()}
          >
            <Text className="text-[24rpx] font-medium text-primary">
              {authLoadingGroup === 'batch' ? '授权中…' : '一键补充'}
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
              const isLoading = authLoadingGroup === group || authLoadingGroup === 'batch';

              return (
                <View
                  key={group}
                  className="flex flex-row items-center justify-between rounded-[20rpx] bg-card px-[28rpx] py-[28rpx]"
                  onClick={enabled && !isLoading ? () => void handleAuthGroup(group) : undefined}
                >
                  <View className="min-w-0 flex-1 pr-[16rpx]">
                    <Text className="block text-[28rpx] font-medium text-foreground">
                      {SUBSCRIBE_GROUP_LABELS[group]}
                    </Text>
                    <Text className="mt-[8rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
                      {enabled ? `剩余可发送 ${remain} 次` : '后端未配置模板，暂不可授权'}
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
