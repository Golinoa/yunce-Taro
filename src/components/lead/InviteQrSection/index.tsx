import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';

/**
 * InviteQrSection - 邀约二维码区域组件
 *
 * 展示老师专属邀约二维码、链接、复制和转发功能。
 * 二维码图片由后端生成，此处为占位展示。
 */

export interface InviteQrSectionProps {
  /** 老师名称 */
  teacherName: string;
  /** 校区名称 */
  campusName: string;
  /** 邀约链接 */
  inviteLink: string;
  /** 二维码图片 URL（后端生成的小程序码） */
  qrCodeUrl?: string;
  className?: string;
}

const InviteQrSection: React.FC<InviteQrSectionProps> = ({
  teacherName,
  campusName,
  inviteLink,
  qrCodeUrl,
  className,
}) => {
  /** 复制链接 */
  const handleCopyLink = useCallback(() => {
    Taro.setClipboardData({
      data: inviteLink,
      success: () => {
        Taro.showToast({ title: '链接已复制', icon: 'success' });
      },
    });
  }, [inviteLink]);

  /** 转发邀请卡片 */
  const handleShare = useCallback(() => {
    Taro.showShareMenu({ withShareTicket: true });
  }, []);

  return (
    <View className={cn('flex flex-col items-center', className)}>
      {/* 二维码区域 */}
      <View className="w-[400rpx] h-[400rpx] bg-white rounded-[24rpx] center shadow-card mb-4">
        {qrCodeUrl ? (
          <View className="w-full h-full center">
            {/* 实际项目中用 Image 组件展示后端返回的小程序码 */}
            <Text className="text-[24rpx] text-muted-foreground">二维码加载中...</Text>
          </View>
        ) : (
          <View className="flex flex-col items-center gap-2">
            <Icon name="mdi-qrcode-scan" size={80} className="text-primary" />
            <Text className="text-[24rpx] text-muted-foreground">专属邀请码</Text>
          </View>
        )}
      </View>

      {/* 老师与校区信息 */}
      <View className="flex flex-col items-center gap-1 mb-4">
        <Text className="text-[28rpx] font-semibold text-foreground">{teacherName} 的邀约</Text>
        <Text className="text-[24rpx] text-muted-foreground">{campusName}</Text>
      </View>

      {/* 邀约链接 */}
      <View className="w-full bg-muted rounded-[16rpx] px-4 py-3 mb-4">
        <Text className="text-[22rpx] text-foreground-secondary break-all">{inviteLink}</Text>
      </View>

      {/* 操作按钮组 */}
      <View className="flex gap-3 w-full">
        <View
          className="flex-1 bg-white border-2 border-primary rounded-full py-3 center"
          onClick={handleCopyLink}
        >
          <View className="flex items-center gap-2">
            <Icon name="content-copy" size={18} className="text-primary" />
            <Text className="text-[26rpx] text-primary font-medium">复制链接</Text>
          </View>
        </View>
        <View className="flex-1 bg-gradient-primary rounded-full py-3 center" onClick={handleShare}>
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
