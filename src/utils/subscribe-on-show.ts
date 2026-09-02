/**
 * onShow 消费 pending / 低额度 / 耗尽提示
 */
import Taro from '@tarojs/taro';
import { SUBSCRIBE_GROUP_LABELS } from '@/constants/subscribe-presets';
import { getSession } from '@/services/auth';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useSubscribeAuthStore } from '@/stores/subscribe-auth';
import type { SubscribeTemplateGroup } from '@/types/subscribe-message';
import { isSubscribeContextReady } from '@/utils/auth-onboarding';
import { logError } from '@/utils/logger';
import {
  canShowDepletedPrompt,
  canShowLowQuotaBanner,
  canShowReactivatePrompt,
  markDepletedPromptShown,
  markLowQuotaBannerShown,
  markReactivatePromptShown,
} from '@/utils/subscribe-freq';

let consuming = false;

/** 单测重置 onShow 消费锁 */
export function __resetConsumeSubscribeOnShowForTest(): void {
  consuming = false;
}

export async function consumeSubscribeOnShow(options?: {
  role?: string;
  campusId?: string;
}): Promise<void> {
  if (consuming) return;
  consuming = true;

  try {
    const { profile } = await getSession();
    if (!profile?.id) return;
    if (!isSubscribeContextReady(profile)) return;

    // 新用户：若注册手势内未完成授权，进站再试一次微信原生面板（无自定义弹框）
    const handledLoginOptIn = await subscribeMessageService.maybeRunLoginOptIn({
      role: options?.role,
      campusId: options?.campusId,
    });
    if (handledLoginOptIn) return;

    const data = await subscribeMessageService.bootstrap(options?.role, options?.campusId);

    const pending = [...data.pendingPrompts].sort((a, b) => a.priority - b.priority);
    if (pending.length > 0) {
      await subscribeMessageService.openPromptFromPending(pending[0]);
      return;
    }

    const depleted = data.quotas.find((q) => q.remain <= 0 && q.notifyEnabled);
    if (depleted && canShowDepletedPrompt(profile.id, depleted.group)) {
      const groupLabel = SUBSCRIBE_GROUP_LABELS[depleted.group];
      const action = await subscribeMessageService.openPrompt({
        presetId: 'quota_depleted',
        variables: { groupLabel },
      });
      markDepletedPromptShown(profile.id, depleted.group);
      if (action === 'primary') {
        Taro.navigateTo({ url: subscribeMessageService.messageAuthPageUrl });
      }
      return;
    }

    const reactivate = data.quotas.find((q) => q.needsReactivate && q.notifyEnabled);
    if (reactivate && canShowReactivatePrompt(profile.id, reactivate.group)) {
      const groupLabel = SUBSCRIBE_GROUP_LABELS[reactivate.group];
      const action = await subscribeMessageService.openPrompt({
        presetId: 'quota_reactivate',
        variables: { groupLabel },
      });
      markReactivatePromptShown(profile.id, reactivate.group);
      if (action === 'primary') {
        Taro.navigateTo({ url: subscribeMessageService.messageAuthPageUrl });
      }
      return;
    }

    const low = data.quotas.find(
      (q) => q.remain > 0 && q.remain <= q.lowThreshold && q.notifyEnabled,
    );
    if (low && canShowLowQuotaBanner(profile.id, low.group)) {
      markLowQuotaBannerShown(profile.id, low.group);
      showLowQuotaBanner(low.group, low.remain);
    }
  } catch (error) {
    logError('subscribe.consumeOnShow', error);
  } finally {
    consuming = false;
  }
}

function showLowQuotaBanner(group: SubscribeTemplateGroup, remain: number): void {
  const label = SUBSCRIBE_GROUP_LABELS[group];
  useSubscribeAuthStore.setState({
    banner: {
      visible: true,
      message: `${label} 还可发送 ${remain} 次，建议补充订阅消息授权`,
      group,
    },
  });
}

export function hideSubscribeQuotaBanner(): void {
  useSubscribeAuthStore.getState().hideBanner();
}
