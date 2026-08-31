/**
 * DevIdentitySwitcher — 仅测环境包（isDevApiEnv）显示的左上角身份下拉
 * 用于快速切换管理员 / 校长 / 教师 / 家长，方便对照各端 UI。
 *
 * 必须用 RootPortal：App 根上的 fixed 在微信里常被页面层盖住，刷新也看不见。
 * 挂在 PageContainer（及未用容器的首页/数据页），各身份进任何页都能看到。
 */
import { View, Text, ScrollView, RootPortal } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import { DEV_SWITCH_ACCOUNTS, formatMockSwitchLabel } from '@/constants/dev-switch-accounts';
import { useAuth } from '@/utils/auth';
import { isDevApiEnv } from '@/utils/build-env';
import './index.scss';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  principal: '校长',
  teacher: '教师',
  assistant: '助教',
  parent: '家长',
};

/** 与微信原生胶囊同一行，落在左侧安全区 */
function useSwitcherTopPx(): number {
  return useMemo(() => {
    try {
      const menu = Taro.getMenuButtonBoundingClientRect();
      if (menu?.top && menu.top > 0) return menu.top;
      const status = Taro.getWindowInfo().statusBarHeight ?? 44;
      return status + 6;
    } catch {
      return 48;
    }
  }, []);
}

const MockIdentitySwitcher: React.FC = () => {
  const { profile, signInWithUsername, currentRole } = useAuth();
  const topPx = useSwitcherTopPx();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const currentLabel = useMemo(() => {
    const matched = DEV_SWITCH_ACCOUNTS.find(
      (item) => item.userId === profile?.id || item.email === profile?.email,
    );
    if (matched) {
      return formatMockSwitchLabel(matched.name, matched.roleLabel);
    }
    const name = profile?.name || '未登录';
    const role = currentRole ? ROLE_LABELS[currentRole] || currentRole : '游客';
    return formatMockSwitchLabel(name, role);
  }, [currentRole, profile?.email, profile?.id, profile?.name]);

  const handlePick = useCallback(
    async (username: string, password: string) => {
      if (switching) return;
      setSwitching(true);
      try {
        const { error } = await signInWithUsername(username, password);
        if (error) {
          Taro.showToast({ title: error.message || '切换失败', icon: 'none' });
          return;
        }
        setOpen(false);
        Taro.showToast({ title: '已切换身份', icon: 'success' });
        setTimeout(() => {
          void Taro.reLaunch({ url: '/pages/home/index' });
        }, 300);
      } finally {
        setSwitching(false);
      }
    },
    [signInWithUsername, switching],
  );

  if (!isDevApiEnv()) return null;

  return (
    <RootPortal>
      <View className="mock-id-switcher" style={{ top: `${topPx}px` }}>
        <View
          className={cn('mock-id-trigger', open && 'mock-id-trigger--open')}
          onClick={() => setOpen((v) => !v)}
        >
          <Text className="mock-id-trigger__badge">DEV</Text>
          <Text className="mock-id-trigger__text">{currentLabel}</Text>
          <Text className="mock-id-trigger__caret">{open ? '▴' : '▾'}</Text>
        </View>

        {open ? (
          <>
            <View className="mock-id-mask" onClick={() => setOpen(false)} catchMove />
            <View className="mock-id-panel">
              <Text className="mock-id-panel__title">快速切换身份（测环境）</Text>
              <ScrollView scrollY className="mock-id-panel__scroll" showScrollbar={false}>
                {DEV_SWITCH_ACCOUNTS.map((item) => {
                  const isCurrent = profile?.id === item.userId || profile?.email === item.email;
                  const label = formatMockSwitchLabel(item.name, item.roleLabel);

                  return (
                    <View
                      key={item.username}
                      className={cn('mock-id-item', isCurrent && 'mock-id-item--active')}
                      onClick={() => void handlePick(item.username, item.password)}
                    >
                      <Text className="mock-id-item__label">{label}</Text>
                      {isCurrent ? (
                        <Text className="mock-id-item__now">当前</Text>
                      ) : (
                        <Text className="mock-id-item__user">{item.username}</Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              {switching ? (
                <Text className="mock-id-panel__hint">切换中...</Text>
              ) : (
                <Text className="mock-id-panel__hint">
                  管理员 / 校长 / 教师 / 家长 体验不同；切换后回首页刷新
                </Text>
              )}
            </View>
          </>
        ) : null}
      </View>
    </RootPortal>
  );
};

export default MockIdentitySwitcher;
