/**
 * 微信登录后完善头像与昵称
 *
 * - 头像：Button open-type=chooseAvatar → stabilizeAvatarLocalPath（持久化/1:1/5MB）
 * - 昵称：Input type=nickname（点选微信昵称）或自行填写
 * - 保存：本地文件先上传 CDN，再 PUT /profile { nickname, avatar }
 * 开发/生产同一套代码，仅 API/CDN 域名随环境配置切换。
 */
import { View, Text, Button, Image, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import { BRAND_LOGO, BRAND_NAME_ZH } from '@/constants/brand';
import { getSession } from '@/services/auth';
import { useAuth } from '@/utils/auth';
import { navigateAfterProfileSetup } from '@/utils/auth-onboarding';
import { resolveAvatarSrc } from '@/utils/avatar-src';
import { handleChooseAvatarError } from '@/utils/choose-avatar-error';
import {
  isImageCancelError,
  isLocalWechatFilePath,
  stabilizeAvatarLocalPath,
  uploadImage,
} from '@/utils/image-upload';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';
import { usePrivacyForProfileFields } from '@/utils/use-privacy-for-profile-fields';

const ProfileSetup: React.FC = () => {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const navHeight = useNavSafeHeight();
  const { privacyReady, privacyChecking, ensurePrivacy } = usePrivacyForProfileFields();

  useDidShow(() => {
    Taro.hideLoading();
  });

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [nickname, setNickname] = useState(profile?.nickname || profile?.name || '');
  const [submitting, setSubmitting] = useState(false);
  /** 键盘 + 微信原生昵称条占位，避免底栏与「完成并继续」重叠 */
  const [keyboardInset, setKeyboardInset] = useState(0);

  const NICKNAME_BAR_EXTRA_PX = 56;

  const handleWechatAvatar = useCallback(async (event: { detail: { avatarUrl: string } }) => {
    const next = event.detail?.avatarUrl?.trim();
    if (!next) {
      Taro.showToast({ title: '未获取到头像', icon: 'none' });
      return;
    }
    try {
      const stablePath = await stabilizeAvatarLocalPath(next);
      setAvatarUrl(stablePath);
      Taro.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) {
      if (isImageCancelError(err)) return;
      const message = err instanceof Error ? err.message : '头像处理失败';
      if (/隐私|privacy|disagree|不同意|相册/i.test(message)) {
        Taro.showToast({
          title: '需要同意隐私保护指引后才能使用相册',
          icon: 'none',
          duration: 2800,
        });
        return;
      }
      if (message.includes('超过') || message.includes('限制')) {
        void Taro.showModal({
          title: '图片过大',
          content: message,
          showCancel: false,
          confirmText: '知道了',
        });
        return;
      }
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, []);

  const syncKeyboardInset = useCallback((height: number) => {
    setKeyboardInset(height > 0 ? height + NICKNAME_BAR_EXTRA_PX : 0);
  }, []);

  const handleNicknameFocus = useCallback(
    async (event: { detail: { height?: number } }) => {
      await ensurePrivacy();
      syncKeyboardInset(event.detail?.height ?? 0);
    },
    [ensurePrivacy, syncKeyboardInset],
  );

  const handleAvatarTap = useCallback(async () => {
    const ok = await ensurePrivacy();
    if (!ok) {
      Taro.showToast({
        title: '需要同意隐私保护指引后才能选择头像',
        icon: 'none',
        duration: 2800,
      });
    }
  }, [ensurePrivacy]);

  const avatarVisual = avatarUrl ? (
    <Image src={resolveAvatarSrc(avatarUrl)} className="w-full h-full" mode="aspectFill" />
  ) : (
    <Image src={BRAND_LOGO} className="w-full h-full" mode="aspectFill" />
  );

  const avatarButtonClass =
    'w-[220rpx] h-[220rpx] rounded-full overflow-hidden bg-muted flex items-center justify-center border-[4rpx] border-solid border-primary/20 p-0 m-0 after:border-none active:opacity-90';

  const handleNicknameKeyboardHeightChange = useCallback(
    (event: { detail: { height: number } }) => {
      syncKeyboardInset(event.detail?.height ?? 0);
    },
    [syncKeyboardInset],
  );

  const handleNicknameBlur = useCallback(() => {
    setKeyboardInset(0);
  }, []);

  const handleSubmit = useCallback(async () => {
    const privacyOk = await ensurePrivacy();
    if (!privacyOk) {
      Taro.showToast({
        title: '请先同意隐私保护指引后才能继续',
        icon: 'none',
        duration: 2800,
      });
      return;
    }

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      Taro.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      let remoteAvatar = avatarUrl.trim();
      if (remoteAvatar && isLocalWechatFilePath(remoteAvatar)) {
        Taro.showLoading({ title: '上传头像...', mask: true });
        try {
          remoteAvatar = await uploadImage(remoteAvatar, 'avatar');
        } finally {
          Taro.hideLoading();
        }
      }

      const { error } = await updateProfile({
        name: trimmedNickname,
        nickname: trimmedNickname,
        avatar_url: remoteAvatar || undefined,
      });
      if (error) {
        Taro.showToast({ title: error.message || '保存失败', icon: 'none' });
        return;
      }

      await refreshProfile();
      const { profile: latestProfile } = await getSession();
      Taro.showToast({ title: '资料已保存', icon: 'success' });
      setTimeout(() => {
        navigateAfterProfileSetup(latestProfile || profile);
      }, 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败，请重试';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [avatarUrl, ensurePrivacy, nickname, profile, refreshProfile, updateProfile]);

  return (
    <View
      className="min-h-screen flex flex-col bg-background relative overflow-hidden"
      style={
        keyboardInset > 0
          ? { paddingBottom: `${keyboardInset}px`, transition: 'padding-bottom 0.2s ease' }
          : undefined
      }
    >
      <View className="absolute top-0 left-0 right-0 h-[520rpx] overflow-hidden bg-register-deco">
        <View className="absolute w-[400rpx] h-[400rpx] rounded-full bg-register-circle -top-[120rpx] -right-[120rpx]" />
      </View>

      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      <View className="relative z-10 px-[48rpx] pt-[24rpx] flex-shrink-0">
        <Text className="text-[40rpx] font-bold text-foreground block mb-[8rpx]">完善你的资料</Text>
        <Text className="text-[26rpx] text-muted-foreground block">
          设置头像和昵称，完成{BRAND_NAME_ZH}注册
        </Text>
        {!privacyReady ? (
          <View
            className="mt-[20rpx] px-[24rpx] py-[20rpx] rounded-[20rpx] bg-primary/8 active:opacity-80"
            onClick={() => {
              void ensurePrivacy();
            }}
          >
            <Text className="text-[26rpx] text-primary block">
              {privacyChecking
                ? '正在请求隐私授权…'
                : '使用头像/昵称前需同意隐私保护指引，点此授权'}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="relative z-10 flex-1 flex flex-col items-stretch justify-center px-[48rpx]">
        <View className="flex flex-col items-center mb-[48rpx]">
          {privacyReady ? (
            <Button
              className={avatarButtonClass}
              plain
              hoverClass="none"
              openType="chooseAvatar"
              onChooseAvatar={handleWechatAvatar}
              onError={handleChooseAvatarError}
            >
              {avatarVisual}
            </Button>
          ) : (
            <View className={avatarButtonClass} onClick={handleAvatarTap}>
              {avatarVisual}
            </View>
          )}
          <Text className="text-[26rpx] text-muted-foreground mt-[20rpx]">点击选择头像</Text>
          <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">
            使用微信头像、相册或拍照
          </Text>
        </View>

        <View className="bg-card rounded-[28rpx] px-[28rpx] py-[8rpx] border border-border shadow-soft">
          <View className="flex flex-row items-center min-h-[112rpx]">
            <Text className="text-[28rpx] text-muted-foreground w-[120rpx]">昵称</Text>
            {privacyReady ? (
              <Input
                key={`nickname-ready-${profile?.id ?? 'setup'}`}
                type="nickname"
                className="flex-1 text-[30rpx] text-foreground text-right"
                placeholder="点选微信昵称，或自行填写"
                adjustPosition={false}
                defaultValue={nickname}
                onInput={(event) => setNickname(event.detail.value)}
                onFocus={handleNicknameFocus}
                onKeyboardHeightChange={handleNicknameKeyboardHeightChange}
                onBlur={handleNicknameBlur}
                maxlength={20}
              />
            ) : (
              <View
                className="flex-1 flex items-center justify-end"
                onClick={() => {
                  void ensurePrivacy();
                }}
              >
                <Text className="text-[30rpx] text-muted-foreground">请先同意隐私指引</Text>
              </View>
            )}
          </View>
        </View>
        <Text className="text-[22rpx] text-muted-foreground mt-[16rpx] px-[8rpx]">
          {privacyReady
            ? '昵称栏支持一键使用微信昵称，也可直接输入自定义昵称'
            : '同意隐私保护指引后，可使用微信头像与微信昵称'}
        </Text>
      </View>

      <View className="relative z-10 px-[48rpx] pb-[calc(48rpx+env(safe-area-inset-bottom))] flex-shrink-0">
          {privacyReady ? (
            <View
              className={cn(
                'h-[96rpx] rounded-full flex items-center justify-center bg-primary shadow-login-btn active:opacity-90',
                submitting && 'opacity-60',
              )}
              onClick={handleSubmit}
            >
              <Text className="text-[32rpx] font-semibold text-white">
                {submitting ? '保存中...' : '完成并继续'}
              </Text>
            </View>
          ) : (
            <View
              className="h-[96rpx] rounded-full flex items-center justify-center bg-muted active:opacity-90"
              onClick={() => {
                void ensurePrivacy();
              }}
            >
              <Text className="text-[30rpx] font-semibold text-muted-foreground">
                {privacyChecking ? '正在请求隐私授权…' : '请先同意隐私保护指引'}
              </Text>
            </View>
          )}
      </View>
    </View>
  );
};

export default ProfileSetup;
