/**
 * TimePickerSheet - 底部时间选择弹窗
 *
 * 使用原生 PickerView 实现时/分两列选择，分钟 00-59 全量可选。
 */
import { View, Text, PickerView, PickerViewColumn } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';

interface TimePickerSheetProps {
  visible: boolean;
  value?: string; // HH:mm
  title?: string;
  onClose: () => void;
  onConfirm: (time: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const TimePickerSheet: React.FC<TimePickerSheetProps> = ({
  visible,
  value,
  title = '选择时间',
  onClose,
  onConfirm,
}) => {
  const current = useMemo(() => {
    if (!value) return ['08', '00'];
    return value.split(':');
  }, [value]);

  const [selected, setSelected] = useState([
    HOURS.indexOf(current[0]),
    MINUTES.indexOf(current[1]),
  ]);

  useEffect(() => {
    if (visible && value) {
      const [h, m] = value.split(':');
      setSelected([HOURS.indexOf(h), MINUTES.indexOf(m)]);
    }
  }, [visible, value]);

  const handleChange = (e: { detail: { value: number[] } }) => {
    setSelected(e.detail.value);
  };

  const handleConfirm = () => {
    onConfirm(`${HOURS[selected[0]]}:${MINUTES[selected[1]]}`);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="auto"
      scrollable={false}
      className="rounded-t-[32rpx]"
    >
      <View className="bg-white">
        <View className="flex items-center justify-between px-[32rpx] py-[24rpx]">
          <Text
            className="text-[30rpx] text-foreground-secondary active:opacity-70"
            onClick={onClose}
          >
            取消
          </Text>
          <Text className="text-[34rpx] font-medium text-foreground">{title}</Text>
          <Text
            className="text-[30rpx] text-schedule-attend active:opacity-70"
            onClick={handleConfirm}
          >
            确认
          </Text>
        </View>

        <PickerView
          className="h-[480rpx]"
          indicatorStyle="height: 96rpx; line-height: 96rpx;"
          value={selected}
          onChange={handleChange}
        >
          <PickerViewColumn>
            {HOURS.map((h) => (
              <View key={h} className="center h-[96rpx]">
                <Text className="text-[34rpx] text-foreground">{h}</Text>
              </View>
            ))}
          </PickerViewColumn>
          <PickerViewColumn>
            {MINUTES.map((m) => (
              <View key={m} className="center h-[96rpx]">
                <Text className="text-[34rpx] text-foreground">{m}</Text>
              </View>
            ))}
          </PickerViewColumn>
        </PickerView>
      </View>
    </BottomSheet>
  );
};

export default TimePickerSheet;
