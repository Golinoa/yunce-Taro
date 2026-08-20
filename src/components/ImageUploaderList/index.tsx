/**
 * 多图上传组件
 *
 * 支持：
 * - 最多 N 张图片（默认 5 张）
 * - 单张大小限制（默认 5MB）
 * - 新增、删除、预览
 * - 选择后返回本地持久化路径列表，由业务页面保存时统一上传到七牛
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

export interface ImageUploaderListProps {
  /** 当前图片 URL 列表 */
  value: string[];
  /** 图片列表变更回调 */
  onChange: (value: string[]) => void;
  /** 最大数量，默认 5 */
  maxCount?: number;
  /** 单张最大文件大小（MB），默认 5 */
  maxSizeMB?: number;
  /** 微信原生裁剪比例，如 '1:1'、'16:9'；不传则不裁剪 */
  cropScale?: keyof Taro.cropImage.CropScale;
  /** 占位提示文字 */
  placeholder?: string;
  /** 是否显示数量提示 */
  showCount?: boolean;
  className?: string;
}

const ImageUploaderList: React.FC<ImageUploaderListProps> = ({
  value,
  onChange,
  maxCount = 5,
  maxSizeMB = 5,
  cropScale,
  placeholder = '上传图片',
  showCount = true,
  className,
}) => {
  const handleChoose = useCallback(async () => {
    if (value.length >= maxCount) {
      Taro.showToast({ title: `最多上传 ${maxCount} 张`, icon: 'none' });
      return;
    }
    try {
      const tempPath = await chooseImageTemp({ maxSizeMB, cropScale });
      onChange([...value, tempPath]);
    } catch (err) {
      if (isImageCancelError(err)) return;
      const message = err instanceof Error ? err.message : '选择图片失败';
      if (message.includes('超过') || message.includes('限制')) {
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
  }, [value, maxCount, maxSizeMB, cropScale, onChange]);

  const handleDelete = useCallback(
    async (index: number) => {
      const { confirm } = await Taro.showModal({
        title: '删除图片',
        content: '确定删除该图片吗？',
        confirmColor: '#EF4444',
      });
      if (!confirm) return;
      // 删除时同步清理被删图片的本地临时文件
      const removing = value[index];
      if (isTempImagePath(removing)) deleteTempImage(removing);
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const handlePreview = useCallback(
    (index: number) => {
      void Taro.previewImage({
        current: value[index],
        urls: value,
      });
    },
    [value],
  );

  return (
    <View className={cn('flex flex-col gap-[16rpx]', className)}>
      <View className="flex flex-row flex-wrap gap-[20rpx]">
        {value.map((url, index) => (
          <View
            key={`${url}-${index}`}
            className="w-[160rpx] h-[160rpx] rounded-[24rpx] overflow-hidden relative press-bg"
            onClick={() => handlePreview(index)}
          >
            <Image className="w-full h-full" src={url} mode="aspectFill" />
            {/* 删除按钮 */}
            <View
              className="absolute top-[8rpx] right-[8rpx] w-[40rpx] h-[40rpx] rounded-full bg-black/50 flex items-center justify-center z-10"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(index);
              }}
            >
              <Icon name="mdi-close" size={24} color="white" />
            </View>
          </View>
        ))}
        {value.length < maxCount && (
          <View
            className="w-[160rpx] h-[160rpx] rounded-[24rpx] bg-muted flex flex-col items-center justify-center gap-[8rpx] press-bg border-[2rpx] border-dashed border-border"
            onClick={handleChoose}
          >
            <Icon name="mdi-image-plus" size={48} color="muted-foreground" />
            <Text className="text-[24rpx] text-muted-foreground">{placeholder}</Text>
          </View>
        )}
      </View>
      {showCount && (
        <Text className="text-[24rpx] text-muted-foreground">
          已上传 {value.length}/{maxCount} 张，单张不超过 {maxSizeMB}M
        </Text>
      )}
    </View>
  );
};

export default ImageUploaderList;
