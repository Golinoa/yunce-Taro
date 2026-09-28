/**
 * 课表页「上课提醒」铃铛：额度状态 + 点击授权
 *
 * 用户诉求（2026-09-29）：课表卡片上完全看不出有没有开提醒，"太无感"。
 * 这里提供卡片铃铛需要的两个东西：当前是否开启（图标形态）、点击做什么。
 *
 * 两条约束：
 * 1. 状态以后端额度为准（一次性订阅：同意一次攒一次额度，用完就收不到），
 *    额度就是最真实的开关状态；
 * 2. 调起微信面板必须在**点击回调的同步路径**上——所以这里点击后第一件事就是
 *    调 `requestReminderAuthNow`，前面不插任何 await。
 */
import Taro from '@tarojs/taro';
import { useCallback, useEffect, useState } from 'react';
import { subscribeMessageService } from '@/services/subscribe-message';
import { logError } from '@/utils/logger';
import { isReminderEnabled } from '@/utils/subscribe-reminder-guide';

export interface UseClassReminderOptions {
  role?: string | null;
  campusId?: string;
  /** 家长端不显示铃铛（家长不需要"上课提醒"，且不是自己的课） */
  disabled?: boolean;
}

export interface UseClassReminderResult {
  /** 是否已开启上课提醒（决定铃铛图标：实心 / 划掉） */
  enabled: boolean;
  /** 传给卡片的点击回调；未完成初始化时返回 undefined，卡片据此不渲染铃铛 */
  onReminderClick?: () => void;
}

export function useClassReminder(options: UseClassReminderOptions): UseClassReminderResult {
  const { role, campusId, disabled = false } = options;
  const [enabled, setEnabled] = useState(false);
  const [tmplId, setTmplId] = useState('');
  const [authing, setAuthing] = useState(false);

  useEffect(() => {
    if (disabled) return;
    let alive = true;
    void (async () => {
      try {
        const data = await subscribeMessageService.bootstrap(role ?? undefined, campusId);
        if (!alive) return;
        const quota = data.quotas.find((q) => q.group === 'class_remind');
        setTmplId((quota?.tmplId || '').trim());
        setEnabled(isReminderEnabled(quota));
      } catch (error) {
        logError('schedule.classReminder.load', error);
      }
    })();
    return () => {
      alive = false;
    };
  }, [disabled, role, campusId]);

  const onReminderClick = useCallback(() => {
    if (authing) return;

    // 已开启：图标本身没文字，点击给一句明确反馈，不弹面板打扰
    if (enabled) {
      Taro.showToast({ title: '已开启上课提醒', icon: 'none' });
      return;
    }
    if (!tmplId) {
      Taro.showToast({ title: '提醒模板未配置', icon: 'none' });
      return;
    }

    setAuthing(true);
    // 关键：同步路径上直接调起（内部第一行就是 requestSubscribeMessage）
    void subscribeMessageService
      .requestReminderAuthNow({
        group: 'class_remind',
        tmplId,
        scene: 'schedule_card_reminder',
        meta: { role: role ?? undefined, campusId },
      })
      .then(({ accepted }) => {
        if (accepted) {
          setEnabled(true);
          Taro.showToast({ title: '已开启上课提醒', icon: 'none' });
        }
      })
      .catch((error) => {
        logError('schedule.classReminder.auth', error);
      })
      .finally(() => {
        setAuthing(false);
      });
  }, [authing, campusId, enabled, role, tmplId]);

  // 家长端 / 未取到模板：不渲染铃铛
  if (disabled || !tmplId) {
    return { enabled, onReminderClick: undefined };
  }

  return { enabled, onReminderClick };
}
