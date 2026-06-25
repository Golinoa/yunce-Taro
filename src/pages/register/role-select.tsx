/**
 * 注册 Step2：选择身份
 * 对齐设计稿 03-register-step2.html
 * 顶部装饰背景 + 步骤指示器 + 角色选择卡片
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import ActionButton from '@/components/ActionButton';
import RegisterStepper from '@/components/RegisterStepper';
import RoleCard from '@/components/RoleCard';
import type { UserRole } from '@/types/profile';
import { useAuth } from '@/utils/auth';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

/** 角色选项（对齐设计稿顺序：教师 → 校长 → 家长） */
const ROLE_OPTIONS: { role: UserRole; title: string; description: string }[] = [
  { role: 'teacher', title: '我是教师', description: '在校区授课，管理课程与学员' },
  { role: 'principal', title: '我是校长', description: '创建机构，管理校区与教师团队' },
  { role: 'parent', title: '我是家长', description: '查看孩子学习进度与课程安排' },
];

const RegisterRoleSelect: React.FC = () => {
  const { registerDraft, signUpStep2 } = useAuth();
  const navHeight = useNavSafeHeight();

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 必须先完成 Step1
  useEffect(() => {
    if (!registerDraft?.tempToken) {
      Taro.redirectTo({ url: '/pages/register/index' });
    }
  }, [registerDraft]);

  const handleNext = useCallback(async () => {
    if (submitting) return;
    if (!selectedRole) {
      Taro.showToast({ title: '请选择身份', icon: 'none' });
      return;
    }

    setSubmitting(true);
    const { error } = await signUpStep2(selectedRole);
    setSubmitting(false);

    if (error) {
      Taro.showToast({ title: error.message || '选择失败', icon: 'none' });
      return;
    }

    Taro.navigateTo({ url: '/pages/register/role-info' });
  }, [submitting, selectedRole, signUpStep2]);

  return (
    <View className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* 顶部装饰背景：覆盖状态栏，统一颜色 */}
      <View className="absolute top-0 left-0 right-0 h-[440rpx] overflow-hidden bg-register-deco">
        <View className="absolute w-[360rpx] h-[360rpx] rounded-full bg-register-circle -top-[100rpx] -right-[100rpx]" />
      </View>

      {/* 导航安全区占位 */}
      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      {/* 步骤指示器 */}
      <View className="relative px-page-padding mt-[16rpx] mb-[32rpx] z-10">
        <RegisterStepper current={2} />
      </View>

      {/* 内容 */}
      <View className="relative px-page-padding flex-1 z-10">
        <View className="mb-[32rpx]">
          <Text className="text-[48rpx] font-bold text-foreground mb-[12rpx] block">
            请选择您的身份
          </Text>
          <Text className="text-[28rpx] text-muted-foreground">
            不同身份对应不同功能页面，请认真选择
          </Text>
        </View>

        <View className="space-y-[24rpx]">
          {ROLE_OPTIONS.map((option) => (
            <RoleCard
              key={option.role}
              role={option.role}
              title={option.title}
              description={option.description}
              selected={selectedRole === option.role}
              mode="radio"
              onClick={() => setSelectedRole(option.role)}
            />
          ))}
        </View>
      </View>

      {/* 底部 */}
      <View className="relative px-page-padding pb-[calc(48rpx+env(safe-area-inset-bottom))] z-10">
        <ActionButton
          text={submitting ? '提交中...' : '下一步'}
          onClick={handleNext}
          disabled={submitting || !selectedRole}
        />
      </View>
    </View>
  );
};

export default RegisterRoleSelect;
