/**
 * 身份切换页
 * 对齐设计稿 05-role-switch.html
 * 独立页面，展示所有身份并支持切换，同时提供添加新身份入口
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo } from 'react';
import Icon from '@/components/Icon';
import RoleCard from '@/components/RoleCard';
import { useAuth } from '@/utils/auth';
import { safeReLaunch } from '@/utils/navigation';

const ROLE_DESCRIPTION: Record<string, string> = {
  principal: '管理机构、校区与教师',
  teacher: '管理班级、课程与学员',
  parent: '查看孩子课程与考勤',
};

const RoleSwitch: React.FC = () => {
  const { profile, currentIdentity, switchIdentity } = useAuth();

  const identities = useMemo(() => profile?.identities || [], [profile]);

  const handleSwitch = useCallback(
    async (identityId: string) => {
      if (identityId === currentIdentity?.id) {
        Taro.navigateBack();
        return;
      }
      const { error } = await switchIdentity(identityId);
      if (error) {
        Taro.showToast({ title: error.message, icon: 'none' });
        return;
      }
      Taro.showToast({ title: '切换成功', icon: 'success' });
      await safeReLaunch('/pages/home/index');
    },
    [currentIdentity?.id, switchIdentity],
  );

  const handleAddIdentity = useCallback(() => {
    Taro.navigateTo({ url: '/package-auth/pages/role-switch/add-role' });
  }, []);

  const handleBack = useCallback(() => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/home/index' }) });
  }, []);

  return (
    <View className="min-h-screen flex flex-col bg-background">
      {/* 顶部导航 */}
      <View className="pt-safe px-page-padding">
        <View className="h-[88rpx] flex items-center justify-between">
          <View
            className="w-[64rpx] h-[64rpx] flex items-center justify-center"
            onClick={handleBack}
          >
            <Icon name="arrow-left" size={32} className="text-foreground" />
          </View>
          <Text className="text-[32rpx] font-semibold text-foreground">切换身份</Text>
          <View className="w-[64rpx]" />
        </View>
      </View>

      {/* 当前身份提示 */}
      <View className="px-page-padding mt-[24rpx] mb-[32rpx]">
        <Text className="text-[36rpx] font-bold text-foreground mb-[12rpx]">当前正在使用</Text>
        <Text className="text-[26rpx] text-muted-foreground">切换后首页将展示对应身份的功能</Text>
      </View>

      {/* 身份列表 */}
      <View className="px-page-padding flex-1">
        <View className="space-y-[24rpx]">
          {identities.map((identity) => (
            <RoleCard
              key={identity.id}
              role={identity.role}
              title={identity.organizationName}
              description={ROLE_DESCRIPTION[identity.role]}
              active={identity.id === currentIdentity?.id}
              mode="default"
              onClick={() => handleSwitch(identity.id)}
            />
          ))}
        </View>
      </View>

      {/* 添加新身份 */}
      <View className="px-page-padding pb-[calc(48rpx+env(safe-area-inset-bottom))]">
        <View
          className={cn(
            'flex items-center justify-center py-[28rpx] rounded-2xl border-2 border-dashed border-border bg-card',
            'active:bg-primary-5 transition-colors',
          )}
          onClick={handleAddIdentity}
        >
          <Icon name="mdi-plus" size={32} className="text-primary mr-[12rpx]" />
          <Text className="text-[30rpx] font-medium text-primary">添加新身份</Text>
        </View>
      </View>
    </View>
  );
};

export default RoleSwitch;
