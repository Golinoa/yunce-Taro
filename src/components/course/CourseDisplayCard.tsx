/**
 * CourseDisplayCard - 课程展示卡片
 *
 * 从 course-form「课程展示」区块（课程颜色/年龄组/课程难度）抽离，
 * 用于复用展示班级已配置的展示属性（只读）。
 *
 * 若需要可编辑版（颜色 picker、年龄组/难度 PickerSheet），传入 onPick* 回调即可。
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Card from '@/components/Card';
import FormRow from '@/components/FormRow';
import { CLASS_LEVEL_BADGE_TEXT, CLASS_LEVEL_BADGE_WRAP } from '@/types/class';

export interface CourseDisplayCardProps {
  /** 课程颜色（hex/rgba 等 CSS color） */
  color?: string;
  /** 年龄组显示文案 */
  ageGroupLabel?: string;
  /** 课程难度显示文案 */
  levelLabel?: string;
  /** 颜色字段 ? 提示内容 */
  colorHint?: string;
  /** 课程颜色点击回调（不传则只读） */
  onPickColor?: () => void;
  /** 年龄组点击回调（不传则只读） */
  onPickAgeGroup?: () => void;
  /** 课程难度点击回调（不传则只读） */
  onPickLevel?: () => void;
}

const CourseDisplayCard: React.FC<CourseDisplayCardProps> = ({
  color,
  ageGroupLabel,
  levelLabel,
  colorHint,
  onPickColor,
  onPickAgeGroup,
  onPickLevel,
}) => (
  <Card className="p-[32rpx]">
    {/* 课程颜色 */}
    <FormRow label="课程颜色" hint={colorHint} onClick={onPickColor} border>
      {color ? (
        <View className="flex flex-row items-center gap-[12rpx]">
          <View className="w-[32rpx] h-[32rpx] rounded-[8rpx]" style={{ backgroundColor: color }} />
          <Text className="text-[30rpx] text-foreground">已选择</Text>
        </View>
      ) : (
        <Text className="text-[30rpx] text-muted-foreground">请选择</Text>
      )}
    </FormRow>

    {/* 年龄组 */}
    <FormRow label="年龄组" onClick={onPickAgeGroup} border>
      <Text className="text-[30rpx] text-foreground">{ageGroupLabel || '—'}</Text>
    </FormRow>

    {/* 课程难度 */}
    <FormRow label="课程难度" onClick={onPickLevel} border={false}>
      {levelLabel ? (
        <View className={CLASS_LEVEL_BADGE_WRAP}>
          <Text className={CLASS_LEVEL_BADGE_TEXT}>{levelLabel}</Text>
        </View>
      ) : (
        <Text className="text-[30rpx] text-muted-foreground">—</Text>
      )}
    </FormRow>
  </Card>
);

export default CourseDisplayCard;
