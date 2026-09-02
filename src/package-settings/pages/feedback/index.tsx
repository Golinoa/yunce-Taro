/**
 * 意见反馈页 pages/feedback/index
 * 包含：反馈内容输入、图片上传（可选最多3张）、提交
 */
import { View, Text, Textarea, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback } from 'react';
import ActionButton from '@/components/ActionButton';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { feedbackService, uploadService } from '@/services';
import type { FeedbackType } from '@/services/feedback';
import { useAuth } from '@/utils/auth';
import { chooseImageTemp } from '@/utils/image-upload';
import { usePrimaryNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';
import { runImageUploadFlow } from '@/utils/upload-flow';

const MAX_IMAGES = 3;
const MAX_CONTENT_LENGTH = 500;
const FEEDBACK_TYPE_OPTIONS: Array<{ label: string; value: FeedbackType }> = [
  { label: '问题反馈', value: 'BUG' },
  { label: '功能建议', value: 'FEATURE' },
  { label: '其他意见', value: 'OTHER' },
];

const Feedback: React.FC = () => {
  usePrimaryNavigationBar();
  const { profile } = useAuth();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('OTHER');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 选择并上传图片（统一流程：chooseMedia + 隐私预检 + 压缩；取消静默、失败有提示）
  const handleAddImage = useCallback(async () => {
    await runImageUploadFlow({
      currentCount: images.length,
      maxCount: MAX_IMAGES,
      choose: () => chooseImageTemp({ maxSizeMB: 5, cropScale: '1:1' }),
      upload: async (path) => {
        const result = await uploadService.upload(path, { type: 'feedback' });
        return result.url;
      },
      onSuccess: (url) => setImages((prev) => [...prev, url]),
      onUploadingChange: setUploading,
    });
  }, [images.length]);

  // 删除图片
  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 提交反馈
  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      Taro.showToast({ title: '请填写反馈内容', icon: 'none' });
      return;
    }
    if (!profile?.id) {
      Taro.showToast({ title: '未登录', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const ok = await feedbackService.create({
        user_id: profile.id,
        role: profile.currentContext?.role || 'teacher',
        type: feedbackType,
        content: trimmed,
        images,
        contact: contact.trim() || undefined,
      });
      if (ok) {
        Taro.showToast({ title: '提交成功，感谢您的反馈', icon: 'success' });
        setFeedbackType('OTHER');
        setContent('');
        setContact('');
        setImages([]);
        setTimeout(() => Taro.navigateBack(), 1500);
      } else {
        Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
      }
    } catch (err) {
      console.error('[Feedback] submit failed:', err);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [contact, content, feedbackType, images, profile]);

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-gradient-subtle pb-40">
        {/* ====== 顶部标题区 ====== */}
        <View className="bg-gradient-primary px-6 pt-8 pb-10 rounded-b-60rpx shadow-elegant relative overflow-hidden">
          <View className="absolute top-4 right-4 w-24 h-24 rounded-full bg-primary-foreground/10 blur-xl" />
          <View className="relative z-1">
            <Text className="text-primary-foreground text-[40rpx] font-bold block">使用反馈</Text>
            <Text className="text-primary-foreground/70 text-md block mt-1">
              遇到问题或建议？欢迎随时反馈
            </Text>
          </View>
        </View>

        {/* ====== 表单区域 ====== */}
        <View className="px-6 -mt-4 relative z-2">
          <View className="bg-card rounded-lg shadow-soft p-5">
            <View className="flex items-center gap-[12rpx] mb-3">
              <Text className="text-xl">✍</Text>
              <Text className="text-lg font-semibold text-foreground">填写反馈</Text>
            </View>

            <View className="mb-4">
              <Text className="text-md text-muted-foreground font-medium block mb-2">反馈类型</Text>
              <View className="flex gap-3">
                {FEEDBACK_TYPE_OPTIONS.map((option) => (
                  <View
                    key={option.value}
                    className={`flex-1 py-3 rounded-full border text-center ${
                      feedbackType === option.value
                        ? 'bg-primary border-primary'
                        : 'bg-background border-input'
                    }`}
                    onClick={() => setFeedbackType(option.value)}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        feedbackType === option.value
                          ? 'text-primary-foreground'
                          : 'text-foreground'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 多行文本输入 */}
            <View className="border-2 border-input rounded-lg py-[20rpx] px-[28rpx] bg-background shadow-soft overflow-hidden">
              <Textarea
                className="w-full text-lg text-foreground bg-transparent leading-normal min-h-[240rpx]"
                placeholder="请描述您遇到的问题或建议..."
                value={content}
                onInput={(e) => setContent(e.detail.value || '')}
                maxlength={MAX_CONTENT_LENGTH}
                autoHeight
              />
            </View>
            <View className="text-right mt-1 mb-3">
              <Text className="text-sm text-muted-foreground">
                {content.length}/{MAX_CONTENT_LENGTH}
              </Text>
            </View>

            {/* 图片上传 */}
            <View className="mt-1">
              <Text className="text-md text-muted-foreground font-medium block mb-2">
                上传截图（可选，最多{MAX_IMAGES}张）
              </Text>
              <View className="flex flex-wrap gap-2_d5">
                {images.map((src, idx) => (
                  <View
                    key={idx}
                    className="relative w-[160rpx] h-[160rpx] rounded-md overflow-hidden shadow-soft"
                  >
                    <Image className="w-full h-full" src={src} mode="aspectFill" lazyLoad />
                    <View
                      className="absolute top-0 right-0 w-[40rpx] h-[40rpx] bg-destructive/80 rounded-bl-sm flex items-center justify-center"
                      onClick={() => handleRemoveImage(idx)}
                    >
                      <Text className="text-primary-foreground text-[22rpx]">✕</Text>
                    </View>
                  </View>
                ))}
                {images.length < MAX_IMAGES && (
                  <View
                    className="w-[160rpx] h-[160rpx] rounded-md border-2 border-dashed border-input flex flex-col items-center justify-center gap-1 active:bg-muted"
                    onClick={handleAddImage}
                  >
                    <Icon name="mdi-camera" size="md" color="muted" />
                    <Text className="text-[22rpx] text-muted-foreground">
                      {uploading ? '上传中...' : '添加'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-md text-muted-foreground font-medium block mb-2">
                联系方式（可选）
              </Text>
              <FormInput
                placeholder="手机号、微信号或邮箱，便于我们联系您"
                value={contact}
                onInput={(e) => setContact(e.detail.value || '')}
                className="mb-0"
              />
            </View>
          </View>
        </View>

        {/* ====== 底部提交按钮 ====== */}
        <ActionButton
          text={submitting ? '提交中...' : '提交反馈'}
          onClick={handleSubmit}
          disabled={submitting}
        />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(Feedback);
