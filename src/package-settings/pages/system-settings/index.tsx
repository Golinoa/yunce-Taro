/**
 * 系统设置页 package-settings/pages/system-settings/index
 *
 * 所有角色均可进入，内部设置项按角色权限过滤显示：
 * - 通用项（操作日志、用户协议）：所有角色可见（操作日志按角色只看自己/全部员工）
 * - 管理员专属项（主题颜色、角色权限、定时备份、重置新手引导）：仅管理员可见
 *
 * 视觉风格：简洁文字列表，无图标无描述，右侧箭头/开关。
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import Switch from '@/components/Switch';
import { APP_VERSION } from '@/constants/version';
import { clearVisitedMap } from '@/services/onboarding';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import { getAlertThreshold } from '@/utils/alert-config';
import { isAdmin, STORE_ONBOARDING_HIDDEN_KEY, useAuth } from '@/utils/auth';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { getVenueBookingEnabled, setVenueBookingEnabled } from '@/utils/venue-booking-config';

/** 设置项配置 */
interface SettingItem {
  title: string;
  route: string;
  /** 仅管理员可见 */
  adminOnly?: boolean;
  /** 管理角色可见（管理员 / 校长） */
  managerOnly?: boolean;
}

/** 系统设置全量分组 */
const ALL_SETTING_ITEMS: SettingItem[] = [
  {
    title: '操作日志',
    route: '/package-settings/pages/audit-log/index',
  },
  {
    title: '主题颜色',
    route: '/package-settings/pages/theme-settings/index',
  },
  {
    title: '待办提醒',
    route: '/package-settings/pages/todo-settings/index',
  },
  {
    title: '角色权限',
    route: '/package-settings/pages/permission-settings/index',
    adminOnly: true,
  },
  {
    title: '定时备份',
    route: '',
    adminOnly: true,
  },
  {
    title: '用户协议',
    route: '/pages/agreement/index',
  },
  {
    title: '重置新手引导',
    route: '__reset_onboarding__',
    adminOnly: true,
  },
];

/** 未实现入口占位提示 */
const PLACEHOLDER_TIP = '功能开发中，敬请期待';

const SystemSettings: React.FC = () => {
  useCardNavigationBar();
  const { signOut, currentRole } = useAuth();
  const { activeTheme } = useThemeStore();
  const [venueBookingEnabled, setVenueBookingEnabledState] = useState(true);
  const [alertThreshold, setAlertThresholdState] = useState(getAlertThreshold());

  // 页面显示时读取最新开关状态
  useDidShow(() => {
    setVenueBookingEnabledState(getVenueBookingEnabled());
    setAlertThresholdState(getAlertThreshold());
  });

  const handleVenueBookingChange = useCallback((enabled: boolean) => {
    setVenueBookingEnabledState(enabled);
    setVenueBookingEnabled(enabled);
  }, []);

  /** 预警阈值配置：跳转到专用表单页（用户口径 2026-08-22：单独页面，非弹框） */
  const handleAlertThresholdChange = useCallback(() => {
    Taro.navigateTo({
      url: '/package-settings/pages/threshold-config/index',
    });
  }, []);

  // 按角色过滤设置项：adminOnly 的仅管理员可见；managerOnly 的管理角色（管理员/校长）可见；其余通用
  const visibleItems = useMemo(() => {
    const isManager = isAdmin(currentRole) || currentRole === 'principal';
    return ALL_SETTING_ITEMS.filter(
      (item) => (!item.adminOnly || isAdmin(currentRole)) && (!item.managerOnly || isManager),
    );
  }, [currentRole]);

  const handleNavigate = useCallback(
    (route: string) => {
      if (route === '__reset_onboarding__') {
        Taro.showModal({
          title: '重置新手引导',
          content: '重置后将重新显示店铺管理配置引导，所有步骤进度也将清除，是否继续？',
          confirmColor: getThemeHexColors(activeTheme).primary,
          success: (res) => {
            if (res.confirm) {
              // 清除访问记录，所有步骤回到未完成
              clearVisitedMap();
              // 重新显示引导态
              Taro.setStorageSync(STORE_ONBOARDING_HIDDEN_KEY, false);
              Taro.showToast({ title: '已重置', icon: 'success' });
            }
          },
        });
        return;
      }
      if (!route) {
        Taro.showToast({ title: PLACEHOLDER_TIP, icon: 'none' });
        return;
      }
      Taro.navigateTo({ url: route });
    },
    [activeTheme],
  );

  const handleSignOut = useCallback(async () => {
    const res = await Taro.showModal({
      title: '确认退出',
      content: '退出后将清除本地登录状态，是否继续？',
      confirmColor: getThemeHexColors(activeTheme).primary,
    });
    if (!res.confirm) return;
    await signOut();
    Taro.reLaunch({ url: '/pages/login/index' });
  }, [activeTheme, signOut]);

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[32rpx]">
        {/* 设置列表卡片 */}
        <View className="bg-card rounded-[28rpx] shadow-soft overflow-hidden">
          {visibleItems.map((item, index) => (
            <View
              key={item.title}
              className={cn(
                'flex flex-row items-center justify-between px-[28rpx] py-[28rpx] active:opacity-70 press-bg',
                index !== visibleItems.length - 1 && 'border-b border-border',
              )}
              onClick={() => handleNavigate(item.route)}
            >
              <Text className="text-[30rpx] text-foreground">{item.title}</Text>
              <Icon name="mdi-chevron-right" size={28} color="mutedForeground" />
            </View>
          ))}

          {/* 场地预约开关 */}
          {visibleItems.length > 0 && <View className="border-t border-border" />}
          <View className="flex flex-row items-center justify-between px-[28rpx] py-[28rpx]">
            <Text className="text-[30rpx] text-foreground">场地预约</Text>
            <Switch checked={venueBookingEnabled} onChange={handleVenueBookingChange} />
          </View>

          {/* 运营预警阈值配置（adminOnly） */}
          {isAdmin(currentRole) && (
            <View
              className="flex flex-row items-center justify-between px-[28rpx] py-[28rpx] active:opacity-70 press-bg border-t border-border"
              onClick={handleAlertThresholdChange}
            >
              <Text className="text-[30rpx] text-foreground">课时不足预警阈值</Text>
              <Text className="text-[28rpx] text-muted-foreground">
                ≤ {alertThreshold} 课时触发
              </Text>
            </View>
          )}

          {/* 当前版本 */}
          <View className="border-t border-border flex flex-row items-center justify-between px-[28rpx] py-[28rpx]">
            <Text className="text-[30rpx] text-foreground">当前版本</Text>
            <Text className="text-[28rpx] text-muted-foreground">v{APP_VERSION}</Text>
          </View>
        </View>
      </View>

      {/* 退出登录：所有角色可见 */}
      <View className="px-[32rpx] mt-[48rpx] mb-[48rpx]">
        <View
          className="bg-card rounded-[28rpx] py-[28rpx] flex items-center justify-center shadow-soft press-bg"
          onClick={handleSignOut}
        >
          <Text className="text-[30rpx] font-semibold text-error">退出登录</Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default SystemSettings;
