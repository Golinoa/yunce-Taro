/**
 * ClassPickerSheet - 选择班级弹窗
 *
 * 对齐课程管理·班课列表：
 * - 顶部横向标签：全部 + 所有「班课」模式的课程分类（不只系统默认「班课」一项）
 * - 次行可选：全部 / 未排课 / 已排课
 * - 下方卡片：色条 + 名称 + 未排课角标 + 人数/课时
 */
import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import { useCourseCategoryStore } from '@/stores/course-category';
import { classColorHex } from '@/theme';
import type { Class } from '@/types/class';
import type { CourseCategoryConfig, CourseCategoryMode } from '@/types/course-category';

export type ClassScheduleFilter = 'all' | 'unscheduled' | 'scheduled';

export interface ClassPickerSheetProps {
  visible: boolean;
  title?: string;
  classes: Class[];
  /** 已排课班级 ID 集合 */
  scheduledClassIds: Set<string> | string[];
  /** 课程模式：班课 / 团课；默认班课 */
  courseMode?: Extract<CourseCategoryMode, 'class' | 'group'>;
  /** 指定模式分类；不传则从 store 按 courseMode 取 */
  categories?: CourseCategoryConfig[];
  value?: string;
  onClose: () => void;
  onConfirm: (classId: string) => void;
}

const SCHEDULE_FILTERS: { key: ClassScheduleFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'unscheduled', label: '未排课' },
  { key: 'scheduled', label: '已排课' },
];

