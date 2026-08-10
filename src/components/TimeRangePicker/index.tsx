/**
 * 时间范围选择器
 *
 * 底部弹窗形式，5 列滚轮：开始小时 / 开始分钟 / 至 / 结束小时 / 结束分钟。
 * 输出格式：HH:mm:00至HH:mm:00
 */
import { View, Text, PickerView, PickerViewColumn } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';

export interface TimeRangePickerProps {
  /** 是否显示 */
  visible: boolean;
  /** 当前值，格式 HH:mm:00至HH:mm:00 */
  value?: string;
  /** 确认回调 */
  onConfirm: (value: string) => void;
  /** 取消/关闭回调 */
  onCancel: () => void;
  /** 标题 */
  title?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const SEPARATOR = ['至'];

/** 解析时间范围字符串为索引数组 */
function parseValue(value?: string): number[] {
  if (!value) return [8, 0, 0, 22, 0];
  const match = value.match(/(\d{2}):(\d{2}):\d{2}至(\d{2}):(\d{2}):\d{2}/);
  if (!match) return [8, 0, 0, 22, 0];
  return [Number(match[1]), Number(match[2]), 0, Number(match[3]), Number(match[4])];
}

const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  visible,
  value,
  onConfirm,
  onCancel,
  title = '选择营业时间',
}) => {
  const [selected, setSelected] = useState<number[]>(() => parseValue(value));

  useEffect(() => {
    if (visible) {
      setSelected(parseValue(value));
    }
  }, [visible, value]);

  const handleChange = useCallback((e: { detail: { value: number[] } }) => {
    setSelected(e.detail.value);
  }, []);

  const handleConfirm = useCallback(() => {
    const startHour = HOURS[selected[0]];
    const startMinute = MINUTES[selected[1]];
    const endHour = HOURS[selected[3]];
    const endMinute = MINUTES[selected[4]];
    onConfirm(`${startHour}:${startMinute}:00至${endHour}:${endMinute}:00`);
  }, [selected, onConfirm]);

  const columnClass = useMemo(() => 'text-[34rpx] leading-[96rpx] text-center text-foreground', []);

  return (
    <BottomSheet visible={visible} onClose={onCancel} height="70vh">
      <View className="flex flex-col h-full">
        {/* 头部 */}
        <View className="flex flex-row items-center justify-between px-[32rpx] py-[24rpx] border-b-[2rpx] border-border">
          <Text
            className="text-[30rpx] text-muted-foreground press-bg px-[16rpy]"
            onClick={onCancel}
          >
            取消
          </Text>
          <Text className="text-[32rpx] font-semibold text-foreground">{title}</Text>
          <Text
            className="text-[30rpx] text-primary font-medium press-bg px-[16rpx]"
            onClick={handleConfirm}
          >
            确认
          </Text>
        </View>

        {/* 选择器 */}
        <View className="flex-1 flex items-center justify-center">
          <PickerView
            className="w-full h-[480rpx]"
            value={selected}
            onChange={handleChange}
            indicatorStyle="height: 96rpx;"
          >
            <PickerViewColumn>
              {HOURS.map((item) => (
                <View key={`h1-${item}`} className={columnClass}>
                  <Text>{item}</Text>
                </View>
              ))}
            </PickerViewColumn>
            <PickerViewColumn>
              {MINUTES.map((item) => (
                <View key={`m1-${item}`} className={columnClass}>
                  <Text>{item}</Text>
                </View>
              ))}
            </PickerViewColumn>
            <PickerViewColumn>
              {SEPARATOR.map((item) => (
                <View key="sep" className={cn(columnClass, 'text-muted-foreground')}>
                  <Text>{item}</Text>
                </View>
              ))}
            </PickerViewColumn>
            <PickerViewColumn>
              {HOURS.map((item) => (
                <View key={`h2-${item}`} className={columnClass}>
                  <Text>{item}</Text>
                </View>
              ))}
            </PickerViewColumn>
            <PickerViewColumn>
              {MINUTES.map((item) => (
                <View key={`m2-${item}`} className={columnClass}>
                  <Text>{item}</Text>
                </View>
              ))}
            </PickerViewColumn>
          </PickerView>
        </View>
      </View>
    </BottomSheet>
  );
};

export default TimeRangePicker;
