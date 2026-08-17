/**
 * EvaluateSheet - 课程评价底部弹窗
 *
 * 用于「我的课程」待评价课程，支持星级评分 + 文字评价。
 * 弹窗必须封装为独立组件，BottomSheet 只传 visible。
 */
import { View, Text, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import StarRating from '@/components/StarRating';

export interface EvaluateSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 课程名称 */
  courseName: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 提交回调，参数为评分和评价内容 */
  onSubmit: (payload: { rating: number; content: string }) => void | Promise<void>;
}

const CONTENT_MAX_LENGTH = 200;

const EvaluateSheet: React.FC<EvaluateSheetProps> = ({
  visible,
  courseName,
  onClose,
  onSubmit,
}) => {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  const handleSubmit = useCallback(async () => {
    if (rating <= 0) {
      Taro.showToast({ title: '请选择评分', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ rating, content: content.trim() });
      setRating(5);
      setContent('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [rating, content, onSubmit, onClose]);

  return (
    <BottomSheet
      visible={visible}
      title="课程评价"
      onClose={handleClose}
      height="auto"
      maxHeightLimit="80vh"
      scrollable={false}
    >
      <View className="px-[32rpx] pb-[48rpx] pt-[16rpx]">
        {/* 课程名 */}
        <Text className="text-[28rpx] text-muted-foreground mb-[32rpx] block">
          评价课程：{courseName}
        </Text>

        {/* 星级评分 */}
        <View className="flex items-center justify-between mb-[32rpx]">
          <Text className="text-[30rpx] font-semibold text-foreground">评分</Text>
          <View className="flex items-center gap-[16rpx]">
            <StarRating value={rating} onChange={setRating} />
            <Text className="text-[32rpx] font-bold text-warning w-[80rpx] text-right">
              {rating.toFixed(1)}
            </Text>
          </View>
        </View>

        {/* 评价内容 */}
        <View className="mb-[40rpx]">
          <Text className="text-[30rpx] font-semibold text-foreground mb-[16rpx] block">
            评价内容
          </Text>
          <View className="relative p-[24rpx] rounded-[20rpx] bg-primary-5 border-[2rpx] border-border-light">
            <Textarea
              className="w-full text-[30rpx] text-foreground bg-transparent leading-relaxed"
              style={{ minHeight: '180rpx', height: '180rpx' }}
              placeholder="请输入您对课程的评价（选填）"
              placeholderClass="input-placeholder"
              value={content}
              onInput={(e) => setContent(e.detail.value)}
              maxlength={CONTENT_MAX_LENGTH}
            />
            <Text className="absolute right-[20rpx] bottom-[16rpx] text-[22rpx] text-muted-foreground">
              {content.length}/{CONTENT_MAX_LENGTH}
            </Text>
          </View>
        </View>

        {/* 提交按钮 */}
        <View
          className={cn(
            'h-[92rpx] rounded-[28rpx] bg-gradient-primary center press-scale',
            submitting && 'opacity-60',
          )}
          onClick={submitting ? undefined : handleSubmit}
        >
          <Text className="text-[32rpx] font-bold text-white">
            {submitting ? '提交中...' : '提交评价'}
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default EvaluateSheet;
