/**
 * AlertSheet - 预警弹窗组件
 * 基于 BottomSheet 封装，展示预警分类列表
 * 点击预警项跳转详情页，可单条已读
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';

/** 预警项类型 */
export type AlertLevel = 'danger' | 'warning' | 'primary';

/** 预警详情项（单条，如某个学员） */
export interface AlertDetailItem {
  /** 唯一标识 */
  id: string;
  /** 名称 */
  name: string;
  /** 补充信息 */
  info: string;
  /** 关联ID（用于跳转） */
  refId?: string;
}

/** 预警项数据 */
export interface AlertItem {
  /** 唯一标识（用于已读/不再提示） */
  id: string;
  /** 预警级别 */
  level: AlertLevel;
  /** 标题 */
  title: string;
  /** 描述 */
  desc: string;
  /** 数量 */
  count: number;
  /** 详情列表 */
  details: AlertDetailItem[];
}

/** 预警级别配置 */
const LEVEL_CONFIG: Record<
  AlertLevel,
  {
    barClass: string;
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    badgeText: string;
    icon: string;
  }
> = {
  danger: {
    barClass: 'bg-destructive',
    iconBg: 'bg-destructive/10',
    iconColor: 'destructive',
    badgeBg: 'bg-destructive/10',
    badgeText: 'text-destructive',
    icon: 'mdi-alert-circle',
  },
  warning: {
    barClass: 'bg-warning',
    iconBg: 'bg-warning/10',
    iconColor: 'warning',
    badgeBg: 'bg-warning/10',
    badgeText: 'text-warning',
    icon: 'mdi-alert',
  },
  primary: {
    barClass: 'bg-primary',
    iconBg: 'bg-primary/10',
    iconColor: 'primary',
    badgeBg: 'bg-primary/10',
    badgeText: 'text-primary',
    icon: 'mdi-information',
  },
};

interface AlertSheetProps {
  visible: boolean;
  total: number;
  alerts: AlertItem[];
  onClose: () => void;
}

/**
 * 预警弹窗组件
 * 点击预警项跳转 /package-statistics/pages/alert-detail 页面查看详情
 */
const AlertSheet: React.FC<AlertSheetProps> = ({ visible, total, alerts, onClose }) => {
  const handleAlertClick = useCallback(
    (alert: AlertItem) => {
      onClose();
      Taro.navigateTo({
        url: `/package-statistics/pages/alert-detail/index?alertId=${alert.id}`,
      });
    },
    [onClose],
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="70vh">
      {/* 标题区 */}
      <View className="px-[32rpx] pt-[8rpx] pb-[24rpx]">
        <View className="flex items-center justify-between">
          <View className="flex items-center gap-[16rpx]">
            <View className="w-[48rpx] h-[48rpx] rounded-full bg-destructive/10 flex items-center justify-center">
              <Icon name="mdi-shield-alert" size="sm" color="destructive" />
            </View>
            <View>
              <Text className="text-[32rpx] font-bold text-foreground block">预警处理</Text>
              <Text className="text-[24rpx] text-foreground-secondary block mt-[2rpx]">
                共 {total} 项待处理
              </Text>
            </View>
          </View>
          <View
            className="w-[56rpx] h-[56rpx] rounded-full bg-muted/30 flex items-center justify-center"
            onClick={onClose}
          >
            <Icon name="mdi-close" size="xs" color="muted-foreground" />
          </View>
        </View>
      </View>

      {/* 分隔线 */}
      <View className="h-[2rpx] bg-border-light mx-[32rpx]" />

      {/* 预警列表 */}
      <View className="px-[32rpx] py-[24rpx] flex flex-col gap-[20rpx]">
        {alerts.map((alert) => {
          const config = LEVEL_CONFIG[alert.level];
          return (
            <View
              key={alert.id}
              className="rounded-[20rpx] border-[2rpx] border-solid border-border-light flex items-stretch overflow-hidden press-scale"
              onClick={() => handleAlertClick(alert)}
            >
              {/* 左侧色条 */}
              <View className={`w-[8rpx] flex-shrink-0 ${config.barClass}`} />

              {/* 卡片内容 */}
              <View className="flex-1 px-[24rpx] py-[24rpx] flex items-center gap-[20rpx] min-w-0">
                {/* 图标 */}
                <View
                  className={`w-[64rpx] h-[64rpx] rounded-[16rpx] flex items-center justify-center flex-shrink-0 ${config.iconBg}`}
                >
                  <Icon name={config.icon} size="sm" color={config.iconColor} />
                </View>

                {/* 文本区 */}
                <View className="flex-1 min-w-0">
                  <Text className="text-[28rpx] font-semibold text-foreground block truncate">
                    {alert.title}
                  </Text>
                  <Text className="text-[24rpx] text-foreground-secondary block mt-[4rpx] truncate">
                    {alert.desc}
                  </Text>
                </View>

                {/* 右侧：数量 + 箭头 */}
                <View className="flex items-center gap-[12rpx] flex-shrink-0">
                  <View className={`px-[20rpx] py-[8rpx] rounded-full ${config.badgeBg}`}>
                    <Text className={`text-[24rpx] font-bold ${config.badgeText}`}>
                      {alert.count}
                    </Text>
                  </View>
                  <Icon name="mdi-chevron-right" size="xs" color="muted-foreground" />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* 底部安全区 */}
      <View className="h-[24rpx]" />
    </BottomSheet>
  );
};

export default AlertSheet;
