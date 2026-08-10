/**
 * CampusSwitcher - 校区切换底部弹窗
 *
 * 用于需要手动切换校区的页面（如老师端首页、排课、统计等）。
 * 展示当前机构下所有校区，高亮当前选中项，支持按权限禁用不可访问校区。
 *
 * 使用方式：
 *   <CampusSwitcher
 *     visible={showSwitcher}
 *     campuses={campuses}
 *     currentCampusId={currentCampusId}
 *     allowedCampusIds={allowedCampusIds}
 *     onSelect={handleCampusSelect}
 *     onClose={handleClose}
 *   />
 */
import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useMemo } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import type { CampusUIModel } from '@/types/campus';

export interface CampusSwitcherProps {
  /** 是否显示 */
  visible: boolean;
  /** 校区列表 */
  campuses: CampusUIModel[];
  /** 当前选中的校区ID */
  currentCampusId?: string;
  /** 用户有权限访问的校区ID列表（未设置则全部可选） */
  allowedCampusIds?: string[];
  /** 弹窗标题 */
  title?: string;
  /** 选择回调 */
  onSelect: (campus: CampusUIModel) => void;
  /** 关闭回调 */
  onClose: () => void;
}

const CampusSwitcher: React.FC<CampusSwitcherProps> = ({
  visible,
  campuses,
  currentCampusId,
  allowedCampusIds,
  title = '切换校区',
  onSelect,
  onClose,
}) => {
  const allowedSet = useMemo(() => {
    if (!allowedCampusIds || allowedCampusIds.length === 0) return null;
    return new Set(allowedCampusIds);
  }, [allowedCampusIds]);

  const handleSelect = useCallback(
    (campus: CampusUIModel) => {
      const disabled = allowedSet ? !allowedSet.has(campus.id) : false;
      if (disabled || campus.id === currentCampusId) return;
      onSelect(campus);
      onClose();
    },
    [allowedSet, currentCampusId, onSelect, onClose],
  );

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View className="px-[40rpx] pb-[60rpx] pt-[12rpx]">
        {campuses.length === 0 ? (
          <Empty icon="mdi-office-building" description="暂无校区，请联系管理员添加" />
        ) : (
          <ScrollView scrollY className="max-h-[50vh]">
            <View className="flex flex-col gap-[16rpx]">
              {campuses.map((campus) => {
                const selected = campus.id === currentCampusId;
                const disabled = allowedSet ? !allowedSet.has(campus.id) : false;

                return (
                  <View
                    key={campus.id}
                    className={cn(
                      'flex flex-row items-center gap-[24rpx] px-[28rpx] py-[24rpx] rounded-[24rpx] border-2 transition-all',
                      selected ? 'border-primary bg-primary/8' : 'border-border bg-white',
                      disabled && 'opacity-50',
                      !disabled && 'press-bg',
                    )}
                    onClick={() => handleSelect(campus)}
                  >
                    {/* 校区图标 */}
                    <View
                      className="w-[80rpx] h-[80rpx] rounded-[20rpx] flex items-center justify-center flex-shrink-0"
                      style={{ background: campus.iconGradient }}
                    >
                      <Text className="text-[40rpx] text-white">{campus.icon}</Text>
                    </View>

                    {/* 校区信息 */}
                    <View className="flex-1 min-w-0">
                      <Text
                        className={cn(
                          'text-[30rpx] font-semibold truncate',
                          selected ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {campus.name}
                      </Text>
                      <Text className="text-[22rpx] text-muted-foreground mt-[4rpx]">
                        {campus.isMain
                          ? '主校区'
                          : campus.type === 'partner'
                            ? '合作校区'
                            : '自营校区'}
                      </Text>
                    </View>

                    {/* 选中标记 */}
                    {selected && (
                      <View className="w-[44rpx] h-[44rpx] rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Icon name="mdi-check" size={24} color="white" />
                      </View>
                    )}

                    {/* 无权限提示 */}
                    {disabled && !selected && (
                      <Text className="text-[22rpx] text-muted-foreground flex-shrink-0">
                        无权限
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </BottomSheet>
  );
};

export default CampusSwitcher;
