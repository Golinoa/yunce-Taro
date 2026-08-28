/**
 * 家长绑定孩子：输入学员邀请码
 *
 * R10：绑定机构输入学员邀请码 → 自动在「绑定子女资料」创建子女（StudentParent BOUND），
 * 同时创建机构用户（MEMBER）；成功后记录待确认关系，进入首页时弹关系确认窗（R11）。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import FormInput from '@/components/FormInput';
import { getSession } from '@/services/auth';
import { organizationService, savePendingRelation } from '@/services/organization';
import { useAuth } from '@/utils/auth';
import { clearIdentitySelectionPending } from '@/utils/auth-onboarding';
import { navigateAfterLogin } from '@/utils/route-guard';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const ParentOnboarding: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const navHeight = useNavSafeHeight();
  const [code, setCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    clearIdentitySelectionPending();
  }, []);

  const handleBind = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      Taro.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      // 后端 bind 事务：校验学员邀请码 → 创建 StudentParent(BOUND) + OrganizationUser(MEMBER) + InviteRelation
      const result = await organizationService.bind(trimmed);
      setStudentName(result.studentName);
      // 记录待确认关系：进入首页时弹关系确认窗（R11）
      savePendingRelation({
        studentId: result.studentId,
        studentName: result.studentName,
        studentParentId: result.studentParentId,
      });
      await refreshProfile();
      const { profile: latestProfile } = await getSession();
      Taro.showToast({ title: '绑定成功', icon: 'success' });
      setTimeout(() => {
        navigateAfterLogin(latestProfile || profile);
      }, 600);
    } catch {
      Taro.showToast({ title: '绑定失败，请检查邀请码', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [code, profile, refreshProfile, submitting]);

  return (
    <View className="min-h-screen flex flex-col bg-background">
      <View style={{ height: `${navHeight}px` }} />

      <View className="px-[48rpx] pt-[32rpx] flex-1">
        <Text className="text-[44rpx] font-bold text-foreground block mb-[12rpx]">绑定孩子</Text>
        <Text className="text-[28rpx] text-muted-foreground block mb-[40rpx]">
          请输入老师提供的学员邀请码
        </Text>

        <FormInput
          variant="capsule"
          placeholder="请输入邀请码"
          value={code}
          onInput={(event) => setCode(event.detail.value.toUpperCase())}
          className="mb-[24rpx]"
        />

        {studentName ? (
          <View className="bg-primary/10 rounded-[20rpx] px-[24rpx] py-[20rpx] mb-[24rpx]">
            <Text className="text-[28rpx] text-foreground">将绑定学员：{studentName}</Text>
          </View>
        ) : null}

        <View
          className="h-[96rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90 mb-[20rpx]"
          onClick={handleBind}
        >
          <Text className="text-[32rpx] font-semibold text-white">
            {submitting ? '处理中...' : studentName ? '绑定完成' : '确认绑定'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default ParentOnboarding;
