/**
 * AddCustomTodoSheet - 创建待办项（检查单风格）
 *
 * 首页 FAB「记待办」入口；支持标题、描述、提醒开关、独立日期/时间选择、四象限与取消/保存。
 */
import { View, Text, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Switch from '@/components/Switch';
import TimePickerSheet from '@/components/TimePickerSheet';
import TodoQuadrantIcon from '@/components/TodoQuadrantIcon';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { TODO_QUADRANT_ORDER } from '@/types/todo-quadrant';

export interface AddCustomTodoSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    note?: string;
    remindEnabled: boolean;
    remindDate?: string;
    remindTime?: string;
    quadrant?: TodoQuadrant;
  }) => Promise<void>;
}

const AddCustomTodoSheet: React.FC<AddCustomTodoSheetProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [remindEnabled, setRemindEnabled] = useState(true);
  const [remindDate, setRemindDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [remindTime, setRemindTime] = useState(dayjs().add(30, 'minute').format('HH:mm'));
  const [quadrant, setQuadrant] = useState<TodoQuadrant>('q2');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setNote('');
    setRemindEnabled(true);
    setRemindDate(dayjs().format('YYYY-MM-DD'));
    setRemindTime(dayjs().add(30, 'minute').format('HH:mm'));
    setQuadrant('q2');
    setSubmitting(false);
  }, [visible]);

  const remindDateTime = useMemo(
    () => dayjs(`${remindDate} ${remindTime}`),
    [remindDate, remindTime],
  );

  const relativeLabel = useMemo(() => {
    if (!remindEnabled) return null;
    const diffMin = remindDateTime.diff(dayjs(), 'minute');
    if (diffMin <= 0) return '已到提醒时间';
    if (diffMin < 60) return `${diffMin}分钟后`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour}小时后`;
  }, [remindDateTime, remindEnabled]);

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Taro.showToast({ title: '请填写标题', icon: 'none' });
      return;
    }
    if (trimmedTitle.length > 50) {
      Taro.showToast({ title: '标题不超过50字', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: trimmedTitle,
        note: note.trim() || undefined,
        remindEnabled,
        remindDate: remindEnabled ? remindDate : undefined,
        remindTime: remindEnabled ? remindTime : undefined,
        quadrant,
      });
      onClose();
    } catch {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [note, onClose, onSubmit, quadrant, remindDate, remindEnabled, remindTime, title]);

  return (
    <>
      <BottomSheet
        visible={visible}
        title="创建待办项"
        onClose={onClose}
        height="auto"
        maxHeightLimit="82vh"
        scrollable={false}
      >
        <View className="px-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))]">
          <View className="rounded-[24rpx] border border-border bg-muted/30 px-[24rpx] py-[20rpx]">
            <FormInput
              variant="ghost"
              placeholder="标题"
              value={title}
              maxlength={50}
              onInput={(event) => setTitle(event.detail.value || '')}
              inputClassName="text-[32rpx] font-semibold w-full"
              inputStyle={{ textAlign: 'left', height: '48rpx', minHeight: '48rpx' }}
              className="mb-0"
            />
            <View className="my-[16rpx] h-[2rpx] bg-border" />
            <Textarea
              className="w-full text-[28rpx] text-foreground min-h-[120rpx]"
              placeholder="待办描述"
              placeholderClass="text-muted-foreground"
              maxlength={200}
              value={note}
              onInput={(event) => setNote(event.detail.value || '')}
            />
          </View>

          <View className="mt-[24rpx] flex flex-row flex-wrap gap-[16rpx]">
            <View className="flex flex-row items-center gap-[8rpx] rounded-full bg-card border border-border px-[20rpx] py-[12rpx]">
              <Icon name="mdi-inbox" size="xs" color="warning" />
              <Text className="text-[24rpx] text-foreground">收件箱</Text>
            </View>
          </View>

          <View className="mt-[20rpx] flex flex-row items-center justify-between rounded-[20rpx] border border-border bg-card px-[24rpx] py-[18rpx]">
            <View className="flex flex-row items-center gap-[10rpx]">
              <Icon name="mdi-bell-outline" size="sm" color="primary" />
              <Text className="text-[28rpx] text-foreground">提醒</Text>
            </View>
            <Switch checked={remindEnabled} onChange={setRemindEnabled} />
          </View>

          {remindEnabled && (
            <View className="mt-[16rpx]">
              <View className="flex flex-row gap-[16rpx]">
                <View
                  className="flex-1 flex flex-row items-center justify-center gap-[8rpx] todo-remind-chip px-[16rpx] py-[14rpx] press-bg"
                  onClick={() => setDatePickerVisible(true)}
                >
                  <Icon name="mdi-calendar" size="xs" color="primary" />
                  <Text className="text-[26rpx] font-medium text-foreground">
                    {dayjs(remindDate).format('YYYY-MM-DD')}
                  </Text>
                </View>
                <View
                  className="flex-1 flex flex-row items-center justify-center gap-[8rpx] todo-remind-chip px-[16rpx] py-[14rpx] press-bg"
                  onClick={() => setTimePickerVisible(true)}
                >
                  <Icon name="mdi-clock-outline" size="xs" color="primary" />
                  <Text className="text-[26rpx] font-medium text-foreground">{remindTime}</Text>
                </View>
              </View>
              {relativeLabel && (
                <Text className="mt-[10rpx] text-[22rpx] text-warning">{relativeLabel}</Text>
              )}
            </View>
          )}

          <View className="mt-[24rpx] flex flex-row gap-[16rpx]">
            {TODO_QUADRANT_ORDER.map((option) => (
              <View
                key={option}
                className={cn(
                  'flex-1 rounded-[16rpx] border py-[18rpx] center press-scale',
                  quadrant === option
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card',
                )}
                onClick={() => setQuadrant(option)}
              >
                <TodoQuadrantIcon quadrant={option} size="md" />
              </View>
            ))}
          </View>

          <View className="mt-[32rpx] flex flex-row gap-[20rpx]">
            <View
              className="flex-1 h-[88rpx] rounded-[20rpx] bg-muted center press-scale"
              onClick={onClose}
            >
              <Text className="text-[30rpx] font-medium text-foreground">取消</Text>
            </View>
            <View
              className={cn(
                'flex-1 h-[88rpx] rounded-[20rpx] center press-scale',
                submitting ? 'bg-muted' : 'bg-primary',
              )}
              onClick={submitting ? undefined : handleSubmit}
            >
              <Text className="text-[30rpx] font-semibold text-white">
                {submitting ? '保存中...' : '保存'}
              </Text>
            </View>
          </View>
        </View>
      </BottomSheet>

      <DatePickerSheet
        visible={datePickerVisible}
        value={remindDate}
        title="选择提醒日期"
        onClose={() => setDatePickerVisible(false)}
        onConfirm={setRemindDate}
      />

      <TimePickerSheet
        visible={timePickerVisible}
        value={remindTime}
        title="选择提醒时间"
        onClose={() => setTimePickerVisible(false)}
        onConfirm={setRemindTime}
      />
    </>
  );
};

export default AddCustomTodoSheet;
