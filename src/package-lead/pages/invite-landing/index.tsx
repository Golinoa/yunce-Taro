/**
 * 家长邀约落地页 package-lead/pages/invite-landing
 *
 * 家长通过邀约链接/二维码进入的落地页。
 * 展示老师信息、课程介绍，引导注册并预约试听。
 * 已注册家长直接跳转约课页。
 */
import { View, Text } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { leadService } from '@/services';
import { useAuth } from '@/utils/auth';

/** 落地页参数 */
interface LandingParams {
  /** 邀请老师 ID */
  t: string;
  /** 校区 ID */
  c: string;
  /** 来源课程 ID（可选） */
  course?: string;
  /** 来源类型 */
  st?: 'share_link' | 'qr';
}

const InviteLandingPage: React.FC = () => {
  const { profile, session } = useAuth();
  const isLoggedIn = !!session;
  const [params, setParams] = useState<LandingParams>({ t: '', c: '' });

  // 注册表单
  const [childName, setChildName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useLoad((options) => {
    const opt = options as Record<string, string>;
    setParams({
      t: opt.t || '',
      c: opt.c || '',
      course: opt.course,
      st: opt.st === 'qr' ? 'qr' : 'share_link',
    });
  });

  // 已登录家长直接跳转约课页
  const handleGoBooking = useCallback(() => {
    Taro.navigateTo({
      url: `/package-lead/pages/trial-booking/index?teacherId=${params.t}&campusId=${params.c}`,
    });
  }, [params]);

  // 未注册家长提交信息
  const handleSubmit = useCallback(async () => {
    if (!childName.trim()) {
      Taro.showToast({ title: '请输入孩子姓名', icon: 'none' });
      return;
    }
    if (!parentPhone.trim()) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      await leadService.createLeadFromInvite({
        parentUserId: session?.user.id || '',
        parentName: parentName.trim() || undefined,
        parentPhone: parentPhone.trim(),
        childName: childName.trim(),
        teacherId: params.t,
        campusId: params.c,
        sourceType: params.st || 'share_link',
        sourceCourseId: params.course,
      });
      Taro.showToast({ title: '提交成功', icon: 'success' });
      setTimeout(() => {
        Taro.navigateTo({
          url: `/package-lead/pages/trial-booking/index?teacherId=${params.t}&campusId=${params.c}`,
        });
      }, 1000);
    } catch {
      Taro.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [childName, parentName, parentPhone, params, session?.user.id]);

  return (
    <PageContainer>
      <View className="px-page-padding py-6">
        {/* 头部介绍 */}
        <View className="flex flex-col items-center mb-8">
          <View className="w-[160rpx] h-[160rpx] bg-primary/10 rounded-full center mb-4">
            <Icon name="mdi-school-outline" size={64} className="text-primary" />
          </View>
          <Text className="text-[36rpx] font-bold text-foreground mb-2">欢迎免费试听</Text>
          <Text className="text-[26rpx] text-muted-foreground text-center">
            填写信息即可预约免费试听课程
          </Text>
        </View>

        {/* 已登录：直接约课 */}
        {isLoggedIn ? (
          <View className="flex flex-col items-center gap-4">
            <Text className="text-[28rpx] text-foreground">{profile?.name || '家长'}，您好！</Text>
            <View
              className="w-full py-[28rpx] rounded-full center bg-gradient-primary"
              onClick={handleGoBooking}
            >
              <Text className="text-[30rpx] text-white font-medium">立即预约试听</Text>
            </View>
          </View>
        ) : (
          /* 未登录：填写信息 */
          <View className="bg-white rounded-[24rpx] p-5">
            <Text className="text-[28rpx] font-semibold text-foreground mb-4">填写信息</Text>

            <FormInput
              label="孩子姓名"
              placeholder="请输入孩子姓名"
              value={childName}
              onInput={(e) => setChildName(e.detail.value)}
              required
            />
            <FormInput
              label="家长姓名"
              placeholder="请输入家长姓名（选填）"
              value={parentName}
              onInput={(e) => setParentName(e.detail.value)}
            />
            <FormInput
              label="手机号"
              placeholder="请输入手机号"
              value={parentPhone}
              onInput={(e) => setParentPhone(e.detail.value)}
              type="number"
              required
            />

            <View
              className={cn(
                'mt-6 py-[24rpx] rounded-full center',
                submitting ? 'bg-muted' : 'bg-gradient-primary',
              )}
              onClick={submitting ? undefined : handleSubmit}
            >
              <Text
                className={cn(
                  'text-[28rpx] font-medium',
                  submitting ? 'text-muted-foreground' : 'text-white',
                )}
              >
                {submitting ? '提交中...' : '提交并预约'}
              </Text>
            </View>
          </View>
        )}
      </View>
    </PageContainer>
  );
};

export default InviteLandingPage;
