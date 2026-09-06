/**
 * 系统设置页 package-settings/pages/system-settings/index
 *
 * 所有角色均可进入，内部设置项按角色权限过滤显示：
 * - 家长：用户协议、主题颜色、版本、退出（无机构配置）
 * - 教师：个人项（主题颜色、同步手机日历、本人操作日志）+ 用户协议 / 版本 / 退出
 * - 机构效果与配置（待办提醒）：仅管理员/校长
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
import { SYSTEM_SETTING_ITEMS } from '@/constants/system-settings-items';
import { calendarSyncService } from '@/services/calendar-sync';
import { campusService } from '@/services/campus';
import { clearVisitedMap } from '@/services/onboarding';
import { organizationService } from '@/services/organization';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import { getAlertThreshold, syncAlertThresholdFromCampus } from '@/utils/alert-config';
import { isAdmin, isParentRole, STORE_ONBOARDING_HIDDEN_KEY, useAuth } from '@/utils/auth';
import {
  canUseCalendarSync,
  getCalendarSyncSettings,
  isCalendarSyncEnabled,
} from '@/utils/calendar-sync-settings';
import { getDisplayAppVersion } from '@/utils/mini-program-env';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { getVenueBookingEnabled, setVenueBookingEnabled } from '@/utils/venue-booking-config';

/** 系统设置全量分组（真源：constants/system-settings-items） */
const ALL_SETTING_ITEMS = SYSTEM_SETTING_ITEMS;

/** 未实现入口占位提示 */
const PLACEHOLDER_TIP = '功能开发中，敬请期待';

const SystemSettings: React.FC = () => {
  useCardNavigationBar();
  const { signOut, currentRole, profile } = useAuth();
  const { activeTheme } = useThemeStore();
  const [venueBookingEnabled, setVenueBookingEnabledState] = useState(true);
  const [calendarSyncEnabled, setCalendarSyncEnabledState] = useState(false);
  const [alertThreshold, setAlertThresholdState] = useState(getAlertThreshold());
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
    if (currentUserId) {
      setCalendarSyncEnabledState(isCalendarSyncEnabled(currentUserId));
    }
    const campusId = profile?.currentContext?.campusId;
    if (campusId) {
      void campusService
        .getById(campusId)
        .then((campus) => {
          if (campus) {
            const cfg = syncAlertThresholdFromCampus({
              hoursAlertThreshold: campus.hoursAlertThreshold,
              daysAlertThreshold: campus.daysAlertThreshold,
              amountAlertThreshold: campus.amountAlertThreshold,
            });
            setAlertThresholdState(cfg.hours);
          } else {
            setAlertThresholdState(getAlertThreshold());
          }
        })
        .catch(() => setAlertThresholdState(getAlertThreshold()));
    } else {
      setAlertThresholdState(getAlertThreshold());
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

  /** 预警阈值：合并到续费提醒页的提醒设置 */
  const handleAlertThresholdChange = useCallback(() => {
    Taro.navigateTo({
      url: '/package-student/pages/renewal-reminder/index',
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

          {/* 运营预警阈值配置（管理员/校长） */}
          {(isAdmin(currentRole) || currentRole === 'principal') && (
            <View
              className="flex flex-row items-center justify-between px-[28rpx] py-[28rpx] active:opacity-70 press-bg border-t border-border"
              onClick={handleAlertThresholdChange}
            >
              <Text className="text-[30rpx] text-foreground">续费提醒阈值</Text>
              <Text className="text-[28rpx] text-muted-foreground">
                ≤ {alertThreshold} 课时等 · 去设置
              </Text>
            </View>
          )}

          {/* 当前版本：正式版读微信线上号；开发/体验回退 package.json */}
          <View className="border-t border-border flex flex-row items-center justify-between px-[28rpx] py-[28rpx]">
            <Text className="text-[30rpx] text-foreground">当前版本</Text>
            <Text className="text-[28rpx] text-muted-foreground">v{getDisplayAppVersion()}</Text>
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
