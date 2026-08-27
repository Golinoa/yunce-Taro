/**
 * 家长绑定孩子：输入学员邀请码
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import FormInput from '@/components/FormInput';
import { studentService } from '@/services';
import { getSession, validateInviteCode } from '@/services/auth';
import { useAuth } from '@/utils/auth';
import { navigateAfterLogin } from '@/utils/route-guard';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const ParentOnboarding: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const navHeight = useNavSafeHeight();
  const [code, setCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleValidate = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      Taro.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }

    const result = await validateInviteCode(trimmed);
    if (!result.valid || !result.studentId) {
      setStudentName('');
      setStudentId('');
      Taro.showToast({ title: '邀请码无效', icon: 'none' });
      return;
    }

    setStudentName(result.studentName || result.inviterName || '学员');
    setStudentId(result.studentId);
    Taro.showToast({ title: '已找到学员', icon: 'none' });
  }, [code]);

  const handleBind = useCallback(async () => {
    if (!profile?.id || !studentId) {
      await handleValidate();
      return;
    }

    setSubmitting(true);
    try {
      await studentService.bindParent(studentId, profile.id);
      await refreshProfile();
      const { profile: latestProfile } = await getSession();
      Taro.showToast({ title: '绑定成功', icon: 'success' });
      setTimeout(() => {
        navigateAfterLogin(latestProfile || profile);
      }, 600);
    } catch {
      Taro.showToast({ title: '绑定失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [handleValidate, profile, refreshProfile, studentId]);

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
          onClick={studentId ? handleBind : handleValidate}
        >
          <Text className="text-[32rpx] font-semibold text-white">
            {submitting ? '处理中...' : studentId ? '确认绑定' : '验证邀请码'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default ParentOnboarding;
