/**
 * 系统设置页 package-settings/pages/system-settings/index
 *
 * 所有角色均可进入，内部设置项按角色权限过滤显示：
 * - 家长：仅用户协议、版本、退出（无机构配置）
 * - 教师：个人项（同步手机日历、本人操作日志）+ 用户协议 / 版本 / 退出；不可见机构效果配置
 * - 机构效果与配置（主题颜色、待办提醒）：仅管理员/校长
 * - 管理员专属（角色权限、定时备份、重置新手引导、预警阈值）：仅管理员
 * - 机构开关（场地预约、请假自动审批）：仅管理员/校长
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
import { isAdmin, isParentRole, STORE_ONBOARDING_HIDDEN_KEY, useAuth } from '@/utils/auth';
import {
  canUseCalendarSync,
  getCalendarSyncSettings,
  isCalendarSyncEnabled,
} from '@/utils/calendar-sync-settings';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { getVenueBookingEnabled, setVenueBookingEnabled } from '@/utils/venue-booking-config';
import { calendarSyncService } from '@/services/calendar-sync';
import { organizationService } from '@/services/organization';
import { handleVersionNumberTap, isDeveloperModeUnlocked } from '@/utils/developer-mode';

/** 设置项配置 */
interface SettingItem {
  title: string;
  route: string;
  /** 仅管理员可见 */
  adminOnly?: boolean;
  /** 管理角色可见（管理员 / 校长） */
  managerOnly?: boolean;
  /** 家长不可见（机构/教务配置） */
  hideForParent?: boolean;
}

