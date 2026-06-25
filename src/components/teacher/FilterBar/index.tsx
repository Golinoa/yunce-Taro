import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

const DROPDOWN_SCROLL_THRESHOLD = 6;
const DROPDOWN_MAX_HEIGHT = '420rpx';

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
    <View className="flex bg-card rounded-t-xl mx-[-20px] px-5 relative z-10 flex-shrink-0 shadow-card">
      {filters.map((filter) => {
        const isActive = activeId === filter.id;
        const isScrollable = filter.options.length > DROPDOWN_SCROLL_THRESHOLD;
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
                <View className="relative">
                  <ScrollView
                    scrollY={isScrollable}
                    style={{
                      height: isScrollable ? DROPDOWN_MAX_HEIGHT : 'auto',
                      maxHeight: DROPDOWN_MAX_HEIGHT,
                    }}
                  >
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
                  </ScrollView>

                  {isScrollable && (
                    <View className="absolute left-0 right-0 bottom-0 h-[72rpx] flex items-end justify-center pb-[10rpx] bg-gradient-to-t from-[hsl(var(--card))] via-[hsl(var(--card)/0.96)] to-[hsl(var(--card)/0)] pointer-events-none">
                      <Text className="text-[20rpx] text-primary/80 font-medium tracking-[1rpx]">
                        上滑查看更多
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default FilterBar;
