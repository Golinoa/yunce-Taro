/**
 * 登录页 — 仅微信一键登录；登录后走完善资料 / 选择身份（绑定与入驻）
 */
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import AgreementDialog from '@/components/AgreementDialog';
import { BRAND_LOGO } from '@/constants/brand';
import { useAgreementStore } from '@/stores/agreement';
import { consumeLastLoginIsNewUser, navigateAfterAuth } from '@/utils/auth-onboarding';
import { useAuth } from '@/utils/auth';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const Login: React.FC = () => {
  const { profile, signInWithWechat } = useAuth();
  const { agreed, setAgreed } = useAgreementStore();
  const navHeight = useNavSafeHeight();

  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const [wechatSubmitting, setWechatSubmitting] = useState(false);
  const [pendingLogin, setPendingLogin] = useState(false);

  useEffect(() => {
    if (profile) {
      const isNewUser = consumeLastLoginIsNewUser();
      navigateAfterAuth(profile, isNewUser ? { isNewUser: true } : undefined);
    }
  }, [profile]);

  const executeWechatLogin = useCallback(async () => {
    if (wechatSubmitting) return;

    setWechatSubmitting(true);
    try {
      const { code: wxCode } = await Taro.login();
      if (!wxCode) {
        Taro.showToast({ title: '微信授权失败，请重试', icon: 'none' });
        return;
      }
      const { error } = await signInWithWechat(wxCode);
      if (error) {
        Taro.showToast({ title: error.message || '微信登录失败', icon: 'none' });
        return;
      }
      Taro.setStorageSync('justLoggedIn', 'true');
    } catch {
      Taro.showToast({ title: '微信登录失败', icon: 'none' });
    } finally {
      setWechatSubmitting(false);
      setPendingLogin(false);
    }
  }, [signInWithWechat, wechatSubmitting]);

  const handleWechatLogin = useCallback(() => {
    if (wechatSubmitting) return;
    if (!agreed) {
      setPendingLogin(true);
      setShowAgreementDialog(true);
      return;
    }
    void executeWechatLogin();
  }, [agreed, executeWechatLogin, wechatSubmitting]);

  const handleAgreementConfirm = useCallback(() => {
    setAgreed(true);
    setShowAgreementDialog(false);
    if (pendingLogin) {
      void executeWechatLogin();
    }
  }, [executeWechatLogin, pendingLogin, setAgreed]);

  return (
    <View className="min-h-screen flex flex-col relative overflow-hidden">
      <View className="absolute inset-0 bg-login-gradient" />

      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      <View className="relative z-10 flex-1 flex flex-col items-center justify-start pt-[120rpx]">
        <View className="absolute w-[420rpx] h-[420rpx] rounded-full bg-login-glow" />
        <View className="relative w-[220rpx] h-[220rpx] rounded-full bg-login-orb flex items-center justify-center overflow-hidden">
          <Image
            src={BRAND_LOGO}
            mode="aspectFill"
            className="w-[160rpx] h-[160rpx] rounded-full"
          />
        </View>
        <Text className="relative mt-[40rpx] text-[36rpx] font-semibold text-foreground">
          松果排课
        </Text>
        <Text className="relative mt-[12rpx] text-[26rpx] text-muted-foreground">
          微信登录后完成绑定与入驻即可使用
        </Text>
      </View>

      <View className="relative z-10 px-[48rpx] pb-[48rpx]">
        <View
          className={cn(
            'h-[104rpx] rounded-full flex items-center justify-center bg-gradient-wechat shadow-wechat-btn active:opacity-90',
            wechatSubmitting && 'opacity-60',
          )}
          onClick={handleWechatLogin}
        >
          <Text className="text-[34rpx] font-semibold text-white">
            {wechatSubmitting ? '登录中...' : '微信一键登录'}
          </Text>
        </View>

        <View
          className="mt-[32rpx] flex flex-row items-start justify-center gap-[12rpx]"
          onClick={() => setAgreed(!agreed)}
        >
          <View
            className={cn(
              'mt-[4rpx] h-[32rpx] w-[32rpx] rounded-full border-[2rpx] flex items-center justify-center',
              agreed ? 'border-primary bg-primary' : 'border-muted-foreground',
            )}
          >
            {agreed ? <Text className="text-[20rpx] text-white">✓</Text> : null}
          </View>
          <Text className="flex-1 text-[24rpx] leading-[36rpx] text-muted-foreground">
            我已阅读并同意
            <Text
              className="text-primary"
              onClick={(e) => {
                e.stopPropagation();
                setShowAgreementDialog(true);
              }}
            >
              《用户协议》和《隐私政策》
            </Text>
          </Text>
        </View>
      </View>

      <AgreementDialog
        visible={showAgreementDialog}
        onClose={() => {
          setShowAgreementDialog(false);
          setPendingLogin(false);
        }}
        onConfirm={handleAgreementConfirm}
      />
    </View>
  );
};

export default Login;

export function definePageConfig() {
  return {
    navigationBarTitleText: '登录',
    navigationStyle: 'custom',
  };
}
