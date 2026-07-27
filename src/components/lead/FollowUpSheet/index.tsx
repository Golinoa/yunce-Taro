import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import { FOLLOW_UP_ACTION_META, INTENT_LEVEL_META } from '@/constants/lead';
import type { FollowUpAction, IntentLevel } from '@/types/lead';

/**
 * FollowUpSheet - 跟进记录弹窗
 *
 * 选择跟进动作、意向等级、填写跟进内容，提交后创建跟进记录。
 */

export interface FollowUpSheetProps {
  visible: boolean;
  /** 提交回调 */
  onSubmit: (params: {
    action: FollowUpAction;
    intentLevel: IntentLevel;
    content: string;
    nextFollowUpAt?: string;
  }) => void;
  onClose: () => void;
  className?: string;
}

const ACTION_OPTIONS = Object.entries(FOLLOW_UP_ACTION_META).map(([key, meta]) => ({
  value: key as FollowUpAction,
  label: meta.label,
}));

const INTENT_OPTIONS = Object.entries(INTENT_LEVEL_META).map(([key, meta]) => ({
  value: key as IntentLevel,
  label: meta.label,
  color: meta.badgeClassName,
}));

/** 常用跟进提醒天数 */
const REMINDER_DAY_OPTIONS = [1, 3, 7, 14, 30];

const FollowUpSheet: React.FC<FollowUpSheetProps> = ({ visible, onSubmit, onClose, className }) => {
  const [selectedAction, setSelectedAction] = useState<FollowUpAction>('phone_call');
  const [selectedIntent, setSelectedIntent] = useState<IntentLevel>('medium');
  const [content, setContent] = useState('');
  /** 下次跟进天数，null 表示不提醒 */
  const [nextFollowUpDays, setNextFollowUpDays] = useState<number | null>(3);

  const handleSubmit = useCallback(() => {
    if (!content.trim()) {
      return;
    }
    onSubmit({
      action: selectedAction,
      intentLevel: selectedIntent,
      content: content.trim(),
      nextFollowUpAt:
        nextFollowUpDays !== null ? dayjs().add(nextFollowUpDays, 'day').toISOString() : undefined,
    });
    // 重置
    setContent('');
    setNextFollowUpDays(3);
  }, [selectedAction, selectedIntent, content, nextFollowUpDays, onSubmit]);

  const handleClose = useCallback(() => {
    setContent('');
    setNextFollowUpDays(3);
    onClose();
  }, [onClose]);

  return (
    <BottomSheet visible={visible} title="添加跟进" onClose={handleClose}>
      <View className={cn('px-[40rpx] pb-[60rpx] pt-[12rpx]', className)}>
        {/* 跟进动作选择 */}
        <Text className="text-[26rpx] text-muted-foreground mb-2">跟进方式</Text>
        <View className="flex flex-wrap gap-2 mb-6">
          {ACTION_OPTIONS.map((opt) => (
            <View
              key={opt.value}
              className={cn(
                'px-[24rpx] py-[12rpx] rounded-full border-2',
                selectedAction === opt.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-white',
              )}
              onClick={() => setSelectedAction(opt.value)}
            >
              <Text
                className={cn(
                  'text-[24rpx]',
                  selectedAction === opt.value
                    ? 'text-primary font-medium'
                    : 'text-foreground-secondary',
                )}
              >
                {opt.label}
              </Text>
            </View>
          ))}
        </View>

        {/* 意向等级选择 */}
        <Text className="text-[26rpx] text-muted-foreground mb-2">意向等级</Text>
        <View className="flex gap-2 mb-6">
          {INTENT_OPTIONS.map((opt) => (
            <View
              key={opt.value}
              className={cn(
                'flex-1 py-[16rpx] rounded-[16rpx] center border-2',
                selectedIntent === opt.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-white',
              )}
              onClick={() => setSelectedIntent(opt.value)}
            >
              <View className="flex items-center gap-1">
                <View className={cn('w-[16rpx] h-[16rpx] rounded-full', opt.color)} />
                <Text
                  className={cn(
                    'text-[24rpx]',
                    selectedIntent === opt.value
                      ? 'text-primary font-medium'
                      : 'text-foreground-secondary',
                  )}
                >
                  {opt.label}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* 跟进内容 */}
        <FormInput
          label="跟进内容"
          placeholder="请输入跟进内容"
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          multiline
          maxlength={500}
        />

        {/* 下次跟进提醒 */}
        <View className="mb-6">
          <Text className="text-[26rpx] text-muted-foreground mb-2">下次跟进提醒</Text>
          <View className="flex flex-wrap gap-2">
            {REMINDER_DAY_OPTIONS.map((days) => (
              <View
                key={days}
                className={cn(
                  'px-[24rpx] py-[12rpx] rounded-full border-2',
                  nextFollowUpDays === days
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-white',
                )}
                onClick={() => setNextFollowUpDays(days)}
              >
                <Text
                  className={cn(
                    'text-[24rpx]',
                    nextFollowUpDays === days
                      ? 'text-primary font-medium'
                      : 'text-foreground-secondary',
                  )}
                >
                  {days}天后
                </Text>
              </View>
            ))}
            <View
              className={cn(
                'px-[24rpx] py-[12rpx] rounded-full border-2',
                nextFollowUpDays === null
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-white',
              )}
              onClick={() => setNextFollowUpDays(null)}
            >
              <Text
                className={cn(
                  'text-[24rpx]',
                  nextFollowUpDays === null
                    ? 'text-primary font-medium'
                    : 'text-foreground-secondary',
                )}
              >
                不提醒
              </Text>
            </View>
          </View>
          {nextFollowUpDays !== null && (
            <Text className="text-[22rpx] text-muted-foreground mt-2">
              预计提醒日期：{dayjs().add(nextFollowUpDays, 'day').format('YYYY-MM-DD')}
            </Text>
          )}
        </View>

        {/* 提交按钮 */}
        <View
          className={cn(
            'mt-6 py-[24rpx] rounded-full center',
            content.trim() ? 'bg-gradient-primary' : 'bg-muted',
          )}
          onClick={content.trim() ? handleSubmit : undefined}
        >
          <Text
            className={cn(
              'text-[28rpx] font-medium',
              content.trim() ? 'text-white' : 'text-muted-foreground',
            )}
          >
            确认提交
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default FollowUpSheet;
