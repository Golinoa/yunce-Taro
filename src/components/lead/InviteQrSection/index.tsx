import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';

export interface InviteQrSectionProps {
  teacherName: string;
  campusName: string;
  inviteLink: string;
  /** 小程序码 base64（不含 data: 前缀） */
  qrCodeBase64?: string;
  qrImageSrc?: string;
  expireAt?: string;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  className?: string;
}

function formatExpireAt(iso?: string): string {
  if (!iso) return '24 小时';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const InviteQrSection: React.FC<InviteQrSectionProps> = ({
  teacherName,
  campusName,
  inviteLink,
  qrImageSrc,
  expireAt,
  loading = false,
  error = '',
  onRefresh,
  className,
}) => {
  const handleCopyLink = useCallback(() => {
    if (!inviteLink) {
      Taro.showToast({ title: '链接未就绪', icon: 'none' });
      return;
    }
    Taro.setClipboardData({
      data: inviteLink,
      success: () => {
        Taro.showToast({ title: '链接已复制（24h有效）', icon: 'none', duration: 2500 });
      },
    });
  }, [inviteLink]);

  const handleShare = useCallback(() => {
    Taro.showShareMenu({ withShareTicket: true, showShareItems: ['shareAppMessage'] });
    Taro.showToast({ title: '请点击右上角转发', icon: 'none' });
  }, []);

  return (
    <View className={cn('flex flex-col items-center', className)}>
      <View className="w-[400rpx] h-[400rpx] bg-white rounded-[24rpx] center shadow-card mb-4 overflow-hidden">
        {loading ? (
          <Loading text="生成小程序码…" />
        ) : error ? (
          <View className="flex flex-col items-center gap-3 px-4">
            <Icon name="mdi-alert-circle-outline" size={48} className="text-destructive" />
            <Text className="text-[24rpx] text-muted-foreground text-center">{error}</Text>
            {onRefresh ? (
              <Text className="text-[26rpx] text-primary" onClick={onRefresh}>
                重新生成
              </Text>
            ) : null}
          </View>
        ) : qrImageSrc ? (
          <Image
            src={qrImageSrc}
            mode="aspectFit"
            className="w-[360rpx] h-[360rpx]"
            showMenuByLongpress
          />
        ) : (
          <View className="flex flex-col items-center gap-2">
            <Icon name="mdi-qrcode-scan" size={80} className="text-primary" />
            <Text className="text-[24rpx] text-muted-foreground">暂无小程序码</Text>
          </View>
        )}
      </View>

      <Text className="text-[22rpx] text-muted-foreground mb-3">
        扫码直达招生页 · 有效期至 {formatExpireAt(expireAt)}
      </Text>

      <View className="flex flex-col items-center gap-1 mb-4">
        <Text className="text-[28rpx] font-semibold text-foreground">{teacherName} 的邀约</Text>
        <Text className="text-[24rpx] text-muted-foreground">{campusName}</Text>
      </View>

      <View className="w-full bg-muted rounded-[16rpx] px-4 py-3 mb-4">
        <Text className="text-[22rpx] text-foreground-secondary break-all">
          {inviteLink || '—'}
        </Text>
      </View>

      <View className="flex gap-3 w-full">
        <View
          className={cn(
            'flex-1 bg-white border-2 border-primary rounded-full py-3 center',
            loading && 'opacity-50',
          )}
          onClick={loading ? undefined : handleCopyLink}
        >
          <View className="flex items-center gap-2">
            <Icon name="content-copy" size={18} className="text-primary" />
            <Text className="text-[26rpx] text-primary font-medium">复制链接</Text>
          </View>
        </View>
        <View
          className={cn(
            'flex-1 bg-gradient-primary rounded-full py-3 center',
            loading && 'opacity-50',
          )}
          onClick={loading ? undefined : handleShare}
        >
          <View className="flex items-center gap-2">
            <Icon name="share-variant" size={18} className="text-white" />
            <Text className="text-[26rpx] text-white font-medium">转发邀请</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default InviteQrSection;
