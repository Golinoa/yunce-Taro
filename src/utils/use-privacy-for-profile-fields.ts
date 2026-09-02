/**
 * 头像 / 昵称隐私能力兜底。
 * 主路径：登录 / 注册按钮点击已索权；本 hook 同步状态，并在用户点击头像/昵称时再确认。
 */
import { useDidShow } from '@tarojs/taro';
import { useCallback, useRef, useState } from 'react';
import { usePrivacyStore } from '@/stores/privacy';
import { getPrivacyNeedAuthorization } from '@/utils/privacy';
import { ensurePrivacyAuthorized } from '@/utils/privacy-authorize';

export function usePrivacyForProfileFields() {
  const storeAuthorized = usePrivacyStore((s) => s.status === 'authorized');
  const [privacyReady, setPrivacyReady] = useState(storeAuthorized);
  const [privacyChecking, setPrivacyChecking] = useState(false);
  const runningRef = useRef(false);

  const syncAuthorizedOnly = useCallback(async () => {
    try {
      const need = await getPrivacyNeedAuthorization();
      if (!need) setPrivacyReady(true);
    } catch {
      // 忽略，留给点击时再索权
    }
  }, []);

  // 仅查询，不弹窗
  useDidShow(() => {
    if (storeAuthorized) {
      setPrivacyReady(true);
      return;
    }
    void syncAuthorizedOnly();
  });

  const ensurePrivacy = useCallback(async (): Promise<boolean> => {
    if (runningRef.current) return privacyReady || storeAuthorized;
    if (storeAuthorized) {
      setPrivacyReady(true);
      return true;
    }
    runningRef.current = true;
    setPrivacyChecking(true);
    try {
      await ensurePrivacyAuthorized();
      setPrivacyReady(true);
      return true;
    } catch {
      setPrivacyReady(false);
      return false;
    } finally {
      runningRef.current = false;
      setPrivacyChecking(false);
    }
  }, [privacyReady, storeAuthorized]);

  return {
    privacyReady: privacyReady || storeAuthorized,
    privacyChecking,
    ensurePrivacy,
  };
}
