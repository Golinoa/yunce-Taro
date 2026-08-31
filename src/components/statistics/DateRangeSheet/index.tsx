/**
 * DateRangeSheet - 自定义日期区间选择弹窗
 * 通过 BottomSheet 展示，使用 DatePickerSheet 选择起止日期
 */
import { View, Text } from '@tarojs/components';
import React, { useState, useEffect } from 'react';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';

interface DateRangeSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 初始开始日期 */
  startDate: string;
  /** 初始结束日期 */
  endDate: string;
  /** 确认回调 */
  onConfirm: (start: string, end: string) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/** 获取今天的日期字符串 YYYY-MM-DD */
function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DateRangeSheet: React.FC<DateRangeSheetProps> = ({
  visible,
  startDate,
  endDate,
  onConfirm,
  onClose,
}) => {
  const [start, setStart] = useState(startDate || '');
  const [end, setEnd] = useState(endDate || '');
  const [datePickerField, setDatePickerField] = useState<'start' | 'end' | null>(null);

  // 弹窗打开时同步外部值
  useEffect(() => {
    if (visible) {
      setStart(startDate || '');
      setEnd(endDate || '');
      setDatePickerField(null);
    }
  }, [visible, startDate, endDate]);

  const todayStr = getTodayStr();
  const canConfirm = start && end && start <= end;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(start, end);
    }
  };

  return (
    <>
      <BottomSheet visible={visible} title="自定义区间" onClose={onClose} maxHeight="60vh">
        <View className="px-[32rpx] py-[24rpx]">
          {/* 开始日期 */}
          <View className="mb-[32rpx]">
            <Text className="text-[26rpx] text-muted-foreground block mb-[12rpx]">开始日期</Text>
            <View
              className="bg-muted/30 rounded-[16rpx] px-[24rpx] py-[24rpx] flex items-center justify-between"
              onClick={() => setDatePickerField('start')}
            >
              <Text
                className={`text-[28rpx] ${start ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {start || '请选择开始日期'}
              </Text>
              <Text className="text-[24rpx] text-muted-foreground">点击选择</Text>
            </View>
          </View>

          {/* 结束日期 */}
          <View className="mb-[32rpx]">
            <Text className="text-[26rpx] text-muted-foreground block mb-[12rpx]">结束日期</Text>
            <View
              className="bg-muted/30 rounded-[16rpx] px-[24rpx] py-[24rpx] flex items-center justify-between"
              onClick={() => setDatePickerField('end')}
            >
              <Text className={`text-[28rpx] ${end ? 'text-foreground' : 'text-muted-foreground'}`}>
                {end || '请选择结束日期'}
              </Text>
              <Text className="text-[24rpx] text-muted-foreground">点击选择</Text>
            </View>
          </View>

          {/* 区间预览 */}
          {start && end && (
            <View className="bg-primary/5 rounded-[16rpx] px-[24rpx] py-[20rpx] mb-[32rpx]">
              <Text className="text-[26rpx] text-primary">
                已选区间：{start} ~ {end}
              </Text>
            </View>
          )}

          {/* 错误提示 */}
          {start && end && !canConfirm && (
            <View className="bg-destructive/5 rounded-[16rpx] px-[24rpx] py-[16rpx] mb-[32rpx]">
              <Text className="text-[24rpx] text-destructive">结束日期不能早于开始日期</Text>
            </View>
          )}

          {/* 操作按钮 */}
          <View className="flex gap-[24rpx]">
            <View
              className="flex-1 py-[24rpx] rounded-[24rpx] bg-muted text-center"
              onClick={onClose}
            >
              <Text className="text-[28rpx] text-foreground-secondary">取消</Text>
            </View>
            <View
              className={`flex-1 py-[24rpx] rounded-[24rpx] text-center transition-all ${
                canConfirm ? 'bg-primary' : 'bg-muted'
              }`}
              onClick={handleConfirm}
            >
              <Text
                className={`text-[28rpx] ${canConfirm ? 'text-primary-foreground' : 'text-muted-foreground'}`}
              >
                确认
              </Text>
            </View>
          </View>
        </View>
      </BottomSheet>

      <DatePickerSheet
        visible={Boolean(datePickerField)}
        title={datePickerField === 'end' ? '选择结束日期' : '选择开始日期'}
        value={datePickerField === 'end' ? end || todayStr : start || todayStr}
        onClose={() => setDatePickerField(null)}
        onConfirm={(date) => {
          if (datePickerField === 'end') setEnd(date);
          else setStart(date);
          setDatePickerField(null);
        }}
      />
    </>
  );
};

export default DateRangeSheet;
