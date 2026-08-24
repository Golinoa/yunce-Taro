/**
 * AddNoteSheet - 记笔记弹层
 *
 * 首页 FAB「记笔记」入口；快速记录文字笔记并保存到本地「我的笔记」。
 */
import { View, Text, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import type { NoteTagColor } from '@/utils/user-notes';

export interface AddNoteSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: { content: string; folder?: string; tagColor?: NoteTagColor }) => Promise<void>;
}

const TAG_OPTIONS: NoteTagColor[] = ['default', 'primary', 'accent', 'warning'];

const AddNoteSheet: React.FC<AddNoteSheetProps> = ({ visible, onClose, onSubmit }) => {
  const [content, setContent] = useState('');
  const [tagColor, setTagColor] = useState<NoteTagColor>('default');
  const [submitting, setSubmitting] = useState(false);
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm');

  useEffect(() => {
    if (!visible) return;
    setContent('');
    setTagColor('default');
    setSubmitting(false);
  }, [visible]);

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      Taro.showToast({ title: '请输入笔记内容', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ content: trimmed, folder: '收件箱', tagColor });
      onClose();
    } catch {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [content, onClose, onSubmit, tagColor]);

  return (
    <BottomSheet
      visible={visible}
      title="记笔记"
      onClose={onClose}
      height="auto"
      maxHeightLimit="78vh"
      scrollable={false}
    >
      <View className="px-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))]">
        <View className="flex flex-row items-center justify-between mb-[20rpx]">
          <View className="flex flex-row items-center gap-[8rpx] rounded-full bg-card border border-border px-[20rpx] py-[10rpx]">
            <Icon name="mdi-inbox" size="xs" color="warning" />
            <Text className="text-[24rpx] text-foreground">收件箱</Text>
          </View>
          <View
            className={cn(
              'rounded-full px-[28rpx] py-[10rpx] press-scale',
              submitting ? 'bg-muted' : 'bg-primary/15',
            )}
            onClick={submitting ? undefined : handleSubmit}
          >
            <Text className={cn('text-[26rpx] font-medium', submitting ? 'text-muted-foreground' : 'text-primary')}>
              {submitting ? '保存中...' : '保存'}
            </Text>
          </View>
        </View>

        <View className="rounded-[20rpx] bg-primary/8 border border-primary/15 px-[20rpx] py-[12rpx] mb-[20rpx]">
          <Text className="text-[22rpx] text-primary">📝 {timestamp}</Text>
        </View>

        <View className="rounded-[24rpx] border border-border bg-card px-[24rpx] py-[20rpx] min-h-[320rpx]">
          <Textarea
            className="w-full text-[30rpx] text-foreground min-h-[280rpx]"
            placeholder="好记性不如烂笔头 ~"
            placeholderClass="text-muted-foreground"
            maxlength={2000}
            value={content}
            onInput={(event) => setContent(event.detail.value || '')}
            focus={visible}
          />
        </View>

        <View className="mt-[24rpx] flex flex-row gap-[16rpx]">
          {TAG_OPTIONS.map((option) => (
            <View
              key={option}
              className={cn(
                'flex-1 rounded-[16rpx] border py-[16rpx] center press-scale',
                tagColor === option ? 'border-primary bg-primary/10' : 'border-border bg-card',
              )}
              onClick={() => setTagColor(option)}
            >
              <Icon
                name="mdi-checkbox-multiple-marked-outline"
                size="sm"
                color={
                  option === 'primary'
                    ? 'primary'
                    : option === 'accent'
                      ? 'accent'
                      : option === 'warning'
                        ? 'warning'
                        : 'muted'
                }
              />
            </View>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
};

export default AddNoteSheet;
