/**
 * HomeCampusCard - 首页校区切换卡片
 *
 * 用于教师端/家长端首页顶部，展示当前校区信息、营业状态、地址、营业时间，
 * 以及门店标签与导航/电话操作。
 * 标签区布局策略（按标签数量自适应，目标：尽量单行）：
 *  - 标签 + 导航 + 电话 优先挤在同一行，通过"逐级变小"实现：
 *    完整文字（导航到店/联系电话）→ 缩 2 字（到店/电话）→ 纯图标，严格不跳级（有空间一定显示文字，带文字友好余量）
 *  - 仅在纯图标仍放不下时才换行：标签第一行均匀铺开，导航+电话整行换到下一行左对齐（两个一起换，绝不分裂）
 *  - 标签/按钮间统一最小间隔（≥4rpx，取 12rpx 保证美观，绝不贴在一起）
 * 高保真还原设计稿：左侧校区 Logo，中间为校区名/营业状态/地址，右侧为切换门店与营业时间。
 * 营业时间只出现在右列；未设置时右列不展示时段文案（状态标签已兜底），禁止挤到中间换行。
 */
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { BRAND_LOGO } from '@/constants/brand';
import type { CampusUIModel } from '@/types/campus';
import { resolveAvatarSrc } from '@/utils/avatar-src';
import type { CampusOpenStatus } from '@/utils/campus';
import {
  campusOpenStatusLabel,
  clampCampusDisplayName,
  clampCampusSingleLine,
  estimateCampusAddressMaxChars,
} from '@/utils/campus';

/** 微信 Text 单行省略：需显式 nowrap，仅靠 class 常失效 */
const SINGLE_LINE_TEXT_STYLE: React.CSSProperties = {
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  width: '100%',
  display: 'block',
};

export interface HomeCampusCardProps {
  /** 当前校区 */
  campus: CampusUIModel | null;
  /** 营业时间（已格式化，如 08:00-22:00） */
  businessTime: string;
  /** 营业状态：营业中 / 休息中 / 未设置 */
  openStatus: CampusOpenStatus;
  /** 点击切换门店按钮回调 */
  onSwitch: () => void;
  /** 卡片额外类名（如阴影样式） */
  className?: string;
}

