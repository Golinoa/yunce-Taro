/**
 * ProfileStats - 个人中心数据概览卡片
 *
 * 以横向等分布局展示 3~4 项关键指标，支持两种排版：
 * - value-top: 数值在上、标签在下（默认，旧版风格）
 * - label-top: 标签在上、数值在下（对齐参考设计稿「我的」页面）
 * 指标之间用细线分隔。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

export interface StatItem {
  /** 指标数值 */
  value: string | number;
  /** 指标标签 */
  label: string;
  /** 数值单位，如"次"/"天"/"元" */
  unit?: string;
}

export interface ProfileStatsProps {
  /** 指标列表 */
  items: StatItem[];
  /** 点击整个卡片 */
  onClick?: () => void;
  /** 排版方向 */
  layout?: 'value-top' | 'label-top';
  /** 额外类名 */
  className?: string;
}

const ProfileStats: React.FC<ProfileStatsProps> = ({
  items,
  onClick,
  layout = 'value-top',
  className,
}) => {
  const isLabelTop = layout === 'label-top';

  return (
    <View
      className={cn(
        'mx-[32rpx] px-[24rpx] py-[28rpx] rounded-[24rpx] bg-card shadow-profile-stats',
        onClick && 'active:bg-muted',
        className,
      )}
      onClick={onClick}
    >
      <View className="flex items-center">
        {items.map((item, idx) => (
          <React.Fragment key={item.label}>
            <View className="flex-1 text-center">
              {isLabelTop ? (
                <>
                  <Text className="text-[24rpx] text-muted-foreground block">{item.label}</Text>
                  <View className="mt-[14rpx] flex items-baseline justify-center">
                    <Text className="text-[48rpx] font-bold text-foreground">{item.value}</Text>
                    {item.unit && (
                      <Text className="text-[22rpx] font-normal text-muted-foreground ml-[6rpx]">
                        {item.unit}
                      </Text>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <Text className="text-[44rpx] font-bold text-foreground block">{item.value}</Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] block">
                    {item.label}
                  </Text>
                </>
              )}
            </View>
            {idx < items.length - 1 && <View className="w-[2rpx] h-[52rpx] bg-border-light" />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

export default ProfileStats;
