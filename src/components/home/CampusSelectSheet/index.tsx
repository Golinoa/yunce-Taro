import { View, Text, Image, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import { ROLE_LABEL } from '@/components/RoleCard';
import { BRAND_LOGO } from '@/constants/brand';
import type { CampusUIModel } from '@/types/campus';
import type { UserRole } from '@/types/profile';
import type { ParentStorefrontItem } from '@/types/storefront';
import { isPrincipalOrAbove } from '@/utils/auth';
import { resolveAvatarSrc } from '@/utils/avatar-src';
import {
  formatStorefrontStudents,
  formatStorefrontTitle,
  storefrontKeyOf,
} from '@/utils/parent-storefront';

export interface CampusSelectSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 当前选中的校区 ID（员工模式） */
  currentId?: string;
  /** 当前用户角色（用于显示身份标签 & 判断是否走推荐逻辑） */
  currentRole?: UserRole | null;
  /** 校区列表（员工模式） */
  campuses: CampusUIModel[];
  /** 管理员校区 ID 列表（用于决定是否推荐最近一次访问的店） */
  managedCampusIds?: string[];
  /** 上次访问的校区 ID（用于推荐位） */
  lastVisitedId?: string;
  /**
   * 家长门店列表。传入非空数组时走家长模式（机构·校区）；
   * 未传或空数组且 visible 时由页面控制是否打开。
   */
  storefronts?: ParentStorefrontItem[];
  /** 家长模式当前选中 key：organizationId:campusId */
  currentStorefrontKey?: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 员工确认选择 */
  onConfirm: (campus: CampusUIModel) => void;
  /** 家长确认选择 */
  onConfirmStorefront?: (item: ParentStorefrontItem) => void;
  /** 确认中（防连点） */
  confirming?: boolean;
}

const CAMPUS_SELECT_TABBAR_PADDING_BOTTOM = 'calc(100rpx + env(safe-area-inset-bottom))';

/**
 * CampusSelectSheet - 首页校区/门店切换底部弹窗
 *
 * 员工：校区列表 + 校长推荐位；家长：扁平「机构 · 校区」门店列表。
 */
