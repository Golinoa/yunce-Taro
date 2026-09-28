/**
 * 停课确认 —— 居中弹框
 *
 * 口径：「停课」= 只停今天这一节。
 * - 理由**选填**：填了 → 写进 LessonRecord.remark，并把理由**原文**作为停课原因通知家长
 *   （不追加任何其他文案）；不填 → 只停课，不发通知。
 * - 上限 20 字：与后端订阅消息 `changeReason` 的 20 字截断一致，避免家长收到被截半句的原因。
 *
 * 形态说明：这里用**居中弹框**（与项目 ConfirmDialog 同视觉语言），不用底部弹层 ——
 * 这是「一句确认 + 一句话输入」的短交互，居中更聚焦，也不会压住底部 tabBar。
 * 键盘弹起时整卡上移，避免输入框被键盘挡住（居中弹框不会像页面一样被系统顶上去）。
 */
import { View, Text, Input } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';

export const SUSPEND_REASON_MAX_LENGTH = 20;

export interface SuspendReasonDialogProps {
  visible: boolean;
  className: string;
  lessonDate: string;
  /** 显示用时间，如 12:59 */
  displayLessonTime: string;
  reason: string;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

const SuspendReasonDialog: React.FC<SuspendReasonDialogProps> = ({
  visible,
  className,
  lessonDate,
  displayLessonTime,
  reason,
  submitting,
  onReasonChange,
  onClose,
  onConfirm,
}) => {
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const keyboardHeight = useKeyboardHeight(mounted);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      rafRef.current = requestAnimationFrame(() => setAnimating(true));
      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
      };
    }
    setAnimating(false);
    return undefined;
  }, [visible]);

  const handleTransitionEnd = () => {
    if (!animating) setMounted(false);
  };

  if (!mounted) return null;

  const hasReason = reason.trim().length > 0;

  return (
    <View className="fixed inset-0 z-200 flex items-center justify-center px-[48rpx]">
      <View
        className={cn(
          'absolute inset-0 transition-all duration-300',
          animating ? 'bg-black/45' : 'bg-transparent',
        )}
        onClick={submitting ? undefined : onClose}
        catchMove
      />
      <View
        className={cn(
          'relative w-full max-w-[620rpx] rounded-[28rpx] bg-white px-[32rpx] pb-[28rpx] pt-[32rpx] transition-all duration-300 ease-in-out shadow-card',
          animating ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        style={
          keyboardHeight > 0
            ? { transform: `translateY(-${Math.round(keyboardHeight / 2)}px)` }
            : undefined
        }
        onTransitionEnd={handleTransitionEnd}
      >
        <Text className="block text-center text-[32rpx] font-semibold text-foreground">
          停课确认
        </Text>
        <Text className="mt-[16rpx] block text-center text-[26rpx] leading-[42rpx] text-foreground-secondary">
          只停【{className}】{lessonDate} {displayLessonTime} 这一节，其余日期照常上课。
        </Text>

        <View className="mt-[24rpx] flex items-center justify-between">
          <Text className="text-[26rpx] text-foreground">停课理由（选填）</Text>
          <Text className="text-[24rpx] text-muted-foreground">
            {reason.length}/{SUSPEND_REASON_MAX_LENGTH}
          </Text>
        </View>
        <View className="mt-[12rpx] rounded-[16rpx] border border-border bg-muted px-[20rpx] py-[16rpx]">
          <Input
            className="h-[48rpx] w-full text-[28rpx] text-foreground"
            value={reason}
            maxlength={SUSPEND_REASON_MAX_LENGTH}
            placeholder="例如：老师临时有事"
            placeholderClass="text-muted-foreground"
            onInput={(e) => onReasonChange(e.detail.value || '')}
          />
        </View>
        <Text className="mt-[12rpx] block text-[24rpx] leading-[36rpx] text-muted-foreground">
          {hasReason ? '确认后会按你填写的原文通知家长。' : '留空则只停课，不通知家长。'}
        </Text>

        <View className="mt-[28rpx] flex gap-[16rpx]">
          <View
            className={cn(
              'flex-1 h-[84rpx] rounded-[16rpx] bg-muted flex items-center justify-center',
              submitting ? 'opacity-60' : 'active:opacity-80',
            )}
            onClick={submitting ? undefined : onClose}
          >
            <Text className="text-[28rpx] font-medium text-foreground-secondary">取消</Text>
          </View>
          <View
            className={cn(
              'flex-1 h-[84rpx] rounded-[16rpx] bg-warning flex items-center justify-center',
              submitting ? 'opacity-60' : 'active:opacity-90',
            )}
            onClick={submitting ? undefined : onConfirm}
          >
            <Text className="text-[28rpx] font-semibold text-white">
              {submitting ? '处理中...' : '确认停课'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default SuspendReasonDialog;
