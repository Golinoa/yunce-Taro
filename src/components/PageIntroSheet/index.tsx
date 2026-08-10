/**
 * 页面介绍弹窗组件 PageIntroSheet
 *
 * 用于新页面首次进入时的功能说明 / 步骤引导。
 * 支持：步骤标签、标题、正文、要点列表、"不再提示" 复选框、"我知道了" 按钮。
 * 主题色跟随项目主色 primary。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Dialog from '@/components/Dialog';
import Icon from '@/components/Icon';

export interface PageIntroSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 当前步骤，例如 1 */
  currentStep?: number;
  /** 总步骤数，例如 6 */
  totalSteps?: number;
  /** 自定义步骤标签（优先级高于 currentStep/totalSteps） */
  stepLabel?: string;
  /** 标题 */
  title: string;
  /** 正文段落 */
  description: string;
  /** 要点列表（带圆点） */
  bulletPoints?: string[];
  /** 存储 key，用于记录"不再提示" */
  storageKey: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 主题色，默认 primary */
  themeColor?: 'primary' | 'warning';
}

const PageIntroSheet: React.FC<PageIntroSheetProps> = ({
  visible,
  currentStep,
  totalSteps,
  stepLabel: stepLabelProp,
  title,
  description,
  bulletPoints,
  storageKey,
  onClose,
  confirmText = '我知道了',
  themeColor = 'primary',
}) => {
  const [noMore, setNoMore] = useState(false);

  const stepLabel = useMemo(() => {
    if (stepLabelProp) return stepLabelProp;
    if (currentStep && totalSteps) return `STEP ${currentStep}/${totalSteps}`;
    return '';
  }, [stepLabelProp, currentStep, totalSteps]);

  useEffect(() => {
    if (!visible) return;
    try {
      const stored = Taro.getStorageSync(storageKey);
      setNoMore(stored === true);
    } catch {
      setNoMore(false);
    }
  }, [visible, storageKey]);

  const handleConfirm = useCallback(() => {
    try {
      Taro.setStorageSync(storageKey, noMore);
    } catch {
      /* ignore */
    }
    onClose();
  }, [noMore, storageKey, onClose]);

  const isWarning = themeColor === 'warning';

  return (
    <Dialog visible={visible} onClose={onClose}>
      <View className="w-[620rpx] max-w-[86vw] max-h-[80vh] rounded-[32rpx] bg-white overflow-hidden relative">
        {/* 顶部主题色头部区域 */}
        <View
          className={cn(
            'relative px-[36rpx] pt-[40rpx] pb-[36rpx] overflow-hidden',
            isWarning ? 'bg-warning/10' : 'bg-primary/10',
          )}
        >
          {/* 装饰圆形 */}
          <View
            className={cn(
              'absolute -top-[80rpx] -right-[60rpx] w-[260rpx] h-[260rpx] rounded-full pointer-events-none',
              isWarning ? 'bg-warning/12' : 'bg-primary/12',
            )}
          />
          <View
            className={cn(
              'absolute top-[40rpx] right-[120rpx] w-[120rpx] h-[120rpx] rounded-full pointer-events-none',
              isWarning ? 'bg-warning/8' : 'bg-primary/8',
            )}
          />

          {/* 步骤标签 */}
          {stepLabel && (
            <View className="relative mb-[20rpx]">
              <View
                className={cn(
                  'inline-flex px-[20rpx] py-[6rpx] rounded-[24rpx]',
                  isWarning ? 'bg-warning' : 'bg-primary',
                )}
              >
                <Text className="text-[22rpx] font-semibold text-white tracking-wider">
                  {stepLabel}
                </Text>
              </View>
            </View>
          )}

          {/* 标题 */}
          <Text className="relative text-[40rpx] font-bold text-foreground leading-tight">
            {title}
          </Text>
        </View>

        {/* 正文内容区 */}
        <View className="px-[32rpx] pt-[28rpx] pb-[40rpx]">
          <ScrollView scrollY className="max-h-[42vh]">
            {/* 描述 */}
            <Text className="text-[28rpx] text-foreground leading-relaxed mb-[28rpx]">
              {description}
            </Text>

            {/* 要点卡片 */}
            {bulletPoints && bulletPoints.length > 0 && (
              <View className="bg-muted/50 rounded-[24rpx] p-[28rpx] mb-[32rpx]">
                <View className="flex flex-col gap-[20rpx]">
                  {bulletPoints.map((point, index) => (
                    <View key={index} className="flex flex-row items-start gap-[14rpx]">
                      <View
                        className={cn(
                          'mt-[12rpx] w-[10rpx] h-[10rpx] rounded-full shrink-0',
                          isWarning ? 'bg-warning' : 'bg-primary',
                        )}
                      />
                      <Text className="text-[28rpx] text-foreground leading-relaxed">{point}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* 不再提示 */}
          <View
            className="flex flex-row items-center gap-[12rpx] mb-[28rpx] press-bg self-start"
            onClick={() => setNoMore((prev) => !prev)}
          >
            <View
              className={cn(
                'w-[36rpx] h-[36rpx] rounded-[8rpx] border-[3rpx] flex items-center justify-center bg-white',
                noMore
                  ? isWarning
                    ? 'border-warning bg-warning'
                    : 'border-primary bg-primary'
                  : 'border-foreground/40',
              )}
            >
              {noMore && <Icon name="mdi-check" size={22} color="white" />}
            </View>
            <Text className="text-[26rpx] text-muted-foreground">不再提示此页面介绍</Text>
          </View>

          {/* 确认按钮 */}
          <View
            className={cn(
              'w-full rounded-[48rpx] py-[26rpx] flex items-center justify-center press-scale',
              isWarning ? 'bg-warning' : 'bg-primary',
            )}
            onClick={handleConfirm}
          >
            <Text className="text-[32rpx] font-semibold text-white">{confirmText}</Text>
          </View>
        </View>
      </View>
    </Dialog>
  );
};

export default PageIntroSheet;
