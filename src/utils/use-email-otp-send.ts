import Taro from '@tarojs/taro';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMAIL_OTP_COOLDOWN_SEC,
  formatEmailCodeSentToast,
  isEmailTooFrequentMessage,
} from '@/constants/email-auth';

export type EmailOtpSendResult = {
  error: { message: string } | null;
  maskedEmail?: string;
};

/**
 * 邮箱验证码发送：HTTP 200 后启动 60s 冷却；429 保持冷却；业务/网络失败清冷却。
 * 按钮文案仅显示倒计时或「发送验证码」，不使用占满式「发送中」。
 */
export function useEmailOtpSend(sendFn: (email: string) => Promise<EmailOtpSendResult>) {
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(0);
  }, []);

  const startCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setCountdown(EMAIL_OTP_COOLDOWN_SEC);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    },
    [],
  );

  const handleSend = useCallback(
    async (email: string) => {
      if (busy || countdown > 0) return;
      setBusy(true);
      try {
        const result = await sendFn(email);
        if (result.error) {
          if (isEmailTooFrequentMessage(result.error.message)) {
            if (countdown === 0) {
              startCountdown();
            }
            Taro.showToast({ title: result.error.message, icon: 'none' });
            return;
          }
          clearCountdown();
          Taro.showToast({ title: result.error.message, icon: 'none' });
          return;
        }
        startCountdown();
        Taro.showToast({
          title: formatEmailCodeSentToast(result.maskedEmail),
          icon: 'none',
          duration: 2500,
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, clearCountdown, countdown, sendFn, startCountdown],
  );

  const sendLabel = countdown > 0 ? `${countdown}s` : '发送验证码';
  const sendDisabled = busy || countdown > 0;

  return { countdown, busy, sendLabel, sendDisabled, handleSend, clearCountdown };
}
