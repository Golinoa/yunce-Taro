/**
 * 课程分类多选弹窗
 *
 * 用于卡种管理等场景选择适用的课程分类，支持：
 * - 「全部课程」一键清空所有分类选择
 * - 按班课 / 团课 / 私教三个 mode 分组 Tab 切换
 * - 当前分组下分类多选
 * - 「全选本分类」快速选中当前分组下所有分类
 *
 * 数据从课程分类 store 传入，保证与课程管理模块的分类实时同步。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import { CATEGORY_MODE_LABEL } from '@/data/course-category';
import type { CourseCategoryConfig, CourseCategoryMode } from '@/types/course-category';

export interface CategoryMultiSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 弹窗标题 */
  title?: string;
  /** 课程分类列表 */
  categories: CourseCategoryConfig[];
  /** 已选分类 ID */
  selectedIds: string[];
  /** 关闭回调 */
  onClose: () => void;
  /** 确认回调，返回最终选中的分类 ID 列表 */
  onConfirm: (ids: string[]) => void;
}

/** mode 顺序与标签 */
const MODE_TABS: { value: CourseCategoryMode; label: string }[] = [
  { value: 'class', label: CATEGORY_MODE_LABEL.class },
  { value: 'group', label: CATEGORY_MODE_LABEL.group },
  { value: 'private', label: CATEGORY_MODE_LABEL.private },
];

const CategoryMultiSheet: React.FC<CategoryMultiSheetProps> = ({
  visible,
  title = '适用课程范围',
  categories,
  selectedIds,
  onClose,
  onConfirm,
}) => {
  // 内部临时选中状态，避免未确认时影响外部
  const [tempIds, setTempIds] = useState<string[]>(selectedIds);
  const [activeMode, setActiveMode] = useState<CourseCategoryMode>('class');

  // 弹窗打开时同步外部选中值，并默认切换到第一个有选中分类的分组
  useEffect(() => {
    if (visible) {
      setTempIds(selectedIds);
      const firstSelectedMode = MODE_TABS.find((tab) =>
        categories.some((cat) => cat.mode === tab.value && selectedIds.includes(cat.id)),
      );
      setActiveMode(firstSelectedMode?.value ?? 'class');
    }
  }, [visible, selectedIds, categories]);

  /** 按 mode 分组 */
  const groupedCategories = useMemo(() => {
    return MODE_TABS.map((tab) => ({
      ...tab,
      list: categories
        .filter((cat) => cat.mode === tab.value)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [categories]);

  const currentGroup = useMemo(
    () => groupedCategories.find((g) => g.value === activeMode) ?? groupedCategories[0],
    [groupedCategories, activeMode],
  );

  /** 当前分组是否全部选中 */
  const isCurrentGroupAllSelected = useMemo(() => {
    if (!currentGroup || currentGroup.list.length === 0) return false;
    return currentGroup.list.every((cat) => tempIds.includes(cat.id));
  }, [currentGroup, tempIds]);

  /** 切换「全部课程」 */
  const handleToggleAll = useCallback(() => {
    setTempIds((prev) => (prev.length === 0 ? [] : []));
  }, []);

  /** 切换单个分类 */
  const handleToggleCategory = useCallback((id: string) => {
    setTempIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  /** 切换「全选本分类」 */
  const handleToggleGroupAll = useCallback(() => {
    if (!currentGroup) return;
    const groupIds = currentGroup.list.map((cat) => cat.id);
    setTempIds((prev) => {
      const allSelected = groupIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !groupIds.includes(id));
      }
      return Array.from(new Set([...prev, ...groupIds]));
    });
  }, [currentGroup]);

  const handleConfirm = useCallback(() => {
    onConfirm(tempIds);
    onClose();
  }, [tempIds, onConfirm, onClose]);

  return (
    <BottomSheet visible={visible} onClose={onClose} height="70vh">
      {/* 顶部栏 */}
      <View className="flex flex-row items-center justify-between px-[32rpx] py-[24rpx]">
        <Text className="text-[32rpx] text-foreground active:opacity-70" onClick={onClose}>
          取消
        </Text>
        <Text className="text-[34rpx] font-medium text-foreground">{title}</Text>
        <Text
          className="text-[32rpx] text-primary active:opacity-70"
          onClick={() => void handleConfirm()}
        >
          确定
        </Text>
      </View>

      <ScrollView scrollY className="px-[32rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))]">
        {/* 全部课程 */}
        <View
          className="flex flex-row items-center py-[28rpx] border-b-[2rpx] border-border/30 press-scale"
          onClick={handleToggleAll}
        >
          <View
            className={cn(
              'w-[40rpx] h-[40rpx] rounded-full border-[4rpx] flex items-center justify-center mr-[20rpx]',
              tempIds.length === 0
                ? 'border-primary bg-primary'
                : 'border-muted-foreground bg-white',
            )}
          >
            {tempIds.length === 0 && <Icon name="mdi-check" size={24} color="white" />}
          </View>
          <Text className="text-[30rpx] text-foreground">全部课程</Text>
        </View>

        {/* mode Tab */}
        <View className="flex flex-row gap-[16rpx] mt-[32rpx]">
          {groupedCategories.map((group) => {
            const isActive = activeMode === group.value;
            const hasData = group.list.length > 0;
            return (
              <View
                key={group.value}
                className={cn(
                  'py-[12rpx] px-[28rpx] rounded-[24rpx] text-[26rpx] font-medium',
                  isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                  !hasData && 'opacity-50',
                )}
                onClick={() => hasData && setActiveMode(group.value)}
              >
                <Text className={cn(isActive ? 'text-white' : 'text-muted-foreground')}>
                  {group.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 全选本分类 */}
        {currentGroup && currentGroup.list.length > 0 && (
          <View
            className="flex flex-row items-center py-[28rpx] border-b-[2rpx] border-border/30 press-scale"
            onClick={handleToggleGroupAll}
          >
            <View
              className={cn(
                'w-[40rpx] h-[40rpx] rounded-[8rpx] border-[2rpx] flex items-center justify-center mr-[20rpx]',
                isCurrentGroupAllSelected ? 'border-primary bg-primary' : 'border-border bg-white',
              )}
            >
              {isCurrentGroupAllSelected && <Icon name="mdi-check" size={24} color="white" />}
            </View>
            <Text className="text-[30rpx] text-foreground">全选本分类（含以后新增课程）</Text>
          </View>
        )}

        {/* 分类列表 */}
        <View className="flex flex-col mt-[8rpx]">
          {currentGroup?.list.map((category) => {
            const active = tempIds.includes(category.id);
            return (
              <View
                key={category.id}
                className="flex flex-row items-center py-[28rpx] border-b-[2rpx] border-border/30 press-scale"
                onClick={() => handleToggleCategory(category.id)}
              >
                <View
                  className={cn(
                    'w-[40rpx] h-[40rpx] rounded-[8rpx] border-[2rpx] flex items-center justify-center mr-[20rpx]',
                    active ? 'border-primary bg-primary' : 'border-border bg-white',
                  )}
                >
                  {active && <Icon name="mdi-check" size={24} color="white" />}
                </View>
                <Text className="text-[30rpx] text-foreground">{category.name}</Text>
              </View>
            );
          })}
          {currentGroup?.list.length === 0 && (
            <Text className="text-[28rpx] text-muted-foreground text-center py-[48rpx]">
              暂无该分类数据
            </Text>
          )}
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

export default CategoryMultiSheet;
