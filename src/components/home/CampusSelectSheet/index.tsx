import { View, Text, Image, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import { BRAND_LOGO } from '@/constants/brand';
import { displayUserRoleLabel } from '@/constants/role-glossary';
import { useRoleGlossaryStore } from '@/stores/role-glossary';
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
import type { SessionIdentityType } from '@/utils/session-identity';

export interface CampusSelectSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 当前选中的校区 ID（员工模式） */
  currentId?: string;
  /** 当前用户角色（用于判断是否走推荐逻辑） */
  currentRole?: UserRole | null;
  /** 校区列表（员工身份，教师端） */
  campuses: CampusUIModel[];
  /** 管理员校区 ID 列表（用于决定是否推荐最近一次访问的店） */
  managedCampusIds?: string[];
  /** 上次访问的校区 ID（用于推荐位） */
  lastVisitedId?: string;
  /** 家长门店列表（家长身份，家长端）。与 campuses 可同时非空 = 兼身份 */
  storefronts?: ParentStorefrontItem[];
  /** 家长模式当前选中 key：organizationId:campusId */
  currentStorefrontKey?: string;
  /** 机构名：员工行标题与家长行「机构 · 校区」对齐 */
  organizationName?: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 员工确认选择（identity 为本次进入的端） */
  onConfirm: (campus: CampusUIModel, identity: SessionIdentityType) => void;
  /** 家长确认选择（identity 为本次进入的端） */
  onConfirmStorefront?: (item: ParentStorefrontItem, identity: SessionIdentityType) => void;
  /** 确认中（防连点） */
  confirming?: boolean;
}

const CAMPUS_SELECT_TABBAR_PADDING_BOTTOM = 'calc(100rpx + env(safe-area-inset-bottom))';

/** 一个可进入的端：机构·校区 + 身份。兼身份时同一校区会出现两行（教师端 / 家长端） */
type SelectEntry = {
  key: string;
  title: string;
  subtitle?: string;
  logo?: string | null;
  identity: SessionIdentityType;
  campus?: CampusUIModel;
  storefront?: ParentStorefrontItem;
};

const IDENTITY_LABEL: Record<SessionIdentityType, string> = {
  staff: '老师',
  parent: '家长',
};

/**
 * CampusSelectSheet - 首页校区/门店切换底部弹窗
 *
 * 2026-09-25：教师端与家长端不混合使用。列表改为扁平的「机构·校区 × 身份」，
 * 兼身份的用户会看到同一校区下的「老师」「家长」两行，点哪行就进哪个端。
 * 仅单一身份时不显示身份后缀（避免打扰绝大多数用户）。
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
  organizationName,
  onClose,
  onConfirm,
  onConfirmStorefront,
  confirming = false,
}) => {
  const titles = useRoleGlossaryStore((s) => s.titles);
  const roleLabel = currentRole ? displayUserRoleLabel(currentRole, titles) : null;

  const entries = useMemo(() => {
    const staffEntries: SelectEntry[] = campuses.map((campus) => ({
      key: `staff:${campus.id}`,
      title: organizationName ? `${organizationName} · ${campus.name}` : campus.name,
      logo: campus.logo,
      identity: 'staff' as const,
      campus,
    }));

    const parentEntries: SelectEntry[] = (storefronts ?? []).map((item) => ({
      key: `parent:${storefrontKeyOf(item)}`,
      title: formatStorefrontTitle(item),
      subtitle: formatStorefrontStudents(item) || undefined,
      logo: null,
      identity: 'parent' as const,
      storefront: item,
    }));

    return [...staffEntries, ...parentEntries];
  }, [campuses, storefronts, organizationName]);

  // 兼身份：既有员工校区又有家长门店。只有此时才显示身份后缀，否则列表保持原样。
  const hasDualIdentity = useMemo(
    () => campuses.length > 0 && (storefronts?.length ?? 0) > 0,
    [campuses.length, storefronts],
  );

  const canRecommend =
    isPrincipalOrAbove(currentRole) &&
    managedCampusIds.length > 1 &&
    !!lastVisitedId &&
    lastVisitedId !== currentId &&
    managedCampusIds.includes(lastVisitedId);

  const sortedEntries = useMemo(() => {
    // 当前所在端置顶；校长的最近访问校区次之（仅员工行有推荐位）
    const currentKey = currentStorefrontKey
      ? `parent:${currentStorefrontKey}`
      : currentId
        ? `staff:${currentId}`
        : '';
    const recommendKey = canRecommend && lastVisitedId ? `staff:${lastVisitedId}` : '';

    const headKeys = new Set<string>();
    const head: SelectEntry[] = [];
    for (const key of [currentKey, recommendKey]) {
      if (!key) continue;
      const hit = entries.find((e) => e.key === key);
      if (hit) {
        head.push(hit);
        headKeys.add(key);
      }
    }
    return [...head, ...entries.filter((e) => !headKeys.has(e.key))];
  }, [entries, currentId, currentStorefrontKey, canRecommend, lastVisitedId]);

  const initialSelectedKey = sortedEntries[0]?.key ?? '';
  const [selectedKey, setSelectedKey] = useState<string>(initialSelectedKey);

  useEffect(() => {
    if (!visible) return;
    setSelectedKey(sortedEntries[0]?.key ?? '');
  }, [visible, sortedEntries]);

  const handleConfirm = () => {
    if (confirming) return;
    const selected = sortedEntries.find((item) => item.key === selectedKey);
    if (!selected) return;

    if (selected.identity === 'parent') {
      if (selected.storefront && onConfirmStorefront) {
        onConfirmStorefront(selected.storefront, 'parent');
      }
      return;
    }
    if (selected.campus) {
      onConfirm(selected.campus, 'staff');
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
            {sortedEntries.map((entry) => {
              const isSelected = selectedKey === entry.key;
              const identityText = hasDualIdentity ? IDENTITY_LABEL[entry.identity] : null;
              const subtitle = identityText
                ? `身份：${identityText}`
                : (entry.subtitle ?? (roleLabel ? `身份：${roleLabel}` : null));
              return (
                <View
                  key={entry.key}
                  className={cn(
                    'relative flex items-center gap-[20rpx] p-[24rpx] rounded-[24rpx] border-[2rpx] border-solid transition-all duration-200',
                    isSelected ? 'bg-primary-bg border-primary' : 'bg-white border-border',
                  )}
                  onClick={() => setSelectedKey(entry.key)}
                >
                  <CampusLogoThumb logo={entry.logo} />

                  <View className="flex-1 min-w-0 pr-[60rpx]">
                    <Text className="text-[28rpx] font-semibold text-foreground truncate">
                      {entry.title}
                    </Text>
                    {subtitle ? (
                      <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
                        {subtitle}
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