const HomeCampusCard: React.FC<HomeCampusCardProps> = ({
  campus,
  businessTime,
  openStatus,
  onSwitch,
  className,
}) => {
  /** 点击「导航到店」，打开地图查看位置 */
  const handleOpenLocation = useCallback(() => {
    if (!campus?.latitude || !campus?.longitude) {
      Taro.showToast({ title: '暂无定位信息', icon: 'none' });
      return;
    }
    Taro.openLocation({
      latitude: campus.latitude,
      longitude: campus.longitude,
      name: campus.locationName || campus.name,
      address: campus.address,
      fail: () => {
        Taro.showToast({ title: '无法打开地图', icon: 'none' });
      },
    });
  }, [campus?.address, campus?.latitude, campus?.locationName, campus?.longitude, campus?.name]);

  /** 点击「联系电话」，拨打校区电话 */
  const handleCallPhone = useCallback(() => {
    if (!campus?.phone) {
      Taro.showToast({ title: '暂无联系电话', icon: 'none' });
      return;
    }
    Taro.makePhoneCall({
      phoneNumber: campus.phone,
      fail: () => {
        Taro.showToast({ title: '拨打电话失败', icon: 'none' });
      },
    });
  }, [campus?.phone]);

  const tags = useMemo(() => campus?.tags || [], [campus?.tags]);
  const hasPhone = Boolean(campus?.phone);

  const displayName = useMemo(() => {
    const raw = campus?.name || '未设置校区';
    return clampCampusDisplayName(raw, openStatus);
  }, [campus?.name, openStatus]);

  const displayAddress = useMemo(() => {
    const raw = campus?.address?.trim();
    if (!raw) return '';
    return clampCampusSingleLine(raw, estimateCampusAddressMaxChars());
  }, [campus?.address]);

  /** 无 logo / 加载失败 → sgpk，禁止 emoji/「?」占位 */
  const preferredLogo = resolveAvatarSrc(campus?.logo);
  const [logoSrc, setLogoSrc] = useState(preferredLogo);
  useEffect(() => {
    setLogoSrc(resolveAvatarSrc(campus?.logo));
  }, [campus?.logo]);

  // 标签区布局：尽量单行装下（标签 + 导航 + 电话）；
  // 仅在纯图标仍放不下时才换行（导航+电话整行左对齐，两个一起换，绝不分裂）。
  // "变小"策略：完整文字 → 缩为 2 字 → 纯图标，依次尝试，取第一个能塞进一行的方案。
  // 关键：估算"是否放得下"时把间隔视为 0（实际渲染由 justify-between 撑开，间隔 ≥12rpx 保证呼吸感）。
  const { mode, navLabel, callLabel } = useMemo(() => {
    // 中文字符实际渲染宽度比理论略大（含字间距/字体），取 30rpx 更接近 reality
    const TAG_TEXT_RPX = 30;
    const TAG_PAD_X = 12;
    const BTN_PAD_X = 16;
    const BTN_ICON = 24;
    const BTN_GAP = 6;

    const tagWidth = (t: string) => t.length * TAG_TEXT_RPX + TAG_PAD_X * 2;
    const btnWidth = (label: string) =>
      label
        ? BTN_PAD_X * 2 + BTN_ICON + BTN_GAP + label.length * TAG_TEXT_RPX
        : BTN_PAD_X * 2 + BTN_ICON;
    // 仅统计元素自身宽度；间隔由 justify-between 撑开，不纳入估算
    const rowWidth = (nav: string, call: string | null) => {
      const tagTotal = tags.reduce((s, t) => s + tagWidth(t), 0);
      const hasCall = call !== null; // 与渲染一致：空字符串（纯图标）仍渲染电话按钮
      const btnTotal = btnWidth(nav) + (hasCall ? btnWidth(call as string) : 0);
      return tagTotal + btnTotal;
    };

    const screenRpx = (Taro.getWindowInfo().windowWidth || 375) * 2;
    const contentRpx = screenRpx - 64; // 扣除卡片左右内边距后的可用宽度
    // 文字友好余量：判定"放得下"时多留一点空间，宁可边界处显示文字、也不轻易缩字/变图标
    const TEXT_FRIENDLY_MARGIN_RPX = 24;
    const fullCall = hasPhone ? '联系电话' : null;
    const compactCall = hasPhone ? '电话' : null;

    // 1) 完整文字  2) 缩 2 字  3) 纯图标 —— 严格按此顺序，取第一个能单行装下的（不跳级）
    // 字段名必须与外层解构 { mode, navLabel, callLabel } 严格对齐，否则渲染时按钮文字永远 undefined → 退回纯图标
    const candidates: Array<{ mode: CampusTagLayout; navLabel: string; callLabel: string | null }> =
      [
        { mode: 'row', navLabel: '导航到店', callLabel: fullCall },
        { mode: 'row-compact', navLabel: '到店', callLabel: compactCall },
        { mode: 'row-icon', navLabel: '', callLabel: hasPhone ? '' : null },
      ];
    for (const c of candidates) {
      if (rowWidth(c.navLabel, c.callLabel) <= contentRpx + TEXT_FRIENDLY_MARGIN_RPX) {
        return { mode: c.mode, navLabel: c.navLabel, callLabel: c.callLabel };
      }
    }
    // 彻底放不下：标签第一行均匀铺开，导航+电话一起换到下一行左对齐
    return { mode: 'split' as CampusTagLayout, navLabel: '导航到店', callLabel: fullCall };
  }, [tags, hasPhone]);

  return (
    <View className={cn('bg-white rounded-[32rpx] p-[24rpx] shadow-card', className)}>
      <View className="flex items-start gap-[20rpx]">
        {/* 校区 Logo */}
        <View className="h-[96rpx] w-[96rpx] shrink-0 overflow-hidden rounded-[24rpx] bg-white center">
          <Image
            src={logoSrc}
            className="block h-full w-full"
            mode="aspectFill"
            onError={() => {
              if (logoSrc !== BRAND_LOGO) setLogoSrc(BRAND_LOGO);
            }}
          />
        </View>

        {/*
          中间：店名+状态 / 地址（单行省略）
          右侧：切换门店 / 营业时间（与设计稿一致，禁止把营业时间挤到中间第三行）
        */}
        <View className="flex min-w-0 flex-1 items-start justify-between gap-[12rpx]">
          <View className="flex min-w-0 flex-1 flex-col gap-[8rpx] overflow-hidden">
            <View className="flex min-w-0 items-center gap-[12rpx] overflow-hidden">
              <View className="min-w-0 flex-1 overflow-hidden">
                <Text
                  numberOfLines={1}
                  className="block w-full text-[34rpx] font-bold text-foreground"
                  style={SINGLE_LINE_TEXT_STYLE}
                >
                  {displayName}
                </Text>
              </View>
              <View
                className={cn(
                  'flex shrink-0 items-center gap-[6rpx] rounded-[10rpx] px-[12rpx] py-[4rpx]',
                  openStatus === 'open' ? 'bg-success-bg' : 'bg-muted',
                )}
              >
                <View
                  className={cn(
                    'h-[12rpx] w-[12rpx] rounded-full',
                    openStatus === 'open' ? 'bg-success' : 'bg-muted-foreground',
                  )}
                />
                <Text
                  className={cn(
                    'text-[22rpx] font-medium',
                    openStatus === 'open' ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {campusOpenStatusLabel(openStatus)}
                </Text>
              </View>
            </View>

            {displayAddress ? (
              <View className="w-full min-w-0 overflow-hidden">
                <Text
                  numberOfLines={1}
                  className="block w-full text-[24rpx] text-muted-foreground"
                  style={SINGLE_LINE_TEXT_STYLE}
                >
                  {displayAddress}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="flex shrink-0 flex-col items-end gap-[8rpx]">
            <View className="flex items-center gap-[2rpx] press-scale" onClick={onSwitch}>
              <Text className="text-[28rpx] font-semibold text-foreground">切换门店</Text>
              <Icon name="mdi-chevron-down" size="sm" color="foreground" />
            </View>
            {/* 未设置用短横占位，不写「未设置」以免换行 */}
            <Text
              numberOfLines={1}
              className="max-w-[220rpx] text-right text-[22rpx] text-muted-foreground"
              style={SINGLE_LINE_TEXT_STYLE}
            >
              {businessTime || '—'}
            </Text>
          </View>
        </View>
      </View>

      <View className="h-[2rpx] bg-border my-[20rpx]" />

      {/* 门店标签 + 操作按钮：尽量单行；放不下时导航+电话一起换行右对齐 */}
      {mode === 'split' ? (
        <>
          <View className="flex flex-row items-center justify-between gap-[12rpx] mb-[16rpx]">
            {tags.map((tag) => (
              <TagChip key={tag} label={tag} />
            ))}
          </View>
          <View className="flex flex-row items-center justify-start gap-[12rpx]">
            <TagActionButton
              icon="mdi-map-marker-outline"
              label={navLabel}
              onClick={handleOpenLocation}
            />
            {callLabel !== null && (
              <TagActionButton icon="mdi-phone" label={callLabel} onClick={handleCallPhone} />
            )}
          </View>
        </>
      ) : (
        <View
          className={cn(
            'flex flex-row items-center gap-[12rpx]',
            tags.length === 0 ? 'justify-end' : 'justify-between',
          )}
        >
          {tags.map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
          <TagActionButton
            icon="mdi-map-marker-outline"
            label={navLabel}
            onClick={handleOpenLocation}
          />
          {callLabel !== null && (
            <TagActionButton icon="mdi-phone" label={callLabel} onClick={handleCallPhone} />
          )}
        </View>
      )}
    </View>
  );
};

/** 门店标签 chip：与操作按钮统一高度，保证视觉一致 */
const TagChip: React.FC<{ label: string }> = ({ label }) => (
  <View className="flex items-center px-[12rpx] h-[40rpx] rounded-[8rpx] bg-primary-bg shrink-0">
    <Text className="text-[24rpx] font-medium text-primary leading-none">{label}</Text>
  </View>
);

/** 校区卡片操作按钮：导航到店 / 联系电话（图标 + 可选文字） */
const TagActionButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <View
    className="flex items-center gap-[6rpx] px-[16rpx] h-[40rpx] rounded-[8rpx] bg-primary-bg press-scale shrink-0"
    onClick={onClick}
  >
    <Icon name={icon} size="xs" color="primary" />
    {label ? <Text className="text-[24rpx] text-primary leading-none">{label}</Text> : null}
  </View>
);

/** 标签区布局模式 */
type CampusTagLayout = 'row' | 'row-compact' | 'row-icon' | 'split';

export default HomeCampusCard;
