/**
 * 选择身份页 pages/identity-select/index（R1）
 *
 * 新用户注册/完善资料后必经：选择「门店入驻」或「绑定机构」。
 * - 门店入驻 → 门店入驻申请页（package-settings/pages/store-entry/index）
 * - 绑定机构 → 输入学员邀请码绑定（package-auth/pages/parent-onboarding/index）
 *
 * pending 标记在目标页成功进入后再清除，避免目标页被守卫拦截时丢回流入口。
 * 已是家长身份时仅保留「绑定机构」，避免点门店入驻后被权限拦回。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo } from 'react';
import Icon from '@/components/Icon';
import { isParentRole, useAuth } from '@/utils/auth';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const ALL_IDENTITY_OPTIONS = [
  {
    key: 'store-entry',
    title: '门店入驻',
    desc: '我是机构负责人，创建自己的门店',
    icon: 'mdi-office-building',
    url: '/package-settings/pages/store-entry/index',
  },
  {
    key: 'bind-org',
    title: '绑定机构',
    desc: '已有机构，输入学员邀请码加入',
    icon: 'mdi-account-group',
    url: '/package-auth/pages/parent-onboarding/index',
  },
] as const;

const IdentitySelect: React.FC = () => {
  const navHeight = useNavSafeHeight();
  const { currentRole } = useAuth();

  const options = useMemo(() => {
    if (isParentRole(currentRole)) {
      return ALL_IDENTITY_OPTIONS.filter((item) => item.key === 'bind-org');
    }
    return [...ALL_IDENTITY_OPTIONS];
  }, [currentRole]);

  const handleSelect = useCallback((url: string) => {
    Taro.navigateTo({ url });
  }, []);

  return (
    <View className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* 顶部装饰背景：与注册流程页一致 */}
      <View className="absolute top-0 left-0 right-0 h-[440rpx] overflow-hidden bg-register-deco">
        <View className="absolute w-[360rpx] h-[360rpx] rounded-full bg-register-circle -top-[100rpx] -right-[100rpx]" />
      </View>

      {/* 导航安全区占位 */}
      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      {/* 内容 */}
      <View className="relative px-page-padding flex-1 z-10">
        <View className="mb-[40rpx] mt-[32rpx]">
          <Text className="text-[48rpx] font-bold text-foreground mb-[12rpx] block">
            选择您的身份
          </Text>
          <Text className="text-[28rpx] text-muted-foreground">
            {isParentRole(currentRole)
              ? '请使用机构提供的学员邀请码绑定孩子'
              : '选择进入方式，后续可在设置中调整'}
          </Text>
        </View>

        <View className="space-y-[28rpx]">
          {options.map((opt) => (
            <View
              key={opt.key}
              className="flex items-center rounded-[32rpx] bg-card border-2 border-transparent p-[32rpx] shadow-soft active:scale-[0.99] transition-all duration-200"
              onClick={() => handleSelect(opt.url)}
            >
              <View className="w-[96rpx] h-[96rpx] rounded-[28rpx] bg-primary/10 flex items-center justify-center mr-[24rpx]">
                <Icon name={opt.icon} size={48} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="text-[34rpx] font-semibold text-foreground block leading-tight">
                  {opt.title}
                </Text>
                <Text className="text-[26rpx] text-muted-foreground mt-[8rpx] block leading-normal">
                  {opt.desc}
                </Text>
              </View>
              <Icon name="mdi-chevron-right" size={40} className="text-muted-foreground" />
            </View>
          ))}
        </View>

        <Text className="text-[24rpx] text-muted-foreground text-center block mt-[48rpx] leading-[1.7]">
          {isParentRole(currentRole)
            ? '绑定成功后可在「我的」查看孩子课表与课时'
            : '门店入驻需提交资质审核；绑定机构需输入学员邀请码'}
        </Text>
      </View>
    </View>
  );
};

export default IdentitySelect;
