import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';

/** 预警摘要数据 */
export interface AlertSummaryData {
  /** 预警总数 */
  total: number;
  /** 预警详情文本（如 "课时不足 5 · 即将过期 3 · 待续费 8"） */
  detail: string;
}

/**
 * 预警摘要条组件
 * 点击后打开预警弹窗
 * 对齐设计稿 scheme-bc-fusion-v2.html
 */
const AlertSummaryBar: React.FC<{
  data: AlertSummaryData;
  onClick: () => void;
}> = ({ data, onClick }) => {
  return (
    <View
      className="bg-white rounded-[24rpx] p-[24rpx] border-[2rpx] border-solid border-destructive/20 flex items-center justify-between shadow-card press-scale"
      onClick={onClick}
    >
      <View className="flex items-center gap-[24rpx] flex-1 min-w-0">
        {/* 预警图标 */}
        <View className="w-[72rpx] h-[72rpx] rounded-[16rpx] bg-destructive/10 flex items-center justify-center relative flex-shrink-0">
          <Icon name="mdi-alert" size="sm" color="destructive" />
          <View className="absolute -top-[4rpx] -right-[4rpx] w-[20rpx] h-[20rpx] bg-destructive rounded-full border-[4rpx] border-white" />
        </View>
        {/* 文本 */}
        <View className="min-w-0 flex-1">
          <Text className="text-[28rpx] font-semibold text-foreground block">
            待处理预警 <Text className="text-destructive">{data.total}</Text> 项
          </Text>
          <Text className="text-[24rpx] text-foreground-secondary block mt-[4rpx] truncate">
            {data.detail}
          </Text>
        </View>
      </View>
      {/* 查看箭头 */}
      <View className="flex items-center gap-[8rpx] text-primary flex-shrink-0 ml-[16rpx]">
        <Text className="text-[24rpx] font-medium">查看</Text>
        <Icon name="mdi-chevron-right" size="sm" color="primary" />
      </View>
    </View>
  );
};

export default AlertSummaryBar;
