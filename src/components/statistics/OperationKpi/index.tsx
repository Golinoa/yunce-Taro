import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';

/** 运营 KPI 数据项 */
export interface OperationKpiItem {
  /** 在册学员数 */
  students: number;
  /** 学员趋势（如 +3） */
  studentsTrend: string;
  /** 学员备注 */
  studentsNote: string;
  /** 消耗课时 */
  hours: number;
  /** 课时趋势 */
  hoursTrend: string;
  /** 上课人次 */
  count: number;
  /** 人次趋势 */
  countTrend: string;
  /** 新签学员 */
  newSign: number;
  /** 新签备注 */
  newSignNote: string;
  /** 剩余课时 */
  remain: number;
  /** 剩余备注 */
  remainNote: string;
}

/**
 * 格式化数字：长数字截断，不带单位
 * - < 1000: 原样显示
 * - 1000 ~ 9999: 显示如 1.2k
 * - >= 10000: 显示如 1.2万
 */
function formatNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  const w = n / 10000;
  return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}万`;
}

/** 花瓣小卡片配置 */
interface PetalCardProps {
  /** 背景渐变类名 */
  bgClass: string;
  /** 标签 */
  label: string;
  /** 主数值（已格式化，不带单位） */
  value: string;
  /** 趋势/备注文本 */
  trend: string;
  /** 趋势是否向上 */
  trendUp?: boolean;
  /** 趋势颜色类名 */
  trendColorClass?: string;
}

/** 花瓣小卡片（深色渐变背景 + 白色文字） */
const PetalCard: React.FC<PetalCardProps> = ({
  bgClass,
  label,
  value,
  trend,
  trendUp,
  trendColorClass = 'text-primary-foreground/80',
}) => (
  <View className={`relative overflow-hidden rounded-2xl p-[20rpx] ${bgClass}`}>
    {/* 装饰光斑 */}
    <View className="absolute -top-[40rpx] -right-[40rpx] w-[112rpx] h-[112rpx] rounded-full bg-primary-foreground/20" />
    <View className="absolute -bottom-[24rpx] -left-[24rpx] w-[80rpx] h-[80rpx] rounded-full bg-primary-foreground/10" />
    {/* 标签 */}
    <View className="relative z-10 mb-[8rpx]">
      <Text className="text-[20rpx] font-medium text-primary-foreground">{label}</Text>
    </View>
    {/* 主数值（不带单位，长数字已截断） */}
    <Text className="relative z-10 text-[44rpx] font-bold number-display leading-none text-primary-foreground block truncate">
      {value}
    </Text>
    {/* 趋势 */}
    <View className="relative z-10 flex items-center gap-[4rpx] mt-[8rpx]">
      {trendUp !== undefined && (
        <Icon
          name={trendUp ? 'mdi-trending-up' : 'mdi-trending-down'}
          size="xs"
          color="hsl(var(--primary-foreground))"
        />
      )}
      <Text className={`text-[18rpx] font-medium ${trendColorClass}`}>{trend}</Text>
    </View>
  </View>
);

/**
 * 运营 KPI 组件
 * 左侧大卡片（在册学员，带单位"人"）+ 右侧 2x2 花瓣渐变方块（不带单位，长数字截断）
 */
const OperationKpi: React.FC<{ data: OperationKpiItem }> = ({ data }) => {
  return (
    <View className="flex gap-[16rpx] mb-[32rpx] min-h-[344rpx]">
      {/* 左侧大卡片：在册学员（绿色渐变，带单位"人"） */}
      <View className="rounded-2xl p-[24rpx] relative overflow-hidden flex flex-col justify-between bg-kpi-green flex-[0.9]">
        {/* 装饰光斑 */}
        <View className="absolute -top-[64rpx] -right-[48rpx] w-[192rpx] h-[192rpx] rounded-full bg-primary-foreground/20" />
        <View className="absolute top-[96rpx] -right-[24rpx] w-[96rpx] h-[96rpx] rounded-full bg-primary-foreground/15" />
        <View className="absolute -bottom-[48rpx] -left-[48rpx] w-[160rpx] h-[160rpx] rounded-full bg-primary-foreground/10" />

        {/* 顶部：标签 + 趋势 */}
        <View className="relative z-10 flex items-center justify-between">
          <Text className="text-[22rpx] font-medium text-primary-foreground">在册学员</Text>
          <View className="flex items-center gap-[4rpx] px-[12rpx] py-[4rpx] rounded-full bg-primary-foreground/20">
            <Icon name="mdi-trending-up" size="xs" color="hsl(var(--primary-foreground))" />
            <Text className="text-[20rpx] font-bold text-primary-foreground">
              {data.studentsTrend}
            </Text>
          </View>
        </View>

        {/* 中部：主数据（带单位"人"） */}
        <View className="relative z-10">
          <Text className="text-[72rpx] font-bold number-display leading-none text-primary-foreground block">
            {data.students}
            <Text className="text-[28rpx] font-normal ml-[8rpx] text-primary-foreground/70">
              人
            </Text>
          </Text>
        </View>

        {/* 底部：备注 */}
        <View className="relative z-10 flex items-center gap-[8rpx]">
          <Icon name="mdi-trending-up" size="xs" color="hsl(var(--primary-foreground))" />
          <Text className="text-[20rpx] text-primary-foreground/70">{data.studentsNote}</Text>
        </View>
      </View>

      {/* 右侧 2x2 方块组合（不带单位，长数字截断） */}
      <View className="grid grid-cols-2 grid-rows-2 gap-[16rpx] flex-[2.1]">
        {/* 消耗课时 */}
        <PetalCard
          bgClass="bg-kpi-orange"
          label="消耗课时"
          value={formatNum(data.hours)}
          trend={data.hoursTrend}
          trendUp
          trendColorClass="text-primary-foreground/80"
        />
        {/* 上课人次 */}
        <PetalCard
          bgClass="bg-kpi-blue"
          label="上课人次"
          value={formatNum(data.count)}
          trend={data.countTrend}
          trendUp
          trendColorClass="text-primary-foreground/80"
        />
        {/* 新签学员 */}
        <PetalCard
          bgClass="bg-kpi-purple"
          label="新签学员"
          value={formatNum(data.newSign)}
          trend={data.newSignNote}
          trendColorClass="text-primary-foreground/80"
        />
        {/* 剩余课时 */}
        <PetalCard
          bgClass="bg-kpi-amber"
          label="剩余课时"
          value={formatNum(data.remain)}
          trend={data.remainNote}
          trendColorClass="text-primary-foreground/80"
        />
      </View>
    </View>
  );
};

export default OperationKpi;
