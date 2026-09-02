import { View, Text } from '@tarojs/components';
import React from 'react';
import FormInput from '@/components/FormInput';
import Switch from '@/components/Switch';
import type { CourseGroupFee } from '@/types/teacher';
import { CATEGORY_MODE_LABEL } from './constants';
import type { SalaryRuleEditorErrors } from './types';

export interface CourseGroupFeeEditorProps {
  groups: CourseGroupFee[];
  errors: SalaryRuleEditorErrors;
  onToggleShare: (categoryId: string, on: boolean) => void;
  onToggleItemShare: (categoryId: string, courseId: string, on: boolean) => void;
  onUpdateRate: (categoryId: string, courseId: string, raw: string) => void;
}

const CourseGroupFeeEditor: React.FC<CourseGroupFeeEditorProps> = ({
  groups,
  onToggleShare,
  onToggleItemShare,
  onUpdateRate,
}) => {
  if (groups.length === 0) {
    return (
      <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
        暂无课程分类，请先前往课程设置添加分类和课程。
      </Text>
    );
  }

  return (
    <View className="flex flex-col gap-[8rpx]">
      <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
        读取课程设置中的分类与课程，为每门课程单独设置课时费；开启「课时分成」则按该节课业绩比例结算。
      </Text>
      {groups.map((g) => (
        <View key={g.categoryId} className="mb-[16rpx]">
          <View className="flex items-center justify-between mb-[8rpx]">
            <View className="flex items-center gap-[12rpx]">
              <Text className="text-[28rpx] font-semibold text-foreground">{g.groupName}</Text>
              <View className="px-[12rpx] py-[4rpx] rounded-[8rpx] bg-muted text-muted-foreground text-[20rpx]">
                {CATEGORY_MODE_LABEL[g.groupType]}
              </View>
            </View>
            <View className="flex items-center gap-[8rpx]">
              <Text className="text-[24rpx] text-muted-foreground">课时分成</Text>
              <Switch
                checked={g.useRevenueShare}
                onChange={(on) => onToggleShare(g.categoryId, on)}
              />
            </View>
          </View>
          {g.courses.length === 0 ? (
            <Text className="text-[24rpx] text-muted-foreground py-[12rpx]">该分类下暂无课程</Text>
          ) : (
            <View className="flex flex-col">
              {g.courses.map((c) => (
                <View
                  key={c.id}
                  className="flex items-center py-[12rpx] gap-[16rpx] border-b border-border last:border-b-0"
                >
                  <Text className="text-[28rpx] text-foreground flex-1 min-w-0 truncate">
                    {c.courseName}
                  </Text>
                  <View className="flex items-center gap-[8rpx]">
                    <Switch
                      checked={c.useRevenueShare}
                      onChange={(on) => onToggleItemShare(g.categoryId, c.courseId, on)}
                    />
                  </View>
                  <FormInput
                    variant="ghost"
                    type="digit"
                    placeholder="0"
                    suffix={
                      <Text className="text-[26rpx] text-muted-foreground ml-[4rpx]">
                        {c.useRevenueShare || g.useRevenueShare ? '%' : '元/课时'}
                      </Text>
                    }
                    value={String(c.rate ?? '')}
                    onInput={(e) => {
                      onUpdateRate(g.categoryId, c.courseId, e.detail.value);
                    }}
                    inputClassName="w-[180rpx] h-[72rpx] bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-right"
                    className="mb-0"
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

export default CourseGroupFeeEditor;
