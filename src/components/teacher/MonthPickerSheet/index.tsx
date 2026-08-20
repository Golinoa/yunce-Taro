/**
 * MonthPickerSheet - 年月底部滚轮选择弹窗
 *
 * 使用场景：薪资发放页等需要快速切换年月的页面
 * 功能：两列 PickerView 分别选择年份和月份
 * 限制：不能选择未来月份
 */
import { View, Text, PickerView, PickerViewColumn } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';

export interface MonthPickerSheetProps {
  visible: boolean;
  /** 当前月份 YYYY-MM */
  value: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

const MonthPickerSheet: React.FC<MonthPickerSheetProps> = ({
  visible,
  value,
  onConfirm,
  onClose,
}) => {
  const currentYear = dayjs().year();
  const currentMonth = dayjs().month() + 1; // 1-12
  const years = useMemo(
    () => Array.from({ length: 13 }, (_, i) => currentYear - 10 + i),
    [currentYear],
  );
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const [selectedYear, selectedMonth] = useMemo(() => {
    const [y, m] = value.split('-').map(Number);
    return [Number.isNaN(y) ? currentYear : y, Number.isNaN(m) ? 1 : m];
  }, [value, currentYear]);

  const [selected, setSelected] = useState([
    Math.max(0, years.indexOf(selectedYear)),
    selectedMonth - 1,
  ]);

  useEffect(() => {
    if (visible) {
      const [y, m] = value.split('-').map(Number);
      const selYear = Number.isNaN(y) ? currentYear : y;
      const selMonth = Number.isNaN(m) ? 1 : m;
      // 如果选中的是未来月份，自动回退到当前月
      if (selYear > currentYear || (selYear === currentYear && selMonth > currentMonth)) {
        setSelected([Math.max(0, years.indexOf(currentYear)), currentMonth - 1]);
      } else {
        setSelected([Math.max(0, years.indexOf(selYear)), selMonth - 1]);
      }
    }
  }, [visible, value, years, currentYear, currentMonth]);

  const handleChange = (e: { detail: { value: number[] } }) => {
    let [yIdx, mIdx] = e.detail.value;
    yIdx = yIdx ?? 0;
    mIdx = mIdx ?? 0;
    // 限制：选中的年月不能超过当前月
    const pickedYear = years[yIdx];
    const pickedMonth = months[mIdx];
    if (pickedYear > currentYear || (pickedYear === currentYear && pickedMonth > currentMonth)) {
      // 回退到当前月
      yIdx = Math.max(0, years.indexOf(currentYear));
      mIdx = currentMonth - 1;
    }
    setSelected([yIdx, mIdx]);
  };

  const handleConfirm = () => {
    const year = years[selected[0]];
    const month = months[selected[1]];
    // 二次校验：禁止确认未来月份
    if (year > currentYear || (year === currentYear && month > currentMonth)) {
      return;
    }
    if (year && month) {
      onConfirm(`${year}-${String(month).padStart(2, '0')}`);
    }
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height="auto" scrollable={false}>
      <View className="bg-white">
        <View className="flex flex-shrink-0 items-center justify-between px-[32rpx] py-[24rpx]">
          <Text
            className="text-[32rpx] text-foreground-secondary active:opacity-70"
            onClick={onClose}
          >
            取消
          </Text>
          <Text className="text-[34rpx] font-medium text-foreground">选择月份</Text>
          <Text className="text-[32rpx] text-primary active:opacity-70" onClick={handleConfirm}>
            确认
          </Text>
        </View>

        {/* 微信：PickerView indicator 高度禁用 rpx（会被忽略退回 34px），须用 px，与 item 96rpx@375=48px 对齐 */}
        <PickerView
          className="h-[480rpx]"
          indicatorStyle="height: 48px; line-height: 48px;"
          value={selected}
          onChange={handleChange}
        >
          <PickerViewColumn>
            {years.map((y) => (
              <View key={y} className="center">
                <Text className="text-[34rpx] text-foreground">{y}年</Text>
              </View>
            ))}
          </PickerViewColumn>
          <PickerViewColumn>
            {months.map((m) => (
              <View key={m} className="center">
                <Text
                  className={cn(
                    'text-[34rpx]',
                    // 未来月份置灰
                    selected[0] >= 0 && years[selected[0]] === currentYear && m > currentMonth
                      ? 'text-muted-foreground/40'
                      : 'text-foreground',
                  )}
                >
                  {m}月
                </Text>
              </View>
            ))}
          </PickerViewColumn>
        </PickerView>
      </View>
    </BottomSheet>
  );
};

export default MonthPickerSheet;
