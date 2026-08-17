import { View, Text, Image, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import { ROLE_LABEL } from '@/components/RoleCard';
import type { CampusUIModel } from '@/types/campus';
import type { UserRole } from '@/types/profile';
import { isPrincipalOrAbove } from '@/utils/auth';

export interface CampusSelectSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 当前选中的校区 ID */
  currentId?: string;
  /** 当前用户角色（用于显示身份标签 & 判断是否走推荐逻辑） */
  currentRole?: UserRole | null;
  /** 校区列表 */
  campuses: CampusUIModel[];
  /** 管理员校区 ID 列表（用于决定是否推荐最近一次访问的店） */
  managedCampusIds?: string[];
  /** 上次访问的校区 ID（用于推荐位） */
  lastVisitedId?: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认选择回调 */
  onConfirm: (campus: CampusUIModel) => void;
}

const CAMPUS_SELECT_TABBAR_PADDING_BOTTOM = 'calc(100rpx + env(safe-area-inset-bottom))';

/**
 * CampusSelectSheet - 首页校区切换底部弹窗
 *
 * 使用场景：教师端首页点击校区卡片后，切换当前上课校区
 * 功能：展示校区列表，支持单选并确认切换；底部按钮始终固定
 *
 * 列表排序规则：
 *   1. 第一顺位：当前已选中校区（默认选中）
 *   2. 第二顺位：推荐校区 — 仅当满足以下全部条件时存在：
 *      - 当前用户是校长/管理员身份
 *      - 管理的校区 ≥ 2 个
 *      - 最近访问的校区 != 当前已选中校区
 *      - 最近访问的校区在管理范围内
 *   3. 剩余：按原 campuses 数组顺序追加
 */
const CampusSelectSheet: React.FC<CampusSelectSheetProps> = ({
  visible,
  currentId,
  currentRole,
  campuses,
  managedCampusIds = [],
  lastVisitedId,
  onClose,
  onConfirm,
}) => {
  const roleLabel = currentRole ? ROLE_LABEL[currentRole] : null;

  // 计算排序后的校区列表 + 推荐校区 ID
  const { sortedCampuses, recommendId } = useMemo(() => {
    const currentCampus = currentId ? campuses.find((c) => c.id === currentId) : undefined;

    // 决定是否有「推荐校区」
    const canRecommend =
      isPrincipalOrAbove(currentRole) &&
      managedCampusIds.length > 1 &&
      !!lastVisitedId &&
      lastVisitedId !== currentId &&
      managedCampusIds.includes(lastVisitedId);

    const recommendCampus = canRecommend ? campuses.find((c) => c.id === lastVisitedId) : undefined;

    // 已排好头部的校区 ID 集合，避免重复
    const headIds = new Set<string>();
    const headList: CampusUIModel[] = [];
    if (currentCampus) {
      headList.push(currentCampus);
      headIds.add(currentCampus.id);
    }
    if (recommendCampus) {
      headList.push(recommendCampus);
      headIds.add(recommendCampus.id);
    }

    const rest = campuses.filter((c) => !headIds.has(c.id));

    return {
      sortedCampuses: [...headList, ...rest],
      recommendId: recommendCampus?.id ?? null,
    };
  }, [campuses, currentId, currentRole, managedCampusIds, lastVisitedId]);

  // 默认选中：第一顺位（currentId）
  const initialSelectedId = currentId || sortedCampuses[0]?.id || '';
  const [selectedId, setSelectedId] = useState<string>(initialSelectedId);

  useEffect(() => {
    if (visible) {
      setSelectedId(currentId || sortedCampuses[0]?.id || '');
    }
  }, [visible, currentId, sortedCampuses]);

  const handleSelect = (campus: CampusUIModel) => {
    setSelectedId(campus.id);
  };

  const handleConfirm = () => {
    const selected = sortedCampuses.find((item) => item.id === selectedId);
    if (selected) {
      onConfirm(selected);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="选择上课门店"
      onClose={onClose}
      height="70vh"
      scrollable={false}
      fillHeight
    >
      <View className="px-[32rpx] pb-[24rpx] flex flex-col h-full min-h-0">
        {/* 校区列表 - 可滚动 */}
        <ScrollView scrollY className="flex-1 min-h-0" showScrollbar={false}>
          <View className="flex flex-col gap-[20rpx] pt-[8rpx] pb-[24rpx]">
            {sortedCampuses.map((campus) => {
              const isSelected = selectedId === campus.id;
              const isRecommended = recommendId === campus.id;
              return (
                <View
                  key={campus.id}
                  className={cn(
                    'relative flex items-center gap-[20rpx] p-[24rpx] rounded-[24rpx] border-[2rpx] border-solid transition-all duration-200',
                    isSelected ? 'bg-primary-bg border-primary' : 'bg-white border-border',
                  )}
                  onClick={() => handleSelect(campus)}
                >
                  {/* 推荐标签 */}
                  {isRecommended && (
                    <View className="absolute top-[12rpx] right-[12rpx] px-[12rpx] py-[2rpx] rounded-[8rpx] bg-primary/15">
                      <Text className="text-[20rpx] font-medium text-primary">推荐</Text>
                    </View>
                  )}

                  {/* 校区 Logo */}
                  <View
                    className="w-[88rpx] h-[88rpx] rounded-[16rpx] center overflow-hidden shrink-0 bg-[var(--campus-logo-gradient)]"
                    style={
                      {
                        '--campus-logo-gradient':
                          campus.iconGradient || 'linear-gradient(135deg, #5EC8A8, #4AB893)',
                      } as React.CSSProperties
                    }
                  >
                    {campus.logo ? (
                      <Image src={campus.logo} className="w-full h-full" mode="aspectFill" />
                    ) : (
                      <Text className="text-[40rpx]">{campus.icon || '🏢'}</Text>
                    )}
                  </View>

                  {/* 校区信息：名称 + 身份 */}
                  <View className="flex-1 min-w-0 pr-[60rpx]">
                    <Text className="text-[28rpx] font-semibold text-foreground truncate">
                      {campus.name}
                    </Text>
                    {roleLabel && (
                      <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
                        身份：{roleLabel}
                      </Text>
                    )}
                  </View>

                  {/* 选中标记 */}
                  <View
                    className={cn(
                      'w-[44rpx] h-[44rpx] rounded-full center shrink-0 transition-colors duration-200',
                      isSelected ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    {isSelected && <Icon name="mdi-check" size="xs" color="white" />}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* 底部按钮区 - 固定
            按钮下方预留 tabBar 高度 + iPhone 安全区 padding，避免被原生 tabBar 遮挡 */}
        <View className="pt-[24rpx]" style={{ paddingBottom: CAMPUS_SELECT_TABBAR_PADDING_BOTTOM }}>
          <View
            className="py-[28rpx] rounded-2xl text-center text-[30rpx] font-semibold bg-primary text-primary-foreground press-scale"
            onClick={handleConfirm}
          >
            进入该门店
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default CampusSelectSheet;
