import { View, Text } from '@tarojs/components';
import React from 'react';
import type { PerfTier } from '@/types/teacher';
import GradientRow from './GradientRow';

export interface PerfTierEditorProps {
  tiers: PerfTier[];
  errors?: Record<string, { threshold?: string; rate?: string }>;
  hint?: string;
  onChange: (id: string, key: 'threshold' | 'rate', raw: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const PerfTierEditor: React.FC<PerfTierEditorProps> = ({
  tiers,
  errors,
  hint,
  onChange,
  onDelete,
  onAdd,
}) => {
  return (
    <View className="flex flex-col">
      {hint && (
        <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
          {hint}
        </Text>
      )}
      {tiers.map((t, idx) => (
        <GradientRow
          key={t.id}
          fields={[
            {
              key: 'threshold',
              label: '业绩达到：',
              suffix: '元,',
              error: errors?.[t.id]?.threshold,
            },
            {
              key: 'rate',
              label: '课时费：',
              suffix: '%',
              error: errors?.[t.id]?.rate,
            },
          ]}
          values={{
            threshold: String(t.threshold ?? ''),
            rate: String(t.rate ?? ''),
          }}
          onChange={(k, raw) => onChange(t.id, k as 'threshold' | 'rate', raw)}
          showDelete={tiers.length > 1 || idx > 0}
          onDelete={() => onDelete(t.id)}
        />
      ))}
      <GradientRow asAddButton onAdd={onAdd} />
    </View>
  );
};

export default PerfTierEditor;
