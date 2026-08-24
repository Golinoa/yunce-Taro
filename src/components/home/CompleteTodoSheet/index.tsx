/**
 * CompleteTodoSheet - 完成待办时填写备注
 *
 * 使用场景：协同运营待办（续费提醒等）点完成时，记录完成人与备注。
 */
import { View, Text, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { TodoItem } from '@/types/home-todo';

export interface CompleteTodoSheetProps {
  visible: boolean;
  item: TodoItem | null;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}

const CompleteTodoSheet: React.FC<CompleteTodoSheetProps> = ({
  visible,
  item,
  onClose,
  onSubmit,
}) => {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requireNote = item?.sharedScope === 'campus_ops';

  useEffect(() => {
    if (!visible) return;
    setNote('');
    setSubmitting(false);
  }, [visible, item?.id]);

  const handleSubmit = useCallback(async () => {
    const trimmed = note.trim();
    if (requireNote && !trimmed) {
      Taro.showToast({ title: '请填写处理备注', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch {
      Taro.showToast({ title: '操作失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [note, onClose, onSubmit, requireNote]);

  return (
    <BottomSheet visible={visible} title="完成待办" onClose={onClose} height="auto" scrollable={false}>
      <View className="px-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))]">
        {item && (
          <Text className="text-[28rpx] text-foreground font-medium block mb-[16rpx]">{item.title}</Text>
        )}
        <Text className="text-[24rpx] text-muted-foreground block mb-[12rpx]">
          {requireNote ? '处理备注（必填，同步给管理员/校长）' : '处理备注（选填）'}
        </Text>
        <Textarea
          className="w-full min-h-[160rpx] rounded-[20rpx] bg-muted px-[24rpx] py-[20rpx] text-[28rpx] text-foreground"
          placeholder="简要说明处理情况…"
          maxlength={200}
          value={note}
          onInput={(event) => setNote(event.detail.value)}
        />
        <View
          className="mt-[24rpx] rounded-full bg-primary py-[22rpx] center press-scale"
          onClick={submitting ? undefined : handleSubmit}
        >
          <Text className="text-[28rpx] font-medium text-white">{submitting ? '提交中…' : '确认完成'}</Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default CompleteTodoSheet;