/** 系统设置全量分组 */
const ALL_SETTING_ITEMS: SettingItem[] = [
  {
    title: '操作日志',
    route: '/package-settings/pages/audit-log/index',
    /** 家长不可见；教师可看本人日志 */
    hideForParent: true,
  },
  {
    title: '主题颜色',
    route: '/package-settings/pages/theme-settings/index',
    managerOnly: true,
  },
  {
    title: '待办提醒',
    route: '/package-settings/pages/todo-settings/index',
    managerOnly: true,
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
    route: '/package-settings/pages/agreement/index',
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
  const { signOut, currentRole, profile } = useAuth();
  const { activeTheme } = useThemeStore();
  const [venueBookingEnabled, setVenueBookingEnabledState] = useState(true);
  const [calendarSyncEnabled, setCalendarSyncEnabledState] = useState(false);
  const [alertThreshold, setAlertThresholdState] = useState(getAlertThreshold());
  const [developerModeVisible, setDeveloperModeVisible] = useState(isDeveloperModeUnlocked());
  const currentUserId = profile?.id || '';
  const isParent = isParentRole(currentRole);
  const showCalendarSyncSwitch = !isParent && canUseCalendarSync(currentRole);
  const isManagerRole = isAdmin(currentRole) || currentRole === 'principal';
  /** 请假自动审批开关（仅校长/管理员可见，null=未加载） */
  const [leaveAutoApprove, setLeaveAutoApprove] = useState<boolean | null>(null);
  const [leaveAutoApproveLoading, setLeaveAutoApproveLoading] = useState(false);

  // 页面显示时读取最新开关状态
  useDidShow(() => {
    setVenueBookingEnabledState(getVenueBookingEnabled());
    setAlertThresholdState(getAlertThreshold());
    setDeveloperModeVisible(isDeveloperModeUnlocked());
    if (currentUserId) {
      setCalendarSyncEnabledState(isCalendarSyncEnabled(currentUserId));
    }
    // 校长/管理员：读取请假自动审批开关
    if (isManagerRole) {
      organizationService
        .getSettings()
        .then((settings) => {
          setLeaveAutoApprove(settings.leaveAutoApprove);
        })
        .catch(() => {
          /* 读取失败保持默认，不打断页面 */
        });
    }
  });

  /** 请假自动审批开关：乐观更新，失败回滚 */
  const handleLeaveAutoApproveChange = useCallback(
    (enabled: boolean) => {
      const previous = leaveAutoApprove;
      setLeaveAutoApprove(enabled);
      setLeaveAutoApproveLoading(true);
      organizationService
        .updateSettings({ leaveAutoApprove: enabled })
        .then((settings) => {
          setLeaveAutoApprove(settings.leaveAutoApprove);
        })
        .catch(() => {
          setLeaveAutoApprove(previous);
          Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
        })
        .finally(() => {
          setLeaveAutoApproveLoading(false);
        });
    },
    [leaveAutoApprove],
  );

  const handleVenueBookingChange = useCallback((enabled: boolean) => {
    setVenueBookingEnabledState(enabled);
    setVenueBookingEnabled(enabled);
  }, []);

  const handleCalendarSyncChange = useCallback(
    async (enabled: boolean) => {
      if (!currentUserId) {
        return;
      }
      if (!enabled) {
        setCalendarSyncEnabledState(false);
        calendarSyncService.disable(currentUserId);
        return;
      }

      setCalendarSyncEnabledState(true);
      try {
        await calendarSyncService.enableAndSync({
          userId: currentUserId,
          teacherId: currentUserId,
          role: currentRole ?? undefined,
          campusId: profile?.currentContext?.campusId,
          directAuth: true,
        });
      } catch (err) {
        setCalendarSyncEnabledState(getCalendarSyncSettings(currentUserId).enabled);
        Taro.showToast({ title: '同步失败，请重试', icon: 'none' });
      }
    },
    [currentRole, currentUserId, profile?.currentContext?.campusId],
  );

  /** 预警阈值配置：跳转到专用表单页（用户口径 2026-08-22：单独页面，非弹框） */
  const handleAlertThresholdChange = useCallback(() => {
    Taro.navigateTo({
      url: '/package-settings/pages/threshold-config/index',
    });
  }, []);

  // 按角色过滤设置项
  const visibleItems = useMemo(() => {
    const isManager = isAdmin(currentRole) || currentRole === 'principal';
    return ALL_SETTING_ITEMS.filter((item) => {
      if (item.adminOnly && !isAdmin(currentRole)) return false;
      if (item.managerOnly && !isManager) return false;
      if (item.hideForParent && isParentRole(currentRole)) return false;
      return true;
    });
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
              clearVisitedMap();
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

  const handleVersionTap = useCallback(() => {
    const result = handleVersionNumberTap();
    if (result === 'unlocked') {
      setDeveloperModeVisible(true);
      Taro.showToast({ title: '已解锁，请输入密码进入', icon: 'none' });
      setTimeout(() => {
        void Taro.navigateTo({ url: '/package-settings/pages/developer-mode/index' });
      }, 400);
    }
  }, []);

  const handleOpenDeveloperMode = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/developer-mode/index' });
  }, []);

  const handleSignOut = useCallback(async () => {
    const res = await Taro.showModal({
      title: '确认退出',
      content: '退出后将清除本地登录状态，是否继续？',
      confirmColor: getThemeHexColors(activeTheme).primary,
    });
    if (!res.confirm) return;
    await signOut();
    Taro.reLaunch({ url: '/package-auth/pages/login/index' });
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

          {/* 场地预约开关：仅管理员/校长 */}
          {isManagerRole && (
            <>
              {visibleItems.length > 0 && <View className="border-t border-border" />}
              <View className="flex flex-row items-center justify-between px-[28rpx] py-[28rpx]">
                <Text className="text-[30rpx] text-foreground">场地预约</Text>
                <Switch checked={venueBookingEnabled} onChange={handleVenueBookingChange} />
              </View>
            </>
          )}

          {/* 请假自动审批开关（校长/管理员） */}
          {isManagerRole && leaveAutoApprove !== null && (
            <View className="flex flex-row items-center justify-between px-[28rpx] py-[28rpx] border-t border-border">
              <View className="flex flex-col gap-[8rpx] flex-1 pr-[24rpx]">
                <Text className="text-[30rpx] text-foreground">家长请假自动审批</Text>
                <Text className="text-[24rpx] text-muted-foreground leading-snug">
                  开启后家长提交请假直接通过；关闭后仅给您发送待办通知
                </Text>
              </View>
              <Switch
                checked={leaveAutoApprove}
                disabled={leaveAutoApproveLoading}
                onChange={handleLeaveAutoApproveChange}
              />
            </View>
          )}

          {showCalendarSyncSwitch && (
            <View className="flex flex-row items-center justify-between px-[28rpx] py-[28rpx] border-t border-border">
              <View className="flex flex-col gap-[8rpx] flex-1 pr-[24rpx]">
                <Text className="text-[30rpx] text-foreground">同步手机日历</Text>
                <Text className="text-[24rpx] text-muted-foreground leading-snug">
                  开启后自动同步未来一周课表到系统日历
                </Text>
              </View>
              <Switch checked={calendarSyncEnabled} onChange={handleCalendarSyncChange} />
            </View>
          )}

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

          {developerModeVisible && !isParent && (
            <View
              className="flex flex-row items-center justify-between px-[28rpx] py-[28rpx] active:opacity-70 press-bg border-t border-border"
              onClick={handleOpenDeveloperMode}
            >
              <Text className="text-[30rpx] text-foreground">开发者模式</Text>
              <Icon name="mdi-chevron-right" size={28} color="mutedForeground" />
            </View>
          )}

          {/* 当前版本（连点解锁开发者模式；家长仅展示版本） */}
          <View
            className="border-t border-border flex flex-row items-center justify-between px-[28rpx] py-[28rpx] active:opacity-70"
            onClick={isParent ? undefined : handleVersionTap}
          >
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
