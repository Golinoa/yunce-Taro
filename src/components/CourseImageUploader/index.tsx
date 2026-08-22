/**
 * CourseImageUploader - 大图上传组件（统一设计语言）
 *
 * 从 course-form「课程图片」区块抽离，提供两种布局：
 * - fullWidth：整宽容器（如背景图/门店背景 750×420 横图），16:9 裁剪，占位区 320rpx 高
 * - square：方形容器（如课程封面/Logo 小图），1:1 裁剪，尺寸通过 squareSizeRpx 控制
 *
 * 与通用 ImageUploader 的区别：
 * - 中央 + 号 + 主副文案按设计稿还原（品牌主色），视觉更强
 * - 已上传图片占满整框（aspectFill），右上角悬浮删除按钮
 * - 点击图片预览大图（Taro.previewImage）
 * - 选图/裁剪是原生浮层，关闭时微信会重置页面滚动位置，通过 scrollTopRef 记录并恢复
 *
 * 大图用 fullWidth（大），小图/头像用 square（小），全局统一上传交互。
 */
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import {
  chooseImageTemp,
  deleteTempImage,
  isImageCancelError,
  isTempImagePath,
} from '@/utils/image-upload';

export interface CourseImageUploaderProps {
  /** 当前图片 URL，未上传时为空 */
  value?: string;
  /** 图片变更回调，删除时回 undefined */
  onChange: (value?: string) => void;
  /** 占位标题（如「上传背景图」） */
  title: string;
  /** 占位副标题（如「上传后可预览和更换」） */
  subtitle?: string;
  /** 布局：fullWidth=整宽容器 / square=方形容器 */
  layout?: 'fullWidth' | 'square';
  /** 方形模式的尺寸（rpx），默认 200 */
  squareSizeRpx?: number;
  /** 最大文件大小（MB），默认 5 */
  maxSizeMB?: number;
  /** 选图前记录页面滚动位置（由父组件传入的 ref），用于原生选图/裁剪浮层关闭后恢复 */
  scrollTopRef?: React.MutableRefObject<number>;
  /** 选图完成后恢复页面滚动位置 */
  onScrollRestore?: (top: number) => void;
}

const CourseImageUploader: React.FC<CourseImageUploaderProps> = ({
  value,
  onChange,
  title,
  subtitle,
  layout = 'fullWidth',
  squareSizeRpx = 200,
  maxSizeMB = 5,
  scrollTopRef,
  onScrollRestore,
}) => {
  const cropScale: keyof Taro.cropImage.CropScale = layout === 'fullWidth' ? '16:9' : '1:1';

  const handleChoose = useCallback(async () => {
    // 选图/裁剪是原生浮层（wx.chooseMedia / wx.cropImage），关闭时微信会重置内层
    // ScrollView 滚动位置导致页面跳回顶部。先记录当前位置，选图完成后再恢复。
    const savedTop = scrollTopRef?.current ?? 0;
    try {
      const tempPath = await chooseImageTemp({ maxSizeMB, cropScale });
      // 替换图片：先删掉旧的本地临时文件，避免 uploads 目录累积
      if (isTempImagePath(value)) deleteTempImage(value);
      onChange(tempPath);
      onScrollRestore?.(savedTop);
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
  }, [maxSizeMB, cropScale, onChange, scrollTopRef, onScrollRestore, value]);

  const handleDelete = useCallback(
    async (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      const { confirm } = await Taro.showModal({
        title: '删除图片',
        content: '确定删除这张图片吗？',
        confirmColor: '#EF4444',
      });
      if (!confirm) return;
      // 删除时同步清理本地临时文件
      if (isTempImagePath(value)) deleteTempImage(value);
      onChange(undefined);
    },
    [onChange, value],
  );

  const handlePreview = useCallback(() => {
    if (!value) return;
    void Taro.previewImage({ current: value, urls: [value] });
  }, [value]);

  /** 已上传：渲染图片预览 + 删除按钮，整宽模式 aspectFill 充满，square 同理 */
  if (value) {
    if (layout === 'fullWidth') {
      return (
        <View
          className="w-full h-[320rpx] rounded-[24rpx] overflow-hidden relative border-[2rpx] border-border press-scale"
          onClick={handlePreview}
        >
          <Image className="w-full h-full" src={value} mode="aspectFill" />
          <View
            className="absolute top-[16rpx] right-[16rpx] w-[56rpx] h-[56rpx] rounded-full bg-black/50 flex items-center justify-center z-10 active:opacity-70"
            onClick={handleDelete}
          >
            <Icon name="mdi-close" size={32} color="white" />
          </View>
        </View>
      );
    }
    return (
      <View
        className="rounded-[24rpx] overflow-hidden relative border-[2rpx] border-border press-scale"
        style={{ width: `${squareSizeRpx}rpx`, height: `${squareSizeRpx}rpx` }}
        onClick={handlePreview}
      >
        <Image className="w-full h-full" src={value} mode="aspectFill" />
        <View
          className="absolute top-[8rpx] right-[8rpx] w-[44rpx] h-[44rpx] rounded-full bg-black/50 flex items-center justify-center z-10 active:opacity-70"
          onClick={handleDelete}
        >
          <Icon name="mdi-close" size={26} color="white" />
        </View>
      </View>
    );
  }

  /** 未上传：按布局渲染虚线占位区 */
  if (layout === 'fullWidth') {
    return (
      <View
        className="w-full h-[320rpx] rounded-[24rpx] border-[2rpx] border-dashed border-primary/40 flex flex-col items-center justify-center gap-[12rpx] active:opacity-70 bg-primary/5"
        onClick={handleChoose}
      >
        <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary/15 flex items-center justify-center">
          <Icon name="mdi-plus" size={56} color="primary" />
        </View>
        <Text className="text-[28rpx] font-semibold text-primary">{title}</Text>
        {subtitle && <Text className="text-[24rpx] text-muted-foreground">{subtitle}</Text>}
      </View>
    );
  }
  return (
    <View
      className="rounded-[24rpx] border-[2rpx] border-dashed border-primary/40 flex flex-col items-center justify-center gap-[12rpx] active:opacity-70 bg-primary/5"
      style={{ width: `${squareSizeRpx}rpx`, height: `${squareSizeRpx}rpx` }}
      onClick={handleChoose}
    >
      <View className="w-[72rpx] h-[72rpx] rounded-full bg-primary/15 flex items-center justify-center">
        <Icon name="mdi-plus" size={42} color="primary" />
      </View>
      <Text className="text-[24rpx] font-medium text-primary">{title}</Text>
    </View>
  );
};

export default CourseImageUploader;
