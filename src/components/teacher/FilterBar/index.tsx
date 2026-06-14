import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

interface FilterOption {
  label: string;
  value: string;
  dotColor?: string;
}

interface FilterBarProps {
  filters: {
    id: string;
    label: string;
    value: string;
    options: FilterOption[];
  }[];
  activeId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string, value: string, label: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, activeId, onToggle, onSelect }) => {
  return (
    <View
      className="flex bg-card rounded-t-xl mx-[-20px] px-5 relative z-10 flex-shrink-0"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
    >
      {filters.map((filter) => {
        const isActive = activeId === filter.id;
        return (
          <View
            key={filter.id}
            className={cn(
              'flex-1 relative',
              filter.id !== filters[0].id && 'border-l border-border/30',
            )}
          >
            <View
              className={cn(
                'flex items-center justify-center gap-1 py-[10px] text-sm font-medium transition-colors',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground',
              )}
              onClick={() => onToggle(filter.id)}
            >
              <Text className="whitespace-nowrap">{filter.label}</Text>
              <Text className={cn('text-[20rpx] transition-transform', isActive && 'rotate-180')}>
                ▼
              </Text>
            </View>

            {/* 下拉选项 - 全宽面板样式 */}
            {isActive && (
              <View className="absolute top-full left-0 right-0 bg-card rounded-b-xl shadow-float z-50 overflow-hidden">
                {filter.options.map((opt) => (
                  <View
                    key={opt.value}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 text-sm active:bg-muted transition-colors',
                      filter.value === opt.value
                        ? 'bg-primary-bg text-primary font-semibold'
                        : 'text-foreground',
                    )}
                    onClick={() => onSelect(filter.id, opt.value, opt.label)}
                  >
                    {opt.dotColor && (
                      <View
                        className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                        style={{ background: opt.dotColor }}
                      />
                    )}
                    <Text className="flex-1">{opt.label}</Text>
                    {filter.value === opt.value && <Text className="text-primary text-xs">✓</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default FilterBar;
