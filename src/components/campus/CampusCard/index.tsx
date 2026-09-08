/**
 * CampusCard - 校区卡片组件
 *
 * 用于分校区管理页，展示校区基本信息、统计数据和操作入口。
 *
 * 设计定稿（对齐 campus-settings.html）：
 * - 右上角三角装饰 + 小圆点
 * - 三点菜单：使用原生 ActionSheet 弹出操作项
 * - 合作校区有 partner-info 标签行（分成比例、师资等）
 * - 统计行：学生/教师/月营收
 * - 底部独立一行：运营数据 →（蓝色带横线箭头）
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo } from 'react';
import Icon from '@/components/Icon';
import { CAMPUS_TYPE_MAP, PARTNER_MODE_MAP } from '@/constants/campus-ui';
import type { CampusUIModel } from '@/types/campus';

export interface CampusCardProps {
  /** 校区数据 */
  campus: CampusUIModel;
  /** 点击运营数据入口 */
  onDataClick?: (id: string) => void;
  /** 设为主校区 */
  onSetMain?: (id: string) => void;
  /** 编辑校区 */
  onEdit?: (id: string) => void;
  /** 删除校区 */
  onDelete?: (id: string) => void;
}

const CampusCard: React.FC<CampusCardProps> = ({ campus, onSetMain, onEdit, onDelete }) => {
  const typeInfo = useMemo(
    () => CAMPUS_TYPE_MAP[campus.type] || CAMPUS_TYPE_MAP.self,
    [campus.type],
  );

  const partnerModeText = useMemo(
    () => (campus.partnerMode ? PARTNER_MODE_MAP[campus.partnerMode] : ''),
    [campus.partnerMode],
  );

  /** 三点菜单 — 使用原生 ActionSheet */
  const handleMenuClick = useCallback(async () => {
    const items: string[] = [];
    const actions: (() => void)[] = [];

    if (!campus.isMain && onSetMain) {
      items.push('设为主校区');
      actions.push(() => onSetMain(campus.id));
    }
    if (onEdit) {
      items.push('编辑');
      actions.push(() => onEdit(campus.id));
    }
    if (!campus.isMain && onDelete) {
      items.push('删除');
      actions.push(() => onDelete(campus.id));
    }

    if (items.length === 0) return;

    try {
      const { tapIndex } = await Taro.showActionSheet({
        itemList: items,
        itemColor: '#333',
        fail: () => {
          // 用户取消时忽略
        },
      });
      actions[tapIndex]?.();
    } catch {
      // 用户取消，不做处理
    }
  }, [campus.id, campus.isMain, onSetMain, onEdit, onDelete]);

  /** 点击地址/定位图标，打开地图查看位置 */
  const handleOpenLocation = useCallback(() => {
    if (!campus.latitude || !campus.longitude) {
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
  }, [campus.address, campus.latitude, campus.locationName, campus.longitude, campus.name]);

  return (
    <View className="relative bg-white rounded-[40rpx] shadow-soft p-[44rpx] mb-[20rpx] overflow-hidden border-[2rpx] border-border">
      {/* 右上角三角装饰 + 小圆点 */}
      <View
        className="absolute top-0 right-0 w-[160rpx] h-[160rpx] rounded-br-[40rpx]"
        style={{
          background:
            campus.type === 'partner'
              ? 'linear-gradient(135deg, transparent 50%, hsl(43 74% 66% / 0.1) 50%)'
              : 'linear-gradient(135deg, transparent 50%, hsl(168 55% 58% / 0.08) 50%)',
        }}
      />
      <View
        className="absolute top-[24rpx] right-[24rpx] w-[16rpx] h-[16rpx] rounded-full"
        style={{
          background:
            campus.type === 'partner' ? 'hsl(43 74% 66% / 0.4)' : 'hsl(168 55% 58% / 0.4)',
        }}
      />

      {/* Header 行：图标 + 名称 + 类型标签 + 三点菜单 */}
      <View className="flex flex-row items-center relative z-1">
        {/* 校区图标 — 设计稿：48px/圆角14px/字号24px */}
        <View
          className="w-[96rpx] h-[96rpx] rounded-[28rpx] flex items-center justify-center mr-[28rpx] flex-shrink-0"
          style={{
            background: campus.iconGradient,
            boxShadow:
              campus.type === 'partner'
                ? '0 8rpx 24rpx hsl(43 74% 66% / 0.3)'
                : '0 8rpx 24rpx hsl(168 55% 58% / 0.3)',
          }}
        >
          <Text className="text-[48rpx] text-white">{campus.icon}</Text>
        </View>

        {/* 校区信息 */}
        <View className="flex-1 min-w-0">
          <Text className="text-[32rpx] font-bold text-foreground truncate">{campus.name}</Text>
          {/* 铭牌 — 设计稿：.campus-type-tag / inline-flex / gap:4px / padding:2px 8px / 圆角6px / 字号10px/600 / ::before 5px圆点 */}
          <View className="flex flex-row items-center gap-[8rpx] mt-[6rpx]">
            <View
              className={cn(
                'flex flex-row items-center gap-[8rpx] px-[16rpx] py-[4rpx] rounded-[12rpx]',
                campus.isMain ? 'bg-amber-10' : typeInfo.tagBg,
              )}
            >
              <View
                className={cn(
                  'w-[10rpx] h-[10rpx] rounded-full',
                  campus.isMain ? 'bg-amber' : typeInfo.dotColor,
                )}
              />
              <Text
                className={cn(
                  'text-[20rpx] font-semibold',
                  campus.isMain ? 'text-amber' : typeInfo.tagText,
                )}
              >
                {campus.isMain ? '主校区' : typeInfo.label}
              </Text>
            </View>
            {partnerModeText && (
              <View className="bg-muted px-[16rpx] py-[4rpx] rounded-[12rpx]">
                <Text className="text-[20rpx] text-muted-foreground">· {partnerModeText}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 三点菜单按钮 */}
        <View
          className="w-[56rpx] h-[56rpx] flex items-center justify-center rounded-full press-bg flex-shrink-0"
          onClick={handleMenuClick}
        >
          <Icon name="mdi-dots-vertical" size="md" color="muted" />
        </View>
      </View>

      {/* 合作校区标签行 */}
      {campus.type === 'partner' && campus.partnerTags && campus.partnerTags.length > 0 && (
        <View className="flex flex-row flex-wrap gap-[12rpx] mt-[16rpx]">
          {campus.partnerTags.map((tag, idx) => (
            <View key={idx} className="bg-amber-10 px-[16rpx] py-[6rpx] rounded-[8rpx]">
              <Text className="text-[22rpx] text-amber font-medium">{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 地址 / 定位 — 有点击值才显示，点击打开地图 */}
      {(campus.address || campus.locationName) && (
        <View
          className="flex flex-row items-center gap-[12rpx] mt-[16rpx] press-bg -mx-[12rpx] px-[12rpx] py-[8rpx] rounded-[16rpx]"
          onClick={handleOpenLocation}
        >
          <Icon name="mdi-map-marker" size="sm" color="primary" />
          <Text className="text-[24rpx] text-muted-foreground flex-1 truncate">
            {campus.locationName || campus.address}
          </Text>
          {campus.latitude && campus.longitude && (
            <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
          )}
        </View>
      )}

      {/* 电话 — 有值才显示 */}
      {campus.phone && (
        <View className="flex flex-row items-center gap-[12rpx] mt-[16rpx]">
          <Icon name="mdi-phone" size="sm" color="primary" />
          <Text className="text-[24rpx] text-muted-foreground">{campus.phone}</Text>
        </View>
      )}

      {/* 统计：后端尚未提供校区维度聚合，避免展示全 0 假数据 */}
      <View className="mt-[24rpx] pt-[28rpx] border-t-d5e8e0 flex flex-col items-center">
        <Text className="text-[26rpx] text-muted-foreground">暂无统计</Text>
        <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">
          学员 / 教师 / 营收汇总即将开放
        </Text>
      </View>

      {/* 底部：运营数据入口（只读提示，避免假成功页） */}
      <View className="flex flex-row items-center justify-end gap-[8rpx] pt-[28rpx] mt-[28rpx] border-t-d5e8e0">
        <Text className="text-[22rpx] text-muted-foreground font-medium">运营数据 · 即将开放</Text>
      </View>
    </View>
  );
};

export default CampusCard;
