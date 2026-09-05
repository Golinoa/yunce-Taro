/**
 * SupportQrDialog — 全局统一「客服 / 维修企微码」弹窗
 *
 * 视觉对齐运营投放稿：天蓝渐变壳 + 白卡 + 橙标题 + 二维码 + 保存图片 + 底部关闭。
 * 文案 / 二维码 URL 可通过 props 覆盖，默认走维修客服企微码。
 */
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { MEDIA_IMAGE_BASE } from '@/constants/brand';
import {
  SUPPORT_QR_DEFAULT_COPY,
  SUPPORT_REPAIR_QR_CDN,
  SUPPORT_REPAIR_QR_LOCAL,
  SUPPORT_REPAIR_QR_URL,
} from '@/constants/support-qr';

const QR_POINT_HAND = `${MEDIA_IMAGE_BASE}/qr-point-hand.png`;

export interface SupportQrDialogProps {
  visible: boolean;
  onClose: () => void;
  /** 标题第一行（橙字） */
  titleLine1?: string;
  /** 标题第二行（橙字） */
  titleLine2?: string;
  /** 二维码下方说明，可用 \n 换行 */
  description?: string;
  /** 保存按钮文案 */
  saveLabel?: string;
  /** 二维码图片 URL，默认维修企微码 CDN */
  qrUrl?: string;
}

async function ensureAlbumAuth(): Promise<boolean> {
  try {
    const setting = await Taro.getSetting();
    if (setting.authSetting['scope.writePhotosAlbum']) return true;
    try {
      await Taro.authorize({ scope: 'scope.writePhotosAlbum' });
      return true;
    } catch {
      const modal = await Taro.showModal({
        title: '需要相册权限',
        content: '保存二维码到相册需要授权，请在设置中开启。',
        confirmText: '去设置',
        cancelText: '取消',
      });
      if (modal.confirm) {
        await Taro.openSetting();
        const again = await Taro.getSetting();
        return Boolean(again.authSetting['scope.writePhotosAlbum']);
      }
      return false;
    }
  } catch {
    return false;
  }
}

async function resolveLocalPath(url: string): Promise<string> {
  if (!url) throw new Error('empty qr url');
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const downloaded = await Taro.downloadFile({ url });
    if (downloaded.statusCode !== 200 || !downloaded.tempFilePath) {
      throw new Error('download failed');
    }
    return downloaded.tempFilePath;
  }
  const info = await Taro.getImageInfo({ src: url });
  return info.path;
}

