/**
 * 登录后身份引导：机构入驻 / 绑定孩子
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import { markOnboardingSkipped } from '@/utils/auth-onboarding';
import { navigateAfterLogin } from '@/utils/route-guard';
import { useAuth } from '@/utils/auth';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const Onboarding: React.FC = () => {
  const { profile } = useAuth();
  const navHeight = useNavSafeHeight();

  const handleInstitution = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/store-entry/index' });
  }, []);

  const handleParent = useCallback(() => {
    Taro.navigateTo({ url: '/package-auth/pages/parent-onboarding/index' });
  }, []);

  const handleSkip = useCallback(() => {
    markOnboardingSkipped();
    Taro.showToast({ title: '可在「我的」中继续完成', icon: 'none' });
    setTimeout(() => {
      navigateAfterLogin(profile);
    }, 500);
  }, [profile]);

  return (
    <View className="min-h-screen flex flex-col bg-background">
      <View style={{ height: `${navHeight}px` }} />

      <View className="px-[48rpx] pt-[32rpx] flex-1">
        <Text className="text-[44rpx] font-bold text-foreground block mb-[12rpx]">选择下一步</Text>
        <Text className="text-[28rpx] text-muted-foreground block mb-[48rpx]">
          完善身份后，即可使用完整功能
        </Text>

        <View
          className="bg-card rounded-[28rpx] p-[32rpx] mb-[24rpx] border border-border shadow-soft active:opacity-90"
          onClick={handleInstitution}
        >
          <View className="flex flex-row items-center gap-[24rpx]">
            <View className="w-[88rpx] h-[88rpx] rounded-[24rpx] bg-gradient-principal flex items-center justify-center">
              <Icon name="mdi-office-building" size={44} className="text-white" />
            </View>
            <View className="flex-1">
              <Text className="text-[32rpx] font-semibold text-foreground block">机构入驻</Text>
              <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] block">
                我是校长/老师，创建或加入机构
              </Text>
            </View>
            <Icon name="mdi-chevron-right" size={28} className="text-muted-foreground" />
          </View>
        </View>

        <View
          className="bg-card rounded-[28rpx] p-[32rpx] border border-border shadow-soft active:opacity-90"
          onClick={handleParent}
        >
          <View className="flex flex-row items-center gap-[24rpx]">
            <View className="w-[88rpx] h-[88rpx] rounded-[24rpx] bg-gradient-parent flex items-center justify-center">
              <Icon name="mdi-account-group" size={44} className="text-white" />
            </View>
            <View className="flex-1">
              <Text className="text-[32rpx] font-semibold text-foreground block">绑定孩子</Text>
              <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] block">
                我是家长，输入邀请码关联学员
              </Text>
            </View>
            <Icon name="mdi-chevron-right" size={28} className="text-muted-foreground" />
          </View>
        </View>
      </View>

      <View className="px-[48rpx] pb-[calc(48rpx+env(safe-area-inset-bottom))]">
        <Text className="text-[28rpx] text-primary text-center block py-[24rpx]" onClick={handleSkip}>
          稍后再说
        </Text>
      </View>
    </View>
  );
};

export default Onboarding;
