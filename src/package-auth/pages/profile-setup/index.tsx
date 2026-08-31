/**
 * 微信登录后完善头像与昵称
 * 使用微信原生 chooseAvatar + nickname 能力
 */
import { View, Text, Button, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import Icon from '@/components/Icon';
import { BRAND_NAME_ZH } from '@/constants/brand';
import { getSession } from '@/services/auth';
import { useAuth } from '@/utils/auth';
import { navigateAfterProfileSetup } from '@/utils/auth-onboarding';
import { uploadImage, isTempImagePath } from '@/utils/image-upload';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const ProfileSetup: React.FC = () => {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const navHeight = useNavSafeHeight();
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [nickname, setNickname] = useState(profile?.nickname || profile?.name || '');
  const [submitting, setSubmitting] = useState(false);
  /** 键盘 + 微信原生昵称条占位，避免底栏与「完成并继续」重叠 */
  const [keyboardInset, setKeyboardInset] = useState(0);

  const NICKNAME_BAR_EXTRA_PX = 56;

  const handleChooseAvatar = useCallback((event: { detail: { avatarUrl: string } }) => {
    const next = event.detail?.avatarUrl;
    if (next) {
      setAvatarUrl(next);
    }
  }, []);

  const syncKeyboardInset = useCallback((height: number) => {
    setKeyboardInset(height > 0 ? height + NICKNAME_BAR_EXTRA_PX : 0);
  }, []);

  const handleNicknameFocus = useCallback(
    (event: { detail: { height?: number } }) => {
      syncKeyboardInset(event.detail?.height ?? 0);
    },
    [syncKeyboardInset],
  );

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
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      Taro.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      let remoteAvatar = avatarUrl;
      if (avatarUrl && isTempImagePath(avatarUrl)) {
        remoteAvatar = await uploadImage(avatarUrl, 'avatar');
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
    } catch {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [avatarUrl, nickname, profile, refreshProfile, updateProfile]);

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

      {/* 标题区：顶部轻量文案 */}
      <View className="relative z-10 px-[48rpx] pt-[24rpx] flex-shrink-0">
        <Text className="text-[40rpx] font-bold text-foreground block mb-[8rpx]">完善你的资料</Text>
        <Text className="text-[26rpx] text-muted-foreground block">
          使用微信头像和昵称，完成{BRAND_NAME_ZH}注册
        </Text>
      </View>

      {/* 交互热区：头像 + 昵称垂直居中，落在拇指舒适点击区 */}
      <View className="relative z-10 flex-1 flex flex-col items-stretch justify-center px-[48rpx]">
        <View className="flex flex-col items-center mb-[48rpx]">
          <Button
            className="p-0 m-0 bg-transparent border-none after:border-none"
            openType="chooseAvatar"
            onChooseAvatar={handleChooseAvatar}
          >
            <View className="w-[220rpx] h-[220rpx] rounded-full overflow-hidden bg-muted flex items-center justify-center border-[4rpx] border-solid border-primary/20">
              {avatarUrl ? (
                <Image src={avatarUrl} className="w-full h-full" mode="aspectFill" />
              ) : (
                <Icon name="account" size={88} className="text-muted-foreground" />
              )}
            </View>
          </Button>
          <Text className="text-[26rpx] text-muted-foreground mt-[20rpx]">点击选择微信头像</Text>
        </View>

        <View className="bg-card rounded-[28rpx] px-[28rpx] py-[8rpx] border border-border shadow-soft">
          <View className="flex flex-row items-center min-h-[112rpx]">
            <Text className="text-[28rpx] text-muted-foreground w-[120rpx]">昵称</Text>
            <Input
              type="nickname"
              className="flex-1 text-[30rpx] text-foreground text-right"
              placeholder="点击使用微信昵称"
              adjustPosition={false}
              value={nickname}
              onInput={(event) => setNickname(event.detail.value)}
              onFocus={handleNicknameFocus}
              onKeyboardHeightChange={handleNicknameKeyboardHeightChange}
              onBlur={handleNicknameBlur}
              maxlength={20}
            />
          </View>
        </View>
      </View>

      {/* 底部主按钮 */}
      <View className="relative z-10 px-[48rpx] pb-[calc(48rpx+env(safe-area-inset-bottom))] flex-shrink-0">
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
      </View>
    </View>
  );
};

export default ProfileSetup;