const SupportQrDialog: React.FC<SupportQrDialogProps> = ({
  visible,
  onClose,
  titleLine1 = SUPPORT_QR_DEFAULT_COPY.titleLine1,
  titleLine2 = SUPPORT_QR_DEFAULT_COPY.titleLine2,
  description = SUPPORT_QR_DEFAULT_COPY.description,
  saveLabel = SUPPORT_QR_DEFAULT_COPY.saveLabel,
  qrUrl = SUPPORT_REPAIR_QR_URL,
}) => {
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [imgSrc, setImgSrc] = useState(qrUrl);
  const [saving, setSaving] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setImgSrc(qrUrl);
  }, [qrUrl]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      rafRef.current = requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  const handleTransitionEnd = () => {
    if (!animating) setMounted(false);
  };

  const handleImgError = useCallback(() => {
    setImgSrc((prev) => {
      if (prev === SUPPORT_REPAIR_QR_LOCAL) return prev;
      if (prev === SUPPORT_REPAIR_QR_CDN || prev === qrUrl) {
        return SUPPORT_REPAIR_QR_LOCAL;
      }
      return SUPPORT_REPAIR_QR_LOCAL;
    });
  }, [qrUrl]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await ensureAlbumAuth();
      if (!ok) {
        Taro.showToast({ title: '未获得相册权限', icon: 'none' });
        return;
      }
      let path: string;
      try {
        path = await resolveLocalPath(imgSrc);
      } catch {
        path = await resolveLocalPath(SUPPORT_REPAIR_QR_LOCAL);
      }
      await Taro.saveImageToPhotosAlbum({ filePath: path });
      Taro.showToast({ title: '已保存到相册', icon: 'success' });
    } catch {
      Taro.showToast({ title: '保存失败，请长按二维码', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [imgSrc, saving]);

  if (!mounted) return null;

  const descLines = description.split('\n').filter(Boolean);

  return (
    <View className="fixed inset-0 z-[1100] flex items-center justify-center px-[48rpx]">
      <View
        className={cn(
          'absolute inset-0 transition-opacity duration-200',
          animating ? 'bg-black/55' : 'bg-transparent',
        )}
        style={{ backdropFilter: animating ? 'blur(2px)' : 'none' }}
        onClick={onClose}
        catchMove
      />

      <View
        className={cn(
          'relative z-[1] w-full max-w-[620rpx] flex flex-col items-center',
          'transition-all duration-200 ease-out',
          animating ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        )}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* 天蓝渐变外壳 */}
        <View
          className="w-full rounded-[40rpx] px-[28rpx] pt-[28rpx] pb-[36rpx] overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #C8E4FF 0%, #EAF4FF 42%, #FFFFFF 100%)',
            boxShadow: '0 24rpx 64rpx rgba(59, 110, 245, 0.18)',
          }}
        >
          {/* 内白卡 */}
          <View
            className="rounded-[32rpx] bg-white px-[36rpx] pt-[40rpx] pb-[36rpx] flex flex-col items-center"
            style={{ boxShadow: '0 8rpx 28rpx rgba(59, 110, 245, 0.08)' }}
          >
            <Text
              className="text-[44rpx] font-bold text-center leading-[1.25]"
              style={{ color: '#FF6A2B' }}
            >
              {titleLine1}
            </Text>
            <Text
              className="text-[44rpx] font-bold text-center leading-[1.25] mb-[28rpx]"
              style={{ color: '#FF6A2B' }}
            >
              {titleLine2}
            </Text>

            <View className="relative w-[360rpx] h-[360rpx] mb-[28rpx]">
              <View
                className="w-full h-full rounded-[24rpx] bg-white overflow-hidden flex items-center justify-center"
                style={{ boxShadow: '0 6rpx 20rpx rgba(0,0,0,0.06)' }}
              >
                <Image
                  src={imgSrc}
                  mode="aspectFit"
                  className="w-[320rpx] h-[320rpx]"
                  showMenuByLongpress
                  onError={handleImgError}
                />
              </View>
              {/* 指引手势 */}
              <Image
                src={QR_POINT_HAND}
                mode="aspectFit"
                className="absolute right-[-20rpx] bottom-[-24rpx] w-[96rpx] h-[96rpx] pointer-events-none"
              />
            </View>

            <View className="flex flex-col items-center gap-[4rpx]">
              {descLines.map((line) => (
                <Text
                  key={line}
                  className="text-[26rpx] text-foreground text-center leading-[1.55]"
                >
                  {line}
                </Text>
              ))}
            </View>
          </View>

          {/* 保存图片 */}
          <View
            className={cn(
              'mt-[28rpx] mx-auto h-[88rpx] w-[420rpx] rounded-full bg-white flex items-center justify-center active:opacity-85',
              saving && 'opacity-70',
            )}
            style={{ boxShadow: '0 8rpx 24rpx rgba(59, 110, 245, 0.12)' }}
            onClick={saving ? undefined : () => void handleSave()}
          >
            <Text className="text-[30rpx] font-semibold" style={{ color: '#3B6EF5' }}>
              {saving ? '保存中...' : saveLabel}
            </Text>
          </View>
        </View>

        {/* 底部关闭 */}
        <View
          className="mt-[36rpx] w-[72rpx] h-[72rpx] rounded-full flex items-center justify-center active:opacity-80"
          style={{ background: 'rgba(255,255,255,0.28)' }}
          onClick={onClose}
        >
          <Icon name="mdi-close" size={36} color="#ffffff" />
        </View>
      </View>
    </View>
  );
};

export default SupportQrDialog;
