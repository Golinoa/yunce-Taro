/**
 * FilterBar - 统计页面筛选栏组件
 * 原版：本月/上月/本年/去年/自定义
 * 激活态：白底绿色文字，未激活：透明底白色文字
 */
import { View, Text, Picker } from '@tarojs/components';
import React from 'react';

/** 筛选模式 */
export type FilterMode = 'month' | 'quarter' | 'year' | 'custom';

/** 筛选选项配置 */
export interface FilterOption {
  key: string;
  label: string;
}

/** 组件属性 */
interface FilterBarProps {
  activeKey: string;
  filterMode: FilterMode;
  startDate: string;
  endDate: string;
  showCustomPicker: boolean;
  onQuickFilter: (key: string) => void;
  onToggleCustomPicker: () => void;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  onCustomQuery?: () => void;
}

const QUICK_OPTIONS: FilterOption[] = [
  { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'thisYear', label: '本年' },
  { key: 'lastYear', label: '去年' },
];

const FilterBar: React.FC<FilterBarProps> = ({
  activeKey,
  filterMode,
  startDate,
  endDate,
  showCustomPicker,
  onQuickFilter,
  onToggleCustomPicker,
  onStartChange,
  onEndChange,
  onCustomQuery,
}) => {
  const isCustomActive = filterMode === 'custom';
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <View className="w-full">
      <View className="flex flex-wrap gap-1_d5 mb-4">
        {QUICK_OPTIONS.map((opt) => {
          const isActive = activeKey === opt.key;
          return (
            <View
              key={opt.key}
              className={`px-3 py-1_d5 rounded-full text-base font-medium transition ${isActive ? 'bg-primary text-primary-foreground shadow-soft' : 'bg-card border border-solid border-border-light text-foreground-secondary'}`}
              onClick={() => onQuickFilter(opt.key)}
            >
              <Text className={isActive ? 'text-primary-foreground' : 'text-foreground-secondary'}>
                {opt.label}
              </Text>
            </View>
          );
        })}
        <View
          className={`px-3 py-1_d5 rounded-full text-base font-medium transition ${isCustomActive ? 'bg-primary text-primary-foreground shadow-soft' : 'bg-card border border-solid border-border-light text-foreground-secondary'}`}
          onClick={onToggleCustomPicker}
        >
          <Text
            className={isCustomActive ? 'text-primary-foreground' : 'text-foreground-secondary'}
          >
            自定义
          </Text>
        </View>
      </View>

      {showCustomPicker && (
        <View className="mt-1_d5 flex flex-col gap-1_d5">
          <View className="bg-card rounded-2xl px-4 py-3 flex items-center gap-3 border border-solid border-border-light">
            <Text className="text-base text-muted-foreground whitespace-nowrap">开始</Text>
            <Picker
              mode="date"
              value={startDate || todayStr}
              onChange={(e: Parameters<CommonEventFunction>[0]) => {
                const val = (e as { detail?: { value?: string } }).detail?.value || '';
                onStartChange(val);
              }}
            >
              <Text className="text-lg font-semibold text-foreground">
                {startDate || '选择开始日期'}
              </Text>
            </Picker>
          </View>
          <View className="bg-card rounded-2xl px-4 py-3 flex items-center gap-3 border border-solid border-border-light">
            <Text className="text-base text-muted-foreground whitespace-nowrap">结束</Text>
            <Picker
              mode="date"
              value={endDate || todayStr}
              onChange={(e: Parameters<CommonEventFunction>[0]) => {
                const val = (e as { detail?: { value?: string } }).detail?.value || '';
                onEndChange(val);
              }}
            >
              <Text className="text-lg font-semibold text-foreground">
                {endDate || '选择结束日期'}
              </Text>
            </Picker>
          </View>
          {startDate && endDate && onCustomQuery && (
            <View
              className="w-full rounded-2xl py-2 bg-primary text-primary-foreground text-base font-semibold shadow-soft flex items-center justify-center"
              onClick={onCustomQuery}
            >
              <Text className="text-base text-primary-foreground font-semibold">查询</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default FilterBar;
