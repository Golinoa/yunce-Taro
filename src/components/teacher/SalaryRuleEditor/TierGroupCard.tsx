import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Switch from '@/components/Switch';
import type { CalcMethod, FeeBasis, LessonTierGroup } from '@/types/teacher';
import { CALC_METHOD_OPTIONS, FEE_BASIS_OPTIONS } from './constants';
import GradientRow from './GradientRow';

export interface BasisCalcTabsProps {
  basis: FeeBasis;
  calc: CalcMethod;
  onBasis: (basis: FeeBasis) => void;
  onCalc: (calc: CalcMethod) => void;
}

export const BasisCalcTabs: React.FC<BasisCalcTabsProps> = ({ basis, calc, onBasis, onCalc }) => (
  <View className="mt-[8rpx]">
    <View className="flex items-center justify-between mb-[12rpx]">
      <Text className="text-[26rpx] text-muted-foreground shrink-0 mr-[16rpx]">计费口径：</Text>
      <View className="flex flex-1 gap-[12rpx]">
        {FEE_BASIS_OPTIONS.map((o) => {
          const active = o.value === basis;
          return (
            <View
              key={o.value}
              className={cn(
                'flex-1 py-[12rpx] text-center rounded-[14rpx] text-[24rpx] font-medium',
                active ? 'bg-primary text-white shadow-sm' : 'bg-muted text-muted-foreground',
              )}
              onClick={() => onBasis(o.value)}
            >
              {o.label}
            </View>
          );
        })}
      </View>
    </View>
    <View className="flex items-center justify-between">
      <Text className="text-[26rpx] text-muted-foreground shrink-0 mr-[16rpx]">计算方式：</Text>
      <View className="flex flex-1 gap-[12rpx]">
        {CALC_METHOD_OPTIONS.map((o) => {
          const active = o.value === calc;
          return (
            <View
              key={o.value}
              className={cn(
                'flex-1 py-[12rpx] text-center rounded-[14rpx] text-[24rpx] font-medium',
                active ? 'bg-primary text-white shadow-sm' : 'bg-muted text-muted-foreground',
              )}
              onClick={() => onCalc(o.value)}
            >
              {o.label}
            </View>
          );
        })}
      </View>
    </View>
    <View className="mt-[8rpx]">
      <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
        {calc === 'tier_unified'
          ? '全部按最高档：当月所有课时统一按最终达到的梯度标准结算。'
          : '分段累加：不同区间分别按各自档位标准计算，再相加。'}
      </Text>
    </View>
  </View>
);

export interface TierGroupCardProps {
  group: LessonTierGroup;
  errors?: Record<string, { threshold?: string; rate?: string }>;
  onToggle: (on: boolean) => void;
  onBasis: (basis: FeeBasis) => void;
  onCalc: (calc: CalcMethod) => void;
  onTierChange: (tierId: string, key: 'threshold' | 'rate', raw: string) => void;
  onTierDelete: (tierId: string) => void;
  onAddTier: () => void;
}

const TierGroupCard: React.FC<TierGroupCardProps> = ({
  group,
  errors,
  onToggle,
  onBasis,
  onCalc,
  onTierChange,
  onTierDelete,
  onAddTier,
}) => {
  const isHours = group.feeBasis === 'hours';
  return (
    <View className="rounded-[24rpx] bg-muted/40 p-[20rpx] mb-[16rpx]">
      <View className="flex items-center justify-between mb-[12rpx]">
        <Text className="text-[28rpx] font-semibold text-foreground">{group.name}</Text>
        <Switch checked={group.enabled} onChange={onToggle} />
      </View>
      {group.enabled && (
        <View>
          <BasisCalcTabs
            basis={group.feeBasis}
            calc={group.calcMethod}
            onBasis={onBasis}
            onCalc={onCalc}
          />
          {group.tiers.map((t, idx) => (
            <GradientRow
              key={t.id}
              fields={
                isHours
                  ? [
                      {
                        key: 'threshold',
                        label: '满',
                        suffix: '节起,',
                        error: errors?.[t.id]?.threshold,
                      },
                      { key: 'rate', label: '', suffix: '元/节', error: errors?.[t.id]?.rate },
                    ]
                  : [
                      {
                        key: 'threshold',
                        label: '满',
                        suffix: '元业绩起,',
                        error: errors?.[t.id]?.threshold,
                      },
                      { key: 'rate', label: '', suffix: '%', error: errors?.[t.id]?.rate },
                    ]
              }
              values={{ threshold: String(t.threshold ?? ''), rate: String(t.rate ?? '') }}
              onChange={(key, raw) => onTierChange(t.id, key as 'threshold' | 'rate', raw)}
              showDelete={group.tiers.length > 1 || idx > 0}
              onDelete={() => onTierDelete(t.id)}
            />
          ))}
          <GradientRow asAddButton onAdd={onAddTier} />
        </View>
      )}
    </View>
  );
};

export default TierGroupCard;
