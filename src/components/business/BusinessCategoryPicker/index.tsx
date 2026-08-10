/**
 * 主营业态多选组件
 * 支持主项多选 + 子项多选，选中主项后展开子项列表
 * 用于校区详情页「主营业态」编辑
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useMemo } from 'react';
import {
  BUSINESS_CATEGORIES,
  type BusinessCategory,
  type SelectedBusinessCategory,
} from '@/constants/business-categories';

export interface BusinessCategoryPickerProps {
  /** 已选值 */
  value: SelectedBusinessCategory[];
  /** 变更回调 */
  onChange: (value: SelectedBusinessCategory[]) => void;
}

const BusinessCategoryPicker: React.FC<BusinessCategoryPickerProps> = ({ value, onChange }) => {
  const selectedMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    value.forEach((item) => {
      map.set(item.categoryId, new Set(item.subIds));
    });
    return map;
  }, [value]);

  /** 主项是否选中 */
  const isCategorySelected = useCallback(
    (categoryId: string) => selectedMap.has(categoryId),
    [selectedMap],
  );

  /** 子项是否选中 */
  const isSubSelected = useCallback(
    (categoryId: string, subId: string) => selectedMap.get(categoryId)?.has(subId) ?? false,
    [selectedMap],
  );

  /** 切换主项选中状态 */
  const handleToggleCategory = useCallback(
    (category: BusinessCategory) => {
      const next = new Map(selectedMap);
      if (next.has(category.id)) {
        next.delete(category.id);
      } else {
        next.set(category.id, new Set<string>());
      }
      onChange(
        Array.from(next.entries()).map(([categoryId, subIds]) => ({
          categoryId,
          subIds: Array.from(subIds),
        })),
      );
    },
    [selectedMap, onChange],
  );

  /** 切换子项选中状态 */
  const handleToggleSub = useCallback(
    (category: BusinessCategory, subId: string) => {
      const next = new Map(selectedMap);
      const currentSubIds = next.get(category.id) || new Set<string>();
      const nextSubIds = new Set(currentSubIds);

      if (nextSubIds.has(subId)) {
        nextSubIds.delete(subId);
      } else {
        nextSubIds.add(subId);
      }

      // 子项全取消时仍保留主项选中
      next.set(category.id, nextSubIds);

      onChange(
        Array.from(next.entries()).map(([categoryId, subIds]) => ({
          categoryId,
          subIds: Array.from(subIds),
        })),
      );
    },
    [selectedMap, onChange],
  );

  return (
    <View className="bg-white rounded-[32rpx] p-[32rpx]">
      {/* 主营业态标签 */}
      <Text className="text-[32rpx] font-semibold text-foreground">主营业态（可多选）</Text>
      <View className="flex flex-row flex-wrap gap-[20rpx] mt-[24rpx]">
        {BUSINESS_CATEGORIES.map((category) => {
          const active = isCategorySelected(category.id);
          return (
            <View
              key={category.id}
              className={cn(
                'px-[28rpx] py-[14rpx] rounded-[32rpx] border-[2rpx] press-bg',
                active ? 'bg-primary border-primary' : 'bg-white border-border',
              )}
              onClick={() => handleToggleCategory(category)}
            >
              <Text
                className={cn(
                  'text-[28rpx] font-medium',
                  active ? 'text-white' : 'text-foreground',
                )}
              >
                {category.name}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 选中主项的子项展开 */}
      {BUSINESS_CATEGORIES.map((category) => {
        if (!category.children.length || !isCategorySelected(category.id)) return null;

        return (
          <View key={`sub-${category.id}`} className="mt-[32rpx]">
            <Text className="text-[28rpx] font-semibold text-foreground">
              {category.name}项目（可多选）
            </Text>
            <View className="flex flex-row flex-wrap gap-[20rpx] mt-[20rpx]">
              {category.children.map((sub) => {
                const active = isSubSelected(category.id, sub.id);
                return (
                  <View
                    key={sub.id}
                    className={cn(
                      'px-[28rpx] py-[14rpx] rounded-[32rpx] border-[2rpx] press-bg',
                      active ? 'bg-primary border-primary' : 'bg-white border-border',
                    )}
                    onClick={() => handleToggleSub(category, sub.id)}
                  >
                    <Text
                      className={cn(
                        'text-[28rpx] font-medium',
                        active ? 'text-white' : 'text-foreground',
                      )}
                    >
                      {sub.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default BusinessCategoryPicker;