const ClassPickerSheet: React.FC<ClassPickerSheetProps> = ({
  visible,
  title = '选择班级',
  classes,
  scheduledClassIds,
  courseMode = 'class',
  categories: categoriesProp,
  value,
  onClose,
  onConfirm,
}) => {
  const storeCategories = useCourseCategoryStore((s) => s.categories);
  const fetchCategories = useCourseCategoryStore((s) => s.fetchList);

  const [categoryTabId, setCategoryTabId] = useState('all');
  const [scheduleFilter, setScheduleFilter] = useState<ClassScheduleFilter>('all');
  const [draftId, setDraftId] = useState(value || '');

  const scheduledSet = useMemo(
    () => (scheduledClassIds instanceof Set ? scheduledClassIds : new Set(scheduledClassIds || [])),
    [scheduledClassIds],
  );

  /** 当前课程模式下的分类 */
  const classCategories = useMemo(() => {
    const source = categoriesProp?.length ? categoriesProp : storeCategories;
    return [...source]
      .filter((c) => c.mode === courseMode)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categoriesProp, courseMode, storeCategories]);

  const categoryTabs = useMemo(
    () => [
      { id: 'all', label: '全部' },
      ...classCategories.map((c) => ({ id: c.id, label: c.name })),
    ],
    [classCategories],
  );

  useEffect(() => {
    if (!visible) return;
    setDraftId(value || '');
    setCategoryTabId('all');
    setScheduleFilter('all');
    if (!categoriesProp?.length) {
      void fetchCategories().catch(() => undefined);
    }
  }, [categoriesProp?.length, courseMode, fetchCategories, value, visible]);

  const filtered = useMemo(() => {
    let list = classes.filter((c) => c.status !== 'ended');

    if (categoryTabId !== 'all') {
      list = list.filter((c) => c.category_id === categoryTabId);
    } else if (classCategories.length > 0) {
      const classCatIds = new Set(classCategories.map((c) => c.id));
      list = list.filter((c) => {
        if (c.category_id) return classCatIds.has(c.category_id);
        // 未挂分类：班课≈固定班课，团课≈开放预约
        if (courseMode === 'group') return c.schedule_mode === 'open';
        return !c.schedule_mode || c.schedule_mode === 'fixed';
      });
    } else if (courseMode === 'group') {
      list = list.filter((c) => c.schedule_mode === 'open');
    }

    if (scheduleFilter === 'scheduled') {
      list = list.filter((c) => scheduledSet.has(c.id));
    } else if (scheduleFilter === 'unscheduled') {
      list = list.filter((c) => !scheduledSet.has(c.id));
    }

    return list;
  }, [categoryTabId, classCategories, classes, courseMode, scheduleFilter, scheduledSet]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="70vh"
      fillHeight
      scrollable={false}
      className="pb-safe-bar"
    >
      <View className="flex h-full flex-col bg-white px-[24rpx] pb-[24rpx] pt-[28rpx]">
        <View className="mb-[16rpx] flex shrink-0 items-center justify-between">
          <Text className="text-[28rpx] text-muted-foreground active:opacity-70" onClick={onClose}>
            取消
          </Text>
          <Text className="text-[32rpx] font-semibold text-foreground">{title}</Text>
          <View className="w-[56rpx]" />
        </View>

        {/* 横向：班课类型分类 */}
        <ScrollView
          scrollX
          enhanced
          showScrollbar={false}
          scrollWithAnimation
          className="w-full shrink-0 whitespace-nowrap"
        >
          <View className="inline-flex flex-row items-center gap-[8rpx] py-[4rpx]">
            {categoryTabs.map((tab) => {
              const active = categoryTabId === tab.id;
              return (
                <View
                  key={tab.id}
                  className={cn(
                    'shrink-0 rounded-full px-[28rpx] py-[14rpx]',
                    active ? 'bg-primary' : 'bg-muted',
                  )}
                  onClick={() => setCategoryTabId(tab.id)}
                >
                  <Text
                    className={cn(
                      'text-[26rpx]',
                      active ? 'font-semibold text-white' : 'text-muted-foreground',
                    )}
                  >
                    {tab.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* 横向：排课状态 */}
        <View className="mt-[16rpx] flex shrink-0 flex-row items-center gap-[12rpx]">
          {SCHEDULE_FILTERS.map((item) => {
            const active = scheduleFilter === item.key;
            return (
              <View
                key={item.key}
                className={cn(
                  'rounded-full border px-[22rpx] py-[10rpx]',
                  active ? 'border-primary/30 bg-primary/10' : 'border-transparent bg-muted/70',
                )}
                onClick={() => setScheduleFilter(item.key)}
              >
                <Text
                  className={cn(
                    'text-[24rpx]',
                    active ? 'font-medium text-primary' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 班级卡片列表：点选即确认，无确定按钮 */}
        <ScrollView scrollY className="mt-[20rpx] min-h-0 flex-1">
          {filtered.length === 0 ? (
            <View className="py-[80rpx]">
              <Empty
                icon="mdi-school-outline"
                description={courseMode === 'group' ? '该分类下暂无团课班级' : '该分类下暂无班级'}
              />
            </View>
          ) : (
            <View className="flex flex-col gap-[16rpx] pb-[8rpx]">
              {filtered.map((cls) => {
                const selected = draftId === cls.id;
                const scheduled = scheduledSet.has(cls.id);
                const categoryName =
                  classCategories.find((c) => c.id === cls.category_id)?.name || '';
                return (
                  <View
                    key={cls.id}
                    className={cn(
                      'flex flex-row items-center justify-between rounded-[20rpx] border-[2rpx] bg-muted/50 px-[24rpx] py-[24rpx] active:opacity-85',
                      selected ? 'border-primary/40 bg-primary/8' : 'border-transparent',
                    )}
                    onClick={() => {
                      setDraftId(cls.id);
                      onConfirm(cls.id);
                      onClose();
                    }}
                  >
                    <View className="flex min-w-0 flex-1 flex-row items-center gap-[20rpx]">
                      <View
                        className="h-[88rpx] w-[12rpx] shrink-0 rounded-full"
                        style={{
                          backgroundColor: classColorHex[cls.color] || 'hsl(var(--primary))',
                        }}
                      />
                      <View className="min-w-0 flex-1">
                        <View className="flex flex-row items-center gap-[12rpx]">
                          <Text className="truncate text-[28rpx] font-medium text-foreground">
                            {cls.name}
                          </Text>
                          {!scheduled ? (
                            <View className="shrink-0 rounded-full bg-primary-bg px-[10rpx] py-[2rpx]">
                              <Text className="text-[20rpx] text-primary">未排课</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="mt-[8rpx] block text-[22rpx] text-muted-foreground">
                          {categoryName ? `${categoryName} · ` : ''}
                          {cls.student_count ?? 0} 名学员
                          {cls.used_lessons != null
                            ? ` · 已上 ${cls.used_lessons}/${cls.total_lessons ?? 0} 课时`
                            : ''}
                        </Text>
                      </View>
                    </View>
                    {selected ? (
                      <View className="ml-[12rpx] flex h-[36rpx] w-[36rpx] shrink-0 items-center justify-center rounded-full bg-primary">
                        <Text className="text-[22rpx] text-white">✓</Text>
                      </View>
                    ) : (
                      <View className="ml-[12rpx] h-[36rpx] w-[36rpx] shrink-0 rounded-full border-[3rpx] border-border bg-white" />
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </BottomSheet>
  );
};

export default ClassPickerSheet;
