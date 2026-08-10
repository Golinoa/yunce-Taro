/**
 * 图片上传组件
 *
 * 支持：
 * - 默认占位图 + 上传提示
 * - 已上传图片预览（使用 Taro Image 组件，兼容本地资源、临时文件与 base64）
 * - 点击右上角删除按钮移除图片
 * - 点击图片中心眼睛按钮预览原图
 * - 点击占位区域调起相册/拍照选择
 * - 文件大小限制与推荐尺寸提示
 *
 * 选择后返回微信临时文件路径，由业务页面在保存时统一上传持久化。
 */
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import { chooseImageTemp } from '@/utils/image-upload';

export interface ImageUploaderProps {
  /** 当前图片 URL（本地资源 / 临时路径 / base64 / 网络 URL） */
  value?: string;
  /** 图片变更回调，删除时返回 undefined */
  onChange: (value?: string) => void;
  /** 占位文字（默认：上传图片） */
  placeholder?: string;
  /** 占位图标名称 */
  placeholderIcon?: string;
  /** 最大文件大小（MB），默认 2 */
  maxSizeMB?: number;
  className?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  placeholder = '上传图片',
  placeholderIcon = 'mdi-image-plus',
  maxSizeMB = 2,
  className,
}) => {
  /** 选择图片，返回临时路径 */
  const handleChoose = useCallback(async () => {
    try {
      const tempPath = await chooseImageTemp({ maxSizeMB });
      onChange(tempPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : '选择图片失败';
      if (message.includes('超过') || message.includes('限制')) {
        // 图片超限：弹窗强提醒
        void Taro.showModal({
          title: '图片过大',
          content: message,
          showCancel: false,
          confirmText: '知道了',
        });
      } else if (!message.includes('取消') && !message.toLowerCase().includes('cancel')) {
        Taro.showToast({ title: message, icon: 'none' });
      }
    }
  }, [maxSizeMB, onChange]);

  /** 删除图片 */
  const handleDelete = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onChange(undefined);
    },
    [onChange],
  );

  /** 预览图片 */
  const handlePreview = useCallback(() => {
    if (!value) return;
    void Taro.previewImage({
      current: value,
      urls: [value],
    });
  }, [value]);

  if (!value) {
    return (
      <View
        className={cn(
          'w-[160rpx] h-[160rpx] rounded-[24rpx] bg-muted flex flex-col items-center justify-center gap-[8rpx] press-bg',
          className,
        )}
        onClick={handleChoose}
      >
        <Icon name={placeholderIcon} size={48} color="muted-foreground" />
        <Text className="text-[24rpx] text-muted-foreground">{placeholder}</Text>
      </View>
    );
  }

  return (
    <View
      className={cn(
        'w-[160rpx] h-[160rpx] rounded-[24rpx] overflow-hidden relative press-bg',
        className,
      )}
      onClick={handlePreview}
    >
      <Image className="w-full h-full" src={value} mode="aspectFill" lazyLoad />
      {/* 遮罩 + 预览眼睛 */}
      <View className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity">
        <Icon name="mdi-eye-outline" size={48} color="white" />
      </View>
      {/* 删除按钮 */}
      <View
        className="absolute top-[8rpx] right-[8rpx] w-[40rpx] h-[40rpx] rounded-full bg-black/50 flex items-center justify-center z-10"
        onClick={handleDelete}
      >
        <Icon name="mdi-close" size={24} color="white" />
      </View>
    </View>
  );
};

export default ImageUploader;