const CampusSelectSheet: React.FC<CampusSelectSheetProps> = ({
  visible,
  currentId,
  currentRole,
  campuses,
  managedCampusIds = [],
  lastVisitedId,
  storefronts,
  currentStorefrontKey,
  onClose,
  onConfirm,
  onConfirmStorefront,
  confirming = false,
}) => {
  const roleLabel = currentRole ? ROLE_LABEL[currentRole] : null;
  const isStorefrontMode = Array.isArray(storefronts) && storefronts.length > 0;

  const { sortedCampuses, recommendId } = useMemo(() => {
    if (isStorefrontMode) {
      return { sortedCampuses: [] as CampusUIModel[], recommendId: null as string | null };
    }

    const currentCampus = currentId ? campuses.find((c) => c.id === currentId) : undefined;

    const canRecommend =
      isPrincipalOrAbove(currentRole) &&
      managedCampusIds.length > 1 &&
      !!lastVisitedId &&
      lastVisitedId !== currentId &&
      managedCampusIds.includes(lastVisitedId);

    const recommendCampus = canRecommend ? campuses.find((c) => c.id === lastVisitedId) : undefined;

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
  }, [isStorefrontMode, campuses, currentId, currentRole, managedCampusIds, lastVisitedId]);

  const sortedStorefronts = useMemo(() => {
    if (!isStorefrontMode || !storefronts) return [] as ParentStorefrontItem[];
    const current = currentStorefrontKey
      ? storefronts.find((s) => storefrontKeyOf(s) === currentStorefrontKey)
      : undefined;
    if (!current) return storefronts;
    const rest = storefronts.filter((s) => storefrontKeyOf(s) !== currentStorefrontKey);
    return [current, ...rest];
  }, [isStorefrontMode, storefronts, currentStorefrontKey]);

  const initialSelectedId = isStorefrontMode
    ? currentStorefrontKey || (sortedStorefronts[0] ? storefrontKeyOf(sortedStorefronts[0]) : '')
    : currentId || sortedCampuses[0]?.id || '';
  const [selectedId, setSelectedId] = useState<string>(initialSelectedId);

  useEffect(() => {
    if (!visible) return;
    if (isStorefrontMode) {
      setSelectedId(
        currentStorefrontKey || (sortedStorefronts[0] ? storefrontKeyOf(sortedStorefronts[0]) : ''),
      );
      return;
    }
    setSelectedId(currentId || sortedCampuses[0]?.id || '');
  }, [
    visible,
    isStorefrontMode,
    currentId,
    currentStorefrontKey,
    sortedCampuses,
    sortedStorefronts,
  ]);

  const handleConfirm = () => {
    if (confirming) return;
    if (isStorefrontMode) {
      const selected = sortedStorefronts.find((item) => storefrontKeyOf(item) === selectedId);
      if (selected && onConfirmStorefront) {
        onConfirmStorefront(selected);
      }
      return;
    }
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
        <ScrollView scrollY className="flex-1 min-h-0" showScrollbar={false}>
          <View className="flex flex-col gap-[20rpx] pt-[8rpx] pb-[24rpx]">
            {isStorefrontMode
              ? sortedStorefronts.map((item) => {
                  const key = storefrontKeyOf(item);
                  const isSelected = selectedId === key;
                  const subtitle = formatStorefrontStudents(item);
                  return (
                    <View
                      key={key}
                      className={cn(
                        'relative flex items-center gap-[20rpx] p-[24rpx] rounded-[24rpx] border-[2rpx] border-solid transition-all duration-200',
                        isSelected ? 'bg-primary-bg border-primary' : 'bg-white border-border',
                      )}
                      onClick={() => setSelectedId(key)}
                    >
                      <CampusLogoThumb logo={null} />
                      <View className="flex-1 min-w-0 pr-[60rpx]">
                        <Text className="text-[28rpx] font-semibold text-foreground truncate">
                          {formatStorefrontTitle(item)}
                        </Text>
                        {subtitle ? (
                          <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
                            {subtitle}
                          </Text>
                        ) : roleLabel ? (
                          <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
                            身份：{roleLabel}
                          </Text>
                        ) : null}
                      </View>
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
                })
              : sortedCampuses.map((campus) => {
                  const isSelected = selectedId === campus.id;
                  const isRecommended = recommendId === campus.id;
                  return (
                    <View
                      key={campus.id}
                      className={cn(
                        'relative flex items-center gap-[20rpx] p-[24rpx] rounded-[24rpx] border-[2rpx] border-solid transition-all duration-200',
                        isSelected ? 'bg-primary-bg border-primary' : 'bg-white border-border',
                      )}
                      onClick={() => setSelectedId(campus.id)}
                    >
                      {isRecommended && (
                        <View className="absolute top-[12rpx] right-[12rpx] px-[12rpx] py-[2rpx] rounded-[8rpx] bg-primary/15">
                          <Text className="text-[20rpx] font-medium text-primary">推荐</Text>
                        </View>
                      )}

                      <CampusLogoThumb logo={campus.logo} />

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

        <View className="pt-[24rpx]" style={{ paddingBottom: CAMPUS_SELECT_TABBAR_PADDING_BOTTOM }}>
          <View
            className={cn(
              'py-[28rpx] rounded-2xl text-center text-[30rpx] font-semibold bg-primary text-primary-foreground press-scale',
              confirming && 'opacity-60',
            )}
            onClick={handleConfirm}
          >
            {confirming ? '切换中…' : '进入该门店'}
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

/** 校区列表缩略 Logo：无图 / 加载失败 → sgpk，不用 emoji */
const CampusLogoThumb: React.FC<{ logo?: string | null }> = ({ logo }) => {
  const preferred = resolveAvatarSrc(logo);
  const [src, setSrc] = useState(preferred);
  useEffect(() => {
    setSrc(resolveAvatarSrc(logo));
  }, [logo]);

  return (
    <View className="w-[88rpx] h-[88rpx] rounded-[16rpx] center overflow-hidden shrink-0 bg-white">
      <Image
        src={src}
        className="w-full h-full block"
        mode="aspectFill"
        onError={() => {
          if (src !== BRAND_LOGO) setSrc(BRAND_LOGO);
        }}
      />
    </View>
  );
};

export default CampusSelectSheet;
