/**
 * 系统设置页 package-settings/pages/system-settings/index
 *
 * 所有角色均可进入，内部设置项按角色权限过滤显示：
 * - 通用项（操作记录、用户协议、退出登录）：所有角色可见
 * - 管理员专属项（主题颜色、课表管理、定时备份、重置新手引导）：仅管理员可见
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo } from 'react';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { clearVisitedMap } from '@/data/onboarding';
import { isAdmin, STORE_ONBOARDING_HIDDEN_KEY, useAuth } from '@/utils/auth';

/** 设置项配置 */
interface SettingItem {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  route: string;
  /** 仅管理员可见 */
  adminOnly?: boolean;
}

/** 系统设置全量分组 */
const ALL_SETTING_ITEMS: SettingItem[] = [
  {
    icon: 'mdi-clipboard-text',
    iconBg: 'bg-primary-bg',
    iconColor: 'primary',
    title: '操作记录',
    desc: '查看账号与业务操作日志',
    route: '',
  },
  {
    icon: 'mdi-palette',
    iconBg: 'bg-accent-bg',
    iconColor: 'accent',
    title: '主题颜色',
    desc: '设置个人主题色',
    route: '',
  },
  {
    icon: 'mdi-calendar-clock',
    iconBg: 'bg-info-bg',
    iconColor: 'info',
    title: '课表管理',
    desc: '管理排课与课表展示',
    route: '',
    adminOnly: true,
  },
  {
    icon: 'mdi-timer',
    iconBg: 'bg-success-bg',
    iconColor: 'success',
    title: '定时备份',
    desc: '设置数据自动备份周期',
    route: '',
    adminOnly: true,
  },
  {
    icon: 'mdi-file-document-outline',
    iconBg: 'bg-warning-bg',
    iconColor: 'warning',
    title: '用户协议',
    desc: '查看用户协议与隐私政策',
    route: '/pages/agreement/index',
  },
  {
    icon: 'mdi-history',
    iconBg: 'bg-purple-bg',
    iconColor: 'accent',
    title: '重置新手引导',
    desc: '重新显示店铺管理配置引导',
    route: '__reset_onboarding__',
    adminOnly: true,
  },
];

/** 未实现入口占位提示 */
const PLACEHOLDER_TIP = '功能开发中，敬请期待';

const SystemSettings: React.FC = () => {
  const { signOut, currentRole } = useAuth();

  // 按角色过滤设置项：adminOnly 的仅管理员可见，其余通用
  const visibleItems = useMemo(
    () => ALL_SETTING_ITEMS.filter((item) => !item.adminOnly || isAdmin(currentRole)),
    [currentRole],
  );

  const handleNavigate = useCallback((route: string) => {
    if (route === '__reset_onboarding__') {
      Taro.showModal({
        title: '重置新手引导',
        content: '重置后将重新显示店铺管理配置引导，所有步骤进度也将清除，是否继续？',
        confirmColor: '#5EC8A8',
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
  }, []);

  const handleSignOut = useCallback(async () => {
    const res = await Taro.showModal({
      title: '确认退出',
      content: '退出后将清除本地登录状态，是否继续？',
      confirmColor: '#5EC8A8',
    });
    if (!res.confirm) return;
    await signOut();
    Taro.reLaunch({ url: '/pages/login/index' });
  }, [signOut]);

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[32rpx]">
        {visibleItems.map((item) => (
          <View
            key={item.title}
            className="flex flex-row items-center bg-white rounded-[28rpx] shadow-soft px-[28rpx] py-[24rpx] mb-[20rpx] press-bg"
            onClick={() => handleNavigate(item.route)}
          >
            {/* 图标 */}
            <View
              className={cn(
                'w-[76rpx] h-[76rpx] rounded-[22rpx] flex items-center justify-center mr-[20rpx] flex-shrink-0',
                item.iconBg,
              )}
            >
              <Icon name={item.icon} size={38} color={item.iconColor} />
            </View>
            {/* 文字 */}
            <View className="flex-1 min-w-0 flex flex-col">
              <Text className="text-[28rpx] font-semibold text-foreground">{item.title}</Text>
              <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] truncate">
                {item.desc}
              </Text>
            </View>
            {/* 箭头 */}
            <View className="w-[56rpx] h-[56rpx] rounded-[16rpx] bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="mdi-chevron-right" size={28} color="primary" />
            </View>
          </View>
        ))}
      </View>

      {/* 退出登录：所有角色可见 */}
      <View className="px-[32rpx] mt-[48rpx] mb-[48rpx]">
        <View
          className="bg-white rounded-[28rpx] py-[28rpx] flex items-center justify-center shadow-soft press-bg"
          onClick={handleSignOut}
        >
          <Text className="text-[30rpx] font-semibold text-error">退出登录</Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default SystemSettings;
