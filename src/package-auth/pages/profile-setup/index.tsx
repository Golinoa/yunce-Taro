/**
 * 微信登录后完善头像与昵称
 *
 * - 头像：相册（chooseMedia，先走隐私授权）或微信头像（button open-type=chooseAvatar）
 * - 昵称：Input type=nickname（点选微信昵称）或自行填写
 * - 保存：本地文件先上传 CDN，再 PUT /profile { nickname, avatar }
 * 开发/生产同一套代码，仅 API/CDN 域名随环境配置切换。
 */
import { View, Text, Button, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import { BRAND_LOGO, BRAND_NAME_ZH } from '@/constants/brand';
import { resolveAvatarSrc } from '@/utils/avatar-src';
import { getSession } from '@/services/auth';
import { useAuth } from '@/utils/auth';
import { navigateAfterProfileSetup } from '@/utils/auth-onboarding';
import {
  chooseImageTemp,
  isImageCancelError,
  isLocalWechatFilePath,
  uploadImage,
} from '@/utils/image-upload';
import { ensurePrivacyAuthorized } from '@/utils/privacy-authorize';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const ProfileSetup: React.FC = () => {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const navHeight = useNavSafeHeight();
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [nickname, setNickname] = useState(profile?.nickname || profile?.name || '');
  const [submitting, setSubmitting] = useState(false);
  const [wechatAvatarSheetOpen, setWechatAvatarSheetOpen] = useState(false);
  /** 键盘 + 微信原生昵称条占位，避免底栏与「完成并继续」重叠 */
  const [keyboardInset, setKeyboardInset] = useState(0);

  const NICKNAME_BAR_EXTRA_PX = 56;

  const handleWechatAvatar = useCallback((event: { detail: { avatarUrl: string } }) => {
    const next = event.detail?.avatarUrl?.trim();
    if (!next) {
      Taro.showToast({ title: '未获取到微信头像', icon: 'none' });
      return;
    }
    setAvatarUrl(next);
    setWechatAvatarSheetOpen(false);
    Taro.showToast({ title: '已选择微信头像', icon: 'success' });
  }, []);

  const pickFromAlbum = useCallback(async () => {
    try {
      // 直接触发隐私授权（未同意则弹 PrivacyPopup）；同意后再打开相册
      await ensurePrivacyAuthorized();
      const path = await chooseImageTemp({
        maxSizeMB: 5,
        cropScale: '1:1',
        sourceType: ['album', 'camera'],
      });
      setAvatarUrl(path);
    } catch (err) {
      if (isImageCancelError(err)) return;
      const message = err instanceof Error ? err.message : '选择图片失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, []);

  const handleAvatarEntry = useCallback(() => {
    void Taro.showActionSheet({
      itemList: ['从相册选择', '使用微信头像'],
      success: (res) => {
        if (res.tapIndex === 0) {
          void pickFromAlbum();
          return;
        }
        if (res.tapIndex === 1) {
          // chooseAvatar 必须由用户点击带 open-type 的原生 Button，不能编程触发
          setWechatAvatarSheetOpen(true);
        }
      },
    });
  }, [pickFromAlbum]);

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

      <View className="relative z-10 px-[48rpx] pt-[24rpx] flex-shrink-0">
        <Text className="text-[40rpx] font-bold text-foreground block mb-[8rpx]">完善你的资料</Text>
        <Text className="text-[26rpx] text-muted-foreground block">
          设置头像和昵称，完成{BRAND_NAME_ZH}注册
        </Text>
      </View>

      <View className="relative z-10 flex-1 flex flex-col items-stretch justify-center px-[48rpx]">
        <View className="flex flex-col items-center mb-[48rpx]">
          <View
            className="w-[220rpx] h-[220rpx] rounded-full overflow-hidden bg-muted flex items-center justify-center border-[4rpx] border-solid border-primary/20 active:opacity-90"
            onClick={handleAvatarEntry}
          >
            {avatarUrl ? (
              <Image
                src={resolveAvatarSrc(avatarUrl)}
                className="w-full h-full"
                mode="aspectFill"
              />
            ) : (
              <Image src={BRAND_LOGO} className="w-full h-full" mode="aspectFill" />
            )}
          </View>
          <Text className="text-[26rpx] text-muted-foreground mt-[20rpx]">点击选择头像</Text>
          <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">
            可从相册上传，或使用微信头像
          </Text>
        </View>

        <View className="bg-card rounded-[28rpx] px-[28rpx] py-[8rpx] border border-border shadow-soft">
          <View className="flex flex-row items-center min-h-[112rpx]">
            <Text className="text-[28rpx] text-muted-foreground w-[120rpx]">昵称</Text>
            <Input
              type="nickname"
              className="flex-1 text-[30rpx] text-foreground text-right"
              placeholder="点选微信昵称，或自行填写"
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
        <Text className="text-[22rpx] text-muted-foreground mt-[16rpx] px-[8rpx]">
          昵称栏支持一键使用微信昵称，也可直接输入自定义昵称
        </Text>
      </View>

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

      <BottomSheet
        visible={wechatAvatarSheetOpen}
        title="使用微信头像"
        onClose={() => setWechatAvatarSheetOpen(false)}
      >
        <View className="px-[32rpx] pb-[48rpx]">
          <Text className="text-[26rpx] text-muted-foreground block mb-[28rpx]">
            微信要求：须点击下方按钮，从微信头像中选择（开发者工具可能受限，请用真机验证）
          </Text>
          <Button
            className="m-0 h-[96rpx] rounded-full flex items-center justify-center bg-primary text-white text-[30rpx] font-semibold after:border-none"
            openType="chooseAvatar"
            onChooseAvatar={handleWechatAvatar}
          >
            选择微信头像
          </Button>
        </View>
      </BottomSheet>
    </View>
  );
};

export default ProfileSetup;
