import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import type {
  CalcMethod,
  CategoryFeeAlgorithm,
  CategoryLessonFee,
  FeeBasis,
  PerfPayoutMode,
} from '@/types/teacher';
import { CATEGORY_ALGORITHM_OPTIONS, PERF_PAYOUT_OPTIONS } from './constants';
import GradientRow from './GradientRow';
import { BasisCalcTabs } from './TierGroupCard';

export interface CategoryLessonFeeCardProps {
  item: CategoryLessonFee;
  errors?: {
    fixedRate?: string;
    tiers?: Record<string, { threshold?: string; rate?: string }>;
    perfTiers?: Record<string, { threshold?: string; rate?: string }>;
  };
  onAlgorithmChange: (id: string, algorithm: CategoryFeeAlgorithm) => void;
  onFixedRateChange: (id: string, raw: string) => void;
  onBasisChange: (id: string, basis: FeeBasis) => void;
  onCalcChange: (id: string, method: CalcMethod) => void;
  onPerfPayoutChange: (id: string, mode: PerfPayoutMode) => void;
  onTierChange: (id: string, tierId: string, key: 'threshold' | 'rate', raw: string) => void;
  onAddTier: (id: string) => void;
  onDeleteTier: (id: string, tierId: string) => void;
  onPerfTierChange: (id: string, tierId: string, key: 'threshold' | 'rate', raw: string) => void;
  onAddPerfTier: (id: string) => void;
  onDeletePerfTier: (id: string, tierId: string) => void;
}

const CategoryLessonFeeCard: React.FC<CategoryLessonFeeCardProps> = ({
  item,
  errors,
  onAlgorithmChange,
  onFixedRateChange,
  onBasisChange,
  onCalcChange,
  onPerfPayoutChange,
  onTierChange,
  onAddTier,
  onDeleteTier,
  onPerfTierChange,
  onAddPerfTier,
  onDeletePerfTier,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasError = Boolean(
    errors?.fixedRate ||
      Object.keys(errors?.tiers || {}).length > 0 ||
      Object.keys(errors?.perfTiers || {}).length > 0,
  );

  useEffect(() => {
    if (hasError) setExpanded(true);
  }, [hasError]);

  return (
    <View className="rounded-[24rpx] bg-muted/40 p-[20rpx]">
      <View
        className="flex items-center justify-between"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <Text className="text-[28rpx] font-semibold text-foreground">{item.name}</Text>
        <Icon
          name={expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}
          size={24}
          className="text-muted-foreground"
        />
      </View>

      {expanded && (
        <View className="mt-[16rpx]">
          <View className="flex flex-wrap gap-[12rpx] mb-[16rpx]">
            {CATEGORY_ALGORITHM_OPTIONS.map((o) => {
              const active = o.value === item.algorithm;
              return (
                <View
                  key={o.value}
                  className={cn(
                    'px-[20rpx] py-[10rpx] rounded-full text-[24rpx] font-medium border-[2rpx]',
                    active
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-white border-border text-muted-foreground',
                  )}
                  onClick={() => onAlgorithmChange(item.id, o.value)}
                >
                  {o.label}
                </View>
              );
            })}
          </View>

          {item.algorithm === 'fixed' && (
            <View className="flex items-center gap-[12rpx]">
              <Text className="text-[28rpx] text-foreground whitespace-nowrap">该分类每节</Text>
              <FormInput
                variant="ghost"
                type="digit"
                placeholder="0"
                suffix={<Text className="text-[26rpx] text-muted-foreground ml-[4rpx]">元/节</Text>}
                value={String(item.fixedRate ?? '')}
                onInput={(e) => onFixedRateChange(item.id, e.detail.value)}
                inputClassName="w-[180rpx] h-[72rpx] bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-right"
                className="mb-0"
              />
              {errors?.fixedRate && (
                <Text className="text-[24rpx] text-error">{errors.fixedRate}</Text>
              )}
            </View>
          )}

          {item.algorithm === 'tier' && (
            <View className="flex flex-col">
              <BasisCalcTabs
                basis={item.feeBasis}
                calc={item.calcMethod}
                onBasis={(b) => onBasisChange(item.id, b)}
                onCalc={(c) => onCalcChange(item.id, c)}
              />
              {item.tiers.map((t, idx) => (
                <GradientRow
                  key={t.id}
                  fields={
                    item.feeBasis === 'hours'
                      ? [
                          {
                            key: 'threshold',
                            label: '满',
                            suffix: '节起,',
                            error: errors?.tiers?.[t.id]?.threshold,
                          },
                          {
                            key: 'rate',
                            label: '',
                            suffix: '元/节',
                            error: errors?.tiers?.[t.id]?.rate,
                          },
                        ]
                      : [
                          {
                            key: 'threshold',
                            label: '满',
                            suffix: '元业绩起,',
                            error: errors?.tiers?.[t.id]?.threshold,
                          },
                          {
                            key: 'rate',
                            label: '',
                            suffix: '%',
                            error: errors?.tiers?.[t.id]?.rate,
                          },
                        ]
                  }
                  values={{ threshold: String(t.threshold ?? ''), rate: String(t.rate ?? '') }}
                  onChange={(k, raw) => onTierChange(item.id, t.id, k as 'threshold' | 'rate', raw)}
                  showDelete={item.tiers.length > 1 || idx > 0}
                  onDelete={() => onDeleteTier(item.id, t.id)}
                />
              ))}
              <GradientRow asAddButton onAdd={() => onAddTier(item.id)} />
            </View>
          )}

          {item.algorithm === 'perf' && (
            <View className="flex flex-col">
              <View className="flex items-center gap-[12rpx] mb-[12rpx]">
                <Text className="text-[26rpx] text-muted-foreground shrink-0">到档发放：</Text>
                <View className="flex flex-1 gap-[12rpx]">
                  {PERF_PAYOUT_OPTIONS.map((o) => {
                    const active = o.value === item.perfPayoutMode;
                    return (
                      <View
                        key={o.value}
                        className={cn(
                          'flex-1 py-[10rpx] text-center rounded-[14rpx] text-[24rpx] font-medium',
                          active
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-white text-muted-foreground border-[2rpx] border-border',
                        )}
                        onClick={() => onPerfPayoutChange(item.id, o.value)}
                      >
                        {o.label}
                      </View>
                    );
                  })}
                </View>
              </View>
              <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
                按当月个人卖卡业绩达到的最高档结算该分类课时费。
              </Text>
              {item.perfTiers.map((t, idx) => (
                <GradientRow
                  key={t.id}
                  fields={[
                    {
                      key: 'threshold',
                      label: '业绩达到',
                      suffix: '元,',
                      error: errors?.perfTiers?.[t.id]?.threshold,
                    },
                    {
                      key: 'rate',
                      label: item.perfPayoutMode === 'revenue_share' ? '比例' : '固定',
                      suffix: item.perfPayoutMode === 'revenue_share' ? '%' : '元/节',
                      error: errors?.perfTiers?.[t.id]?.rate,
                    },
                  ]}
                  values={{ threshold: String(t.threshold ?? ''), rate: String(t.rate ?? '') }}
                  onChange={(k, raw) =>
                    onPerfTierChange(item.id, t.id, k as 'threshold' | 'rate', raw)
                  }
                  showDelete={item.perfTiers.length > 1 || idx > 0}
                  onDelete={() => onDeletePerfTier(item.id, t.id)}
                />
              ))}
              <GradientRow asAddButton onAdd={() => onAddPerfTier(item.id)} />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default CategoryLessonFeeCard;
