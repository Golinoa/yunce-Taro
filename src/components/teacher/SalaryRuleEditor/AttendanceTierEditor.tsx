import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import type { AttendanceTier } from '@/types/teacher';
import GradientRow from './GradientRow';

export interface AttendanceTierEditorProps {
  perPerson?: boolean;
  tiers: AttendanceTier[];
  errors?: Record<string, { minCount?: string; maxCount?: string; rate?: string }>;
  onChange: (id: string, key: 'minCount' | 'maxCount' | 'rate', raw: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const AttendanceTierEditor: React.FC<AttendanceTierEditorProps> = ({
  perPerson = false,
  tiers,
  errors,
  onChange,
  onDelete,
  onAdd,
}) => {
  return (
    <View className="flex flex-col">
      <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
        {perPerson
          ? '按实际到课人数选择梯度，再按人数 × 每人每节单价计算。例如 1-6 人每人每节 5 元，5 人合计 25 元。'
          : '按实际到课人数选择整节课课时费。例如 1-5 人 80 元/节、6-10 人 100 元/节。'}
      </Text>
      {tiers.map((t, idx) => (
        <View key={t.id} className="flex flex-col mt-[16rpx]">
          <View className="flex items-center gap-[12rpx]">
            <Text className="text-[28rpx] text-foreground whitespace-nowrap">人数</Text>
            <FormInput
              variant="ghost"
              type="number"
              placeholder="0"
              value={String(t.minCount ?? '')}
              onInput={(e) => onChange(t.id, 'minCount', e.detail.value)}
              inputClassName="w-[120rpx] h-[72rpx] bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-right"
              className="mb-0"
            />
            <Text className="text-[28rpx] text-muted-foreground whitespace-nowrap">至</Text>
            <FormInput
              variant="ghost"
              type="number"
              placeholder="不限"
              value={String(t.maxCount ?? '')}
              onInput={(e) => onChange(t.id, 'maxCount', e.detail.value)}
              inputClassName="w-[120rpx] h-[72rpx] bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-right"
              className="mb-0"
            />
            <Text className="text-[28rpx] text-foreground whitespace-nowrap">
              {perPerson ? '人，每人每节' : '人，每节'}
            </Text>
            <FormInput
              variant="ghost"
              type="digit"
              placeholder="0"
              suffix={<Text className="text-[26rpx] text-muted-foreground ml-[4rpx]">元</Text>}
              value={String(t.rate ?? '')}
              onInput={(e) => onChange(t.id, 'rate', e.detail.value)}
              inputClassName="w-[160rpx] h-[72rpx] bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-right"
              className="mb-0"
            />
            <View
              className={cn(
                'w-[56rpx] h-[56rpx] rounded-full flex items-center justify-center shrink-0',
                tiers.length > 1 || idx > 0 ? 'press-bg' : 'opacity-0 pointer-events-none',
              )}
              onClick={() => {
                if (tiers.length > 1 || idx > 0) onDelete(t.id);
              }}
            >
              <Icon name="mdi-delete-outline" size={24} className="text-muted-foreground" />
            </View>
          </View>
          {(errors?.[t.id]?.minCount || errors?.[t.id]?.maxCount || errors?.[t.id]?.rate) && (
            <Text className="mt-[8rpx] text-[24rpx] text-error">
              {errors[t.id]?.minCount || errors[t.id]?.maxCount || errors[t.id]?.rate}
            </Text>
          )}
        </View>
      ))}
      <GradientRow asAddButton onAdd={onAdd} />
    </View>
  );
};

export default AttendanceTierEditor;
