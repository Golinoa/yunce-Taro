import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Icon from '@/components/Icon';
import { studentService } from '@/services';
import { organizationService } from '@/services/organization';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { getAvatarGradientByName } from '@/utils/avatar-color';
import { withRouteGuard } from '@/utils/route-guard';

/**
 * 家长绑定页面
 * 通过教师分享的邀请卡片进入。
 * 优先使用学员 invite_code 走 organization/bind；无码则引导至「我的」输码绑定。
 */
const ParentBind: React.FC = () => {
  const { profile } = useAuth();
  const isParent = profile?.currentContext?.role === 'parent';
  const isLoggedIn = !!profile;

  const studentId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.studentId || '');
  }, []);

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [binding, setBinding] = useState(false);
  const [bound, setBound] = useState(false);
  const [error, setError] = useState('');

  // 加载学生信息
  useEffect(() => {
    if (!studentId) {
      setError('缺少学员信息');
      setLoading(false);
      return;
    }
    studentService
      .getById(studentId)
      .then((stu) => {
        if (!stu) {
          setError('未找到该学员');
        } else {
          setStudent(stu);
        }
      })
      .catch(() => {
        setError('加载失败，请重试');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [studentId]);

  // 绑定操作：邀请码真源；无码引导去「我的」
  const handleBind = useCallback(async () => {
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        Taro.navigateTo({ url: '/package-auth/pages/login/index' });
      }, 1500);
      return;
    }
    if (!isParent) {
      Taro.showToast({ title: '仅家长账号可绑定', icon: 'none' });
      return;
    }
    if (!studentId || !profile?.id) return;

    const inviteCode = student?.invite_code?.trim();
    if (!inviteCode || inviteCode === '请联系老师') {
      const { confirm } = await Taro.showModal({
        title: '请使用邀请码绑定',
        content: '该分享链接无法直接绑定。请向机构索取学员邀请码，在「我的」页输入绑定。',
        confirmText: '去绑定',
        cancelText: '取消',
      });
      if (confirm) {
        void Taro.switchTab({ url: '/pages/profile/index' });
      }
      return;
    }

    setBinding(true);
    try {
      await organizationService.bind(inviteCode.toUpperCase());
      setBound(true);
      Taro.showToast({ title: '绑定成功', icon: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '绑定失败';
      Taro.showToast({ title: msg, icon: 'none' });
    } finally {
      setBinding(false);
    }
  }, [isLoggedIn, isParent, studentId, profile?.id, student?.invite_code]);
  // 返回首页
  const goHome = useCallback(() => {
    Taro.switchTab({ url: '/pages/home/index' });
  }, []);

  // 加载中
  if (loading) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <Text className="text-lg text-muted-foreground">加载中...</Text>
      </View>
    );
  }

  // 错误状态
  if (error) {
    return (
      <View className="min-h-screen bg-background flex flex-col items-center justify-center px-[64rpx]">
        <Icon name="mdi-alert-circle-outline" size="xxxl" color="destructive" />
        <Text className="text-[32rpx] font-medium text-foreground mt-[32rpx]">{error}</Text>
        <Text className="text-[26rpx] text-muted-foreground mt-[16rpx] text-center">
          该邀请可能已失效或链接不正确
        </Text>
        <View
          className="mt-[48rpx] py-[24rpx] px-[64rpx] rounded-[40rpx] bg-gradient-primary press-scale"
          onClick={goHome}
        >
          <Text className="text-[28rpx] text-white font-medium">返回首页</Text>
        </View>
      </View>
    );
  }

  // 绑定成功
  if (bound) {
    return (
      <View className="min-h-screen bg-background flex flex-col items-center justify-center px-[64rpx]">
        <View className="w-[160rpx] h-[160rpx] rounded-full bg-success-bg center">
          <Icon name="mdi-check-circle" size="xxxl" color="success" />
        </View>
        <Text className="text-[36rpx] font-bold text-foreground mt-[32rpx]">绑定成功</Text>
        <Text className="text-[26rpx] text-muted-foreground mt-[16rpx] text-center">
          您已成功绑定学员「{student?.name}」，现在可以查看课时信息了
        </Text>
        <View
          className="mt-[48rpx] py-[24rpx] px-[64rpx] rounded-[40rpx] bg-gradient-primary press-scale"
          onClick={goHome}
        >
          <Text className="text-[28rpx] text-white font-medium">返回首页</Text>
        </View>
      </View>
    );
  }

  // 绑定确认页
  const avatarGradient = getAvatarGradientByName(student?.name || '');

  return (
    <View className="min-h-screen bg-background flex flex-col items-center px-[48rpx] pt-[120rpx]">
      {/* 邀请卡片 */}
      <View className="w-full bg-white rounded-[32rpx] p-[48rpx] shadow-elegant text-center">
        {/* 教师头像占位 */}
        <View className="flex justify-center mb-[24rpx]">
          <View
            className="w-[128rpx] h-[128rpx] rounded-full center border-[6rpx] border-primary/20"
            style={{ background: avatarGradient }}
          >
            <Text className="text-[52rpx] font-bold text-white">{student?.name?.[0] || '?'}</Text>
          </View>
        </View>

        <Text className="text-[32rpx] font-bold text-foreground block">邀请您绑定学员</Text>
        <Text className="text-[48rpx] font-bold text-primary block mt-[16rpx]">
          {student?.name}
        </Text>
        <Text className="text-[24rpx] text-muted-foreground block mt-[16rpx]">
          绑定后可查看学员课时、上课记录等信息
        </Text>

        {/* 提示 */}
        <View className="mt-[32rpx] py-[20rpx] px-[32rpx] bg-amber-500/15 rounded-[16rpx]">
          <View className="flex items-center justify-center gap-[8rpx]">
            <Icon name="mdi-information-outline" size={28} color="warning" />
            <Text className="text-[24rpx] text-amber">此邀请仅限使用一次</Text>
          </View>
        </View>

        {/* 绑定按钮 */}
        <View
          className={`mt-[40rpx] py-[28rpx] rounded-[40rpx] bg-gradient-primary shadow-elegant press-scale ${binding ? 'opacity-60' : ''}`}
          onClick={binding ? undefined : handleBind}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {binding ? '绑定中...' : '确认绑定'}
          </Text>
        </View>
      </View>

      {/* 底部说明 */}
      <Text className="text-[22rpx] text-muted-foreground block mt-[32rpx] text-center">
        如非本人操作，请忽略此邀请
      </Text>
    </View>
  );
};

export default withRouteGuard(ParentBind);
