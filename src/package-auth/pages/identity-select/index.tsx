/**
 * 选择身份页 pages/identity-select/index
 *
 * 注册/登录后未完成「开店或绑机构」前强制停留本页。
 * - 门店入驻 → store-entry（管理员申请，需运营审核；打开不清除 pending）
 * - 绑定机构 → 本页弹窗输入一码（不跳页）；后端按码特征区分学员/员工
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import BindOrgSheet from '@/components/BindOrgSheet';
import Icon from '@/components/Icon';
import { STORE_ENTRY_IDENTITY_COPY } from '@/constants/store-entry-copy';
import { getSession } from '@/services/auth';
import { organizationService, savePendingRelation } from '@/services/organization';
import { isParentRole, useAuth } from '@/utils/auth';
import {
  clearIdentitySelectionPending,
  navigateAfterAuth,
} from '@/utils/auth-onboarding';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const ALL_IDENTITY_OPTIONS = [
  {
    key: 'store-entry',
    title: STORE_ENTRY_IDENTITY_COPY.optionTitle,
    desc: STORE_ENTRY_IDENTITY_COPY.optionDesc,
    icon: 'mdi-office-building',
    url: '/package-settings/pages/store-entry/index',
  },
  {
    key: 'bind-org',
    title: STORE_ENTRY_IDENTITY_COPY.bindOrgTitle,
    desc: STORE_ENTRY_IDENTITY_COPY.bindOrgDesc,
    icon: 'mdi-account-group',
  },
] as const;

const IdentitySelect: React.FC = () => {
  const navHeight = useNavSafeHeight();
  const { currentRole, refreshProfile } = useAuth();
  const [bindVisible, setBindVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const options = useMemo(() => {
    if (isParentRole(currentRole)) {
      return ALL_IDENTITY_OPTIONS.filter((item) => item.key === 'bind-org');
    }
    return [...ALL_IDENTITY_OPTIONS];
  }, [currentRole]);

  const handleSelect = useCallback((key: (typeof ALL_IDENTITY_OPTIONS)[number]['key']) => {
    if (key === 'bind-org') {
      setBindVisible(true);
      return;
    }
    const opt = ALL_IDENTITY_OPTIONS.find((item) => item.key === key);
    if (opt && 'url' in opt && opt.url) {
      Taro.navigateTo({ url: opt.url });
    }
  }, []);

  const handleBindClose = useCallback(() => {
    if (submitting) return;
    setBindVisible(false);
  }, [submitting]);

  const handleBindSubmit = useCallback(
    async (inviteCode: string) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const result = await organizationService.bindByCode(inviteCode);
        if (
          result.kind === 'student' &&
          result.studentId &&
          result.studentName &&
          result.studentParentId
        ) {
          savePendingRelation({
            studentId: result.studentId,
            studentName: result.studentName,
            studentParentId: result.studentParentId,
          });
        }
        clearIdentitySelectionPending();
        await refreshProfile();
        const { profile: latestProfile } = await getSession();
        setBindVisible(false);
        Taro.showToast({
          title: result.alreadyJoined ? '您已加入该机构' : '绑定成功',
          icon: 'success',
        });
        setTimeout(() => {
          navigateAfterAuth(latestProfile, { isNewUser: false });
        }, 600);
      } catch (error) {
        Taro.showToast({
          title: error instanceof Error && error.message ? error.message : '绑定失败，请检查邀请码',
          icon: 'none',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [refreshProfile, submitting],
  );

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
              ? '请使用机构提供的邀请码绑定'
              : '请先选择：开自己的店，或用邀请码加入已有机构'}
          </Text>
        </View>

        <View className="space-y-[28rpx]">
          {options.map((opt) => (
            <View
              key={opt.key}
              className="flex items-center rounded-[32rpx] bg-card border-2 border-transparent p-[32rpx] shadow-soft active:scale-[0.99] transition-all duration-200"
              onClick={() => handleSelect(opt.key)}
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
            : STORE_ENTRY_IDENTITY_COPY.footerHint}
        </Text>
      </View>

      <BindOrgSheet
        visible={bindVisible}
        submitting={submitting}
        onClose={handleBindClose}
        onSubmit={handleBindSubmit}
      />
    </View>
  );
};

export default IdentitySelect;
