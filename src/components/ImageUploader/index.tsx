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
 * 选择后返回本地持久化文件路径（已固化，预览稳定且可直接上传），由业务页面在保存时统一上传到七牛。
 */
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import {
  chooseImageTemp,
  deleteTempImage,
  isImageCancelError,
  isTempImagePath,
} from '@/utils/image-upload';

export interface ImageUploaderProps {
  /** 当前图片 URL（本地资源 / 临时路径 / base64 / 网络 URL） */
  value?: string;
  /** 图片变更回调，删除时返回 undefined */
  onChange: (value?: string) => void;
  /** 占位文字（默认：上传图片） */
  placeholder?: string;
  /** 占位图标名称 */
  placeholderIcon?: string;
  /** 最大文件大小（MB），默认 5 */
  maxSizeMB?: number;
  /** 微信原生裁剪比例，如 '1:1'、'16:9'；不传则不裁剪 */
  cropScale?: keyof Taro.cropImage.CropScale;
  className?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  placeholder = '上传图片',
  placeholderIcon = 'mdi-image-plus',
  maxSizeMB = 5,
  cropScale,
  className,
}) => {
  /** 选择图片，返回临时路径 */
  const handleChoose = useCallback(async () => {
    try {
      const tempPath = await chooseImageTemp({ maxSizeMB, cropScale });
      // 替换图片：先删掉旧的本地临时文件，避免本地存储累积
      if (isTempImagePath(value)) deleteTempImage(value);
      onChange(tempPath);
    } catch (err) {
      if (isImageCancelError(err)) return;
      const message = err instanceof Error ? err.message : '选择图片失败';
      if (message.includes('超过') || message.includes('限制')) {
        // 图片超限：弹窗强提醒
        void Taro.showModal({
          title: '图片过大',
          content: message,
          showCancel: false,
          confirmText: '知道了',
        });
      } else {
        Taro.showToast({ title: message, icon: 'none' });
      }
    }
  }, [maxSizeMB, cropScale, onChange, value]);

  /** 删除图片 */
  const handleDelete = useCallback(
    async (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      const { confirm } = await Taro.showModal({
        title: '删除图片',
        content: '确定删除该图片吗？',
        confirmColor: '#EF4444',
      });
      if (!confirm) return;
      // 删除时同步清理本地临时文件
      if (isTempImagePath(value)) deleteTempImage(value);
      onChange(undefined);
    },
    [onChange, value],
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
      <Image className="w-full h-full" src={value} mode="aspectFill" />
      {/* 遮罩 + 预览眼睛 */}
      <View className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity">
        <Icon name="mdi-eye" size={48} color="white" />
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
